// ============================================
// toolbar 模块 (toolbar.js)
// ============================================

// 更新工具栏高度（动态调整其他元素位置）
function updateToolbarHeight() {
    if (topToolbar) {
        const toolbarHeight = topToolbar.offsetHeight;
        document.documentElement.style.setProperty('--toolbar-height', toolbarHeight + 'px');
        
        // 直接更新wordsbox的位置和高度，确保立即生效
        if (wordsbox) {
            const availableHeight = window.innerHeight - toolbarHeight;
            wordsbox.style.top = `${toolbarHeight}px`;
            wordsbox.style.height = `${availableHeight}px`;
            
            // 确保内部容器高度正确
            const markdownContainer = wordsbox.querySelector('.markdown-editor-container');
            if (markdownContainer) {
                markdownContainer.style.height = '100%';
            }
            const markdownPreview = wordsbox.querySelector('.markdown-preview');
            if (markdownPreview) {
                markdownPreview.style.height = '100%';
            }
        }
        
        // 同时更新bigbox的位置和高度
        const bigbox = document.querySelector('.bigbox');
        if (bigbox) {
            bigbox.style.top = `${toolbarHeight}px`;
            bigbox.style.height = `${window.innerHeight - toolbarHeight}px`;
        }
    }
}

// 初始化时更新高度（立即执行，确保初始高度正确）
if (topToolbar) {
    // 立即更新一次（使用requestAnimationFrame确保DOM已渲染）
    requestAnimationFrame(function() {
        updateToolbarHeight();
        // 再延迟一次确保完全渲染
        setTimeout(updateToolbarHeight, 0);
    });
    
    // 页面加载完成后更新
    window.addEventListener('load', function() {
        updateToolbarHeight();
    });
    
    // DOMContentLoaded时也更新
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            updateToolbarHeight();
        });
    } else {
        // 如果已经加载完成，立即更新
        updateToolbarHeight();
    }
    
    // 窗口大小改变时更新
    window.addEventListener('resize', function() {
        updateToolbarHeight();
    });
    
    // 使用MutationObserver监听工具栏内容变化
    const observer = new MutationObserver(function() {
        updateToolbarHeight();
    });
    observer.observe(topToolbar, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
}

// 顶部工具栏按钮事件处理
// 保存功能
if (topSaveBtn) {
    topSaveBtn.addEventListener("click", function() {
        // 直接调用保存功能（保存功能代码在下面）
        handleSave();
    });
}

// 加载功能
if (topLoadBtn) {
    // 创建隐藏的文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.txt,.xml,.csv';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    topLoadBtn.addEventListener("click", function() {
        fileInput.click();
    });
    
    // 处理文件选择
    fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileName = file.name;
        const reader = new FileReader();
        
        reader.onload = function() {
            const fileContent = reader.result;
            
            try {
                // 解析文件内容
                mulufile = parseFileContent(fileContent, fileName);
                
                // 验证数据格式
                if (!Array.isArray(mulufile) || mulufile.length === 0) {
                    customAlert("文件格式错误：无法解析为有效的目录数据");
                    return;
                }
                
                // 验证第一个目录
                if (mulufile[0].length < 4 || mulufile[0][0] !== "mulu") {
                    customAlert("文件格式错误：第一个目录必须以'mulu'开头，且每个目录数据必须包含4个元素");
                    return;
                }
                
                LoadMulu();
                // 延迟执行，确保所有目录都已创建并设置好data属性
                setTimeout(() => {
                    // 初始化所有有子目录的目录，展开它们
                    let allMulus = document.querySelectorAll(".mulu.has-children");
                    for (let i = 0; i < allMulus.length; i++) {
                        let mulu = allMulus[i];
                        let dirId = mulu.getAttribute("data-dir-id");
                        if (dirId && mulu.classList.contains("expanded")) {
                            toggleChildDirectories(dirId, true);
                        }
                    }
                    NoneChildMulu();
                    
                    // 默认选中第一个根目录
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
                        // 显示第一个目录的内容
                        jiedianwords.value = findMulufileData(firstRootMulu);
                        isUpdating = true;
                        updateMarkdownPreview();
                        isUpdating = false;
                    }
                    
                    AddListStyleForFolder();
                }, 10);
                
                bigbox.style.display = "block";
                wordsbox.style.display = "block";
            } catch (error) {
                console.error("文件加载错误:", error);
                customAlert("文件加载失败：" + error.message);
            }
            
            // 重置文件输入，以便可以再次选择同一个文件
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
        if (showAllMulu) showAllMulu.click();
    });
}

if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", function() {
        if (cutAllMulu) cutAllMulu.click();
    });
}

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
    newBtn.addEventListener("click", function() {
        if (confirm("确定要新建吗？当前未保存的内容将丢失。")) {
            // 清空目录
            const firststep = document.querySelector(".firststep");
            if (firststep) {
                firststep.innerHTML = "";
            }
            // 清空内容
            if (jiedianwords) {
                jiedianwords.value = "";
            }
            if (markdownPreview) {
                markdownPreview.innerHTML = "";
            }
            customAlert("已新建");
        }
    });
}

// 另存为功能
if (saveAsBtn) {
    saveAsBtn.addEventListener("click", async function() {
        // 另存为总是提示输入文件名
        let customName = await customPrompt("输入文件名（包含扩展名，如：mydata.json）", "");
        if (!customName) {
            customAlert("已取消保存");
            return;
        }
        // 调用保存功能，但使用自定义文件名
        await handleSaveAs(customName);
    });
}


// 顶部工具栏格式按钮事件处理
document.querySelectorAll('.format-toolbar-btn').forEach(btn => {
    if (btn.id === 'topLinkBtn') {
        // 链接按钮单独处理（已在 formatToolbar.js 中处理）
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            await applyFormat('link');
        });
    } else {
        // 其他格式按钮
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const command = this.getAttribute('data-command');
            if (command) {
                applyFormat(command);
            }
        });
    }
});

// 顶部图片上传按钮
if (topImageUploadBtn) {
    topImageUploadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (imageFileInput) {
            imageFileInput.click();
        }
    });
}

// 键盘快捷键支持
document.addEventListener('keydown', function(e) {
    // 检查是否按下了Ctrl键（Windows/Linux）或Cmd键（Mac）
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
