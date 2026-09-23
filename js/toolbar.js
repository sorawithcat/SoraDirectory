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
                    if (typeof DraftManager !== 'undefined') await DraftManager.beforeSwitch();
                    mulufile = parsedData;
                    soraDocumentEncrypted = isEncrypted;
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
                if (loadMode === 'replace' && typeof DraftManager !== 'undefined') await DraftManager.resetAfterLoad(file.lastModified);
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
        const result = await customConfirm('新建空白文档？当前内容会保留为草稿，已存储的媒体不会清除。', '新建文档', '取消');
        if (result) {
            try { await DraftManager.beforeSwitch(); }
            catch (error) { await customAlert(error.message, '无法新建'); return; }
            mulufile = [];
            if (typeof rebuildMulufileIndex === 'function') rebuildMulufileIndex();
            if (window.DirectoryMetadata) window.DirectoryMetadata.reset();
            if (window.SoraDocumentIdentity) window.SoraDocumentIdentity.newDocument('soralist');
            soraDocumentEncrypted = false;
            window.__soraMediaImportError = null;
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
            showToast('已新建文档，原文档草稿和媒体已保留', 'success');
        }
    });
}
if (saveAsBtn) {
    saveAsBtn.addEventListener('click', () => SoraSaveWorkflow.openExport());
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
        showToast('已将说明插入作品', 'success', 2000);
    }
}

async function insertHelpManual() {
    if (!await customConfirm('这会把使用说明作为目录加入当前作品，并进入之后的保存和导出内容。', '插入说明', '取消')) return;
    FeatureDialog.close();
    DirectoryHistory.record('插入使用说明');
    await loadHelpManual({ force: true });
    markUnsavedChanges();
}

if (typeof helpBtn !== 'undefined' && helpBtn) {
    helpBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const mode = await customSelect('请选择使用说明的打开方式：', [
            { value: 'dialog', label: '弹窗查看（不修改作品）' },
            { value: 'insert', label: '插入当前作品（参与保存和导出）' }
        ], 'dialog', '使用说明');
        if (mode === 'dialog') openHelpManual();
        else if (mode === 'insert') await insertHelpManual();
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
        try {
            const protectedIds = await DraftManager.protectedMediaIds();
            const candidates = (await MediaStorage.getAllMediaIds()).filter(id => !String(id).includes('_chunk_') && !protectedIds.has(id));
            let bytes = 0;
            for (const id of candidates) bytes += Number((await MediaStorage.getMediaInfo(id))?.size) || 0;
            const confirmed = await customConfirm(`清理 ${candidates.length} 个未被引用的媒体？预计释放 ${formatStorageSize(bytes)}。\n\n文档、草稿、快照和撤销记录中的媒体会保留。`, '清理媒体', '取消');
            if (!confirmed) return;
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
