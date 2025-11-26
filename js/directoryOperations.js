// ============================================
// 目录操作模块 (directoryOperations.js)
// 功能：添加目录、添加节点等操作
// 依赖：globals.js, directoryUtils.js, directoryCore.js, SoraDirectoryJS.js
// ============================================

/**
 * 添加目录按钮点击事件
 * 在当前选中目录的同级位置创建新目录
 */
addNewMuluButton.addEventListener("click", async function () {
    // 获取用户输入
    let nMulu = await customPrompt("输入目录名", "");
    if (nMulu == "" || nMulu == null) {
        customAlert("已取消添加");
        return;
    }
    
    // 检查重复（仅提示，不阻止）
    let hasDuplicate = isDuplicateName(nMulu);
    
    // 使用随机ID而不是基于名称的ID，避免同名目录冲突
    let newMuLuName = `mulu_${getOneId(8, 2)}`;
    let idName;
    
    // 获取当前状态
    let allMulus = document.querySelectorAll(".mulu");
    let hasAnyMulu = allMulus.length > 0;
    
    let currentElement = null;
    let currentDirId = null;
    let currentParentId = null;
    let parentIdForFile = "mulu";
    let newLevel = 0;
    
    // 确定插入位置和层级
    if (currentMuluName && checkid(currentMuluName, 1) && hasAnyMulu) {
        // 有选中目录，在同级创建
        currentElement = document.getElementById(currentMuluName);
        currentDirId = currentElement.getAttribute("data-dir-id");
        currentParentId = currentElement.getAttribute("data-parent-id");
        
        parentIdForFile = currentParentId || "mulu";
        if (currentParentId === "mulu" || !currentParentId) {
            parentIdForFile = "mulu";
        }
        
        let parentLevel = currentElement.getAttribute("data-level") || 0;
        newLevel = parseInt(parentLevel);
    } else {
        // 没有选中目录，创建根目录
        parentIdForFile = "mulu";
        newLevel = 0;
    }
    
    // 查找同级目录，确定插入位置
    let siblings = [];
    if (currentParentId && currentElement) {
        siblings = findChildElementsByParentId(currentParentId);
    } else {
        // 顶级目录
        for (let i = 0; i < allMulus.length; i++) {
            let pId = allMulus[i].getAttribute("data-parent-id");
            if (!pId || pId === "mulu") {
                siblings.push(allMulus[i]);
            }
        }
    }
    
    // 创建 DOM 元素
    if (currentElement && currentElement.nextSibling) {
        idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
    } else if (siblings.length > 0 && currentElement && siblings[siblings.length - 1] !== currentElement) {
        idName = creatDivByIdBefore(siblings[siblings.length - 1].id, getOneId(10, 0), "mulu");
    } else if (currentElement) {
        idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
    } else {
        idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
    }
    
    // 添加到数据数组
    mulufile.push([parentIdForFile, nMulu, newMuLuName, `${nMulu}`]);

    // 配置新目录元素
    let newMulu = document.querySelector(`#${idName}`);
    newMulu.innerHTML = nMulu;
    newMulu.setAttribute("data-level", newLevel);
    setLevelPadding(newMulu, newLevel);
    newMulu.setAttribute("data-dir-id", newMuLuName);
    newMulu.setAttribute("data-parent-id", parentIdForFile);
    
    // 设置显示状态
    if (siblings.length > 0 && siblings[0] !== newMulu) {
        newMulu.style.display = siblings[0].style.display || "block";
    } else {
        newMulu.style.display = "block";
    }
    
    // 更新父目录标记（如果当前是根目录下添加）
    if (currentElement && currentDirId && !currentElement.classList.contains("has-children")) {
        currentElement.classList.add("has-children");
        currentElement.classList.add("expanded");
    }
    
    // 绑定事件
    bindMuluEvents(newMulu);
    
    // 更新 UI
    AddListStyleForFolder();
    
    // 自动选中新添加的目录
    if (currentMuluName) {
        let oldMulu = document.getElementById(currentMuluName);
        if (oldMulu) {
            syncPreviewToTextarea(); // 保存之前选中目录的内容
        }
    }
    RemoveOtherSelect();
    newMulu.classList.add("select");
    currentMuluName = newMulu.id;
    jiedianwords.value = findMulufileData(newMulu);
    isUpdating = true;
    updateMarkdownPreview();
    isUpdating = false;
    
    // 显示重复提示（使用 toast）
    if (hasDuplicate) {
        showToast("已存在同名目录", "warning", 2500);
    }
});

/**
 * 添加节点按钮点击事件
 * 在当前选中目录下创建子目录
 */
addNewPotsButton.addEventListener("click", async function () {
    // 获取用户输入
    let nMulu = await customPrompt("输入节点名", "");
    if (nMulu == "" || nMulu == null) {
        customAlert("已取消添加");
        return;
    }
    
    // 检查重复（仅提示，不阻止）
    let hasDuplicate = isDuplicateName(nMulu);
    
    // 使用随机ID而不是基于名称的ID，避免同名目录冲突
    let newMuLuName = `mulu_${getOneId(8, 2)}`;
    let idName;
    
    // 获取当前状态
    let allMulus = document.querySelectorAll(".mulu");
    let hasAnyMulu = allMulus.length > 0;
    
    let currentElement = null;
    let currentDirId = null;
    let parentIdForFile = "mulu";
    let newLevel = 0;
    
    // 确定插入位置和层级
    if (currentMuluName && checkid(currentMuluName, 1) && hasAnyMulu) {
        // 有选中目录，作为其子目录添加
        currentElement = document.getElementById(currentMuluName);
        currentDirId = currentElement.getAttribute("data-dir-id");
        
        parentIdForFile = currentDirId || "mulu";
        
        let parentLevel = currentElement.getAttribute("data-level") || 0;
        newLevel = parseInt(parentLevel) + 1;
    } else {
        // 没有选中目录，创建根目录
        parentIdForFile = "mulu";
        newLevel = 0;
    }
    
    // 创建 DOM 元素
    if (currentElement) {
        idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
    } else {
        idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
    }
    
    // 添加到数据数组
    mulufile.push([parentIdForFile, nMulu, newMuLuName, `${nMulu}`]);
    
    // 配置新目录元素
    let newMulu = document.querySelector(`#${idName}`);
    newMulu.innerHTML = nMulu;
    newMulu.setAttribute("data-level", newLevel);
    setLevelPadding(newMulu, newLevel);
    newMulu.setAttribute("data-dir-id", newMuLuName);
    newMulu.setAttribute("data-parent-id", currentDirId || parentIdForFile);
    
    // 更新父目录的 has-children 标记
    if (currentElement && currentDirId && !currentElement.classList.contains("has-children")) {
        currentElement.classList.add("has-children");
        currentElement.classList.add("expanded");
    }
        
    // 设置显示状态
    let siblings = findChildElementsByParentId(currentDirId || parentIdForFile);
    if (siblings.length > 1) {
        newMulu.style.display = siblings[1].style.display || "block";
    } else {
        newMulu.style.display = "block";
    }
    
    // 绑定事件
    bindMuluEvents(newMulu);
    
    // 更新 UI
    AddListStyleForFolder();
    
    // 自动选中新添加的节点
    if (currentMuluName) {
        let oldMulu = document.getElementById(currentMuluName);
        if (oldMulu) {
            syncPreviewToTextarea(); // 保存之前选中目录的内容
        }
    }
    RemoveOtherSelect();
    newMulu.classList.add("select");
    currentMuluName = newMulu.id;
    jiedianwords.value = findMulufileData(newMulu);
    isUpdating = true;
    updateMarkdownPreview();
    isUpdating = false;
    
    // 显示重复提示（使用 toast）
    if (hasDuplicate) {
        showToast("已存在同名目录", "warning", 2500);
    }
});
