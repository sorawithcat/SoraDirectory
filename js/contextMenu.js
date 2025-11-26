// ============================================
// 右键菜单模块 (contextMenu.js)
// 功能：目录区域的右键菜单功能
// 依赖：globals.js, directoryUtils.js, preview.js
// ============================================

/**
 * 显示右键菜单
 * @param {MouseEvent} e - 鼠标事件对象
 */
function rightMouseMenu(e) {
    // 先显示菜单（不可见状态）以获取尺寸
    rightmousemenu.style.display = "block";
    rightmousemenu.classList.remove("show");
    
    // 获取菜单尺寸和视窗尺寸
    const menuWidth = rightmousemenu.offsetWidth;
    const menuHeight = rightmousemenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 计算位置，确保菜单不超出视窗
    let posX = e.clientX;
    let posY = e.clientY;
    
    // 边界检测：如果菜单会超出右边，则向左显示
    if (posX + menuWidth > viewportWidth - 10) {
        posX = viewportWidth - menuWidth - 10;
    }
    
    // 边界检测：如果菜单会超出底部，则向上显示
    if (posY + menuHeight > viewportHeight - 10) {
        posY = viewportHeight - menuHeight - 10;
    }
    
    // 确保不会出现负值
    posX = Math.max(10, posX);
    posY = Math.max(10, posY);
    
    rightmousemenu.style.left = `${posX}px`;
    rightmousemenu.style.top = `${posY}px`;
    
    // 延迟添加 show 类以触发动画
    requestAnimationFrame(() => {
        rightmousemenu.classList.add("show");
    });
}

// 点击页面其他区域时隐藏菜单
document.addEventListener('click', function (e) {
    // 如果点击的是菜单本身，不处理
    if (rightmousemenu.contains(e.target)) return;
    hideRightMouseMenu();
});

/**
 * 隐藏右键菜单（带动画）
 */
function hideRightMouseMenu() {
    rightmousemenu.classList.remove("show");
    // 等待动画完成后隐藏
    setTimeout(() => {
        if (!rightmousemenu.classList.contains("show")) {
            rightmousemenu.style.display = "none";
        }
    }, 150);
}

// 右键菜单 - 取消
noneRightMouseMenu.addEventListener("click", function () {
    hideRightMouseMenu();
});

// 右键菜单 - 删除目录（包含所有子目录）
deleteMulu.addEventListener("click", function () {
    customConfirm("是否删除此目录？").then(result => {
        if (!result) {
            hideRightMouseMenu();
            return;
        }
        
        let nowchild = document.getElementById(currentMuluName);
        if (!nowchild) {
            hideRightMouseMenu();
            return;
        }
        
        let currentDirId = nowchild.getAttribute("data-dir-id");
        
        /**
         * 递归删除所有子目录
         * @param {string} parentId - 父目录ID
         */
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
                
                // 从 mulufile 中删除子目录数据（只使用 dirId 查找，因为 dirId 是唯一的）
                for (let j = mulufile.length - 1; j >= 0; j--) {
                    let item = mulufile[j];
                    if (item.length === 4 && item[2] === childId) {
                        mulufile.splice(j, 1);
                        break;
                    }
                }
                
                // 删除 DOM 元素
                child.remove();
            }
        }
        
        // 开始递归删除
        if (currentDirId) {
            deleteAllChildren(currentDirId);
        }
        
        // 从 mulufile 中删除当前目录数据（只使用 dirId 查找，因为 dirId 是唯一的）
        for (let i = mulufile.length - 1; i >= 0; i--) {
            let item = mulufile[i];
            if (item.length === 4 && item[2] === currentDirId) {
                mulufile.splice(i, 1);
                break;
            }
        }
        
        // 删除 DOM 元素
        nowchild.remove();
        
        // 重建索引缓存
        rebuildMulufileIndex();
        
        // 重置状态
        currentMuluName = null;
        jiedianwords.value = "";
        isUpdating = true;
        updateMarkdownPreview();
        isUpdating = false;
        
        // 更新 UI
        DuplicateMuluHints();
        hideRightMouseMenu();
    });
});

// 右键菜单 - 展开此目录（递归展开当前目录及其所有子目录）
expandThisMulu.addEventListener("click", function () {
    if (!currentMuluName) {
        hideRightMouseMenu();
        return;
    }
    
    let currentMulu = document.getElementById(currentMuluName);
    if (!currentMulu) {
        hideRightMouseMenu();
        return;
    }
    
    /**
     * 递归展开目录及其所有子目录
     * @param {HTMLElement} mulu - 目录元素
     */
    function expandRecursively(mulu) {
        if (mulu.classList.contains("has-children")) {
            mulu.classList.add("expanded");
            let dirId = mulu.getAttribute("data-dir-id");
            if (dirId) {
                toggleChildDirectories(dirId, true);
                // 递归展开子目录
                let children = findChildElementsByParentId(dirId);
                for (let child of children) {
                    expandRecursively(child);
                }
            }
        }
    }
    
    expandRecursively(currentMulu);
    hideRightMouseMenu();
});

// 右键菜单 - 收起此目录（递归收起当前目录及其所有子目录）
collapseThisMulu.addEventListener("click", function () {
    if (!currentMuluName) {
        hideRightMouseMenu();
        return;
    }
    
    let currentMulu = document.getElementById(currentMuluName);
    if (!currentMulu) {
        hideRightMouseMenu();
        return;
    }
    
    /**
     * 递归收起目录及其所有子目录
     * @param {HTMLElement} mulu - 目录元素
     */
    function collapseRecursively(mulu) {
        if (mulu.classList.contains("has-children")) {
            mulu.classList.remove("expanded");
            let dirId = mulu.getAttribute("data-dir-id");
            if (dirId) {
                toggleChildDirectories(dirId, false);
                // 递归收起子目录
                let children = findChildElementsByParentId(dirId);
                for (let child of children) {
                    collapseRecursively(child);
                }
            }
        }
    }
    
    collapseRecursively(currentMulu);
    hideRightMouseMenu();
});

/**
 * 展开所有目录（供工具栏按钮使用）
 */
function expandAllDirectories() {
    let allMulus = document.querySelectorAll(".mulu.has-children");
    for (let i = 0; i < allMulus.length; i++) {
        let mulu = allMulus[i];
        mulu.classList.add("expanded");
        let dirId = mulu.getAttribute("data-dir-id");
        if (dirId) {
            toggleChildDirectories(dirId, true);
        }
    }
}

/**
 * 收起所有目录（供工具栏按钮使用）
 */
function collapseAllDirectories() {
    let allMulus = document.querySelectorAll(".mulu.has-children");
    for (let i = 0; i < allMulus.length; i++) {
        let mulu = allMulus[i];
        mulu.classList.remove("expanded");
        let dirId = mulu.getAttribute("data-dir-id");
        if (dirId) {
            toggleChildDirectories(dirId, false);
        }
    }
}
