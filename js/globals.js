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

function sanitizeEditorFragment(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('script, iframe, object, embed, meta, base, link').forEach(el => el.remove());
    const urlAttributes = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'data', 'poster', 'background']);
    root.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || name === 'srcdoc') {
                el.removeAttribute(attr.name);
                return;
            }
            if (!urlAttributes.has(name)) return;
            const value = attr.value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
            if (/^(javascript|vbscript):/.test(value) ||
                /^data:(text\/html|application\/xhtml\+xml|image\/svg\+xml)/.test(value)) {
                el.removeAttribute(attr.name);
            }
        });
    });
}

function needsEditorHtmlSanitizing(html) {
    return /<\s*(script|iframe|object|embed|meta|base|link)\b|\son[a-z][\w:-]*\s*=|\ssrcdoc\s*=|\s(?:href|src|xlink:href|action|formaction|data|poster|background)\s*=\s*["']?\s*(?:j|v|&#|data\s*:\s*(?:text\/html|application\/xhtml\+xml|image\/svg\+xml))/i.test(String(html || ''));
}

function sanitizeEditorHtml(html) {
    const source = String(html || '');
    if (!needsEditorHtmlSanitizing(source)) return source;
    const template = document.createElement('template');
    template.innerHTML = source;
    sanitizeEditorFragment(template.content);
    return template.innerHTML;
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
        setTimeout(callback, 16); 
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
            const widthRatio = maxWidth / width;
            const heightRatio = maxHeight / height;
            const ratio = Math.min(widthRatio, heightRatio, 1);
            if (ratio < 1) {
                img.style.width = (width * ratio) + 'px';
                img.style.height = 'auto';
            } else {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            }
            resolve();
        };
        if (img.complete && img.naturalWidth > 0) {
            applySizeLimit();
        } else {
            img.onload = applySizeLimit;
            img.onerror = () => resolve();
        }
    });
}
/** 目录数据数组，格式：[[父ID, 名称, ID, 内容], ...] */
let mulufile = [];
/** 用户自定义的同级目录背景色，键为目录层级 */
const directoryLevelColors = new Map();
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
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4 && mulufile[i][2] === dirId) {
            return mulufile[i];
        }
    }
    return null;
}
let currentMuluName = null;
let isUpdating = false;
let directoryClipboard = null;
const body = document.querySelector("body");
const allThins = body.querySelectorAll("*");
const bigbox = document.querySelector(".bigbox");           
const showbox = document.querySelector(".showbox");         
const mulus = document.querySelectorAll(".mulu");           
const firststep = document.querySelector(".firststep");     
const mulubox = document.querySelector(".mulubox");         
const addNewMuluButton = document.querySelector(".addNewMuluButton");   
const addNewPotsButton = document.querySelector(".addNewPotsButton");   
const newBtn = document.getElementById("newBtn");                       
const topSaveBtn = document.getElementById("saveBtn");                  
const saveAsBtn = document.getElementById("saveAsBtn");                 
const topLoadBtn = document.getElementById("loadBtn");                  
const helpBtn = document.getElementById("helpBtn");
const fileNameInput = document.getElementById("fileNameInput");         
const expandAllBtn = document.getElementById("expandAllBtn");           
const collapseAllBtn = document.getElementById("collapseAllBtn");       
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");   
const fullscreenBtn = document.getElementById("fullscreenBtn");         
const topImageUploadBtn = document.getElementById("topImageUploadBtn"); 
const topLinkBtn = document.getElementById("topLinkBtn");               
const topToolbar = document.getElementById("topToolbar");               
const jiedianwords = document.querySelector(".jiedianwords");           
const markdownPreview = document.querySelector(".markdown-preview");     
const textFormatToolbar = document.querySelector(".text-format-toolbar"); 
const imageUploadBtn = document.getElementById("imageUploadBtn");        
const imageFileInput = document.getElementById("imageFileInput");        
const topVideoUploadBtn = document.getElementById("topVideoUploadBtn");  
const videoFileInput = document.getElementById("videoFileInput");        
const topMediaUploadBtn = document.getElementById("topMediaUploadBtn");
const mediaFileInput = document.getElementById("mediaFileInput");
const topArchiveUploadBtn = document.getElementById("topArchiveUploadBtn"); 
const archiveFileInput = document.getElementById("archiveFileInput");    
const wordsbox = document.querySelector(".wordsbox");                   
const rightmousemenu = document.querySelector(".rightmousemenu");       
const deleteMulu = document.querySelector(".deleteMulu");               
const changeMuluColor = document.querySelector(".changeMuluColor");
const resetMuluColor = document.querySelector(".resetMuluColor");
const noneRightMouseMenu = document.querySelector(".noneRightMouseMenu"); 
const expandThisMulu = document.querySelector(".expandThisMulu");       
const collapseThisMulu = document.querySelector(".collapseThisMulu");   
const copyMuluWithChildren = document.querySelector(".copyMuluWithChildren");       
const copyMuluWithoutChildren = document.querySelector(".copyMuluWithoutChildren"); 
const copyMuluId = document.querySelector(".copyMuluId");
const pasteMulu = document.querySelector(".pasteMulu");                             
const quickDuplicateWithChildren = document.querySelector(".quickDuplicateWithChildren");       
const quickDuplicateWithoutChildren = document.querySelector(".quickDuplicateWithoutChildren");
