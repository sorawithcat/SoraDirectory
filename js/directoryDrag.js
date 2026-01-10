/** 当前被拖拽的目录元素 */
let draggedMulu = null;
/** 拖拽占位符元素 */
let dragPlaceholder = null;
/** 拖拽目标位置类型：'before' | 'after' | 'child' */
let dropPosition = null;
/** 拖拽目标元素 */
let dropTarget = null;
// -------------------- 工具函数 --------------------
/**
 * 获取目录及其所有后代目录元素
 * @param {HTMLElement} element - 目录元素
 * @returns {HTMLElement[]} - 包含该目录及所有后代的数组
 */
function getDescendantElements(element) {
    let descendants = [element];
    let dirId = element.getAttribute("data-dir-id");
    if (!dirId) return descendants;
    function findChildren(parentId) {
        let children = findChildElementsByParentId(parentId);
        for (let child of children) {
            descendants.push(child);
            let childId = child.getAttribute("data-dir-id");
            if (childId) {
                findChildren(childId);
            }
        }
    }
    findChildren(dirId);
    return descendants;
}
/**
 * 检查目标是否是源的后代
 * @param {HTMLElement} source - 源目录元素
 * @param {HTMLElement} target - 目标目录元素
 * @returns {boolean}
 */
function isDescendantOf(source, target) {
    let sourceId = source.getAttribute("data-dir-id");
    let targetParentId = target.getAttribute("data-parent-id");
    while (targetParentId && targetParentId !== "mulu") {
        if (targetParentId === sourceId) {
            return true;
        }
        let parentElement = document.querySelector(`[data-dir-id="${targetParentId}"]`);
        if (parentElement) {
            targetParentId = parentElement.getAttribute("data-parent-id");
        } else {
            break;
        }
    }
    return false;
}
/**
 * 更新目录及其后代的层级和缩进
 * @param {HTMLElement} element - 目录元素
 * @param {number} newLevel - 新的层级
 */
function updateLevelRecursively(element, newLevel) {
    element.setAttribute("data-level", newLevel);
    setLevelPadding(element, newLevel);
    let dirId = element.getAttribute("data-dir-id");
    if (dirId) {
        let children = findChildElementsByParentId(dirId);
        for (let child of children) {
            updateLevelRecursively(child, newLevel + 1);
        }
    }
}
/**
 * 在 mulufile 中更新目录的父目录
 * @param {string} dirId - 目录ID
 * @param {string} newParentId - 新的父目录ID
 */
function updateMulufileParent(dirId, newParentId) {
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4 && mulufile[i][2] === dirId) {
            mulufile[i][0] = newParentId;
            return true;
        }
    }
    return false;
}
/**
 * 创建拖拽占位符
 * @returns {HTMLElement}
 */
function createDragPlaceholder() {
    let placeholder = document.createElement("div");
    placeholder.className = "mulu-drag-placeholder";
    placeholder.style.cssText = `
        height: 4px;
        background-color: #0066cc;
        margin: 2px 0;
        border-radius: 2px;
        pointer-events: none;
    `;
    return placeholder;
}
/**
 * 移除拖拽占位符
 */
function removeDragPlaceholder() {
    if (dragPlaceholder && dragPlaceholder.parentNode) {
        dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    }
    dragPlaceholder = null;
}
/**
 * 获取鼠标相对于目录元素的位置
 * @param {MouseEvent} e - 鼠标事件
 * @param {HTMLElement} element - 目录元素
 * @returns {string} - 'before' | 'after' | 'child'
 */
function getDropPosition(e, element) {
    let rect = element.getBoundingClientRect();
    let y = e.clientY - rect.top;
    let height = rect.height;
    if (y < height * 0.25) {
        return 'before';
    }
    else if (y > height * 0.75) {
        return 'after';
    }
    else {
        return 'child';
    }
}
/**
 * 处理拖拽开始
 * @param {DragEvent} e - 拖拽事件
 */
function handleDragStart(e) {
    draggedMulu = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedMulu.id);
    setTimeout(() => {
        draggedMulu.classList.add("dragging");
        let descendants = getDescendantElements(draggedMulu);
        for (let i = 1; i < descendants.length; i++) {
            descendants[i].classList.add("dragging-child");
        }
    }, 0);
}
/**
 * 处理拖拽经过
 * @param {DragEvent} e - 拖拽事件
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    let target = e.target.closest('.mulu');
    if (!target || target === draggedMulu) {
        removeDragPlaceholder();
        dropTarget = null;
        return;
    }
    if (isDescendantOf(draggedMulu, target)) {
        removeDragPlaceholder();
        dropTarget = null;
        return;
    }
    dropTarget = target;
    dropPosition = getDropPosition(e, target);
    document.querySelectorAll('.mulu').forEach(m => {
        m.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-child');
    });
    if (dropPosition === 'before') {
        target.classList.add('drag-over-before');
    } else if (dropPosition === 'after') {
        target.classList.add('drag-over-after');
    } else if (dropPosition === 'child') {
        target.classList.add('drag-over-child');
    }
}
/**
 * 处理拖拽离开
 * @param {DragEvent} e - 拖拽事件
 */
function handleDragLeave(e) {
    let target = e.target.closest('.mulu');
    if (target) {
        target.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-child');
    }
}
/**
 * 处理拖拽结束
 * @param {DragEvent} e - 拖拽事件
 */
function handleDragEnd(e) {
    if (draggedMulu) {
        draggedMulu.classList.remove("dragging");
        let descendants = getDescendantElements(draggedMulu);
        for (let i = 1; i < descendants.length; i++) {
            descendants[i].classList.remove("dragging-child");
        }
    }
    document.querySelectorAll('.mulu').forEach(m => {
        m.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-child');
    });
    removeDragPlaceholder();
    draggedMulu = null;
    dropTarget = null;
    dropPosition = null;
}
/**
 * 处理放置
 * @param {DragEvent} e - 拖拽事件
 */
function handleDrop(e) {
    e.preventDefault();
    if (!draggedMulu || !dropTarget || !dropPosition) {
        handleDragEnd(e);
        return;
    }
    if (draggedMulu === dropTarget) {
        handleDragEnd(e);
        return;
    }
    if (isDescendantOf(draggedMulu, dropTarget)) {
        showToast("不能将目录移动到其子目录中", "warning", 2000);
        handleDragEnd(e);
        return;
    }
    let elementsToMove = getDescendantElements(draggedMulu);
    let targetDirId = dropTarget.getAttribute("data-dir-id");
    let targetParentId = dropTarget.getAttribute("data-parent-id");
    let targetLevel = parseInt(dropTarget.getAttribute("data-level")) || 0;
    let newParentId, newLevel;
    if (dropPosition === 'child') {
        newParentId = targetDirId;
        newLevel = targetLevel + 1;
    } else {
        newParentId = targetParentId;
        newLevel = targetLevel;
    }
    let draggedDirId = draggedMulu.getAttribute("data-dir-id");
    let oldParentId = draggedMulu.getAttribute("data-parent-id");
    updateMulufileParent(draggedDirId, newParentId);
    draggedMulu.setAttribute("data-parent-id", newParentId);
    updateLevelRecursively(draggedMulu, newLevel);
    if (typeof setParentColorBall === 'function') {
        setParentColorBall(draggedMulu);
        for (let i = 1; i < elementsToMove.length; i++) {
            setParentColorBall(elementsToMove[i]);
        }
    }
    let firststepElement = document.querySelector('.firststep');
    elementsToMove.forEach(el => {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    });
    if (dropPosition === 'before') {
        dropTarget.parentNode.insertBefore(draggedMulu, dropTarget);
    } else if (dropPosition === 'after') {
        let targetDescendants = getDescendantElements(dropTarget);
        let lastDescendant = targetDescendants[targetDescendants.length - 1];
        if (lastDescendant.nextSibling) {
            lastDescendant.parentNode.insertBefore(draggedMulu, lastDescendant.nextSibling);
        } else {
            firststepElement.appendChild(draggedMulu);
        }
    } else if (dropPosition === 'child') {
        if (dropTarget.nextSibling) {
            dropTarget.parentNode.insertBefore(draggedMulu, dropTarget.nextSibling);
        } else {
            firststepElement.appendChild(draggedMulu);
        }
        if (!dropTarget.classList.contains("has-children")) {
            dropTarget.classList.add("has-children");
            dropTarget.classList.add("expanded");
        }
    }
    let previousElement = draggedMulu;
    for (let i = 1; i < elementsToMove.length; i++) {
        if (previousElement.nextSibling) {
            previousElement.parentNode.insertBefore(elementsToMove[i], previousElement.nextSibling);
        } else {
            firststepElement.appendChild(elementsToMove[i]);
        }
        previousElement = elementsToMove[i];
    }
    if (oldParentId && oldParentId !== "mulu") {
        let oldParent = document.querySelector(`[data-dir-id="${oldParentId}"]`);
        if (oldParent) {
            let remainingChildren = findChildElementsByParentId(oldParentId);
            if (remainingChildren.length === 0) {
                oldParent.classList.remove("has-children", "expanded");
            }
        }
    }
    showToast("目录已移动", "success", 1500);
    handleDragEnd(e);
}
/**
 * 为目录元素绑定拖拽事件
 * @param {HTMLElement} muluElement - 目录元素
 */
function bindDragEvents(muluElement) {
    muluElement.setAttribute("draggable", "true");
    muluElement.addEventListener("dragstart", handleDragStart);
    muluElement.addEventListener("dragover", handleDragOver);
    muluElement.addEventListener("dragleave", handleDragLeave);
    muluElement.addEventListener("dragend", handleDragEnd);
    muluElement.addEventListener("drop", handleDrop);
}
/**
 * 为所有现有目录绑定拖拽事件
 */
function initDragForAllMulus() {
    let allMulus = document.querySelectorAll(".mulu");
    allMulus.forEach(mulu => {
        bindDragEvents(mulu);
    });
}