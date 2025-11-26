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

// 初始化文件夹样式
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        AddListStyleForFolder();
    });
} else {
    AddListStyleForFolder();
}

// DOM 加载完成后初始化
document.addEventListener("DOMContentLoaded", function () {
    // 为所有元素生成唯一 ID
    for (let i = 0; i < allThins.length; i++) {
        allThins[i].id = getOneId(10, 0);
    }
    
    // 加载目录数据
    LoadMulu();
    
    // 延迟执行初始化（确保 DOM 完全渲染）
    setTimeout(() => {
        // 展开所有带有子目录的目录
        let allMulus = document.querySelectorAll(".mulu.has-children");
        for (let i = 0; i < allMulus.length; i++) {
            let mulu = allMulus[i];
            let dirId = mulu.getAttribute("data-dir-id");
            if (dirId && mulu.classList.contains("expanded")) {
                toggleChildDirectories(dirId, true);
            }
        }
        
        // 初始收起所有目录
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
    }, 10);
});
