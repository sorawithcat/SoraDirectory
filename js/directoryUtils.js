// ============================================
// directoryUtils 模块 (directoryUtils.js)
// ============================================

// 辅助函数：安全获取类名
function getClassNames(element) {
    let classList = Array.from(element.classList);
    // 过滤掉 "mulu" 和 "select" 类名
    let filtered = classList.filter(c => c !== "mulu" && c !== "select");
    return {
        parentClass: filtered[0] || null,
        selfClass: filtered[1] || filtered[0] || null,
        isTopLevel: filtered.length === 1 && filtered[0] !== null
    };
}

// 辅助函数：从mulufile中查找并更新数据 - 基于data属性
function updateMulufileData(element, newContent) {
    let dirId = element.getAttribute("data-dir-id");
    let name = element.innerHTML;
    
    if (!dirId) return false;
    
    for (let i = 0; i < mulufile.length; i++) {
        let item = mulufile[i];
        if (item.length === 4 && item[2] === dirId && item[1] === name) {
            mulufile[i][3] = newContent;
            return true;
        }
    }
    return false;
}

// 辅助函数：从mulufile中查找数据 - 基于data属性
function findMulufileData(element) {
    let dirId = element.getAttribute("data-dir-id");
    let name = element.innerHTML;
    
    if (!dirId) return "";
    
    for (let i = 0; i < mulufile.length; i++) {
        let item = mulufile[i];
        if (item.length === 4 && item[2] === dirId && item[1] === name) {
            return item[3];
        }
    }
    return "";
}

// 根据目录ID查找所有子目录元素
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

// 改进的显示/隐藏子目录函数 - 基于data属性
function toggleChildDirectories(parentId, show) {
    if (!parentId) return;
    
    let children = findChildElementsByParentId(parentId);
    if (children.length === 0) return; // 没有子目录
    
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        
        // 设置显示/隐藏
        if (show) {
            child.style.display = "block";
            // 如果子目录本身是展开的，也展开它的子目录
            if (child.classList.contains("has-children") && child.classList.contains("expanded")) {
                let childId = child.getAttribute("data-dir-id");
                if (childId) {
                    toggleChildDirectories(childId, true);
                }
            }
        } else {
            child.style.display = "none";
            // 递归隐藏所有子目录
            let childId = child.getAttribute("data-dir-id");
            if (childId) {
                toggleChildDirectories(childId, false);
            }
        }
    }
}

//区分文件夹和文件 - 基于data属性
function AddListStyleForFolder() {
    let allMulus = document.querySelectorAll(".mulu");
    let processedDirs = new Set();
    
    for (let i = 0; i < allMulus.length; i++) {
        let mulu = allMulus[i];
        let dirId = mulu.getAttribute("data-dir-id");
        
        if (dirId && !processedDirs.has(dirId)) {
            // 检查是否有子目录
            let children = findChildElementsByParentId(dirId);
            if (children.length > 0) {
                mulu.style.fontStyle = "italic";
                processedDirs.add(dirId);
            }
        }
    }
}

//添加select分类
function RemoveOtherSelect() {
    let mulus = document.querySelectorAll(".mulu");
    for (let i = 0; i < mulus.length; i++) {
        mulus[i].classList.remove("select");
    }
}

//重复目录名提示
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

    // 遍历数组并计数
    for (let i = 0; i < allparentmulu.length; i++) {
        const element = allparentmulu[i];
        if (elementCount[element]) {
            duplicateMuluID.push(allparentmuluID[i]);
            elementCount[element]++;
        } else {
            elementCount[element] = 1;
        }
    }
    // 找出重复的元素
    for (let key in elementCount) {
        if (elementCount[key] > 1) {
            duplicateMulu.push(key);
        }
    }
    // 显示结果
    if (duplicateMulu.length != 0) {
        for (let i = 0; i < duplicateMulu.length; i++) {
            console.warn(`重复目录名：${duplicateMulu[i]}    重复数量：${elementCount[duplicateMulu[i]] - 1}   其ID为：${duplicateMuluID[i]}    所在位置（悬浮显示）：`);
            console.warn(document.getElementById(duplicateMuluID[i]));
        }
        customAlert(`重复目录名（按F12 > 控制台了解详情）: ${duplicateMulu.join(` , `)}`);
        return true;
    } else {
        console.log("无重复目录");
        return false;
    }
}

//检查目录名是否重复
function isDuplicateName(name) {
    let allNames = [];
    let mulus = document.querySelectorAll(".mulu");
    for (let i = 0; i < mulus.length; i++) {
        allNames.push(mulus[i].innerHTML);
    }
    return allNames.includes(name);
}

//修改目录名 - 基于data属性
function ChangeChildName(idname = "", newName = "") {
    // 检查新名称是否与当前目录名相同
    let currentMulu = document.getElementById(idname);
    if (!currentMulu) return false;
    
    if (currentMulu.innerHTML === newName) {
        return false; // 如果新名称与当前名称相同，返回false
    }
    
    // 检查新名称是否与其他目录重复
    if (isDuplicateName(newName)) {
        customAlert("目录名已存在，请使用其他名称");
        return false; // 如果重名，返回false
    }
    
    let currentDirId = currentMulu.getAttribute("data-dir-id");
    let currentParentId = currentMulu.getAttribute("data-parent-id");
    let oldName = currentMulu.innerHTML;
    let newClassId = `mulu${newName}`;
    
    // 更新mulufile中的数据
    for (let i = 0; i < mulufile.length; i++) {
        let item = mulufile[i];
        if (item.length === 4) {
            // 更新当前目录的数据
            if (item[2] === currentDirId && item[1] === oldName) {
                mulufile[i][1] = newName;
                mulufile[i][2] = newClassId;
            }
            
            // 更新子目录的父目录ID（在mulufile中，子目录的item[0]是父目录ID）
            if (item[0] === currentDirId) {
                // 子目录的父目录ID需要更新为新的类ID
                mulufile[i][0] = newClassId;
            }
        }
    }
    
    // 更新DOM元素的data-dir-id和类名
    currentMulu.setAttribute("data-dir-id", newClassId);
    
    // 更新所有子目录的data-parent-id
    let children = findChildElementsByParentId(currentDirId);
    for (let i = 0; i < children.length; i++) {
        children[i].setAttribute("data-parent-id", newClassId);
    }
    
    return true; // 改名成功返回true
}

//初始隐藏子目录
function NoneChildMulu() {
    cutAllMulu.click();
}
