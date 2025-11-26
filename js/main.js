// ============================================
// 主初始化模块 (main.js)
// 功能：初始化应用，绑定事件监听器
// ============================================

// 去除默认事件（但允许在编辑器中使用右键菜单）
document.oncontextmenu = function (e) {
    // 如果是在预览区域，显示格式工具栏
    if (e.target === markdownPreview || markdownPreview.contains(e.target)) {
        e.preventDefault();
        showTextFormatToolbar(e);
        return false;
    }
    return false;
}

// 初始化文件夹样式（在DOM加载后）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        AddListStyleForFolder();
    });
} else {
    AddListStyleForFolder();
}

// 加载所有元素后执行
document.addEventListener("DOMContentLoaded", function () {
    // 给所有body里的东西添加id
    for (let i = 0; i < allThins.length; i++) {
        allThins[i].id = getOneId(10, 0);
    }
    LoadMulu();
    // 延迟执行，确保所有目录都已创建
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
    }, 10);
})

