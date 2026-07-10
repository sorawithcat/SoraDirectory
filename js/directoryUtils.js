const DEFAULT_DIRECTORY_LEVEL_COLORS = [
    '#F9F9F9', '#F0D6DC', '#DBE8F5', '#DCEBD8',
    '#F3E5C7', '#E7DCF2', '#D7ECE8', '#F1D9C9'
];
const directoryLevelPaletteCache = new Map();

function normalizeDirectoryLevel(level) {
    const parsed = Number.parseInt(level, 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
}

function normalizeDirectoryColor(color) {
    const value = String(color || '').trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(value)) return value;
    if (/^#[0-9A-F]{3}$/.test(value)) {
        return '#' + value.slice(1).split('').map(char => char + char).join('');
    }
    return null;
}

function darkenDirectoryColor(color, ratio) {
    const normalized = normalizeDirectoryColor(color) || '#F9F9F9';
    const factor = Math.max(0, Math.min(1, 1 - ratio));
    const channels = [1, 3, 5].map(index => Math.round(parseInt(normalized.slice(index, index + 2), 16) * factor));
    return '#' + channels.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function getDirectoryTextColor(background) {
    const color = normalizeDirectoryColor(background) || '#F9F9F9';
    const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255);
    const linear = channels.map(channel => channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4));
    const luminance = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
    return luminance > 0.36 ? '#1F2933' : '#FFFFFF';
}

function getDirectoryLevelBackground(level) {
    const normalizedLevel = normalizeDirectoryLevel(level);
    const customColor = directoryLevelColors.get(normalizedLevel);
    return normalizeDirectoryColor(customColor)
        || DEFAULT_DIRECTORY_LEVEL_COLORS[normalizedLevel % DEFAULT_DIRECTORY_LEVEL_COLORS.length];
}

function getDirectoryLevelPalette(level) {
    const normalizedLevel = normalizeDirectoryLevel(level);
    const background = getDirectoryLevelBackground(normalizedLevel);
    const cacheKey = `${normalizedLevel}:${background}`;
    if (directoryLevelPaletteCache.has(cacheKey)) {
        return directoryLevelPaletteCache.get(cacheKey);
    }
    const selected = darkenDirectoryColor(background, 0.16);
    const palette = {
        bg: background,
        hover: darkenDirectoryColor(background, 0.08),
        selected,
        text: getDirectoryTextColor(selected)
    };
    directoryLevelPaletteCache.set(cacheKey, palette);
    return palette;
}

function refreshDirectoryLevelColors(level = null) {
    const targetLevel = level === null ? null : normalizeDirectoryLevel(level);
    document.querySelectorAll('.mulu').forEach(element => {
        const elementLevel = normalizeDirectoryLevel(element.getAttribute('data-level'));
        if (targetLevel === null || elementLevel === targetLevel) {
            setParentColorBall(element);
        }
    });
}

function setDirectoryLevelColor(level, color) {
    const normalizedLevel = normalizeDirectoryLevel(level);
    const normalizedColor = normalizeDirectoryColor(color);
    if (!normalizedColor || directoryLevelColors.get(normalizedLevel) === normalizedColor) return false;
    directoryLevelColors.set(normalizedLevel, normalizedColor);
    directoryLevelPaletteCache.clear();
    refreshDirectoryLevelColors(normalizedLevel);
    return true;
}

function resetDirectoryLevelColor(level) {
    const normalizedLevel = normalizeDirectoryLevel(level);
    if (!directoryLevelColors.delete(normalizedLevel)) return false;
    directoryLevelPaletteCache.clear();
    refreshDirectoryLevelColors(normalizedLevel);
    return true;
}

function serializeDirectoryLevelColors() {
    const result = {};
    Array.from(directoryLevelColors.keys()).sort((a, b) => a - b).forEach(level => {
        const color = normalizeDirectoryColor(directoryLevelColors.get(level));
        if (color) result[level] = color;
    });
    return result;
}

function loadDirectoryLevelColors(data, options = {}) {
    const merge = !!options.merge;
    if (!merge) directoryLevelColors.clear();
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.entries(data).forEach(([level, color]) => {
            if (!/^\d+$/.test(String(level))) return;
            const parsedLevel = Number(level);
            if (!Number.isInteger(parsedLevel) || parsedLevel < 0 || parsedLevel > 100) return;
            const normalizedLevel = normalizeDirectoryLevel(parsedLevel);
            const normalizedColor = normalizeDirectoryColor(color);
            if (normalizedColor && (!merge || !directoryLevelColors.has(normalizedLevel))) {
                directoryLevelColors.set(normalizedLevel, normalizedColor);
            }
        });
    }
    directoryLevelPaletteCache.clear();
}
/**
 * 为目录元素设置所属层级的整行背景色
 * @param {HTMLElement} element - 目录元素
 */
function setParentColorBall(element) {
    const level = normalizeDirectoryLevel(element.getAttribute('data-level'));
    const palette = getDirectoryLevelPalette(level);
    element.style.removeProperty('background-color');
    element.style.removeProperty('--root-accent');
    element.style.setProperty('--dir-bg', palette.bg);
    element.style.setProperty('--dir-hover-bg', palette.hover);
    element.style.setProperty('--dir-selected-bg', palette.selected);
    element.style.setProperty('--dir-text', palette.text);
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

function isDirectoryToggleHit(element, event) {
    if (!element.classList.contains('has-children')) return false;
    const rect = element.getBoundingClientRect();
    const x = Number.isFinite(event.clientX) ? event.clientX - rect.left : event.offsetX;
    return x >= 0 && x < 24;
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
            const isClickOnTriangle = isDirectoryToggleHit(muluElement, e);
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
        if (isDirectoryToggleHit(muluElement, e)) {
            return;
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
