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
    if (btn.id === 'topLinkBtn') {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            await applyFormat('link');
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
            storageInfoElement.title = `存储空间详情:\n已使用: ${usedStr}\n剩余: ${availableStr}\n总配额: ${quotaStr}\n使用率: ${usagePercent.toFixed(1)}%\n\n左键刷新 | 右键清理孤立数据`;
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