// ============================================
// contextMenu 模块 (contextMenu.js)
// ============================================

//显示右键菜单
function rightMouseMenu(e) {
    rightmousemenu.style.display = "block";
    rightmousemenu.style.left = `${e.clientX}px`;
    rightmousemenu.style.top = `${e.clientY}px`;
}
//失去焦点后隐藏
document.addEventListener('click', function () {
    noneRightMouseMenu.click();

})

//右键-取消
noneRightMouseMenu.addEventListener("click", function () {
    rightmousemenu.style.display = "none";
})

//右键-删除 - 基于data属性
deleteMulu.addEventListener("click", function () {
    customConfirm("是否删除此目录？").then(result => {
        if (!result) {
            noneRightMouseMenu.click();
            return;
        }
        let nowchild = document.getElementById(currentMuluName);
        if (!nowchild) {
            noneRightMouseMenu.click();
            return;
        }
        
        let currentDirId = nowchild.getAttribute("data-dir-id");
        
        // 递归删除所有子目录
        function deleteAllChildren(parentId) {
            if (!parentId) return;
            let children = findChildElementsByParentId(parentId);
            
            for (let i = children.length - 1; i >= 0; i--) {
                let child = children[i];
                if (child === nowchild) continue;
                
                let childId = child.getAttribute("data-dir-id");
                
                // 先递归删除子目录的子目录
                if (childId) {
                    deleteAllChildren(childId);
                }
                
                // 从mulufile中删除子目录数据
                let childName = child.innerHTML;
                for (let j = mulufile.length - 1; j >= 0; j--) {
                    let item = mulufile[j];
                    if (item.length === 4 && item[2] === childId && item[1] === childName) {
                        mulufile.splice(j, 1);
                        break;
                    }
                }
                
                // 删除DOM元素
                child.remove();
            }
        }
        
        // 开始递归删除
        if (currentDirId) {
            deleteAllChildren(currentDirId);
        }
        
        // 从mulufile中删除当前目录数据
        let currentName = nowchild.innerHTML;
        for (let i = mulufile.length - 1; i >= 0; i--) {
            let item = mulufile[i];
            if (item.length === 4 && item[2] === currentDirId && item[1] === currentName) {
                mulufile.splice(i, 1);
                break;
            }
        }
        
        // 删除DOM元素
        nowchild.remove();
        
        // 重置状态
        currentMuluName = null;
        jiedianwords.value = "";
        isUpdating = true;
        updateMarkdownPreview();
        isUpdating = false;
        
        // 更新UI
        AddListStyleForFolder();
        DuplicateMuluHints();
        noneRightMouseMenu.click();
    });
})


//右键-展开目录
showAllMulu.addEventListener("click", function () {
    let allMulus = document.querySelectorAll(".mulu.has-children");
    for (let i = 0; i < allMulus.length; i++) {
        let mulu = allMulus[i];
        mulu.classList.add("expanded");
        let dirId = mulu.getAttribute("data-dir-id");
        if (dirId) {
            toggleChildDirectories(dirId, true);
        }
    }
})

//右键-收起目录
cutAllMulu.addEventListener("click", function () {
    let allMulus = document.querySelectorAll(".mulu.has-children");
    for (let i = 0; i < allMulus.length; i++) {
        let mulu = allMulus[i];
        mulu.classList.remove("expanded");
        let dirId = mulu.getAttribute("data-dir-id");
        if (dirId) {
            toggleChildDirectories(dirId, false);
        }
    }
})
