// ============================================
// 文件操作模块 (fileOperations.js)
// 功能：文件保存、加载、格式转换
// 依赖：globals.js, SoraDirectoryJS.js
// ============================================

// -------------------- File System Access API 支持 --------------------

/** 当前打开文件的句柄（用于直接保存） */
let currentFileHandle = null;

/** 当前文件名 */
let currentFileName = null;

/** 目录修改追踪（哈希映射） */
const directoryHashes = new Map();

/** 未保存更改标记 */
let hasUnsavedChanges = false;

/**
 * 检查浏览器是否支持 File System Access API
 * @returns {boolean}
 */
function isFileSystemAccessSupported() {
    return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * 计算字符串的简单哈希值（用于追踪变化）
 * @param {string} str - 输入字符串
 * @returns {string} - 哈希值
 */
function simpleHash(str) {
    if (!str) return '0';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
}

/**
 * 计算所有目录的哈希值并保存
 * 同时缓存原始内容用于差异计算
 */
function calculateAllHashes() {
    directoryHashes.clear();
    originalContentCache.clear();
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4) {
            const dirId = mulufile[i][2];
            const content = JSON.stringify(mulufile[i]);
            directoryHashes.set(dirId, simpleHash(content));
            // 同时缓存原始内容用于差异计算
            originalContentCache.set(dirId, mulufile[i][3] || '');
        }
    }
}

/**
 * 检查目录是否有变化
 * @param {string} dirId - 目录 ID
 * @returns {boolean} - 是否有变化
 */
function hasDirectoryChanged(dirId) {
    const dirData = getMulufileByDirId(dirId);
    if (!dirData) return false;
    
    const currentHash = simpleHash(JSON.stringify(dirData));
    const savedHash = directoryHashes.get(dirId);
    
    return currentHash !== savedHash;
}

/**
 * 获取所有已修改的目录
 * @returns {Array} - 已修改的目录 ID 列表
 */
function getModifiedDirectories() {
    const modified = [];
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4) {
            const dirId = mulufile[i][2];
            if (hasDirectoryChanged(dirId)) {
                modified.push(dirId);
            }
        }
    }
    return modified;
}

/**
 * 标记有未保存的更改
 */
function markUnsavedChanges() {
    if (!hasUnsavedChanges) {
        hasUnsavedChanges = true;
        updateSaveButtonState();
    }
}

/**
 * 清除未保存更改标记
 */
function clearUnsavedChanges() {
    hasUnsavedChanges = false;
    calculateAllHashes();
    updateSaveButtonState();
}

/**
 * 更新保存按钮状态（显示是否有未保存更改）
 */
function updateSaveButtonState() {
    if (topSaveBtn) {
        if (hasUnsavedChanges) {
            topSaveBtn.textContent = '保存 *';
            topSaveBtn.title = '有未保存的更改 (Ctrl+S)';
            topSaveBtn.style.color = '#e74c3c';
        } else {
            topSaveBtn.textContent = '保存';
            topSaveBtn.title = '保存 (Ctrl+S)';
            topSaveBtn.style.color = '';
        }
    }
    
    // 更新页面标题
    updatePageTitle();
}

/**
 * 更新页面标题（显示文件名和未保存状态）
 */
function updatePageTitle() {
    const baseName = currentFileName || 'SoraList';
    document.title = hasUnsavedChanges ? `* ${baseName}` : baseName;
}

/**
 * 使用 File System Access API 打开文件
 * @returns {Promise<boolean>} - 是否成功打开
 */
async function openFileWithFSAPI() {
    if (!isFileSystemAccessSupported()) {
        return false;
    }
    
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [
                {
                    description: 'SoraList 文件',
                    accept: {
                        'application/json': ['.json'],
                        'text/plain': ['.txt'],
                        'application/xml': ['.xml'],
                        'text/csv': ['.csv']
                    }
                }
            ],
            multiple: false
        });
        
        const file = await fileHandle.getFile();
        
        // 先检查缓存（仅对非加密文件使用缓存）
        let parsedData = null;
        let fromCache = false;
        
        // 检查是否是加密文件（需要先读取内容判断）
        const content = await file.text();
        const isEncrypted = isEncryptedContent(content);
        
        if (!isEncrypted && typeof FileCache !== 'undefined') {
            // 尝试从缓存获取
            parsedData = await FileCache.get(file);
            if (parsedData) {
                fromCache = true;
                console.log('FileCache: 从缓存加载文件', file.name);
            }
        }
        
        // 如果缓存中没有，则解析文件内容
        if (!parsedData) {
            // 解析文件内容（可能是 Promise，处理加密文件）
            parsedData = parseFileContent(content, file.name);
            if (parsedData instanceof Promise) {
                parsedData = await parsedData;
            }
            
            if (!parsedData) {
                // 用户取消解密
                return false;
            }
            
            // 将解析结果保存到缓存（仅对非加密文件）
            if (!isEncrypted && typeof FileCache !== 'undefined' && Array.isArray(parsedData)) {
                try {
                    await FileCache.set(file, parsedData);
                    console.log('FileCache: 已缓存文件', file.name);
                } catch (err) {
                    console.warn('FileCache: 缓存保存失败', err);
                }
            }
        }
        
        // 检查是否是差异补丁文件
        if (isDiffFile(parsedData)) {
            // 差异文件必须有现有数据才能应用
            if (!mulufile || mulufile.length === 0) {
                customAlert("差异补丁文件需要先加载基础数据才能应用");
                return false;
            }
            
            const result = applyDiffPatches(parsedData);
            
            // 重新加载目录
            LoadMulu();
            
            // 标记有未保存更改
            markUnsavedChanges();
            
            setTimeout(() => {
                if (typeof expandAllDirectories === 'function') expandAllDirectories();
                selectFirstRootDirectory();
            }, 10);
            
            bigbox.style.display = "block";
            wordsbox.style.display = "block";
            
            let msg = `已应用差异补丁：${result.applied} 个目录`;
            if (result.notFound > 0) msg += `（新建 ${result.notFound} 个）`;
            if (result.failed > 0) msg += `，${result.failed} 个失败`;
            showToast(msg, result.failed > 0 ? 'warning' : 'success', 3000);
            return true;
        }
        
        // 验证数据格式（必须是数组）
        if (!Array.isArray(parsedData) || parsedData.length === 0) {
            customAlert("文件格式错误：无法解析为有效的目录数据");
            return false;
        }
        
        // 检查是否是增量文件
        const isIncremental = parsedData[0].length >= 4 && parsedData[0][0] !== "mulu";
        
        // 如果当前有数据，询问是替换还是合并
        let loadMode = 'replace';
        if (mulufile && mulufile.length > 0) {
            const modeOptions = [
                { value: 'replace', label: '替换 - 清空现有数据，加载新文件' },
                { value: 'merge', label: '合并 - 将新数据合并到现有数据' }
            ];
            
            const defaultMode = isIncremental ? 'merge' : 'replace';
            const hint = isIncremental ? '（检测到增量文件，建议合并）' : '';
            
            loadMode = await customSelect(`选择加载方式${hint}：`, modeOptions, defaultMode, '加载文件');
            if (loadMode === null) {
                showToast('已取消加载', 'info', 2000);
                return false;
            }
        }
        
        if (loadMode === 'merge') {
            // 合并模式
            const mergeResult = mergeDirectoryData(mulufile, parsedData);
            mulufile = mergeResult.data;
            
            // 重建索引
            rebuildMulufileIndex();
            
            // 重新加载目录
            LoadMulu();
            
            // 标记有未保存更改
            markUnsavedChanges();
            
            setTimeout(() => {
                if (typeof expandAllDirectories === 'function') {
                    expandAllDirectories();
                }
                selectFirstRootDirectory();
            }, 10);
            
            bigbox.style.display = "block";
            wordsbox.style.display = "block";
            
            const cacheMsg = fromCache ? '（从缓存快速加载）' : '';
            showToast(`已合并：新增 ${mergeResult.added} 个，更新 ${mergeResult.updated} 个目录${cacheMsg}`, 'success', 3000);
            return true;
        }
        
        // 替换模式 - 验证完整文件格式
        if (parsedData[0].length < 4 || parsedData[0][0] !== "mulu") {
            customAlert("文件格式错误：第一个目录必须以'mulu'开头\n\n如果这是增量文件，请选择【合并】模式加载");
            return false;
        }
        
        // 保存文件句柄
        currentFileHandle = fileHandle;
        currentFileName = file.name;
        
        // 更新数据
        mulufile = parsedData;
        
        // 加载目录
        LoadMulu();
        
        // 性能优化：将计算哈希改为延迟执行，不阻塞显示
        // 哈希计算用于变化追踪，不是显示内容所必需的
        if (typeof calculateAllHashes === 'function') {
            const calculateHashes = () => {
                calculateAllHashes();
            };
            
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(calculateHashes, { timeout: 500 });
            } else {
                setTimeout(calculateHashes, 50);
            }
        }
        
        hasUnsavedChanges = false;
        updateSaveButtonState();
        
        // 预加载所有目录内容（后台处理，不阻塞UI）
        // 这样在切换目录时就不会再卡顿了，因为所有数据都已经准备好
        if (typeof MediaStorage !== 'undefined' && typeof MediaStorage.preloadAllDirectoryContent === 'function') {
            MediaStorage.preloadAllDirectoryContent(mulufile).catch(err => {
                console.warn('预加载目录内容失败:', err);
            });
        }
        
        setTimeout(() => {
            // 展开所有目录
            if (typeof expandAllDirectories === 'function') {
                expandAllDirectories();
            }
            
            // 选中第一个根目录
            selectFirstRootDirectory();
        }, 10);
        
        bigbox.style.display = "block";
        wordsbox.style.display = "block";
        
        // 更新文件名输入框（移除各种后缀）
        if (fileNameInput) {
            let nameWithoutExt = file.name
                .replace(/\s*\(\d+\)\s*\./g, '.')       // 移除浏览器添加的 (1), (2) 等
                .replace(/\.(json|txt|xml|csv)$/i, '')  // 移除文件扩展名
                .replace(/\.(encrypted|patch)$/i, '')   // 移除加密/补丁后缀
                .replace(/_incremental$/i, '');         // 移除增量后缀
            fileNameInput.value = nameWithoutExt;
        }
        
        const cacheMsg = fromCache ? '（从缓存快速加载）' : '';
        showToast(`已打开：${file.name}${cacheMsg}（支持直接保存）`, 'success', 3000);
        return true;
        
    } catch (err) {
        if (err.name === 'AbortError') {
            // 用户取消
            return false;
        }
        console.error('打开文件失败:', err);
        return false;
    }
}

/**
 * 使用 File System Access API 直接保存到当前文件
 * @returns {Promise<boolean>} - 是否成功保存
 */
async function saveToCurrentFile() {
    if (!currentFileHandle) {
        return false;
    }
    
    try {
        // 获取修改的目录数量
        const modifiedCount = getModifiedDirectories().length;
        
        // 准备数据
        const dataToSave = await prepareDataForExport(mulufile);
        const ext = currentFileName.split('.').pop().toLowerCase();
        const stringData = (ext === 'json')
            ? JSON.stringify(dataToSave, null, 2)
            : formatDataByExtension(dataToSave, currentFileName);
        
        // 写入文件
        const writable = await currentFileHandle.createWritable();
        await writable.write(stringData);
        await writable.close();
        
        // 更新哈希并清除未保存标记
        clearUnsavedChanges();
        
        if (modifiedCount > 0) {
            showToast(`已保存 ${modifiedCount} 个修改的目录到 ${currentFileName}`, 'success', 2500);
        } else {
            showToast(`已保存：${currentFileName}`, 'success', 2000);
        }
        
        return true;
        
    } catch (err) {
        if (err.name === 'AbortError') {
            return false;
        }
        console.error('保存文件失败:', err);
        showToast('保存失败：' + err.message, 'error', 3000);
        return false;
    }
}

/**
 * 使用 File System Access API 另存为新文件
 * @returns {Promise<boolean>} - 是否成功保存
 */
async function saveAsWithFSAPI() {
    if (!isFileSystemAccessSupported()) {
        return false;
    }
    
    try {
        const baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
        
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: `${baseName}.json`,
            types: [
                {
                    description: 'JSON 格式',
                    accept: { 'application/json': ['.json'] }
                },
                {
                    description: '文本格式',
                    accept: { 'text/plain': ['.txt'] }
                },
                {
                    description: 'XML 格式',
                    accept: { 'application/xml': ['.xml'] }
                },
                {
                    description: 'CSV 格式',
                    accept: { 'text/csv': ['.csv'] }
                }
            ]
        });
        
        const fileName = fileHandle.name;
        const ext = fileName.split('.').pop().toLowerCase();
        
        // 准备数据
        const dataToSave = await prepareDataForExport(mulufile);
        const stringData = (ext === 'json')
            ? JSON.stringify(dataToSave, null, 2)
            : formatDataByExtension(dataToSave, fileName);
        
        // 写入文件
        const writable = await fileHandle.createWritable();
        await writable.write(stringData);
        await writable.close();
        
        // 更新文件句柄
        currentFileHandle = fileHandle;
        currentFileName = fileName;
        
        // 更新文件名输入框（移除各种后缀）
        if (fileNameInput) {
            let nameWithoutExt = fileName
                .replace(/\s*\(\d+\)\s*\./g, '.')       // 移除浏览器添加的 (1), (2) 等
                .replace(/\.(json|txt|xml|csv)$/i, '')
                .replace(/\.(encrypted|patch)$/i, '')
                .replace(/_incremental$/i, '');
            fileNameInput.value = nameWithoutExt;
        }
        
        // 清除未保存标记
        clearUnsavedChanges();
        
        showToast(`已保存：${fileName}`, 'success', 2500);
        return true;
        
    } catch (err) {
        if (err.name === 'AbortError') {
            return false;
        }
        console.error('另存为失败:', err);
        return false;
    }
}

// -------------------- 加密功能 (AES-GCM) --------------------

/** 加密文件标识 */
const ENCRYPTED_FILE_HEADER = 'SORALIST_ENCRYPTED_V1';

/**
 * 从密码派生加密密钥
 * @param {string} password - 用户密码
 * @param {Uint8Array} salt - 盐值
 * @returns {Promise<CryptoKey>} - 派生的密钥
 */
async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * 加密数据
 * @param {string} data - 要加密的数据
 * @param {string} password - 密码
 * @returns {Promise<string>} - 加密后的 base64 数据（包含 salt 和 iv）
 */
async function encryptData(data, password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(data)
    );
    
    // 组合 salt + iv + encrypted
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // 转换为 base64
    return btoa(String.fromCharCode(...combined));
}

/**
 * 解密数据
 * @param {string} encryptedBase64 - 加密的 base64 数据
 * @param {string} password - 密码
 * @returns {Promise<string>} - 解密后的数据
 */
async function decryptData(encryptedBase64, password) {
    const decoder = new TextDecoder();
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    const key = await deriveKey(password, salt);
    
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
    );
    
    return decoder.decode(decrypted);
}

/**
 * 检查内容是否是加密的
 * @param {string} content - 文件内容
 * @returns {boolean}
 */
function isEncryptedContent(content) {
    return content && content.startsWith(ENCRYPTED_FILE_HEADER + ':');
}

/**
 * 解析加密文件（提示输入密码并解密）
 * @param {string} content - 加密的文件内容
 * @returns {Promise<string|null>} - 解密后的内容，失败返回 null
 */
async function parseEncryptedContent(content) {
    if (!isEncryptedContent(content)) return null;
    
    const encryptedData = content.substring(ENCRYPTED_FILE_HEADER.length + 1);
    
    // 最多尝试 3 次
    for (let attempt = 0; attempt < 3; attempt++) {
        const password = await customPrompt(
            attempt === 0 ? '此文件已加密，请输入密码：' : '密码错误，请重试：',
            '',
            '解密文件'
        );
        
        if (password === null) {
            showToast('已取消解密', 'info', 2000);
            return null;
        }
        
        try {
            const decrypted = await decryptData(encryptedData, password);
            showToast('解密成功', 'success', 2000);
            return decrypted;
        } catch (e) {
            console.warn('解密失败:', e);
            if (attempt === 2) {
                customAlert('密码错误次数过多，解密失败');
                return null;
            }
        }
    }
    
    return null;
}

/**
 * 保存加密文件
 * @param {string} data - 要保存的数据
 * @param {string} filename - 文件名
 * @param {string} password - 加密密码
 */
async function saveEncryptedFile(data, filename, password) {
    try {
        const encrypted = await encryptData(data, password);
        const content = ENCRYPTED_FILE_HEADER + ':' + encrypted;
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        showToast(`已保存加密文件：${filename}`, 'success', 2500);
    } catch (e) {
        console.error('加密保存失败:', e);
        showToast('加密保存失败', 'error', 2000);
    }
}

/**
 * 另存为加密文件
 */
async function handleSaveEncrypted() {
    // 输入密码
    const password = await customPrompt('设置加密密码：', '', '加密保存');
    if (!password) {
        showToast('已取消', 'info', 2000);
        return;
    }
    
    // 确认密码
    const confirmPassword = await customPrompt('确认密码：', '', '加密保存');
    if (confirmPassword !== password) {
        customAlert('两次输入的密码不一致');
        return;
    }
    
    // 获取文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    baseName = baseName.replace(/\.(json|txt|xml|csv|encrypted)$/i, '');
    const filename = `${baseName}.encrypted.json`;
    
    // 准备数据
    const dataToSave = await prepareDataForExport(mulufile);
    const stringData = JSON.stringify(dataToSave, null, 2);
    
    // 加密并保存
    await saveEncryptedFile(stringData, filename, password);
    
    // 清除未保存标记
    clearUnsavedChanges();
}

/**
 * 导出为加密 HTML 网页（自带解密功能）
 */
async function handleSaveEncryptedWebpage() {
    // 输入密码
    const password = await customPrompt('设置加密密码：', '', '加密导出');
    if (!password) {
        showToast('已取消', 'info', 2000);
        return;
    }
    
    // 确认密码
    const confirmPassword = await customPrompt('确认密码：', '', '加密导出');
    if (confirmPassword !== password) {
        customAlert('两次输入的密码不一致');
        return;
    }
    
    // 获取文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    baseName = baseName.replace(/\.(json|txt|xml|csv|html|encrypted)$/i, '');
    const filename = `${baseName}.encrypted.html`;
    
    // 准备数据
    const dataToSave = await prepareDataForExport(mulufile);
    const stringData = JSON.stringify(dataToSave);
    
    // 加密数据
    const encryptedData = await encryptData(stringData, password);
    
    // 生成自解密 HTML
    const html = generateSelfDecryptingHtml(baseName, encryptedData);
    
    // 下载
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast(`已导出加密网页：${filename}`, 'success', 2500);
}

/**
 * 生成自解密 HTML 页面
 * @param {string} title - 页面标题
 * @param {string} encryptedData - 加密的数据
 * @returns {string} - 完整的 HTML
 */
function generateSelfDecryptingHtml(title, encryptedData) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - 加密文档</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; }
        .container { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; width: 90%; text-align: center; }
        .lock-icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
        p { color: #666; margin-bottom: 20px; font-size: 14px; }
        input[type="password"] { width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; margin-bottom: 16px; transition: border-color 0.2s; }
        input[type="password"]:focus { outline: none; border-color: #667eea; }
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
        button:active { transform: translateY(0); }
        .error { color: #e74c3c; margin-top: 12px; font-size: 14px; display: none; }
        .content { display: none; padding: 20px; max-width: 900px; margin: 0 auto; }
        .content h1, .content h2, .content h3 { margin: 1em 0 0.5em; }
        .content p { margin: 1em 0; line-height: 1.6; }
        .content ul, .content ol { margin: 1em 0; padding-left: 2em; }
        .content img { max-width: 100%; height: auto; }
        .content video { max-width: 100%; }
        .dir-item { border: 1px solid #ddd; margin: 10px 0; border-radius: 8px; overflow: hidden; }
        .dir-title { background: #f5f5f5; padding: 10px 15px; font-weight: bold; cursor: pointer; }
        .dir-title:hover { background: #eee; }
        .dir-content { padding: 15px; border-top: 1px solid #ddd; }
        .back-btn { position: fixed; top: 20px; left: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container" id="loginContainer">
        <div class="lock-icon">🔐</div>
        <h1>${title}</h1>
        <p>此文档已加密，请输入密码查看</p>
        <input type="password" id="passwordInput" placeholder="输入密码" autofocus>
        <button onclick="decrypt()">解锁</button>
        <div class="error" id="error">密码错误，请重试</div>
    </div>
    <div class="content" id="contentContainer">
        <button class="back-btn" onclick="location.reload()">🔒 重新锁定</button>
        <div id="content"></div>
    </div>
    <script>
        const encryptedData = '${encryptedData}';
        
        async function deriveKey(password, salt) {
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
            return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        }
        
        async function decrypt() {
            const password = document.getElementById('passwordInput').value;
            if (!password) return;
            
            try {
                const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
                const salt = combined.slice(0, 16);
                const iv = combined.slice(16, 28);
                const encrypted = combined.slice(28);
                const key = await deriveKey(password, salt);
                const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
                const data = JSON.parse(new TextDecoder().decode(decrypted));
                
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('contentContainer').style.display = 'block';
                document.body.style.background = '#f5f5f5';
                
                renderContent(data);
            } catch (e) {
                document.getElementById('error').style.display = 'block';
                document.getElementById('passwordInput').value = '';
                document.getElementById('passwordInput').focus();
            }
        }
        
        function renderContent(data) {
            const container = document.getElementById('content');
            const tree = buildTree(data);
            container.innerHTML = renderTree(tree);
        }
        
        function buildTree(data) {
            const map = {};
            data.forEach(item => { if (item.length === 4) map[item[2]] = { parent: item[0], name: item[1], id: item[2], content: item[3], children: [] }; });
            const roots = [];
            Object.values(map).forEach(item => { if (item.parent === 'mulu') roots.push(item); else if (map[item.parent]) map[item.parent].children.push(item); });
            return roots;
        }
        
        function renderTree(items, level = 0) {
            return items.map(item => \`
                <div class="dir-item" style="margin-left: \${level * 20}px">
                    <div class="dir-title" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">\${item.name}</div>
                    <div class="dir-content">\${item.content || '<em>无内容</em>'}\${item.children.length ? renderTree(item.children, level + 1) : ''}</div>
                </div>
            \`).join('');
        }
        
        document.getElementById('passwordInput').addEventListener('keypress', e => { if (e.key === 'Enter') decrypt(); });
    </script>
</body>
</html>`;
}

/**
 * 选中第一个根目录
 */
function selectFirstRootDirectory() {
    let firstRootMulu = null;
    let allMulusForSelect = document.querySelectorAll(".mulu");
    for (let i = 0; i < allMulusForSelect.length; i++) {
        let mulu = allMulusForSelect[i];
        let parentId = mulu.getAttribute("data-parent-id");
        if (!parentId || parentId === "mulu") {
            firstRootMulu = mulu;
            break;
        }
    }
    
    if (firstRootMulu) {
        currentMuluName = firstRootMulu.id;
        RemoveOtherSelect();
        firstRootMulu.classList.add("select");
        
        let loadedContent = findMulufileData(firstRootMulu);
        
        // 直接显示内容，不进行媒体数据的加载处理
        // 媒体数据已经存储在IndexedDB中，只在需要时才加载
        jiedianwords.value = loadedContent;
        isUpdating = true;
        updateMarkdownPreview();
        isUpdating = false;
    }
}

/**
 * 解析不同格式的文件内容
 * 支持 JSON、XML、CSV、加密格式和旧版字符串格式
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名（用于判断格式）
 * @returns {Array|Promise<Array>} - 解析后的目录数据数组（加密文件返回 Promise）
 * @throws {Error} - 解析失败时抛出错误
 */
function parseFileContent(content, filename) {
    let ext = filename ? filename.toLowerCase().split('.').pop() : '';
    
    // 检查是否是加密文件
    if (isEncryptedContent(content)) {
        // 返回 Promise，由调用方处理
        return (async () => {
            const decrypted = await parseEncryptedContent(content);
            if (!decrypted) {
                throw new Error('解密失败或已取消');
            }
            // 递归解析解密后的内容
            return parseFileContent(decrypted, filename.replace('.encrypted', ''));
        })();
    }
    
    // 尝试解析 XML 格式
    if (ext === 'xml' || content.trim().startsWith('<?xml')) {
        try {
            let parser = new DOMParser();
            let xmlDoc = parser.parseFromString(content, "text/xml");
            let directories = xmlDoc.getElementsByTagName("directory");
            let result = [];
            
            for (let i = 0; i < directories.length; i++) {
                let dir = directories[i];
                let parent = dir.getAttribute("parent") || "mulu";
                let name = dir.getAttribute("name") || "";
                let id = dir.getAttribute("id") || "";
                let contentNode = dir.getElementsByTagName("content")[0];
                let contentText = contentNode ? contentNode.textContent : "";
                result.push([parent, name, id, contentText]);
            }
            return result;
        } catch (e) {
            console.warn("XML 解析失败，尝试其他格式", e);
        }
    }
    
    // 尝试解析 CSV 格式
    if (ext === 'csv' || (content.includes(',') && content.includes('\n') && content.split('\n').length > 1)) {
        try {
            let lines = content.split('\n');
            let result = [];
            
            // 跳过标题行
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
                    // CSV 解析（处理引号转义）
                    let match = lines[i].match(/^"([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)"$/);
                    if (match) {
                        result.push([
                            match[1].replace(/""/g, '"'),
                            match[2].replace(/""/g, '"'),
                            match[3].replace(/""/g, '"'),
                            match[4].replace(/""/g, '"')
                        ]);
                    }
                }
            }
            
            if (result.length > 0) {
                return result;
            }
        } catch (e) {
            console.warn("CSV 解析失败，尝试其他格式", e);
        }
    }
    
    // 尝试解析 JSON 格式
    if (ext === 'json' || content.trim().startsWith('[') || content.trim().startsWith('{')) {
        try {
            let parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
                return parsed;
            }
        } catch (e) {
            console.warn("JSON 解析失败，尝试其他格式", e);
        }
    }
    
    // 尝试使用旧版字符串解析
    try {
        return stringToArr(content);
    } catch (e) {
        throw new Error("无法解析文件格式，请确保文件格式正确");
    }
}

/**
 * 根据文件扩展名获取 MIME 类型
 * @param {string} filename - 文件名
 * @returns {string} - MIME 类型
 */
function getMimeType(filename) {
    let ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
        'json': 'application/json',
        'txt': 'text/plain',
        'js': 'application/javascript',
        'xml': 'application/xml',
        'csv': 'text/csv',
        'html': 'text/html',
        'md': 'text/markdown',
        'yaml': 'text/yaml',
        'yml': 'text/yaml'
    };
    return mimeTypes[ext] || 'text/plain';
}

/**
 * 根据文件扩展名格式化数据
 * @param {Array} data - 目录数据数组
 * @param {string} filename - 目标文件名
 * @returns {string} - 格式化后的字符串
 */
function formatDataByExtension(data, filename) {
    let ext = filename.toLowerCase().split('.').pop();
    
    switch(ext) {
        case 'json':
            return JSON.stringify(data, null, 2);
            
        case 'txt':
            return JSON.stringify(data);
            
        case 'xml':
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<directories>\n';
            for (let i = 0; i < data.length; i++) {
                if (data[i].length === 4) {
                    xml += `  <directory parent="${data[i][0]}" name="${data[i][1]}" id="${data[i][2]}">\n`;
                    xml += `    <content><![CDATA[${data[i][3]}]]></content>\n`;
                    xml += `  </directory>\n`;
                }
            }
            xml += '</directories>';
            return xml;
            
        case 'csv':
            let csv = '父目录ID,目录名,目录ID,内容\n';
            for (let i = 0; i < data.length; i++) {
                if (data[i].length === 4) {
                    csv += `"${data[i][0]}","${data[i][1]}","${data[i][2]}","${data[i][3].replace(/"/g, '""')}"\n`;
                }
            }
            return csv;
            
        default:
            return JSON.stringify(data, null, 2);
    }
}

/**
 * 保存文件（智能选择保存方式）
 * 始终先询问保存选项（范围、是否加密），然后选择最佳保存方式
 */
async function handleSave() {
    const modifiedDirs = getModifiedDirectories();
    const hasModifications = modifiedDirs.length > 0;
    
    // 1. 如果有修改，询问保存范围
    let saveMode = 'all';  // 'all', 'modified', 或 'diff'
    if (hasModifications && mulufile.length > modifiedDirs.length) {
        const modeOptions = [
            { value: 'all', label: `保存全部（${mulufile.length} 个目录）` },
            { value: 'modified', label: `仅保存修改的目录（${modifiedDirs.length} 个完整目录）` },
            { value: 'diff', label: `仅保存差异（最小化，只保存变化的内容）` }
        ];
        saveMode = await customSelect('选择保存范围：', modeOptions, 'all', '保存文件');
        if (saveMode === null) {
            showToast('已取消保存', 'info', 2000);
            return;
        }
    }
    
    // 2. 询问是否加密
    const encryptOptions = [
        { value: 'no', label: '不加密' },
        { value: 'yes', label: '加密保存（设置密码）' }
    ];
    const encrypt = await customSelect('是否加密？', encryptOptions, 'no', '保存文件');
    if (encrypt === null) {
        showToast('已取消保存', 'info', 2000);
        return;
    }
    
    // 3. 如果选择加密，获取密码
    let password = null;
    if (encrypt === 'yes') {
        password = await customPrompt('设置加密密码：', '', '加密保存');
        if (!password) {
            showToast('已取消', 'info', 2000);
            return;
        }
        const confirmPassword = await customPrompt('确认密码：', '', '加密保存');
        if (confirmPassword !== password) {
            customAlert('两次输入的密码不一致');
            return;
        }
    }
    
    // 4. 准备数据
    let dataToSave;
    if (saveMode === 'diff') {
        dataToSave = await prepareDiffDataForExport(modifiedDirs);
    } else if (saveMode === 'modified') {
        dataToSave = await prepareModifiedDataForExport(modifiedDirs);
    } else {
        dataToSave = await prepareDataForExport(mulufile);
    }
    
    // 5. 格式化数据
    let stringData = JSON.stringify(dataToSave, null, 2);
    
    // 6. 加密（如果需要）
    if (password) {
        const encrypted = await encryptData(stringData, password);
        stringData = ENCRYPTED_FILE_HEADER + ':' + encrypted;
    }
    
    // 7. 生成文件名后缀
    let fileSuffix = '';
    if (saveMode === 'diff') {
        fileSuffix = '.patch';
    } else if (saveMode === 'modified') {
        fileSuffix = '_incremental';
    }
    if (password) {
        fileSuffix += '.encrypted';
    }
    
    // 8. 选择保存方式
    // 如果是加密或增量/差异模式，不能直接保存到原文件，需要另存为
    const canSaveToCurrentFile = currentFileHandle && !password && saveMode === 'all';
    
    if (canSaveToCurrentFile) {
        // 直接保存到当前文件
        try {
            const writable = await currentFileHandle.createWritable();
            await writable.write(stringData);
            await writable.close();
            
            clearUnsavedChanges();
            showToast(`已保存：${currentFileName}`, 'success', 2500);
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('保存失败，尝试另存为:', err);
            // 降级到另存为
        }
    }
    
    // 另存为（使用 File System Access API 或传统下载）
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    baseName = baseName.replace(/\.(json|txt|xml|csv|encrypted|diff|patch)$/i, '');
    
    if (isFileSystemAccessSupported() && !password) {
        // 使用 File System Access API 另存为（非加密文件）
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: `${baseName}${fileSuffix}.json`,
                types: [{ description: 'JSON 文件', accept: { 'application/json': ['.json'] } }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(stringData);
            await writable.close();
            
            // 如果是全量保存，更新文件句柄
            if (saveMode === 'all') {
                currentFileHandle = fileHandle;
                currentFileName = fileHandle.name;
                clearUnsavedChanges();
            }
            
            const modeText = saveMode === 'diff' ? '（差异补丁）' : (saveMode === 'modified' ? '（增量）' : '');
            showToast(`已保存${modeText}：${fileHandle.name}`, 'success', 2500);
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('File System API 保存失败:', err);
            // 降级到传统下载
        }
    }
    
    // 传统下载方式
    const filename = `${baseName}${fileSuffix}.json`;
    const mimeType = 'application/json';
    const blob = new Blob([stringData], { type: `${mimeType};charset=utf-8` });
    const objectURL = URL.createObjectURL(blob);
    
    const aTag = document.createElement('a');
    aTag.href = objectURL;
    aTag.download = filename;
    aTag.click();
    
    URL.revokeObjectURL(objectURL);
    
    // 更新状态
    if (saveMode === 'all' && !password) {
        clearUnsavedChanges();
    }
    currentFileName = filename;
    updatePageTitle();
    
    const modeText = saveMode === 'diff' ? '（差异补丁）' : (saveMode === 'modified' ? '（增量）' : '');
    const encryptText = password ? '（已加密）' : '';
    showToast(`已保存${modeText}${encryptText}：${filename}`, 'success', 2500);
}

/**
 * 传统保存方式（下载文件）
 * 支持增量保存和加密
 */
async function handleSaveFallback() {
    const modifiedDirs = getModifiedDirectories();
    const hasModifications = modifiedDirs.length > 0;
    
    // 1. 如果有修改，询问保存范围
    let saveMode = 'all';  // 'all', 'modified', 或 'diff'
    if (hasModifications && mulufile.length > modifiedDirs.length) {
        const modeOptions = [
            { value: 'all', label: `保存全部（${mulufile.length} 个目录）` },
            { value: 'modified', label: `仅保存修改的目录（${modifiedDirs.length} 个完整目录）` },
            { value: 'diff', label: `仅保存差异（最小化，只保存变化的内容）` }
        ];
        saveMode = await customSelect('选择保存范围：', modeOptions, 'all', '保存文件');
        if (saveMode === null) {
            showToast('已取消保存', 'info', 2000);
            return;
        }
    }
    
    // 2. 询问是否加密
    const encryptOptions = [
        { value: 'no', label: '不加密' },
        { value: 'yes', label: '加密保存（设置密码）' }
    ];
    const encrypt = await customSelect('是否加密？', encryptOptions, 'no', '保存文件');
    if (encrypt === null) {
        showToast('已取消保存', 'info', 2000);
        return;
    }
    
    // 3. 如果选择加密，获取密码
    let password = null;
    if (encrypt === 'yes') {
        password = await customPrompt('设置加密密码：', '', '加密保存');
        if (!password) {
            showToast('已取消', 'info', 2000);
            return;
        }
        const confirmPassword = await customPrompt('确认密码：', '', '加密保存');
        if (confirmPassword !== password) {
            customAlert('两次输入的密码不一致');
            return;
        }
    }
    
    // 4. 选择格式（仅非加密时）
    let format = 'json';
    if (!password) {
        const formatOptions = [
            { value: 'json', label: 'JSON 格式 (.json) - 推荐' },
            { value: 'txt', label: '文本格式 (.txt)' },
            { value: 'xml', label: 'XML 格式 (.xml)' },
            { value: 'csv', label: 'CSV 格式 (.csv)' }
        ];
        format = await customSelect('选择保存格式：', formatOptions, 'json', '保存文件');
        if (format === null) {
            showToast('已取消保存', 'info', 2000);
            return;
        }
    }
    
    // 5. 准备数据
    let dataToSave;
    if (saveMode === 'diff') {
        dataToSave = await prepareDiffDataForExport(modifiedDirs);
    } else if (saveMode === 'modified') {
        dataToSave = await prepareModifiedDataForExport(modifiedDirs);
    } else {
        dataToSave = await prepareDataForExport(mulufile);
    }
    
    // 6. 生成文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    baseName = baseName.replace(/\.(json|txt|xml|csv|encrypted|diff|patch)$/i, '');
    
    let filename;
    if (password) {
        if (saveMode === 'diff') {
            filename = `${baseName}.patch.encrypted.json`;
        } else if (saveMode === 'modified') {
            filename = `${baseName}_incremental.encrypted.json`;
        } else {
            filename = `${baseName}.encrypted.json`;
        }
    } else {
        if (saveMode === 'diff') {
            filename = `${baseName}.patch.json`;
        } else if (saveMode === 'modified') {
            filename = `${baseName}_incremental.${format}`;
        } else {
            filename = `${baseName}.${format}`;
        }
    }
    
    // 7. 格式化数据
    let stringData = (format === 'json' || password)
        ? JSON.stringify(dataToSave, null, 2)
        : formatDataByExtension(dataToSave, filename);
    
    // 8. 加密（如果需要）
    if (password) {
        const encrypted = await encryptData(stringData, password);
        stringData = ENCRYPTED_FILE_HEADER + ':' + encrypted;
    }
    
    // 9. 下载文件
    const mimeType = password ? 'text/plain' : getMimeType(filename);
    const blob = new Blob([stringData], { type: `${mimeType};charset=utf-8` });
    const objectURL = URL.createObjectURL(blob);
    
    const aTag = document.createElement('a');
    aTag.href = objectURL;
    aTag.download = filename;
    aTag.click();
    
    URL.revokeObjectURL(objectURL);
    
    // 10. 更新状态
    if (saveMode === 'all') {
        clearUnsavedChanges();
    }
    currentFileName = filename;
    updatePageTitle();
    
    const modeText = saveMode === 'diff' ? '（差异补丁）' : (saveMode === 'modified' ? '（增量）' : '');
    const encryptText = password ? '（已加密）' : '';
    showToast(`已保存${modeText}${encryptText}：${filename}`, 'success', 2500);
}

/**
 * 准备仅修改的数据用于导出
 * @param {Array} modifiedDirIds - 修改的目录 ID 列表
 * @returns {Promise<Array>} - 仅包含修改目录的数据
 */
async function prepareModifiedDataForExport(modifiedDirIds) {
    const modifiedData = [];
    
    for (const dirId of modifiedDirIds) {
        const data = getMulufileByDirId(dirId);
        if (data) {
            // 创建副本
            const dataCopy = [...data];
            // 如果内容包含 IndexedDB 媒体引用，恢复媒体数据
            if (dataCopy[3] && dataCopy[3].includes('data-media-storage-id') && typeof MediaStorage !== 'undefined') {
                dataCopy[3] = await MediaStorage.processHtmlForExport(dataCopy[3]);
            }
            modifiedData.push(dataCopy);
        }
    }
    
    return modifiedData;
}

// -------------------- 内容差异（Diff/Patch）功能 --------------------

/** 原始内容缓存（用于计算差异） */
const originalContentCache = new Map();

/**
 * 保存目录的原始内容（用于后续差异计算）
 * 在文件加载后调用
 */
function cacheOriginalContent() {
    originalContentCache.clear();
    for (let i = 0; i < mulufile.length; i++) {
        if (mulufile[i].length === 4) {
            const dirId = mulufile[i][2];
            const content = mulufile[i][3] || '';
            originalContentCache.set(dirId, content);
        }
    }
}

/**
 * 计算两个字符串的行级差异
 * 使用简化的 LCS 算法
 * @param {string} oldText - 原始文本
 * @param {string} newText - 新文本
 * @returns {Array} - 差异操作数组 [{op: 'keep'|'add'|'del', line: string}, ...]
 */
function computeLineDiff(oldText, newText) {
    const oldLines = (oldText || '').split('\n');
    const newLines = (newText || '').split('\n');
    
    // 构建 LCS 表
    const m = oldLines.length;
    const n = newLines.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    // 回溯生成差异
    const diff = [];
    let i = m, j = n;
    const tempDiff = [];
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            tempDiff.push({ op: '=', line: oldLines[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            tempDiff.push({ op: '+', line: newLines[j - 1] });
            j--;
        } else {
            tempDiff.push({ op: '-', line: oldLines[i - 1] });
            i--;
        }
    }
    
    // 反转并压缩差异
    tempDiff.reverse();
    
    // 压缩连续的保持行（只记录行号范围）
    let keepStart = -1;
    let keepCount = 0;
    
    for (const item of tempDiff) {
        if (item.op === '=') {
            if (keepStart === -1) keepStart = diff.length;
            keepCount++;
        } else {
            if (keepCount > 0) {
                // 如果保持行超过3行，压缩为范围
                if (keepCount > 3) {
                    diff.push({ op: '=', count: keepCount });
                } else {
                    // 保持行较少，直接记录
                    for (let k = 0; k < keepCount; k++) {
                        diff.push({ op: '=', line: tempDiff[keepStart + k].line });
                    }
                }
                keepStart = -1;
                keepCount = 0;
            }
            diff.push(item);
        }
    }
    
    // 处理末尾的保持行
    if (keepCount > 0) {
        if (keepCount > 3) {
            diff.push({ op: '=', count: keepCount });
        } else {
            for (let k = 0; k < keepCount; k++) {
                diff.push({ op: '=', line: tempDiff[keepStart + k].line });
            }
        }
    }
    
    return diff;
}

/**
 * 应用差异补丁到原始文本
 * @param {string} oldText - 原始文本
 * @param {Array} diff - 差异操作数组
 * @returns {string} - 应用补丁后的文本
 */
function applyLinePatch(oldText, diff) {
    const oldLines = (oldText || '').split('\n');
    const newLines = [];
    let oldIndex = 0;
    
    for (const item of diff) {
        if (item.op === '=') {
            if (item.count !== undefined) {
                // 压缩的保持范围
                for (let i = 0; i < item.count && oldIndex < oldLines.length; i++) {
                    newLines.push(oldLines[oldIndex++]);
                }
            } else {
                // 单行保持
                newLines.push(item.line);
                oldIndex++;
            }
        } else if (item.op === '+') {
            // 添加行
            newLines.push(item.line);
        } else if (item.op === '-') {
            // 删除行（跳过原始行）
            oldIndex++;
        }
    }
    
    return newLines.join('\n');
}

/**
 * 准备差异数据用于导出（只保存变化部分）
 * @param {Array} modifiedDirIds - 修改的目录 ID 列表
 * @returns {Promise<Object>} - 包含差异的数据对象
 */
async function prepareDiffDataForExport(modifiedDirIds) {
    const diffData = {
        _type: 'soralist_diff',  // 标识为差异文件
        _version: 1,
        patches: []
    };
    
    for (const dirId of modifiedDirIds) {
        const data = getMulufileByDirId(dirId);
        if (data) {
            const originalContent = originalContentCache.get(dirId) || '';
            let currentContent = data[3] || '';
            
            // 如果内容包含 IndexedDB 媒体引用，恢复媒体数据
            if (currentContent.includes('data-media-storage-id') && typeof MediaStorage !== 'undefined') {
                currentContent = await MediaStorage.processHtmlForExport(currentContent);
            }
            
            // 计算差异
            const diff = computeLineDiff(originalContent, currentContent);
            
            // 计算压缩率
            const originalSize = originalContent.length;
            const diffSize = JSON.stringify(diff).length;
            const fullSize = currentContent.length;
            
            // 如果差异比完整内容还大，就保存完整内容
            if (diffSize >= fullSize * 0.8) {
                diffData.patches.push({
                    dirId: dirId,
                    parentId: data[0],
                    name: data[1],
                    mode: 'full',  // 完整内容模式
                    content: currentContent
                });
            } else {
                diffData.patches.push({
                    dirId: dirId,
                    parentId: data[0],
                    name: data[1],
                    mode: 'diff',  // 差异模式
                    diff: diff
                });
            }
        }
    }
    
    return diffData;
}

/**
 * 应用差异补丁文件
 * @param {Object} diffData - 差异数据对象
 * @returns {Object} - { applied: 成功数, failed: 失败数, notFound: 未找到数 }
 */
function applyDiffPatches(diffData) {
    if (!diffData || diffData._type !== 'soralist_diff') {
        return { applied: 0, failed: 0, notFound: 0, error: '无效的差异文件' };
    }
    
    let applied = 0;
    let failed = 0;
    let notFound = 0;
    
    for (const patch of diffData.patches) {
        const data = getMulufileByDirId(patch.dirId);
        
        if (!data) {
            // 目录不存在，创建新目录
            mulufile.push([patch.parentId, patch.name, patch.dirId, patch.mode === 'full' ? patch.content : '']);
            if (patch.mode === 'diff') {
                // 对于新目录的差异模式，直接组装内容
                const newContent = applyLinePatch('', patch.diff);
                mulufile[mulufile.length - 1][3] = newContent;
            }
            applied++;
            notFound++;
            continue;
        }
        
        try {
            if (patch.mode === 'full') {
                // 完整内容模式
                data[3] = patch.content;
            } else {
                // 差异模式
                const originalContent = data[3] || '';
                const newContent = applyLinePatch(originalContent, patch.diff);
                data[3] = newContent;
            }
            applied++;
        } catch (e) {
            console.error('应用补丁失败:', patch.dirId, e);
            failed++;
        }
    }
    
    // 重建索引
    rebuildMulufileIndex();
    
    return { applied, failed, notFound };
}

/**
 * 检查是否是差异文件
 * @param {any} data - 解析后的数据
 * @returns {boolean}
 */
function isDiffFile(data) {
    return data && typeof data === 'object' && data._type === 'soralist_diff';
}

/**
 * 合并目录数据（将新数据合并到现有数据）
 * @param {Array} existingData - 现有目录数据
 * @param {Array} newData - 新的目录数据
 * @returns {Object} - { data: 合并后的数据, added: 新增数量, updated: 更新数量 }
 */
function mergeDirectoryData(existingData, newData) {
    // 创建现有数据的 ID 到索引的映射
    const existingMap = new Map();
    for (let i = 0; i < existingData.length; i++) {
        if (existingData[i].length >= 4) {
            existingMap.set(existingData[i][2], i);  // [2] 是目录 ID
        }
    }
    
    let added = 0;
    let updated = 0;
    
    // 合并新数据
    for (const item of newData) {
        if (item.length >= 4) {
            const dirId = item[2];
            
            if (existingMap.has(dirId)) {
                // 更新现有目录
                const index = existingMap.get(dirId);
                existingData[index] = [...item];  // 替换整个数组
                updated++;
            } else {
                // 添加新目录
                existingData.push([...item]);
                added++;
            }
        }
    }
    
    return {
        data: existingData,
        added: added,
        updated: updated
    };
}

/**
 * 准备导出数据（从 IndexedDB 恢复视频数据）
 * @param {Array} muluData - 原始目录数据
 * @returns {Promise<Array>} - 包含完整视频数据的目录数据副本
 */
async function prepareDataForExport(muluData) {
    // 创建数据副本
    const exportData = JSON.parse(JSON.stringify(muluData));
    
    // 遍历并恢复媒体数据（视频/图片）
    for (let i = 0; i < exportData.length; i++) {
        if (exportData[i].length === 4) {
            let content = exportData[i][3];
            // 如果内容包含 IndexedDB 媒体引用，恢复媒体数据
            if (content && content.includes('data-media-storage-id') && typeof MediaStorage !== 'undefined') {
                exportData[i][3] = await MediaStorage.processHtmlForExport(content);
            }
        }
    }
    
    return exportData;
}

/**
 * 另存为功能
 * @param {string} customName - 自定义文件名
 */
async function handleSaveAs(customName) {
    if (!customName) {
        customAlert("已取消保存");
        return;
    }
    
    let filename = customName;
    let nameWithoutExt = customName.substring(0, customName.lastIndexOf('.'));
    let ext = customName.substring(customName.lastIndexOf('.'));
    
    if (!nameWithoutExt || !ext) {
        customAlert("文件名格式错误，请包含扩展名（如：data.json）");
        return;
    }
    
    let format = ext.substring(1).toLowerCase();
    let mimeType = getMimeType(filename);
    
    // 准备数据（从 IndexedDB 恢复视频数据）
    let dataToSave = await prepareDataForExport(mulufile);
    
    let stringData = (format === 'json')
        ? JSON.stringify(dataToSave, null, 2)
        : formatDataByExtension(dataToSave, filename);
    
    // 创建并下载文件
    const blob = new Blob([stringData], { type: `${mimeType};charset=utf-8` });
    const objectURL = URL.createObjectURL(blob);
    
    const aTag = document.createElement('a');
    aTag.href = objectURL;
    aTag.download = filename;
    aTag.click();
    
    URL.revokeObjectURL(objectURL);
    customAlert(`文件另存为成功！\n已保存：${filename}`);
}

/**
 * 另存为加密文件
 * @param {string} customName - 自定义文件名
 * @param {string} password - 加密密码
 */
async function handleSaveAsEncrypted(customName, password) {
    if (!customName || !password) {
        customAlert("已取消保存");
        return;
    }
    
    // 确保文件名有扩展名
    let filename = customName;
    if (!filename.includes('.')) {
        filename += '.json';
    }
    
    // 准备数据
    let dataToSave = await prepareDataForExport(mulufile);
    let stringData = JSON.stringify(dataToSave, null, 2);
    
    // 加密数据
    const encrypted = await encryptData(stringData, password);
    const encryptedContent = ENCRYPTED_FILE_HEADER + ':' + encrypted;
    
    // 创建并下载文件
    const blob = new Blob([encryptedContent], { type: 'text/plain;charset=utf-8' });
    const objectURL = URL.createObjectURL(blob);
    
    const aTag = document.createElement('a');
    aTag.href = objectURL;
    aTag.download = filename;
    aTag.click();
    
    URL.revokeObjectURL(objectURL);
    showToast(`已保存加密文件：${filename}`, 'success', 2500);
}

/**
 * 另存为网页功能
 * 生成一个独立可浏览的HTML网页
 * @param {boolean} encrypt - 是否加密
 * @param {string} password - 加密密码（仅当 encrypt 为 true 时需要）
 */
async function handleSaveAsWebpage(encrypt = false, password = null) {
    // 如果需要加密但没有密码，询问用户
    if (encrypt && !password) {
        password = await customPrompt('设置加密密码：', '', '加密导出');
        if (!password) {
            showToast('已取消', 'info', 2000);
            return;
        }
        const confirmPassword = await customPrompt('确认密码：', '', '加密导出');
        if (confirmPassword !== password) {
            customAlert('两次输入的密码不一致');
            return;
        }
    }
    
    // 从输入框获取文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    // 移除可能的扩展名
    baseName = baseName.replace(/\.(json|txt|xml|csv|html|encrypted)$/i, '');
    let filename = encrypt ? `${baseName}.encrypted.html` : `${baseName}.html`;
    
    // 构建目录树结构
    function buildDirectoryTree(muluData) {
        const tree = [];
        const idMap = {};
        
        // 创建ID到索引的映射
        muluData.forEach((item, index) => {
            if (item.length === 4) {
                idMap[item[2]] = {
                    parentId: item[0],
                    name: item[1],
                    id: item[2],
                    content: item[3],
                    children: []
                };
            }
        });
        
        // 构建树形结构
        Object.values(idMap).forEach(item => {
            if (item.parentId === 'mulu') {
                tree.push(item);
            } else if (idMap[item.parentId]) {
                idMap[item.parentId].children.push(item);
            }
        });
        
        return tree;
    }
    
    // 根据字符串生成哈希值
    function stringToHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    
    // 根据根目录ID生成颜色
    const rootColorCache = {};
    function getRootColor(rootId) {
        if (!rootId) return '#f9f9f9';
        if (rootColorCache[rootId]) return rootColorCache[rootId];
        
        const hash = stringToHash(rootId);
        const hue = hash % 360;
        const saturation = 40 + (hash % 20);
        const lightness = 88 + (hash % 5);
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        rootColorCache[rootId] = color;
        return color;
    }
    
    // 递归生成目录HTML，rootId 用于设置底色
    function generateDirectoryHTML(items, level = 0, rootId = null) {
        let html = '';
        items.forEach((item, index) => {
            const hasChildren = item.children && item.children.length > 0;
            const indent = 20 + (level * 20);
            // 有子目录时添加可点击的三角形图标，点击三角形才切换折叠/展开
            const toggleIcon = hasChildren 
                ? `<span class="toggle-icon" onclick="toggleDirectory('${item.id}', event)"></span>` 
                : `<span class="bullet-icon"></span>`;
            
            // 计算当前目录的根目录ID和底色
            const currentRootId = level === 0 ? item.id : rootId;
            const bgColor = level === 0 ? '#f9f9f9' : getRootColor(currentRootId);
            
            html += `<div class="mulu${hasChildren ? ' has-children expanded' : ''}" 
                         data-dir-id="${item.id}" 
                         data-level="${level}"
                         style="padding-left: ${indent}px; background-color: ${bgColor};"
                         onclick="selectDirectory('${item.id}', false)">
                        ${toggleIcon}<span class="mulu-text">${escapeHtml(item.name)}</span>
                    </div>`;
            if (hasChildren) {
                html += generateDirectoryHTML(item.children, level + 1, currentRootId);
            }
        });
        return html;
    }
    
    // 转义HTML特殊字符
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async function generateContentScripts(muluData) {
        let contentScripts = '';
        let mediaDataScripts = '';
        const mediaDataMap = {};
        const allMediaPromises = [];
        
        for (const item of muluData) {
            if (item.length === 4) {
                const dirId = item[2];
                let content = item[3];
                
                if (!content) {
                    const escapedContent = JSON.stringify(content).replace(/<\/script>/gi, '<\\/script>');
                    contentScripts += `<script type="text/plain" id="content_${dirId}">${escapedContent}</script>\n`;
                    continue;
                }
                
                if (content.includes('data-media-storage-id') && typeof MediaStorage !== 'undefined') {
                    const processed = await processContentForLazyLoad(content, dirId, mediaDataMap);
                    content = processed.html;
                    if (processed.promises && processed.promises.length > 0) {
                        allMediaPromises.push(...processed.promises);
                    }
                }
                
                const escapedContent = JSON.stringify(content).replace(/<\/script>/gi, '<\\/script>');
                contentScripts += `<script type="text/plain" id="content_${dirId}">${escapedContent}</script>\n`;
            }
        }
        
        if (allMediaPromises.length > 0) {
            await Promise.all(allMediaPromises);
        }
        
        const escapedMediaData = JSON.stringify(mediaDataMap).replace(/<\/script>/gi, '<\\/script>');
        mediaDataScripts = `<script type="text/plain" id="mediaData">${escapedMediaData}</script>\n`;
        
        return { contentScripts, mediaDataScripts };
    }
    
    async function processContentForLazyLoad(html, dirId, mediaDataMap) {
        let result = html;
        let mediaIndex = 0;
        
        const mediaIdsToProcess = [];
        const mediaPromises = [];
        
        // 处理视频 - 先收集，不立即处理数据
        if (result.includes('data-media-storage-id')) {
            const videoRegex = /<video([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            let match;
            const videoReplacements = [];
            
            while ((match = videoRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const mediaId = match[2];
                const placeholderId = `media_${dirId}_${mediaIndex++}`;
                
                // 先创建占位符，数据稍后批量处理
                const placeholder = `<video class="lazy-media" data-placeholder-id="${placeholderId}" data-loading="true" style="display: block; margin: 1em auto; max-width: 640px; max-height: 360px; background: #f0f0f0; border-radius: 5px; min-width: 320px; min-height: 180px;">
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 14px;">加载中...</div>
                </video>`;
                videoReplacements.push({ from: fullMatch, to: placeholder });
                
                // 记录需要处理的媒体
                mediaIdsToProcess.push({ mediaId, placeholderId, type: 'video', originalTag: fullMatch });
            }
            
            for (const { from, to } of videoReplacements) {
                result = result.replace(from, to);
            }
        }
        
        // 处理图片 - 先收集，不立即处理数据
        if (result.includes('data-media-storage-id')) {
            const imgRegex = /<img([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            let match;
            const imgReplacements = [];
            
            while ((match = imgRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const mediaId = match[2];
                const placeholderId = `media_${dirId}_${mediaIndex++}`;
                
                // 提取 alt 和 title 属性
                const altMatch = fullMatch.match(/\salt=["']([^"']*)["']/);
                const titleMatch = fullMatch.match(/\stitle=["']([^"']*)["']/);
                const alt = altMatch ? altMatch[1] : '';
                const title = titleMatch ? titleMatch[1] : '';
                
                // 先创建占位符
                const placeholder = `<img class="lazy-media" data-placeholder-id="${placeholderId}" data-loading="true" 
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='14'%3E加载中...%3C/text%3E%3C/svg%3E" 
                    ${alt ? `alt="${escapeHtml(alt)}"` : ''} ${title ? `title="${escapeHtml(title)}"` : ''}
                    style="max-width: 800px; max-height: 600px; width: auto; height: auto; border-radius: 5px; display: block; margin: 1em auto; cursor: pointer;">`;
                imgReplacements.push({ from: fullMatch, to: placeholder });
                
                // 记录需要处理的媒体
                mediaIdsToProcess.push({ mediaId, placeholderId, type: 'image', originalTag: fullMatch, alt, title });
            }
            
            for (const { from, to } of imgReplacements) {
                result = result.replace(from, to);
            }
        }
        
        // 处理压缩文件附件 - 先收集，不立即处理数据
        if (result.includes('data-media-storage-id')) {
            const archiveRegex = /<div([^>]*)class=["']archive-attachment["']([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            const archiveRegex2 = /<div([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)class=["']archive-attachment["']([^>]*)>/gi;
            
            for (const regex of [archiveRegex, archiveRegex2]) {
                let match;
                const archiveReplacements = [];
                
                while ((match = regex.exec(result)) !== null) {
                    const fullMatch = match[0];
                    const mediaId = regex === archiveRegex ? match[3] : match[2];
                    const placeholderId = `archive_${dirId}_${mediaIndex++}`;
                    
                    // 提取压缩包信息
                    const nameMatch = fullMatch.match(/\sdata-archive-name=["']([^"']*)["']/);
                    const sizeMatch = fullMatch.match(/\sdata-archive-size=["']([^"']*)["']/);
                    const archiveName = nameMatch ? nameMatch[1] : 'archive.zip';
                    const archiveSize = sizeMatch ? sizeMatch[1] : '0';
                    
                    // 创建占位符（保持原有样式，但不包含数据URL）
                    let newTag = fullMatch;
                    newTag = newTag.replace(/\sdata-media-storage-id=["'][^"']*["']/, '');
                    newTag = newTag.replace(/\sdata-export-url=["'][^"']*["']/, '');
                    newTag = newTag.replace(/>$/, ` data-placeholder-id="${placeholderId}">`);
                    archiveReplacements.push({ from: fullMatch, to: newTag });
                    
                    // 记录压缩包信息，导出时会加载数据到 mediaDataMap
                    mediaIdsToProcess.push({ 
                        mediaId, 
                        placeholderId,
                        type: 'archive', 
                        name: archiveName, 
                        size: archiveSize,
                        originalTag: fullMatch 
                    });
                }
                
                for (const { from, to } of archiveReplacements) {
                    result = result.replace(from, to);
                }
            }
        }
        
        if (mediaIdsToProcess.length > 0) {
            mediaIdsToProcess.forEach(({ mediaId, placeholderId, type, originalTag, alt, title, name, size }) => {
                const promise = (async () => {
                    try {
                        let dataUrl = null;
                        
                        if (type === 'video') {
                            const tempHtml = `<video data-media-storage-id="${mediaId}"></video>`;
                            const processed = await MediaStorage.processHtmlForExport(tempHtml);
                            const srcMatch = processed.match(/\ssrc=["']([^"']+)["']/);
                            if (srcMatch) dataUrl = srcMatch[1];
                        } else if (type === 'image') {
                            const tempHtml = `<img data-media-storage-id="${mediaId}">`;
                            const processed = await MediaStorage.processHtmlForExport(tempHtml);
                            const srcMatch = processed.match(/\ssrc=["']([^"']+)["']/);
                            if (srcMatch) dataUrl = srcMatch[1];
                        } else if (type === 'archive') {
                            try {
                                const dataUrl = await MediaStorage.getMediaAsDataUrl(mediaId);
                                if (dataUrl) {
                                    mediaDataMap[placeholderId] = {
                                        type: 'archive',
                                        data: dataUrl,
                                        name: name,
                                        size: size,
                                        originalTag: originalTag
                                    };
                                } else {
                                    mediaDataMap[placeholderId] = {
                                        type: 'archive',
                                        mediaId: mediaId,
                                        name: name,
                                        size: size,
                                        originalTag: originalTag
                                    };
                                }
                            } catch (err) {
                                console.error('加载压缩包数据失败:', err);
                                mediaDataMap[placeholderId] = {
                                    type: 'archive',
                                    mediaId: mediaId,
                                    name: name,
                                    size: size,
                                    originalTag: originalTag
                                };
                            }
                            return;
                        }
                        
                        if (dataUrl) {
                            mediaDataMap[placeholderId] = {
                                type: type,
                                data: dataUrl,
                                originalTag: originalTag
                            };
                        }
                    } catch (err) {
                        console.error(`处理${type}数据失败:`, err);
                    }
                })();
                mediaPromises.push(promise);
            });
        }
        
        return { html: result, promises: mediaPromises };
    }
    
    showToast('正在生成网页...', 'info', 2000);
    
    const directoryTree = buildDirectoryTree(mulufile);
    const directoryHTML = generateDirectoryHTML(directoryTree);
    
    const { contentScripts, mediaDataScripts } = await generateContentScripts(mulufile);
    
    // 获取第一个目录的ID作为默认选中
    const firstDirId = mulufile.length > 0 && mulufile[0].length === 4 ? mulufile[0][2] : '';
    
    // 生成完整的HTML页面
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(baseName)} - SoraList</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            height: 100vh;
            overflow: hidden;
        }
        
        .sidebar {
            width: 280px;
            min-width: 200px;
            max-width: 400px;
            background-color: #f5f5f5;
            border-right: 1px solid #ddd;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .sidebar-header {
            padding: 15px;
            background-color: #fff;
            border-bottom: 1px solid #ddd;
            font-weight: bold;
            color: #333;
        }
        
        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            overflow-x: auto;
        }
        
        .sidebar-content-inner {
            min-width: max-content;
        }
        
        .mulu {
            min-height: 36px;
            line-height: 36px;
            border-bottom: 1px solid #eee;
            text-align: left;
            white-space: nowrap;
            position: relative;
            cursor: pointer;
            background-color: #f9f9f9;
            transition: background-color 0.2s;
            padding-right: 10px;
        }
        
        .mulu:hover {
            filter: brightness(0.95);
        }
        
        .mulu.selected {
            font-weight: bold;
        }
        
        .bullet-icon {
            position: absolute;
            left: 8px;
            top: 50%;
            transform: translateY(-50%);
            color: #999;
            font-size: 12px;
        }
        
        .bullet-icon::before {
            content: '•';
        }
        
        .toggle-icon {
            position: absolute;
            left: 3px;
            top: 50%;
            transform: translateY(-50%);
            width: 16px;
            height: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 3px;
        }
        
        .toggle-icon:hover {
            background-color: rgba(0, 0, 0, 0.1);
        }
        
        .toggle-icon::before {
            content: '';
            width: 0;
            height: 0;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            border-left: 5px solid #666;
            border-right: 0;
        }
        
        .mulu.has-children.expanded .toggle-icon::before {
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 5px solid #666;
            border-bottom: 0;
        }
        
        
        .mulu-text {
            margin-left: 2px;
        }
        
        .mulu.collapsed-child {
            display: none;
        }
        
        .content-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .content-header {
            padding: 15px 20px;
            background-color: #fff;
            border-bottom: 1px solid #ddd;
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }
        
        .content-body {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background-color: #fff;
            line-height: 1.6;
        }
        
        .content-body h1, .content-body h2, .content-body h3,
        .content-body h4, .content-body h5, .content-body h6 {
            margin-top: 1em;
            margin-bottom: 0.5em;
            font-weight: bold;
        }
        
        .content-body h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
        .content-body h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        .content-body h3 { font-size: 1.25em; }
        .content-body h4 { font-size: 1.1em; }
        .content-body h5 { font-size: 1em; }
        .content-body h6 { font-size: 0.9em; color: #777; }
        
        .content-body p { margin: 1em 0; }
        .content-body ul, .content-body ol { margin: 1em 0; padding-left: 2em; }
        .content-body li { margin: 0.5em 0; }
        
        .content-body blockquote {
            border-left: 4px solid #ddd;
            padding-left: 1em;
            margin: 1em 0;
            color: #666;
        }
        
        .content-body code {
            background-color: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            color: #e83e8c;
        }
        
        .content-body pre {
            position: relative;
            background-color: #f6f8fa;
            padding: 1em;
            padding-top: 2.2em;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
            min-height: 3em;
            border: 1px solid #d0d7de;
        }
        
        .content-body pre code {
            background-color: transparent;
            padding: 0;
            color: #24292f;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.6;
            display: block;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        /* 语法高亮 - GitHub 风格 */
        .content-body pre code .keyword { color: #cf222e; font-weight: 500; }
        .content-body pre code .string { color: #0a3069; }
        .content-body pre code .number { color: #0550ae; }
        .content-body pre code .comment { color: #6e7781; font-style: italic; }
        .content-body pre code .function { color: #8250df; }
        .content-body pre code .class-name { color: #953800; }
        .content-body pre code .property { color: #0550ae; }
        .content-body pre code .tag { color: #116329; }
        .content-body pre code .attr-name { color: #0550ae; }
        .content-body pre code .attr-value { color: #0a3069; }
        .content-body pre code .operator { color: #cf222e; }
        .content-body pre code .punctuation { color: #24292f; }
        
        .content-body pre .code-lang-label {
            position: absolute;
            top: 4px;
            right: 8px;
            padding: 2px 8px;
            background-color: #e1e4e8;
            border: none;
            border-radius: 4px;
            font-size: 11px;
            color: #57606a;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.2s;
            z-index: 10;
        }
        
        .content-body pre .code-lang-label:hover {
            background-color: #0066cc;
            color: #fff;
        }
        
        .content-body pre .code-lang-label.copied {
            background-color: #2da44e;
            color: #fff;
        }
        
        .content-body img {
            width: auto;
            height: auto;
            max-width: none;
            max-height: none;
            border-radius: 5px;
            display: block;
            margin: 1em auto;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        
        .content-body img:hover {
            opacity: 0.8;
        }
        
        .content-body video {
            display: block;
            margin: 1em auto;
            max-width: 640px;
            max-height: 360px;
            width: auto;
            height: auto;
            border-radius: 5px;
        }
        
        
        .image-viewer-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            z-index: 9999;
            cursor: pointer;
            justify-content: center;
            align-items: center;
        }
        
        .image-viewer-overlay.active {
            display: flex;
        }
        
        .image-viewer-overlay img {
            max-width: 90%;
            max-height: 90%;
            width: auto;
            height: auto;
            object-fit: contain;
            border-radius: 4px;
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
            cursor: default;
        }
        
        .image-viewer-close {
            position: absolute;
            top: 20px;
            right: 30px;
            color: #fff;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            z-index: 10000;
            line-height: 1;
        }
        
        .image-viewer-close:hover {
            color: #ccc;
        }
        
        .content-body table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }
        
        .content-body table th,
        .content-body table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        
        .content-body table th {
            background-color: #f4f4f4;
            font-weight: bold;
        }
        
        .content-body a {
            color: #0066cc;
            text-decoration: none;
        }
        
        .content-body a:hover {
            text-decoration: underline;
        }
        
        .content-body mark {
            background-color: #ffeb3b;
            padding: 2px 4px;
            border-radius: 2px;
        }
        
        .content-body sup {
            font-size: 0.8em;
            vertical-align: super;
        }
        
        .content-body sub {
            font-size: 0.8em;
            vertical-align: sub;
        }
        
        .content-body hr {
            margin: 2em 0;
            border: none;
            border-top: 2px solid #ddd;
        }
        
        .content-body figure {
            margin: 1em 0;
            text-align: center;
        }
        
        .content-body figure img {
            display: block;
            margin: 0 auto;
        }
        
        .content-body figure video {
            display: block;
            margin: 0 auto;
        }
        
        .content-body figcaption {
            margin-top: 0.5em;
            font-size: 0.9em;
            color: #666;
            font-style: italic;
            text-align: center;
        }
        
        .content-body spoiler {
            background-color: #333;
            color: transparent;
            padding: 2px 4px;
            border-radius: 3px;
            transition: all 0.3s ease;
            user-select: none;
        }
        
        .content-body spoiler:hover {
            background-color: #f0f0f0;
            color: inherit;
            user-select: text;
        }
        
        .content-body .contains-task-list {
            list-style: none;
            padding-left: 0;
        }
        
        .content-body .task-list-item {
            list-style: none;
            padding-left: 0;
            display: flex;
            align-items: flex-start;
            margin: 0.5em 0;
        }
        
        .content-body .task-list-item-checkbox {
            margin-right: 8px;
            margin-top: 4px;
            pointer-events: none;
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }
        
        .empty-state {
            text-align: center;
            color: #999;
            padding: 50px 20px;
        }
        
        .archive-attachment {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 1px solid #ced4da;
            border-radius: 8px;
            margin: 8px 0;
            max-width: 400px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
        }
        
        .archive-attachment:hover {
            border-color: #0066cc;
            box-shadow: 0 4px 8px rgba(0,102,204,0.15);
        }
        
        .archive-icon {
            font-size: 28px;
            flex-shrink: 0;
        }
        
        .archive-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .archive-name {
            font-weight: 600;
            color: #333;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .archive-size {
            font-size: 12px;
            color: #666;
        }
        
        .archive-download-btn {
            padding: 6px 12px;
            background-color: #0066cc;
            color: #fff;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        
        .archive-download-btn:hover {
            background-color: #0052a3;
            transform: translateY(-1px);
        }
        
        .archive-delete-btn {
            display: none;
        }
        
        @media (max-width: 768px) {
            body {
                flex-direction: column;
            }
            
            .sidebar {
                width: 100%;
                max-width: none;
                height: 40vh;
                border-right: none;
                border-bottom: 1px solid #ddd;
            }
            
            .content-area {
                height: 60vh;
            }
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">${escapeHtml(baseName)}</div>
        <div class="sidebar-content">
            <div class="sidebar-content-inner">
                ${directoryHTML}
            </div>
        </div>
    </div>
    <div class="content-area">
        <div class="content-header" id="contentTitle">选择一个目录查看内容</div>
        <div class="content-body" id="contentBody">
            <div class="empty-state">点击左侧目录查看内容</div>
        </div>
    </div>
    
    <div class="image-viewer-overlay" id="imageViewer">
        <span class="image-viewer-close" id="imageViewerClose">&times;</span>
        <img id="imageViewerImg" src="" alt="放大查看">
    </div>
    
    ${contentScripts}
    ${mediaDataScripts}
    <script>
        const contentCache = {};
        let mediaDataMap = {};
        let currentSelected = null;
        const nameMap = {};
        
        function selectDirectory(dirId, toggleExpand = false) {
            if (currentSelected) {
                currentSelected.classList.remove('selected');
            }
            
            const element = document.querySelector('[data-dir-id="' + dirId + '"]');
            if (element) {
                element.classList.add('selected');
                currentSelected = element;
                
                if (toggleExpand && element.classList.contains('has-children')) {
                    element.classList.toggle('expanded');
                    updateChildrenVisibility(dirId, element.classList.contains('expanded'));
                }
            }
            
            const content = getContent(dirId) || '';
            const title = nameMap[dirId] || '未命名';
            
            document.getElementById('contentTitle').textContent = title;
            document.getElementById('contentBody').innerHTML = content || '<div class="empty-state">此目录暂无内容</div>';
            
            initCodeBlocks();
            initImageViewer();
            initArchiveDownloads();
            
            setTimeout(() => {
                loadLazyMedia();
            }, 100);
        }
        
        function toggleDirectory(dirId, event) {
            if (event) {
                event.stopPropagation();
            }
            const element = document.querySelector('[data-dir-id="' + dirId + '"]');
            if (element && element.classList.contains('has-children')) {
                element.classList.toggle('expanded');
                updateChildrenVisibility(dirId, element.classList.contains('expanded'));
            }
        }
        
        function updateChildrenVisibility(parentId, show) {
            const allMulu = Array.from(document.querySelectorAll('.mulu'));
            const parentEl = document.querySelector('[data-dir-id="' + parentId + '"]');
            if (!parentEl) return;
            
            const parentIndex = allMulu.indexOf(parentEl);
            const parentLevel = parseInt(parentEl.dataset.level) || 0;
            
            for (let i = parentIndex + 1; i < allMulu.length; i++) {
                const child = allMulu[i];
                const childLevel = parseInt(child.dataset.level) || 0;
                
                if (childLevel <= parentLevel) {
                    break;
                }
                
                if (show) {
                    if (childLevel === parentLevel + 1) {
                        child.style.display = '';
                    } else {
                        const directParent = findDirectParent(child, allMulu, i);
                        if (directParent && directParent.classList.contains('expanded')) {
                            child.style.display = '';
                        }
                    }
                } else {
                    child.style.display = 'none';
                }
            }
        }
        
        function findDirectParent(element, allMulu, currentIndex) {
            const currentLevel = parseInt(element.dataset.level) || 0;
            for (let i = currentIndex - 1; i >= 0; i--) {
                const prevLevel = parseInt(allMulu[i].dataset.level) || 0;
                if (prevLevel === currentLevel - 1) {
                    return allMulu[i];
                }
            }
            return null;
        }
        
        (function() {
            const mediaDataScript = document.getElementById('mediaData');
            if (mediaDataScript) {
                try {
                    mediaDataMap = JSON.parse(mediaDataScript.textContent);
                } catch (e) {
                    console.error('解析媒体数据失败:', e);
                }
            }
        })();
        
        function getContent(dirId) {
            if (contentCache[dirId] !== undefined) {
                return contentCache[dirId];
            }
            const scriptEl = document.getElementById('content_' + dirId);
            if (scriptEl) {
                try {
                    contentCache[dirId] = JSON.parse(scriptEl.textContent);
                    return contentCache[dirId];
                } catch (e) {
                    console.error('解析内容失败:', dirId, e);
                    return '';
                }
            }
            return '';
        }
        
        let mediaObserver = null;
        
        function initMediaObserver() {
            if (typeof IntersectionObserver === 'undefined') {
                return;
            }
            
            if (mediaObserver) {
                mediaObserver.disconnect();
            }
            
            mediaObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const media = entry.target;
                        if (media.hasAttribute('data-loading') && media.getAttribute('data-loading') === 'true') {
                            loadSingleMedia(media);
                        }
                        mediaObserver.unobserve(media);
                    }
                });
            }, {
                rootMargin: '50px'
            });
            
            const contentBody = document.getElementById('contentBody');
            if (contentBody) {
                const lazyMedias = contentBody.querySelectorAll('.lazy-media[data-loading="true"]');
                lazyMedias.forEach(media => {
                    mediaObserver.observe(media);
                });
            }
        }
        
        async function loadSingleMedia(media) {
            if (media.hasAttribute('data-loading-media')) {
                return;
            }
            media.setAttribute('data-loading-media', 'true');
            
            const placeholderId = media.getAttribute('data-placeholder-id');
            if (!placeholderId || !mediaDataMap[placeholderId]) {
                media.removeAttribute('data-loading-media');
                return;
            }
            
            const mediaInfo = mediaDataMap[placeholderId];
            
            let dataUrl = mediaInfo.data;
            
            if (!dataUrl && mediaInfo.mediaId) {
                try {
                    const dbName = 'SoraDirectoryMediaDB';
                    const dbVersion = 1;
                    const storeName = 'media';
                    
                    const db = await new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName, dbVersion);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                        request.onupgradeneeded = () => {
                            const db = request.result;
                            if (!db.objectStoreNames.contains(storeName)) {
                                db.createObjectStore(storeName, { keyPath: 'id' });
                            }
                        };
                    });
                    
                    const record = await new Promise((resolve, reject) => {
                        const transaction = db.transaction([storeName], 'readonly');
                        const store = transaction.objectStore(storeName);
                        const request = store.get(mediaInfo.mediaId);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                    
                    if (record) {
                        if (record.chunked && record.chunks) {
                            const blobParts = [];
                            const mimeType = record.mimeType || 'application/octet-stream';
                            
                            if (record.blobChunked) {
                                for (const chunkId of record.chunks) {
                                    const chunkRecord = await new Promise((resolve, reject) => {
                                        const transaction = db.transaction([storeName], 'readonly');
                                        const store = transaction.objectStore(storeName);
                                        const request = store.get(chunkId);
                                        request.onsuccess = () => resolve(request.result);
                                        request.onerror = () => reject(request.error);
                                    });
                                    if (chunkRecord && chunkRecord.data) {
                                        blobParts.push(chunkRecord.data);
                                    }
                                }
                            } else {
                                for (const chunkId of record.chunks) {
                                    const chunkRecord = await new Promise((resolve, reject) => {
                                        const transaction = db.transaction([storeName], 'readonly');
                                        const store = transaction.objectStore(storeName);
                                        const request = store.get(chunkId);
                                        request.onsuccess = () => resolve(request.result);
                                        request.onerror = () => reject(request.error);
                                    });
                                    if (chunkRecord && chunkRecord.data) {
                                        try {
                                            const binaryString = atob(chunkRecord.data);
                                            const bytes = new Uint8Array(binaryString.length);
                                            for (let j = 0; j < binaryString.length; j++) {
                                                bytes[j] = binaryString.charCodeAt(j);
                                            }
                                            blobParts.push(bytes);
                                        } catch (e) {
                                            console.error('解码分块失败:', e);
                                        }
                                    }
                                }
                            }
                            
                            const blob = new Blob(blobParts, { type: mimeType });
                            dataUrl = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(blob);
                            });
                        } else {
                            dataUrl = record.data;
                        }
                    }
                } catch (err) {
                    console.error('从 IndexedDB 加载媒体失败:', err);
                    media.removeAttribute('data-loading-media');
                    return;
                }
            }
            
            if (!dataUrl) {
                media.removeAttribute('data-loading-media');
                return;
            }
            
            if (mediaInfo.type === 'image') {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        media.src = dataUrl;
                        media.removeAttribute('data-loading');
                        media.removeAttribute('data-loading-media');
                        media.classList.remove('lazy-media');
                        resolve();
                    };
                    img.onerror = () => {
                        media.removeAttribute('data-loading-media');
                        resolve();
                    };
                    img.src = dataUrl;
                });
            } else if (mediaInfo.type === 'video') {
                return new Promise((resolve) => {
                    const video = document.createElement('video');
                    video.controls = true;
                    video.preload = 'none';
                    video.style.cssText = 'display: block; margin: 1em auto; max-width: 640px; max-height: 360px; width: auto; height: auto; border-radius: 5px;';
                    
                    const originalTag = mediaInfo.originalTag;
                    if (originalTag && originalTag.includes('title=')) {
                        const titleMatch = originalTag.match(/\stitle=["']([^"']*)["']/);
                        if (titleMatch) video.title = titleMatch[1];
                    }
                    
                    video.onloadedmetadata = () => {
                        if (media.parentNode) {
                            media.parentNode.replaceChild(video, media);
                        }
                        if (video.offsetParent !== null) {
                            video.load();
                        }
                        resolve();
                    };
                    video.onerror = () => {
                        media.removeAttribute('data-loading-media');
                        resolve();
                    };
                    video.src = dataUrl;
                });
            }
        }
        
        async function loadLazyMedia() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            
            if (typeof IntersectionObserver !== 'undefined') {
                initMediaObserver();
                return;
            }
            
            const lazyMedias = contentBody.querySelectorAll('.lazy-media[data-loading="true"]');
            const loadPromises = Array.from(lazyMedias).map(media => loadSingleMedia(media));
            
            Promise.all(loadPromises).catch(err => {
                console.error('加载媒体时出错:', err);
            });
        }
        
        async function loadArchiveData(placeholderId) {
            if (!mediaDataMap[placeholderId] || mediaDataMap[placeholderId].type !== 'archive') {
                return null;
            }
            
            const archiveInfo = mediaDataMap[placeholderId];
            
            if (archiveInfo.data) {
                return archiveInfo.data;
            }
            
            if (archiveInfo.mediaId) {
                try {
                    const dbName = 'SoraDirectoryMediaDB';
                    const dbVersion = 1;
                    const storeName = 'media';
                    
                    const db = await new Promise((resolve, reject) => {
                        const request = indexedDB.open(dbName, dbVersion);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                        request.onupgradeneeded = () => {
                            const db = request.result;
                            if (!db.objectStoreNames.contains(storeName)) {
                                db.createObjectStore(storeName, { keyPath: 'id' });
                            }
                        };
                    });
                    
                    const record = await new Promise((resolve, reject) => {
                        const transaction = db.transaction([storeName], 'readonly');
                        const store = transaction.objectStore(storeName);
                        const request = store.get(archiveInfo.mediaId);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                    
                    if (record) {
                        if (record.chunked && record.chunks) {
                            const stream = new ReadableStream({
                                async start(controller) {
                                    try {
                                        const mimeType = record.mimeType || 'application/octet-stream';
                                        
                                        if (record.blobChunked) {
                                            for (let i = 0; i < record.chunks.length; i++) {
                                                const chunkId = record.chunks[i];
                                                
                                                const chunkRecord = await new Promise((resolve, reject) => {
                                                    const transaction = db.transaction([storeName], 'readonly');
                                                    const store = transaction.objectStore(storeName);
                                                    const request = store.get(chunkId);
                                                    request.onsuccess = () => resolve(request.result);
                                                    request.onerror = () => reject(request.error);
                                                });
                                                
                                                if (chunkRecord && chunkRecord.data) {
                                                    if (chunkRecord.data instanceof ArrayBuffer) {
                                                        controller.enqueue(new Uint8Array(chunkRecord.data));
                                                    } else if (chunkRecord.data instanceof Uint8Array) {
                                                        controller.enqueue(chunkRecord.data);
                                                    }
                                                }
                                            }
                                        } else {
                                            for (let i = 0; i < record.chunks.length; i++) {
                                                const chunkId = record.chunks[i];
                                                
                                                const chunkRecord = await new Promise((resolve, reject) => {
                                                    const transaction = db.transaction([storeName], 'readonly');
                                                    const store = transaction.objectStore(storeName);
                                                    const request = store.get(chunkId);
                                                    request.onsuccess = () => resolve(request.result);
                                                    request.onerror = () => reject(request.error);
                                                });
                                                
                                                if (chunkRecord && chunkRecord.data) {
                                                    try {
                                                        const binaryString = atob(chunkRecord.data);
                                                        const bytes = new Uint8Array(binaryString.length);
                                                        for (let j = 0; j < binaryString.length; j++) {
                                                            bytes[j] = binaryString.charCodeAt(j);
                                                        }
                                                        controller.enqueue(bytes);
                                                    } catch (e) {
                                                        console.error('解码分块失败:', e);
                                                        controller.error(e);
                                                        return;
                                                    }
                                                }
                                            }
                                        }
                                        
                                        controller.close();
                                    } catch (error) {
                                        controller.error(error);
                                    }
                                }
                            });
                            
                            const response = new Response(stream);
                            const blob = await response.blob();
                            
                            return await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.onerror = () => reject(reader.error);
                                reader.readAsDataURL(blob);
                            });
                        } else {
                            return record.data;
                        }
                    }
                } catch (err) {
                    console.error('从 IndexedDB 加载压缩包失败:', err);
                }
            }
            
            return null;
        }
        
        document.querySelectorAll('.mulu').forEach(el => {
            nameMap[el.dataset.dirId] = el.textContent.trim();
        });
        
        function initCodeBlocks() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            
            const codeBlocks = contentBody.querySelectorAll('pre');
            codeBlocks.forEach(pre => {
                if (pre.dataset.initialized) return;
                pre.dataset.initialized = 'true';
                
                const lang = pre.getAttribute('data-lang') || 'code';
                
                const existingLabel = pre.querySelector('.code-lang-label');
                if (existingLabel) {
                    existingLabel.remove();
                }
                
                const langLabel = document.createElement('button');
                langLabel.className = 'code-lang-label';
                langLabel.textContent = lang.toUpperCase();
                langLabel.type = 'button';
                langLabel.dataset.lang = lang.toUpperCase();
                
                pre.addEventListener('mouseenter', () => {
                    if (!langLabel.classList.contains('copied')) {
                        langLabel.textContent = '点击复制';
                    }
                });
                
                pre.addEventListener('mouseleave', () => {
                    if (!langLabel.classList.contains('copied')) {
                        langLabel.textContent = langLabel.dataset.lang;
                    }
                });
                
                langLabel.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const codeElement = pre.querySelector('code');
                    const code = codeElement ? codeElement.textContent : pre.textContent;
                    
                    try {
                        await navigator.clipboard.writeText(code);
                        langLabel.textContent = '已复制!';
                        langLabel.classList.add('copied');
                        
                        setTimeout(() => {
                            langLabel.textContent = langLabel.dataset.lang;
                            langLabel.classList.remove('copied');
                        }, 2000);
                    } catch (err) {
                        const textArea = document.createElement('textarea');
                        textArea.value = code;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        try {
                            document.execCommand('copy');
                            langLabel.textContent = '已复制!';
                            langLabel.classList.add('copied');
                            setTimeout(() => {
                                langLabel.textContent = langLabel.dataset.lang;
                                langLabel.classList.remove('copied');
                            }, 2000);
                        } catch (e) {
                            langLabel.textContent = '复制失败';
                            setTimeout(() => {
                                langLabel.textContent = langLabel.dataset.lang;
                            }, 2000);
                        }
                        document.body.removeChild(textArea);
                    }
                });
                
                pre.appendChild(langLabel);
            });
        }
        
        const imageViewer = document.getElementById('imageViewer');
        const imageViewerImg = document.getElementById('imageViewerImg');
        const imageViewerClose = document.getElementById('imageViewerClose');
        
        function initImageViewer() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            
            const images = contentBody.querySelectorAll('img');
            images.forEach(img => {
                if (img.dataset.viewerInit) return;
                img.dataset.viewerInit = 'true';
                
                img.addEventListener('click', () => {
                    imageViewerImg.src = img.src;
                    imageViewer.classList.add('active');
                });
            });
        }
        
        async function initArchiveDownloads() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            
            const archives = contentBody.querySelectorAll('.archive-attachment');
            archives.forEach(archive => {
                if (archive.dataset.downloadInit) return;
                archive.dataset.downloadInit = 'true';
                
                const downloadBtn = archive.querySelector('.archive-download-btn');
                if (!downloadBtn) return;
                
                downloadBtn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const placeholderId = archive.getAttribute('data-placeholder-id');
                    const fileName = archive.dataset.archiveName || 'download';
                    
                    const originalText = downloadBtn.textContent;
                    downloadBtn.textContent = '加载中...';
                    downloadBtn.disabled = true;
                    
                    try {
                        const dataUrl = await loadArchiveData(placeholderId);
                        
                        if (!dataUrl) {
                            alert('文件数据不可用');
                            downloadBtn.textContent = originalText;
                            downloadBtn.disabled = false;
                            return;
                        }
                        
                        const a = document.createElement('a');
                        a.href = dataUrl;
                        a.download = fileName;
                        a.click();
                    } catch (err) {
                        console.error('加载压缩包失败:', err);
                        alert('加载文件失败，请重试');
                    } finally {
                        downloadBtn.textContent = originalText;
                        downloadBtn.disabled = false;
                    }
                });
            });
        }
        
        imageViewerClose.addEventListener('click', () => {
            imageViewer.classList.remove('active');
        });
        
        imageViewer.addEventListener('click', (e) => {
            if (e.target === imageViewer) {
                imageViewer.classList.remove('active');
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && imageViewer.classList.contains('active')) {
                imageViewer.classList.remove('active');
            }
        });
        
        window.selectDirectory = selectDirectory;
        window.toggleDirectory = toggleDirectory;
        
        ${firstDirId ? `selectDirectory('${firstDirId}', false);` : ''}
    </script>
</body>
</html>`;
    
    // 如果加密，包装 HTML
    let finalContent = htmlContent;
    if (encrypt && password) {
        const encryptedHtml = await encryptData(htmlContent, password);
        finalContent = generateEncryptedHtmlWrapper(baseName, encryptedHtml);
    }
    
    // 创建并下载文件
    const blob = new Blob([finalContent], { type: 'text/html;charset=utf-8' });
    const objectURL = URL.createObjectURL(blob);
    
    const aTag = document.createElement('a');
    aTag.href = objectURL;
    aTag.download = filename;
    aTag.click();
    
    URL.revokeObjectURL(objectURL);
    showToast(`已导出${encrypt ? '加密' : ''}网页：${filename}`, 'success', 2500);
}

/**
 * 生成加密 HTML 包装器（解密后显示原始网页）
 * @param {string} title - 页面标题
 * @param {string} encryptedHtml - 加密的 HTML 内容
 * @returns {string} - 包装后的 HTML
 */
function generateEncryptedHtmlWrapper(title, encryptedHtml) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - 加密文档</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .box { background: #fff; padding: 30px; border-radius: 8px; border: 1px solid #ddd; text-align: center; }
        h3 { margin: 0 0 15px; color: #333; }
        input { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; width: 200px; margin-right: 8px; }
        button { padding: 8px 16px; background: #0066cc; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0052a3; }
        .error { color: #e74c3c; margin-top: 10px; font-size: 13px; display: none; }
    </style>
</head>
<body>
    <div class="box">
        <h3>${title}</h3>
        <div>
            <input type="password" id="pwd" placeholder="输入密码" autofocus>
            <button onclick="decrypt()">解锁</button>
        </div>
        <div class="error" id="err">密码错误</div>
    </div>
    <script>
        const D='${encryptedHtml}';
        async function decrypt(){
            const p=document.getElementById('pwd').value;
            if(!p)return;
            try{
                const c=Uint8Array.from(atob(D),x=>x.charCodeAt(0));
                const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:c.slice(0,16),iterations:100000,hash:'SHA-256'},await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveKey']),{name:'AES-GCM',length:256},false,['decrypt']);
                const h=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:c.slice(16,28)},k,c.slice(28)));
                document.open();document.write(h);document.close();
            }catch(e){document.getElementById('err').style.display='block';document.getElementById('pwd').value='';document.getElementById('pwd').focus();}
        }
        document.getElementById('pwd').onkeypress=e=>{if(e.key==='Enter')decrypt();};
    </script>
</body>
</html>`;
}