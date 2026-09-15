/**
 * 更新工具栏高度，动态调整其他元素位置
 */
function updateToolbarHeight() {
    if (topToolbar) {
        const toolbarHeight = topToolbar.offsetHeight;
        document.documentElement.style.setProperty('--toolbar-height', toolbarHeight + 'px');
        if (wordsbox) {
            const availableHeight = window.innerHeight - toolbarHeight;
            wordsbox.style.top = `${toolbarHeight}px`;
            wordsbox.style.height = `${availableHeight}px`;
            const markdownContainer = wordsbox.querySelector('.markdown-editor-container');
            if (markdownContainer) {
                markdownContainer.style.height = 'auto';
                markdownContainer.style.flex = '1 1 auto';
                markdownContainer.style.minHeight = '0';
            }
            const preview = wordsbox.querySelector('.markdown-preview');
            if (preview) preview.style.height = '100%';
        }
        const bigbox = document.querySelector('.bigbox');
        if (bigbox) {
            bigbox.style.top = `${toolbarHeight}px`;
            bigbox.style.height = `${window.innerHeight - toolbarHeight}px`;
        }
        const sidebarResizer = document.getElementById('sidebarResizer');
        if (sidebarResizer) {
            sidebarResizer.style.top = `${toolbarHeight}px`;
            sidebarResizer.style.height = `${window.innerHeight - toolbarHeight}px`;
        }
    }
}
if (topToolbar) {
    requestAnimationFrame(function() {
        updateToolbarHeight();
        setTimeout(updateToolbarHeight, 0);
    });
    window.addEventListener('load', updateToolbarHeight);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateToolbarHeight);
    } else {
        updateToolbarHeight();
    }
    window.addEventListener('resize', updateToolbarHeight);
    const observer = new MutationObserver(updateToolbarHeight);
    observer.observe(topToolbar, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
}
if (topSaveBtn) {
    topSaveBtn.addEventListener("click", function() {
        handleSave();
    });
}
if (topLoadBtn) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.sora,.json,.txt,.xml,.csv,.encrypted.json';  
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    topLoadBtn.addEventListener("click", async function() {
        if (typeof isFileSystemAccessSupported === 'function' && isFileSystemAccessSupported()) {
            const opened = await openFileWithFSAPI();
            if (opened) return;
            return;
        }
        fileInput.click();
    });
    fileInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const fileName = file.name;
        if (typeof isSoraPackageFile === 'function' && isSoraPackageFile(file)) {
            try {
                await openSoraPackageFile(file, null);
            } catch (error) {
                console.error("文件加载错误:", error);
                customAlert("文件加载失败：" + error.message);
            }
            fileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                let parsedData = null;
                let fromCache = false;
                const isEncrypted = isEncryptedContent(reader.result);
                if (!isEncrypted && typeof FileCache !== 'undefined') {
                    parsedData = await FileCache.get(file);
                    if (parsedData) {
                        fromCache = true;
                        window.SoraDiagnostics?.debug('从文件缓存加载', fileName);
                    }
                }
                if (!parsedData) {
                    parsedData = parseFileContent(reader.result, fileName);
                    if (parsedData instanceof Promise) {
                        parsedData = await parsedData;
                    }
                    if (!parsedData) {
                        fileInput.value = '';
                        return;
                    }
                    if (!isEncrypted && typeof FileCache !== 'undefined' && Array.isArray(parsedData)) {
                        FileCache.set(file, parsedData)
                            .then(() => window.SoraDiagnostics?.debug('文件已缓存', fileName))
                            .catch(err => console.warn('FileCache: 缓存保存失败', err));
                    }
                }
                if (typeof isDiffFile === 'function' && isDiffFile(parsedData)) {
                    if (!mulufile || mulufile.length === 0) {
                        customAlert("差异补丁文件需要先加载基础数据才能应用");
                        fileInput.value = '';
                        return;
                    }
                    const result = applyDiffPatches(parsedData);
                    LoadMulu();
                    if (typeof markUnsavedChanges === 'function') {
                        markUnsavedChanges();
                    }
                    let msg = `已应用差异补丁：${result.applied} 个目录`;
                    if (result.notFound > 0) msg += `（新建 ${result.notFound} 个）`;
                    if (result.failed > 0) msg += `，${result.failed} 个失败`;
                    showToast(msg, result.failed > 0 ? 'warning' : 'success', 3000);
                    fileInput.value = '';
                    setTimeout(() => {
                        if (typeof expandAllDirectories === 'function') expandAllDirectories();
                        if (typeof selectFirstRootDirectory === 'function') selectFirstRootDirectory();
                    }, 10);
                    bigbox.style.display = "block";
                    wordsbox.style.display = "";
                    return;
                }
                if (!Array.isArray(parsedData) || parsedData.length === 0) {
                    customAlert("文件格式错误：无法解析为有效的目录数据");
                    fileInput.value = '';
                    return;
                }
                const isIncremental = parsedData[0].length >= 4 && parsedData[0][0] !== "mulu";
                let loadMode = 'replace';
                if (mulufile && mulufile.length > 0) {
                    const modeOptions = [
                        { value: 'replace', label: '替换 - 清空现有数据，加载新文件' },
                        { value: 'merge', label: '合并 - 将新数据合并到现有数据' }
                    ];
                    const defaultMode = isIncremental ? 'merge' : 'replace';
                    const hint = isIncremental ? '（检测到增量文件，建议合并）' : '';
                    loadMode = await customSelect(`选择加载方式${hint}：`, modeOptions, defaultMode, '加载文件');
                    if (loadMode === null) {
                        showToast('已取消加载', 'info', 2000);
                        fileInput.value = '';
                        return;
                    }
                }
                if (loadMode === 'merge') {
                    const mergeResult = mergeDirectoryData(mulufile, parsedData);
                    mulufile = mergeResult.data;
                    rebuildMulufileIndex();
                    LoadMulu();
                    if (typeof markUnsavedChanges === 'function') {
                        markUnsavedChanges();
                    }
                    const cacheMsg = fromCache ? '（从缓存快速加载）' : '';
                    showToast(`已合并：新增 ${mergeResult.added} 个，更新 ${mergeResult.updated} 个目录${cacheMsg}`, 'success', 3000);
                } else {
                    if (parsedData[0].length < 4 || parsedData[0][0] !== "mulu") {
                        customAlert("文件格式错误：第一个目录必须以'mulu'开头，且每个目录数据必须包含4个元素\n\n如果这是增量文件，请选择【合并】模式加载");
                        fileInput.value = '';
                        return;
                    }
                    mulufile = parsedData;
                    if (window.SoraDocumentIdentity) window.SoraDocumentIdentity.adoptFile(file);
                    if (window.DirectoryMetadata) window.DirectoryMetadata.reset();
                    if (typeof loadDirectoryLevelColors === 'function') {
                        loadDirectoryLevelColors(null);
                    }
                    if (typeof currentFileHandle !== 'undefined') {
                        currentFileHandle = null;
                    }
                    if (typeof currentFileName !== 'undefined') {
                        currentFileName = fileName;
                    }
                    LoadMulu();
                    if (typeof scheduleHashBaselineUpdate === 'function') {
                        scheduleHashBaselineUpdate();
                    } else if (typeof calculateAllHashes === 'function') {
                        setTimeout(calculateAllHashes, 0);
                    }
                    if (typeof hasUnsavedChanges !== 'undefined') {
                        hasUnsavedChanges = false;
                    }
                    if (typeof updateSaveButtonState === 'function') {
                        updateSaveButtonState();
                    }
                    if (typeof DraftManager !== 'undefined') DraftManager.resetAfterLoad();
                    if (typeof DirectoryHistory !== 'undefined') DirectoryHistory.clear();
                    const cacheMsg = fromCache ? '（从缓存快速加载）' : '';
                    showToast(`已加载：${fileName}${cacheMsg}`, 'success', 2500);
                }
                setTimeout(() => {
                    if (typeof expandAllDirectories === 'function') {
                        expandAllDirectories();
                    }
                    if (typeof selectFirstRootDirectory === 'function') {
                        selectFirstRootDirectory();
                    } else {
                        let firstRootMulu = null;
                        let allMulusForSelect = document.querySelectorAll(".mulu");
                        for (let i = 0; i < allMulusForSelect.length; i++) {
                            let mulu = allMulusForSelect[i];
                            let parentId = mulu.getAttribute("data-parent-id");
                            if (!parentId || parentId === "mulu") {
                                firstRootMulu = mulu;
                                break;
                            }
                        }
                        if (firstRootMulu) {
                            currentMuluName = firstRootMulu.id;
                            RemoveOtherSelect();
                            firstRootMulu.classList.add("select");
                            let loadedContent = findMulufileData(firstRootMulu);
                            jiedianwords.value = loadedContent;
                            isUpdating = true;
                            updateMarkdownPreview();
                            isUpdating = false;
                        }
                    }
                }, 10);
                bigbox.style.display = "block";
                wordsbox.style.display = "";
                if (fileNameInput) {
                    let nameWithoutExt = fileName
                        .replace(/\s*\(\d+\)\s*\./g, '.')       
                        .replace(/\.(json|txt|xml|csv)$/i, '')
                        .replace(/\.(encrypted|patch)$/i, '')
                        .replace(/_incremental$/i, '');
                    fileNameInput.value = nameWithoutExt;
                }
            } catch (error) {
                console.error("文件加载错误:", error);
                customAlert("文件加载失败：" + error.message);
            }
            fileInput.value = '';
        };
        reader.onerror = function() {
            customAlert("文件读取失败");
            fileInput.value = '';
        };
        reader.readAsText(file);
    });
}
if (expandAllBtn) {
    expandAllBtn.addEventListener("click", function() {
        if (typeof expandAllDirectories === 'function') {
            expandAllDirectories();
        }
    });
}
if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", function() {
        if (typeof collapseAllDirectories === 'function') {
            collapseAllDirectories();
        }
    });
}
if (toggleSidebarBtn) {
    let sidebarVisible = true;
    toggleSidebarBtn.addEventListener("click", function() {
        sidebarVisible = !sidebarVisible;
        const sidebarResizer = document.getElementById('sidebarResizer');
        if (sidebarResizer) {
            sidebarResizer.classList.toggle('sidebar-hidden', !sidebarVisible);
        }
        if (sidebarVisible) {
            bigbox.style.display = "block";
            if (sidebarResizer) sidebarResizer.style.display = "block";
            wordsbox.style.left = "";
            wordsbox.style.width = "";
            toggleSidebarBtn.textContent = "隐藏侧边栏";
        } else {
            bigbox.style.display = "none";
            if (sidebarResizer) sidebarResizer.style.display = "none";
            wordsbox.style.left = "0";
            wordsbox.style.width = "100%";
            toggleSidebarBtn.textContent = "显示侧边栏";
        }
        if (typeof updateToolbarHeight === 'function') {
            updateToolbarHeight();
        }
    });
}
if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                customAlert('无法进入全屏模式: ' + err.message);
            });
            fullscreenBtn.textContent = "退出全屏";
        } else {
            document.exitFullscreen();
            fullscreenBtn.textContent = "全屏";
        }
    });
    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement && fullscreenBtn) {
            fullscreenBtn.textContent = "全屏";
        }
    });
}
if (newBtn) {
    newBtn.addEventListener("click", async function() {
        const result = await customConfirm("确定要新建吗？当前未保存的内容将丢失。\n\n注意：这将清空所有已存储的图片、视频和压缩文件！");
        if (result) {
            if (typeof MediaStorage !== 'undefined' && MediaStorage.clearAll) {
                try {
                    await MediaStorage.clearAll();
                    window.SoraDiagnostics?.info('新建文档时已清空本地媒体存储');
                } catch (err) {
                    console.error('清空本地媒体存储失败:', err);
                }
            }
            mulufile = [];
            if (typeof rebuildMulufileIndex === 'function') rebuildMulufileIndex();
            if (window.DirectoryMetadata) window.DirectoryMetadata.reset();
            if (window.SoraDocumentIdentity) window.SoraDocumentIdentity.newDocument('soralist');
            if (typeof DraftManager !== 'undefined') await DraftManager.clear();
            if (typeof DirectoryHistory !== 'undefined') DirectoryHistory.clear();
            if (typeof loadDirectoryLevelColors === 'function') {
                loadDirectoryLevelColors(null);
            }
            currentMuluName = null;
            if (typeof currentFileHandle !== 'undefined') currentFileHandle = null;
            if (typeof currentFileName !== 'undefined') currentFileName = 'soralist';
            const firststep = document.querySelector(".firststep");
            if (firststep) firststep.innerHTML = "";
            if (jiedianwords) jiedianwords.value = "";
            if (markdownPreview) markdownPreview.innerHTML = "";
            if (fileNameInput) fileNameInput.value = "soralist";
            if (typeof DirectoryNavigation !== 'undefined') {
                DirectoryNavigation.refresh();
            }
            if (typeof createNewDirectory === 'function') {
                const defaultDirectory = createNewDirectory('默认目录', false);
                if (defaultDirectory) {
                    const defaultDirId = defaultDirectory.getAttribute('data-dir-id');
                    const defaultRow = typeof getMulufileByDirId === 'function'
                        ? getMulufileByDirId(defaultDirId)
                        : null;
                    if (defaultRow) defaultRow[3] = '';
                    if (typeof switchToDirectoryElement === 'function') {
                        await switchToDirectoryElement(defaultDirectory, {
                            syncCurrent: false,
                            scrollPreviewTop: true,
                            forceRender: true
                        });
                    } else if (typeof selectNewDirectory === 'function') {
                        selectNewDirectory(defaultDirectory);
                    }
                }
            }
            if (typeof DirectoryHistory !== 'undefined') DirectoryHistory.clear();
            if (typeof updateStorageInfo === 'function') {
                await updateStorageInfo();
            }
            customAlert("已新建默认目录，存储空间已清理");
        }
    });
}
if (saveAsBtn) {
    saveAsBtn.addEventListener("click", async function() {
        const saveAsOptions = [
            { value: 'sora', label: 'Sora 单文件包 (.sora) - 可导入，包含媒体' },
            { value: 'webpage', label: '网页 (.html) - 独立可浏览的网页' }
        ];
        const saveType = await customSelect('选择另存为格式：', saveAsOptions, 'sora', '另存为');
        if (saveType === null) {
            showToast('已取消保存', 'info', 2000);
            return;
        }
        const exportScope = typeof chooseSaveAsExportScope === 'function'
            ? await chooseSaveAsExportScope()
            : { data: mulufile, mode: 'all', count: Array.isArray(mulufile) ? mulufile.length : 0, label: '全部目录' };
        if (!exportScope) {
            return;
        }
        if (typeof confirmExportPreflight === 'function') {
            const continueExport = await confirmExportPreflight(exportScope.data);
            if (!continueExport) return;
        }
        if (saveType === 'sora') {
            const encryptOptions = [
                { value: 'no', label: '不加密' },
                { value: 'yes', label: '加密 .sora（需要密码才能加载）' }
            ];
            const encrypt = await customSelect('是否加密？', encryptOptions, 'no', '导出 .sora');
            if (encrypt === null) {
                showToast('已取消', 'info', 2000);
                return;
            }
            await handleSaveAsSoraPackage(null, exportScope.data, exportScope, { encrypt: encrypt === 'yes' });
        } else if (saveType === 'webpage') {
            const encryptOptions = [
                { value: 'no', label: '不加密' },
                { value: 'yes', label: '加密网页（需要密码才能查看）' }
            ];
            const encrypt = await customSelect('是否加密？', encryptOptions, 'no', '导出网页');
            if (encrypt === null) {
                showToast('已取消', 'info', 2000);
                return;
            }
            await handleSaveAsWebpage(encrypt === 'yes', null, exportScope.data, exportScope);
        } else if (saveType === 'custom') {
            const encryptOptions = [
                { value: 'no', label: '不加密' },
                { value: 'yes', label: '加密保存（设置密码）' }
            ];
            const encrypt = await customSelect('是否加密？', encryptOptions, 'no', '另存为');
            if (encrypt === null) {
                showToast('已取消', 'info', 2000);
                return;
            }
            let password = null;
            if (encrypt === 'yes') {
                password = await customPasswordPrompt('设置加密密码：', '加密保存', 'new-password');
                if (!password) {
                    showToast('已取消', 'info', 2000);
                    return;
                }
                const confirmPassword = await customPasswordPrompt('确认密码：', '加密保存', 'new-password');
                if (confirmPassword !== password) {
                    customAlert('两次输入的密码不一致');
                    return;
                }
            }
            let customName = await customPrompt("输入文件名（包含扩展名，如：mydata.sora）", "");
            if (!customName) {
                showToast('已取消保存', 'info', 2000);
                return;
            }
            if (password) {
                await handleSaveAsEncrypted(customName, password, exportScope.data);
            } else {
                await handleSaveAs(customName, exportScope.data);
            }
        }
    });
}
document.querySelectorAll('.format-toolbar-btn').forEach(btn => {
    if (btn.id === 'topLinkBtn' || btn.id === 'topAnchorBtn') {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            const cmd = btn.id === 'topAnchorBtn' ? 'anchor' : 'link';
            await applyFormat(cmd);
        });
    } else {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const command = this.getAttribute('data-command');
            if (command) applyFormat(command);
        });
    }
});
if (topImageUploadBtn) {
    topImageUploadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (imageFileInput) imageFileInput.click();
    });
}
if (topVideoUploadBtn) {
    topVideoUploadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (videoFileInput) videoFileInput.click();
    });
}
if (topMediaUploadBtn) {
    topMediaUploadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (mediaFileInput) mediaFileInput.click();
    });
}

function buildHelpNavHtml() {
    const items = [
        { id: 'mulu_help_root', name: '使用说明' },
        { id: 'mulu_help_quickstart', name: '快速开始' },
        { id: 'mulu_help_directory', name: '目录操作' },
        { id: 'mulu_help_format', name: '编辑与格式' },
        { id: 'mulu_help_link_anchor', name: '链接与锚点' },
        { id: 'mulu_help_search', name: '查找与替换' },
        { id: 'mulu_help_advanced', name: '高级操作' },
        { id: 'mulu_help_export', name: '保存、导出与加密' },
        { id: 'mulu_help_notes', name: '注意事项与常见问题' }
    ];
    let out = '<p>';
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        out += '<a href="sora-dir:' + it.id + '" data-sora-link="dir" data-dir-id="' + it.id + '">' + it.name + '</a>';
        if (i !== items.length - 1) out += ' | ';
    }
    out += '</p>';
    return out;
}

function buildHelpPageContents() {
    const nav = buildHelpNavHtml();

    const root = [
        '<h1>使用说明</h1>',
        nav,
        '<p>这是随项目版本更新的内置说明。</p>',
        '<h2 id="交互说明">交互说明</h2>',
        '<ul>',
        '<li><strong>目录区</strong>：左键选择；双击重命名；拖拽移动（含子目录）；右键打开菜单。</li>',
        '<li><strong>编辑区</strong>：右侧为可编辑预览区，直接输入/粘贴即可。</li>',
        '<li><strong>链接/锚点/方法</strong>：单击可编辑；链接与锚点要跳转/打开时使用 <strong>Ctrl+单击</strong>。</li>',
        '<li><strong>导出网页</strong>：网页里是普通单击跳转；锚点本身不可见且不可点击（仅作为跳转目标）。</li>',
        '</ul>',
        '<h2 id="常用快捷键">常用快捷键</h2>',
        '<ul>',
        '<li><strong>Ctrl+S</strong>：保存</li>',
        '<li><strong>Ctrl+F</strong>：查找</li>',
        '<li><strong>Ctrl+H</strong>：替换</li>',
        '<li><strong>Ctrl+K</strong>：全局搜索目录、锚点与功能命令</li>',
        '<li><strong>Ctrl+Z / Ctrl+Y</strong>：撤销 / 重做目录操作（焦点不在编辑区时）</li>',
        '<li><strong>Ctrl+B / Ctrl+I / Ctrl+U</strong>：粗体 / 斜体 / 下划线</li>',
        '</ul>',
        '<h2 id="你可以做什么">你可以做什么</h2>',
        '<ul>',
        '<li>用左侧目录组织内容，支持多级目录与一整套复制/粘贴/快速复制操作。</li>',
        '<li>在右侧预览区编辑，并用顶部工具栏或悬浮工具栏插入格式。</li>',
        '<li>批量插入图片和视频，并在媒体库中查看引用、复用资源或清理孤立资源。</li>',
        '<li>创建链接：外链、页内跳转（#锚点）、目录内跳转（dir:/name:）。</li>',
        '<li>创建方法：为导出网页配置导航、内容、状态、条件、交互、组件、样式和目录动作；目标目录或锚点可搜索选择。</li>',
        '<li>通过 <strong>Ctrl+K</strong> 打开命令搜索，使用可复用内容块、受控组件、声明式扩展包、关系视图、智能集合、诊断和性能预算等扩展能力。</li>',
        '<li>保存为普通文件或加密文件；导出网页或加密网页（需要密码才能查看）。</li>',
        '<li>用面包屑、最近访问和收藏快速定位目录；未保存修改会生成本地自动草稿。</li>',
        '<li>导出前检查目录结构、链接、锚点、方法和媒体引用。</li>',
        '</ul>',
        '<h2 id="快速入口">快速入口</h2>',
        '<ul>',
        '<li><a href="sora-dir:mulu_help_quickstart" data-sora-link="dir" data-dir-id="mulu_help_quickstart">快速开始：从新建到导出</a></li>',
        '<li><a href="sora-dir:mulu_help_directory" data-sora-link="dir" data-dir-id="mulu_help_directory">目录操作：复制/粘贴/拖拽/右键菜单</a></li>',
        '<li><a href="sora-dir:mulu_help_format" data-sora-link="dir" data-dir-id="mulu_help_format">编辑与格式：所有格式按钮清单</a></li>',
        '<li><a href="sora-dir:mulu_help_link_anchor" data-sora-link="dir" data-dir-id="mulu_help_link_anchor">链接与锚点：完整语法与示例</a></li>',
        '<li><a href="sora-dir:mulu_help_export" data-sora-link="dir" data-dir-id="mulu_help_export">保存、导出与加密：文件/网页/密码</a></li>',
        '</ul>',
        '<h2 id="跳转示例">跳转示例（请 Ctrl+单击测试）</h2>',
        '<ul>',
        '<li>页内跳转：<a href="#示例标题" data-sora-link="anchor" data-anchor-id="示例标题">#示例标题</a></li>',
        '<li>目录内跳转（按目录ID）：<a href="sora-dir:mulu_help_link_anchor#目录内跳转" data-sora-link="dir" data-dir-id="mulu_help_link_anchor" data-anchor-id="目录内跳转">dir:mulu_help_link_anchor#目录内跳转</a></li>',
        '<li>目录内跳转（按目录名）：<a href="sora-dir:mulu_help_link_anchor#目录内跳转" data-sora-link="dir" data-dir-name="链接与锚点" data-anchor-id="目录内跳转">name:链接与锚点#目录内跳转</a></li>',
        '</ul>',
        '<h3 id="示例标题">示例标题</h3>',
        '<p>如果你能跳到这里，说明页内跳转正常。</p>'
    ].join('');

    const quickstart = [
        '<h1>快速开始</h1>',
        nav,
        '<h2 id="从零开始">从零开始（推荐流程）</h2>',
        '<ol>',
        '<li>点击顶部工具栏 <strong>文件 / 新建</strong>；系统会清空当前内容和媒体数据，并创建、选中一个空白的“默认目录”。</li>',
        '<li>可双击重命名默认目录；点击 <strong>目录 / 添加目录</strong> 创建同级目录，再用 <strong>目录 / 添加节点</strong> 创建子目录。</li>',
        '<li>左键单击目录，右侧开始编辑内容（可直接粘贴图片/文本）。</li>',
        '<li>选择文字后会出现悬浮工具栏，用于快速加粗/链接/列表等；点击任意按钮后会自动收起。</li>',
        '<li>需要图片或视频时，可使用顶部插入按钮，也可把媒体文件或文件夹拖入编辑区。</li>',
        '<li>导出前点击 <strong>导出预检</strong>；再按 <strong>Ctrl+S</strong> 保存，或用 <strong>另存为</strong> 导出 <code>.sora</code> 单文件包或网页。</li>',
        '</ol>',
        '<h2 id="如何组织内容">如何组织内容</h2>',
        '<ul>',
        '<li>建议用 <strong>H1~H3</strong> 标题组织结构，标题会自动生成可跳转的 id，方便做目录内跳转。</li>',
        '<li>需要自定义跳转点时，用 <strong>锚点</strong> 功能插入任意锚点。</li>',
        '</ul>',
        '<h2 id="保存与导出提示">保存与导出提示</h2>',
        '<ul>',
        '<li>按钮出现“保存 *”说明有未保存更改。</li>',
        '<li><strong>另存为</strong>：可以选择“网页(.html)”或“自定义文件名”；两种都支持加密选项。</li>',
        '<li>导出网页会把目录与正文打包进单个 HTML 文件，适合发送给别人直接打开。</li>',
        '<li>图片会在导入时进行网页优化；同一媒体多次引用只会在导出文件中保存一份，图片和大视频按需加载。</li>',
        '<li>每个目录会记住正文滚动位置和最后选区；再次打开会恢复上下文。需要从头阅读时，点击正文上方的 <strong>回顶部</strong>。</li>',
        '</ul>'
    ].join('');

    const directory = [
        '<h1>目录操作</h1>',
        nav,
        '<h2 id="目录基础">基础操作</h2>',
        '<ul>',
        '<li>左键单击：选中并切换右侧内容。</li>',
        '<li>再次单击当前目录：保持右侧正文位置，不会回到顶部。</li>',
        '<li>返回最近目录、收藏目录或面包屑目录时：恢复该目录上次的正文位置；点击 <strong>回顶部</strong> 可明确从头打开。</li>',
        '<li>双击：重命名目录。</li>',
        '<li>拖拽：移动目录（含子目录）。</li>',
        '<li>点击目录左侧小三角：展开/收起子目录。</li>',
        '</ul>',
        '<h2 id="目录右键菜单">右键菜单</h2>',
        '<ul>',
        '<li><strong>复制目录（含子目录）</strong>：把当前目录以及所有子目录复制到剪贴板。</li>',
        '<li><strong>复制目录（不含子目录）</strong>：只复制当前目录本身。</li>',
        '<li><strong>粘贴目录</strong>：把剪贴板中的目录粘贴到当前目录下，作为子目录。</li>',
        '<li><strong>快速复制（含子目录 / 不含子目录）</strong>：等价于复制后立刻粘贴。</li>',
        '<li><strong>删除选中目录</strong>：会递归删除子目录与其内容。</li>',
        '<li><strong>展开此目录 / 收起此目录</strong>：递归展开/收起该目录树。</li>',
        '<li><strong>复制目录ID</strong>：复制 data-dir-id，用于写 <strong>dir:目录ID</strong> 类型的目录内跳转链接。</li>',
        '<li><strong>修改同级目录颜色 / 恢复同级自动颜色</strong>：调整当前目录所在层级的统一背景色。</li>',
        '</ul>',
        '<h2 id="目录工具栏">目录工具栏</h2>',
        '<ul>',
        '<li><strong>添加目录</strong>：创建与当前目录同级的新目录。</li>',
        '<li><strong>添加节点</strong>：创建当前目录的子目录。</li>',
        '<li><strong>展开全部 / 收起全部</strong>：展开或收起所有有子目录的项。</li>',
        '</ul>',
        '<h2 id="目录撤销与导航">撤销、重做与快速导航</h2>',
        '<ul>',
        '<li><strong>撤销目录 / 重做目录</strong>：可恢复添加、删除、重命名、移动、粘贴和快速复制等目录操作，最多保留 40 步；也可在焦点不处于编辑区时使用 <strong>Ctrl+Z / Ctrl+Y</strong>。</li>',
        '<li>重命名目录时，系统会把已能解析的名称引用固化为稳定目录 ID；删除前会显示子目录数和来自删除范围外的入链影响。</li>',
        '<li><strong>面包屑</strong>：编辑区上方显示当前目录路径，点击任一级可直接返回。</li>',
        '<li><strong>最近访问</strong>：保留最近 12 个有效目录，可从下拉列表快速跳转。</li>',
        '<li><strong>收藏目录</strong>：点击星标收藏当前目录，再从收藏列表进入。</li>',
        '<li><strong>筛选目录 / 当前分支</strong>：在目录区顶部按名称或 ID 过滤，也可只看当前目录及其后代。</li>',
        '</ul>',
        '<h2 id="目录ID示例">目录ID 示例</h2>',
        '<p>例如你复制到的目录ID可能类似：<code>abc123xyz</code>。写目录内跳转时使用：</p>',
        '<ul>',
        '<li><code>dir:abc123xyz</code></li>',
        '<li><code>dir:abc123xyz#某个标题或锚点</code></li>',
        '</ul>'
    ].join('');

    const format = [
        '<h1>编辑与格式</h1>',
        nav,
        '<h2 id="标题">标题</h2>',
        '<ul>',
        '<li>支持 <strong>H1~H6</strong>。标题会在预览渲染后自动生成 id（用于页内跳转）。</li>',
        '<li>建议：一级目录用 H1/H2，小节用 H3/H4。</li>',
        '</ul>',
        '<h2 id="格式命令一览">格式命令一览</h2>',
        '<p>以下清单与格式工具栏的 <code>data-command</code> 以及内部 <code>applyFormat(command)</code> 一一对应。</p>',
        '<table>',
        '<thead><tr><th>命令</th><th>说明</th><th>要点</th></tr></thead>',
        '<tbody>',
        '<tr><td><code>bold</code></td><td>粗体</td><td>支持 Ctrl+B；再次应用会取消</td></tr>',
        '<tr><td><code>italic</code></td><td>斜体</td><td>支持 Ctrl+I；再次应用会取消</td></tr>',
        '<tr><td><code>underline</code></td><td>下划线</td><td>支持 Ctrl+U；再次应用会取消</td></tr>',
        '<tr><td><code>strikethrough</code></td><td>删除线</td><td>再次应用会取消</td></tr>',
        '<tr><td><code>code</code></td><td>行内代码</td><td>行内代码内容会转义为纯文本（不保留嵌套 HTML）</td></tr>',
        '<tr><td><code>code-block</code></td><td>代码块</td><td>会弹出代码编辑对话框；可选语言并高亮</td></tr>',
        '<tr><td><code>highlight</code></td><td>高亮</td><td>使用 <code>&lt;mark&gt;</code>；再次应用会取消</td></tr>',
        '<tr><td><code>spoiler</code></td><td>防剧透</td><td>使用 <code>&lt;spoiler&gt;</code>；悬停显示内容</td></tr>',
        '<tr><td><code>superscript</code></td><td>上标</td><td>使用 <code>&lt;sup&gt;</code></td></tr>',
        '<tr><td><code>subscript</code></td><td>下标</td><td>使用 <code>&lt;sub&gt;</code></td></tr>',
        '<tr><td><code>color</code></td><td>文字颜色</td><td>提供常用/最近颜色，并提示其在白色正文背景上的对比度；已选中文本才能应用</td></tr>',
        '<tr><td><code>background-color</code></td><td>背景颜色</td><td>提供常用/最近颜色，并推荐可读的黑色或白色文字；已选中文本才能应用</td></tr>',
        '<tr><td><code>unordered-list</code></td><td>无序列表</td><td>按行拆分生成 <code>&lt;ul&gt;&lt;li&gt;</code></td></tr>',
        '<tr><td><code>ordered-list</code></td><td>有序列表</td><td>按行拆分生成 <code>&lt;ol&gt;&lt;li&gt;</code></td></tr>',
        '<tr><td><code>task-list</code></td><td>任务列表</td><td>按行生成可勾选任务项</td></tr>',
        '<tr><td><code>quote</code></td><td>引用</td><td>生成 <code>&lt;blockquote&gt;</code></td></tr>',
        '<tr><td><code>table</code></td><td>表格</td><td>生成表格结构（适合粘贴后再调整）</td></tr>',
        '<tr><td><code>paragraph</code></td><td>段落</td><td>用 <code>&lt;p&gt;</code> 包裹选中内容</td></tr>',
        '<tr><td><code>hr</code></td><td>水平线</td><td>插入分隔线</td></tr>',
        '<tr><td><code>link</code></td><td>链接</td><td>会弹窗输入；支持外链、<code>#锚点</code>、<code>dir:</code>、<code>name:</code></td></tr>',
        '<tr><td><code>anchor</code></td><td>锚点</td><td>会弹窗输入锚点名；用于页内/跨目录跳转目标</td></tr>',
        '</tbody>',
        '</table>',
        '<h2 id="格式小技巧">格式小技巧</h2>',
        '<ul>',
        '<li>大多数“包裹类格式”（粗体/斜体/下划线/高亮等）再次点击会取消。</li>',
        '<li>对同一段文字叠加多个格式是允许的（例如：高亮 + 粗体）。</li>',
        '<li>代码块是不可直接编辑的块，通常通过点击触发编辑对话框来修改。</li>',
        '</ul>',
        '<h2 id="插入媒体">插入图片与视频</h2>',
        '<ul>',
        '<li>顶部工具栏提供<strong>插入图片</strong>、<strong>插入视频</strong>和<strong>媒体</strong>；“媒体”可一次选择多张图片和多个视频。</li>',
        '<li>也可把媒体文件拖入编辑区；浏览器支持文件夹拖入时，系统会递归读取文件夹，并忽略非图片、非视频文件。</li>',
        '<li>单个媒体导入时可填写图注/标题；右键图片或视频可修改图注/注释或删除。</li>',
        '<li><strong>媒体库</strong>可按资源、目录、ID、类型、大小、当前目录或孤立状态筛选，查看/修改图注、宽度、对齐和加载策略，定位或复用资源，并在保留全部引用的前提下替换源文件。</li>',
        '<li>批量导入会显示逐项队列；可取消剩余任务，并对失败项重试。</li>',
        '<li>媒体数据存储在浏览器本地；导出网页或 <code>.sora</code> 时会一并打包，因此文件可能变大。</li>',
        '</ul>'
    ].join('');

    const linkAnchor = [
        '<h1>链接与锚点</h1>',
        nav,

        '<h2 id="外部链接">外部链接</h2>',
        '<ul>',
        '<li>“链接”对话框区分外部网址和内部引用；内部引用可直接搜索，无需记住目录 ID。</li>',
        '<li>编辑器里 <strong>Ctrl+单击</strong> 才会打开链接；单击会进入编辑。</li>',
        '</ul>',
        '<h2 id="页内跳转">页内跳转（当前目录）</h2>',
        '<p>链接地址填写 <code>#锚点名</code> 可跳转到当前目录内容中的目标。</p>',
        '<ul>',
        '<li>你可以跳到标题（标题会自动有 id），也可以跳到任意锚点。</li>',
        '<li>匹配顺序：元素 id → 任意锚点 <code>data-anchor-name</code> → 标题文本。</li>',
        '<li>锚点名会被规范化：去掉开头的 <code>#</code>，并把空格替换为 <code>-</code>。</li>',
        '</ul>',

        '<p>示例（Ctrl+单击）：<a href="#本页示例锚点" data-sora-link="anchor" data-anchor-id="本页示例锚点">#本页示例锚点</a></p>',
        '<h3 id="本页示例锚点">本页示例锚点</h3>',
        '<p>如果你能跳到这里，说明页内跳转正常。</p>',
        '<h2 id="目录内跳转">目录内跳转（跨目录）</h2>',
        '<p>用于从一个目录跳到另一个目录的指定位置。支持两种写法：</p>',
        '<ul>',
        '<li><strong>按目录ID</strong>：<code>dir:目录ID</code> 或 <code>dir:目录ID#锚点</code></li>',
        '<li><strong>按目录名</strong>：<code>name:目录名</code> 或 <code>name:目录名#锚点</code>（同名时跳第一个匹配项）</li>',
        '</ul>',
        '<p>输入兼容中文前缀：</p>',
        '<ul>',
        '<li><code>目录:目录ID</code> 等价于 <code>dir:目录ID</code></li>',
        '<li><code>目录名:目录名</code> 等价于 <code>name:目录名</code></li>',
        '</ul>',
        '<p>示例（Ctrl+单击）：</p>',
        '<ul>',
        '<li><a href="sora-dir:mulu_help_export#加密导出" data-sora-link="dir" data-dir-id="mulu_help_export" data-anchor-id="加密导出">dir:mulu_help_export#加密导出</a></li>',
        '<li><a href="sora-dir:mulu_help_export#加密导出" data-sora-link="dir" data-dir-name="保存、导出与加密" data-anchor-id="加密导出">name:保存、导出与加密#加密导出</a></li>',
        '</ul>',
        '<h2 id="任意锚点">创建任意锚点</h2>',
        '<ul>',
        '<li>用“锚点”按钮输入锚点名，会插入一个锚点标记。</li>',
        '<li>锚点的 DOM id 会自动带前缀与随机后缀以避免冲突；跳转时按“锚点名”匹配（不是按 DOM id）。</li>',
        '<li>你可以单击锚点标记进入编辑修改锚点名。</li>',
        '</ul>',
        '<h2 id="编辑提示">编辑提示</h2>',
        '<ul>',
        '<li>编辑器预览区：<strong>Ctrl+单击</strong> 才会跳转/打开；单击用于进入编辑与选中元素。</li>',
        '<li>单击链接会打开链接编辑器；内部目标支持当前目录、当前分支、最近访问、收藏与全部目录范围。</li>',
        '<li>顶部 <strong>关系</strong> 可查看当前目录的入链、出链、孤立目录、缺失目标和循环引用；点击关系可直接定位到来源或目标。</li>',
        '<li>顶部 <strong>字段</strong> 可为当前目录设置标签、状态、优先级、日期和自定义字段，并通过“智能集合”筛选定位；筛选视图不会改动或删除正文。</li>',
        '</ul>'
    ].join('');

    const search = [
        '<h1>查找与替换</h1>',
        nav,
        '<h2 id="打开方式">打开方式</h2>',
        '<ul>',
        '<li>查找：<strong>Ctrl+F</strong> 或顶部“编辑 / 查找”。</li>',
        '<li>替换：<strong>Ctrl+H</strong> 或顶部“编辑 / 替换”。</li>',
        '</ul>',
        '<h2 id="选项说明">选项说明</h2>',
        '<ul>',
        '<li><strong>区分大小写</strong>：只匹配大小写完全一致的内容。</li>',
        '<li><strong>全词匹配</strong>：只匹配完整单词（适合查找变量名）。</li>',
        '<li><strong>正则表达式</strong>：使用正则进行高级匹配。</li>',
        '</ul>',
        '<h2 id="搜索内容">搜索内容</h2>',
        '<ul>',
        '<li>可选择搜索<strong>正文</strong>、<strong>目录名称</strong>，或同时搜索两者。</li>',
        '<li>所有目录的结果会按目录分组显示；点击结果可跳到对应目录和命中位置。</li>',
        '<li>最近 12 条关键词会保存在本机，可从<strong>搜索历史</strong>重新选择。</li>',
        '</ul>',
        '<h2 id="搜索范围">搜索范围</h2>',
        '<ul>',
        '<li><strong>当前目录</strong>：只搜索当前选中的目录内容。</li>',
        '<li><strong>所有目录</strong>：会遍历所有目录内容。</li>',
        '</ul>',
        '<h2 id="使用建议">使用建议</h2>',
        '<ul>',
        '<li>替换前建议先用“查找”确认命中范围，再执行替换。</li>',
        '<li>如果要批量替换带格式的内容，建议先在少量目录里试运行，确认效果后再全局替换。</li>',
        '</ul>'
    ].join('');

    const advanced = [
        '<h1>高级操作</h1>',
        nav,
        '<h2 id="方法是什么">方法是什么</h2>',
        '<p>方法是一种特殊的链接格式：它在编辑器里用于配置，在<strong>导出网页</strong>里会按触发方式自动执行，用于实现隐藏/显示/切换内容、重命名目录、动态替换内容、批量添加格式、触发目录动作等高级交互。</p>',
        '<p>方法链接本质上是一个 <code>&lt;a&gt;</code> 元素，具有以下属性：</p>',
        '<ul>',
        '<li><code>data-sora-link="method"</code>：标识这是方法链接。</li>',
        '<li><code>data-sora-methods</code>：一个 JSON 数组，保存一个或多个方法配置。</li>',
        '</ul>',
        '<h2 id="编辑方式">编辑方式</h2>',
        '<ul>',
        '<li>编辑器预览区会把方法显示为带“ƒ 方法”标记的链接；直接单击即可再次编辑。</li>',
        '<li>普通编辑时方法不会自动执行；正式行为以导出网页中的触发结果为准。</li>',
        '<li>顶部“方法管理”可集中搜索、定位、启停、复制、编辑、查看流程与关系、保存预设和升级旧配置。</li>',
        '<li>方法卡片的“流程”会按顺序展示条件、分支和嵌套动作。</li>',
        '</ul>',
        '<h2 id="内容与组件扩展">内容与组件扩展</h2>',
        '<ul>',
        '<li><strong>可复用内容块</strong>：通过 Ctrl+K 搜索并插入其他目录的只读引用；源目录更新后重新打开引用目录即可同步，块内“编辑源块”可返回内容源。循环引用会被阻止，导出网页会展开为静态内容。</li>',
        '<li><strong>受控组件库</strong>：先用同一目录内的前、后锚点圈定内容，再插入折叠区、标签页、步骤条、问答、图库、输入或选择组件方法；编辑器中显示为可再次编辑的“ƒ 方法”链接，导出网页中点击该链接后才转换目标内容。</li>',
        '<li><strong>声明式扩展包</strong>：只接受版本、能力声明、方法预设、组件预设和受控样式令牌；导入前显示权限与兼容性。脚本、远程代码、任意 JavaScript 和无约束 CSS 会被拒绝。</li>',
        '</ul>',
        '<h2 id="字段说明">字段说明</h2>',
        '<h3 id="触发方式">触发方式</h3>',
        '<p>决定方法什么时候执行：</p>',
        '<table>',
        '<thead><tr><th>选项</th><th>代码</th><th>说明</th></tr></thead>',
        '<tbody>',
        '<tr><td>打开网页时</td><td><code>open</code></td><td>网页加载完成后立即执行，会遍历所有目录的方法</td></tr>',
        '<tr><td>选中目录时</td><td><code>enter_dir</code></td><td>当用户点击并进入某个目录时执行</td></tr>',
        '<tr><td>点击时</td><td><code>click</code></td><td>需要用户主动点击方法链接才执行</td></tr>',
        '<tr><td>悬浮时</td><td><code>hover</code></td><td>鼠标悬停在方法链接上时执行，移动设备无法触发</td></tr>',
        '<tr><td>离开目录前</td><td><code>leave_dir</code></td><td>从当前目录切换到其他目录之前执行</td></tr>',
        '<tr><td>双击 / 长按</td><td><code>dblclick / longpress</code></td><td>适配鼠标与触屏的明确交互</td></tr>',
        '<tr><td>进入可视区域</td><td><code>visible</code></td><td>方法链接进入正文可视区域时执行</td></tr>',
        '<tr><td>输入变化 / 媒体结束</td><td><code>change / media_end</code></td><td>用于表单和音视频流程</td></tr>',
        '<tr><td>快捷键</td><td><code>keyboard</code></td><td>按配置的组合键执行</td></tr>',
        '<tr><td>延时 / 定时</td><td><code>delay / interval</code></td><td>网页打开后延时一次或定时执行，并受最大次数保护</td></tr>',
        '</tbody>',
        '</table>',
        '<h3 id="方法类型">方法类型</h3>',
        '<p>决定方法要做什么：</p>',
        '<table>',
        '<thead><tr><th>类型</th><th>说明</th></tr></thead>',
        '<tbody>',
        '<tr><td>隐藏</td><td>目录级（后锚点为空）时隐藏整个目录树；范围级（后锚点不为空）时隐藏锚点范围内的内容</td></tr>',
        '<tr><td>隐藏（初始不隐藏）</td><td>第一次触发时只建立标记但不隐藏，后续触发才真正隐藏</td></tr>',
        '<tr><td>显示</td><td>显示之前被隐藏的目录或内容</td></tr>',
        '<tr><td>切换</td><td>在显示/隐藏之间切换</td></tr>',
        '<tr><td>更换内容</td><td>目录级时是重命名目录；范围级时是用文本或其他锚点范围的内容替换目标范围</td></tr>',
        '<tr><td>添加格式</td><td>仅范围级可用，给锚点范围内的内容添加格式（粗体、颜色、链接等）或生成嵌套方法链接</td></tr>',
        '<tr><td>目录右键动作</td><td>仅目录级可用，等价于在导出网页中对目录执行一次右键菜单动作</td></tr>',
        '<tr><td>导航</td><td>跳转、返回上一位置、相邻目录、展开并跳转</td></tr>',
        '<tr><td>内容</td><td>插入、清空、删除、复制/移动/交换范围，以及按模板生成内容</td></tr>',
        '<tr><td>状态</td><td>设置、调整、切换变量，并显示数值、计数、进度或完成状态</td></tr>',
        '<tr><td>交互与样式</td><td>自有提示/确认/面板、交互组件、受控样式和动画预设</td></tr>',
        '</tbody>',
        '</table>',
        '<h3 id="只执行一次">只执行一次</h3>',
        '<p>勾选后，同一个方法在导出网页中最多成功执行一次。</p>',
        '<h3 id="更换内容相关字段">更换内容相关字段</h3>',
        '<p>当方法类型选择“更换内容”时显示：</p>',
        '<ul>',
        '<li><strong>新目录名</strong>：仅目录级操作时使用，填写目录的新名称。</li>',
        '<li><strong>替换来源</strong>：仅范围级操作时使用，选择替换内容的来源：',
        '<ul>',
        '<li><strong>用锚点范围/目录内容替换</strong>：从其他目录的锚点范围提取内容。需要填写“替换来源前锚点”和“替换来源后锚点”（后锚点可为空，表示到目录末尾）。</li>',
        '<li><strong>直接输入替换文本</strong>：直接填写要替换的文本内容（作为纯文本处理）。</li>',
        '</ul>',
        '</li>',
        '</ul>',
        '<h3 id="添加格式相关字段">添加格式相关字段</h3>',
        '<p>当方法类型选择“添加格式”时显示：</p>',
        '<table>',
        '<thead><tr><th>格式类型</th><th>说明</th></tr></thead>',
        '<tbody>',
        '<tr><td>粗体</td><td>加粗文字</td></tr>',
        '<tr><td>斜体</td><td>倾斜文字</td></tr>',
        '<tr><td>下划线</td><td>添加下划线</td></tr>',
        '<tr><td>删除线</td><td>添加删除线</td></tr>',
        '<tr><td>高亮</td><td>黄色背景高亮</td></tr>',
        '<tr><td>防剧透</td><td>黑色遮盖，点击显示</td></tr>',
        '<tr><td>上标</td><td>上角标注</td></tr>',
        '<tr><td>下标</td><td>下角标注</td></tr>',
        '<tr><td>行内代码</td><td>代码风格</td></tr>',
        '<tr><td>文字颜色</td><td>需要填写颜色值（如 <code>#ff0000</code> 或 <code>red</code>）</td></tr>',
        '<tr><td>背景颜色</td><td>需要填写颜色值</td></tr>',
        '<tr><td>链接</td><td>需要填写链接地址</td></tr>',
        '<tr><td>方法（嵌套）</td><td>创建方法链接，可以嵌套多个方法配置</td></tr>',
        '</tbody>',
        '</table>',
        '<ul>',
        '<li><strong>参数值</strong>：当格式类型需要参数时显示（如颜色、链接地址）。</li>',
        '<li><strong>嵌套方法</strong>：当格式类型选择“方法（嵌套）”时显示，点击“添加嵌套方法”可以添加多个子方法。</li>',
        '<li><strong>方法显示文本</strong>：当锚点范围内没有文本时，使用这个文本作为方法链接的显示内容。</li>',
        '</ul>',
        '<h3 id="目录右键动作相关字段">目录右键动作相关字段</h3>',
        '<p>当方法类型选择“目录右键动作”时显示：</p>',
        '<table>',
        '<thead><tr><th>目录动作</th><th>说明</th></tr></thead>',
        '<tbody>',
        '<tr><td>复制目录ID</td><td>复制目录的ID到剪贴板</td></tr>',
        '<tr><td>删除目录</td><td>删除该目录及所有子目录</td></tr>',
        '<tr><td>复制目录（含子目录）</td><td>复制目录树到内部剪贴板</td></tr>',
        '<tr><td>复制目录（不含子目录）</td><td>只复制当前目录到内部剪贴板</td></tr>',
        '<tr><td>粘贴目录</td><td>粘贴之前复制的目录</td></tr>',
        '<tr><td>快速复制目录（含子目录）</td><td>复制后立即粘贴到目标目录后面</td></tr>',
        '<tr><td>快速复制目录（不含子目录）</td><td>只复制当前目录并立即粘贴</td></tr>',
        '<tr><td>展开此目录</td><td>展开目录树显示子目录</td></tr>',
        '<tr><td>收起此目录</td><td>收起目录树隐藏子目录</td></tr>',
        '</tbody>',
        '</table>',
        '<h2 id="目录级与范围级">目录级与范围级</h2>',
        '<ul>',
        '<li><strong>目录级</strong>：后锚点为空。此时前锚点必须指向目录（<code>dir:目录ID</code> 或 <code>name:目录名</code>），且不能带 <code>#锚点</code>。</li>',
        '<li><strong>范围级</strong>：后锚点不为空。此时前后锚点必须在同一目录内（可写 <code>#锚点</code> 或带目录引用）。</li>',
        '<li><strong>隐藏（初始不隐藏）</strong>：第一次触发会建立范围标记但不隐藏；后续触发才执行隐藏/显示逻辑（用于先让内容可见，再通过其它触发控制隐藏）。</li>',
        '</ul>',
        '<h2 id="方法类型说明">方法类型说明</h2>',
        '<ul>',
        '<li><strong>隐藏/显示/切换</strong>：目录级作用于目录树（含子目录）；范围级作用于锚点范围内内容。</li>',
        '<li><strong>更换内容</strong>：目录级表示重命名目录；范围级表示用文本或来源锚点范围替换目标锚点范围内容。</li>',
        '<li><strong>添加格式</strong>：仅范围级可用，把目标锚点范围内容用指定格式包裹（也可生成“嵌套方法”链接）。</li>',
        '<li><strong>目录右键动作</strong>：仅目录级可用，等价于导出页里对该目录执行一次右键菜单动作。</li>',
        '</ul>',
        '<h2 id="锚点引用写法">锚点引用写法</h2>',
        '<p>方法配置中的目录和锚点输入框支持直接搜索并选择，也保留以下手工写法：</p>',
        '<ul>',
        '<li><code>#锚点名</code>：当前目录内的锚点。</li>',
        '<li><code>dir:目录ID#锚点名</code>：指定目录ID内的锚点。</li>',
        '<li><code>name:目录名#锚点名</code>：指定目录名内的锚点（同名目录会取第一个）。</li>',
        '</ul>',
        '<p>也支持只写目录不写锚点（表示整篇范围）：</p>',
        '<ul>',
        '<li><code>dir:目录ID</code></li>',
        '<li><code>name:目录名</code></li>',
        '</ul>',
        '<h2 id="使用案例">使用案例</h2>',
        '<p>下面的案例按“你在编辑器里怎么填”为主；另外也给出一份可直接参考的 <code>data-sora-methods</code> JSON（你不需要手写 HTML，正常用“方法”对话框配置即可）。</p>',

        '<h3 id="案例1_打开时替换一段内容">案例 1：打开时替换一段内容（来源为其它目录锚点范围）</h3>',
        '<ol>',
        '<li>在目标目录插入两个锚点：<code>#开始</code> 和 <code>#结束</code>，中间放需要被替换的内容。</li>',
        '<li>插入一个方法链接（显示文本随意）。</li>',
        '<li>编辑方法：触发方式选 <strong>打开网页时</strong>；目标前锚点 <code>#开始</code>；目标后锚点 <code>#结束</code>；方法类型选 <strong>更换内容</strong>；建议勾选 <strong>只执行一次</strong>。</li>',
        '<li>替换来源选 <strong>用锚点范围/目录内容替换</strong>，来源前锚点填 <code>dir:某目录ID#源开始</code>，来源后锚点填 <code>dir:某目录ID#源结束</code>。</li>',
        '</ol>',
        '<p>对应的 <code>data-sora-methods</code> JSON（示意，目录ID请替换成你自己的）：</p>',
        '<pre><code>' + escapeHtml('[{"trigger":"open","frontAnchor":"#开始","backAnchor":"#结束","methodType":"更换内容","once":true,"replaceSourceType":"anchor","replaceFromFrontAnchor":"dir:某目录ID#源开始","replaceFromBackAnchor":"dir:某目录ID#源结束"}]') + '</code></pre>',

        '<h3 id="案例2_点击按钮切换说明">案例 2：点击按钮把占位区替换成说明（来源为直接输入文本）</h3>',
        '<ol>',
        '<li>在目录中插入锚点 <code>#说明区开始</code> 和 <code>#说明区结束</code>，中间放“（点击按钮显示说明）”。</li>',
        '<li>创建方法链接（显示为“显示详细说明”）。</li>',
        '<li>触发方式选 <strong>点击时</strong>；目标前锚点 <code>#说明区开始</code>；目标后锚点 <code>#说明区结束</code>；方法类型选 <strong>更换内容</strong>。</li>',
        '<li>替换来源选 <strong>直接输入替换文本</strong>，输入要替换进去的内容（文本会按纯文本处理，不会当作 HTML 执行）。</li>',
        '</ol>',
        '<p>对应的 JSON（示意）：</p>',
        '<pre><code>' + escapeHtml('[{"trigger":"click","frontAnchor":"#说明区开始","backAnchor":"#说明区结束","methodType":"更换内容","once":false,"replaceSourceType":"text","replaceText":"这里是说明内容（纯文本）"}]') + '</code></pre>',

        '<h3 id="案例3_悬浮预览">案例 3：悬浮预览（鼠标放上去就替换一块预览区）</h3>',
        '<ol>',
        '<li>在当前目录放一个预览占位区：锚点 <code>#预览开始</code> ~ <code>#预览结束</code>。</li>',
        '<li>创建方法链接（显示文本随意），触发方式选 <strong>悬浮时</strong>。</li>',
        '<li>方法类型选 <strong>更换内容</strong>，来源用锚点范围指向另一目录的摘要区（例如 <code>dir:某目录ID#摘要开始</code> ~ <code>dir:某目录ID#摘要结束</code>）。</li>',
        '</ol>',
        '<p>对应的 JSON（示意）：</p>',
        '<pre><code>' + escapeHtml('[{"trigger":"hover","frontAnchor":"#预览开始","backAnchor":"#预览结束","methodType":"更换内容","once":false,"replaceSourceType":"anchor","replaceFromFrontAnchor":"dir:某目录ID#摘要开始","replaceFromBackAnchor":"dir:某目录ID#摘要结束"}]') + '</code></pre>',

        '<h3 id="案例4_点击切换隐藏">案例 4：点击切换隐藏/显示（范围级）</h3>',
        '<ol>',
        '<li>在目录里插入锚点 <code>#折叠开始</code> 和 <code>#折叠结束</code>，中间放你希望可折叠的一段内容。</li>',
        '<li>插入一个方法链接，显示为“展开/收起”。</li>',
        '<li>触发方式选 <strong>点击时</strong>；前后锚点填 <code>#折叠开始</code> ~ <code>#折叠结束</code>；方法类型选 <strong>切换</strong>。</li>',
        '</ol>',
        '<p>对应的 JSON（示意）：</p>',
        '<pre><code>' + escapeHtml('[{"trigger":"click","frontAnchor":"#折叠开始","backAnchor":"#折叠结束","methodType":"切换","once":false}]') + '</code></pre>',

        '<h3 id="案例5_目录级重命名与右键动作">案例 5：目录级重命名 / 目录右键动作（仅导出页有效）</h3>',
        '<ol>',
        '<li>插入一个方法链接（显示为“把目录改名为：已完成”）。</li>',
        '<li>触发方式选 <strong>点击时</strong>；前锚点填 <code>dir:目录ID</code>（不带 <code>#</code>）；后锚点留空；方法类型选 <strong>更换内容（目录：重命名）</strong>；输入新名称。</li>',
        '<li>再插入一个方法链接（显示为“复制本目录ID”）。</li>',
        '<li>前锚点同样填 <code>dir:目录ID</code>；方法类型选 <strong>目录右键动作</strong>；动作选 <strong>复制目录ID</strong>。</li>',
        '</ol>',
        '<p>对应的 JSON（示意）：</p>',
        '<pre><code>' + escapeHtml('[{"trigger":"click","frontAnchor":"dir:目录ID","backAnchor":"","methodType":"更换内容","once":true,"renameTo":"已完成"}]') + '</code></pre>',
        '<pre><code>' + escapeHtml('[{"trigger":"click","frontAnchor":"dir:目录ID","backAnchor":"","methodType":"目录右键动作","once":false,"dirAction":"复制目录ID"}]') + '</code></pre>',
        '<h2 id="注意事项">注意事项</h2>',
        '<ul>',
        '<li>方法只在导出网页生效，编辑器内不会自动执行。</li>',
        '<li>建议尽量使用 <code>dir:</code>，比 <code>name:</code> 更稳定。</li>',
        '<li>当你使用前后锚点限定范围时，前后锚点必须在同一目录内；替换来源的前后锚点也必须在同一目录内。</li>',
        '<li>更换内容会写入导出网页运行时缓存，切换目录后仍保持已替换的结果。</li>',
        '<li>导出网页会做方法级联执行：同一次触发内，如果方法执行产生了新的可触发方法，会继续扫描执行，直到没有新增或达到安全次数上限。</li>',
        '</ul>',
        '<h2 id="进阶说明">进阶说明</h2>',
        '<h3 id="嵌套方法">嵌套方法</h3>',
        '<p>当使用<strong>添加格式</strong>方法且命令选择为 <code>method</code>（方法链接）时，可以创建嵌套方法。嵌套方法的特点：</p>',
        '<ul>',
        '<li><strong>多层嵌套</strong>：嵌套方法可以继续嵌套；预检与导出运行时最多检查 20 层以防循环和失控。</li>',
        '<li><strong>父级返回</strong>：在嵌套弹窗中点击取消会返回父级弹窗，而不是关闭整个对话框。</li>',
        '<li><strong>锚点上下文</strong>：嵌套方法中使用 <code>#锚点</code> 形式时，默认在同一目录内解析（不需要每次都写 <code>dir:</code>）。</li>',
        '<li><strong>验证规则</strong>：如果前后锚点都不指定目录（都用 <code>#</code> 形式），验证会通过；如果都指定目录，会检查是否为同一目录；混合使用时会提示保持一致。</li>',
        '</ul>',
        '<h3 id="open触发的执行机制">open触发的执行机制</h3>',
        '<p><code>open</code>（打开网页时）触发的执行机制较为特殊：</p>',
        '<ul>',
        '<li><strong>执行时机</strong>：网页加载完成后立即执行，在用户选择默认目录之后。</li>',
        '<li><strong>执行范围</strong>：会遍历<strong>所有目录</strong>的方法链接，执行其中所有 <code>trigger:"open"</code> 的方法。</li>',
        '<li><strong>目录上下文</strong>：在执行每个目录的 <code>open</code> 方法时，会临时设置该目录为当前上下文，使得 <code>#锚点</code> 能正确解析到方法所在目录。</li>',
        '<li><strong>非当前目录</strong>：即使目录没有被打开（内容未渲染到DOM），<code>open</code> 方法也能正常执行，系统会从数据中获取目录HTML并处理。</li>',
        '</ul>',
        '<h3 id="隐藏方法的持久性">隐藏方法的持久性</h3>',
        '<p>当使用<strong>隐藏</strong>方法隐藏目录时：</p>',
        '<ul>',
        '<li><strong>标记持久化</strong>：目录会被标记为 <code>soraHidden</code>，这个标记不会因为父目录的展开/收起而消失。</li>',
        '<li><strong>展开保持隐藏</strong>：即使父目录收起后再展开，被隐藏的子目录也不会显示出来。</li>',
        '<li><strong>三角图标</strong>：如果一个目录的所有可见子目录都被隐藏了，其展开/收起的三角图标会自动消失。</li>',
        '<li><strong>显示恢复</strong>：使用<strong>显示</strong>方法可以移除 <code>soraHidden</code> 标记，使目录重新可见，三角图标也会自动恢复。</li>',
        '</ul>',
        '<h3 id="隐藏初始不隐藏的用法">“隐藏（初始不隐藏）”的用法</h3>',
        '<p>这种方法类型的执行逻辑：</p>',
        '<ol>',
        '<li><strong>第一次触发</strong>：建立范围标记（用于后续操作），但<strong>不隐藏</strong>内容，让用户能看到。</li>',
        '<li><strong>后续触发</strong>：按照正常的隐藏逻辑执行（如果是隐藏方法）。</li>',
        '</ol>',
        '<p><strong>应用场景</strong>：适合先展示内容、再通过点击等触发方式控制隐藏/显示的分步交互。如果直接用普通的“隐藏”，<code>open</code> 触发时内容会立即隐藏。</p>',
        '<h3 id="更换内容的覆盖问题">更换内容的覆盖问题</h3>',
        '<p>当使用<strong>更换内容</strong>方法从来源目录调取内容到目标目录时：</p>',
        '<ul>',
        '<li><strong>问题</strong>：如果调取的内容被插入到某个范围，后续再次更新同一范围时，之前插入的内容会被覆盖。</li>',
        '<li><strong>建议解决方案</strong>：</li>',
        '<li>方案A：把不同内容分别替换到<strong>不同的锚点范围</strong>。</li>',
        '<li>方案B：把调取结果放到<strong>单独的目录</strong>。</li>',
        '<li>方案C：使用<strong>显示</strong>方法展示预先隐藏的内容，而不是替换内容。</li>',
        '</ul>',
        '<h3 id="多步骤与级联执行">多步骤与级联执行</h3>',
        '<p>一个方法链接可以包含多个方法配置（<code>data-sora-methods</code> 是数组）：</p>',
        '<ul>',
        '<li><strong>顺序执行</strong>：多个方法会按数组顺序依次执行。</li>',
        '<li><strong>级联触发</strong>：如果某个方法执行后产生了新的方法链接（例如通过“更换内容”插入），系统会再次扫描并执行这些新方法。</li>',
        '<li><strong>安全限制</strong>：为防止无限循环，级联执行有次数上限（默认20次）。</li>',
        '</ul>'
    ].join('');

    const exportPage = [
        '<h1>保存、导出与加密</h1>',
        nav,

        '<h2 id="导出预检">导出预检</h2>',
        '<ul>',
        '<li>点击顶部<strong>导出预检</strong>可检查：重复目录 ID、父目录缺失、目录断链、锚点缺失/重复、方法配置与目标引用、重复方法 ID、媒体缺失、不安全内容和空目录。</li>',
        '<li>预检还会估算唯一媒体体积、单 HTML 最低体积，并提示超过 64 MB 的单个媒体和超大导出文件。</li>',
        '<li>问题中心还会给出标题层级跳跃、重复标题、图片缺少替代文本和过长段落提醒；这些不阻止导出，也不会自动修改正文。</li>',
        '<li>预检只报告问题，不会自动修改内容；建议修正后再导出。</li>',
        '</ul>',
        '<h2 id="保存">保存</h2>',
        '<ul>',
        '<li><strong>保存（Ctrl+S）</strong>：保存到当前已加载的文件句柄（如果浏览器支持）。</li>',
        '<li>按钮显示“保存 *”表示有未保存更改。</li>',
        '<li>保存前会询问 <strong>保存范围</strong> 与 <strong>是否加密</strong>。</li>',
        '</ul>',
        '<h2 id="保存范围">保存范围</h2>',
        '<ul>',
        '<li><strong>保存全部</strong>：保存所有目录数据。</li>',
        '<li><strong>仅保存修改的目录（增量）</strong>：只保存被修改过的目录的完整内容，文件名会带 <code>_incremental</code>。</li>',
        '<li><strong>仅保存差异（补丁）</strong>：尽量只保存变化部分，文件名会带 <code>.patch</code>，体积更小。</li>',
        '</ul>',
        '<h2 id="另存为">另存为</h2>',
        '<p>点击顶部工具栏 <strong>另存为</strong> 后会先选择保存格式：</p>',
        '<ul>',
        '<li><strong>Sora 单文件包 (.sora)</strong>：保存目录、目录字段、层级颜色和媒体的可重新导入单文件包；可选择整包加密。</li>',
        '<li><strong>网页 (.html)</strong>：导出为独立可浏览的网页。</li>',
        '</ul>',
        '<p>选择格式后会询问导出范围：可导出全部目录、当前目录及其子目录，或手动勾选部分目录。</p>',
        '<p>网页导出可选择是否加密；<code>.sora</code> 包支持替换或合并加载，加密包需要密码。加载较大的包时会显示进度，目录可先打开，媒体继续在后台导入。</p>',
        '<p>浏览器无法直接写入文件时，生成完成后会提供<strong>保存到设备</strong>；设备与浏览器支持系统分享时还会显示<strong>分享</strong>。</p>',
        '<h2 id="发布设置">发布设置</h2>',
        '<ul>',
        '<li>点击顶部 <strong>发布设置</strong>，可统一配置标题、说明、页面语言、默认目录、目录初始状态和导航方式；导出页固定使用原有浅色外观。</li>',
        '<li>“精简阅读”关闭搜索和调试；“标准互动”保留搜索但隐藏调试；“完整互动”才允许显式开启方法调试。</li>',
        '<li>发布设置会显示正文估算体积、方法数量、能力差异与部署方式；没有方法的文档会从产物中移除方法运行适配代码。</li>',
        '<li>媒体策略可选大视频手动加载、所有视频手动加载，或在阅读页中禁止加载视频。</li>',
        '<li>部署方式可选默认的单 HTML、静态网站目录或 PWA 目录；目录模式需要浏览器支持文件夹写入。</li>',
        '<li>发布配置与正文分开保存；可保存/加载命名预设、比较差异、复制 JSON 或回退上次设置。</li>',
        '</ul>',
        '<h2 id="导出网页">导出网页（不加密）</h2>',
        '<ul>',
        '<li>导出网页后可离线打开浏览；目录选择、内部跳转以及浏览器前进/后退会保留阅读位置。</li>',
        '<li>导出页目录上方可搜索目录名和正文；按 <strong>Ctrl+K</strong> 或 <strong>/</strong> 可直接聚焦搜索。</li>',
        '<li>地址中的目录和锚点定位可直接复制分享；打开后会还原对应目录和位置。</li>',
        '<li>移动端使用“目录”按钮打开侧栏；目录树支持方向键、Home、End、Enter 和空格操作。</li>',
        '<li>正文标题栏的<strong>工具</strong>菜单提供当前目录大纲；桌面侧栏模式还可收起或展开目录，正文始终保持原有左对齐和边距。</li>',
        '<li>导出网页中：锚点不可见且不可点击，只用于作为跳转目标。</li>',
        '<li>导出网页中：图片和视频会限制在正文宽度内；图片、剧透内容和交互弹窗均支持键盘操作。</li>',
        '<li>导出网页中：方法会生效（按触发方式执行），可用于隐藏/显示/切换、重命名、替换内容、添加格式、目录动作等。</li>',
        '<li>导出预检会阻止提示不安全内容；导出时会强制移除脚本、内联事件和危险协议，外链会补全 <code>noopener noreferrer</code>。</li>',
        '<li>发布版默认不显示“方法调试”；需要排查时应使用带诊断开关的发布配置。</li>',
        '</ul>',
        '<h2 id="网站目录与PWA">网站目录与 PWA</h2>',
        '<ul>',
        '<li><strong>单 HTML</strong>：最便携，支持直接发送和 <code>file://</code> 打开，是默认兼容基线。</li>',
        '<li><strong>静态网站目录</strong>：生成 <code>index.html</code>，适合部署到普通静态托管。</li>',
        '<li><strong>PWA 目录</strong>：额外生成 <code>manifest.webmanifest</code> 与 <code>sora-service-worker.js</code>；必须通过 HTTP/HTTPS 部署，Service Worker 失败不影响基础阅读。</li>',
        '<li>加密网页不能可靠注册 PWA；若同时选择，导出时会自动降级为静态网站目录并提示。</li>',
        '</ul>',
        '<h2 id="Markdown互操作">Markdown / Obsidian 互操作</h2>',
        '<ul>',
        '<li>按 Ctrl+K 搜索“Markdown / Obsidian 互操作”，可导入或导出 Markdown 文件夹、Front Matter、双链和 <code>_assets</code> 资源目录。</li>',
        '<li>所有写入都先展示同名冲突、非法文件名映射、缺失资源和循环关系；已有同名文件不会被覆盖。</li>',
        '<li>方法运行逻辑不会写入 Markdown；方法链接会降级为普通文字，完整交互请使用网页导出。</li>',
        '</ul>',
        '<h2 id="加密导出">加密导出（网页/文件）</h2>',
        '<ul>',
        '<li>在“另存为”时选择加密：会要求设置密码并二次确认。</li>',
        '<li><strong>加密保存</strong>：生成 <code>.encrypted.json</code>，打开时需要输入密码解密。</li>',
        '<li><strong>加密网页</strong>：生成 <code>.encrypted.html</code>，打开网页会先显示输入密码页面，输入正确密码后才渲染内容。</li>',
        '<li>如果忘记密码，无法恢复内容（请务必妥善保存）。</li>',
        '</ul>',
        '<h2 id="加密文件如何打开">加密文件如何打开</h2>',
        '<ol>',
        '<li>点击顶部工具栏 <strong>加载</strong> 选择 <code>.encrypted.json</code> 文件。</li>',
        '<li>弹窗提示输入密码（最多可多次尝试）。</li>',
        '<li>解密成功后才会加载目录与内容。</li>',
        '</ol>',
        '<h2 id="文件名规则">文件名规则</h2>',
        '<ul>',
        '<li><strong>全量</strong>：<code>{文件名}.json</code></li>',
        '<li><strong>增量</strong>：<code>{文件名}_incremental.json</code>（或你选择的格式后缀）</li>',
        '<li><strong>差异补丁</strong>：<code>{文件名}.patch.json</code></li>',
        '<li><strong>加密全量</strong>：<code>{文件名}.encrypted.json</code></li>',
        '<li><strong>加密增量</strong>：<code>{文件名}_incremental.encrypted.json</code></li>',
        '<li><strong>加密差异补丁</strong>：<code>{文件名}.patch.encrypted.json</code></li>',
        '<li><strong>加密网页</strong>：<code>{文件名}.encrypted.html</code></li>',
        '<li><strong>Sora 单文件包</strong>：<code>{文件名}.sora</code>；加密包通常为 <code>{文件名}.encrypted.sora</code></li>',
        '</ul>',
        '<h2 id="差异补丁说明">差异补丁说明</h2>',
        '<ul>',
        '<li>差异补丁文件用于在“已有基础数据”的前提下应用更新。</li>',
        '<li><strong>应用补丁前需要先加载基础数据</strong>，否则无法知道补丁要改哪一份内容。</li>',
        '<li>补丁应用后会标记为未保存状态，建议立即另存为全量或增量以固化结果。</li>',
        '</ul>',
        '<h2 id="支持的导入格式">支持的导入格式</h2>',
        '<ul>',
        '<li><strong>.sora</strong>：包含目录、层级颜色和媒体的单文件包，也支持加密 <code>.sora</code>。</li>',
        '<li><strong>.json</strong>：推荐格式（可读性好）。</li>',
        '<li><strong>.txt</strong>：文本格式。</li>',
        '<li><strong>.xml</strong>：XML 格式。</li>',
        '<li><strong>.csv</strong>：CSV 格式。</li>',
        '</ul>',
        '<h2 id="加载方式">加载方式：替换 / 合并 / 应用补丁</h2>',
        '<ul>',
        '<li><strong>替换</strong>：清空现有数据并加载文件。</li>',
        '<li><strong>合并</strong>：将新数据合并到现有数据中（用于增量文件）。</li>',
        '<li><strong>应用差异补丁</strong>：当加载到 <code>.patch</code> 文件时，会将补丁应用到当前数据上。</li>',
        '</ul>',
        '<h2 id="缓存与快速加载">缓存与快速加载</h2>',
        '<ul>',
        '<li>对<strong>未加密文件</strong>，系统可能会启用 FileCache 加速再次打开（提示“从缓存快速加载”）。</li>',
        '<li>加密文件需要先解密，默认不使用缓存。</li>',
        '</ul>',
        '<h2 id="直接保存支持">直接保存支持</h2>',
        '<ul>',
        '<li>如果浏览器支持 File System Access API，则打开文件后可直接保存到原文件（Ctrl+S）。</li>',
        '<li>如果不支持，仍可使用“另存为”导出文件/网页。</li>',
        '</ul>',
        '<h2 id="加载文件">加载</h2>',
        '<ul>',
        '<li>顶部工具栏 <strong>加载</strong>：选择文件导入目录数据。</li>',
        '<li>加载加密文件时会提示输入密码，最多可重试。</li>',
        '</ul>'
    ].join('');

    const notes = [
        '<h1>注意事项与常见问题</h1>',
        nav,

        '<h2 id="交互相关">交互相关</h2>',
        '<ul>',
        '<li>编辑器预览区：<strong>Ctrl+单击</strong> 才会跳转/打开；单击用于进入编辑与选中元素。</li>',
        '<li>普通目录切换会恢复该目录上次位置；首次打开从顶部开始。带锚点的跳转始终定位到目标锚点。</li>',
        '<li>目录内跳转使用 <code>name:</code> 时，如果存在同名目录，会跳到第一个匹配项（建议用 <code>dir:</code> 更稳定）。</li>',
        '</ul>',
        '<h2 id="视图相关">视图相关</h2>',
        '<ul>',
        '<li><strong>切换侧边栏</strong>：隐藏/显示左侧目录树，右侧编辑区会自动铺满。</li>',
        '<li><strong>拖拽调整宽度</strong>：拖动目录与正文之间的分隔条可调整侧边栏宽度（会自动记住）。</li>',
        '<li><strong>全屏</strong>：进入/退出全屏模式，适合专注写作。</li>',
        '<li><strong>移动端工具栏</strong>：点击“更多”可执行完整功能，并可星标、排序最多 4 个常用快捷按钮。</li>',
        '</ul>',
        '<h2 id="自动草稿">自动草稿</h2>',
        '<ul>',
        '<li>有未保存修改时，系统会把最新草稿保存在当前浏览器本地，并定期保留最多 20 个历史快照。</li>',
        '<li>再次打开时可选择恢复最近 30 天内的草稿；选择忽略会删除该草稿。</li>',
        '<li>点击顶部“草稿”可查看快照差异，恢复整个快照，或只勾选部分目录恢复。</li>',
        '<li>草稿按文档身份隔离，同名但来源不同的文件不会串用；可输入名称建立命名快照，目录字段会随快照恢复。</li>',
        '<li>自动草稿不能替代正式保存或备份，清理浏览器站点数据后可能丢失。</li>',
        '</ul>',
        '<h2 id="媒体资源管理">媒体资源管理</h2>',
        '<ul>',
        '<li><strong>媒体库</strong>用于查看资源大小、类型、引用次数和引用目录，可按当前目录/孤立状态筛选；属性面板可统一修改图注、宽度、对齐和加载策略，“替换”会重连全部引用后再清理旧资源。</li>',
        '<li>仍被正文引用的资源不能在媒体库直接删除；孤立资源可逐项删除，也可右键顶部存储信息批量清理。</li>',
        '</ul>',
        '<h2 id="存储空间">存储空间</h2>',
        '<ul>',
        '<li>顶部“存储”区域显示当前已用空间；详情中可查看浏览器动态分配的配额。</li>',
        '<li><strong>左键</strong>点击存储信息：刷新统计。</li>',
        '<li><strong>右键</strong>点击存储信息：清理孤立媒体数据（不再被任何目录引用的图片/视频/压缩文件）。</li>',
        '<li>存储信息会定期自动刷新（也可手动刷新）。</li>',
        '<li>按 Ctrl+K 搜索<strong>存储与诊断</strong>可查看空间趋势、孤立/缺失/重复媒体、迁移能力和诊断级别；合并重复媒体前会再次确认并先重写引用。</li>',
        '<li>诊断摘要会脱敏，不包含正文、密码、附件内容或方法持久变量值。</li>',
        '</ul>',
        '<h2 id="性能预算">性能预算</h2>',
        '<ul>',
        '<li>按 Ctrl+K 搜索<strong>性能预算</strong>可运行 1,000 目录、约 10 MB 正文的索引基准，并查看 Worker 状态与最近耗时。</li>',
        '<li>基准主要验证索引与预检计算；真实输入流畅度仍以桌面和移动浏览器场景验收为准。</li>',
        '</ul>',
        '<h2 id="新建会清空什么">新建会清空什么</h2>',
        '<ul>',
        '<li>“文件 / 新建”会清空当前目录与内容，再创建并选中一个空白的“默认目录”。</li>',
        '<li>同时会清空已存储的媒体数据（图片/视频/压缩文件等），并断开原文件的直接保存关联。如果你还需要这些数据，请先导出网页或另存为文件备份。</li>',
        '</ul>',
        '<h2 id="导出相关">导出相关</h2>',
        '<ul>',
        '<li>导出网页可能较大（会内嵌媒体数据），建议用浏览器直接打开查看。</li>',
        '<li>加密网页/加密文件如果忘记密码无法找回，请妥善保管。</li>',
        '</ul>',
        '<h2 id="编辑建议">编辑建议</h2>',
        '<ul>',
        '<li>批量替换/大范围格式化前建议先保存，避免误操作。</li>',
        '<li>建议定期用“另存为”保存一个副本，尤其是大量修改之后。</li>',
        '</ul>'
    ].join('');

    return {
        mulu_help_root: root,
        mulu_help_quickstart: quickstart,
        mulu_help_directory: directory,
        mulu_help_format: format,
        mulu_help_link_anchor: linkAnchor,
        mulu_help_search: search,
        mulu_help_advanced: advanced,
        mulu_help_export: exportPage,
        mulu_help_notes: notes
    };
}

function buildHelpManualMulufile() {
    const pages = buildHelpPageContents();
    return [
        ['mulu', '使用说明', 'mulu_help_root', pages.mulu_help_root],
        ['mulu_help_root', '快速开始', 'mulu_help_quickstart', pages.mulu_help_quickstart],
        ['mulu_help_root', '目录操作', 'mulu_help_directory', pages.mulu_help_directory],
        ['mulu_help_root', '编辑与格式', 'mulu_help_format', pages.mulu_help_format],
        ['mulu_help_root', '链接与锚点', 'mulu_help_link_anchor', pages.mulu_help_link_anchor],
        ['mulu_help_root', '查找与替换', 'mulu_help_search', pages.mulu_help_search],
        ['mulu_help_root', '高级操作', 'mulu_help_advanced', pages.mulu_help_advanced],
        ['mulu_help_root', '保存、导出与加密', 'mulu_help_export', pages.mulu_help_export],
        ['mulu_help_root', '注意事项与常见问题', 'mulu_help_notes', pages.mulu_help_notes]
    ];
}

async function loadHelpManual(options = {}) {
    const silent = !!options.silent;
    const force = !!options.force;
    const hasExistingData = (typeof mulufile !== 'undefined' && Array.isArray(mulufile) && mulufile.length > 0);

    if (!force && typeof hasUnsavedChanges !== 'undefined' && hasUnsavedChanges) {
        const msg = hasExistingData
            ? '当前有未保存的更改，添加使用说明会修改目录数据（插入到最前面）。\n\n是否继续？'
            : '当前有未保存的更改，打开使用说明会替换当前目录与内容。\n\n是否继续？';
        const confirmed = await customConfirm(msg);
        if (!confirmed) return;
    }

    const helpMulufile = buildHelpManualMulufile();
    const helpDirIds = new Set(helpMulufile.map(row => row[2]));
    // 刷新旧版使用说明时，同时移除已废弃的解谜模板目录。
    helpDirIds.add('mulu_help_decrypt');
    helpDirIds.add('mulu_help_decrypt_hidden');

    if (!hasExistingData) {
        if (typeof currentFileHandle !== 'undefined') {
            currentFileHandle = null;
        }
        if (typeof currentFileName !== 'undefined') {
            currentFileName = '使用说明';
        }
        mulufile = helpMulufile;
        if (typeof loadDirectoryLevelColors === 'function') {
            loadDirectoryLevelColors(null);
        }
    } else {
        const existing = Array.isArray(mulufile) ? mulufile : [];
        const filtered = existing.filter(row => !helpDirIds.has(row && row[2]));
        mulufile = helpMulufile.concat(filtered);
    }

    if (typeof rebuildMulufileIndex === 'function') {
        rebuildMulufileIndex();
    }
    if (typeof LoadMulu === 'function') {
        LoadMulu();
    }
    if (typeof expandAllDirectories === 'function') {
        expandAllDirectories();
    }

    if (typeof selectFirstRootDirectory === 'function') {
        selectFirstRootDirectory();
    }

    if (typeof hasUnsavedChanges !== 'undefined') {
        if (!hasExistingData) {
            hasUnsavedChanges = false;
        } else {
            hasUnsavedChanges = true;
        }
    }
    if (typeof updateSaveButtonState === 'function') {
        updateSaveButtonState();
    }
    if (!silent && typeof showToast === 'function') {
        showToast('已打开使用说明', 'success', 2000);
    }
}

if (typeof helpBtn !== 'undefined' && helpBtn) {
    helpBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await loadHelpManual({ silent: false, force: false });
    });
}

function insertHtmlIntoPreview(html) {
    if (!markdownPreview) return false;
    const selection = window.getSelection();
    let range = null;
    if (selection && selection.rangeCount > 0) {
        const r = selection.getRangeAt(0);
        const container = r.commonAncestorContainer;
        const inPreview = (container === markdownPreview) || (container && markdownPreview.contains(container));
        if (inPreview) {
            range = r;
        }
    }
    if (!range) {
        range = document.createRange();
        range.selectNodeContents(markdownPreview);
        range.collapse(false);
    }

    const div = document.createElement('div');
    div.innerHTML = html;
    const frag = document.createDocumentFragment();
    let lastNode = null;
    while (div.firstChild) {
        const node = div.firstChild;
        frag.appendChild(node);
        lastNode = node;
    }
    range.deleteContents();
    range.insertNode(frag);

    const newRange = document.createRange();
    if (lastNode) {
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
    } else {
        newRange.setStart(range.startContainer, range.startOffset);
        newRange.collapse(true);
    }
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
    markdownPreview.focus();
    syncPreviewToTextarea();
    if (typeof markUnsavedChanges === 'function') {
        markUnsavedChanges();
    }
    return true;
}

function prependHtmlIntoPreview(html) {
    if (!markdownPreview) return false;
    const range = document.createRange();
    range.selectNodeContents(markdownPreview);
    range.collapse(true);

    const div = document.createElement('div');
    div.innerHTML = html;
    const frag = document.createDocumentFragment();
    let lastNode = null;
    while (div.firstChild) {
        const node = div.firstChild;
        frag.appendChild(node);
        lastNode = node;
    }
    range.insertNode(frag);

    const selection = window.getSelection();
    if (selection) {
        const newRange = document.createRange();
        if (lastNode) {
            newRange.setStartAfter(lastNode);
            newRange.collapse(true);
        } else {
            newRange.setStart(range.startContainer, range.startOffset);
            newRange.collapse(true);
        }
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    markdownPreview.focus();
    syncPreviewToTextarea();
    if (typeof markUnsavedChanges === 'function') {
        markUnsavedChanges();
    }
    return true;
}

window.loadHelpManual = loadHelpManual;

document.addEventListener('keydown', function(e) {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl) {
        switch(e.key.toLowerCase()) {
            case 's':  
                e.preventDefault();
                if (topSaveBtn) topSaveBtn.click();
                break;
            case 'b':  
                e.preventDefault();
                const boldBtn = document.querySelector('.format-toolbar-btn[data-command="bold"]');
                if (boldBtn) boldBtn.click();
                break;
            case 'i':  
                e.preventDefault();
                const italicBtn = document.querySelector('.format-toolbar-btn[data-command="italic"]');
                if (italicBtn) italicBtn.click();
                break;
            case 'u':  
                e.preventDefault();
                const underlineBtn = document.querySelector('.format-toolbar-btn[data-command="underline"]');
                if (underlineBtn) underlineBtn.click();
                break;
        }
    }
});
const storageInfoElement = document.getElementById('storageInfo');
let storageInfoUpdatePromise = null;
let lastStorageInfoUpdatedAt = 0;
/**
 * 格式化存储大小
 * @param {number} bytes - 字节数
 * @returns {string} - 格式化后的大小字符串
 */
function formatStorageSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function setStorageInfoState(state) {
    if (!storageInfoElement) return;
    storageInfoElement.classList.remove('calculating', 'warning', 'danger');
    if (state) storageInfoElement.classList.add(state);
}

/**
 * 更新存储空间信息显示
 */
async function updateStorageInfo(options = {}) {
    if (!storageInfoElement) return;
    const force = !!options.force;
    const now = Date.now();
    if (!force && storageInfoUpdatePromise) {
        return storageInfoUpdatePromise;
    }
    if (!force && now - lastStorageInfoUpdatedAt < 5000) {
        return;
    }

    storageInfoElement.textContent = '计算中...';
    setStorageInfoState('calculating');
    storageInfoUpdatePromise = (async () => {
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const used = estimate.usage || 0;
            const quota = estimate.quota || 0;
            const available = quota - used;
            const usagePercent = quota > 0 ? (used / quota * 100) : 0;
            const persisted = navigator.storage.persisted
                ? await navigator.storage.persisted()
                : null;
            const cacheStats = (typeof FileCache !== 'undefined' && FileCache.getStats)
                ? await FileCache.getStats()
                : null;
            // 格式化显示
            const usedStr = formatStorageSize(used);
            const availableStr = formatStorageSize(available);
            const quotaStr = formatStorageSize(quota);
            storageInfoElement.textContent = quota > 0
                ? `已用 ${usedStr}`
                : `已用 ${usedStr} / 配额未知`;
            storageInfoElement.title = `存储空间详情:
已使用: ${usedStr}
浏览器当前可用余量: ${availableStr}
浏览器当前配额: ${quotaStr}
使用率: ${usagePercent.toFixed(1)}%
文件缓存: ${cacheStats ? `${cacheStats.valid} 项 / ${cacheStats.totalSizeMB} MB` : '不可用'}
持久化: ${persisted === null ? '未知' : (persisted ? '已启用' : '未启用')}

说明: 实际配额由浏览器和磁盘空间动态决定。

左键刷新 | 右键清理孤立数据`;
            // 根据使用率设置样式
            if (usagePercent > 90) {
                setStorageInfoState('danger');
            } else if (usagePercent > 70) {
                setStorageInfoState('warning');
            } else {
                setStorageInfoState('');
            }
        } else {
            storageInfoElement.textContent = '不支持';
            storageInfoElement.title = '浏览器不支持 Storage API';
            setStorageInfoState('');
        }
        lastStorageInfoUpdatedAt = Date.now();
    } catch (err) {
        console.error('获取存储信息失败:', err);
        storageInfoElement.textContent = '获取失败';
        storageInfoElement.title = '获取存储信息失败: ' + err.message;
        setStorageInfoState('');
    } finally {
        storageInfoUpdatePromise = null;
    }
    })();
    return storageInfoUpdatePromise;
}
// 点击刷新存储信息
if (storageInfoElement) {
    storageInfoElement.addEventListener('click', function() {
        updateStorageInfo({ force: true });
        if (typeof showToast === 'function') {
            showToast('正在刷新存储信息...', 'info', 1000);
        }
    });
    // 右键清理孤立数据
    storageInfoElement.addEventListener('contextmenu', async function(e) {
        e.preventDefault();
        if (typeof MediaStorage === 'undefined' || !MediaStorage.cleanupOrphanedData) {
            showToast('清理功能不可用', 'error', 2000);
            return;
        }
        const confirmed = await customConfirm('清理孤立的媒体数据？\n\n这将删除不再被任何目录引用的图片、视频和压缩文件数据。');
        if (!confirmed) return;
        try {
            showToast('正在清理...', 'info', 2000);
            const deletedCount = await MediaStorage.cleanupOrphanedData();
            await updateStorageInfo({ force: true });
            if (deletedCount > 0) {
                showToast(`已清理 ${deletedCount} 个孤立数据`, 'success', 3000);
            } else {
                showToast('没有孤立数据需要清理', 'info', 2000);
            }
        } catch (err) {
            console.error('清理失败:', err);
            showToast('清理失败: ' + err.message, 'error', 3000);
        }
    });
}
// 初始化时获取存储信息
updateStorageInfo({ force: true });
// 定期更新存储信息（每60秒）
setInterval(() => updateStorageInfo(), 60000);
// -------------------- 格式工具栏鼠标滚轮横向滚动 --------------------
/**
 * 初始化格式工具栏的鼠标滚轮横向滚动功能
 */
function initFormatToolbarWheelScroll() {
    const formatToolbarScroll = document.querySelector('.format-toolbar-scroll');
    if (!formatToolbarScroll) return;
    formatToolbarScroll.addEventListener('wheel', function(e) {
        const hasHorizontalScroll = formatToolbarScroll.scrollWidth > formatToolbarScroll.clientWidth;
        if (hasHorizontalScroll) {
            e.preventDefault();
            formatToolbarScroll.scrollLeft += e.deltaY;
            if (e.deltaX !== 0) {
                formatToolbarScroll.scrollLeft += e.deltaX;
            }
        }
    }, { passive: false });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormatToolbarWheelScroll);
} else {
    initFormatToolbarWheelScroll();
}
window.addEventListener('load', function() {
    setTimeout(initFormatToolbarWheelScroll, 100);
});
/**
 * 初始化侧边栏宽度拖拽调整功能
 */
function initSidebarResizer() {
    const resizer = document.getElementById('sidebarResizer');
    const bigbox = document.querySelector('.bigbox');
    const wordsbox = document.querySelector('.wordsbox');
    if (!resizer || !bigbox || !wordsbox) return;
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
        document.documentElement.style.setProperty('--sidebar-width', savedWidth);
    }
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    const minWidth = 150;
    const maxWidth = window.innerWidth * 0.8;
    function getSidebarWidth() {
        const widthValue = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width').trim();
        if (widthValue.includes('%')) {
            return (window.innerWidth * parseFloat(widthValue)) / 100;
        } else if (widthValue.includes('px')) {
            return parseFloat(widthValue);
        }
        return window.innerWidth * 0.2; 
    }
    function setSidebarWidth(width) {
        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, width));
        const percentage = (clampedWidth / window.innerWidth) * 100;
        document.documentElement.style.setProperty('--sidebar-width', `${percentage}%`);
        localStorage.setItem('sidebarWidth', `${percentage}%`);
    }
    resizer.addEventListener('mousedown', function(e) {
        isDragging = true;
        startX = e.clientX;
        startWidth = getSidebarWidth();
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        setSidebarWidth(newWidth);
        e.preventDefault();
    });
    document.addEventListener('mouseup', function(e) {
        if (isDragging) {
            isDragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
    window.addEventListener('resize', function() {
        const currentWidth = getSidebarWidth();
        setSidebarWidth(currentWidth);
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarResizer);
} else {
    initSidebarResizer();
}
window.addEventListener('load', function() {
    setTimeout(initSidebarResizer, 100);
});
window.updateStorageInfo = updateStorageInfo;
