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
document.addEventListener("DOMContentLoaded", async function () {
    // 刷新页面时清理所有媒体数据
    if (typeof MediaStorage !== 'undefined' && MediaStorage.clearAll) {
        await MediaStorage.clearAll();
        // 更新存储信息显示
        if (typeof updateStorageInfo === 'function') {
            await updateStorageInfo();
        }
    }
    
    // 为所有元素生成唯一 ID
    for (let i = 0; i < allThins.length; i++) {
        allThins[i].id = getOneId(10, 0);
    }
    
    // 加载目录数据
    LoadMulu();
    
    // 计算初始哈希（用于变化追踪）
    if (typeof calculateAllHashes === 'function') {
        calculateAllHashes();
    }
    
    // 显示 File System Access API 支持情况
    if (typeof isFileSystemAccessSupported === 'function') {
        if (isFileSystemAccessSupported()) {
            console.log('✓ File System Access API 已启用：支持直接保存到文件');
        } else {
            console.log('✗ File System Access API 不可用：将使用传统下载方式');
            // 更新加载按钮提示
            if (topLoadBtn) {
                topLoadBtn.title = '加载文件（不支持直接保存）';
            }
        }
    }
    
    // 延迟执行初始化（确保 DOM 完全渲染）
    setTimeout(() => {
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
    }, 10);
});
