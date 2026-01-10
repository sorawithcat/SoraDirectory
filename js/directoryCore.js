/**
 * 计算目录的层级深度
 * @param {string} parentId - 父目录ID
 * @param {Array} mulufile - 目录数据数组
 * @returns {number} - 层级深度（0 为根目录）
 */
function calculateLevel(parentId, mulufile) {
    if (parentId === "mulu") return 0;
    let level = 0;
    let currentParent = parentId;
    let visited = new Set(); 
    while (currentParent && currentParent !== "mulu" && !visited.has(currentParent)) {
        visited.add(currentParent);
        level++;
        for (let i = 0; i < mulufile.length; i++) {
            if (mulufile[i].length === 4 && mulufile[i][2] === currentParent) {
                currentParent = mulufile[i][0];
                break;
            }
        }
        if (level > 20) break;
    }
    return level;
}
/**
 * 根据层级设置目录的左侧缩进
 * 公式：基础偏移 20px + 每级增加 20px
 * @param {HTMLElement} element - 目录元素
 * @param {number} level - 层级深度
 */
function setLevelPadding(element, level) {
    let paddingLeft = 20 + (level * 20);
    element.style.paddingLeft = paddingLeft + 'px';
}
/**
 * 加载目录数据到页面
 * 从 mulufile 数组读取数据，创建目录 DOM 结构
 * 性能优化：减少DOM查询，预计算层级和父子关系
 */
function LoadMulu() {
    if (!Array.isArray(mulufile)) {
        customAlert("无效的文件格式");
        return;
    }
    if (mulufile.length === 0) {
        return; 
    }
    if (mulufile[0][0] !== "mulu") {
        customAlert("文件格式错误：第一个目录必须以'mulu'开头");
        return;
    }
    let error = 0;
    let warning = 0;
    const firststep = document.querySelector(".firststep");
    if (firststep) {
        firststep.innerHTML = '';
    }
    const dirMap = new Map(); 
    const childrenMap = new Map(); 
    const levelCache = new Map(); 
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4) {
            const dirData = {
                index: i,
                parentId: mulufile[i][0],
                name: mulufile[i][1],
                dirId: mulufile[i][2],
                content: mulufile[i][3]
            };
            dirMap.set(mulufile[i][2], dirData);
            if (!childrenMap.has(mulufile[i][0])) {
                childrenMap.set(mulufile[i][0], []);
            }
            childrenMap.get(mulufile[i][0]).push(dirData);
            if (mulufile[i][2] === "mulufirststep" || mulufile[i][0] === "mulufirststep") {
                warning++;
            }
            const level = calculateLevel(mulufile[i][0], mulufile);
            levelCache.set(mulufile[i][2], level);
        } else {
            error++;
        }
    }
    const dirElementMap = new Map(); 
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4) {
            const dirData = dirMap.get(mulufile[i][2]);
            if (!dirData) continue;
            const idName = getOneId(10, 0);
            const newMulu = document.createElement("div");
            newMulu.id = idName;
            newMulu.className = "mulu";
            newMulu.innerHTML = mulufile[i][1];
            const level = levelCache.get(mulufile[i][2]) || 0;
            newMulu.setAttribute("data-level", level);
            setLevelPadding(newMulu, level);
            newMulu.setAttribute("data-dir-id", mulufile[i][2]);
            newMulu.setAttribute("data-parent-id", mulufile[i][0]);
            setParentColorBall(newMulu);
            const hasChildren = childrenMap.has(mulufile[i][2]) && childrenMap.get(mulufile[i][2]).length > 0;
            if (hasChildren) {
                newMulu.classList.add("has-children");
                newMulu.classList.add("expanded"); 
            }
            if (i === 0) {
                if (firststep) {
                    firststep.appendChild(newMulu);
                }
            } else {
                const parentElement = dirElementMap.get(mulufile[i][0]);
                if (parentElement) {
                    const siblings = findChildElementsByParentId(mulufile[i][0]);
                    if (siblings.length > 0) {
                        const lastSibling = siblings[siblings.length - 1];
                        if (lastSibling && lastSibling.nextSibling) {
                            firststep.insertBefore(newMulu, lastSibling.nextSibling);
                        } else {
                            firststep.appendChild(newMulu);
                        }
                    } else {
                        if (parentElement.nextSibling) {
                            firststep.insertBefore(newMulu, parentElement.nextSibling);
                        } else {
                            firststep.appendChild(newMulu);
                        }
                    }
                } else {
                    if (firststep) {
                        firststep.appendChild(newMulu);
                    }
                }
            }
            dirElementMap.set(mulufile[i][2], newMulu);
            bindMuluEvents(newMulu, i);
        }
    }
    rebuildMulufileIndex();
    DuplicateMuluHints();
    if (error === 0 && warning === 0) {
        console.log(`加载完成 - 错误: ${error}, 警告: ${warning}`);
    } else {
        console.warn(`加载完成 - 错误: ${error}, 警告: ${warning}`);
    }
}