// ============================================
// 主初始化模块 (main.js)
// 功能：应用初始化、全局事件绑定
// 依赖：所有其他模块（需最后加载）
// ============================================

// 禁用默认右键菜单（编辑器区域显示自定义工具栏）
document.oncontextmenu = function (e) {
    if (e.target === markdownPreview || markdownPreview.contains(e.target)) {
        e.preventDefault();
        showTextFormatToolbar(e);
        return false;
    }
    return false;
};

// 页面关闭前提示（如果有未保存的更改）
window.addEventListener('beforeunload', function(e) {
    if (typeof hasUnsavedChanges !== 'undefined' && hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
        return e.returnValue;
    }
});

// Ctrl+S 快捷键保存
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (typeof handleSave === 'function') {
            handleSave();
        }
    }
});

// DOM 加载完成后初始化
function initOnDOMReady() {
    // 检查授权状态
    if (typeof LicenseUI !== 'undefined') {
        if (!LicenseSystem.isAuthorized()) {
            // 显示授权对话框，等待用户授权
            LicenseUI.showAuthDialog();
            
            // 创建授权成功后的初始化函数
            const initAfterAuth = async () => {
                await initializeApp();
            };
            
            // 监听授权状态变化
            const checkAuthInterval = setInterval(() => {
                if (LicenseSystem.isAuthorized()) {
                    clearInterval(checkAuthInterval);
                    initAfterAuth();
                }
            }, 500);
            
            return; // 等待授权
        }
    }
    
    // 已授权，直接初始化
    initializeApp();
}

// 如果DOM已经加载完成，立即初始化；否则等待DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initOnDOMReady);
} else {
    // DOM已经就绪，立即初始化
    initOnDOMReady();
}

// 应用初始化函数
async function initializeApp() {
    // 性能优化：将清空 IndexedDB 改为后台异步执行，不阻塞初始显示
    // 这样应用版的初始加载速度会更快，与网页版保持一致
    if (typeof MediaStorage !== 'undefined' && MediaStorage.clearAll) {
        // 使用 requestIdleCallback 或 setTimeout 在后台执行清空操作
        // 不等待完成，立即继续后续初始化
        const clearStorage = async () => {
            try {
                await MediaStorage.clearAll();
                // 更新存储信息显示
                if (typeof updateStorageInfo === 'function') {
                    await updateStorageInfo();
                }
            } catch (err) {
                console.warn('后台清理 IndexedDB 失败:', err);
            }
        };
        
        // 优先使用 requestIdleCallback（浏览器空闲时执行）
        // 降级方案：使用 setTimeout 延迟执行
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
                clearStorage();
            }, { timeout: 1000 });
        } else {
            setTimeout(clearStorage, 100);
        }
    }
    
    // 为所有元素生成唯一 ID
    for (let i = 0; i < allThins.length; i++) {
        allThins[i].id = getOneId(10, 0);
    }
    
    // 加载目录数据（只在有数据时执行）
    // 性能优化：如果 mulufile 为空或未定义，跳过加载
    if (typeof mulufile !== 'undefined' && Array.isArray(mulufile) && mulufile.length > 0) {
        LoadMulu();
    }
    
    // 性能优化：将计算哈希改为延迟执行，不阻塞初始显示
    // 哈希计算用于变化追踪，不是显示内容所必需的
    if (typeof calculateAllHashes === 'function') {
        // 使用 requestIdleCallback 或 setTimeout 延迟执行
        const calculateHashes = () => {
            calculateAllHashes();
        };
        
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(calculateHashes, { timeout: 500 });
        } else {
            setTimeout(calculateHashes, 50);
        }
    }
    
    // 显示 File System Access API 支持情况（延迟执行，不阻塞显示）
    if (typeof isFileSystemAccessSupported === 'function') {
        setTimeout(() => {
            if (isFileSystemAccessSupported()) {
                // File System Access API 已启用
            } else {
                // File System Access API 不可用，将使用传统下载方式
                // 更新加载按钮提示
                if (topLoadBtn) {
                    topLoadBtn.title = '加载文件（不支持直接保存）';
                }
            }
        }, 0);
    }
    
    // 立即显示内容，不等待其他操作
    // 使用 requestAnimationFrame 确保在下一帧渲染
    // 只在有目录数据时才执行
    if (typeof mulufile !== 'undefined' && Array.isArray(mulufile) && mulufile.length > 0) {
        requestAnimationFrame(() => {
            // 展开所有目录
            if (typeof expandAllDirectories === 'function') {
                expandAllDirectories();
            }
            
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
        });
    }
}
