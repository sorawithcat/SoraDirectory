// ============================================
// 目录操作模块 (directoryOperations.js)
// 功能：添加目录、添加节点等操作
// 依赖：globals.js, directoryUtils.js, directoryCore.js, SoraDirectoryJS.js
// ============================================

/**
 * 创建新目录的核心函数
 * @param {string} name - 目录名称
 * @param {boolean} asChild - true: 作为子目录添加, false: 作为同级目录添加
 * @returns {HTMLElement|null} - 新创建的目录元素，失败返回 null
 */
function createNewDirectory(name, asChild = false) {
    // 检查重复（仅提示，不阻止）
    const hasDuplicate = isDuplicateName(name);
    
    // 使用随机ID避免同名目录冲突
    const newMuLuName = `mulu_${getOneId(8, 2)}`;
    
    // 获取当前状态
    const allMulus = document.querySelectorAll(".mulu");
    const hasAnyMulu = allMulus.length > 0;
    
    let currentElement = null;
    let currentDirId = null;
    let currentParentId = null;
    let parentIdForFile = "mulu";
    let newLevel = 0;
    let idName;
    
    // 确定插入位置和层级
    if (currentMuluName && checkid(currentMuluName, 1) && hasAnyMulu) {
        currentElement = document.getElementById(currentMuluName);
        currentDirId = currentElement.getAttribute("data-dir-id");
        currentParentId = currentElement.getAttribute("data-parent-id");
        
        if (asChild) {
            // 作为子目录添加
            parentIdForFile = currentDirId || "mulu";
            const parentLevel = parseInt(currentElement.getAttribute("data-level")) || 0;
            newLevel = parentLevel + 1;
        } else {
            // 作为同级目录添加
            parentIdForFile = currentParentId || "mulu";
            if (currentParentId === "mulu" || !currentParentId) {
                parentIdForFile = "mulu";
            }
            newLevel = parseInt(currentElement.getAttribute("data-level")) || 0;
        }
    }
    
    // 创建 DOM 元素
    if (currentElement) {
        if (asChild) {
            // 子目录：插入到当前目录后面
            idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
        } else {
            // 同级目录：插入到当前目录及其所有后代之后
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
    
    // 添加到数据数组
    mulufile.push([parentIdForFile, name, newMuLuName, name]);
    
    // 更新索引缓存
    mulufileIndex.set(newMuLuName, mulufile.length - 1);

    // 配置新目录元素
    const newMulu = document.querySelector(`#${idName}`);
    newMulu.innerHTML = name;
    newMulu.setAttribute("data-level", newLevel);
    setLevelPadding(newMulu, newLevel);
    newMulu.setAttribute("data-dir-id", newMuLuName);
    newMulu.setAttribute("data-parent-id", asChild ? (currentDirId || parentIdForFile) : parentIdForFile);
    
    // 设置颜色小球
    setParentColorBall(newMulu);
    
    // 设置显示状态
    if (asChild) {
        // 子目录：更新父目录的 has-children 标记并确保展开
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
        // 同级目录：继承同级目录的显示状态
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
    
    // 绑定事件
    bindMuluEvents(newMulu);
    
    // 显示重复提示
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
    // 保存之前选中目录的内容
    if (currentMuluName) {
        const oldMulu = document.getElementById(currentMuluName);
        if (oldMulu) {
            syncPreviewToTextarea();
        }
    }
    
    // 选中新目录
    RemoveOtherSelect();
    newMulu.classList.add("select");
    currentMuluName = newMulu.id;
    jiedianwords.value = findMulufileData(newMulu);
    isUpdating = true;
    updateMarkdownPreview();
    isUpdating = false;
}

/**
 * 添加目录按钮点击事件
 * 在当前选中目录的同级位置创建新目录
 */
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

/**
 * 添加节点按钮点击事件
 * 在当前选中目录下创建子目录
 */
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
