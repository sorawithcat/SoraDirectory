// ============================================
// directoryCore 模块 (directoryCore.js)
// ============================================

// 计算目录层级
function calculateLevel(parentId, mulufile) {
    if (parentId === "mulu") return 0;
    let level = 0;
    let currentParent = parentId;
    let visited = new Set();
    
    while (currentParent && currentParent !== "mulu" && !visited.has(currentParent)) {
        visited.add(currentParent);
        level++;
        // 查找当前父目录的父目录
        for (let i = 0; i < mulufile.length; i++) {
            if (mulufile[i].length === 4 && mulufile[i][2] === currentParent) {
                currentParent = mulufile[i][0];
                break;
            }
        }
        if (level > 20) break; // 防止无限循环
    }
    return level;
}

// 根据层级计算并设置偏移量（使用公式）
function setLevelPadding(element, level) {
    // 公式：基础偏移20px + 每级增加20px
    // level 0: 20px, level 1: 40px, level 2: 60px, ...
    let paddingLeft = 20 + (level * 20);
    element.style.paddingLeft = paddingLeft + 'px';
}

//加载目录
function LoadMulu() {
    if (!Array.isArray(mulufile)) {
        customAlert("无效的文件格式");
        return;
    }
    if (mulufile.length === 0) {
        // 空数组，不加载任何目录
        return;
    }
    if (mulufile[0][0] !== "mulu") {
        customAlert("文件格式错误：第一个目录必须以'mulu'开头");
        return;
    }
    let error = 0;
    let warning = 0;
    let idName
    let muluss = document.querySelectorAll(".mulu");
    for (let i = 0; i < muluss.length; i++) {
        muluss[i].remove();
    }
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length == 4) {
            if (mulufile[i][2] == "mulufirststep" || mulufile[i][0] == "mulufirststep") {
                warning++;
            }
            
            // 使用data属性查找父目录，而不是类名
            let parentElement = null;
            if (i > 0 && mulufile[i][0] !== "mulu") {
                // 查找父目录元素
                let parentElements = document.querySelectorAll(`[data-dir-id="${mulufile[i][0]}"]`);
                if (parentElements.length > 0) {
                    parentElement = parentElements[0];
                }
            }
            
            // 创建新目录元素，只使用基础类名 "mulu"
            if (i == 0) {
                idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
            } else {
                if (parentElement) {
                    // 如果有父目录，插入到父目录的最后一个子目录后面
                    let siblings = findChildElementsByParentId(mulufile[i][0]);
                    if (siblings.length > 0) {
                        idName = creatDivByIdBefore(siblings[siblings.length - 1].id, getOneId(10, 0), "mulu");
                    } else {
                        // 如果没有兄弟节点，插入到父目录后面
                        idName = creatDivByIdBefore(parentElement.id, getOneId(10, 0), "mulu");
                    }
                } else {
                    // 如果没有父目录，插入到firststep
                    idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
                }
            }
            let newMulu = document.querySelector(`#${idName}`);
            newMulu.innerHTML = mulufile[i][1];
            
            // 设置层级
            let level = calculateLevel(mulufile[i][0], mulufile);
            newMulu.setAttribute("data-level", level);
            // 使用公式计算并设置偏移量
            setLevelPadding(newMulu, level);
            
            // 设置目录ID和父目录ID（用于查找子目录）
            newMulu.setAttribute("data-dir-id", mulufile[i][2]); // 当前目录的ID
            newMulu.setAttribute("data-parent-id", mulufile[i][0]); // 父目录的ID
            
            // 检查是否有子目录
            let hasChildren = false;
            for (let j = 0; j < mulufile.length; j++) {
                if (j !== i && mulufile[j].length === 4 && mulufile[j][0] === mulufile[i][2]) {
                    hasChildren = true;
                    break;
                }
            }
            if (hasChildren) {
                newMulu.classList.add("has-children");
                newMulu.classList.add("expanded"); // 默认展开
            }
            // 使用定时器来区分单击和双击
            let clickTimer = null;
            newMulu.addEventListener("mouseup", function (e) {
                if (e.button == 0) {
                    // 检查是否点击在三角区域（左侧20px内）
                    let clickX = e.offsetX || (e.clientX - newMulu.getBoundingClientRect().left);
                    let isClickOnTriangle = clickX < 20;
                    
                    // 如果有子目录且点击在三角区域，切换折叠/展开
                    if (newMulu.classList.contains("has-children") && isClickOnTriangle) {
                        e.stopPropagation();
                        // 清除单击定时器，避免与双击冲突
                        if (clickTimer) {
                            clearTimeout(clickTimer);
                            clickTimer = null;
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
                    if (clickTimer) {
                        clearTimeout(clickTimer);
                    }
                    clickTimer = setTimeout(function() {
                        // 在切换目录之前，先保存当前目录的内容
                        if (currentMuluName) {
                            let currentMulu = document.querySelector(`#${currentMuluName}`);
                            if (currentMulu) {
                                syncPreviewToTextarea(); // 保存当前目录的内容
                            }
                        }
                        // 正常选择目录
                        currentMuluName = newMulu.id;
                        RemoveOtherSelect();
                        newMulu.classList.add("select");
                        jiedianwords.value = mulufile[i][3];
                    isUpdating = true;
                    updateMarkdownPreview();
                    isUpdating = false;
                        clickTimer = null;
                    }, 300); // 300ms延迟，如果在这期间有双击则取消

                } else if (e.button == 2) {
                    // 清除单击定时器
                    if (clickTimer) {
                        clearTimeout(clickTimer);
                        clickTimer = null;
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
                    jiedianwords.value = mulufile[i][3];
                    isUpdating = true;
                    updateMarkdownPreview();
                    isUpdating = false;
                    rightMouseMenu(e);
                }
            })
            newMulu.addEventListener("dblclick", function (e) {
                e.preventDefault(); // 阻止默认事件
                e.stopPropagation(); // 阻止事件冒泡
                // 清除单击定时器，避免触发单击操作
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                // 如果当前正在编辑这个目录，先保存内容
                if (currentMuluName === newMulu.id) {
                    syncPreviewToTextarea();
                }
                oldName = newMulu.innerHTML;
                customPrompt("新的名字", oldName).then(newName => {
                    if (!newName || newName.length === 0) {
                        newMulu.innerHTML = oldName;
                        return;
                    }
                    if (!ChangeChildName(currentMuluName, newName)) {
                        newMulu.innerHTML = oldName;
                        return;
                    }
                    newMulu.innerHTML = newName;
                });
            })



        } else {
            error++;
        }
    }
    DuplicateMuluHints();
    if (error == 0 && warning == 0) {
        console.log(`error:${error},warning:${warning}`);
    } else {
        console.warn(`error:${error},warning:${warning}`);

    }
}

// DOMContentLoaded 初始化已在 main.js 中定义
