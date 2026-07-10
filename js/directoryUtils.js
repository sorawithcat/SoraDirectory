/** 根目录ID到颜色的映射缓存 */
const rootColorMap = new Map();
/**
 * 查找目录的根目录ID
 * @param {HTMLElement} element - 目录元素
 * @returns {string} - 根目录ID，如果本身是根目录则返回自己的ID
 */
function findRootDirId(element) {
    let parentId = element.getAttribute("data-parent-id");
    if (!parentId || parentId === "mulu") {
        return element.getAttribute("data-dir-id");
    }
    let currentParentId = parentId;
    let visited = new Set();
    while (currentParentId && currentParentId !== "mulu" && !visited.has(currentParentId)) {
        visited.add(currentParentId);
        let parentElement = document.querySelector(`[data-dir-id="${currentParentId}"]`);
        if (parentElement) {
            let grandParentId = parentElement.getAttribute("data-parent-id");
            if (!grandParentId || grandParentId === "mulu") {
                return currentParentId;
            }
            currentParentId = grandParentId;
        } else {
            break;
        }
    }
    return currentParentId;
}
/**
 * 根据字符串生成哈希值
 * @param {string} str - 输入字符串
 * @returns {number} - 哈希值 (0-1之间的小数)
 */
function stringToHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}
/**
 * 根据根目录ID动态生成一个唯一的强调色
 * 使用 HSL 颜色模式，固定饱和度和亮度，只变化色相
 * @param {string} rootId - 根目录ID
 * @returns {string} - HSL颜色值
 */
function getRootColor(rootId) {
    if (!rootId) {
        return '#94a3b8';
    }
    if (rootColorMap.has(rootId)) {
        return rootColorMap.get(rootId);
    }
    let hash = stringToHash(rootId);
    let hue = hash % 360;
    let saturation = 52 + (hash % 18);
    let lightness = 42 + (hash % 10);
    let color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    rootColorMap.set(rootId, color);
    return color;
}
/**
 * 为目录元素设置根目录强调色
 * @param {HTMLElement} element - 目录元素
 */
function setParentColorBall(element) {
    let parentId = element.getAttribute("data-parent-id");
    let rootId = (!parentId || parentId === "mulu")
        ? element.getAttribute("data-dir-id")
        : findRootDirId(element);
    let color = getRootColor(rootId);
    element.style.removeProperty('background-color');
    element.style.setProperty('--root-accent', color);
}
/**
 * 更新目录数据（基于 data-dir-id 查找）
 * 使用 Map 缓存加速查找
 * @param {HTMLElement} element - 目录 DOM 元素
 * @param {string} newContent - 新的内容
 * @returns {boolean} - 是否更新成功
 */
function updateMulufileData(element, newContent) {
    const dirId = element.getAttribute("data-dir-id");
    if (!dirId) {
        console.warn('updateMulufileData: dirId 为空');
        return false;
    }
    const data = getMulufileByDirId(dirId);
    if (data) {
        const oldContent = data[3];
        const cleanedContent = typeof normalizeEditorHtmlForStorage === 'function'
            ? normalizeEditorHtmlForStorage(newContent)
            : newContent;
        const comparableOldContent = typeof normalizeEditorHtmlForStorage === 'function'
            ? normalizeEditorHtmlForStorage(oldContent)
            : oldContent;
        if (comparableOldContent !== cleanedContent) {
            data[3] = cleanedContent;
            if (typeof markUnsavedChanges === 'function') {
                markUnsavedChanges();
            }
            if (cleanedContent && cleanedContent.includes('<video')) {
                console.log('updateMulufileData: 已保存视频内容到 mulufile');
                console.log('  - dirId:', dirId);
                console.log('  - 内容长度:', cleanedContent.length);
            }
        }
        return true;
    }
    console.warn('updateMulufileData: 未找到数据', dirId);
    return false;
}
/**
 * 查找目录数据（基于 data-dir-id 查找）
 * 使用 Map 缓存加速查找
 * @param {HTMLElement} element - 目录 DOM 元素
 * @returns {string} - 目录内容，未找到返回空字符串
 */
function findMulufileData(element) {
    const dirId = element.getAttribute("data-dir-id");
    if (!dirId) return "";
    const data = getMulufileByDirId(dirId);
    return data ? data[3] : "";
}
/**
 * 根据父目录ID查找所有直接子目录元素
 * @param {string} parentId - 父目录的 data-dir-id
 * @returns {HTMLElement[]} - 子目录元素数组
 */
function findChildElementsByParentId(parentId) {
    let children = [];
    let allMulus = document.querySelectorAll(".mulu");
    for (let i = 0; i < allMulus.length; i++) {
        let mulu = allMulus[i];
        let parentIdAttr = mulu.getAttribute("data-parent-id");
        if (parentIdAttr === parentId) {
            children.push(mulu);
        }
    }
    return children;
}
/**
 * 切换子目录的显示/隐藏状态（递归处理）
 * @param {string} parentId - 父目录的 data-dir-id
 * @param {boolean} show - true 显示，false 隐藏
 */
function toggleChildDirectories(parentId, show) {
    if (!parentId) return;
    let children = findChildElementsByParentId(parentId);
    if (children.length === 0) return;
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        if (show) {
            child.style.display = "block";
            if (child.classList.contains("has-children") && child.classList.contains("expanded")) {
                let childId = child.getAttribute("data-dir-id");
                if (childId) {
                    toggleChildDirectories(childId, true);
                }
            }
        } else {
            child.style.display = "none";
            let childId = child.getAttribute("data-dir-id");
            if (childId) {
                toggleChildDirectories(childId, false);
            }
        }
    }
}
/**
 * 移除所有目录的选中状态
 */
function RemoveOtherSelect() {
    let mulus = document.querySelectorAll(".mulu");
    for (let i = 0; i < mulus.length; i++) {
        mulus[i].classList.remove("select");
    }
}
/**
 * 检测并提示重复的目录名
 * @returns {boolean} - 是否存在重复目录名
 */
function DuplicateMuluHints() {
    let allparentmulu = [];
    let allparentmuluID = [];
    let duplicateMulu = [];
    let duplicateMuluID = [];
    let childs = firststep.children;
    for (let i = 0; i < childs.length; i++) {
        allparentmulu.push(document.getElementById(childs[i].id).innerHTML);
        allparentmuluID.push(childs[i].id);
    }
    const elementCount = {};
    for (let i = 0; i < allparentmulu.length; i++) {
        const element = allparentmulu[i];
        if (elementCount[element]) {
            duplicateMuluID.push(allparentmuluID[i]);
            elementCount[element]++;
        } else {
            elementCount[element] = 1;
        }
    }
    for (let key in elementCount) {
        if (elementCount[key] > 1) {
            duplicateMulu.push(key);
        }
    }
    if (duplicateMulu.length !== 0) {
        for (let i = 0; i < duplicateMulu.length; i++) {
            console.warn(`重复目录名：${duplicateMulu[i]}    重复数量：${elementCount[duplicateMulu[i]] - 1}   其ID为：${duplicateMuluID[i]}    所在位置（悬浮显示）：`);
            console.warn(document.getElementById(duplicateMuluID[i]));
        }
        showToast(`存在 ${duplicateMulu.length} 个重复目录名`, "warning", 3000);
        return true;
    } else {
        console.log("无重复目录");
        return false;
    }
}
/**
 * 检查目录名是否已存在
 * @param {string} name - 要检查的目录名
 * @returns {boolean} - 是否重复
 */
function isDuplicateName(name) {
    let allNames = [];
    let mulus = document.querySelectorAll(".mulu");
    for (let i = 0; i < mulus.length; i++) {
        allNames.push(mulus[i].innerHTML);
    }
    return allNames.includes(name);
}
/**
 * 修改目录名称（同时更新数据和子目录引用）
 * @param {string} idname - 目录元素的 DOM ID
 * @param {string} newName - 新的目录名
 * @returns {boolean} - 是否修改成功
 */
function ChangeChildName(idname = "", newName = "") {
    let currentMulu = document.getElementById(idname);
    if (!currentMulu) return false;
    if (currentMulu.innerHTML === newName) {
        return false;
    }
    let hasDuplicate = isDuplicateName(newName);
    let currentDirId = currentMulu.getAttribute("data-dir-id");
    for (let i = 0; i < mulufile.length; i++) {
        let item = mulufile[i];
        if (item.length === 4) {
            if (item[2] === currentDirId) {
                mulufile[i][1] = newName;
                break;
            }
        }
    }
    if (hasDuplicate) {
        showToast("已存在同名目录", "warning", 2500);
    }
    return true;
}
/**
 * 为目录元素绑定标准事件
 * - 左键单击：选择目录 / 点击三角折叠展开
 * - 左键双击：重命名目录
 * - 右键单击：显示右键菜单
 * - 拖拽：移动目录
 * 
 * @param {HTMLElement} muluElement - 目录 DOM 元素
 * @param {number} mulufileIndex - 在 mulufile 数组中的索引（可选，-1 表示动态查找）
 */
function bindMuluEvents(muluElement, mulufileIndex = -1) {
    let clickTimer = null;
    if (typeof bindDragEvents === 'function') {
        bindDragEvents(muluElement);
    }
    muluElement.addEventListener("mouseup", function(e) {
        if (e.button === 0) {
            let clickX = e.offsetX || (e.clientX - muluElement.getBoundingClientRect().left);
            let isClickOnTriangle = clickX < 20;
            if (muluElement.classList.contains("has-children") && isClickOnTriangle) {
                e.stopPropagation();
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                let isExpanded = muluElement.classList.contains("expanded");
                let dirId = muluElement.getAttribute("data-dir-id");
                if (isExpanded) {
                    muluElement.classList.remove("expanded");
                    if (dirId) toggleChildDirectories(dirId, false);
                } else {
                    muluElement.classList.add("expanded");
                    if (dirId) toggleChildDirectories(dirId, true);
                }
                return;
            }
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(function() {
                const done = typeof switchToDirectoryElement === 'function'
                    ? switchToDirectoryElement(muluElement, { syncCurrent: true, scrollPreviewTop: true, forceRender: true })
                    : Promise.resolve(false);
                Promise.resolve(done).catch(err => {
                    console.error('切换目录失败:', err);
                    if (typeof showToast === 'function') {
                        showToast('切换目录失败', 'error', 2000);
                    }
                });
                clickTimer = null;
            }, 300);
        } else if (e.button === 2) {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            const done = typeof switchToDirectoryElement === 'function'
                ? switchToDirectoryElement(muluElement, { syncCurrent: true, scrollPreviewTop: true, forceRender: true })
                : Promise.resolve(false);
            Promise.resolve(done)
                .catch(err => {
                    console.error('右键切换目录失败:', err);
                    if (typeof showToast === 'function') {
                        showToast('切换目录失败', 'error', 2000);
                    }
                })
                .finally(() => {
                    rightMouseMenu(e);
                });
        }
    });
    muluElement.addEventListener("dblclick", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
        }
        if (currentMuluName === muluElement.id) {
            syncPreviewToTextarea();
        }
        let oldName = muluElement.innerHTML;
        customPrompt("新的名字", oldName).then(newName => {
            if (!newName || newName.length === 0) {
                muluElement.innerHTML = oldName;
                return;
            }
            if (!ChangeChildName(muluElement.id, newName)) {
                muluElement.innerHTML = oldName;
                return;
            }
            muluElement.innerHTML = newName;
        });
    });
}
