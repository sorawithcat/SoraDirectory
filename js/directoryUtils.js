// ============================================
// 目录工具函数模块 (directoryUtils.js)
// 功能：目录操作的工具函数集合
// 依赖：globals.js
// ============================================

// -------------------- 根目录颜色相关 --------------------

/** 根目录ID到颜色的映射缓存 */
const rootColorMap = new Map();

/**
 * 查找目录的根目录ID
 * @param {HTMLElement} element - 目录元素
 * @returns {string} - 根目录ID，如果本身是根目录则返回自己的ID
 */
function findRootDirId(element) {
    let parentId = element.getAttribute("data-parent-id");
    
    // 如果本身就是根目录
    if (!parentId || parentId === "mulu") {
        return element.getAttribute("data-dir-id");
    }
    
    // 向上查找直到找到根目录
    let currentParentId = parentId;
    let visited = new Set();
    
    while (currentParentId && currentParentId !== "mulu" && !visited.has(currentParentId)) {
        visited.add(currentParentId);
        
        // 查找父目录元素
        let parentElement = document.querySelector(`[data-dir-id="${currentParentId}"]`);
        if (parentElement) {
            let grandParentId = parentElement.getAttribute("data-parent-id");
            if (!grandParentId || grandParentId === "mulu") {
                // 找到了根目录
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
 * 根据根目录ID动态生成一个唯一的浅色背景
 * 使用 HSL 颜色模式，固定饱和度和亮度，只变化色相
 * @param {string} rootId - 根目录ID
 * @returns {string} - HSL颜色值
 */
function getRootColor(rootId) {
    if (!rootId) {
        return '#f9f9f9';
    }
    
    // 检查缓存
    if (rootColorMap.has(rootId)) {
        return rootColorMap.get(rootId);
    }
    
    // 根据ID生成哈希，计算色相 (0-360)
    let hash = stringToHash(rootId);
    let hue = hash % 360;
    
    // 固定饱和度和亮度，生成柔和的浅色
    // 饱和度 40-60%，亮度 88-92%
    let saturation = 40 + (hash % 20);
    let lightness = 88 + (hash % 5);
    
    let color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    
    // 缓存结果
    rootColorMap.set(rootId, color);
    
    return color;
}

/**
 * 为目录元素设置背景色（根据根目录）
 * @param {HTMLElement} element - 目录元素
 */
function setParentColorBall(element) {
    let parentId = element.getAttribute("data-parent-id");
    
    // 根目录使用默认颜色
    if (!parentId || parentId === "mulu") {
        element.style.backgroundColor = '#f9f9f9';
        return;
    }
    
    // 查找根目录并设置颜色
    let rootId = findRootDirId(element);
    let color = getRootColor(rootId);
    element.style.backgroundColor = color;
}

/**
 * 更新目录数据（基于 data-dir-id 查找）
 * @param {HTMLElement} element - 目录 DOM 元素
 * @param {string} newContent - 新的内容
 * @returns {boolean} - 是否更新成功
 */
function updateMulufileData(element, newContent) {
    let dirId = element.getAttribute("data-dir-id");
    
    if (!dirId) return false;
    
    for (let i = 0; i < mulufile.length; i++) {
        let item = mulufile[i];
        // 只使用 dirId 查找，因为 dirId 是唯一的
        if (item.length === 4 && item[2] === dirId) {
            mulufile[i][3] = newContent;
            return true;
        }
    }
    return false;
}

/**
 * 查找目录数据（基于 data-dir-id 查找）
 * @param {HTMLElement} element - 目录 DOM 元素
 * @returns {string} - 目录内容，未找到返回空字符串
 */
function findMulufileData(element) {
    let dirId = element.getAttribute("data-dir-id");
    
    if (!dirId) return "";
    
    for (let i = 0; i < mulufile.length; i++) {
        let item = mulufile[i];
        // 只使用 dirId 查找，因为 dirId 是唯一的
        if (item.length === 4 && item[2] === dirId) {
            return item[3];
        }
    }
    return "";
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
            // 如果子目录本身是展开状态，也展开它的子目录
            if (child.classList.contains("has-children") && child.classList.contains("expanded")) {
                let childId = child.getAttribute("data-dir-id");
                if (childId) {
                    toggleChildDirectories(childId, true);
                }
            }
        } else {
            child.style.display = "none";
            // 递归隐藏所有后代目录
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

    // 收集所有目录名
    for (let i = 0; i < childs.length; i++) {
        allparentmulu.push(document.getElementById(childs[i].id).innerHTML);
        allparentmuluID.push(childs[i].id);
    }
    
    // 统计各目录名出现次数
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
    
    // 找出重复的目录名
    for (let key in elementCount) {
        if (elementCount[key] > 1) {
            duplicateMulu.push(key);
        }
    }
    
    // 显示重复提示（使用 toast）
    if (duplicateMulu.length != 0) {
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
    
    // 检查新名称是否与当前名称相同
    if (currentMulu.innerHTML === newName) {
        return false;
    }
    
    // 检查新名称是否与其他目录重复（仅提示，不阻止）
    let hasDuplicate = isDuplicateName(newName);
    
    let currentDirId = currentMulu.getAttribute("data-dir-id");
    // 保持原有的dirId不变，只更新名称
    // 这样可以保持父子关系的稳定性
    
    // 更新 mulufile 中的数据（只更新名称，不改变dirId）
    for (let i = 0; i < mulufile.length; i++) {
        let item = mulufile[i];
        if (item.length === 4) {
            // 更新当前目录的名称（只使用 dirId 查找，因为 dirId 是唯一的）
            if (item[2] === currentDirId) {
                mulufile[i][1] = newName;
                break;
            }
        }
    }
    
    // dirId 保持不变，不需要更新 DOM 和子目录引用
    
    // 显示重复提示（使用 toast）
    if (hasDuplicate) {
        showToast("已存在同名目录", "warning", 2500);
    }
    
    return true;
}


// ============================================
// 通用目录事件绑定函数
// ============================================

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
    
    // 绑定拖拽事件
    if (typeof bindDragEvents === 'function') {
        bindDragEvents(muluElement);
    }
    
    // 鼠标点击事件
    muluElement.addEventListener("mouseup", function(e) {
        if (e.button == 0) {
            // === 左键点击 ===
            
            // 检查是否点击在三角区域（左侧 20px 内）
            let clickX = e.offsetX || (e.clientX - muluElement.getBoundingClientRect().left);
            let isClickOnTriangle = clickX < 20;
            
            // 如果有子目录且点击在三角区域，切换折叠/展开
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
            
            // 延迟执行单击操作（区分单击和双击）
            if (clickTimer) clearTimeout(clickTimer);
            
            clickTimer = setTimeout(function() {
                // 切换目录前保存当前内容
                if (currentMuluName) {
                    let currentMulu = document.querySelector(`#${currentMuluName}`);
                    if (currentMulu) {
                        syncPreviewToTextarea();
                    }
                }
                
                // 选择目录
                currentMuluName = muluElement.id;
                RemoveOtherSelect();
                muluElement.classList.add("select");
                
                // 加载目录内容
                if (mulufileIndex >= 0 && mulufile[mulufileIndex]) {
                    jiedianwords.value = mulufile[mulufileIndex][3];
                } else {
                    jiedianwords.value = findMulufileData(muluElement);
                }
                
                isUpdating = true;
                updateMarkdownPreview();
                isUpdating = false;
                clickTimer = null;
            }, 300);

        } else if (e.button == 2) {
            // === 右键点击 ===
            
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            
            // 切换目录前保存当前内容
            if (currentMuluName) {
                let currentMulu = document.querySelector(`#${currentMuluName}`);
                if (currentMulu) {
                    syncPreviewToTextarea();
                }
            }
            
            // 选择目录并显示右键菜单
            currentMuluName = muluElement.id;
            RemoveOtherSelect();
            muluElement.classList.add("select");
            
            if (mulufileIndex >= 0 && mulufile[mulufileIndex]) {
                jiedianwords.value = mulufile[mulufileIndex][3];
            } else {
                jiedianwords.value = findMulufileData(muluElement);
            }
            
            isUpdating = true;
            updateMarkdownPreview();
            isUpdating = false;
            rightMouseMenu(e);
        }
    });
    
    // 双击重命名事件
    muluElement.addEventListener("dblclick", function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
        }
        
        // 保存当前内容
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
