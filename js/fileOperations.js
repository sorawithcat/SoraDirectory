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
        const content = await file.text();
        
        // 解析文件内容（可能是 Promise，处理加密文件）
        let parsedData = parseFileContent(content, file.name);
        if (parsedData instanceof Promise) {
            parsedData = await parsedData;
        }
        
        if (!parsedData) {
            // 用户取消解密
            return false;
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
            
            showToast(`已合并：新增 ${mergeResult.added} 个，更新 ${mergeResult.updated} 个目录`, 'success', 3000);
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
        
        // 计算初始哈希
        calculateAllHashes();
        hasUnsavedChanges = false;
        updateSaveButtonState();
        
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
        
        showToast(`已打开：${file.name}（支持直接保存）`, 'success', 3000);
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
        
        // 如果内容包含 IndexedDB 媒体引用，异步恢复媒体数据
        if (loadedContent && loadedContent.includes('data-media-storage-id')) {
            (async function() {
                if (typeof MediaStorage !== 'undefined') {
                    loadedContent = await MediaStorage.processHtmlForLoad(loadedContent);
                }
                jiedianwords.value = loadedContent;
                isUpdating = true;
                updateMarkdownPreview();
                isUpdating = false;
            })();
        } else {
            jiedianwords.value = loadedContent;
            isUpdating = true;
            updateMarkdownPreview();
            isUpdating = false;
        }
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
    
    // 生成内容映射（异步，支持从 IndexedDB 恢复视频数据）
    async function generateContentMap(muluData) {
        const contentMap = {};
        for (const item of muluData) {
            if (item.length === 4) {
                let content = item[3];
                // 如果内容包含 IndexedDB 媒体引用（视频/图片），恢复媒体数据
                if (content && content.includes('data-media-storage-id') && typeof MediaStorage !== 'undefined') {
                    content = await MediaStorage.processHtmlForExport(content);
                }
                contentMap[item[2]] = content;
            }
        }
        return contentMap;
    }
    
    const directoryTree = buildDirectoryTree(mulufile);
    const directoryHTML = generateDirectoryHTML(directoryTree);
    const contentMap = await generateContentMap(mulufile);
    
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
            display: block;
            width: 100%;
            box-sizing: border-box;
            border-left: 4px solid #ddd;
            padding: 0.5em 1em;
            margin: 1em 0;
            background-color: #f5f5f5;
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
            padding-top: 2.5em;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
            border: 1px solid #d0d7de;
        }
        
        .content-body pre code {
            background-color: transparent;
            padding: 0;
            color: #24292f;
            display: block;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .content-body pre .code-lang-label {
            position: absolute;
            top: 6px;
            right: 8px;
            padding: 3px 10px;
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
            max-width: 800px;
            max-height: 600px;
            width: auto;
            height: auto;
            border-radius: 5px;
            display: block;
            margin: 1em auto;
            cursor: pointer;
            transition: transform 0.2s;
            object-fit: contain;
        }
        
        .content-body img:hover {
            transform: scale(1.02);
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
            object-fit: contain;
            border-radius: 4px;
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
    
    <script>
        const contentMap = ${JSON.stringify(contentMap)};
        
        const nameMap = {};
        document.querySelectorAll('.mulu').forEach(el => {
            nameMap[el.dataset.dirId] = el.textContent.trim();
        });
        
        let currentSelected = null;
        
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
            
            const content = contentMap[dirId] || '';
            const title = nameMap[dirId] || '未命名';
            
            document.getElementById('contentTitle').textContent = title;
            document.getElementById('contentBody').innerHTML = content || '<div class="empty-state">此目录暂无内容</div>';
            
            initCodeBlocks();
            initImageViewer();
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

/**
 * 导出为 Word 文档
 * 目录放在最前面，然后是内容
 */
async function handleExportToWord() {
    // 检查 docx 库是否可用
    if (typeof docx === 'undefined') {
        showToast('Word 导出功能加载失败，请检查网络连接', 'error', 3000);
        return;
    }
    
    // 从输入框获取文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    baseName = baseName.replace(/\.(json|txt|xml|csv|html|docx)$/i, '');
    let filename = `${baseName}.docx`;
    
    // 解构 docx 库的组件
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, TableOfContents, 
            Table, TableRow, TableCell, WidthType, BorderStyle, 
            AlignmentType, convertInchesToTwip, PageBreak, ExternalHyperlink,
            ImageRun, HorizontalRule, Bookmark } = docx;
    
    // 构建目录树结构
    function buildDirectoryTree(muluData) {
        const tree = [];
        const idMap = {};
        
        // 创建ID到数据的映射
        muluData.forEach((item, index) => {
            if (item.length === 4) {
                idMap[item[2]] = {
                    parentId: item[0],
                    name: item[1],
                    id: item[2],
                    content: item[3],
                    children: [],
                    order: index
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
    
    // 获取所有目录的扁平列表（按树形顺序）
    function flattenTree(tree, level = 0) {
        const result = [];
        tree.forEach(item => {
            result.push({ ...item, level });
            if (item.children && item.children.length > 0) {
                result.push(...flattenTree(item.children, level + 1));
            }
        });
        return result;
    }
    
    // 将 base64 图片数据转换为 Uint8Array
    function base64ToUint8Array(base64) {
        // 移除 data URL 前缀
        const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    
    // 从 URL 获取图片数据
    async function fetchImageAsUint8Array(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        } catch (error) {
            console.error('获取图片失败:', url, error);
            return null;
        }
    }
    
    // 收集所有图片并预加载
    async function collectAndLoadImages(html) {
        const imageMap = new Map();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const images = tempDiv.querySelectorAll('img');
        const loadPromises = [];
        
        for (const img of images) {
            const src = img.getAttribute('src');
            if (!src || imageMap.has(src)) continue;
            
            if (src.startsWith('data:image/')) {
                // base64 图片
                try {
                    const imageData = base64ToUint8Array(src);
                    imageMap.set(src, { data: imageData, width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
                } catch (e) {
                    console.error('解析 base64 图片失败:', e);
                }
            } else {
                // URL 图片
                loadPromises.push(
                    fetchImageAsUint8Array(src).then(data => {
                        if (data) {
                            imageMap.set(src, { data: data, width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
                        }
                    })
                );
            }
        }
        
        await Promise.all(loadPromises);
        return imageMap;
    }
    
    // 将 HTML 内容转换为 Word 段落
    async function htmlToWordParagraphs(html, imageMap, baseLevel = 0) {
        const paragraphs = [];
        
        if (!html || html.trim() === '') {
            paragraphs.push(new Paragraph({ text: '' }));
            return paragraphs;
        }
        
        // 创建临时 DOM 解析 HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // 解析 CSS 颜色值为十六进制
        function parseColor(color) {
            if (!color) return null;
            // 已经是十六进制
            if (color.startsWith('#')) {
                return color.replace('#', '').toUpperCase();
            }
            // rgb/rgba 格式
            const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
                const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
                const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
                return (r + g + b).toUpperCase();
            }
            // 命名颜色映射
            const colorMap = {
                'red': 'FF0000', 'blue': '0000FF', 'green': '008000', 'yellow': 'FFFF00',
                'orange': 'FFA500', 'purple': '800080', 'pink': 'FFC0CB', 'black': '000000',
                'white': 'FFFFFF', 'gray': '808080', 'grey': '808080', 'cyan': '00FFFF',
                'magenta': 'FF00FF', 'brown': 'A52A2A', 'navy': '000080', 'teal': '008080'
            };
            return colorMap[color.toLowerCase()] || null;
        }
        
        // 递归处理 DOM 节点
        function processNode(node, currentStyles = {}) {
            const textRuns = [];
            
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (text.trim() || text.includes(' ')) {
                    const runOptions = {
                        text: text,
                        bold: currentStyles.bold || false,
                        italics: currentStyles.italic || false,
                        underline: currentStyles.underline ? {} : undefined,
                        strike: currentStyles.strikethrough || false,
                        highlight: currentStyles.highlight ? 'yellow' : undefined,
                        superScript: currentStyles.superscript || false,
                        subScript: currentStyles.subscript || false
                    };
                    // 添加字体颜色
                    if (currentStyles.color) {
                        runOptions.color = currentStyles.color;
                    }
                    // 添加字体大小
                    if (currentStyles.fontSize) {
                        runOptions.size = currentStyles.fontSize;
                    }
                    // 行内代码样式
                    if (currentStyles.code) {
                        runOptions.font = { name: 'Consolas' };
                        runOptions.shading = { fill: 'F0F0F0' };
                    }
                    textRuns.push(new TextRun(runOptions));
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                const newStyles = { ...currentStyles };
                
                // 从 style 属性解析样式
                const style = node.style;
                if (style) {
                    if (style.color) {
                        const parsedColor = parseColor(style.color);
                        if (parsedColor) newStyles.color = parsedColor;
                    }
                    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
                        newStyles.highlight = true;
                    }
                    if (style.fontSize) {
                        // 转换 px 到 half-points (1pt = 2 half-points)
                        const pxMatch = style.fontSize.match(/(\d+)px/);
                        if (pxMatch) {
                            newStyles.fontSize = parseInt(pxMatch[1]) * 1.5; // 近似转换
                        }
                    }
                }
                
                // 更新样式
                switch (tagName) {
                    case 'strong':
                    case 'b':
                        newStyles.bold = true;
                        break;
                    case 'em':
                    case 'i':
                        newStyles.italic = true;
                        break;
                    case 'u':
                        newStyles.underline = true;
                        break;
                    case 's':
                    case 'del':
                    case 'strike':
                        newStyles.strikethrough = true;
                        break;
                    case 'mark':
                        newStyles.highlight = true;
                        break;
                    case 'sup':
                        newStyles.superscript = true;
                        break;
                    case 'sub':
                        newStyles.subscript = true;
                        break;
                    case 'code':
                        // 行内代码（不在 pre 内）
                        newStyles.code = true;
                        break;
                    case 'spoiler':
                        // spoiler 标签显示为灰色背景
                        newStyles.highlight = true;
                        break;
                    case 'a':
                        // 链接样式：蓝色下划线
                        newStyles.color = '0066CC';
                        newStyles.underline = true;
                        break;
                    case 'span':
                        // span 的样式已在上面通过 style 属性处理
                        break;
                    case 'br':
                        // 换行
                        textRuns.push(new TextRun({ break: 1 }));
                        return textRuns;
                }
                
                // 处理子节点
                for (const child of node.childNodes) {
                    textRuns.push(...processNode(child, newStyles));
                }
            }
            
            return textRuns;
        }
        
        // 处理块级元素
        function processBlockElement(element) {
            const tagName = element.tagName ? element.tagName.toLowerCase() : '';
            
            switch (tagName) {
                case 'h1':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }));
                    break;
                case 'h2':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 350, after: 150 }
                    }));
                    break;
                case 'h3':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 300, after: 100 }
                    }));
                    break;
                case 'h4':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_4,
                        spacing: { before: 250, after: 100 }
                    }));
                    break;
                case 'h5':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_5,
                        spacing: { before: 200, after: 100 }
                    }));
                    break;
                case 'h6':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_6,
                        spacing: { before: 200, after: 100 }
                    }));
                    break;
                case 'p':
                    // 检查段落中是否包含图片
                    const pImages = element.querySelectorAll('img');
                    if (pImages.length > 0) {
                        // 如果包含图片，需要分开处理文本和图片
                        // 先处理图片之前的文本
                        let currentNode = element.firstChild;
                        let textRuns = [];
                        
                        while (currentNode) {
                            if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.tagName.toLowerCase() === 'img') {
                                // 先添加之前积累的文本
                                if (textRuns.length > 0) {
                                    paragraphs.push(new Paragraph({
                                        children: textRuns,
                                        spacing: { before: 100, after: 100 }
                                    }));
                                    textRuns = [];
                                }
                                
                                // 处理图片
                                const pImgSrc = currentNode.getAttribute('src');
                                if (pImgSrc && imageMap.has(pImgSrc)) {
                                    const pImgInfo = imageMap.get(pImgSrc);
                                    try {
                                        let pImgWidth = pImgInfo.width || 400;
                                        let pImgHeight = pImgInfo.height || 300;
                                        const pMaxWidth = 500;
                                        
                                        if (pImgWidth > pMaxWidth) {
                                            const ratio = pMaxWidth / pImgWidth;
                                            pImgWidth = pMaxWidth;
                                            pImgHeight = Math.round(pImgHeight * ratio);
                                        }
                                        
                                        paragraphs.push(new Paragraph({
                                            children: [new ImageRun({
                                                data: pImgInfo.data,
                                                transformation: {
                                                    width: pImgWidth,
                                                    height: pImgHeight
                                                }
                                            })],
                                            alignment: AlignmentType.CENTER,
                                            spacing: { before: 100, after: 100 }
                                        }));
                                    } catch (pImgError) {
                                        console.error('添加段落内图片到 Word 失败:', pImgError);
                                    }
                                }
                            } else {
                                // 处理文本或其他元素
                                textRuns.push(...processNode(currentNode));
                            }
                            currentNode = currentNode.nextSibling;
                        }
                        
                        // 添加剩余的文本
                        if (textRuns.length > 0) {
                            paragraphs.push(new Paragraph({
                                children: textRuns,
                                spacing: { before: 100, after: 100 }
                            }));
                        }
                    } else {
                        const pChildren = processNode(element);
                        if (pChildren.length > 0) {
                            paragraphs.push(new Paragraph({
                                children: pChildren,
                                spacing: { before: 100, after: 100 }
                            }));
                        }
                    }
                    break;
                case 'ul':
                case 'ol':
                    // 处理列表（支持嵌套和任务列表）
                    function processListItems(listElement, listType, level = 0) {
                        const items = listElement.querySelectorAll(':scope > li');
                        items.forEach((li, index) => {
                            // 检查是否是任务列表项
                            const checkbox = li.querySelector(':scope > input[type="checkbox"]');
                            const isTaskItem = checkbox !== null;
                            const isChecked = checkbox ? checkbox.checked : false;
                            
                            let bullet;
                            if (isTaskItem) {
                                bullet = isChecked ? '☑ ' : '☐ ';
                            } else {
                                bullet = listType === 'ul' ? '• ' : `${index + 1}. `;
                            }
                            
                            // 处理列表项内容（排除嵌套列表）
                            const liContentRuns = [];
                            for (const child of li.childNodes) {
                                if (child.nodeType === Node.ELEMENT_NODE) {
                                    const childTag = child.tagName.toLowerCase();
                                    if (childTag === 'ul' || childTag === 'ol') {
                                        continue; // 嵌套列表单独处理
                                    }
                                    if (childTag === 'input' && child.type === 'checkbox') {
                                        continue; // 跳过 checkbox
                                    }
                                }
                                liContentRuns.push(...processNode(child));
                            }
                            
                            paragraphs.push(new Paragraph({
                                children: [
                                    new TextRun({ text: '  '.repeat(level) + bullet }),
                                    ...liContentRuns
                                ],
                                indent: { left: convertInchesToTwip(0.3 * (level + 1)) },
                                spacing: { before: 50, after: 50 }
                            }));
                            
                            // 处理嵌套列表
                            const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
                            nestedLists.forEach(nestedList => {
                                const nestedType = nestedList.tagName.toLowerCase();
                                processListItems(nestedList, nestedType, level + 1);
                            });
                        });
                    }
                    processListItems(element, tagName, 0);
                    break;
                case 'blockquote':
                    const quoteChildren = processNode(element);
                    paragraphs.push(new Paragraph({
                        children: quoteChildren,
                        indent: { left: convertInchesToTwip(0.5) },
                        spacing: { before: 100, after: 100 },
                        shading: { fill: 'F5F5F5' },
                        border: {
                            left: { style: BorderStyle.SINGLE, size: 24, color: 'CCCCCC' }
                        }
                    }));
                    break;
                case 'pre':
                    const codeElement = element.querySelector('code') || element;
                    const codeText = codeElement.textContent || '';
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({
                            text: codeText,
                            font: { name: 'Consolas' },
                            size: 20
                        })],
                        shading: { fill: 'F6F8FA' },
                        border: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: 'D0D7DE' },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D0D7DE' },
                            left: { style: BorderStyle.SINGLE, size: 1, color: 'D0D7DE' },
                            right: { style: BorderStyle.SINGLE, size: 1, color: 'D0D7DE' }
                        },
                        spacing: { before: 100, after: 100 }
                    }));
                    break;
                case 'hr':
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: '─'.repeat(50) })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200, after: 200 }
                    }));
                    break;
                case 'img':
                    // 处理图片
                    const imgSrc = element.getAttribute('src');
                    if (imgSrc && imageMap.has(imgSrc)) {
                        const imgInfo = imageMap.get(imgSrc);
                        try {
                            // 计算适当的尺寸，最大宽度 500 像素
                            let imgWidth = imgInfo.width || 400;
                            let imgHeight = imgInfo.height || 300;
                            const maxWidth = 500;
                            
                            if (imgWidth > maxWidth) {
                                const ratio = maxWidth / imgWidth;
                                imgWidth = maxWidth;
                                imgHeight = Math.round(imgHeight * ratio);
                            }
                            
                            paragraphs.push(new Paragraph({
                                children: [new ImageRun({
                                    data: imgInfo.data,
                                    transformation: {
                                        width: imgWidth,
                                        height: imgHeight
                                    }
                                })],
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 200, after: 200 }
                            }));
                        } catch (imgError) {
                            console.error('添加图片到 Word 失败:', imgError);
                            paragraphs.push(new Paragraph({
                                children: [new TextRun({ text: '[图片]', italics: true, color: '999999' })],
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 100, after: 100 }
                            }));
                        }
                    } else {
                        // 图片加载失败，显示占位符
                        paragraphs.push(new Paragraph({
                            children: [new TextRun({ text: '[图片]', italics: true, color: '999999' })],
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 100, after: 100 }
                        }));
                    }
                    break;
                case 'figure':
                    // 处理 figure 元素（包含图片和说明）
                    const figImg = element.querySelector('img');
                    const figCaption = element.querySelector('figcaption');
                    
                    if (figImg) {
                        const figImgSrc = figImg.getAttribute('src');
                        if (figImgSrc && imageMap.has(figImgSrc)) {
                            const figImgInfo = imageMap.get(figImgSrc);
                            try {
                                let figImgWidth = figImgInfo.width || 400;
                                let figImgHeight = figImgInfo.height || 300;
                                const figMaxWidth = 500;
                                
                                if (figImgWidth > figMaxWidth) {
                                    const ratio = figMaxWidth / figImgWidth;
                                    figImgWidth = figMaxWidth;
                                    figImgHeight = Math.round(figImgHeight * ratio);
                                }
                                
                                paragraphs.push(new Paragraph({
                                    children: [new ImageRun({
                                        data: figImgInfo.data,
                                        transformation: {
                                            width: figImgWidth,
                                            height: figImgHeight
                                        }
                                    })],
                                    alignment: AlignmentType.CENTER,
                                    spacing: { before: 200, after: 100 }
                                }));
                            } catch (figImgError) {
                                console.error('添加 figure 图片到 Word 失败:', figImgError);
                                paragraphs.push(new Paragraph({
                                    children: [new TextRun({ text: '[图片]', italics: true, color: '999999' })],
                                    alignment: AlignmentType.CENTER,
                                    spacing: { before: 100, after: 100 }
                                }));
                            }
                        }
                    }
                    
                    if (figCaption) {
                        paragraphs.push(new Paragraph({
                            children: processNode(figCaption),
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 50, after: 200 }
                        }));
                    }
                    break;
                case 'table':
                    // 处理表格
                    const rows = element.querySelectorAll('tr');
                    if (rows.length > 0) {
                        const tableRows = [];
                        let maxCols = 0;
                        
                        // 首先确定最大列数
                        rows.forEach(row => {
                            const cells = row.querySelectorAll('th, td');
                            if (cells.length > maxCols) maxCols = cells.length;
                        });
                        
                        rows.forEach((row, rowIndex) => {
                            const cells = row.querySelectorAll('th, td');
                            const tableCells = [];
                            const isHeader = row.parentElement && row.parentElement.tagName.toLowerCase() === 'thead';
                            
                            cells.forEach((cell, cellIndex) => {
                                const isHeaderCell = cell.tagName.toLowerCase() === 'th' || isHeader;
                                const cellContent = processNode(cell);
                                
                                tableCells.push(new TableCell({
                                    children: [new Paragraph({
                                        children: cellContent.length > 0 ? cellContent : [new TextRun({ text: '' })],
                                        alignment: AlignmentType.LEFT
                                    })],
                                    width: { size: Math.floor(100 / maxCols), type: WidthType.PERCENTAGE },
                                    shading: isHeaderCell ? { fill: 'E8E8E8' } : undefined,
                                    margins: {
                                        top: convertInchesToTwip(0.05),
                                        bottom: convertInchesToTwip(0.05),
                                        left: convertInchesToTwip(0.1),
                                        right: convertInchesToTwip(0.1)
                                    }
                                }));
                            });
                            
                            // 填充空单元格
                            while (tableCells.length < maxCols) {
                                tableCells.push(new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
                                    width: { size: Math.floor(100 / maxCols), type: WidthType.PERCENTAGE }
                                }));
                            }
                            
                            if (tableCells.length > 0) {
                                tableRows.push(new TableRow({ children: tableCells }));
                            }
                        });
                        
                        if (tableRows.length > 0) {
                            // 创建表格对象
                            const table = new Table({
                                rows: tableRows,
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                borders: {
                                    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
                                }
                            });
                            // 表格前后添加空段落作为间距
                            paragraphs.push(new Paragraph({ text: '', spacing: { before: 100 } }));
                            paragraphs.push(table);
                            paragraphs.push(new Paragraph({ text: '', spacing: { after: 100 } }));
                        }
                    }
                    break;
                case 'br':
                    // 换行
                    paragraphs.push(new Paragraph({ text: '' }));
                    break;
                case 'div':
                case 'section':
                case 'article':
                case 'main':
                case 'header':
                case 'footer':
                case 'aside':
                case 'nav':
                    // 容器元素，递归处理子元素
                    for (const child of element.childNodes) {
                        if (child.nodeType === Node.TEXT_NODE) {
                            const text = child.textContent.trim();
                            if (text) {
                                paragraphs.push(new Paragraph({
                                    children: [new TextRun({ text })],
                                    spacing: { before: 50, after: 50 }
                                }));
                            }
                        } else if (child.nodeType === Node.ELEMENT_NODE) {
                            processBlockElement(child);
                        }
                    }
                    break;
                case 'span':
                case 'a':
                case 'strong':
                case 'b':
                case 'em':
                case 'i':
                case 'u':
                case 's':
                case 'del':
                case 'code':
                case 'mark':
                case 'sup':
                case 'sub':
                    // 内联元素作为块级处理时，包装成段落
                    const inlineChildren = processNode(element);
                    if (inlineChildren.length > 0) {
                        paragraphs.push(new Paragraph({
                            children: inlineChildren,
                            spacing: { before: 50, after: 50 }
                        }));
                    }
                    break;
                case 'video':
                case 'audio':
                case 'iframe':
                case 'embed':
                case 'object':
                    // 媒体元素，显示占位符
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: '[媒体内容]', italics: true, color: '999999' })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100, after: 100 }
                    }));
                    break;
                case 'details':
                    // 处理 details 元素
                    const summary = element.querySelector('summary');
                    if (summary) {
                        paragraphs.push(new Paragraph({
                            children: [
                                new TextRun({ text: '▶ ', bold: true }),
                                ...processNode(summary)
                            ],
                            spacing: { before: 100, after: 50 }
                        }));
                    }
                    // 处理 details 内的其他内容
                    for (const child of element.childNodes) {
                        if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() !== 'summary') {
                            processBlockElement(child);
                        }
                    }
                    break;
                case 'summary':
                    // summary 已在 details 中处理
                    break;
                case 'dl':
                    // 定义列表
                    const dlItems = element.querySelectorAll(':scope > dt, :scope > dd');
                    dlItems.forEach(item => {
                        const isDt = item.tagName.toLowerCase() === 'dt';
                        paragraphs.push(new Paragraph({
                            children: processNode(item),
                            indent: isDt ? undefined : { left: convertInchesToTwip(0.5) },
                            spacing: { before: isDt ? 100 : 50, after: 50 }
                        }));
                    });
                    break;
                case 'dt':
                case 'dd':
                    // 单独出现时的处理
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        indent: tagName === 'dd' ? { left: convertInchesToTwip(0.5) } : undefined,
                        spacing: { before: 50, after: 50 }
                    }));
                    break;
                default:
                    // 处理其他元素或文本节点
                    if (element.childNodes && element.childNodes.length > 0) {
                        for (const child of element.childNodes) {
                            if (child.nodeType === Node.TEXT_NODE) {
                                const text = child.textContent.trim();
                                if (text) {
                                    paragraphs.push(new Paragraph({
                                        children: [new TextRun({ text })],
                                        spacing: { before: 50, after: 50 }
                                    }));
                                }
                            } else if (child.nodeType === Node.ELEMENT_NODE) {
                                processBlockElement(child);
                            }
                        }
                    } else if (element.textContent && element.textContent.trim()) {
                        paragraphs.push(new Paragraph({
                            children: processNode(element),
                            spacing: { before: 50, after: 50 }
                        }));
                    }
            }
        }
        
        // 处理顶层元素
        for (const child of tempDiv.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) {
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text })],
                        spacing: { before: 50, after: 50 }
                    }));
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                processBlockElement(child);
            }
        }
        
        return paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: '' })];
    }
    
    // 构建目录树
    const directoryTree = buildDirectoryTree(mulufile);
    const flatList = flattenTree(directoryTree);
    
    // 预加载所有图片
    showToast('正在处理图片...', 'info', 2000);
    const allHtmlContent = flatList.map(item => item.content || '').join('');
    const imageMap = await collectAndLoadImages(allHtmlContent);
    
    // 创建文档内容
    const children = [];
    
    // 添加文档标题
    children.push(new Paragraph({
        children: [new TextRun({
            text: baseName,
            bold: true,
            size: 56  // 28pt
        })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));
    
    // 添加目录标题
    children.push(new Paragraph({
        children: [new TextRun({
            text: '目 录',
            bold: true,
            size: 36  // 18pt
        })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 300 }
    }));
    
    // 生成目录列表（常见目录样式：序号 + 名称 + 点线 + 页码）
    // 计算各级序号
    const levelCounters = [0, 0, 0, 0, 0, 0]; // 最多6级
    let lastLevel = -1;
    
    flatList.forEach((item, index) => {
        const level = item.level;
        
        // 更新序号
        if (level > lastLevel) {
            // 进入子级，重置当前级别计数
            levelCounters[level] = 1;
        } else if (level === lastLevel) {
            // 同级，递增
            levelCounters[level]++;
        } else {
            // 返回上级，重置下级计数，递增当前级别
            for (let i = level + 1; i < 6; i++) {
                levelCounters[i] = 0;
            }
            levelCounters[level]++;
        }
        lastLevel = level;
        
        // 生成序号字符串（如：1、1.1、1.1.1）
        let numberStr = '';
        for (let i = 0; i <= level; i++) {
            if (i === 0) {
                numberStr = String(levelCounters[i]);
            } else {
                numberStr += '.' + levelCounters[i];
            }
        }
        
        // 根据层级调整样式
        const indent = level * 0.4;  // 每级缩进 0.4 英寸
        const fontSize = level === 0 ? 26 : 24;  // 一级目录稍大
        const isBold = level === 0;  // 一级目录加粗
        
        // 创建目录项：序号 + 名称 + 点线填充 + 页码占位
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: numberStr + '  ',
                    bold: isBold,
                    size: fontSize
                }),
                new TextRun({
                    text: item.name,
                    bold: isBold,
                    size: fontSize
                }),
                new TextRun({
                    text: ' ',
                    size: fontSize
                }),
                // 使用制表符和点线
                new TextRun({
                    text: '·'.repeat(Math.max(3, 40 - item.name.length - numberStr.length - level * 4)),
                    size: fontSize,
                    color: 'AAAAAA'
                }),
                new TextRun({
                    text: ' ' + (index + 1),  // 使用序号作为伪页码
                    bold: isBold,
                    size: fontSize
                })
            ],
            indent: { left: convertInchesToTwip(indent) },
            spacing: { before: level === 0 ? 120 : 60, after: level === 0 ? 80 : 60 },
            tabStops: [{
                type: 'right',
                position: convertInchesToTwip(6),
                leader: 'dot'
            }]
        }));
    });
    
    // 添加分页符
    children.push(new Paragraph({
        children: [new PageBreak()]
    }));
    
    // 添加内容标题
    children.push(new Paragraph({
        children: [new TextRun({
            text: '正 文',
            bold: true,
            size: 36  // 18pt
        })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 }
    }));
    
    // 添加各目录的内容
    for (const item of flatList) {
        // 根据层级确定标题级别
        const headingLevel = Math.min(item.level + 1, 6);
        const headingLevels = [
            HeadingLevel.HEADING_1,
            HeadingLevel.HEADING_2,
            HeadingLevel.HEADING_3,
            HeadingLevel.HEADING_4,
            HeadingLevel.HEADING_5,
            HeadingLevel.HEADING_6
        ];
        
        // 添加章节标题（居中放大显示）
        children.push(new Paragraph({
            children: [new TextRun({
                text: item.name,
                bold: true,
                size: 36 - (item.level * 4)  // 根据层级调整字号，一级36pt，二级32pt...
            })],
            heading: headingLevels[headingLevel - 1] || HeadingLevel.HEADING_6,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 300 }
        }));
        
        // 添加章节内容
        if (item.content && item.content.trim()) {
            const contentParagraphs = await htmlToWordParagraphs(item.content, imageMap);
            children.push(...contentParagraphs);
        } else {
            children.push(new Paragraph({
                children: [new TextRun({
                    text: '（暂无内容）',
                    italics: true,
                    color: '999999'
                })],
                spacing: { before: 100, after: 100 }
            }));
        }
        
        // 在各章节之间添加一些间距
        children.push(new Paragraph({
            text: '',
            spacing: { before: 200, after: 200 }
        }));
    }
    
    // 创建 Word 文档
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1),
                        right: convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left: convertInchesToTwip(1)
                    }
                }
            },
            children: children
        }]
    });
    
    // 生成并下载文件
    try {
        const blob = await Packer.toBlob(doc);
        const objectURL = URL.createObjectURL(blob);
        
        const aTag = document.createElement('a');
        aTag.href = objectURL;
        aTag.download = filename;
        aTag.click();
        
        URL.revokeObjectURL(objectURL);
        showToast(`已导出 Word 文档：${filename}`, 'success', 2500);
    } catch (error) {
        console.error('Word 导出失败:', error);
        showToast('Word 导出失败：' + error.message, 'error', 3000);
    }
}