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
        } else {
            error++;
        }
    }

    const resolvingLevels = new Set();
    function getLevelForDir(dirId) {
        if (levelCache.has(dirId)) {
            return levelCache.get(dirId);
        }
        if (resolvingLevels.has(dirId)) {
            console.warn('检测到目录父级循环:', dirId);
            levelCache.set(dirId, 0);
            return 0;
        }
        const dirData = dirMap.get(dirId);
        if (!dirData || !dirData.parentId || dirData.parentId === 'mulu') {
            levelCache.set(dirId, 0);
            return 0;
        }
        resolvingLevels.add(dirId);
        const level = getLevelForDir(dirData.parentId) + 1;
        resolvingLevels.delete(dirId);
        levelCache.set(dirId, Math.min(level, 20));
        return levelCache.get(dirId);
    }

    dirMap.forEach((_, dirId) => getLevelForDir(dirId));

    const orderedDirs = [];
    const visited = new Set();
    function appendChildren(parentId) {
        const children = childrenMap.get(parentId) || [];
        for (let i = 0; i < children.length; i++) {
            const dirData = children[i];
            if (!dirData || visited.has(dirData.dirId)) continue;
            visited.add(dirData.dirId);
            orderedDirs.push(dirData);
            appendChildren(dirData.dirId);
        }
    }
    appendChildren('mulu');
    for (let i = 0; i < mulufile.length; i++) {
        const row = mulufile[i];
        if (row && row.length === 4 && !visited.has(row[2])) {
            const dirData = dirMap.get(row[2]);
            if (dirData) {
                visited.add(row[2]);
                orderedDirs.push(dirData);
            }
        }
    }

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < orderedDirs.length; i++) {
        const dirData = orderedDirs[i];
        const idName = getOneId(10, 0);
        const newMulu = document.createElement("div");
        newMulu.id = idName;
        newMulu.className = "mulu";
        newMulu.textContent = dirData.name;
        const level = levelCache.get(dirData.dirId) || 0;
        newMulu.setAttribute("data-level", level);
        setLevelPadding(newMulu, level);
        newMulu.setAttribute("data-dir-id", dirData.dirId);
        newMulu.setAttribute("data-parent-id", dirData.parentId);
        setParentColorBall(newMulu);
        const hasChildren = childrenMap.has(dirData.dirId) && childrenMap.get(dirData.dirId).length > 0;
        if (hasChildren) {
            newMulu.classList.add("has-children");
            newMulu.classList.add("expanded");
        }
        bindMuluEvents(newMulu, dirData.index);
        fragment.appendChild(newMulu);
    }
    if (firststep) {
        firststep.appendChild(fragment);
    }
    rebuildMulufileIndex();
    DuplicateMuluHints();
    if (error === 0 && warning === 0) {
        console.log(`加载完成 - 错误: ${error}, 警告: ${warning}`);
    } else {
        console.warn(`加载完成 - 错误: ${error}, 警告: ${warning}`);
    }
}
