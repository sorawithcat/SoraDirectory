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
    // 创建隐藏的文件输入
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.txt,.xml,.csv';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    topLoadBtn.addEventListener("click", function() {
        fileInput.click();
    });
    
    // 文件选择处理
    fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileName = file.name;
        const reader = new FileReader();
        
        reader.onload = function() {
            try {
                mulufile = parseFileContent(reader.result, fileName);
                
                // 验证数据格式
                if (!Array.isArray(mulufile) || mulufile.length === 0) {
                    customAlert("文件格式错误：无法解析为有效的目录数据");
                    return;
                }
                
                if (mulufile[0].length < 4 || mulufile[0][0] !== "mulu") {
                    customAlert("文件格式错误：第一个目录必须以'mulu'开头，且每个目录数据必须包含4个元素");
                    return;
                }
                
                // 加载目录
                LoadMulu();
                
                setTimeout(() => {
                    // 展开所有目录
                    if (typeof expandAllDirectories === 'function') {
                        expandAllDirectories();
                    }
                    
                    // 选中第一个根目录
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
                        jiedianwords.value = findMulufileData(firstRootMulu);
                        isUpdating = true;
                        updateMarkdownPreview();
                        isUpdating = false;
                    }
                }, 10);
                
                bigbox.style.display = "block";
                wordsbox.style.display = "block";
                
                // 更新文件名输入框
                if (fileNameInput) {
                    // 移除扩展名
                    let nameWithoutExt = fileName.replace(/\.(json|txt|xml|csv)$/i, '');
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
        const result = await customConfirm("确定要新建吗？当前未保存的内容将丢失。");
        if (result) {
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
            
            customAlert("已新建");
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
            // 另存为网页
            await handleSaveAsWebpage();
        } else if (saveType === 'custom') {
            // 自定义文件名
            let customName = await customPrompt("输入文件名（包含扩展名，如：mydata.json）", "");
            if (!customName) {
                showToast('已取消保存', 'info', 2000);
                return;
            }
            await handleSaveAs(customName);
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
