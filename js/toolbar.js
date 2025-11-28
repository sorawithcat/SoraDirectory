// ============================================
// 工具栏模块 (toolbar.js)
// 功能：顶部工具栏的所有按钮事件处理
// 依赖：globals.js, fileOperations.js, directoryCore.js, formatToolbar.js
// ============================================

// -------------------- 工具栏高度自适应 --------------------

/**
 * 更新工具栏高度，动态调整其他元素位置
 */
function updateToolbarHeight() {
    if (topToolbar) {
        const toolbarHeight = topToolbar.offsetHeight;
        document.documentElement.style.setProperty('--toolbar-height', toolbarHeight + 'px');
        
        // 更新内容区域位置和高度
        if (wordsbox) {
            const availableHeight = window.innerHeight - toolbarHeight;
            wordsbox.style.top = `${toolbarHeight}px`;
            wordsbox.style.height = `${availableHeight}px`;
            
            const markdownContainer = wordsbox.querySelector('.markdown-editor-container');
            if (markdownContainer) markdownContainer.style.height = '100%';
            
            const preview = wordsbox.querySelector('.markdown-preview');
            if (preview) preview.style.height = '100%';
        }
        
        // 更新目录区域位置和高度
        const bigbox = document.querySelector('.bigbox');
        if (bigbox) {
            bigbox.style.top = `${toolbarHeight}px`;
            bigbox.style.height = `${window.innerHeight - toolbarHeight}px`;
        }
    }
}

// 初始化工具栏高度
if (topToolbar) {
    // 立即更新
    requestAnimationFrame(function() {
        updateToolbarHeight();
        setTimeout(updateToolbarHeight, 0);
    });
    
    // 页面加载完成后更新
    window.addEventListener('load', updateToolbarHeight);
    
    // DOMContentLoaded 时更新
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateToolbarHeight);
    } else {
        updateToolbarHeight();
    }
    
    // 窗口大小改变时更新
    window.addEventListener('resize', updateToolbarHeight);
    
    // 监听工具栏内容变化
    const observer = new MutationObserver(updateToolbarHeight);
    observer.observe(topToolbar, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
}

// -------------------- 文件操作按钮 --------------------

// 保存按钮
if (topSaveBtn) {
    topSaveBtn.addEventListener("click", function() {
        handleSave();
    });
}

// 加载按钮
if (topLoadBtn) {
    // 创建隐藏的文件输入（降级方案）
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.txt,.xml,.csv,.encrypted.json';  // 支持加密文件
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    topLoadBtn.addEventListener("click", async function() {
        // 优先使用 File System Access API
        if (typeof isFileSystemAccessSupported === 'function' && isFileSystemAccessSupported()) {
            const opened = await openFileWithFSAPI();
            if (opened) return;
            // 用户取消或失败，不做任何事
            return;
        }
        
        // 降级：使用传统文件选择器
        fileInput.click();
    });
    
    // 传统文件选择处理（降级方案）
    fileInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileName = file.name;
        const reader = new FileReader();
        
        reader.onload = async function() {
            try {
                // 先检查缓存（仅对非加密文件使用缓存）
                let parsedData = null;
                let fromCache = false;
                
                // 检查是否是加密文件
                const isEncrypted = isEncryptedContent(reader.result);
                
                if (!isEncrypted && typeof FileCache !== 'undefined') {
                    // 尝试从缓存获取
                    parsedData = await FileCache.get(file);
                    if (parsedData) {
                        fromCache = true;
                        console.log('FileCache: 从缓存加载文件', fileName);
                    }
                }
                
                // 如果缓存中没有，则解析文件内容
                if (!parsedData) {
                    // parseFileContent 可能返回 Promise（加密文件）
                    parsedData = parseFileContent(reader.result, fileName);
                    if (parsedData instanceof Promise) {
                        parsedData = await parsedData;
                    }
                    
                    if (!parsedData) {
                        // 用户取消解密
                        fileInput.value = '';
                        return;
                    }
                    
                    // 将解析结果保存到缓存（仅对非加密文件）
                    if (!isEncrypted && typeof FileCache !== 'undefined' && Array.isArray(parsedData)) {
                        try {
                            await FileCache.set(file, parsedData);
                            console.log('FileCache: 已缓存文件', fileName);
                        } catch (err) {
                            console.warn('FileCache: 缓存保存失败', err);
                        }
                    }
                }
                
                // 检查是否是差异补丁文件
                if (typeof isDiffFile === 'function' && isDiffFile(parsedData)) {
                    // 差异文件必须有现有数据才能应用
                    if (!mulufile || mulufile.length === 0) {
                        customAlert("差异补丁文件需要先加载基础数据才能应用");
                        fileInput.value = '';
                        return;
                    }
                    
                    const result = applyDiffPatches(parsedData);
                    
                    // 重新加载目录
                    LoadMulu();
                    
                    // 标记有未保存更改
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
                
                // 验证数据格式（必须是数组）
                if (!Array.isArray(parsedData) || parsedData.length === 0) {
                    customAlert("文件格式错误：无法解析为有效的目录数据");
                    fileInput.value = '';
                    return;
                }
                
                // 检查是否是增量文件（第一个目录的父级不是 'mulu'）
                const isIncremental = parsedData[0].length >= 4 && parsedData[0][0] !== "mulu";
                
                // 如果当前有数据，询问是替换还是合并
                let loadMode = 'replace';
                if (mulufile && mulufile.length > 0) {
                    const modeOptions = [
                        { value: 'replace', label: '替换 - 清空现有数据，加载新文件' },
                        { value: 'merge', label: '合并 - 将新数据合并到现有数据' }
                    ];
                    
                    // 如果是增量文件，默认选择合并
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
                    // 合并模式
                    const mergeResult = mergeDirectoryData(mulufile, parsedData);
                    mulufile = mergeResult.data;
                    
                    // 重建索引
                    rebuildMulufileIndex();
                    
                    // 重新加载目录
                    LoadMulu();
                    
                    // 标记有未保存更改
                    if (typeof markUnsavedChanges === 'function') {
                        markUnsavedChanges();
                    }
                    
                    const cacheMsg = fromCache ? '（从缓存快速加载）' : '';
                    showToast(`已合并：新增 ${mergeResult.added} 个，更新 ${mergeResult.updated} 个目录${cacheMsg}`, 'success', 3000);
                } else {
                    // 替换模式 - 验证完整文件格式
                    if (parsedData[0].length < 4 || parsedData[0][0] !== "mulu") {
                        customAlert("文件格式错误：第一个目录必须以'mulu'开头，且每个目录数据必须包含4个元素\n\n如果这是增量文件，请选择【合并】模式加载");
                        fileInput.value = '';
                        return;
                    }
                    
                    mulufile = parsedData;
                    
                    // 清除文件句柄（传统方式无法获取句柄）
                    if (typeof currentFileHandle !== 'undefined') {
                        currentFileHandle = null;
                    }
                    if (typeof currentFileName !== 'undefined') {
                        currentFileName = fileName;
                    }
                    
                    // 加载目录
                    LoadMulu();
                    
                    // 计算初始哈希
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
                    // 展开所有目录
                    if (typeof expandAllDirectories === 'function') {
                        expandAllDirectories();
                    }
                    
                    // 选中第一个根目录
                    if (typeof selectFirstRootDirectory === 'function') {
                        selectFirstRootDirectory();
                    } else {
                        // 降级逻辑
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
                            
                            // 直接显示内容，不进行媒体数据的加载处理
                            // 媒体数据已经存储在IndexedDB中，只在需要时才加载
                            jiedianwords.value = loadedContent;
                            isUpdating = true;
                            updateMarkdownPreview();
                            isUpdating = false;
                        }
                    }
                }, 10);
                
                bigbox.style.display = "block";
                wordsbox.style.display = "block";
                
                // 更新文件名输入框（移除各种后缀）
                if (fileNameInput) {
                    let nameWithoutExt = fileName
                        .replace(/\s*\(\d+\)\s*\./g, '.')       // 移除浏览器添加的 (1), (2) 等
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

// -------------------- 目录操作按钮 --------------------

// 展开全部
if (expandAllBtn) {
    expandAllBtn.addEventListener("click", function() {
        if (typeof expandAllDirectories === 'function') {
            expandAllDirectories();
        }
    });
}

// 收起全部
if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", function() {
        if (typeof collapseAllDirectories === 'function') {
            collapseAllDirectories();
        }
    });
}

// -------------------- 视图操作按钮 --------------------

// 切换侧边栏
if (toggleSidebarBtn) {
    let sidebarVisible = true;
    
    toggleSidebarBtn.addEventListener("click", function() {
        sidebarVisible = !sidebarVisible;
        if (sidebarVisible) {
            bigbox.style.display = "block";
            wordsbox.style.left = "20%";
            wordsbox.style.width = "calc(100% - 20%)";
            toggleSidebarBtn.textContent = "隐藏侧边栏";
        } else {
            bigbox.style.display = "none";
            wordsbox.style.left = "0";
            wordsbox.style.width = "100%";
            toggleSidebarBtn.textContent = "显示侧边栏";
        }
    });
}

// 全屏功能
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
    
    // 监听全屏状态变化
    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement && fullscreenBtn) {
            fullscreenBtn.textContent = "全屏";
        }
    });
}

// 新建功能
if (newBtn) {
    newBtn.addEventListener("click", async function() {
        const result = await customConfirm("确定要新建吗？当前未保存的内容将丢失。\n\n注意：这将清空所有已存储的图片、视频和压缩文件！");
        if (result) {
            // 清空 IndexedDB 中的媒体数据
            if (typeof MediaStorage !== 'undefined' && MediaStorage.clearAll) {
                try {
                    await MediaStorage.clearAll();
                    console.log('已清空 IndexedDB 媒体存储');
                } catch (err) {
                    console.error('清空 IndexedDB 失败:', err);
                }
            }
            
            // 清空数据
            mulufile = [];
            currentMuluName = null;
            
            // 清空 DOM
            const firststep = document.querySelector(".firststep");
            if (firststep) firststep.innerHTML = "";
            
            if (jiedianwords) jiedianwords.value = "";
            if (markdownPreview) markdownPreview.innerHTML = "";
            
            // 重置文件名
            if (fileNameInput) fileNameInput.value = "soralist";
            
            // 更新存储空间信息（等待完成）
            if (typeof updateStorageInfo === 'function') {
                await updateStorageInfo();
            }
            
            customAlert("已新建，存储空间已清理");
        }
    });
}

// 另存为功能
if (saveAsBtn) {
    saveAsBtn.addEventListener("click", async function() {
        // 另存为格式选项
        const saveAsOptions = [
            { value: 'webpage', label: '网页 (.html) - 独立可浏览的网页' },
            { value: 'custom', label: '自定义文件名 - 手动输入文件名和格式' }
        ];
        
        // 显示格式选择对话框
        const saveType = await customSelect('选择另存为格式：', saveAsOptions, 'webpage', '另存为');
        
        if (saveType === null) {
            showToast('已取消保存', 'info', 2000);
            return;
        }
        
        if (saveType === 'webpage') {
            // 另存为网页，询问是否加密
            const encryptOptions = [
                { value: 'no', label: '不加密' },
                { value: 'yes', label: '加密网页（需要密码才能查看）' }
            ];
            const encrypt = await customSelect('是否加密？', encryptOptions, 'no', '导出网页');
            if (encrypt === null) {
                showToast('已取消', 'info', 2000);
                return;
            }
            
            // 导出网页（普通或加密）
            await handleSaveAsWebpage(encrypt === 'yes');
        } else if (saveType === 'custom') {
            // 自定义文件名，询问是否加密
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
            
            // 如果加密，调用加密保存
            if (password) {
                await handleSaveAsEncrypted(customName, password);
            } else {
                await handleSaveAs(customName);
            }
        }
    });
}

// -------------------- 格式按钮 --------------------

// 顶部工具栏格式按钮
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

// 顶部图片上传按钮
if (topImageUploadBtn) {
    topImageUploadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (imageFileInput) imageFileInput.click();
    });
}

// 顶部视频上传按钮
if (topVideoUploadBtn) {
    topVideoUploadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (videoFileInput) videoFileInput.click();
    });
}

// -------------------- 键盘快捷键 --------------------

document.addEventListener('keydown', function(e) {
    const isCtrl = e.ctrlKey || e.metaKey;
    
    if (isCtrl) {
        switch(e.key.toLowerCase()) {
            case 's':  // Ctrl+S 保存
                e.preventDefault();
                if (topSaveBtn) topSaveBtn.click();
                break;
            case 'b':  // Ctrl+B 粗体
                e.preventDefault();
                const boldBtn = document.querySelector('.format-toolbar-btn[data-command="bold"]');
                if (boldBtn) boldBtn.click();
                break;
            case 'i':  // Ctrl+I 斜体
                e.preventDefault();
                const italicBtn = document.querySelector('.format-toolbar-btn[data-command="italic"]');
                if (italicBtn) italicBtn.click();
                break;
            case 'u':  // Ctrl+U 下划线
                e.preventDefault();
                const underlineBtn = document.querySelector('.format-toolbar-btn[data-command="underline"]');
                if (underlineBtn) underlineBtn.click();
                break;
        }
    }
});

// -------------------- 存储空间信息显示 --------------------

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
    
    // 添加鼠标滚轮事件监听器
    formatToolbarScroll.addEventListener('wheel', function(e) {
        // 检查是否有横向滚动条（内容是否超出容器宽度）
        const hasHorizontalScroll = formatToolbarScroll.scrollWidth > formatToolbarScroll.clientWidth;
        
        if (hasHorizontalScroll) {
            // 如果鼠标悬停在格式工具栏上且有横向滚动条，则将垂直滚轮转换为横向滚动
            e.preventDefault();
            
            // 使用 deltaY（垂直滚动量）来控制横向滚动
            // 正数向下滚动 = 向右滚动，负数向上滚动 = 向左滚动
            formatToolbarScroll.scrollLeft += e.deltaY;
            
            // 也支持横向滚轮（deltaX）
            if (e.deltaX !== 0) {
                formatToolbarScroll.scrollLeft += e.deltaX;
            }
        }
        // 如果没有横向滚动条，不阻止默认行为，让页面正常滚动
    }, { passive: false });
}

// 初始化格式工具栏滚轮滚动功能
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormatToolbarWheelScroll);
} else {
    // DOM 已经加载完成，立即初始化
    initFormatToolbarWheelScroll();
}

// 如果格式工具栏是动态加载的，也在窗口加载完成后再次尝试初始化
window.addEventListener('load', function() {
    setTimeout(initFormatToolbarWheelScroll, 100);
});

// 导出函数供其他模块使用
window.updateStorageInfo = updateStorageInfo;
