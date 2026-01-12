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
            if (markdownContainer) markdownContainer.style.height = '100%';
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
    fileInput.accept = '.json,.txt,.xml,.csv,.encrypted.json';  
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
                        console.log('FileCache: 从缓存加载文件', fileName);
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
                        try {
                            await FileCache.set(file, parsedData);
                            console.log('FileCache: 已缓存文件', fileName);
                        } catch (err) {
                            console.warn('FileCache: 缓存保存失败', err);
                        }
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
                    wordsbox.style.display = "block";
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
                    if (typeof currentFileHandle !== 'undefined') {
                        currentFileHandle = null;
                    }
                    if (typeof currentFileName !== 'undefined') {
                        currentFileName = fileName;
                    }
                    LoadMulu();
                    if (typeof calculateAllHashes === 'function') {
                        calculateAllHashes();
                    }
                    if (typeof hasUnsavedChanges !== 'undefined') {
                        hasUnsavedChanges = false;
                    }
                    if (typeof updateSaveButtonState === 'function') {
                        updateSaveButtonState();
                    }
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
                wordsbox.style.display = "block";
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
                    console.log('已清空 IndexedDB 媒体存储');
                } catch (err) {
                    console.error('清空 IndexedDB 失败:', err);
                }
            }
            mulufile = [];
            currentMuluName = null;
            const firststep = document.querySelector(".firststep");
            if (firststep) firststep.innerHTML = "";
            if (jiedianwords) jiedianwords.value = "";
            if (markdownPreview) markdownPreview.innerHTML = "";
            if (fileNameInput) fileNameInput.value = "soralist";
            if (typeof updateStorageInfo === 'function') {
                await updateStorageInfo();
            }
            customAlert("已新建，存储空间已清理");
        }
    });
}
if (saveAsBtn) {
    saveAsBtn.addEventListener("click", async function() {
        const saveAsOptions = [
            { value: 'webpage', label: '网页 (.html) - 独立可浏览的网页' },
            { value: 'custom', label: '自定义文件名 - 手动输入文件名和格式' }
        ];
        const saveType = await customSelect('选择另存为格式：', saveAsOptions, 'webpage', '另存为');
        if (saveType === null) {
            showToast('已取消保存', 'info', 2000);
            return;
        }
        if (saveType === 'webpage') {
            const encryptOptions = [
                { value: 'no', label: '不加密' },
                { value: 'yes', label: '加密网页（需要密码才能查看）' }
            ];
            const encrypt = await customSelect('是否加密？', encryptOptions, 'no', '导出网页');
            if (encrypt === null) {
                showToast('已取消', 'info', 2000);
                return;
            }
            await handleSaveAsWebpage(encrypt === 'yes');
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
                password = await customPrompt('设置加密密码：', '', '加密保存');
                if (!password) {
                    showToast('已取消', 'info', 2000);
                    return;
                }
                const confirmPassword = await customPrompt('确认密码：', '', '加密保存');
                if (confirmPassword !== password) {
                    customAlert('两次输入的密码不一致');
                    return;
                }
            }
            let customName = await customPrompt("输入文件名（包含扩展名，如：mydata.json）", "");
            if (!customName) {
                showToast('已取消保存', 'info', 2000);
                return;
            }
            if (password) {
                await handleSaveAsEncrypted(customName, password);
            } else {
                await handleSaveAs(customName);
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
        { id: 'mulu_help_notes', name: '注意事项与常见问题' },
        { id: 'mulu_help_decrypt', name: '解密游戏模板' }
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
        '<p>这是内置的说明文档</p>',
        '<h2 id="交互说明">交互说明</h2>',
        '<ul>',
        '<li><strong>目录区</strong>：左键选择；双击重命名；拖拽移动（含子目录）；右键打开菜单。</li>',
        '<li><strong>编辑区</strong>：右侧为可编辑预览区，直接输入/粘贴即可。</li>',
        '<li><strong>链接/锚点</strong>：在编辑器预览区，单击用于编辑；要跳转/打开请使用 <strong>Ctrl+单击</strong>。</li>',
        '<li><strong>导出网页</strong>：网页里是普通单击跳转；锚点本身不可见且不可点击（仅作为跳转目标）。</li>',
        '</ul>',
        '<h2 id="常用快捷键">常用快捷键</h2>',
        '<ul>',
        '<li><strong>Ctrl+S</strong>：保存</li>',
        '<li><strong>Ctrl+F</strong>：查找</li>',
        '<li><strong>Ctrl+H</strong>：替换</li>',
        '<li><strong>Ctrl+B / Ctrl+I / Ctrl+U</strong>：粗体 / 斜体 / 下划线</li>',
        '</ul>',
        '<h2 id="你可以做什么">你可以做什么</h2>',
        '<ul>',
        '<li>用左侧目录组织内容，支持多级目录与一整套复制/粘贴/快速复制操作。</li>',
        '<li>在右侧预览区编辑，并用顶部工具栏或悬浮工具栏插入格式。</li>',
        '<li>创建链接：外链、页内跳转（#锚点）、目录内跳转（dir:/name:）。</li>',
        '<li>保存为普通文件或加密文件；导出网页或加密网页（需要密码才能查看）。</li>',
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
        '<li>点击顶部工具栏 <strong>文件 / 新建</strong>（会清空当前目录与内容，并清理已存储的媒体数据）。</li>',
        '<li>点击 <strong>目录 / 添加目录</strong> 创建一级目录，再用 <strong>目录 / 添加节点</strong> 创建子目录。</li>',
        '<li>左键单击目录，右侧开始编辑内容（可直接粘贴图片/文本）。</li>',
        '<li>选择文字后会出现悬浮工具栏，用于快速加粗/链接/列表等；点击任意按钮后会自动收起。</li>',
        '<li>按 <strong>Ctrl+S</strong> 保存；或用 <strong>另存为</strong> 导出网页/加密网页。</li>',
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
        '<li><strong>切换目录会自动回到顶部</strong>：无论左键切换、右键切换、目录内跳转或新建后选中，右侧内容都会从顶部开始显示（带锚点跳转除外）。</li>',
        '</ul>'
    ].join('');

    const directory = [
        '<h1>目录操作</h1>',
        nav,
        '<h2 id="目录基础">基础操作</h2>',
        '<ul>',
        '<li>左键单击：选中并切换右侧内容。</li>',
        '<li>双击：重命名目录。</li>',
        '<li>拖拽：移动目录（含子目录）。</li>',
        '<li>点击目录左侧小三角：展开/收起子目录。</li>',
        '</ul>',
        '<h2 id="目录右键菜单">右键菜单</h2>',
        '<ul>',
        '<li><strong>复制目录（含子目录）</strong>：把当前目录以及所有子目录复制到剪贴板。</li>',
        '<li><strong>复制目录（不含子目录）</strong>：只复制当前目录本身。</li>',
        '<li><strong>粘贴目录</strong>：把剪贴板中的目录粘贴到当前目录同级（插入在当前目录之后）。</li>',
        '<li><strong>快速复制（含子目录 / 不含子目录）</strong>：等价于复制后立刻粘贴。</li>',
        '<li><strong>删除选中目录</strong>：会递归删除子目录与其内容。</li>',
        '<li><strong>展开此目录 / 收起此目录</strong>：递归展开/收起该目录树。</li>',
        '<li><strong>复制目录ID</strong>：复制 data-dir-id，用于写 <strong>dir:目录ID</strong> 类型的目录内跳转链接。</li>',
        '</ul>',
        '<h2 id="目录工具栏">目录工具栏</h2>',
        '<ul>',
        '<li><strong>添加目录</strong>：创建与当前目录同级的新目录。</li>',
        '<li><strong>添加节点</strong>：创建当前目录的子目录。</li>',
        '<li><strong>展开全部 / 收起全部</strong>：展开或收起所有有子目录的项。</li>',
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
        '<tr><td><code>color</code></td><td>文字颜色</td><td>会弹出颜色选择；已选中文本才能应用</td></tr>',
        '<tr><td><code>background-color</code></td><td>背景颜色</td><td>会弹出颜色选择；已选中文本才能应用</td></tr>',
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
        '<h2 id="插入图片">插入图片</h2>',
        '<ul>',
        '<li>顶部工具栏的“插入图片”用于选择图片文件插入到当前目录内容中。</li>',
        '<li>媒体数据会存储在浏览器本地；导出网页时会一并打包（因此文件可能变大）。</li>',
        '</ul>'
    ].join('');

    const linkAnchor = [
        '<h1>链接与锚点</h1>',
        nav,

        '<h2 id="外部链接">外部链接</h2>',
        '<ul>',
        '<li>用“链接”按钮输入 <code>http://</code> 或 <code>https://</code> 地址即可。</li>',
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
        '<li>单击链接会弹出“编辑链接地址”对话框，支持把外链改成 <code>#锚点</code> / <code>dir:</code> / <code>name:</code>。</li>',
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
        '<li>编辑器预览区：对方法链接使用 <strong>Alt+单击</strong> 打开编辑对话框。</li>',
        '<li>编辑器里方法不会执行，这是刻意设计：避免编辑时误触导致内容被改写。</li>',
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
        '<li><strong>多层嵌套</strong>：嵌套方法可以再嵌套方法，支持无限层级。</li>',
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
        '<p><strong>应用场景</strong>：适合解密游戏等场景，先让关卡可见，再通过其他触发方式（如点击按钮）来控制隐藏/显示。如果直接用普通的“隐藏”，<code>open</code> 触发时关卡就立刻隐藏了，用户看不到。</p>',
        '<h3 id="更换内容的覆盖问题">更换内容的覆盖问题</h3>',
        '<p>当使用<strong>更换内容</strong>方法从隐藏答案库调取内容到题目目录时：</p>',
        '<ul>',
        '<li><strong>问题</strong>：如果调取的内容被插入到目录内容中，当下一题更新这个目录的内容时，之前调取的答案会被覆盖。</li>',
        '<li><strong>建议</u89e3决方案</strong>：</li>',
        '<li>方案A：将每题的答案分别替换到<strong>不同的锚点范围</strong>，而不是同一个范围。</li>',
        '<li>方案B：将答案调取到<strong>单独的目录</strong>，而不是题目目录内。</li>',
        '<li>方案C：使用<strong>显示</strong>方法来显示隐藏的答案区域，而不是替换内容。</li>',
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
        '<li><strong>网页 (.html)</strong>：导出为独立可浏览的网页。</li>',
        '<li><strong>自定义文件名</strong>：手动输入文件名与扩展名（如：mydata.json）。</li>',
        '</ul>',
        '<p>两种格式都会再询问“是否加密”。</p>',
        '<h2 id="导出网页">导出网页（不加密）</h2>',
        '<ul>',
        '<li>导出网页后可离线打开浏览，目录与内部跳转都可用。</li>',
        '<li>导出网页中：锚点不可见且不可点击，只用于作为跳转目标。</li>',
        '<li>导出网页中：方法会生效（按触发方式执行），可用于隐藏/显示/切换、重命名、替换内容、添加格式、目录动作等。</li>',
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
        '</ul>',
        '<h2 id="差异补丁说明">差异补丁说明</h2>',
        '<ul>',
        '<li>差异补丁文件用于在“已有基础数据”的前提下应用更新。</li>',
        '<li><strong>应用补丁前需要先加载基础数据</strong>，否则无法知道补丁要改哪一份内容。</li>',
        '<li>补丁应用后会标记为未保存状态，建议立即另存为全量或增量以固化结果。</li>',
        '</ul>',
        '<h2 id="支持的导入格式">支持的导入格式</h2>',
        '<ul>',
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
        '<li>切换目录时右侧内容会自动回到顶部；如果是带锚点的跳转，会在顶部归零后再滚动到锚点位置。</li>',
        '<li>目录内跳转使用 <code>name:</code> 时，如果存在同名目录，会跳到第一个匹配项（建议用 <code>dir:</code> 更稳定）。</li>',
        '</ul>',
        '<h2 id="视图相关">视图相关</h2>',
        '<ul>',
        '<li><strong>切换侧边栏</strong>：隐藏/显示左侧目录树，右侧编辑区会自动铺满。</li>',
        '<li><strong>拖拽调整宽度</strong>：拖动目录与正文之间的分隔条可调整侧边栏宽度（会自动记住）。</li>',
        '<li><strong>全屏</strong>：进入/退出全屏模式，适合专注写作。</li>',
        '</ul>',
        '<h2 id="存储空间">存储空间</h2>',
        '<ul>',
        '<li>顶部“存储”区域会显示已用/剩余空间。</li>',
        '<li><strong>左键</strong>点击存储信息：刷新统计。</li>',
        '<li><strong>右键</strong>点击存储信息：清理孤立媒体数据（不再被任何目录引用的图片/视频/压缩文件）。</li>',
        '<li>存储信息会定期自动刷新（也可手动刷新）。</li>',
        '</ul>',
        '<h2 id="新建会清空什么">新建会清空什么</h2>',
        '<ul>',
        '<li>“文件 / 新建”会清空当前目录与内容。</li>',
        '<li>同时会清空已存储的媒体数据（图片/视频/压缩文件等）。如果你还需要这些媒体，请先导出网页或另存为文件备份。</li>',
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
        mulu_help_notes: notes,
        mulu_help_decrypt: buildDecryptGameTemplateHtml('mulu_help_decrypt'),
        mulu_help_decrypt_hidden: buildDecryptHiddenAnswersHtml('mulu_help_decrypt_hidden')
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
        ['mulu_help_root', '注意事项与常见问题', 'mulu_help_notes', pages.mulu_help_notes],
        ['mulu_help_root', '解密游戏模板', 'mulu_help_decrypt', pages.mulu_help_decrypt],
        ['mulu_help_decrypt', '隐藏答案库', 'mulu_help_decrypt_hidden', pages.mulu_help_decrypt_hidden]
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

    if (!hasExistingData) {
        if (typeof currentFileHandle !== 'undefined') {
            currentFileHandle = null;
        }
        if (typeof currentFileName !== 'undefined') {
            currentFileName = '使用说明';
        }
        mulufile = helpMulufile;
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

function buildDecryptGameTemplateHtml(dirId) {
    function anchor(name) {
        const n = String(name || '').trim();
        return '<span id="' + escapeHtmlAttr(n) + '" class="sora-anchor" data-sora-anchor="true" data-anchor-name="' + escapeHtmlAttr(n) + '">\u200B</span>';
    }
    function escapeHtmlAttr(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function methodLink(text, methods) {
        const json = escapeHtmlAttr(JSON.stringify(methods || []));
        return '<a href="#" data-sora-link="method" data-sora-methods="' + json + '">' + escapeHtml(String(text || '')) + '</a>';
    }

    const dirRef = dirId ? ('dir:' + String(dirId)) : '';
    const hiddenDirRef = 'dir:mulu_help_decrypt_hidden';

    const openInit = [
        { trigger: 'open', frontAnchor: hiddenDirRef, backAnchor: '', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#stage2_start', backAnchor: '#stage2_end', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#stage3_start', backAnchor: '#stage3_end', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#stage4_start', backAnchor: '#stage4_end', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#final_stage_start', backAnchor: '#final_stage_end', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#success_msg_start', backAnchor: '#success_msg_end', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#clue1_hidden_start', backAnchor: '#clue1_hidden_end', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#clue2_hidden_start', backAnchor: '#clue2_hidden_end', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#clue3_hidden_start', backAnchor: '#clue3_hidden_end', methodType: '隐藏', once: true },
        { trigger: 'open', frontAnchor: '#hint_box_start', backAnchor: '#hint_box_end', methodType: '隐藏', once: true }
    ];

    const openInitLink = methodLink('初始化游戏（打开网页时触发，导出后自动执行）', openInit);

    const enterDirDemo = methodLink('选中目录时触发示例', [
        { trigger: 'enter_dir', frontAnchor: '#enter_demo_start', backAnchor: '#enter_demo_end', methodType: '切换', once: false }
    ]);

    const showClue1 = methodLink('显示线索', [
        { trigger: 'click', frontAnchor: '#clue1_hidden_start', backAnchor: '#clue1_hidden_end', methodType: '显示', once: true }
    ]);

    const passStage1Wrong1 = methodLink('答案：256', [
        { trigger: 'click', frontAnchor: '#feedback1_start', backAnchor: '#feedback1_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '答案错误！提示：2的8次方减1' }
    ]);

    const passStage1Wrong2 = methodLink('答案：128', [
        { trigger: 'click', frontAnchor: '#feedback1_start', backAnchor: '#feedback1_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '答案错误！提示：不是2的7次方' }
    ]);

    const passStage1 = methodLink('答案：255', [
        { trigger: 'click', frontAnchor: '#answer_display1_start', backAnchor: '#answer_display1_end', methodType: '更换内容', once: true, replaceSourceType: 'anchor', replaceFromFrontAnchor: hiddenDirRef + '#answer1_start', replaceFromBackAnchor: hiddenDirRef + '#answer1_end' },
        { trigger: 'click', frontAnchor: '#stage2_start', backAnchor: '#stage2_end', methodType: '显示', once: true },
        { trigger: 'click', frontAnchor: '#stage1_start', backAnchor: '#stage1_end', methodType: '隐藏', once: true }
    ]);

    const toggleClue2 = methodLink('切换线索显示', [
        { trigger: 'click', frontAnchor: '#clue2_hidden_start', backAnchor: '#clue2_hidden_end', methodType: '切换', once: false }
    ]);

    const addHintFormat = methodLink('添加格式提示', [
        { trigger: 'click', frontAnchor: '#stage2_question_start', backAnchor: '#stage2_question_end', methodType: '添加格式', once: false, formatType: 'bold' }
    ]);

    const passStage2Wrong1 = methodLink('答案：迭代', [
        { trigger: 'click', frontAnchor: '#feedback2_start', backAnchor: '#feedback2_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '答案错误！迭代是循环，不是函数调用自己' }
    ]);

    const passStage2Wrong2 = methodLink('答案：多态', [
        { trigger: 'click', frontAnchor: '#feedback2_start', backAnchor: '#feedback2_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '答案错误！多态是面向对象的概念' }
    ]);

    const passStage2 = methodLink('答案：递归', [
        { trigger: 'click', frontAnchor: '#answer_display2_start', backAnchor: '#answer_display2_end', methodType: '更换内容', once: true, replaceSourceType: 'anchor', replaceFromFrontAnchor: hiddenDirRef + '#answer2_start', replaceFromBackAnchor: hiddenDirRef + '#answer2_end' },
        { trigger: 'click', frontAnchor: '#stage3_start', backAnchor: '#stage3_end', methodType: '显示', once: true },
        { trigger: 'click', frontAnchor: '#stage2_start', backAnchor: '#stage2_end', methodType: '隐藏', once: true }
    ]);

    const showClue3 = methodLink('显示隐藏线索', [
        { trigger: 'click', frontAnchor: '#clue3_hidden_start', backAnchor: '#clue3_hidden_end', methodType: '显示', once: true }
    ]);

    const hoverShowHint = methodLink('悬停显示提示', [
        { trigger: 'hover', frontAnchor: '#hint_box_start', backAnchor: '#hint_box_end', methodType: '切换', once: false }
    ]);

    const passStage3Wrong1 = methodLink('答案：LUCAS', [
        { trigger: 'click', frontAnchor: '#feedback3_start', backAnchor: '#feedback3_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '答案错误！Lucas数列与此类似但初始值不同' }
    ]);

    const passStage3Wrong2 = methodLink('答案：PASCAL', [
        { trigger: 'click', frontAnchor: '#feedback3_start', backAnchor: '#feedback3_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '答案错误！Pascal三角形和这个数列不同' }
    ]);

    const passStage3 = methodLink('答案：FIBONACCI', [
        { trigger: 'click', frontAnchor: '#answer_display3_start', backAnchor: '#answer_display3_end', methodType: '更换内容', once: true, replaceSourceType: 'anchor', replaceFromFrontAnchor: hiddenDirRef + '#answer3_start', replaceFromBackAnchor: hiddenDirRef + '#answer3_end' },
        { trigger: 'click', frontAnchor: '#stage4_start', backAnchor: '#stage4_end', methodType: '显示', once: true },
        { trigger: 'click', frontAnchor: '#stage3_start', backAnchor: '#stage3_end', methodType: '隐藏', once: true }
    ]);

    const randomPass1 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const randomPass2 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const randomPass3 = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const replaceContent1 = methodLink('随机密码1', [
        { trigger: 'click', frontAnchor: '#password_content_start', backAnchor: '#password_content_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '临时密码：' + randomPass1 }
    ]);
    
    const replaceContent2 = methodLink('随机密码2', [
        { trigger: 'click', frontAnchor: '#password_content_start', backAnchor: '#password_content_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '临时密码：' + randomPass2 }
    ]);
    
    const replaceContent3 = methodLink('随机密码3', [
        { trigger: 'click', frontAnchor: '#password_content_start', backAnchor: '#password_content_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '临时密码：' + randomPass3 }
    ]);

    const passStage4Wrong1 = methodLink('答案：987', [
        { trigger: 'click', frontAnchor: '#feedback4_start', backAnchor: '#feedback4_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '答案错误！987是F(16)，不是F(17)' }
    ]);

    const passStage4Wrong2 = methodLink('答案：2584', [
        { trigger: 'click', frontAnchor: '#feedback4_start', backAnchor: '#feedback4_end', methodType: '更换内容', once: false, replaceSourceType: 'text', replaceText: '答案错误！2584是F(18)，不是F(17)' }
    ]);

    const passStage4 = methodLink('答案：1597', [
        { trigger: 'click', frontAnchor: '#answer_display4_start', backAnchor: '#answer_display4_end', methodType: '更换内容', once: true, replaceSourceType: 'anchor', replaceFromFrontAnchor: hiddenDirRef + '#answer4_start', replaceFromBackAnchor: hiddenDirRef + '#answer4_end' },
        { trigger: 'click', frontAnchor: '#final_stage_start', backAnchor: '#final_stage_end', methodType: '显示', once: true },
        { trigger: 'click', frontAnchor: '#stage4_start', backAnchor: '#stage4_end', methodType: '隐藏', once: true }
    ]);

    const finalDecrypt = methodLink('解密最终密码', (function() {
        const timestamp = new Date().getTime().toString(36).toUpperCase();
        const finalPassword = 'SORA-' + timestamp.substring(timestamp.length - 6);
        const ms = [
            { trigger: 'click', frontAnchor: '#final_password_start', backAnchor: '#final_password_end', methodType: '更换内容', once: true, replaceSourceType: 'text', replaceText: '最终密码：' + finalPassword },
            { trigger: 'click', frontAnchor: '#success_msg_start', backAnchor: '#success_msg_end', methodType: '显示', once: true },
            { trigger: 'click', frontAnchor: '#final_stage_start', backAnchor: '#final_stage_end', methodType: '隐藏', once: true }
        ];
        if (dirRef) {
            ms.push({ trigger: 'click', frontAnchor: dirRef, backAnchor: '', methodType: '更换内容', once: true, renameTo: '已通关' });
        }
        return ms;
    })());

    return [
        '<hr>',
        '<h2>SoraDirectory 方法系统演示</h2>',
        '<p><strong>游戏说明：</strong>这是一个综合演示所有方法功能的解密游戏。编辑器中方法不会执行，需要导出为网页后才能游玩。</p>',
        '<blockquote>',
        '<p><strong>方法类型演示：</strong>隐藏、显示、切换、更换内容、添加格式、目录重命名</p>',
        '<p><strong>触发方式演示：</strong>打开网页时、选中目录时、点击时、悬浮时</p>',
        '<p><strong>隐藏目录演示：</strong>本游戏包含一个名为“隐藏答案库”的子目录，导出网页后该目录会被隐藏，但其内容会被方法系统提取到主游戏区域显示。</p>',
        '</blockquote>',
        '<p>' + openInitLink + '</p>',
        '<hr>',

        anchor('enter_demo_start'),
        '<p><em>（选中目录时触发示例：这段文字会在每次选中该目录时切换显示/隐藏状态）</em></p>',
        anchor('enter_demo_end'),
        '<p>' + enterDirDemo + '</p>',
        '<hr>',

        anchor('stage1_start'),
        '<h3>第一关：二进制的秘密</h3>',
        '<p><strong>题目：</strong>8位二进制数能表示的最大十进制数是多少？</p>',
        '<blockquote>',
        '<p>提示：8个1组成的二进制数是 11111111</p>',
        '</blockquote>',
        '<p>' + showClue1 + '</p>',
        anchor('clue1_hidden_start'),
        '<blockquote>',
        '<p><strong>线索：</strong>2⁸ - 1 = ？（显示方法演示）</p>',
        '</blockquote>',
        anchor('clue1_hidden_end'),
        '<p>' + passStage1Wrong1 + ' | ' + passStage1Wrong2 + ' | ' + passStage1 + '</p>',
        anchor('feedback1_start'),
        anchor('feedback1_end'),
        anchor('answer_display1_start'),
        anchor('answer_display1_end'),
        anchor('stage1_end'),

        anchor('stage2_start'),
        '<h3>第二关：函数的自我调用</h3>',
        anchor('stage2_question_start'),
        '<p><strong>题目：</strong>在编程中，函数调用自身的技术叫什么？</p>',
        anchor('stage2_question_end'),
        '<pre><code>function factorial(n) {\n    if (n &lt;= 1) return 1;\n    return n * factorial(n - 1);  // 函数调用了自己\n}</code></pre>',
        '<p>' + toggleClue2 + ' | ' + addHintFormat + '</p>',
        anchor('clue2_hidden_start'),
        '<blockquote>',
        '<p><strong>提示：</strong>这个技术的英文是 Recursion（切换方法演示）</p>',
        '</blockquote>',
        anchor('clue2_hidden_end'),
        '<p>' + passStage2Wrong1 + ' | ' + passStage2Wrong2 + ' | ' + passStage2 + '</p>',
        anchor('feedback2_start'),
        anchor('feedback2_end'),
        anchor('answer_display2_start'),
        anchor('answer_display2_end'),
        anchor('stage2_end'),

        anchor('stage3_start'),
        '<h3>第三关：神秘数列</h3>',
        '<p><strong>题目：</strong>以下数列的名称是什么？（英文大写）</p>',
        '<p><code>1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144...</code></p>',
        '<p>' + showClue3 + ' | ' + hoverShowHint + '</p>',
        anchor('clue3_hidden_start'),
        '<blockquote>',
        '<p><strong>线索：</strong>这个数列的规律是 F(n) = F(n-1) + F(n-2)，前两项都是1</p>',
        '</blockquote>',
        anchor('clue3_hidden_end'),
        anchor('hint_box_start'),
        '<blockquote>',
        '<p>提示：这个数列以意大利数学家的名字命名，他在研究兔子繁殖问题时发现了这个规律。（悬浮时触发演示）</p>',
        '</blockquote>',
        anchor('hint_box_end'),
        '<p>' + passStage3Wrong1 + ' | ' + passStage3Wrong2 + ' | ' + passStage3 + '</p>',
        anchor('feedback3_start'),
        anchor('feedback3_end'),
        anchor('answer_display3_start'),
        anchor('answer_display3_end'),
        anchor('stage3_end'),

        anchor('stage4_start'),
        '<h3>第四关：数列推演</h3>',
        '<p><strong>题目：</strong>根据上一关的数列规律，第17项的值是多少？</p>',
        '<blockquote>',
        '<p>提示：F(1)=1, F(2)=1, F(3)=2, F(4)=3, F(5)=5, F(6)=8, F(7)=13, F(8)=21...</p>',
        '</blockquote>',
        '<p>你需要获取一个临时密码，然后用它计算最终密码。点击以下任意一个按钮获取：</p>',
        '<p>' + replaceContent1 + ' | ' + replaceContent2 + ' | ' + replaceContent3 + '（更换内容方法演示 - 每个按钮生成不同内容）</p>',
        anchor('password_content_start'),
        '<p><em>这里会被替换成随机密码</em></p>',
        anchor('password_content_end'),
        '<p>' + passStage4Wrong1 + ' | ' + passStage4Wrong2 + ' | ' + passStage4 + '</p>',
        anchor('feedback4_start'),
        anchor('feedback4_end'),
        anchor('answer_display4_start'),
        anchor('answer_display4_end'),
        anchor('stage4_end'),

        anchor('final_stage_start'),
        '<h3>最终关：解密密码</h3>',
        '<p><strong>任务：</strong>点击下方按钮，获取最终解密密码！</p>',
        '<blockquote>',
        '<p>这一步将演示：</p>',
        '<p>• 更换内容方法（替换密码显示区）</p>',
        '<p>• 显示方法（显示通关信息）</p>',
        '<p>• 隐藏方法（隐藏当前关卡）</p>',
        '<p>• 目录重命名方法（将目录名改为"已通关"）</p>',
        '</blockquote>',
        '<p>' + finalDecrypt + '</p>',
        '<blockquote>',
        anchor('final_password_start'),
        '<p><em>密码尚未解密...</em></p>',
        anchor('final_password_end'),
        '</blockquote>',
        anchor('final_stage_end'),

        anchor('success_msg_start'),
        '<hr>',
        '<h3>恭喜通关！</h3>',
        anchor('success_msg_end'),
        '<hr>',
    ].join('');
}

function buildDecryptHiddenAnswersHtml(dirId) {
    function anchor(name) {
        const n = String(name || '').trim();
        return '<span id="' + escapeHtmlAttr(n) + '" class="sora-anchor" data-sora-anchor="true" data-anchor-name="' + escapeHtmlAttr(n) + '">​</span>';
    }
    function escapeHtmlAttr(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return [
        '<h2>隐藏答案库</h2>',
        '<p><strong>说明：</strong>这是一个隐藏目录，存放游戏的答案和线索。在导出网页后，这个目录会被隐藏，但其内容会被方法系统提取到游戏主目录的指定位置。</p>',
        '<hr>',

        '<h3>第一关答案</h3>',
        anchor('answer1_start'),
        '<p>正确答案是 255。</p>',
        '<p>2的 8 次方等于 256，减去 1 得到 255。</p>',
        '<p>8位二进制数 11111111 转换为十进制就是 255。</p>',
        anchor('answer1_end'),
        '<hr>',

        '<h3>第二关答案</h3>',
        anchor('answer2_start'),
        '<p>正确答案是：递归（Recursion）</p>',
        '<p>递归是指函数调用自身的编程技术。</p>',
        '<p>在代码中，factorial 函数调用了 factorial(n-1)，这就是递归。</p>',
        anchor('answer2_end'),
        '<hr>',

        '<h3>第三关答案</h3>',
        anchor('answer3_start'),
        '<p>正确答案是：FIBONACCI（斯波那契数列）</p>',
        '<p>这个数列的规律是：F(n) = F(n-1) + F(n-2)</p>',
        '<p>前两项都是 1，后面每一项都是前两项之和。</p>',
        anchor('answer3_end'),
        '<hr>',

        '<h3>第四关答案</h3>',
        anchor('answer4_start'),
        '<p>正确答案是：1597</p>',
        '<p>根据斯波那契数列的规律，第 17 项的值为 1597。</p>',
        '<p>完整数列：1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597...</p>',
        anchor('answer4_end'),
        '<hr>'
    ].join('');
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
/**
 * 更新存储空间信息显示
 */
async function updateStorageInfo() {
    if (!storageInfoElement) return;
    storageInfoElement.textContent = '计算中...';
    storageInfoElement.className = 'storage-info calculating';
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const used = estimate.usage || 0;
            const quota = estimate.quota || 0;
            const available = quota - used;
            const usagePercent = quota > 0 ? (used / quota * 100) : 0;
            // 格式化显示
            const usedStr = formatStorageSize(used);
            const availableStr = formatStorageSize(available);
            const quotaStr = formatStorageSize(quota);
            storageInfoElement.textContent = `已用 ${usedStr} / 剩余 ${availableStr}`;
            storageInfoElement.title = `存储空间详情:
已使用: ${usedStr}
剩余: ${availableStr}
总配额: ${quotaStr}
使用率: ${usagePercent.toFixed(1)}%

左键刷新 | 右键清理孤立数据`;
            // 根据使用率设置样式
            storageInfoElement.classList.remove('calculating', 'warning', 'danger');
            if (usagePercent > 90) {
                storageInfoElement.classList.add('danger');
            } else if (usagePercent > 70) {
                storageInfoElement.classList.add('warning');
            }
        } else {
            storageInfoElement.textContent = '不支持';
            storageInfoElement.title = '浏览器不支持 Storage API';
            storageInfoElement.classList.remove('calculating');
        }
    } catch (err) {
        console.error('获取存储信息失败:', err);
        storageInfoElement.textContent = '获取失败';
        storageInfoElement.title = '获取存储信息失败: ' + err.message;
        storageInfoElement.classList.remove('calculating');
    }
}
// 点击刷新存储信息
if (storageInfoElement) {
    storageInfoElement.addEventListener('click', function() {
        updateStorageInfo();
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
            await updateStorageInfo();
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
updateStorageInfo();
// 定期更新存储信息（每30秒）
setInterval(updateStorageInfo, 30000);
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
