// ============================================
// directoryOperations 模块 (directoryOperations.js)
// 功能：目录操作（添加目录、添加节点）
// ============================================

//添加目录
addNewMuluButton.addEventListener("click", async function () {
    let nMulu, newMuLuName;
    nMulu = await customPrompt("输入目录名", "");
    if (nMulu == "" || nMulu == null) {
        customAlert("已取消添加");
        return;
    }
    if (isDuplicateName(nMulu)) {
        customAlert("目录名已存在，请使用其他名称");
        return;
    }
    newMuLuName = `mulu${nMulu}`;
    let idName;
    
    // 检查是否有目录存在
    let allMulus = document.querySelectorAll(".mulu");
    let hasAnyMulu = allMulus.length > 0;
    
    // 如果没有选中目录或没有目录，创建根目录
    let currentElement = null;
    let currentDirId = null;
    let currentParentId = null;
    let parentIdForFile = "mulu";
    let newLevel = 0;
    
    if (checkid(currentMuluName, 1) && hasAnyMulu) {
        // 有选中目录，在当前目录的同级创建
        currentElement = document.getElementById(currentMuluName);
        currentDirId = currentElement.getAttribute("data-dir-id");
        currentParentId = currentElement.getAttribute("data-parent-id");
        
        // 确定父目录ID（用于mulufile）
        parentIdForFile = currentParentId || "mulu";
        if (currentParentId === "mulu" || !currentParentId) {
            parentIdForFile = "mulu";
        }
        
        // 设置层级（同级目录）
        let parentLevel = currentElement.getAttribute("data-level") || 0;
        newLevel = parseInt(parentLevel);
    } else {
        // 没有选中目录或没有目录，创建根目录
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
    
    // 插入新目录
    if (currentElement && currentElement.nextSibling) {
        idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
    } else if (siblings.length > 0 && currentElement && siblings[siblings.length - 1] !== currentElement) {
        idName = creatDivByIdBefore(siblings[siblings.length - 1].id, getOneId(10, 0), "mulu");
    } else if (currentElement) {
        idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
    } else {
        // 没有目录，创建第一个根目录
        idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
    }
    
    mulufile.push([parentIdForFile, nMulu, newMuLuName, `${nMulu}`]);

    let newMulu = document.querySelector(`#${idName}`);
    newMulu.innerHTML = nMulu;
    
    // 设置层级
    newMulu.setAttribute("data-level", newLevel);
    // 使用公式计算并设置偏移量
    setLevelPadding(newMulu, newLevel);
    
    // 设置目录ID和父目录ID
    newMulu.setAttribute("data-dir-id", newMuLuName);
    newMulu.setAttribute("data-parent-id", parentIdForFile);
    
    // 检查是否有子目录（新添加的目录默认没有子目录）
    // has-children会在添加子目录时自动添加
    
    // 从同级目录获取样式
    if (siblings.length > 0 && siblings[0] !== newMulu) {
        let sibling = siblings[0];
        newMulu.style.display = sibling.style.display || "block";
    } else {
        newMulu.style.display = "block";
    }
    
    // 更新父目录的has-children标记（如果有父目录）
    if (currentElement && currentDirId && !currentElement.classList.contains("has-children")) {
        currentElement.classList.add("has-children");
        currentElement.classList.add("expanded");
    }
    
    // 使用定时器来区分单击和双击
    let clickTimer2 = null;
    newMulu.addEventListener("mouseup", function (e) {
            if (e.button == 0) {
                // 检查是否点击在三角区域
                let clickX = e.offsetX || (e.clientX - newMulu.getBoundingClientRect().left);
                let isClickOnTriangle = clickX < 20;
                
                if (newMulu.classList.contains("has-children") && isClickOnTriangle) {
                    e.stopPropagation();
                    // 清除单击定时器，避免与双击冲突
                    if (clickTimer2) {
                        clearTimeout(clickTimer2);
                        clickTimer2 = null;
                    }
                    let isExpanded = newMulu.classList.contains("expanded");
                    let dirId = newMulu.getAttribute("data-dir-id");
                    
                    if (isExpanded) {
                        newMulu.classList.remove("expanded");
                        if (dirId) {
                            toggleChildDirectories(dirId, false);
                        }
                    } else {
                        newMulu.classList.add("expanded");
                        if (dirId) {
                            toggleChildDirectories(dirId, true);
                        }
                    }
                    return;
                }
                
                // 延迟执行单击操作，等待可能的双击
                if (clickTimer2) {
                    clearTimeout(clickTimer2);
                }
                clickTimer2 = setTimeout(function() {
                    // 在切换目录之前，先保存当前目录的内容
                    if (currentMuluName) {
                        let currentMulu = document.querySelector(`#${currentMuluName}`);
                        if (currentMulu) {
                            syncPreviewToTextarea(); // 保存当前目录的内容
                        }
                    }
                    currentMuluName = newMulu.id;
                    RemoveOtherSelect();
                    newMulu.classList.add("select");
                    jiedianwords.value = findMulufileData(newMulu);
                    isUpdating = true;
                    updateMarkdownPreview();
                    isUpdating = false;
                    clickTimer2 = null;
                }, 300); // 300ms延迟，如果在这期间有双击则取消
            } else if (e.button == 2) {
                // 清除单击定时器
                if (clickTimer2) {
                    clearTimeout(clickTimer2);
                    clickTimer2 = null;
                }
                // 在切换目录之前，先保存当前目录的内容
                if (currentMuluName) {
                    let currentMulu = document.querySelector(`#${currentMuluName}`);
                    if (currentMulu) {
                        syncPreviewToTextarea(); // 保存当前目录的内容
                    }
                }
                currentMuluName = newMulu.id;
                RemoveOtherSelect();
                newMulu.classList.add("select");
                jiedianwords.value = findMulufileData(newMulu);
                rightMouseMenu(e);
            }
        });
        newMulu.addEventListener("dblclick", function (e) {
            e.preventDefault(); // 阻止默认事件
            e.stopPropagation(); // 阻止事件冒泡
            // 清除单击定时器，避免触发单击操作
            if (clickTimer2) {
                clearTimeout(clickTimer2);
                clickTimer2 = null;
            }
            // 如果当前正在编辑这个目录，先保存内容
            if (currentMuluName === newMulu.id) {
                syncPreviewToTextarea();
            }
            oldName = newMulu.innerHTML;
            customPrompt("新的名字", oldName).then(newName => {
                if (newName && newName.length > 0) {
                    if (!ChangeChildName(newMulu.id, newName)) {
                        newMulu.innerHTML = oldName;
                        return;
                    }
                    newMulu.innerHTML = newName;
                    console.log(mulufile);
                } else {
                    newMulu.innerHTML = oldName;
                }
            });
        })
        AddListStyleForFolder();
        DuplicateMuluHints();
})

//添加节点
addNewPotsButton.addEventListener("click", async function () {
    let nMulu, newMuLuName;
    nMulu = await customPrompt("输入节点名", "");
    if (nMulu == "" || nMulu == null) {
        customAlert("已取消添加");
        return;
    }
    if (isDuplicateName(nMulu)) {
        customAlert("目录名已存在，请使用其他名称");
        return;
    }
    newMuLuName = `mulu${nMulu}`;
    let idName;
    
    // 检查是否有目录存在
    let allMulus = document.querySelectorAll(".mulu");
    let hasAnyMulu = allMulus.length > 0;
    
    // 如果没有选中目录或没有目录，创建根目录作为子节点
    let currentElement = null;
    let currentDirId = null;
    let currentParentId = null;
    let parentIdForFile = "mulu";
    let newLevel = 0;
    
    if (checkid(currentMuluName, 1) && hasAnyMulu) {
        // 有选中目录，作为子目录添加
        currentElement = document.getElementById(currentMuluName);
        currentDirId = currentElement.getAttribute("data-dir-id");
        currentParentId = currentElement.getAttribute("data-parent-id");
        
        // 确定父目录ID（用于mulufile）- 作为选中目录的子目录
        parentIdForFile = currentDirId || "mulu";
        
        // 设置层级（子目录）
        let parentLevel = currentElement.getAttribute("data-level") || 0;
        newLevel = parseInt(parentLevel) + 1;
    } else {
        // 没有选中目录或没有目录，创建根目录
        parentIdForFile = "mulu";
        newLevel = 0;
    }
    
    // 插入新目录
    if (currentElement) {
        idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
    } else {
        // 没有目录，创建第一个根目录
        idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
    }
    
    mulufile.push([parentIdForFile, nMulu, newMuLuName, `${nMulu}`]);
    
    let newMulu = document.querySelector(`#${idName}`);
    newMulu.innerHTML = nMulu;
    
    // 设置层级
    newMulu.setAttribute("data-level", newLevel);
    // 使用公式计算并设置偏移量
    setLevelPadding(newMulu, newLevel);
    
    // 设置目录ID和父目录ID
    newMulu.setAttribute("data-dir-id", newMuLuName);
    newMulu.setAttribute("data-parent-id", currentDirId || parentIdForFile);
    
    // 更新父目录的has-children标记（如果有父目录）
    if (currentElement && currentDirId && !currentElement.classList.contains("has-children")) {
        currentElement.classList.add("has-children");
        currentElement.classList.add("expanded");
    }
        
        // 从同级目录获取样式
        let siblings = findChildElementsByParentId(currentDirId || parentIdForFile);
        if (siblings.length > 1) {
            let sibling = siblings[1];
            newMulu.style.display = sibling.style.display || "block";
        } else {
            newMulu.style.display = "block";
        }
        // 使用定时器来区分单击和双击
        let clickTimer2 = null;
        newMulu.addEventListener("mouseup", function (e) {
            if (e.button == 0) {
                // 检查是否点击在三角区域
                let clickX = e.offsetX || (e.clientX - newMulu.getBoundingClientRect().left);
                let isClickOnTriangle = clickX < 20;
                
                if (newMulu.classList.contains("has-children") && isClickOnTriangle) {
                    e.stopPropagation();
                    // 清除单击定时器，避免与双击冲突
                    if (clickTimer2) {
                        clearTimeout(clickTimer2);
                        clickTimer2 = null;
                    }
                    let isExpanded = newMulu.classList.contains("expanded");
                    let dirId = newMulu.getAttribute("data-dir-id");
                    
                    if (isExpanded) {
                        newMulu.classList.remove("expanded");
                        if (dirId) {
                            toggleChildDirectories(dirId, false);
                        }
                    } else {
                        newMulu.classList.add("expanded");
                        if (dirId) {
                            toggleChildDirectories(dirId, true);
                        }
                    }
                    return;
                }
                
                // 延迟执行单击操作，等待可能的双击
                if (clickTimer2) {
                    clearTimeout(clickTimer2);
                }
                clickTimer2 = setTimeout(function() {
                    // 在切换目录之前，先保存当前目录的内容
                    if (currentMuluName) {
                        let currentMulu = document.querySelector(`#${currentMuluName}`);
                        if (currentMulu) {
                            syncPreviewToTextarea(); // 保存当前目录的内容
                        }
                    }
                    currentMuluName = newMulu.id;
                    RemoveOtherSelect();
                    newMulu.classList.add("select");
                    jiedianwords.value = findMulufileData(newMulu);
                    isUpdating = true;
                    updateMarkdownPreview();
                    isUpdating = false;
                    clickTimer2 = null;
                }, 300); // 300ms延迟，如果在这期间有双击则取消
            } else if (e.button == 2) {
                // 清除单击定时器
                if (clickTimer2) {
                    clearTimeout(clickTimer2);
                    clickTimer2 = null;
                }
                // 在切换目录之前，先保存当前目录的内容
                if (currentMuluName) {
                    let currentMulu = document.querySelector(`#${currentMuluName}`);
                    if (currentMulu) {
                        syncPreviewToTextarea(); // 保存当前目录的内容
                    }
                }
                currentMuluName = newMulu.id;
                RemoveOtherSelect();
                newMulu.classList.add("select");
                jiedianwords.value = findMulufileData(newMulu);
                rightMouseMenu(e);
            }
        });
        newMulu.addEventListener("dblclick", function (e) {
            e.preventDefault(); // 阻止默认事件
            e.stopPropagation(); // 阻止事件冒泡
            // 清除单击定时器，避免触发单击操作
            if (clickTimer2) {
                clearTimeout(clickTimer2);
                clickTimer2 = null;
            }
            // 如果当前正在编辑这个目录，先保存内容
            if (currentMuluName === newMulu.id) {
                syncPreviewToTextarea();
            }
            oldName = newMulu.innerHTML;
            customPrompt("新的名字", oldName).then(newName => {
                if (newName && newName.length > 0) {
                    if (!ChangeChildName(newMulu.id, newName)) {
                        newMulu.innerHTML = oldName;
                        return;
                    }
                    newMulu.innerHTML = newName;
                    console.log(mulufile);
                } else {
                    newMulu.innerHTML = oldName;
                }
            });
        })
        AddListStyleForFolder();
        DuplicateMuluHints();
})
