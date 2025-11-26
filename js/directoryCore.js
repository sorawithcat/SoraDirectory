// ============================================
// 目录核心模块 (directoryCore.js)
// 功能：目录加载、层级计算等核心功能
// 依赖：globals.js, directoryUtils.js, SoraDirectoryJS.js
// ============================================

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
    let visited = new Set(); // 防止循环引用
    
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
        
        // 安全限制，防止无限循环
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
 */
function LoadMulu() {
    // 验证数据格式
    if (!Array.isArray(mulufile)) {
        customAlert("无效的文件格式");
        return;
    }
    
    if (mulufile.length === 0) {
        return; // 空数组，不加载
    }
    
    if (mulufile[0][0] !== "mulu") {
        customAlert("文件格式错误：第一个目录必须以'mulu'开头");
        return;
    }
    
    let error = 0;
    let warning = 0;
    let idName;
    
    // 清除现有目录
    let muluss = document.querySelectorAll(".mulu");
    for (let i = 0; i < muluss.length; i++) {
        muluss[i].remove();
    }
    
    // 遍历数据创建目录
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length == 4) {
            // 检查保留字
            if (mulufile[i][2] == "mulufirststep" || mulufile[i][0] == "mulufirststep") {
                warning++;
            }
            
            // 查找父目录元素
            let parentElement = null;
            if (i > 0 && mulufile[i][0] !== "mulu") {
                let parentElements = document.querySelectorAll(`[data-dir-id="${mulufile[i][0]}"]`);
                if (parentElements.length > 0) {
                    parentElement = parentElements[0];
                }
            }
            
            // 创建目录元素
            if (i == 0) {
                // 第一个目录，直接添加到 firststep
                idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
            } else {
                if (parentElement) {
                    // 有父目录，插入到父目录的最后一个子目录后面
                    let siblings = findChildElementsByParentId(mulufile[i][0]);
                    if (siblings.length > 0) {
                        idName = creatDivByIdBefore(siblings[siblings.length - 1].id, getOneId(10, 0), "mulu");
                    } else {
                        idName = creatDivByIdBefore(parentElement.id, getOneId(10, 0), "mulu");
                    }
                } else {
                    // 没有父目录，添加到 firststep
                    idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
                }
            }
            
            let newMulu = document.querySelector(`#${idName}`);
            newMulu.innerHTML = mulufile[i][1];
            
            // 设置层级和缩进
            let level = calculateLevel(mulufile[i][0], mulufile);
            newMulu.setAttribute("data-level", level);
            setLevelPadding(newMulu, level);
            
            // 设置数据属性
            newMulu.setAttribute("data-dir-id", mulufile[i][2]);    // 当前目录ID
            newMulu.setAttribute("data-parent-id", mulufile[i][0]); // 父目录ID
            
            // 设置颜色小球
            setParentColorBall(newMulu);
            
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
            
            // 绑定事件
            bindMuluEvents(newMulu, i);

        } else {
            error++;
        }
    }
    
    // 检查重复目录名
    DuplicateMuluHints();
    
    // 输出加载结果
    if (error == 0 && warning == 0) {
        console.log(`加载完成 - 错误: ${error}, 警告: ${warning}`);
    } else {
        console.warn(`加载完成 - 错误: ${error}, 警告: ${warning}`);
    }
}

// 注意：DOMContentLoaded 初始化在 main.js 中定义
