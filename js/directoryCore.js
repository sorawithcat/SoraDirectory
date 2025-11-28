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
 * 性能优化：减少DOM查询，预计算层级和父子关系
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
    
    // 清除现有目录（使用批量移除优化）
    const firststep = document.querySelector(".firststep");
    if (firststep) {
        // 一次性清除所有子元素，比逐个移除更高效
        firststep.innerHTML = '';
    }
    
    // 性能优化：预构建数据结构，减少循环中的计算
    const dirMap = new Map(); // dirId -> dirData
    const childrenMap = new Map(); // parentId -> [children dirData]
    const levelCache = new Map(); // dirId -> level
    
    // 第一遍：构建映射和预计算层级
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
            
            // 构建子目录映射
            if (!childrenMap.has(mulufile[i][0])) {
                childrenMap.set(mulufile[i][0], []);
            }
            childrenMap.get(mulufile[i][0]).push(dirData);
            
            // 检查保留字
            if (mulufile[i][2] === "mulufirststep" || mulufile[i][0] === "mulufirststep") {
                warning++;
            }
            
            // 预计算层级
            const level = calculateLevel(mulufile[i][0], mulufile);
            levelCache.set(mulufile[i][2], level);
        } else {
            error++;
        }
    }
    
    // 第二遍：创建DOM元素（保持原有插入逻辑以确保正确顺序）
    const dirElementMap = new Map(); // dirId -> HTMLElement
    
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4) {
            const dirData = dirMap.get(mulufile[i][2]);
            if (!dirData) continue;
            
            // 创建目录元素
            const idName = getOneId(10, 0);
            const newMulu = document.createElement("div");
            newMulu.id = idName;
            newMulu.className = "mulu";
            newMulu.innerHTML = mulufile[i][1];
            
            // 设置层级和缩进（使用缓存）
            const level = levelCache.get(mulufile[i][2]) || 0;
            newMulu.setAttribute("data-level", level);
            setLevelPadding(newMulu, level);
            
            // 设置数据属性
            newMulu.setAttribute("data-dir-id", mulufile[i][2]);
            newMulu.setAttribute("data-parent-id", mulufile[i][0]);
            
            // 设置颜色小球
            setParentColorBall(newMulu);
            
            // 检查是否有子目录（使用预构建的映射）
            const hasChildren = childrenMap.has(mulufile[i][2]) && childrenMap.get(mulufile[i][2]).length > 0;
            
            if (hasChildren) {
                newMulu.classList.add("has-children");
                newMulu.classList.add("expanded"); // 默认展开
            }
            
            // 插入到正确位置（使用原有逻辑，确保功能一致）
            if (i === 0) {
                // 第一个目录，直接添加到 firststep
                if (firststep) {
                    firststep.appendChild(newMulu);
                }
            } else {
                // 查找父目录元素（使用缓存）
                const parentElement = dirElementMap.get(mulufile[i][0]);
                
                if (parentElement) {
                    // 有父目录，插入到父目录的最后一个子目录后面
                    // 使用原有逻辑：查找同父的所有子目录，插入到最后一个后面
                    const siblings = findChildElementsByParentId(mulufile[i][0]);
                    if (siblings.length > 0) {
                        // 有兄弟，插入到最后一个兄弟后面
                        const lastSibling = siblings[siblings.length - 1];
                        if (lastSibling && lastSibling.nextSibling) {
                            firststep.insertBefore(newMulu, lastSibling.nextSibling);
                        } else {
                            firststep.appendChild(newMulu);
                        }
                    } else {
                        // 第一个子目录，插入到父目录后面
                        if (parentElement.nextSibling) {
                            firststep.insertBefore(newMulu, parentElement.nextSibling);
                        } else {
                            firststep.appendChild(newMulu);
                        }
                    }
                } else {
                    // 没有父目录，添加到 firststep
                    if (firststep) {
                        firststep.appendChild(newMulu);
                    }
                }
            }
            
            // 存储元素引用（在插入后）
            dirElementMap.set(mulufile[i][2], newMulu);
            
            // 绑定事件
            bindMuluEvents(newMulu, i);
        }
    }
    
    // 重建索引缓存
    rebuildMulufileIndex();
    
    // 检查重复目录名
    DuplicateMuluHints();
    
    // 输出加载结果
    if (error === 0 && warning === 0) {
        console.log(`加载完成 - 错误: ${error}, 警告: ${warning}`);
    } else {
        console.warn(`加载完成 - 错误: ${error}, 警告: ${warning}`);
    }
}

// 注意：DOMContentLoaded 初始化在 main.js 中定义
