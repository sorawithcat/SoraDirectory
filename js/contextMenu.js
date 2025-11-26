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
    // 更新粘贴按钮状态
    if (directoryClipboard && directoryClipboard.data) {
        pasteMulu.classList.remove("disabled");
    } else {
        pasteMulu.classList.add("disabled");
    }
    
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

// -------------------- 复制粘贴功能 --------------------

/**
 * 复制目录数据（递归获取子目录）
 * @param {string} dirId - 目录 ID
 * @param {boolean} includeChildren - 是否包含子目录
 * @returns {Object} - 复制的目录数据结构
 */
function copyDirectoryData(dirId, includeChildren) {
    const muluData = getMulufileByDirId(dirId);
    if (!muluData) return null;
    
    const copied = {
        name: muluData[1],
        content: muluData[3],
        children: []
    };
    
    if (includeChildren) {
        // 查找所有子目录
        const children = findChildElementsByParentId(dirId);
        for (const child of children) {
            const childDirId = child.getAttribute("data-dir-id");
            if (childDirId) {
                const childData = copyDirectoryData(childDirId, true);
                if (childData) {
                    copied.children.push(childData);
                }
            }
        }
    }
    
    return copied;
}

/**
 * 粘贴目录数据（递归创建子目录）
 * @param {Object} data - 复制的目录数据
 * @param {string} parentDirId - 父目录 ID
 * @param {HTMLElement} insertAfterRef - 可选，插入到此元素（及其子目录）之后
 * @returns {HTMLElement} - 创建的目录元素
 */
function pasteDirectoryData(data, parentDirId, insertAfterRef = null) {
    // 生成新的唯一 ID
    const newDirId = getOneId(10, 0);
    const newDomId = getOneId(10, 0);
    
    // 创建目录元素
    const newMulu = document.createElement("div");
    newMulu.classList.add("mulu");
    newMulu.id = newDomId;
    newMulu.setAttribute("data-dir-id", newDirId);
    newMulu.setAttribute("data-parent-id", parentDirId);
    newMulu.textContent = data.name;
    
    // 判断是否为根目录级别
    const isRootLevel = !parentDirId || parentDirId === "mulu";
    
    // 计算层级
    let level = 0;
    let parentElement = null;
    
    if (!isRootLevel) {
        parentElement = document.querySelector(`[data-dir-id="${parentDirId}"]`);
        if (parentElement) {
            level = parseInt(parentElement.getAttribute("data-level") || "0") + 1;
        }
    }
    
    newMulu.setAttribute("data-level", level);
    newMulu.style.paddingLeft = `${20 + level * 20}px`;
    
    // 添加到数据数组
    mulufile.push([parentDirId, data.name, newDirId, data.content]);
    mulufileIndex.set(newDirId, mulufile.length - 1);
    
    // 找到插入位置
    let insertAfter = null;
    
    if (insertAfterRef) {
        // 有指定参考元素：插入到该元素（及其所有子目录）之后
        const refDirId = insertAfterRef.getAttribute("data-dir-id");
        if (refDirId) {
            const descendants = findAllDescendants(refDirId);
            if (descendants.length > 0) {
                insertAfter = descendants[descendants.length - 1];
            } else {
                insertAfter = insertAfterRef;
            }
        } else {
            insertAfter = insertAfterRef;
        }
    } else if (isRootLevel) {
        // 根目录级别：找到所有根目录中最后一个（包括其子目录）
        const allRootMulus = document.querySelectorAll('.mulu[data-parent-id="mulu"], .mulu:not([data-parent-id])');
        if (allRootMulus.length > 0) {
            const lastRoot = allRootMulus[allRootMulus.length - 1];
            const lastRootDirId = lastRoot.getAttribute("data-dir-id");
            if (lastRootDirId) {
                const descendants = findAllDescendants(lastRootDirId);
                if (descendants.length > 0) {
                    insertAfter = descendants[descendants.length - 1];
                } else {
                    insertAfter = lastRoot;
                }
            } else {
                insertAfter = lastRoot;
            }
        }
    } else if (parentElement) {
        // 非根目录：找到父目录的所有后代中最后一个
        const allChildren = findAllDescendants(parentDirId);
        if (allChildren.length > 0) {
            insertAfter = allChildren[allChildren.length - 1];
        } else {
            insertAfter = parentElement;
        }
    }
    
    // 插入到 DOM
    if (insertAfter && insertAfter.nextSibling) {
        insertAfter.parentNode.insertBefore(newMulu, insertAfter.nextSibling);
    } else if (insertAfter) {
        insertAfter.parentNode.appendChild(newMulu);
    } else {
        // 插入到目录区域末尾
        mulu.appendChild(newMulu);
    }
    
    // 设置背景色
    setParentColorBall(newMulu);
    
    // 绑定事件
    bindMuluEvents(newMulu);
    
    // 递归创建子目录
    if (data.children && data.children.length > 0) {
        newMulu.classList.add("has-children", "expanded");
        for (const childData of data.children) {
            pasteDirectoryData(childData, newDirId);
        }
    }
    
    // 更新父目录的 has-children 状态（仅非根目录）
    if (parentElement && !parentElement.classList.contains("has-children")) {
        parentElement.classList.add("has-children", "expanded");
    }
    
    return newMulu;
}

/**
 * 查找目录的所有后代元素
 * @param {string} parentDirId - 父目录 ID
 * @returns {Array} - 所有后代元素数组
 */
function findAllDescendants(parentDirId) {
    const result = [];
    const children = findChildElementsByParentId(parentDirId);
    
    for (const child of children) {
        result.push(child);
        const childDirId = child.getAttribute("data-dir-id");
        if (childDirId) {
            const descendants = findAllDescendants(childDirId);
            result.push(...descendants);
        }
    }
    
    return result;
}

// 右键菜单 - 复制目录（含子目录）
copyMuluWithChildren.addEventListener("click", function() {
    if (!currentMuluName) {
        hideRightMouseMenu();
        return;
    }
    
    const currentMulu = document.getElementById(currentMuluName);
    if (!currentMulu) {
        hideRightMouseMenu();
        return;
    }
    
    const dirId = currentMulu.getAttribute("data-dir-id");
    if (!dirId) {
        hideRightMouseMenu();
        return;
    }
    
    directoryClipboard = {
        data: copyDirectoryData(dirId, true),
        includeChildren: true
    };
    
    showToast("已复制目录（含子目录）", "success", 2000);
    hideRightMouseMenu();
});

// 右键菜单 - 复制目录（不含子目录）
copyMuluWithoutChildren.addEventListener("click", function() {
    if (!currentMuluName) {
        hideRightMouseMenu();
        return;
    }
    
    const currentMulu = document.getElementById(currentMuluName);
    if (!currentMulu) {
        hideRightMouseMenu();
        return;
    }
    
    const dirId = currentMulu.getAttribute("data-dir-id");
    if (!dirId) {
        hideRightMouseMenu();
        return;
    }
    
    directoryClipboard = {
        data: copyDirectoryData(dirId, false),
        includeChildren: false
    };
    
    showToast("已复制目录（不含子目录）", "success", 2000);
    hideRightMouseMenu();
});

// 右键菜单 - 粘贴目录
pasteMulu.addEventListener("click", function() {
    // 检查禁用状态
    if (pasteMulu.classList.contains("disabled")) {
        return;
    }
    
    if (!directoryClipboard || !directoryClipboard.data) {
        showToast("剪贴板为空，请先复制目录", "warning", 2000);
        hideRightMouseMenu();
        return;
    }
    
    if (!currentMuluName) {
        hideRightMouseMenu();
        return;
    }
    
    const currentMulu = document.getElementById(currentMuluName);
    if (!currentMulu) {
        hideRightMouseMenu();
        return;
    }
    
    // 获取当前目录的父目录 ID（粘贴到同级）
    const parentDirId = currentMulu.getAttribute("data-parent-id") || "mulu";
    
    // 粘贴目录到当前目录之后
    const newMulu = pasteDirectoryData(directoryClipboard.data, parentDirId, currentMulu);
    
    // 重建索引
    rebuildMulufileIndex();
    
    // 更新 UI
    DuplicateMuluHints();
    
    const childInfo = directoryClipboard.includeChildren ? "（含子目录）" : "";
    showToast(`已粘贴目录${childInfo}`, "success", 2000);
    hideRightMouseMenu();
});

// 右键菜单 - 快速复制（含子目录）
quickDuplicateWithChildren.addEventListener("click", function() {
    if (!currentMuluName) {
        hideRightMouseMenu();
        return;
    }
    
    const currentMulu = document.getElementById(currentMuluName);
    if (!currentMulu) {
        hideRightMouseMenu();
        return;
    }
    
    const dirId = currentMulu.getAttribute("data-dir-id");
    if (!dirId) {
        hideRightMouseMenu();
        return;
    }
    
    // 复制数据
    const copiedData = copyDirectoryData(dirId, true);
    
    // 获取当前目录的父目录 ID（粘贴到同级）
    const parentDirId = currentMulu.getAttribute("data-parent-id") || "mulu";
    
    // 立即粘贴到当前目录之后
    const newMulu = pasteDirectoryData(copiedData, parentDirId, currentMulu);
    
    // 重建索引
    rebuildMulufileIndex();
    
    // 更新 UI
    DuplicateMuluHints();
    
    showToast("已快速复制目录（含子目录）", "success", 2000);
    hideRightMouseMenu();
});

// 右键菜单 - 快速复制（不含子目录）
quickDuplicateWithoutChildren.addEventListener("click", function() {
    if (!currentMuluName) {
        hideRightMouseMenu();
        return;
    }
    
    const currentMulu = document.getElementById(currentMuluName);
    if (!currentMulu) {
        hideRightMouseMenu();
        return;
    }
    
    const dirId = currentMulu.getAttribute("data-dir-id");
    if (!dirId) {
        hideRightMouseMenu();
        return;
    }
    
    // 复制数据（不含子目录）
    const copiedData = copyDirectoryData(dirId, false);
    
    // 获取当前目录的父目录 ID（粘贴到同级）
    const parentDirId = currentMulu.getAttribute("data-parent-id") || "mulu";
    
    // 立即粘贴到当前目录之后
    const newMulu = pasteDirectoryData(copiedData, parentDirId, currentMulu);
    
    // 重建索引
    rebuildMulufileIndex();
    
    // 更新 UI
    DuplicateMuluHints();
    
    showToast("已快速复制目录（不含子目录）", "success", 2000);
    hideRightMouseMenu();
})
