/**
 * 显示右键菜单
 * @param {MouseEvent} e - 鼠标事件对象
 */
function rightMouseMenu(e) {
    if (directoryClipboard && directoryClipboard.data) {
        pasteMulu.classList.remove("disabled");
    } else {
        pasteMulu.classList.add("disabled");
    }
    rightmousemenu.style.display = "block";
    rightmousemenu.classList.remove("show");
    const menuWidth = rightmousemenu.offsetWidth;
    const menuHeight = rightmousemenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let posX = e.clientX;
    let posY = e.clientY;
    if (posX + menuWidth > viewportWidth - 10) {
        posX = viewportWidth - menuWidth - 10;
    }
    if (posY + menuHeight > viewportHeight - 10) {
        posY = viewportHeight - menuHeight - 10;
    }
    posX = Math.max(10, posX);
    posY = Math.max(10, posY);
    rightmousemenu.style.left = `${posX}px`;
    rightmousemenu.style.top = `${posY}px`;
    requestAnimationFrame(() => {
        rightmousemenu.classList.add("show");
    });
}
document.addEventListener('click', function (e) {
    if (rightmousemenu.contains(e.target)) return;
    hideRightMouseMenu();
});
/**
 * 隐藏右键菜单（带动画）
 */
function hideRightMouseMenu() {
    rightmousemenu.classList.remove("show");
    setTimeout(() => {
        if (!rightmousemenu.classList.contains("show")) {
            rightmousemenu.style.display = "none";
        }
    }, 150);
}
noneRightMouseMenu.addEventListener("click", function () {
    hideRightMouseMenu();
});
async function copyTextToClipboard(text) {
    const val = String(text || '');
    if (!val) return false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(val);
            return true;
        }
    } catch (err) {
        console.warn('写入剪贴板失败，将尝试使用降级方案:', err);
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = val;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        textarea.remove();
        return !!ok;
    } catch (err) {
        console.error('复制失败:', err);
        return false;
    }
}

function markDirectoryStructureChanged() {
    if (typeof markUnsavedChanges === 'function') {
        markUnsavedChanges();
    }
}

function refreshParentChildState(parentDirId) {
    if (!parentDirId || parentDirId === "mulu") return;
    const parentElement = document.querySelector(`[data-dir-id="${parentDirId}"]`);
    if (!parentElement) return;
    const remainingChildren = findChildElementsByParentId(parentDirId);
    if (remainingChildren.length === 0) {
        parentElement.classList.remove("has-children", "expanded");
    } else {
        parentElement.classList.add("has-children");
    }
}

if (typeof copyMuluId !== 'undefined' && copyMuluId) {
    copyMuluId.addEventListener('click', async function() {
        if (!currentMuluName) {
            hideRightMouseMenu();
            return;
        }
        const currentMulu = document.getElementById(currentMuluName);
        if (!currentMulu) {
            hideRightMouseMenu();
            return;
        }
        const dirId = currentMulu.getAttribute('data-dir-id') || '';
        if (!dirId) {
            showToast('未找到目录ID', 'warning', 2000);
            hideRightMouseMenu();
            return;
        }
        const ok = await copyTextToClipboard(dirId);
        if (ok) {
            showToast('已复制目录ID：' + dirId, 'success', 2000);
        } else {
            showToast('复制失败，请手动复制', 'error', 2500);
        }
        hideRightMouseMenu();
    });
}
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
        let oldParentId = nowchild.getAttribute("data-parent-id") || "mulu";
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
                if (childId) {
                    deleteAllChildren(childId);
                }
                for (let j = mulufile.length - 1; j >= 0; j--) {
                    let item = mulufile[j];
                    if (item.length === 4 && item[2] === childId) {
                        mulufile.splice(j, 1);
                        break;
                    }
                }
                child.remove();
            }
        }
        if (currentDirId) {
            deleteAllChildren(currentDirId);
        }
        for (let i = mulufile.length - 1; i >= 0; i--) {
            let item = mulufile[i];
            if (item.length === 4 && item[2] === currentDirId) {
                mulufile.splice(i, 1);
                break;
            }
        }
        nowchild.remove();
        rebuildMulufileIndex();
        refreshParentChildState(oldParentId);
        markDirectoryStructureChanged();
        currentMuluName = null;
        jiedianwords.value = "";
        isUpdating = true;
        updateMarkdownPreview({ force: true });
        isUpdating = false;
        DuplicateMuluHints();
        hideRightMouseMenu();
    });
});
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
    const newDirId = getOneId(10, 0);
    const newDomId = getOneId(10, 0);
    const newMulu = document.createElement("div");
    newMulu.classList.add("mulu");
    newMulu.id = newDomId;
    newMulu.setAttribute("data-dir-id", newDirId);
    newMulu.setAttribute("data-parent-id", parentDirId);
    newMulu.textContent = data.name;
    const isRootLevel = !parentDirId || parentDirId === "mulu";
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
    mulufile.push([parentDirId, data.name, newDirId, data.content]);
    mulufileIndex.set(newDirId, mulufile.length - 1);
    let insertAfter = null;
    if (insertAfterRef) {
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
        const allChildren = findAllDescendants(parentDirId);
        if (allChildren.length > 0) {
            insertAfter = allChildren[allChildren.length - 1];
        } else {
            insertAfter = parentElement;
        }
    }
    if (insertAfter && insertAfter.nextSibling) {
        insertAfter.parentNode.insertBefore(newMulu, insertAfter.nextSibling);
    } else if (insertAfter) {
        insertAfter.parentNode.appendChild(newMulu);
    } else {
        mulu.appendChild(newMulu);
    }
    setParentColorBall(newMulu);
    bindMuluEvents(newMulu);
    if (data.children && data.children.length > 0) {
        newMulu.classList.add("has-children", "expanded");
        for (const childData of data.children) {
            pasteDirectoryData(childData, newDirId);
        }
    }
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
pasteMulu.addEventListener("click", function() {
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
    const parentDirId = currentMulu.getAttribute("data-dir-id") || "mulu";
    const newMulu = pasteDirectoryData(directoryClipboard.data, parentDirId);
    if (parentDirId !== "mulu") {
        currentMulu.classList.add("has-children", "expanded");
        toggleChildDirectories(parentDirId, true);
        refreshParentChildState(parentDirId);
    }
    rebuildMulufileIndex();
    markDirectoryStructureChanged();
    DuplicateMuluHints();
    const childInfo = directoryClipboard.includeChildren ? "（含子目录）" : "";
    showToast(`已粘贴目录${childInfo}`, "success", 2000);
    hideRightMouseMenu();
});
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
    const copiedData = copyDirectoryData(dirId, true);
    const parentDirId = currentMulu.getAttribute("data-parent-id") || "mulu";
    const newMulu = pasteDirectoryData(copiedData, parentDirId, currentMulu);
    rebuildMulufileIndex();
    markDirectoryStructureChanged();
    DuplicateMuluHints();
    showToast("已快速复制目录（含子目录）", "success", 2000);
    hideRightMouseMenu();
});
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
    const copiedData = copyDirectoryData(dirId, false);
    const parentDirId = currentMulu.getAttribute("data-parent-id") || "mulu";
    const newMulu = pasteDirectoryData(copiedData, parentDirId, currentMulu);
    rebuildMulufileIndex();
    markDirectoryStructureChanged();
    DuplicateMuluHints();
    showToast("已快速复制目录（不含子目录）", "success", 2000);
    hideRightMouseMenu();
});
