/**
 * 创建新目录的核心函数
 * @param {string} name - 目录名称
 * @param {boolean} asChild - true: 作为子目录添加, false: 作为同级目录添加
 * @returns {HTMLElement|null} - 新创建的目录元素，失败返回 null
 */
function createNewDirectory(name, asChild = false) {
    const hasDuplicate = isDuplicateName(name);
    const newMuLuName = `mulu_${getOneId(8, 2)}`;
    const allMulus = document.querySelectorAll(".mulu");
    const hasAnyMulu = allMulus.length > 0;
    let currentElement = null;
    let currentDirId = null;
    let currentParentId = null;
    let parentIdForFile = "mulu";
    let newLevel = 0;
    let idName;
    if (currentMuluName && checkid(currentMuluName, 1) && hasAnyMulu) {
        currentElement = document.getElementById(currentMuluName);
        currentDirId = currentElement.getAttribute("data-dir-id");
        currentParentId = currentElement.getAttribute("data-parent-id");
        if (asChild) {
            parentIdForFile = currentDirId || "mulu";
            const parentLevel = parseInt(currentElement.getAttribute("data-level")) || 0;
            newLevel = parentLevel + 1;
        } else {
            parentIdForFile = currentParentId || "mulu";
            if (currentParentId === "mulu" || !currentParentId) {
                parentIdForFile = "mulu";
            }
            newLevel = parseInt(currentElement.getAttribute("data-level")) || 0;
        }
    }
    if (currentElement) {
        if (asChild) {
            idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
        } else {
            let lastDescendant = currentElement;
            if (typeof getDescendantElements === 'function') {
                const descendants = getDescendantElements(currentElement);
                lastDescendant = descendants[descendants.length - 1];
            }
            idName = creatDivByIdBefore(lastDescendant.id, getOneId(10, 0), "mulu");
        }
    } else {
        idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
    }
    mulufile.push([parentIdForFile, name, newMuLuName, escapeHtml(name)]);
    mulufileIndex.set(newMuLuName, mulufile.length - 1);
    const newMulu = document.querySelector(`#${idName}`);
    newMulu.textContent = name;
    newMulu.setAttribute("data-level", newLevel);
    setLevelPadding(newMulu, newLevel);
    newMulu.setAttribute("data-dir-id", newMuLuName);
    newMulu.setAttribute("data-parent-id", asChild ? (currentDirId || parentIdForFile) : parentIdForFile);
    setParentColorBall(newMulu);
    if (asChild) {
        if (currentElement && currentDirId) {
            if (!currentElement.classList.contains("has-children")) {
                currentElement.classList.add("has-children");
            }
            if (!currentElement.classList.contains("expanded")) {
                currentElement.classList.add("expanded");
                toggleChildDirectories(currentDirId, true);
            }
        }
        newMulu.style.display = "block";
    } else {
        const siblings = currentParentId && currentElement 
            ? findChildElementsByParentId(currentParentId)
            : Array.from(allMulus).filter(m => {
                const pId = m.getAttribute("data-parent-id");
                return !pId || pId === "mulu";
            });
        if (siblings.length > 0 && siblings[0] !== newMulu) {
            newMulu.style.display = siblings[0].style.display || "block";
        } else {
            newMulu.style.display = "block";
        }
    }
    bindMuluEvents(newMulu);
    if (hasDuplicate) {
        showToast("已存在同名目录", "warning", 2500);
    }
    return newMulu;
}
/**
 * 选中并显示新创建的目录
 * @param {HTMLElement} newMulu - 新创建的目录元素
 */
function selectNewDirectory(newMulu) {
    if (typeof switchToDirectoryElement === 'function') {
        switchToDirectoryElement(newMulu, { syncCurrent: true, scrollPreviewTop: true, forceRender: true });
        return;
    }
    if (currentMuluName) {
        const oldMulu = document.getElementById(currentMuluName);
        if (oldMulu) {
            syncPreviewToTextarea();
        }
    }
    RemoveOtherSelect();
    newMulu.classList.add("select");
    currentMuluName = newMulu.id;
    jiedianwords.value = findMulufileData(newMulu);
    if (markdownPreview) {
        markdownPreview.scrollTop = 0;
    }
    isUpdating = true;
    updateMarkdownPreview({ force: true });
    isUpdating = false;
}
addNewMuluButton.addEventListener("click", async function () {
    const name = await customPrompt("输入目录名", "");
    if (name === "" || name === null) {
        customAlert("已取消添加");
        return;
    }
    const newMulu = createNewDirectory(name, false);
    if (newMulu) {
        selectNewDirectory(newMulu);
    }
});
addNewPotsButton.addEventListener("click", async function () {
    const name = await customPrompt("输入节点名", "");
    if (name === "" || name === null) {
        customAlert("已取消添加");
        return;
    }
    const newMulu = createNewDirectory(name, true);
    if (newMulu) {
        selectNewDirectory(newMulu);
    }
});
