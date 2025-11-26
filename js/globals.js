// ============================================
// 全局变量和DOM引用模块 (globals.js)
// 功能：定义全局变量、常量和DOM元素引用
// 依赖：无（需最先加载）
// ============================================

// -------------------- 常量配置 --------------------

/** 图片最大宽度（像素） */
const MAX_IMAGE_WIDTH = 800;

// -------------------- 公共工具函数 --------------------

/**
 * HTML 转义（防止 XSS）
 * @param {string} text - 原始文本
 * @returns {string} - 转义后的文本
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 防抖函数 - 延迟执行，多次调用只执行最后一次
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} - 防抖后的函数
 */
function debounce(func, wait = 150) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数 - 限制执行频率
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间间隔（毫秒）
 * @returns {Function} - 节流后的函数
 */
function throttle(func, limit = 100) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 使用 requestAnimationFrame 优化的批量 DOM 更新
 * @param {Function} callback - 要执行的回调函数
 */
function batchDOMUpdate(callback) {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(callback);
    } else {
        setTimeout(callback, 16); // 降级到 ~60fps
    }
}

/** 图片最大高度（像素） */
const MAX_IMAGE_HEIGHT = 600;

// -------------------- 公共函数 --------------------

/**
 * 限制图片大小但保持宽高比例
 * @param {HTMLImageElement} img - 图片元素
 * @param {number} maxWidth - 最大宽度，默认使用 MAX_IMAGE_WIDTH
 * @param {number} maxHeight - 最大高度，默认使用 MAX_IMAGE_HEIGHT
 * @returns {Promise<void>} - 图片处理完成后 resolve
 */
function limitImageSize(img, maxWidth = MAX_IMAGE_WIDTH, maxHeight = MAX_IMAGE_HEIGHT) {
    return new Promise((resolve) => {
        const applySizeLimit = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            
            if (width === 0 || height === 0) {
                resolve();
                return;
            }
            
            // 计算缩放比例（不放大，只缩小）
            const widthRatio = maxWidth / width;
            const heightRatio = maxHeight / height;
            const ratio = Math.min(widthRatio, heightRatio, 1);
            
            if (ratio < 1) {
                // 图片超过限制，按比例缩小
                img.style.width = (width * ratio) + 'px';
                img.style.height = 'auto';
            } else {
                // 图片在限制内，设置最大宽度为100%
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            }
            
            resolve();
        };
        
        // 判断图片是否已加载
        if (img.complete && img.naturalWidth > 0) {
            applySizeLimit();
        } else {
            img.onload = applySizeLimit;
            img.onerror = () => resolve();
        }
    });
}

// -------------------- 状态变量 --------------------

/** 目录数据数组，格式：[[父ID, 名称, ID, 内容], ...] */
let mulufile = [];

/** 目录数据索引缓存（通过 dirId 快速查找） */
const mulufileIndex = new Map();

/**
 * 重建 mulufile 索引缓存
 * 在 mulufile 发生变化后调用
 */
function rebuildMulufileIndex() {
    mulufileIndex.clear();
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4) {
            mulufileIndex.set(mulufile[i][2], i);
        }
    }
}

/**
 * 通过 dirId 快速查找 mulufile 中的数据
 * @param {string} dirId - 目录 ID
 * @returns {Array|null} - 目录数据或 null
 */
function getMulufileByDirId(dirId) {
    if (!dirId) return null;
    const index = mulufileIndex.get(dirId);
    if (index !== undefined && mulufile[index]) {
        return mulufile[index];
    }
    // 降级：遍历查找（缓存可能未更新）
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4 && mulufile[i][2] === dirId) {
            return mulufile[i];
        }
    }
    return null;
}

/** 当前选中的目录元素ID */
let currentMuluName = null;

/** 预览区域更新标志，防止循环更新 */
let isUpdating = false;

/** 目录剪贴板数据 */
let directoryClipboard = null;

// -------------------- DOM 元素引用 --------------------

// 基础容器
const body = document.querySelector("body");
const allThins = body.querySelectorAll("*");

// 目录区域
const bigbox = document.querySelector(".bigbox");           // 目录容器
const showbox = document.querySelector(".showbox");         // 显示区域
const mulus = document.querySelectorAll(".mulu");           // 所有目录元素
const firststep = document.querySelector(".firststep");     // 目录列表容器
const mulubox = document.querySelector(".mulubox");         // 目录主体

// 目录操作按钮
const addNewMuluButton = document.querySelector(".addNewMuluButton");   // 添加目录
const addNewPotsButton = document.querySelector(".addNewPotsButton");   // 添加节点

// 顶部工具栏按钮
const newBtn = document.getElementById("newBtn");                       // 新建
const topSaveBtn = document.getElementById("saveBtn");                  // 保存
const saveAsBtn = document.getElementById("saveAsBtn");                 // 另存为
const topLoadBtn = document.getElementById("loadBtn");                  // 加载
const fileNameInput = document.getElementById("fileNameInput");         // 文件名输入框
const expandAllBtn = document.getElementById("expandAllBtn");           // 展开全部
const collapseAllBtn = document.getElementById("collapseAllBtn");       // 收起全部
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");   // 切换侧边栏
const fullscreenBtn = document.getElementById("fullscreenBtn");         // 全屏
const topImageUploadBtn = document.getElementById("topImageUploadBtn"); // 顶部图片上传
const topLinkBtn = document.getElementById("topLinkBtn");               // 顶部链接按钮
const topToolbar = document.getElementById("topToolbar");               // 顶部工具栏

// 内容编辑区域
const jiedianwords = document.querySelector(".jiedianwords");           // 隐藏的 textarea
const markdownPreview = document.querySelector(".markdown-preview");     // 预览/编辑区域
const textFormatToolbar = document.querySelector(".text-format-toolbar"); // 悬浮格式工具栏
const imageUploadBtn = document.getElementById("imageUploadBtn");        // 图片上传按钮
const imageFileInput = document.getElementById("imageFileInput");        // 图片文件输入
const topVideoUploadBtn = document.getElementById("topVideoUploadBtn");  // 顶部视频上传按钮
const videoFileInput = document.getElementById("videoFileInput");        // 视频文件输入
const wordsbox = document.querySelector(".wordsbox");                   // 内容区域容器

// 右键菜单
const rightmousemenu = document.querySelector(".rightmousemenu");       // 右键菜单容器
const deleteMulu = document.querySelector(".deleteMulu");               // 删除目录
const noneRightMouseMenu = document.querySelector(".noneRightMouseMenu"); // 取消
const expandThisMulu = document.querySelector(".expandThisMulu");       // 展开此目录
const collapseThisMulu = document.querySelector(".collapseThisMulu");   // 收起此目录
const copyMuluWithChildren = document.querySelector(".copyMuluWithChildren");       // 复制（含子目录）
const copyMuluWithoutChildren = document.querySelector(".copyMuluWithoutChildren"); // 复制（不含子目录）
const pasteMulu = document.querySelector(".pasteMulu");                             // 粘贴目录
const quickDuplicateWithChildren = document.querySelector(".quickDuplicateWithChildren");       // 快速复制（含子目录）
const quickDuplicateWithoutChildren = document.querySelector(".quickDuplicateWithoutChildren"); // 快速复制（不含子目录）
