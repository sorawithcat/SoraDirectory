/** 当前打开文件的句柄（用于直接保存） */
let currentFileHandle = null;
/** 当前文件名 */
let currentFileName = null;
/** 目录修改追踪（哈希映射） */
const directoryHashes = new Map();
/** 未保存更改标记 */
let hasUnsavedChanges = false;
let hashBaselineTimer = null;
const SORA_PACKAGE_MAGIC = 'SORA_DIRECTORY_PACKAGE_V1';
const SORA_ENCRYPTED_PACKAGE_MAGIC = 'SORA_DIRECTORY_ENCRYPTED_PACKAGE_V1';
const SORA_PACKAGE_MIME = 'application/x-sora-directory';
const SORA_ENCRYPTED_CHUNK_SIZE = 8 * 1024 * 1024;
let soraLoadProgressHideTimer = null;

function formatSoraProgressBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (typeof formatFileSize === 'function') return formatFileSize(value);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function updateSoraLoadProgress(title, current, total, detail = '') {
    const container = document.getElementById('soraLoadProgress');
    if (!container) return;
    if (soraLoadProgressHideTimer) {
        clearTimeout(soraLoadProgressHideTimer);
        soraLoadProgressHideTimer = null;
    }
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeCurrent = Math.min(safeTotal, Math.max(0, Number(current) || 0));
    const percent = safeTotal > 0 ? Math.round(safeCurrent / safeTotal * 100) : 0;
    document.getElementById('soraLoadProgressTitle').textContent = title;
    document.getElementById('soraLoadProgressPercent').textContent = `${percent}%`;
    document.getElementById('soraLoadProgressDetail').textContent = detail ||
        `${formatSoraProgressBytes(safeCurrent)} / ${formatSoraProgressBytes(safeTotal)}`;
    document.getElementById('soraLoadProgressFill').style.width = `${percent}%`;
    container.classList.add('active');
}

function hideSoraLoadProgress(delay = 0) {
    if (soraLoadProgressHideTimer) clearTimeout(soraLoadProgressHideTimer);
    soraLoadProgressHideTimer = setTimeout(() => {
        const container = document.getElementById('soraLoadProgress');
        if (container) container.classList.remove('active');
        soraLoadProgressHideTimer = null;
    }, Math.max(0, delay));
}

function finishSoraLoadProgress(message = '.sora 加载完成') {
    updateSoraLoadProgress(message, 1, 1, '可以继续编辑');
    hideSoraLoadProgress(1200);
}
/**
 * 检查浏览器是否支持 File System Access API
 * @returns {boolean}
 */
function isFileSystemAccessSupported() {
    return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

function isSavePickerSupported() {
    return window.isSecureContext && 'showSaveFilePicker' in window;
}

function isOpfsSupported() {
    return window.isSecureContext && navigator.storage && typeof navigator.storage.getDirectory === 'function';
}

async function createTemporaryExport(filename, writer) {
    if (!isOpfsSupported()) return null;
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle('sora-exports', { create: true });
    const fileHandle = await directory.getFileHandle(filename, { create: true });
    try {
        await writer(fileHandle);
    } catch (err) {
        try {
            await directory.removeEntry(filename);
        } catch (cleanupErr) {
            console.warn('Unable to remove failed temporary export:', cleanupErr);
        }
        throw err;
    }
    return {
        file: await fileHandle.getFile(),
        cleanup: async () => {
            try {
                await directory.removeEntry(filename);
            } catch (err) {
                console.warn('Unable to remove temporary export:', err);
            }
        }
    };
}

async function writePartsToFileHandle(fileHandle, parts) {
    const writable = await fileHandle.createWritable();
    try {
        for (const part of parts) {
            if (part != null) await writable.write(part);
        }
        await writable.close();
    } catch (err) {
        if (typeof writable.abort === 'function') {
            try {
                await writable.abort();
            } catch (abortErr) {
                console.warn('Unable to abort export:', abortErr);
            }
        }
        throw err;
    }
}

function showPreparedFileActions(sourceFile, filename, cleanup = null) {
    return new Promise(resolve => {
        const file = sourceFile.name === filename
            ? sourceFile
            : new File([sourceFile], filename, { type: sourceFile.type || 'application/octet-stream' });
        const objectURL = URL.createObjectURL(file);
        const shareData = { files: [file], title: filename };
        let canShare = false;
        try {
            canShare = typeof navigator.share === 'function' &&
                typeof navigator.canShare === 'function' && navigator.canShare(shareData);
        } catch (err) {
            canShare = false;
        }

        customDialogTitle.textContent = '文件已生成';
        customDialogMessage.textContent = `${filename}（${formatFileSize(file.size)}）`;
        customDialogInput.style.display = 'none';
        customDialogFooter.innerHTML =
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="preparedFileCancel">取消</button>' +
            (canShare ? '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="preparedFileShare">分享</button>' : '') +
            '<a class="custom-dialog-btn custom-dialog-btn-primary prepared-file-download" id="preparedFileDownload">保存到设备</a>';

        const download = document.getElementById('preparedFileDownload');
        const cancel = document.getElementById('preparedFileCancel');
        const share = document.getElementById('preparedFileShare');
        download.href = objectURL;
        download.download = filename;

        let closed = false;
        const finish = action => {
            if (closed) return;
            closed = true;
            customDialogOverlay.classList.remove('active');
            setTimeout(() => {
                URL.revokeObjectURL(objectURL);
                if (cleanup) cleanup();
            }, action === 'cancel' ? 0 : 60000);
            resolve(action);
        };
        download.onclick = () => finish('download');
        cancel.onclick = () => finish('cancel');
        customDialogClose.onclick = () => finish('cancel');
        customDialogOverlay.onclick = event => {
            if (event.target === customDialogOverlay) finish('cancel');
        };
        if (share) {
            share.onclick = async () => {
                try {
                    await navigator.share(shareData);
                    finish('share');
                } catch (err) {
                    if (err.name !== 'AbortError') showToast('分享失败，请改用“保存到设备”', 'warning', 2500);
                }
            };
        }
        customDialogOverlay.classList.add('active');
    });
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
        hash = hash & hash; 
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
            directoryHashes.set(dirId, simpleHash(buildDirectoryHashInput(mulufile[i])));
            originalContentCache.set(dirId, mulufile[i][3] || '');
        }
    }
}

function buildDirectoryHashInput(row) {
    if (!row || row.length !== 4) return '';
    return String(row[0] || '') + '\u001f' +
        String(row[1] || '') + '\u001f' +
        String(row[2] || '') + '\u001f' +
        String(row[3] || '');
}

function scheduleHashBaselineUpdate(timeout = 800) {
    if (hashBaselineTimer) {
        return;
    }
    const run = () => {
        hashBaselineTimer = null;
        calculateAllHashes();
        if (typeof updateSaveButtonState === 'function') {
            updateSaveButtonState();
        }
    };
    if (typeof requestIdleCallback !== 'undefined') {
        hashBaselineTimer = requestIdleCallback(run, { timeout });
    } else {
        hashBaselineTimer = setTimeout(run, Math.min(timeout, 150));
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
    const currentHash = simpleHash(buildDirectoryHashInput(dirData));
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
    if (typeof DraftManager !== 'undefined') {
        DraftManager.schedule();
    }
}
/**
 * 清除未保存更改标记
 */
function clearUnsavedChanges(options = {}) {
    hasUnsavedChanges = false;
    if (options.deferHashes) {
        scheduleHashBaselineUpdate();
    } else {
        calculateAllHashes();
    }
    updateSaveButtonState();
    if (!options.keepDraft && typeof DraftManager !== 'undefined') {
        DraftManager.clear();
    }
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
    updatePageTitle();
}
/**
 * 更新页面标题（显示文件名和未保存状态）
 */
function updatePageTitle() {
    const baseName = currentFileName || 'SoraList';
    document.title = hasUnsavedChanges ? `* ${baseName}` : baseName;
}

function isSoraPackageFile(fileOrName) {
    const name = typeof fileOrName === 'string' ? fileOrName : (fileOrName && fileOrName.name) || '';
    return /\.sora$/i.test(name);
}

function getSoraBaseName(name) {
    return String(name || 'soralist')
        .replace(/\s*\(\d+\)\s*\./g, '.')
        .replace(/\.(sora|json|txt|xml|csv|html)$/i, '')
        .replace(/\.(encrypted|patch)$/i, '')
        .replace(/_incremental$/i, '') || 'soralist';
}

function inferMediaTypeFromId(mediaId) {
    const prefix = String(mediaId || '').split('_')[0];
    return prefix || 'media';
}

function collectSoraPackageMediaIds(data) {
    const ids = new Set();
    const source = Array.isArray(data) ? data : [];
    const mediaRegex = /data-media-storage-id=["']([^"']+)["']/gi;
    for (const row of source) {
        if (!row || row.length !== 4 || !row[3]) continue;
        mediaRegex.lastIndex = 0;
        let match;
        while ((match = mediaRegex.exec(row[3])) !== null) {
            if (match[1]) ids.add(match[1]);
        }
    }
    return ids;
}

function sanitizeSoraPackageHtml(html) {
    if (!html || !html.includes('data-media-storage-id')) return html || '';
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('[data-media-storage-id]').forEach(el => {
        el.removeAttribute('data-original-src');
        el.removeAttribute('data-loading-media');
        el.removeAttribute('data-export-url');
        if (el.matches('img, video, audio, source')) {
            el.setAttribute('src', 'about:blank');
        }
        if (el.tagName === 'VIDEO') {
            el.setAttribute('controls', '');
            el.setAttribute('preload', 'none');
            el.querySelectorAll('source').forEach(source => {
                source.setAttribute('src', 'about:blank');
            });
        }
    });
    return template.innerHTML;
}

function sanitizeSoraPackageDirectories(data) {
    const source = Array.isArray(data) ? data : [];
    return source.map(row => {
        if (!row || row.length !== 4) return Array.isArray(row) ? row.slice() : row;
        return [row[0], row[1], row[2], sanitizeSoraPackageHtml(row[3])];
    });
}

async function collectSoraPackageMediaParts(source, preferStreaming = false) {
    const mediaIds = collectSoraPackageMediaIds(source);
    const mediaEntries = [];
    const mediaParts = [];
    let offset = 0;

    if (mediaIds.size > 0 && (typeof MediaStorage === 'undefined' || typeof MediaStorage.getChunkedBlob !== 'function')) {
        throw new Error('媒体存储未初始化，无法生成包含媒体的 .sora 文件');
    }

    let processedMedia = 0;
    for (const mediaId of mediaIds) {
        processedMedia++;
        if (mediaIds.size > 1) {
            showToast(`正在打包媒体 ${processedMedia}/${mediaIds.size}`, 'info', 1200);
        }
        if (preferStreaming && typeof MediaStorage.getMediaInfo === 'function' && typeof MediaStorage.writeMediaToWritable === 'function') {
            const info = await MediaStorage.getMediaInfo(mediaId);
            if (info && (info.blobChunked || info.storage === 'opfs') && Number.isFinite(info.size)) {
                const length = info.size;
                mediaEntries.push({
                    id: mediaId,
                    type: info.type || inferMediaTypeFromId(mediaId),
                    mimeType: info.mimeType || 'application/octet-stream',
                    size: length,
                    offset,
                    length
                });
                mediaParts.push({ id: mediaId, stream: true });
                offset += length;
                continue;
            }
        }
        const blob = await MediaStorage.getChunkedBlob(mediaId);
        if (typeof MediaStorage.hideProgressToast === 'function') {
            MediaStorage.hideProgressToast();
        }
        if (!blob) {
            console.warn('跳过不存在的媒体:', mediaId);
            continue;
        }
        const length = blob.size;
        const type = inferMediaTypeFromId(mediaId);
        mediaEntries.push({
            id: mediaId,
            type,
            mimeType: blob.type || 'application/octet-stream',
            size: length,
            offset,
            length
        });
        mediaParts.push({ id: mediaId, blob, stream: false });
        offset += length;
        if (processedMedia % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    return { mediaEntries, mediaParts };
}

function createSoraPackageManifest(directories, mediaEntries, exportScope = null) {
    const directoryIds = new Set(directories
        .filter(row => Array.isArray(row) && row.length === 4)
        .map(row => String(row[2])));
    return {
        type: 'SoraDirectoryPackage',
        version: 1,
        createdAt: new Date().toISOString(),
        scope: exportScope ? {
            mode: exportScope.mode || 'all',
            count: exportScope.count || directories.length,
            label: exportScope.label || ''
        } : null,
        documentId: window.SoraDocumentIdentity ? window.SoraDocumentIdentity.get().id : '',
        directories,
        directoryLevelColors: typeof serializeDirectoryLevelColors === 'function'
            ? serializeDirectoryLevelColors()
            : {},
        directoryMetadata: window.DirectoryMetadata
            ? window.DirectoryMetadata.serialize(directoryIds)
            : {},
        media: mediaEntries
    };
}

async function buildSoraPackageBlob(data, exportScope = null) {
    const source = Array.isArray(data) ? data : [];
    const directories = sanitizeSoraPackageDirectories(source);
    const { mediaEntries, mediaParts } = await collectSoraPackageMediaParts(source, false);
    const manifest = createSoraPackageManifest(directories, mediaEntries, exportScope);
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    const header = `${SORA_PACKAGE_MAGIC}\n${manifestBytes.byteLength}\n`;
    return new Blob([header, manifestBytes, ...mediaParts.map(part => part.blob)], { type: SORA_PACKAGE_MIME });
}

async function writeSoraPackageToFileHandle(fileHandle, data, exportScope = null) {
    const source = Array.isArray(data) ? data : [];
    const directories = sanitizeSoraPackageDirectories(source);
    const { mediaEntries, mediaParts } = await collectSoraPackageMediaParts(source, true);
    const manifest = createSoraPackageManifest(directories, mediaEntries, exportScope);
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    const header = `${SORA_PACKAGE_MAGIC}\n${manifestBytes.byteLength}\n`;
    const writable = await fileHandle.createWritable();
    try {
        await writable.write(header);
        await writable.write(manifestBytes);
        for (const part of mediaParts) {
            if (part.stream) {
                await MediaStorage.writeMediaToWritable(part.id, writable);
                if (typeof MediaStorage.hideProgressToast === 'function') {
                    MediaStorage.hideProgressToast();
                }
            } else if (part.blob) {
                await writable.write(part.blob);
            }
        }
        await writable.close();
    } catch (err) {
        if (typeof writable.abort === 'function') {
            try {
                await writable.abort();
            } catch (abortErr) {
                console.warn('.sora 写入回滚失败:', abortErr);
            }
        }
        throw err;
    }
}

function soraBytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function soraBase64ToBytes(value) {
    return Uint8Array.from(atob(String(value || '')), char => char.charCodeAt(0));
}

function buildSoraChunkIv(prefix, index) {
    const iv = new Uint8Array(12);
    iv.set(prefix, 0);
    new DataView(iv.buffer).setUint32(8, index, false);
    return iv;
}

function buildSoraChunkAdditionalData(index, plainLength) {
    return new TextEncoder().encode(`${SORA_ENCRYPTED_PACKAGE_MAGIC}:${index}:${plainLength}`);
}

function assertSoraEncryptionSupported() {
    if (!globalThis.crypto || !globalThis.crypto.subtle) {
        throw new Error('当前环境不支持安全加密，请使用 HTTPS、localhost 或桌面 App。');
    }
}

async function createPlainSoraSourceFile(data, exportScope = null) {
    const tempName = `.sora-plain-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    const prepared = await createTemporaryExport(tempName, fileHandle =>
        writeSoraPackageToFileHandle(fileHandle, data, exportScope)
    );
    if (prepared) return prepared;
    const blob = await buildSoraPackageBlob(data, exportScope);
    return {
        file: new File([blob], tempName, { type: SORA_PACKAGE_MIME }),
        cleanup: null
    };
}

async function encryptSoraSourceFile(sourceFile, password, writePart) {
    assertSoraEncryptionSupported();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const ivPrefix = crypto.getRandomValues(new Uint8Array(8));
    const key = await deriveKey(password, salt);
    const chunkCount = Math.ceil(sourceFile.size / SORA_ENCRYPTED_CHUNK_SIZE);
    const metadata = {
        type: 'SoraDirectoryEncryptedPackage',
        version: 1,
        algorithm: 'AES-GCM-256',
        kdf: 'PBKDF2-SHA256',
        iterations: 100000,
        salt: soraBytesToBase64(salt),
        ivPrefix: soraBytesToBase64(ivPrefix),
        chunkSize: SORA_ENCRYPTED_CHUNK_SIZE,
        chunkCount,
        plainSize: sourceFile.size
    };
    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
    await writePart(`${SORA_ENCRYPTED_PACKAGE_MAGIC}\n${metadataBytes.byteLength}\n`);
    await writePart(metadataBytes);

    for (let index = 0; index < chunkCount; index++) {
        const start = index * SORA_ENCRYPTED_CHUNK_SIZE;
        const end = Math.min(sourceFile.size, start + SORA_ENCRYPTED_CHUNK_SIZE);
        const plainBytes = await sourceFile.slice(start, end).arrayBuffer();
        const encrypted = await crypto.subtle.encrypt({
            name: 'AES-GCM',
            iv: buildSoraChunkIv(ivPrefix, index),
            additionalData: buildSoraChunkAdditionalData(index, end - start)
        }, key, plainBytes);
        await writePart(encrypted);
        if (chunkCount > 1) {
            showToast(`正在加密 .sora ${index + 1}/${chunkCount}`, 'info', 1000);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

async function writeEncryptedSoraSourceToHandle(fileHandle, sourceFile, password) {
    const writable = await fileHandle.createWritable();
    try {
        await encryptSoraSourceFile(sourceFile, password, part => writable.write(part));
        await writable.close();
    } catch (err) {
        if (typeof writable.abort === 'function') {
            try {
                await writable.abort();
            } catch (abortErr) {
                console.warn('加密 .sora 写入回滚失败:', abortErr);
            }
        }
        throw err;
    }
}

async function writeEncryptedSoraPackageToFileHandle(fileHandle, data, exportScope, password) {
    const plain = await createPlainSoraSourceFile(data, exportScope);
    try {
        await writeEncryptedSoraSourceToHandle(fileHandle, plain.file, password);
    } finally {
        if (plain.cleanup) await plain.cleanup();
    }
}

async function createEncryptedSoraExport(filename, data, exportScope, password) {
    const plain = await createPlainSoraSourceFile(data, exportScope);
    try {
        const prepared = await createTemporaryExport(filename, fileHandle =>
            writeEncryptedSoraSourceToHandle(fileHandle, plain.file, password)
        );
        if (prepared) return prepared;
        const parts = [];
        await encryptSoraSourceFile(plain.file, password, part => {
            parts.push(part);
            return Promise.resolve();
        });
        return {
            file: new File(parts, filename, { type: SORA_PACKAGE_MIME }),
            cleanup: null
        };
    } finally {
        if (plain.cleanup) await plain.cleanup();
    }
}

async function handleSaveAsSoraPackage(customName = null, exportData = null, exportScope = null, options = {}) {
    const sourceData = Array.isArray(exportData) ? exportData : mulufile;
    const baseName = getSoraBaseName(customName || (fileNameInput && fileNameInput.value.trim()) || currentFileName || 'soralist');
    const partialSuffix = exportScope && exportScope.mode === 'partial' ? '_partial' : '';
    const encrypt = !!options.encrypt;
    let password = options.password || null;
    if (encrypt) {
        try {
            assertSoraEncryptionSupported();
        } catch (err) {
            await customAlert(err.message, '无法加密');
            return false;
        }
    }
    if (encrypt && !password) {
        password = await customPrompt('设置 .sora 加密密码：', '', '加密 .sora');
        if (!password) return false;
        const confirmedPassword = await customPrompt('确认密码：', '', '加密 .sora');
        if (confirmedPassword !== password) {
            await customAlert('两次输入的密码不一致', '加密 .sora');
            return false;
        }
    }
    let filename = customName ? customName : `${baseName}${partialSuffix}${encrypt ? '.encrypted' : ''}.sora`;
    if (!/\.sora$/i.test(filename)) {
        filename += '.sora';
    }
    const setCurrent = !!options.setCurrent;

    if (isFileSystemAccessSupported() && options.usePicker !== false) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'Sora 单文件包', accept: { [SORA_PACKAGE_MIME]: ['.sora'] } }]
            });
            if (encrypt) {
                await writeEncryptedSoraPackageToFileHandle(fileHandle, sourceData, exportScope, password);
            } else {
                await writeSoraPackageToFileHandle(fileHandle, sourceData, exportScope);
            }
            if (setCurrent) {
                currentFileHandle = encrypt ? null : fileHandle;
                currentFileName = fileHandle.name;
                clearUnsavedChanges({ deferHashes: true });
                if (fileNameInput) fileNameInput.value = getSoraBaseName(fileHandle.name);
            }
            showToast(`已保存${encrypt ? '加密 ' : ' '}.sora：${fileHandle.name}`, 'success', 3000);
            return true;
        } catch (err) {
            if (err.name === 'AbortError') return false;
            console.error('.sora 保存失败，降级为下载:', err);
            if (encrypt) {
                await customAlert(err.message || '加密 .sora 保存失败', '保存失败');
                return false;
            }
        }
    }

    let prepared = null;
    if (encrypt) {
        try {
            prepared = await createEncryptedSoraExport(filename, sourceData, exportScope, password);
        } catch (err) {
            console.error('加密 .sora 生成失败:', err);
            await customAlert(err.message || '加密 .sora 生成失败', '保存失败');
            return false;
        }
    } else {
        try {
            prepared = await createTemporaryExport(filename, fileHandle =>
                writeSoraPackageToFileHandle(fileHandle, sourceData, exportScope)
            );
        } catch (err) {
            console.warn('OPFS temporary export failed, using memory fallback:', err);
        }
    }
    const file = prepared
        ? prepared.file
        : new File([await buildSoraPackageBlob(sourceData, exportScope)], filename, { type: SORA_PACKAGE_MIME });
    const action = await showPreparedFileActions(file, filename, prepared && prepared.cleanup);
    if (action === 'cancel') return false;
    if (setCurrent) {
        currentFileHandle = null;
        currentFileName = filename;
        clearUnsavedChanges({ deferHashes: true });
        if (fileNameInput) fileNameInput.value = getSoraBaseName(filename);
    }
    showToast(`已保存${encrypt ? '加密 ' : ' '}.sora：${filename}`, 'success', 3000);
    return true;
}

async function readSoraPackageMagic(file) {
    const text = await file.slice(0, Math.min(file.size, 256)).text();
    const newline = text.indexOf('\n');
    return (newline >= 0 ? text.slice(0, newline) : text).replace(/\r$/, '');
}

async function readEncryptedSoraPackageHeader(file) {
    let probeSize = Math.min(file.size, 1024);
    let headerText = '';
    let firstNewline = -1;
    let secondNewline = -1;
    while (probeSize <= Math.min(file.size, 1024 * 1024)) {
        headerText = await file.slice(0, probeSize).text();
        firstNewline = headerText.indexOf('\n');
        secondNewline = firstNewline >= 0 ? headerText.indexOf('\n', firstNewline + 1) : -1;
        if (secondNewline >= 0 || probeSize >= file.size) break;
        probeSize = Math.min(file.size, probeSize * 4);
    }
    if (firstNewline < 0 || secondNewline < 0) throw new Error('加密 .sora 包头损坏');
    const magic = headerText.slice(0, firstNewline).replace(/\r$/, '');
    if (magic !== SORA_ENCRYPTED_PACKAGE_MAGIC) throw new Error('加密 .sora 包头不匹配');
    const metadataLength = Number(headerText.slice(firstNewline + 1, secondNewline).trim());
    if (!Number.isInteger(metadataLength) || metadataLength <= 0 || metadataLength > 1024 * 1024) {
        throw new Error('加密 .sora 元数据长度错误');
    }
    const encryptedStart = secondNewline + 1 + metadataLength;
    if (encryptedStart > file.size) throw new Error('加密 .sora 元数据越界');
    const metadataText = new TextDecoder().decode(
        await file.slice(secondNewline + 1, encryptedStart).arrayBuffer()
    );
    const metadata = JSON.parse(metadataText);
    if (!metadata || metadata.type !== 'SoraDirectoryEncryptedPackage' || metadata.version !== 1) {
        throw new Error('加密 .sora 元数据格式错误');
    }
    if (metadata.algorithm !== 'AES-GCM-256' || metadata.kdf !== 'PBKDF2-SHA256' || metadata.iterations !== 100000) {
        throw new Error('暂不支持该 .sora 加密算法');
    }
    if (!Number.isInteger(metadata.chunkSize) || metadata.chunkSize <= 0 || metadata.chunkSize > 64 * 1024 * 1024 ||
        !Number.isInteger(metadata.chunkCount) || metadata.chunkCount <= 0 ||
        !Number.isFinite(metadata.plainSize) || metadata.plainSize <= 0) {
        throw new Error('加密 .sora 分块信息错误');
    }
    const expectedChunkCount = Math.ceil(metadata.plainSize / metadata.chunkSize);
    const expectedSize = encryptedStart + metadata.plainSize + metadata.chunkCount * 16;
    if (metadata.chunkCount !== expectedChunkCount || expectedSize !== file.size) {
        throw new Error('加密 .sora 文件长度不匹配');
    }
    const salt = soraBase64ToBytes(metadata.salt);
    const ivPrefix = soraBase64ToBytes(metadata.ivPrefix);
    if (salt.length !== 16 || ivPrefix.length !== 8) throw new Error('加密 .sora 密钥参数错误');
    return { metadata, encryptedStart, salt, ivPrefix };
}

async function decryptSoraSourceFile(sourceFile, password, writePart) {
    assertSoraEncryptionSupported();
    const { metadata, encryptedStart, salt, ivPrefix } = await readEncryptedSoraPackageHeader(sourceFile);
    const key = await deriveKey(password, salt);
    let offset = encryptedStart;
    updateSoraLoadProgress('正在解密 .sora', 0, metadata.plainSize);
    for (let index = 0; index < metadata.chunkCount; index++) {
        const plainLength = Math.min(metadata.chunkSize, metadata.plainSize - index * metadata.chunkSize);
        const encryptedLength = plainLength + 16;
        const encrypted = await sourceFile.slice(offset, offset + encryptedLength).arrayBuffer();
        let plain;
        try {
            plain = await crypto.subtle.decrypt({
                name: 'AES-GCM',
                iv: buildSoraChunkIv(ivPrefix, index),
                additionalData: buildSoraChunkAdditionalData(index, plainLength)
            }, key, encrypted);
        } catch (err) {
            err.soraPasswordOrCorrupt = true;
            throw err;
        }
        await writePart(plain);
        offset += encryptedLength;
        const completedBytes = Math.min(metadata.plainSize, (index + 1) * metadata.chunkSize);
        updateSoraLoadProgress('正在解密 .sora', completedBytes, metadata.plainSize);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    hideSoraLoadProgress(500);
}

async function writeDecryptedSoraToHandle(fileHandle, sourceFile, password) {
    const writable = await fileHandle.createWritable();
    try {
        await decryptSoraSourceFile(sourceFile, password, part => writable.write(part));
        await writable.close();
    } catch (err) {
        if (typeof writable.abort === 'function') {
            try {
                await writable.abort();
            } catch (abortErr) {
                console.warn('解密 .sora 写入回滚失败:', abortErr);
            }
        }
        throw err;
    }
}

async function decryptEncryptedSoraPackageFile(file, password) {
    const tempName = `.sora-decrypted-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    const prepared = await createTemporaryExport(tempName, fileHandle =>
        writeDecryptedSoraToHandle(fileHandle, file, password)
    );
    if (prepared) return prepared;
    const parts = [];
    await decryptSoraSourceFile(file, password, part => {
        parts.push(part);
        return Promise.resolve();
    });
    return {
        file: new File(parts, tempName, { type: SORA_PACKAGE_MIME }),
        cleanup: null
    };
}

async function prepareSoraPackageForOpen(file) {
    const magic = await readSoraPackageMagic(file);
    if (magic !== SORA_ENCRYPTED_PACKAGE_MAGIC) {
        return { file, cleanup: null, encrypted: false };
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
        const password = await customPrompt('输入 .sora 解密密码：', '', '解密 .sora');
        if (password === null) return null;
        if (!password) {
            showToast('请输入密码', 'warning', 1500);
            attempt--;
            continue;
        }
        try {
            const prepared = await decryptEncryptedSoraPackageFile(file, password);
            return { ...prepared, encrypted: true };
        } catch (err) {
            hideSoraLoadProgress();
            if (!err.soraPasswordOrCorrupt) throw err;
            if (attempt < 3) {
                await customAlert(`密码错误或文件损坏，还可尝试 ${3 - attempt} 次。`, '解密失败');
            }
        }
    }
    await customAlert('密码错误次数过多，已取消加载。', '解密失败');
    return null;
}

async function readSoraPackageManifest(file) {
    let probeSize = Math.min(file.size, 1024);
    let headerText = '';
    let firstNewline = -1;
    let secondNewline = -1;
    while (probeSize <= Math.min(file.size, 1024 * 1024)) {
        headerText = await file.slice(0, probeSize).text();
        firstNewline = headerText.indexOf('\n');
        secondNewline = firstNewline >= 0 ? headerText.indexOf('\n', firstNewline + 1) : -1;
        if (secondNewline >= 0 || probeSize >= file.size) break;
        probeSize = Math.min(file.size, probeSize * 4);
    }
    if (firstNewline < 0 || secondNewline < 0) {
        throw new Error('不是有效的 .sora 文件：缺少包头');
    }
    const magic = headerText.slice(0, firstNewline).replace(/\r$/, '');
    if (magic !== SORA_PACKAGE_MAGIC) {
        throw new Error('不是有效的 .sora 文件：包头不匹配');
    }
    const manifestLength = Number(headerText.slice(firstNewline + 1, secondNewline).trim());
    if (!Number.isFinite(manifestLength) || manifestLength <= 0) {
        throw new Error('不是有效的 .sora 文件：清单长度错误');
    }
    const manifestStart = secondNewline + 1;
    const manifestEnd = manifestStart + manifestLength;
    if (manifestEnd > file.size) {
        throw new Error('不是有效的 .sora 文件：清单越界');
    }
    const manifestText = new TextDecoder().decode(await file.slice(manifestStart, manifestEnd).arrayBuffer());
    const manifest = JSON.parse(manifestText);
    if (!manifest || manifest.type !== 'SoraDirectoryPackage' || manifest.version !== 1 || !Array.isArray(manifest.directories)) {
        throw new Error('不是有效的 .sora 文件：清单格式错误');
    }
    return { manifest, mediaStart: manifestEnd };
}

async function importSoraPackageMedia(file, manifest, mediaStart) {
    const media = Array.isArray(manifest.media) ? manifest.media : [];
    if (media.length === 0) return 0;
    if (typeof MediaStorage === 'undefined' || typeof MediaStorage.save !== 'function') {
        throw new Error('媒体存储未初始化');
    }
    let imported = 0;
    let completedBytes = 0;
    const totalBytes = media.reduce((sum, entry) =>
        sum + (entry && entry.id && Number.isFinite(entry.offset) && Number.isFinite(entry.length) && entry.length > 0
            ? entry.length
            : 0), 0);
    updateSoraLoadProgress('正在导入媒体', 0, totalBytes,
        `0 B / ${formatSoraProgressBytes(totalBytes)} · 0/${media.length}`);
    for (let i = 0; i < media.length; i++) {
        const entry = media[i];
        if (!entry || !entry.id || !Number.isFinite(entry.offset) || !Number.isFinite(entry.length)) {
            continue;
        }
        if (typeof MediaStorage.mediaExists === 'function' && await MediaStorage.mediaExists(entry.id)) {
            completedBytes += entry.length;
            updateSoraLoadProgress(`正在导入媒体 ${i + 1}/${media.length}`, completedBytes, totalBytes,
                `${formatSoraProgressBytes(completedBytes)} / ${formatSoraProgressBytes(totalBytes)}`);
            continue;
        }
        const start = mediaStart + entry.offset;
        const end = start + entry.length;
        if (start < mediaStart || end > file.size) {
            console.warn('跳过越界媒体:', entry.id);
            continue;
        }
        const blob = file.slice(start, end, entry.mimeType || 'application/octet-stream');
        await MediaStorage.save(blob, entry.type || inferMediaTypeFromId(entry.id), entry.id, {
            silentProgress: true,
            onProgress: (current, total) => {
                const mediaRatio = total > 0 ? current / total : 0;
                const currentBytes = Math.min(totalBytes, completedBytes + entry.length * mediaRatio);
                updateSoraLoadProgress(`正在导入媒体 ${i + 1}/${media.length}`, currentBytes, totalBytes,
                    `${formatSoraProgressBytes(currentBytes)} / ${formatSoraProgressBytes(totalBytes)}`);
            }
        });
        if (typeof MediaStorage.hideProgressToast === 'function') {
            MediaStorage.hideProgressToast();
        }
        completedBytes += entry.length;
        updateSoraLoadProgress(`正在导入媒体 ${i + 1}/${media.length}`, completedBytes, totalBytes,
            `${formatSoraProgressBytes(completedBytes)} / ${formatSoraProgressBytes(totalBytes)}`);
        imported++;
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    return imported;
}

function startSoraPackageMediaImport(file, manifest, mediaStart, cleanup = null) {
    const mediaCount = Array.isArray(manifest.media) ? manifest.media.length : 0;
    if (mediaCount === 0) {
        if (cleanup) Promise.resolve(cleanup()).catch(err => console.warn('临时 .sora 清理失败:', err));
        finishSoraLoadProgress();
        return false;
    }
    const importTask = importSoraPackageMedia(file, manifest, mediaStart)
        .then(count => {
            if (typeof updateMarkdownPreview === 'function') {
                updateMarkdownPreview();
            }
            finishSoraLoadProgress(`媒体导入完成 ${count}/${mediaCount}`);
            showToast(`.sora 媒体导入完成：${count}/${mediaCount}`, 'success', 3000);
        })
        .catch(err => {
            hideSoraLoadProgress();
            console.error('.sora 媒体导入失败:', err);
            showToast('.sora 媒体导入失败：' + err.message, 'error', 4000);
        });
    window.__soraMediaImportPromise = importTask;
    importTask.finally(async () => {
        if (window.__soraMediaImportPromise === importTask) {
            window.__soraMediaImportPromise = null;
        }
        if (cleanup) {
            try {
                await cleanup();
            } catch (err) {
                console.warn('临时 .sora 清理失败:', err);
            }
        }
    });
    return true;
}

async function openSoraPackageFile(file, fileHandle = null) {
    const originalFile = file;
    const prepared = await prepareSoraPackageForOpen(file);
    if (!prepared) return false;
    file = prepared.file;
    if (prepared.encrypted) fileHandle = null;
    let cleaned = false;
    const cleanupPrepared = async () => {
        if (cleaned || !prepared.cleanup) return;
        cleaned = true;
        await prepared.cleanup();
    };
    let manifestData;
    try {
        manifestData = await readSoraPackageManifest(file);
    } catch (err) {
        await cleanupPrepared();
        throw err;
    }
    const { manifest, mediaStart } = manifestData;
    const parsedData = manifest.directories;
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
        customAlert("文件格式错误：无法解析为有效的目录数据");
        await cleanupPrepared();
        return false;
    }

    const isIncremental = parsedData[0].length >= 4 && parsedData[0][0] !== "mulu";
    let loadMode = 'replace';
    if (mulufile && mulufile.length > 0) {
        const modeOptions = [
            { value: 'replace', label: '替换 - 清空现有数据，加载新文件' },
            { value: 'merge', label: '合并 - 将新数据合并到现有数据' }
        ];
        const defaultMode = isIncremental ? 'merge' : 'replace';
        const hint = isIncremental ? '（检测到增量文件，建议合并）' : '';
        loadMode = await customSelect(`选择加载方式${hint}：`, modeOptions, defaultMode, '加载 .sora');
        if (loadMode === null) {
            showToast('已取消加载', 'info', 2000);
            await cleanupPrepared();
            return false;
        }
    }

    if (loadMode === 'merge') {
        const mergeResult = mergeDirectoryData(mulufile, parsedData);
        mulufile = mergeResult.data;
        if (typeof loadDirectoryLevelColors === 'function') {
            loadDirectoryLevelColors(manifest.directoryLevelColors, { merge: true });
        }
        if (window.DirectoryMetadata) {
            window.DirectoryMetadata.load(manifest.directoryMetadata, { merge: true });
        }
        rebuildMulufileIndex();
        LoadMulu();
        markUnsavedChanges();
        setTimeout(() => {
            if (typeof expandAllDirectories === 'function') expandAllDirectories();
            if (typeof selectFirstRootDirectory === 'function') selectFirstRootDirectory();
        }, 10);
        bigbox.style.display = "block";
        wordsbox.style.display = "";
        startSoraPackageMediaImport(file, manifest, mediaStart, cleanupPrepared);
        showToast(`已合并${prepared.encrypted ? '加密 ' : ' '}.sora：新增 ${mergeResult.added} 个，更新 ${mergeResult.updated} 个目录`, 'success', 3000);
        return true;
    }

    if (parsedData[0].length < 4 || parsedData[0][0] !== "mulu") {
        customAlert("文件格式错误：第一个目录必须以'mulu'开头\n\n如果这是增量文件，请选择【合并】模式加载");
        await cleanupPrepared();
        return false;
    }

    currentFileHandle = fileHandle;
    currentFileName = originalFile.name;
    if (window.SoraDocumentIdentity) {
        window.SoraDocumentIdentity.adoptFile(originalFile, manifest.documentId);
    }
    mulufile = parsedData;
    if (typeof loadDirectoryLevelColors === 'function') {
        loadDirectoryLevelColors(manifest.directoryLevelColors);
    }
    if (window.DirectoryMetadata) {
        window.DirectoryMetadata.load(manifest.directoryMetadata);
    }
    LoadMulu();
    if (typeof scheduleHashBaselineUpdate === 'function') {
        scheduleHashBaselineUpdate();
    }
    hasUnsavedChanges = false;
    updateSaveButtonState();
    if (typeof DraftManager !== 'undefined') DraftManager.resetAfterLoad();
    if (typeof DirectoryHistory !== 'undefined') DirectoryHistory.clear();
    setTimeout(() => {
        if (typeof expandAllDirectories === 'function') expandAllDirectories();
        if (typeof selectFirstRootDirectory === 'function') selectFirstRootDirectory();
    }, 10);
    bigbox.style.display = "block";
    wordsbox.style.display = "";
    if (fileNameInput) {
        fileNameInput.value = getSoraBaseName(originalFile.name);
    }
    startSoraPackageMediaImport(file, manifest, mediaStart, cleanupPrepared);
    showToast(`已打开：${originalFile.name}（${prepared.encrypted ? '加密 ' : ''}.sora）`, 'success', 3000);
    return true;
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
                        'application/x-sora-directory': ['.sora'],
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
        if (isSoraPackageFile(file)) {
            return await openSoraPackageFile(file, fileHandle);
        }
        // 先检查缓存，命中时避免读取和解析整个文件
        let parsedData = null;
        let fromCache = false;
        if (typeof FileCache !== 'undefined') {
            parsedData = await FileCache.get(file);
            if (parsedData) {
                fromCache = true;
                window.SoraDiagnostics?.debug('从文件缓存加载', file.name);
            }
        }
        // 如果缓存中没有，则解析文件内容
        if (!parsedData) {
            const content = await file.text();
            const isEncrypted = isEncryptedContent(content);
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
                FileCache.set(file, parsedData)
                    .then(() => window.SoraDiagnostics?.debug('文件已缓存', file.name))
                    .catch(err => console.warn('FileCache: 缓存保存失败', err));
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
            wordsbox.style.display = "";
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
            wordsbox.style.display = "";
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
        if (window.SoraDocumentIdentity) window.SoraDocumentIdentity.adoptFile(file);
        // 更新数据
        mulufile = parsedData;
        if (window.DirectoryMetadata) window.DirectoryMetadata.reset();
        if (typeof loadDirectoryLevelColors === 'function') {
            loadDirectoryLevelColors(null);
        }
        // 加载目录
        LoadMulu();
        // 性能优化：将计算哈希改为延迟执行，不阻塞显示
        // 哈希计算用于变化追踪，不是显示内容所必需的
        if (typeof scheduleHashBaselineUpdate === 'function') {
            scheduleHashBaselineUpdate();
        }
        hasUnsavedChanges = false;
        updateSaveButtonState();
        if (typeof DraftManager !== 'undefined') DraftManager.resetAfterLoad();
        if (typeof DirectoryHistory !== 'undefined') DirectoryHistory.clear();
        // 大文件优先保证打开速度；媒体数据保持延迟加载。
        if (mulufile.length <= 120 && typeof MediaStorage !== 'undefined' && typeof MediaStorage.preloadAllDirectoryContent === 'function') {
            const preloadSmallFile = () => {
                MediaStorage.preloadAllDirectoryContent(mulufile).catch(err => {
                    console.warn('预加载目录内容失败:', err);
                });
            };
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(preloadSmallFile, { timeout: 1500 });
            } else {
                setTimeout(preloadSmallFile, 300);
            }
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
        wordsbox.style.display = "";
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
            ? stringifyJsonData(dataToSave)
            : formatDataByExtension(dataToSave, currentFileName);
        // 写入文件
        const writable = await currentFileHandle.createWritable();
        await writable.write(stringData);
        await writable.close();
        // 更新哈希并清除未保存标记
        clearUnsavedChanges({ deferHashes: true });
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
            ? stringifyJsonData(dataToSave)
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
        clearUnsavedChanges({ deferHashes: true });
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
    // 转换为 base64 - 分块处理避免堆栈溢出
    // 对于大数组，使用分块方式转换为字符串
    const chunkSize = 8192; // 每次处理 8KB
    let binaryString = '';
    for (let i = 0; i < combined.length; i += chunkSize) {
        const chunk = combined.slice(i, i + chunkSize);
        binaryString += String.fromCharCode(...chunk);
    }
    return btoa(binaryString);
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
    const stringData = stringifyJsonData(dataToSave);
    // 加密并保存
    await saveEncryptedFile(stringData, filename, password);
    // 清除未保存标记
    clearUnsavedChanges({ deferHashes: true });
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
    const stringData = stringifyJsonData(dataToSave);
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
        if (typeof switchToDirectoryElement === 'function') {
            return switchToDirectoryElement(firstRootMulu, { syncCurrent: false, scrollPreviewTop: true, forceRender: true });
        }
        currentMuluName = firstRootMulu.id;
        RemoveOtherSelect();
        firstRootMulu.classList.add("select");
        let loadedContent = findMulufileData(firstRootMulu);
        jiedianwords.value = loadedContent;
        if (markdownPreview) {
            markdownPreview.scrollTop = 0;
        }
        isUpdating = true;
        updateMarkdownPreview({ force: true });
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
    if (isEncryptedContent(content)) {
        return (async () => {
            const decrypted = await parseEncryptedContent(content);
            if (!decrypted) {
                throw new Error('解密失败或已取消');
            }
            return parseFileContent(decrypted, filename.replace('.encrypted', ''));
        })();
    }

    const firstChar = getFirstNonWhitespaceChar(content);
    if (ext === 'json' || firstChar === '[' || firstChar === '{') {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) || isDiffFile(parsed)) {
                return parsed;
            }
        } catch (e) {
            if (ext === 'json') {
                throw new Error("JSON 解析失败：" + e.message);
            }
            console.warn("JSON 解析失败，尝试其他格式", e);
        }
    }

    if (ext === 'xml' || firstChar === '<') {
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
    if (ext === 'csv' || shouldTryCsvParse(content, firstChar)) {
        try {
            let lines = content.split('\n');
            let result = [];
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
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
    try {
        return stringToArr(content);
    } catch (e) {
        throw new Error("无法解析文件格式，请确保文件格式正确");
    }
}

function getFirstNonWhitespaceChar(text) {
    const str = String(text || '');
    for (let i = 0; i < str.length; i++) {
        const ch = str.charAt(i);
        if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t' && ch !== '\f') {
            return ch;
        }
    }
    return '';
}

function shouldTryCsvParse(content, firstChar) {
    if (!content || firstChar === '[' || firstChar === '{' || firstChar === '<') {
        return false;
    }
    const firstLineEnd = content.indexOf('\n');
    if (firstLineEnd < 0) return false;
    const firstLine = content.slice(0, firstLineEnd);
    return firstLine.includes(',');
}

function stringifyJsonData(data) {
    return JSON.stringify(data);
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
            return stringifyJsonData(data);
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
            return stringifyJsonData(data);
    }
}
/**
 * 保存文件（智能选择保存方式）
 * 始终先询问保存选项（范围、是否加密），然后选择最佳保存方式
 */
async function handleSave() {
    if (typeof syncPreviewToTextarea === 'function') {
        syncPreviewToTextarea();
    }
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
    if (!password && saveMode === 'all') {
        const exportScope = { mode: 'all', count: Array.isArray(mulufile) ? mulufile.length : 0, label: '全部目录' };
        if (currentFileHandle && isSoraPackageFile(currentFileName)) {
            try {
                await writeSoraPackageToFileHandle(currentFileHandle, mulufile, exportScope);
                clearUnsavedChanges({ deferHashes: true });
                showToast(`已保存：${currentFileName}`, 'success', 2500);
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error('.sora 直接保存失败，尝试另存为:', err);
            }
        }
        await handleSaveAsSoraPackage(null, mulufile, exportScope, { setCurrent: true });
        return;
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
    let stringData = stringifyJsonData(dataToSave);
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
            clearUnsavedChanges({ deferHashes: true });
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
                clearUnsavedChanges({ deferHashes: true });
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
        clearUnsavedChanges({ deferHashes: true });
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
        ? stringifyJsonData(dataToSave)
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
        clearUnsavedChanges({ deferHashes: true });
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
    tempDiff.reverse();
    let keepStart = -1;
    let keepCount = 0;
    for (const item of tempDiff) {
        if (item.op === '=') {
            if (keepStart === -1) keepStart = diff.length;
            keepCount++;
        } else {
            if (keepCount > 0) {
                if (keepCount > 3) {
                    diff.push({ op: '=', count: keepCount });
                } else {
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
                for (let i = 0; i < item.count && oldIndex < oldLines.length; i++) {
                    newLines.push(oldLines[oldIndex++]);
                }
            } else {
                newLines.push(item.line);
                oldIndex++;
            }
        } else if (item.op === '+') {
            newLines.push(item.line);
        } else if (item.op === '-') {
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
            mulufile.push([patch.parentId, patch.name, patch.dirId, patch.mode === 'full' ? patch.content : '']);
            if (patch.mode === 'diff') {
                const newContent = applyLinePatch('', patch.diff);
                mulufile[mulufile.length - 1][3] = newContent;
            }
            applied++;
            notFound++;
            continue;
        }
        try {
            if (patch.mode === 'full') {
                data[3] = patch.content;
            } else {
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
    const existingMap = new Map();
    for (let i = 0; i < existingData.length; i++) {
        if (existingData[i].length >= 4) {
            existingMap.set(existingData[i][2], i);  
        }
    }
    let added = 0;
    let updated = 0;
    for (const item of newData) {
        if (item.length >= 4) {
            const dirId = item[2];
            if (existingMap.has(dirId)) {
                const index = existingMap.get(dirId);
                existingData[index] = [...item];  
                updated++;
            } else {
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

function getCurrentExportDirId() {
    if (!currentMuluName) return '';
    const currentMulu = document.getElementById(currentMuluName);
    return currentMulu ? (currentMulu.getAttribute('data-dir-id') || '') : '';
}

function buildChildrenIdMap(data = mulufile) {
    const childrenMap = new Map();
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length !== 4) continue;
        const parentId = row[0] || 'mulu';
        if (!childrenMap.has(parentId)) {
            childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId).push(row[2]);
    }
    return childrenMap;
}

function buildDirectoryLevelMap(data = mulufile) {
    const dirMap = new Map();
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row && row.length === 4) {
            dirMap.set(row[2], row);
        }
    }
    const levelMap = new Map();
    const resolving = new Set();
    const getLevel = (dirId) => {
        if (levelMap.has(dirId)) return levelMap.get(dirId);
        if (resolving.has(dirId)) {
            levelMap.set(dirId, 0);
            return 0;
        }
        const row = dirMap.get(dirId);
        if (!row || !row[0] || row[0] === 'mulu' || !dirMap.has(row[0])) {
            levelMap.set(dirId, 0);
            return 0;
        }
        resolving.add(dirId);
        const level = Math.min(getLevel(row[0]) + 1, 20);
        resolving.delete(dirId);
        levelMap.set(dirId, level);
        return level;
    };
    for (const dirId of dirMap.keys()) {
        getLevel(dirId);
    }
    return levelMap;
}

function collectDirectorySubtreeIds(rootDirId, data = mulufile) {
    const selected = new Set();
    if (!rootDirId) return selected;
    const childrenMap = buildChildrenIdMap(data);
    const stack = [rootDirId];
    while (stack.length > 0) {
        const dirId = stack.pop();
        if (!dirId || selected.has(dirId)) continue;
        selected.add(dirId);
        const children = childrenMap.get(dirId) || [];
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
        }
    }
    return selected;
}

function buildPartialExportData(selectedIds, data = mulufile) {
    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    const exportRows = [];
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length !== 4 || !selected.has(row[2])) continue;
        const parentId = selected.has(row[0]) ? row[0] : 'mulu';
        exportRows.push([parentId, row[1], row[2], row[3]]);
    }
    return exportRows;
}

async function writePartsToDirectoryHandle(directoryHandle, fileName, parts) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    await writePartsToFileHandle(fileHandle, parts);
    return fileHandle;
}

function isSafeExportUrl(value, attributeName) {
    const raw = String(value || '').replace(/[\u0000-\u001F\u007F\s]+/g, '').trim();
    if (!raw) return true;
    const lower = raw.toLowerCase();
    if (lower.startsWith('#') || lower.startsWith('dir:') || lower.startsWith('name:') || lower.startsWith('sora-dir:')) {
        return attributeName === 'href' || attributeName === 'xlink:href';
    }
    if (/^(https?:|mailto:|tel:)/i.test(raw)) return true;
    if (/^(\.\.?\/|\/)/.test(raw) || !/^[a-z][a-z0-9+.-]*:/i.test(raw)) return true;
    if (/^data:/i.test(raw)) {
        return attributeName === 'src' && /^data:(image|video|audio)\/[a-z0-9.+-]+(?:;|,)/i.test(raw);
    }
    return false;
}

function collectUnsafeExportContent(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    const findings = [];
    root.querySelectorAll('script, iframe, object, embed, base, meta, link, style').forEach(element => {
        findings.push(`包含不允许导出的 <${element.tagName.toLowerCase()}> 元素`);
    });
    root.querySelectorAll('*').forEach(element => {
        Array.from(element.attributes || []).forEach(attribute => {
            const name = attribute.name.toLowerCase();
            if (/^on/i.test(name) || name === 'srcdoc' || name === 'formaction' || name === 'action') {
                findings.push(`包含不允许的 ${attribute.name} 属性`);
            } else if (['href', 'src', 'xlink:href'].includes(name) && !isSafeExportUrl(attribute.value, name)) {
                findings.push(`包含不安全的 ${attribute.name} 协议`);
            } else if (name === 'style' && /(?:expression\s*\(|url\s*\(|@import|behavior\s*:|-moz-binding)/i.test(attribute.value)) {
                findings.push('包含不安全的内联样式');
            }
        });
        if (element.matches('input[type="password"], input[type="file"]')) {
            findings.push(`包含不允许的 ${element.getAttribute('type')} 输入框`);
        }
    });
    return Array.from(new Set(findings));
}

function sanitizeExportContent(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    let changed = 0;
    root.querySelectorAll('script, iframe, object, embed, base, meta, link, style').forEach(element => {
        element.remove();
        changed++;
    });
    root.querySelectorAll('form').forEach(form => {
        const replacement = document.createElement('div');
        replacement.className = form.className || '';
        replacement.setAttribute('data-sora-sanitized-form', 'true');
        while (form.firstChild) replacement.appendChild(form.firstChild);
        form.replaceWith(replacement);
        changed++;
    });
    root.querySelectorAll('*').forEach(element => {
        Array.from(element.attributes || []).forEach(attribute => {
            const name = attribute.name.toLowerCase();
            const unsafeAttribute = /^on/i.test(name) || name === 'srcdoc' || name === 'formaction' || name === 'action';
            const unsafeUrl = ['href', 'src', 'xlink:href'].includes(name) && !isSafeExportUrl(attribute.value, name);
            const unsafeStyle = name === 'style' && /(?:expression\s*\(|url\s*\(|@import|behavior\s*:|-moz-binding)/i.test(attribute.value);
            if (unsafeAttribute || unsafeUrl || unsafeStyle) {
                element.removeAttribute(attribute.name);
                changed++;
            }
        });
        if (element.matches('input[type="password"], input[type="file"]')) {
            element.setAttribute('type', 'text');
            element.setAttribute('disabled', '');
            element.setAttribute('aria-label', '已禁用的导出输入框');
            changed++;
        }
        if (element.matches('a[href]')) {
            const href = element.getAttribute('href') || '';
            if (/^https?:/i.test(href)) {
                element.setAttribute('rel', 'noopener noreferrer');
                if (element.getAttribute('target') === '_blank') element.setAttribute('referrerpolicy', 'no-referrer');
            }
        }
    });
    return changed;
}

function collectMethodPreflightIssues(rows, parsedById, issues) {
    const picker = window.SoraReferencePicker;
    const registry = window.SoraMethodRegistry;
    const referenceIndex = picker ? picker.buildIndex(rows) : null;
    const methodIds = new Map();
    const knownDirectoryActions = registry
        ? new Set(registry.getDirectoryActions().map(item => item.value))
        : null;

    function addIssue(key, value) {
        if (!issues[key].includes(value)) issues[key].push(value);
    }

    function resolveReference(value, contextDirId) {
        if (!picker || !referenceIndex) return null;
        return picker.resolve(value, referenceIndex, contextDirId);
    }

    function validatePair(frontValue, backValue, contextDirId, label, requireRange, requireDirectory) {
        const front = resolveReference(frontValue, contextDirId);
        if (!frontValue) {
            addIssue('invalidMethods', `${label}：缺少目标目录或前锚点`);
            return;
        }
        if (!front || !front.exists) {
            addIssue('missingMethodTargets', `${label}：${front && front.error ? front.error : frontValue}`);
            return;
        }
        if (!backValue) {
            if (requireRange) {
                addIssue('invalidMethods', `${label}：该动作需要后锚点`);
            } else if (requireDirectory && front.type !== 'directory') {
                addIssue('invalidMethods', `${label}：目录级动作必须指向整个目录`);
            }
            return;
        }
        const back = resolveReference(backValue, contextDirId);
        if (!back || !back.exists) {
            addIssue('missingMethodTargets', `${label}：${back && back.error ? back.error : backValue}`);
            return;
        }
        if (front.type !== 'anchor' || back.type !== 'anchor') {
            addIssue('invalidMethods', `${label}：范围起点和终点都必须是锚点`);
            return;
        }
        if (front.directory.id !== back.directory.id) {
            addIssue('invalidMethods', `${label}：前后锚点不在同一目录`);
        } else if (front.anchor.order >= back.anchor.order) {
            addIssue('invalidMethods', `${label}：后锚点没有位于前锚点之后`);
        }
    }

    function inspectMethod(config, row, path, depth) {
        const label = `${row[1]} · ${path}`;
        if (!config || typeof config !== 'object') {
            addIssue('invalidMethods', `${label}：配置不是有效对象`);
            return;
        }
        if (depth > 20) {
            addIssue('invalidMethods', `${label}：嵌套层级超过 20 层`);
            return;
        }
        const cfg = registry
            ? registry.normalize(config, { assignId: false, clone: true })
            : config;
        if (cfg.methodId) {
            if (methodIds.has(cfg.methodId)) {
                addIssue('duplicateMethodIds', `${cfg.methodId}：${methodIds.get(cfg.methodId)} / ${label}`);
            } else {
                methodIds.set(cfg.methodId, label);
            }
        }
        if (registry) {
            registry.validateBasic(cfg).forEach(error => {
                if (!['frontAnchor', 'backAnchor'].includes(error.field)) addIssue('invalidMethods', `${label}：${error.message}`);
            });
        }
        const action = registry ? registry.getAction(cfg.methodType) : null;
        if (!action || !['none', 'optional'].includes(action.targetMode) || cfg.frontAnchor) {
            validatePair(
                String(cfg.frontAnchor || '').trim(),
                String(cfg.backAnchor || '').trim(),
                row[2],
                label,
                !!(action && action.targetMode === 'range'),
                !!(action && action.targetMode === 'directory') || (!action || action.targetMode !== 'optional') && !String(cfg.backAnchor || '').trim()
            );
        }
        if (action && action.targetMode === 'directory' && String(cfg.backAnchor || '').trim()) {
            addIssue('invalidMethods', `${label}：${action.label}只能作用于整个目录，请清空后锚点`);
        }

        if (cfg.methodType === '更换内容') {
            if (!cfg.backAnchor && !String(cfg.renameTo || '').trim()) {
                addIssue('invalidMethods', `${label}：缺少新目录名`);
            } else if (cfg.backAnchor && cfg.replaceSourceType !== 'text') {
                validatePair(
                    String(cfg.replaceFromFrontAnchor || '').trim(),
                    String(cfg.replaceFromBackAnchor || '').trim(),
                    row[2],
                    `${label}的替换来源`,
                    false,
                    false
                );
            }
        } else if (cfg.methodType === '添加格式') {
            if (['color', 'background-color'].includes(cfg.formatCommand) && !/^#[0-9a-fA-F]{6}$/.test(String(cfg.formatValue || ''))) {
                addIssue('invalidMethods', `${label}：颜色值无效`);
            }
            if (cfg.formatCommand === 'link') {
                const linkValue = String(cfg.formatValue || '').trim();
                if (!linkValue) addIssue('invalidMethods', `${label}：缺少链接地址`);
                else if (!/^(https?:\/\/|mailto:|tel:|#|dir:|name:|sora-dir:)/i.test(linkValue)) {
                    addIssue('invalidMethods', `${label}：链接协议不受支持`);
                }
            }
        } else if (cfg.methodType === '目录右键动作' && knownDirectoryActions && !knownDirectoryActions.has(cfg.dirAction)) {
            addIssue('invalidMethods', `${label}：不支持的目录动作 ${cfg.dirAction || '未设置'}`);
        } else if (cfg.methodType === '插入内容' && cfg.contentSourceType === 'reference') {
            validatePair(String(cfg.contentFrontAnchor || '').trim(), String(cfg.contentBackAnchor || '').trim(), row[2], `${label}的插入来源`, false, false);
        } else if (cfg.methodType === '传送范围') {
            validatePair(String(cfg.destinationFrontAnchor || '').trim(), String(cfg.destinationBackAnchor || '').trim(), row[2], `${label}的传送目标`, true, false);
        }

        ['formatMethods', 'elseMethods', 'confirmMethods', 'cancelMethods'].forEach(methodKey => {
            if (!Array.isArray(cfg[methodKey])) return;
            cfg[methodKey].forEach((nested, index) => {
                inspectMethod(nested, row, `${path} / ${methodKey} ${index + 1}`, depth + 1);
            });
        });
    }

    rows.forEach(row => {
        const template = parsedById.get(row[2]);
        if (!template) return;
        template.content.querySelectorAll('a[data-sora-link="method"][data-sora-methods]').forEach((link, linkIndex) => {
            const raw = link.getAttribute('data-sora-methods') || '';
            let methods;
            try {
                methods = JSON.parse(raw);
            } catch (error) {
                addIssue('invalidMethods', `${row[1]} · 方法 ${linkIndex + 1}：配置 JSON 无法解析`);
                return;
            }
            if (!Array.isArray(methods) || methods.length === 0) {
                addIssue('invalidMethods', `${row[1]} · 方法 ${linkIndex + 1}：没有可执行配置`);
                return;
            }
            methods.forEach((method, methodIndex) => {
                inspectMethod(method, row, `方法 ${linkIndex + 1}.${methodIndex + 1}`, 0);
            });
        });
    });
}

async function collectExportPreflightIssues(data = mulufile) {
    const rows = Array.isArray(data) ? data.filter(row => row && row.length === 4) : [];
    const inventory = window.SoraPerformance ? await window.SoraPerformance.analyze(rows) : null;
    const rowById = new Map();
    const rowsByName = new Map();
    const issues = {
        duplicateDirectoryIds: [],
        missingParents: [],
        brokenLinks: [],
        missingAnchors: [],
        duplicateAnchors: [],
        invalidMethods: [],
        missingMethodTargets: [],
        duplicateMethodIds: [],
        missingMedia: [],
        emptyDirectories: [],
        unsafeContent: [],
        headingJumps: [],
        duplicateHeadings: [],
        missingAltText: [],
        longParagraphs: []
    };
    rows.forEach(row => {
        if (!inventory && rowById.has(row[2])) issues.duplicateDirectoryIds.push(row[2]);
        rowById.set(row[2], row);
        if (!rowsByName.has(row[1])) rowsByName.set(row[1], []);
        rowsByName.get(row[1]).push(row);
    });
    if (inventory) {
        issues.duplicateDirectoryIds.push(...inventory.duplicateDirectoryIds);
        issues.missingParents.push(...inventory.missingParents);
    } else rows.forEach(row => {
        if (row[0] && row[0] !== 'mulu' && !rowById.has(row[0])) {
            issues.missingParents.push(`${row[1]} → ${row[0]}`);
        }
    });

    const parsedById = new Map();
    const anchorsById = new Map();
    const mediaIds = new Set();
    rows.forEach(row => {
        const template = document.createElement('template');
        template.innerHTML = String(row[3] || '');
        collectUnsafeExportContent(template.content).forEach(finding => {
            issues.unsafeContent.push(`${row[1] || row[2]}：${finding}`);
        });
        let previousHeadingLevel = 0;
        const headingCounts = new Map();
        template.content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            const level = Number(heading.tagName.slice(1)) || 0;
            const label = String(heading.textContent || '').replace(/\s+/g, ' ').trim() || '未命名标题';
            if (previousHeadingLevel && level > previousHeadingLevel + 1) {
                issues.headingJumps.push(`${row[1] || row[2]}：${'H' + previousHeadingLevel} 直接跳到 ${'H' + level}（${label}）`);
            }
            previousHeadingLevel = level;
            const key = label.toLocaleLowerCase();
            headingCounts.set(key, { label, count: (headingCounts.get(key)?.count || 0) + 1 });
        });
        headingCounts.forEach(item => {
            if (item.count > 1) issues.duplicateHeadings.push(`${row[1] || row[2]}：${item.label}（${item.count} 次）`);
        });
        template.content.querySelectorAll('img').forEach((image, imageIndex) => {
            if (!String(image.getAttribute('alt') || '').trim()) {
                issues.missingAltText.push(`${row[1] || row[2]}：第 ${imageIndex + 1} 张图片缺少替代文本`);
            }
        });
        template.content.querySelectorAll('p').forEach((paragraph, paragraphIndex) => {
            const length = String(paragraph.textContent || '').replace(/\s+/g, '').length;
            if (length > 500) issues.longParagraphs.push(`${row[1] || row[2]}：第 ${paragraphIndex + 1} 段约 ${length} 字`);
        });
        if (typeof ensureAnchorElements === 'function') ensureAnchorElements(template.content);
        if (typeof assignHeadingAutoIds === 'function') assignHeadingAutoIds(template.content);
        parsedById.set(row[2], template);
        const anchorCounts = new Map();
        template.content.querySelectorAll('[id], .sora-anchor[data-anchor-name]').forEach(element => {
            const id = element.matches('.sora-anchor[data-anchor-name]')
                ? element.getAttribute('data-anchor-name')
                : element.getAttribute('id');
            if (!id) return;
            anchorCounts.set(id, (anchorCounts.get(id) || 0) + 1);
        });
        const anchors = new Set(anchorCounts.keys());
        anchorsById.set(row[2], anchors);
        anchorCounts.forEach((count, anchor) => {
            if (count > 1) issues.duplicateAnchors.push(`${row[1]}：#${anchor}（${count} 个）`);
        });
        template.content.querySelectorAll('[data-media-storage-id]').forEach(element => {
            const mediaId = element.getAttribute('data-media-storage-id');
            if (mediaId) mediaIds.add(mediaId);
        });
        const text = (template.content.textContent || '').replace(/\s+/g, '').trim();
        const hasContentElement = !!template.content.querySelector('img, video, audio, table, pre, blockquote, hr, .archive-attachment');
        if (!text && !hasContentElement) issues.emptyDirectories.push(row[1] || row[2]);
    });

    rows.forEach(row => {
        const template = parsedById.get(row[2]);
        template.content.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href') || '';
            const soraType = link.getAttribute('data-sora-link') || '';
            if (href.startsWith('#') || soraType === 'anchor') {
                const anchor = link.getAttribute('data-anchor-id') || href.slice(1);
                if (anchor && !anchorsById.get(row[2])?.has(anchor)) {
                    issues.missingAnchors.push(`${row[1]}：#${anchor}`);
                }
                return;
            }
            if (!href.toLowerCase().startsWith('sora-dir:') && soraType !== 'dir') return;
            const raw = href.toLowerCase().startsWith('sora-dir:') ? href.slice('sora-dir:'.length) : '';
            const hashIndex = raw.indexOf('#');
            const rawTarget = (hashIndex >= 0 ? raw.slice(0, hashIndex) : raw).trim();
            const anchor = link.getAttribute('data-anchor-id') || (hashIndex >= 0 ? raw.slice(hashIndex + 1) : '');
            const targetId = link.getAttribute('data-dir-id') || '';
            const targetName = link.getAttribute('data-dir-name') || '';
            let targetRow = targetId ? rowById.get(targetId) : null;
            if (!targetRow && targetName) {
                const matches = rowsByName.get(targetName) || [];
                if (matches.length === 1) targetRow = matches[0];
            }
            if (!targetRow && rawTarget) {
                targetRow = rowById.get(rawTarget);
                if (!targetRow) {
                    const matches = rowsByName.get(rawTarget) || [];
                    if (matches.length === 1) targetRow = matches[0];
                }
            }
            if (!targetRow) {
                issues.brokenLinks.push(`${row[1]} → ${targetId || targetName || rawTarget || href}`);
                return;
            }
            if (anchor && !anchorsById.get(targetRow[2])?.has(anchor)) {
                issues.missingAnchors.push(`${row[1]} → ${targetRow[1]}#${anchor}`);
            }
        });
    });

    collectMethodPreflightIssues(rows, parsedById, issues);

    if (typeof MediaStorage !== 'undefined') {
        await Promise.all(Array.from(mediaIds).map(async mediaId => {
            if (!await MediaStorage.mediaExists(mediaId)) issues.missingMedia.push(mediaId);
        }));
    }
    return issues;
}

function buildExportPreflightHtml(issues) {
    const groups = [
        ['阻断错误', '#b91c1c', [
            ['重复目录ID', issues.duplicateDirectoryIds], ['父目录缺失', issues.missingParents],
            ['目录链接失效', issues.brokenLinks], ['锚点缺失', issues.missingAnchors],
            ['方法配置无效', issues.invalidMethods], ['方法目标缺失', issues.missingMethodTargets],
            ['方法ID重复', issues.duplicateMethodIds], ['媒体缺失', issues.missingMedia],
            ['不安全的发布内容', issues.unsafeContent]
        ]],
        ['风险警告', '#b45309', [
            ['重复锚点', issues.duplicateAnchors], ['标题层级跳跃', issues.headingJumps],
            ['重复标题', issues.duplicateHeadings], ['图片缺少替代文本', issues.missingAltText],
            ['过长段落', issues.longParagraphs]
        ]],
        ['信息提示', '#475569', [['空目录', issues.emptyDirectories]]]
    ];
    const counts = groups.map(([, , sections]) => sections.reduce((sum, section) => sum + section[1].length, 0));
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (total === 0) return { total, blocking: 0, warnings: 0, info: 0, html: '<p>预检通过，未发现目录、链接、锚点、方法或媒体问题。</p>' };
    const html = groups.map(([groupTitle, color, sections], groupIndex) => {
        if (!counts[groupIndex]) return '';
        const sectionHtml = sections.filter(section => section[1].length > 0).map(([title, values]) => {
            const shown = values.slice(0, 12).map(value => `<li>${escapeHtml(String(value))}</li>`).join('');
            const more = values.length > 12 ? `<li>另有 ${values.length - 12} 项…</li>` : '';
            return `<div style="margin:7px 0"><strong>${title}（${values.length}）</strong><ul>${shown}${more}</ul></div>`;
        }).join('');
        return `<section style="margin-bottom:12px;border-left:4px solid ${color};padding-left:10px"><h3 style="margin:0;color:${color}">${groupTitle}（${counts[groupIndex]}）</h3>${sectionHtml}</section>`;
    }).join('');
    return { total, blocking: counts[0], warnings: counts[1], info: counts[2], html: `<p>发现 <strong>${total}</strong> 个检查结果：</p>${html}` };
}

async function showExportPreflight(data = mulufile) {
    const issues = await collectExportPreflightIssues(data);
    const report = buildExportPreflightHtml(issues);
    if (report.total === 0) {
        await customAlert('导出预检通过，未发现问题。', '导出预检');
    } else {
        await customConfirm(report.html, '关闭', '返回编辑', '导出预检详情', true);
    }
    return issues;
}

async function confirmExportPreflight(data = mulufile) {
    const issues = await collectExportPreflightIssues(data);
    const report = buildExportPreflightHtml(issues);
    if (report.total === 0) {
        showToast('导出预检通过', 'success', 1400);
        return true;
    }
    return customConfirm(report.html, report.blocking ? '仍要导出' : '继续导出', '返回修正', report.blocking ? '导出预检：存在阻断错误' : '导出预检', true);
}

async function chooseSaveAsExportScope() {
    if (typeof syncPreviewToTextarea === 'function') {
        syncPreviewToTextarea();
    }
    if (!Array.isArray(mulufile) || mulufile.length === 0) {
        customAlert('当前没有可导出的目录');
        return null;
    }

    const currentDirId = getCurrentExportDirId();
    const scopeOptions = [
        { value: 'all', label: `全部目录（${mulufile.length} 个）` }
    ];
    if (currentDirId) {
        const currentSubtreeCount = collectDirectorySubtreeIds(currentDirId).size;
        scopeOptions.push({ value: 'current', label: `当前目录及子目录（${currentSubtreeCount} 个）` });
    }
    scopeOptions.push({ value: 'pick', label: '手动勾选目录' });

    const scope = await customSelect('选择另存为范围：', scopeOptions, 'all', '另存为范围');
    if (scope === null) {
        showToast('已取消保存', 'info', 2000);
        return null;
    }
    if (scope === 'all') {
        return { data: mulufile, mode: 'all', count: mulufile.length, label: '全部目录' };
    }
    if (scope === 'current') {
        const selectedIds = collectDirectorySubtreeIds(currentDirId);
        const data = buildPartialExportData(selectedIds);
        return { data, mode: 'partial', count: data.length, label: '当前目录及子目录' };
    }
    const selectedIds = await showDirectoryExportPicker(currentDirId);
    if (!selectedIds || selectedIds.size === 0) {
        showToast('未选择目录，已取消保存', 'info', 2000);
        return null;
    }
    const data = buildPartialExportData(selectedIds);
    return { data, mode: 'partial', count: data.length, label: '勾选目录' };
}

function showDirectoryExportPicker(currentDirId) {
    return new Promise((resolve) => {
        const levelMap = buildDirectoryLevelMap(mulufile);
        const childrenMap = buildChildrenIdMap(mulufile);
        const checkboxMap = new Map();

        customDialogTitle.textContent = '选择要另存为的目录';
        customDialogInput.style.display = 'none';
        customDialogMessage.innerHTML = '';
        customDialog.style.maxWidth = '760px';
        customDialog.style.width = '92vw';

        const wrapper = document.createElement('div');
        wrapper.className = 'export-scope-dialog';
        wrapper.style.textAlign = 'left';

        const hint = document.createElement('div');
        hint.textContent = '勾选父目录会同时勾选它的所有子目录。未勾选父级的目录会作为新文件的根目录导出。';
        hint.style.fontSize = '12px';
        hint.style.color = '#667085';
        hint.style.marginBottom = '10px';
        wrapper.appendChild(hint);

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '8px';
        controls.style.marginBottom = '10px';
        controls.style.flexWrap = 'wrap';

        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = '筛选目录名或 ID';
        searchInput.style.flex = '1 1 220px';
        searchInput.style.padding = '8px 10px';
        searchInput.style.border = '1px solid #d0d5dd';
        searchInput.style.borderRadius = '6px';
        controls.appendChild(searchInput);

        const makeSmallBtn = (text) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            btn.className = 'custom-dialog-btn custom-dialog-btn-secondary';
            btn.style.padding = '7px 10px';
            return btn;
        };
        const selectAllBtn = makeSmallBtn('全选');
        const clearBtn = makeSmallBtn('清空');
        const currentBtn = makeSmallBtn('只选当前');
        controls.appendChild(selectAllBtn);
        controls.appendChild(clearBtn);
        if (currentDirId) {
            controls.appendChild(currentBtn);
        }
        wrapper.appendChild(controls);

        const countEl = document.createElement('div');
        countEl.style.fontSize = '12px';
        countEl.style.color = '#475467';
        countEl.style.marginBottom = '8px';
        wrapper.appendChild(countEl);

        const list = document.createElement('div');
        list.style.maxHeight = '46vh';
        list.style.overflow = 'auto';
        list.style.border = '1px solid #e4e7ec';
        list.style.borderRadius = '8px';
        list.style.background = '#fff';

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < mulufile.length; i++) {
            const row = mulufile[i];
            if (!row || row.length !== 4) continue;
            const dirId = row[2];
            const level = levelMap.get(dirId) || 0;
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.style.minHeight = '32px';
            label.style.padding = '6px 10px';
            label.style.paddingLeft = (10 + level * 18) + 'px';
            label.style.borderBottom = '1px solid #f2f4f7';
            label.style.cursor = 'pointer';
            label.dataset.dirId = dirId;
            label.dataset.search = (String(row[1] || '') + ' ' + String(dirId || '')).toLowerCase();

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = dirId;
            checkbox.style.flex = '0 0 auto';

            const textWrap = document.createElement('span');
            textWrap.style.minWidth = '0';
            textWrap.style.flex = '1';
            const name = document.createElement('span');
            name.textContent = row[1] || '未命名';
            name.style.display = 'block';
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.style.whiteSpace = 'nowrap';
            const meta = document.createElement('span');
            meta.textContent = dirId;
            meta.style.display = 'block';
            meta.style.fontSize = '11px';
            meta.style.color = '#98a2b3';
            meta.style.overflow = 'hidden';
            meta.style.textOverflow = 'ellipsis';
            meta.style.whiteSpace = 'nowrap';
            textWrap.appendChild(name);
            textWrap.appendChild(meta);
            label.appendChild(checkbox);
            label.appendChild(textWrap);
            fragment.appendChild(label);
            checkboxMap.set(dirId, checkbox);
        }
        list.appendChild(fragment);
        wrapper.appendChild(list);
        customDialogMessage.appendChild(wrapper);

        const updateCount = () => {
            let count = 0;
            checkboxMap.forEach(cb => {
                if (cb.checked) count++;
            });
            countEl.textContent = `已选择 ${count} / ${checkboxMap.size} 个目录`;
        };

        const setSubtreeChecked = (dirId, checked) => {
            const stack = [dirId];
            const visited = new Set();
            while (stack.length > 0) {
                const id = stack.pop();
                if (!id || visited.has(id)) continue;
                visited.add(id);
                const cb = checkboxMap.get(id);
                if (cb) cb.checked = checked;
                const children = childrenMap.get(id) || [];
                for (let i = children.length - 1; i >= 0; i--) {
                    stack.push(children[i]);
                }
            }
        };

        list.addEventListener('change', (event) => {
            const cb = event.target;
            if (!cb || cb.type !== 'checkbox') return;
            setSubtreeChecked(cb.value, cb.checked);
            updateCount();
        });

        searchInput.addEventListener('input', () => {
            const keyword = searchInput.value.trim().toLowerCase();
            list.querySelectorAll('label[data-dir-id]').forEach(label => {
                label.style.display = !keyword || label.dataset.search.includes(keyword) ? 'flex' : 'none';
            });
        });

        selectAllBtn.onclick = () => {
            checkboxMap.forEach(cb => { cb.checked = true; });
            updateCount();
        };
        clearBtn.onclick = () => {
            checkboxMap.forEach(cb => { cb.checked = false; });
            updateCount();
        };
        currentBtn.onclick = () => {
            checkboxMap.forEach(cb => { cb.checked = false; });
            if (currentDirId) {
                setSubtreeChecked(currentDirId, true);
            }
            updateCount();
        };

        if (currentDirId) {
            setSubtreeChecked(currentDirId, true);
        }
        updateCount();

        customDialogFooter.innerHTML =
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        const okBtn = document.getElementById('customDialogOk');
        const cancelBtn = document.getElementById('customDialogCancel');
        const closeBtn = customDialogClose;
        const closeDialog = (result) => {
            customDialogOverlay.classList.remove('active');
            customDialogMessage.innerHTML = '';
            customDialog.style.maxWidth = '';
            customDialog.style.width = '';
            resolve(result);
        };
        okBtn.onclick = () => {
            const selected = new Set();
            checkboxMap.forEach((cb, dirId) => {
                if (cb.checked) selected.add(dirId);
            });
            closeDialog(selected);
        };
        cancelBtn.onclick = () => closeDialog(null);
        closeBtn.onclick = () => closeDialog(null);
        customDialogOverlay.onclick = (event) => {
            if (event.target === customDialogOverlay) closeDialog(null);
        };
        customDialogOverlay.classList.add('active');
        setTimeout(() => searchInput.focus(), 100);
    });
}

/**
 * 准备导出数据（从 IndexedDB 恢复视频数据）
 * @param {Array} muluData - 原始目录数据
 * @returns {Promise<Array>} - 包含完整视频数据的目录数据副本
 */
async function prepareDataForExport(muluData) {
    const source = Array.isArray(muluData) ? muluData : [];
    const exportData = new Array(source.length);
    for (let i = 0; i < source.length; i++) {
        const item = source[i];
        if (!item || item.length !== 4) {
            exportData[i] = Array.isArray(item) ? item.slice() : item;
            continue;
        }
        const row = [item[0], item[1], item[2], item[3]];
        const content = row[3];
        if (content && content.includes('data-media-storage-id') && typeof MediaStorage !== 'undefined') {
            row[3] = await MediaStorage.processHtmlForExport(content);
        }
        exportData[i] = row;
        if (i > 0 && i % 200 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    return exportData;
}
/**
 * 另存为功能
 * @param {string} customName - 自定义文件名
 */
async function handleSaveAs(customName, exportData = null) {
    if (!customName) {
        customAlert("已取消保存");
        return;
    }
    let filename = customName;
    let nameWithoutExt = customName.substring(0, customName.lastIndexOf('.'));
    let ext = customName.substring(customName.lastIndexOf('.'));
    if (!nameWithoutExt || !ext) {
        customAlert("文件名格式错误，请包含扩展名（如：data.sora）");
        return;
    }
    if (/\.sora$/i.test(filename)) {
        await handleSaveAsSoraPackage(filename, exportData, null, { usePicker: false });
        return;
    }
    let format = ext.substring(1).toLowerCase();
    let mimeType = getMimeType(filename);
    // 准备数据（从 IndexedDB 恢复视频数据）
    let dataToSave = await prepareDataForExport(Array.isArray(exportData) ? exportData : mulufile);
    let stringData = (format === 'json')
        ? stringifyJsonData(dataToSave)
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
async function handleSaveAsEncrypted(customName, password, exportData = null) {
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
    let dataToSave = await prepareDataForExport(Array.isArray(exportData) ? exportData : mulufile);
    let stringData = stringifyJsonData(dataToSave);
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
async function handleSaveAsWebpage(encrypt = false, password = null, exportData = null, exportScope = null) {
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
    const pendingMediaImport = window.__soraMediaImportPromise;
    if (pendingMediaImport) {
        showToast('正在等待媒体导入完成...', 'info', 2000);
        await pendingMediaImport;
        if (window.__soraMediaImportPromise === pendingMediaImport) {
            window.__soraMediaImportPromise = null;
        }
    }
    // 从输入框获取文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    // 移除可能的扩展名
    baseName = baseName.replace(/\.(json|txt|xml|csv|html|encrypted)$/i, '');
    const sourceData = Array.isArray(exportData) ? exportData : mulufile;
    const publicationSettings = window.PublicationSettings && typeof window.PublicationSettings.resolve === 'function'
        ? window.PublicationSettings.resolve(sourceData, typeof currentMuluName !== 'undefined' ? currentMuluName : '', baseName)
        : {
            title: baseName,
            description: '',
            icon: '',
            language: 'zh-CN',
            theme: 'light',
            defaultDirId: sourceData.length && sourceData[0].length === 4 ? sourceData[0][2] : '',
            initialTreeState: 'expanded',
            navigationMode: 'sidebar',
            capabilityLevel: 'standard',
            searchEnabled: true,
            mediaPolicy: 'balanced',
            deploymentMode: 'single-html',
            debugEnabled: false
        };
    if (encrypt && publicationSettings.deploymentMode === 'pwa-folder') {
        publicationSettings.deploymentMode = 'static-folder';
        showToast('加密网页无法注册 PWA，已改为静态网站目录', 'warning', 3200);
    }
    const partialSuffix = exportScope && exportScope.mode === 'partial' ? '_partial' : '';
    let filename = encrypt ? `${baseName}${partialSuffix}.encrypted.html` : `${baseName}${partialSuffix}.html`;
    let selectedFileHandle = null;
    let deploymentDirectoryHandle = null;
    if (publicationSettings.deploymentMode !== 'single-html' && typeof window.showDirectoryPicker === 'function') {
        try {
            deploymentDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            filename = 'index.html';
        } catch (err) {
            if (err.name === 'AbortError') return false;
            console.warn('Deployment directory picker failed, using single HTML fallback:', err);
        }
    }
    if (!deploymentDirectoryHandle && isSavePickerSupported()) {
        try {
            selectedFileHandle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'HTML webpage', accept: { 'text/html': ['.html'] } }]
            });
        } catch (err) {
            if (err.name === 'AbortError') return false;
            console.warn('Webpage save picker failed, using fallback:', err);
        }
    }
    let mediaChunkTemporary = null;
    let mediaChunkWriter = null;
    if (!encrypt && isOpfsSupported()) {
        try {
            const chunkFilename = `.chunks-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
            const root = await navigator.storage.getDirectory();
            const directory = await root.getDirectoryHandle('sora-exports', { create: true });
            const handle = await directory.getFileHandle(chunkFilename, { create: true });
            const writable = await handle.createWritable();
            mediaChunkWriter = part => writable.write(part);
            mediaChunkTemporary = { directory, handle, writable, filename: chunkFilename };
        } catch (err) {
            console.warn('Unable to create webpage media spool:', err);
        }
    }
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
    // 递归生成目录HTML，同层级目录共享背景色
    function generateDirectoryHTML(items, level = 0) {
        let html = '';
        items.forEach((item, index) => {
            const safeDirId = String(item.id)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n')
                .replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029');
            const hasChildren = item.children && item.children.length > 0;
            const indent = 20 + (level * 20);
            // 有子目录时添加可点击的三角形图标，点击三角形才切换折叠/展开
            const toggleIcon = hasChildren
                ? `<span class="toggle-icon" aria-hidden="true"></span>`
                : `<span class="bullet-icon" aria-hidden="true"></span>`;
            const palette = getDirectoryLevelPalette(level);
            html += `<div class="mulu${hasChildren ? ' has-children expanded' : ''}" 
                         data-dir-id="${escapeHtml(item.id)}" 
                         data-level="${level}"
                         role="treeitem"
                         tabindex="-1"
                         aria-level="${level + 1}"
                         aria-selected="false"
                         ${hasChildren ? 'aria-expanded="true"' : ''}
                         style="padding-left: ${indent}px; --dir-bg: ${palette.bg}; --dir-hover-bg: ${palette.hover}; --dir-selected-bg: ${palette.selected}; --dir-text: ${palette.text};"
                         >
                        ${toggleIcon}<span class="mulu-text">${escapeHtml(item.name)}</span>
                    </div>`;
            if (hasChildren) {
                html += generateDirectoryHTML(item.children, level + 1);
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

    function escapeCssSelectorValue(value) {
        if (value === null || value === undefined) return '';
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(String(value));
        }
        const backslash = String.fromCharCode(92);
        return String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function(ch) {
            const hex = ch.charCodeAt(0).toString(16);
            return backslash + hex + ' ';
        });
    }

    async function generateContentScripts(muluData, chunkWriter = null) {
        const contentScriptParts = [];
        const mediaDataMap = {};
        const mediaChunkScriptParts = [];
        const videoAssetCache = new Map();
        let videoAssetCounter = 0;

        const escapeHtmlAttribute = (value) => {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };

        const jsonSafeStringify = (value) => {
            return JSON.stringify(value).replace(/</g, '\\u003c');
        };

        const generatePlaceholderKeyPart = (value) => {
            return String(value || '')
                .trim()
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .slice(0, 80);
        };

        const emptyPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
        let placeholderCounter = 0;

        const detectVideoMimeType = (base64, fallback) => {
            if (fallback && fallback !== 'application/octet-stream') return fallback;
            try {
                const sample = atob(String(base64 || '').slice(0, 44));
                const bytes = Uint8Array.from(sample, char => char.charCodeAt(0));
                const ascii = (start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
                if (bytes.length >= 12 && ascii(4, 4) === 'ftyp') return 'video/mp4';
                if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
                if (bytes.length >= 4 && ascii(0, 4) === 'OggS') return 'video/ogg';
                if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'AVI ') return 'video/x-msvideo';
            } catch (e) {
            }
            return fallback || 'application/octet-stream';
        };

        const addVideoChunk = async (assetId, base64, index, chunkIds) => {
            const chunkId = 'media_chunk_' + assetId + '_' + index.toString(36);
            chunkIds.push(chunkId);
            const scriptPart = '<script type="application/octet-stream" id="' + chunkId + '">' + base64 + '</script>\n';
            if (chunkWriter) {
                await chunkWriter(scriptPart);
            } else {
                mediaChunkScriptParts.push(scriptPart);
            }
        };

        const exportDataUrlVideo = async (dataUrl, assetId) => {
            const commaIndex = String(dataUrl || '').indexOf(',');
            if (commaIndex < 0 || !/;base64/i.test(dataUrl.slice(0, commaIndex))) return null;
            const header = dataUrl.slice(0, commaIndex);
            const mimeMatch = header.match(/^data:([^;,]+)/i);
            const base64 = dataUrl.slice(commaIndex + 1).replace(/\s+/g, '');
            const chunkIds = [];
            const chunkChars = Math.floor(((1024 * 1024 * 4 / 3) / 4)) * 4;
            for (let offset = 0, index = 0; offset < base64.length; offset += chunkChars, index++) {
                await addVideoChunk(assetId, base64.slice(offset, offset + chunkChars), index, chunkIds);
            }
            const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
            return {
                storage: 'chunks',
                mimeType: detectVideoMimeType(base64, mimeMatch ? mimeMatch[1] : ''),
                size: Math.max(0, Math.floor(base64.length * 3 / 4) - padding),
                chunks: chunkIds
            };
        };

        const exportVideoAsset = async (videoEl) => {
            const mediaId = videoEl.getAttribute('data-media-storage-id') || '';
            let dataUrl = videoEl.getAttribute('src') || '';
            if ((!dataUrl || !dataUrl.startsWith('data:')) && videoEl.querySelector) {
                const source = videoEl.querySelector('source[src^="data:"]');
                if (source) dataUrl = source.getAttribute('src') || '';
            }
            const cacheKey = mediaId ? 'stored:' + mediaId : '';
            if (cacheKey && videoAssetCache.has(cacheKey)) return videoAssetCache.get(cacheKey);

            const assetId = 'video_' + (++videoAssetCounter).toString(36);
            let asset = null;
            if (mediaId && typeof MediaStorage !== 'undefined' && MediaStorage && typeof MediaStorage.exportMediaChunks === 'function') {
                const chunkIds = [];
                try {
                    const info = await MediaStorage.exportMediaChunks(mediaId, (base64, index) =>
                        addVideoChunk(assetId, base64, index, chunkIds)
                    );
                    asset = {
                        storage: 'chunks',
                        mimeType: info.mimeType || 'application/octet-stream',
                        size: info.size || 0,
                        chunks: chunkIds
                    };
                } catch (err) {
                    console.error('分块导出视频失败:', mediaId, err);
                }
            }
            if (!asset && dataUrl.startsWith('data:')) {
                asset = await exportDataUrlVideo(dataUrl, assetId);
            }
            if (cacheKey && asset) videoAssetCache.set(cacheKey, asset);
            return asset;
        };

        for (let i = 0; i < muluData.length; i++) {
            const item = muluData[i];
            if (!item || item.length !== 4) continue;
            const dirId = item[2];
            let content = item[3] || '';

            if (content && content.includes('data-media-storage-id') && typeof MediaStorage !== 'undefined' && MediaStorage && typeof MediaStorage.processHtmlForExport === 'function') {
                content = await MediaStorage.processHtmlForExport(content, { skipVideo: true });
            }

            try {
                const temp = document.createElement('div');
                temp.innerHTML = String(content);
                if (window.SoraReusableBlocks) window.SoraReusableBlocks.expandTemplate(temp, sourceData);
                sanitizeExportContent(temp);

                const images = Array.from(temp.querySelectorAll('img'));
                for (let j = 0; j < images.length; j++) {
                    const img = images[j];
                    const src = img.getAttribute('src') || '';
                    if (!src || !src.startsWith('data:') || src.includes('about:blank')) {
                        continue;
                    }
                    placeholderCounter++;
                    const placeholderId = 'media_' + generatePlaceholderKeyPart(dirId) + '_' + placeholderCounter.toString(36);
                    mediaDataMap[placeholderId] = {
                        type: 'image',
                        data: src
                    };
                    img.setAttribute('data-placeholder-id', placeholderId);
                    img.setAttribute('data-loading', 'true');
                    img.classList.add('lazy-media');
                    img.setAttribute('src', emptyPixel);
                }

                const videos = Array.from(temp.querySelectorAll('video'));
                for (let j = 0; j < videos.length; j++) {
                    const videoEl = videos[j];
                    placeholderCounter++;
                    const placeholderId = 'media_' + generatePlaceholderKeyPart(dirId) + '_' + placeholderCounter.toString(36);
                    const asset = await exportVideoAsset(videoEl);
                    mediaDataMap[placeholderId] = asset ? {
                        type: 'video',
                        storage: asset.storage,
                        mimeType: asset.mimeType,
                        size: asset.size,
                        chunks: asset.chunks,
                        title: videoEl.getAttribute('title') || ''
                    } : {
                        type: 'video',
                        error: '视频数据未能导出'
                    };

                    const placeholder = document.createElement('div');
                    placeholder.className = 'lazy-media video-load-shell';
                    placeholder.setAttribute('data-loading', 'true');
                    placeholder.setAttribute('data-placeholder-id', placeholderId);
                    placeholder.innerHTML = '<div class="video-load-status">准备视频</div><div class="video-load-track"><span></span></div>';

                    if (videoEl.parentNode) {
                        videoEl.parentNode.replaceChild(placeholder, videoEl);
                    }
                }

                const archives = Array.from(temp.querySelectorAll('.archive-attachment'));
                for (let j = 0; j < archives.length; j++) {
                    const archive = archives[j];
                    const dataUrl = archive.getAttribute('data-export-url') || '';
                    if (!dataUrl || !dataUrl.startsWith('data:') || dataUrl.includes('about:blank')) {
                        continue;
                    }
                    placeholderCounter++;
                    const placeholderId = 'media_' + generatePlaceholderKeyPart(dirId) + '_' + placeholderCounter.toString(36);
                    mediaDataMap[placeholderId] = {
                        type: 'archive',
                        data: dataUrl
                    };
                    archive.setAttribute('data-placeholder-id', placeholderId);
                    archive.removeAttribute('data-export-url');
                }

                content = temp.innerHTML;
            } catch (e) {
                console.error('处理网页导出内容失败:', dirId, e);
            }

            const scriptId = 'content_' + String(dirId);
            contentScriptParts.push('<script type="application/json" id="' + escapeHtmlAttribute(scriptId) + '">' + jsonSafeStringify(String(content)) + '</script>');
        }

        const contentScripts = contentScriptParts.join('\n');
        const mediaDataScripts = '<script type="application/json" id="mediaData">' + jsonSafeStringify(mediaDataMap) + '</script>';
        return { contentScripts, mediaDataScripts, mediaChunkScriptParts };
    }

    // 生成完整的HTML页面
    const directoryTree = buildDirectoryTree(sourceData);
    const directoryHTML = generateDirectoryHTML(directoryTree);
    let generatedContent;
    try {
        generatedContent = window.SoraPerformance
            ? await window.SoraPerformance.measure('exportPrepare', () => generateContentScripts(sourceData, mediaChunkWriter), window.SoraPerformance.BUDGETS.exportPrepareMs)
            : await generateContentScripts(sourceData, mediaChunkWriter);
        if (mediaChunkTemporary) await mediaChunkTemporary.writable.close();
    } catch (err) {
        if (mediaChunkTemporary && typeof mediaChunkTemporary.writable.abort === 'function') {
            try {
                await mediaChunkTemporary.writable.abort();
            } catch (abortErr) {
                console.warn('Unable to abort webpage media spool:', abortErr);
            }
        }
        if (mediaChunkTemporary) {
            try {
                await mediaChunkTemporary.directory.removeEntry(mediaChunkTemporary.filename);
            } catch (cleanupErr) {
                console.warn('Unable to remove failed webpage media spool:', cleanupErr);
            }
        }
        throw err;
    }
    const { contentScripts, mediaDataScripts, mediaChunkScriptParts } = generatedContent;
    const directoryLevelColorsJson = JSON.stringify(
        typeof serializeDirectoryLevelColors === 'function' ? serializeDirectoryLevelColors() : {}
    ).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const methodRuntimeHandlersJson = JSON.stringify(
        window.SoraMethodRegistry
            ? window.SoraMethodRegistry.getRuntimeHandlerMap()
            : {
                '隐藏': 'visibility_hide',
                '隐藏（初始不隐藏）': 'visibility_hide_initially_visible',
                '显示': 'visibility_show',
                '切换': 'visibility_toggle',
                '更换内容': 'change_content',
                '添加格式': 'add_format',
                '目录右键动作': 'directory_action'
            }
    ).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const hasMethodRuntime = sourceData.some(row => Array.isArray(row) && /data-sora-(?:link=["']method|methods=)/i.test(String(row[3] || '')));
    const methodRuntimeCoreSource = hasMethodRuntime && window.SoraMethodRuntimeCore && typeof window.SoraMethodRuntimeCore.toInlineScript === 'function'
        ? window.SoraMethodRuntimeCore.toInlineScript('SoraMethodRuntimeCore')
        : 'const SoraMethodRuntimeCore={redactTimelineEntry:function(value){return value||{}}};';
    const firstDirId = publicationSettings.defaultDirId || (sourceData.length > 0 && sourceData[0].length === 4 ? sourceData[0][2] : '');
    const publicationSettingsJson = JSON.stringify(publicationSettings)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    const publicationAttribute = value => escapeHtml(value).replace(/"/g, '&quot;');
    const mediaChunkMarker = '<!--SORA_MEDIA_CHUNKS-->';
    // 生成完整的HTML页面
    let htmlContent = `<!DOCTYPE html>
<html lang="${publicationAttribute(publicationSettings.language)}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(publicationSettings.title)} - SoraDirectory</title>
    ${publicationSettings.description ? `<meta name="description" content="${publicationAttribute(publicationSettings.description)}">` : ''}
    ${publicationSettings.icon ? `<link rel="icon" href="${publicationAttribute(publicationSettings.icon)}">` : ''}
    ${publicationSettings.deploymentMode === 'pwa-folder' ? '<link rel="manifest" href="./manifest.webmanifest">' : ''}
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            color-scheme: light;
            --page-bg: #ffffff;
            --panel-bg: #f5f5f5;
            --elevated-bg: #ffffff;
            --text: #333333;
            --muted: #666666;
            --border: #dddddd;
            --accent: #0066cc;
            --accent-soft: #eef1f4;
            --code-bg: #f6f8fa;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            height: 100vh;
            height: 100dvh;
            overflow: hidden;
            color: var(--text);
            background: var(--page-bg);
        }
        .skip-link {
            position: fixed;
            left: 12px;
            top: 8px;
            z-index: 10050;
            padding: 8px 12px;
            border-radius: 6px;
            color: #fff;
            background: #075bbd;
            transform: translateY(-160%);
        }
        .skip-link:focus { transform: translateY(0); }
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }
        :focus-visible {
            outline: 3px solid var(--accent);
            outline-offset: 2px;
        }
        .sidebar {
            width: 280px;
            min-width: 200px;
            max-width: 400px;
            background-color: var(--panel-bg);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .sidebar-header {
            padding: 15px;
            background-color: var(--elevated-bg);
            border-bottom: 1px solid var(--border);
            font-weight: bold;
            color: var(--text);
            overflow-wrap: anywhere;
        }
        .export-search {
            position: relative;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 6px;
            padding: 10px;
            border-bottom: 1px solid var(--border);
            background: var(--elevated-bg);
        }
        .export-search input {
            width: 100%;
            min-width: 0;
            min-height: 38px;
            padding: 7px 10px;
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text);
            background: var(--page-bg);
            font: inherit;
            font-size: 16px;
        }
        .export-search button {
            min-height: 38px;
            padding: 6px 9px;
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text);
            background: var(--page-bg);
            cursor: pointer;
        }
        .export-search-status {
            grid-column: 1 / -1;
            min-height: 18px;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.5;
        }
        .export-search-results {
            grid-column: 1 / -1;
            display: grid;
            gap: 4px;
            max-height: min(48vh, 420px);
            overflow: auto;
        }
        .export-search-results[hidden] { display: none; }
        .export-search-result {
            display: grid;
            gap: 2px;
            width: 100%;
            padding: 8px 9px;
            border: 0;
            border-radius: 5px;
            text-align: left;
            color: var(--text);
            background: var(--panel-bg);
            cursor: pointer;
        }
        .export-search-result:hover { background: var(--accent-soft); }
        .export-search-result strong { overflow-wrap: anywhere; }
        .export-search-result small {
            overflow: hidden;
            color: var(--muted);
            font-weight: 400;
            text-overflow: ellipsis;
            white-space: nowrap;
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
            border-bottom: 1px solid #e6ebf1;
            text-align: left;
            white-space: nowrap;
            position: relative;
            cursor: pointer;
            background-color: var(--dir-bg, #f9f9f9);
            color: var(--dir-text, #1f2933);
            transition: background-color 0.16s ease, color 0.16s ease;
            padding-right: 10px;
        }
        .mulu:hover {
            background-color: var(--dir-hover-bg, #eef1f4);
        }
        .mulu:focus-visible {
            z-index: 1;
        }
        .mulu.selected {
            background-color: var(--dir-selected-bg, #dfe8f4);
            color: var(--dir-text, #1f2933);
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
            background-color: var(--elevated-bg);
            border-bottom: 1px solid var(--border);
            font-size: 18px;
            font-weight: bold;
            color: var(--text);
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
        }
        .reading-actions { position:relative; display:flex; align-items:center; margin-left:auto; }
        .reading-tools { position:relative; font-size:14px; font-weight:400; }
        .reading-tools > summary { min-height:34px; padding:6px 10px; border:1px solid var(--border); border-radius:5px; background:#fff; color:var(--text); cursor:pointer; list-style:none; }
        .reading-tools > summary::-webkit-details-marker { display:none; }
        .reading-tools-menu { position:absolute; right:0; top:calc(100% + 6px); z-index:20; display:grid; gap:2px; width:min(220px,80vw); padding:6px; border:1px solid var(--border); border-radius:6px; background:#fff; box-shadow:0 8px 20px rgba(0,0,0,.12); }
        .reading-tools-menu > button, .content-outline > summary { width:100%; min-height:34px; padding:7px 9px; border:0; border-radius:4px; background:transparent; color:var(--text); text-align:left; cursor:pointer; }
        .reading-tools-menu > button:hover, .content-outline > summary:hover { background:var(--accent-soft); }
        .content-outline[open] .content-outline-menu { display:grid; }
        .content-outline-menu { display:none; max-height:40vh; overflow:auto; padding:4px 0 4px 8px; border-top:1px solid var(--border); }
        .content-outline-menu button { min-height:32px; border:0; border-radius:4px; background:transparent; color:var(--text); text-align:left; cursor:pointer; }
        .reading-progress { position:fixed; inset:0 0 auto 0; z-index:10020; height:3px; background:transparent; pointer-events:none; }
        .reading-progress span { display:block; width:0; height:100%; background:var(--accent); transition:width .1s linear; }
        body.reading-mode .sidebar { transform:translateX(-105%); }
        body.reading-mode .content-area { width:100%; }
        body.reading-mode .content-body { padding-inline:max(20px,calc((100vw - 82ch)/2)); }
        #contentTitle {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .mobile-nav-toggle {
            display: none;
            min-height: 36px;
            padding: 6px 10px;
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text);
            background: var(--page-bg);
            font: inherit;
            font-size: 14px;
            cursor: pointer;
        }
        .sidebar-backdrop {
            display: none;
        }
        .content-body {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background-color: var(--page-bg);
            line-height: 1.6;
            overflow-wrap: anywhere;
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
            background-color: var(--code-bg);
            padding: 1em;
            padding-top: 2.2em;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
            min-height: 3em;
            border: 1px solid var(--border);
        }
        .content-body pre code {
            background-color: transparent;
            padding: 0;
            color: var(--text);
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
            max-width: 100%;
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
            max-width: min(100%, 640px);
            max-height: 360px;
            width: auto;
            height: auto;
            border-radius: 5px;
        }
        .video-load-shell {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 10px;
            width: min(100%, 640px);
            min-height: 180px;
            margin: 1em auto;
            padding: 20px;
            color: var(--muted);
            text-align: center;
            background: var(--code-bg);
            border: 1px solid var(--border);
            border-radius: 5px;
        }
        .video-load-shell.is-error {
            color: #b42318;
            background: #fff5f4;
            border-color: #f2b8b5;
        }
        .video-load-track {
            width: min(320px, 100%);
            height: 4px;
            margin: 0 auto;
            overflow: hidden;
            background: #d8dee4;
            border-radius: 2px;
        }
        .video-load-track span {
            display: block;
            width: 0;
            height: 100%;
            background: #0969da;
            transition: width 0.12s linear;
        }
        .video-load-button {
            align-self: center;
            min-height: 36px;
            padding: 7px 14px;
            color: #fff;
            font: inherit;
            cursor: pointer;
            background: #0969da;
            border: 0;
            border-radius: 5px;
        }
        .video-load-button:hover {
            background: #075bbd;
        }
        .video-load-button:disabled {
            cursor: default;
            opacity: 0.65;
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
            width: 48px;
            height: 48px;
            border: 0;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.45);
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
        .content-body .sora-anchor {
            display: inline-block;
            width: 0;
            height: 0;
            overflow: hidden;
            line-height: 0;
            pointer-events: none;
            user-select: none;
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
        .content-body mark.export-search-hit {
            color: #1f2933;
            background: #fde047;
            outline: 2px solid #a16207;
            outline-offset: 1px;
        }
        .content-body spoiler:focus,
        .content-body spoiler[data-revealed="true"] {
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
        .sora-method-dialog-overlay { position:fixed; inset:0; z-index:10020; display:none; align-items:center; justify-content:center; padding:18px; background:rgba(15,23,42,.46); }
        .sora-method-dialog-overlay.active { display:flex; }
        .sora-method-dialog { position:relative; width:min(520px,94vw); max-height:86vh; overflow:auto; padding:24px; border-radius:12px; background:#fff; box-shadow:0 22px 60px rgba(15,23,42,.28); }
        .sora-method-dialog.mode-drawer { position:absolute; right:0; top:0; bottom:0; width:min(440px,92vw); max-height:none; border-radius:0; }
        .sora-method-dialog.mode-sidebar { position:absolute; left:0; top:0; bottom:0; width:min(360px,88vw); max-height:none; border-radius:0; }
        .sora-method-dialog-close { position:absolute; top:8px; right:10px; border:0; background:transparent; color:#64748b; font-size:24px; cursor:pointer; }
        .sora-method-dialog-content { padding:10px 4px 18px; line-height:1.65; white-space:pre-wrap; }
        .sora-method-dialog-actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:8px; }
        .sora-method-dialog-actions button { min-height:38px; padding:7px 14px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; cursor:pointer; }
        .sora-method-dialog-actions button.primary { border-color:#2563eb; background:#2563eb; color:#fff; }
        .sora-component { display:block; margin:10px 0; padding:10px; border:1px solid #dbe3ee; border-radius:8px; }
        .sora-component input[type="text"] { display:block; width:100%; margin-top:6px; padding:8px; border:1px solid #cbd5e1; border-radius:5px; }
        .sora-component-tabs [role="tablist"] { display:flex; flex-wrap:wrap; gap:5px; border-bottom:1px solid var(--border); }
        .sora-component-tabs [role="tab"] { min-height:38px; padding:7px 11px; border:1px solid transparent; border-radius:7px 7px 0 0; background:transparent; color:var(--text); cursor:pointer; }
        .sora-component-tabs [role="tab"][aria-selected="true"] { border-color:var(--border); border-bottom-color:var(--elevated-bg); background:var(--elevated-bg); color:var(--accent); }
        .sora-component-tabs [role="tabpanel"] { padding:12px 4px 4px; }
        .sora-component-steps { padding-left:24px; }
        .sora-component-steps > li { padding:6px 0 12px 8px; }
        .sora-component-faq { display:grid; gap:8px; }
        .sora-component-faq details { border:1px solid var(--border); border-radius:7px; padding:9px 11px; }
        .sora-component-gallery { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr)); gap:10px; }
        .sora-component-gallery img, .sora-component-gallery figure { width:100%; max-width:100%; margin:0; }
        .sora-style-accent { padding:2px 5px; border-left:4px solid #2563eb; background:#eff6ff; }
        .sora-style-muted { opacity:.58; }
        .sora-style-success { color:#047857; background:#ecfdf5; }
        .sora-style-warning { color:#a16207; background:#fffbeb; }
        .sora-style-danger { color:#b91c1c; background:#fef2f2; }
        .sora-style-compact { line-height:1.25; font-size:.92em; }
        .sora-style-hidden { display:none !important; }
        .sora-animation-fade { animation:soraFade .45s ease both; }
        .sora-animation-expand { animation:soraExpand .4s ease both; transform-origin:top; }
        .sora-animation-slide { animation:soraSlide .4s ease both; }
        .sora-animation-emphasis { animation:soraEmphasis .55s ease both; }
        @keyframes soraFade { from { opacity:0; } to { opacity:1; } }
        @keyframes soraExpand { from { opacity:0; transform:scaleY(.65); } to { opacity:1; transform:scaleY(1); } }
        @keyframes soraSlide { from { opacity:0; transform:translateX(-18px); } to { opacity:1; transform:translateX(0); } }
        @keyframes soraEmphasis { 0%,100% { transform:scale(1); } 45% { transform:scale(1.04); } }
        .sora-method-debug-button { position:fixed; right:12px; bottom:12px; z-index:9998; padding:7px 10px; border:1px solid #cbd5e1; border-radius:999px; background:#fff; color:#334155; box-shadow:0 4px 16px rgba(15,23,42,.15); cursor:pointer; }
        .sora-method-debug-list { max-height:46vh; overflow:auto; margin:10px 0; padding:0; list-style:none; }
        .sora-method-debug-list li { padding:7px 0; border-bottom:1px solid #e2e8f0; font-size:13px; }
        @media (prefers-reduced-motion: reduce) {
            .sora-animation-fade, .sora-animation-expand, .sora-animation-slide, .sora-animation-emphasis { animation:none; }
        }
        body.content-first .sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 10010;
            height: 100vh;
            height: 100dvh;
            border-right: none;
            box-shadow: 12px 0 32px rgba(15, 23, 42, 0.22);
            transform: translateX(-105%);
            transition: transform 0.2s ease-out;
        }
        body.content-first.sidebar-open .sidebar { transform: translateX(0); }
        body.content-first .sidebar-backdrop {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: none;
            width: 100%;
            height: 100%;
            border: 0;
            background: rgba(15, 23, 42, 0.42);
            cursor: pointer;
        }
        body.content-first.sidebar-open .sidebar-backdrop { display: block; }
        body.content-first .mobile-nav-toggle { display: inline-flex; align-items: center; }
        @media (max-width: 768px) {
            .sidebar {
                position: fixed;
                inset: 0 auto 0 0;
                z-index: 10010;
                width: min(86vw, 320px);
                min-width: 0;
                max-width: none;
                height: 100vh;
                height: 100dvh;
                border-right: none;
                box-shadow: 12px 0 32px rgba(15, 23, 42, 0.22);
                transform: translateX(-105%);
                transition: transform 0.2s ease-out;
            }
            body.sidebar-open .sidebar { transform: translateX(0); }
            .sidebar-backdrop {
                position: fixed;
                inset: 0;
                z-index: 10000;
                width: 100%;
                height: 100%;
                border: 0;
                background: rgba(15, 23, 42, 0.42);
                cursor: pointer;
            }
            body.sidebar-open .sidebar-backdrop { display: block; }
            .content-area {
                width: 100%;
                height: 100vh;
                height: 100dvh;
            }
            .content-header { padding: 10px 12px; }
            .mobile-nav-toggle { display: inline-flex; align-items: center; }
            .content-body { padding: 18px 16px 32px; }
        }
        @media (prefers-reduced-motion: reduce) {
            .sidebar { transition: none; }
            .reading-progress span { transition:none; }
        }
        @media print {
            @page { size:auto; margin:16mm 14mm; }
            .sidebar, .sidebar-backdrop, .content-header, .reading-progress, .image-viewer-overlay, .sora-method-debug-button, .sora-method-dialog-overlay, #soraExportToast { display:none !important; }
            html, body, .app-container, .content-area, .content-body { display:block !important; width:auto !important; height:auto !important; min-height:0 !important; overflow:visible !important; background:#fff !important; color:#000 !important; }
            .content-body { padding:0 !important; }
            .content-body > * { max-width:none !important; }
            pre, table, figure, blockquote { break-inside:avoid; }
            h1, h2, h3, h4, h5, h6 { break-after:avoid; }
            a { color:#000 !important; text-decoration:underline; }
        }
    </style>
</head>
<body class="${publicationSettings.navigationMode === 'content-first' ? 'content-first' : ''}">
    <a class="skip-link" href="#contentBody">跳到正文</a>
    <div class="reading-progress" aria-hidden="true"><span id="readingProgressBar"></span></div>
    <nav class="sidebar" id="exportSidebar" aria-label="目录导航">
        <div class="sidebar-header">${escapeHtml(publicationSettings.title)}</div>
        ${publicationSettings.searchEnabled ? `<div class="export-search" role="search">
            <label class="sr-only" for="exportSearchInput">搜索导出内容</label>
            <input type="search" id="exportSearchInput" placeholder="搜索目录和正文" autocomplete="off" aria-describedby="exportSearchStatus">
            <button type="button" id="exportSearchClear" hidden>清除</button>
            <div class="export-search-status" id="exportSearchStatus" role="status" aria-live="polite">正在准备搜索索引…</div>
            <div class="export-search-results" id="exportSearchResults" role="list" hidden></div>
        </div>` : ''}
        <div class="sidebar-content">
            <div class="sidebar-content-inner" role="tree" aria-label="文档目录">
                ${directoryHTML}
            </div>
        </div>
    </nav>
    <button type="button" class="sidebar-backdrop" id="sidebarBackdrop" aria-label="关闭目录导航"></button>
    <div class="content-area">
        <header class="content-header">
            <button type="button" class="mobile-nav-toggle" id="mobileNavToggle" aria-controls="exportSidebar" aria-expanded="false">目录</button>
            <span id="contentTitle">选择一个目录查看内容</span>
            <div class="reading-actions">
                <details class="reading-tools" id="readingTools">
                    <summary>工具</summary>
                    <div class="reading-tools-menu">
                        <details class="content-outline" id="contentOutline"><summary>本页大纲</summary><div class="content-outline-menu" id="contentOutlineMenu"></div></details>
                        <button type="button" id="readingModeBtn" aria-pressed="false">阅读模式</button>
                        <button type="button" id="printPageBtn">打印</button>
                    </div>
                </details>
            </div>
        </header>
        <main class="content-body" id="contentBody" tabindex="-1">
            <div class="empty-state">点击左侧目录查看内容</div>
        </main>
    </div>
    <div class="image-viewer-overlay" id="imageViewer" role="dialog" aria-modal="true" aria-label="图片查看器">
        <button type="button" class="image-viewer-close" id="imageViewerClose" aria-label="关闭图片查看器">&times;</button>
        <img id="imageViewerImg" alt="放大查看">
    </div>
    ${contentScripts}
    ${mediaDataScripts}
    ${mediaChunkMarker}
    <script>
        ${methodRuntimeCoreSource}
        const SORA_PUBLICATION = ${publicationSettingsJson};
        const contentCache = {};
        let mediaDataMap = {};
        const directoryLevelColors = ${directoryLevelColorsJson};
        const soraMethodRuntimeHandlers = ${methodRuntimeHandlersJson};
        let currentSelected = null;
        let currentDirId = null;
        let soraMethodContextDirId = null;
        const nameMap = {};
        const nameIndex = {};
        const soraExecutedMethodIds = new Set();
        const soraMethodExecutionCounts = new Map();
        const soraMethodLastRun = new Map();
        const soraMethodDebounceTimers = new Map();
        const soraPageVariables = {};
        const soraDirectoryHistory = [];
        const soraDirectoryViewStates = new Map();
        const soraMethodExecutionLog = [];
        const soraMethodHoverCooldownMap = new WeakMap();
        let soraVisibleObserver = null;
        let soraHistoryNavigation = false;
        let soraDirClipboard = null;
        const SORA_METHOD_DEBUG = SORA_PUBLICATION.debugEnabled === true && SORA_PUBLICATION.capabilityLevel === 'full';

        function methodDebugLog() {
            if (!SORA_METHOD_DEBUG) return;
            console.log.apply(console, arguments);
        }

        function escapeCssSelectorValue(value) {
            if (value === null || value === undefined) return '';
            if (window.CSS && typeof window.CSS.escape === 'function') {
                return window.CSS.escape(String(value));
            }
            const backslash = String.fromCharCode(92);
            return String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function(ch) {
                const hex = ch.charCodeAt(0).toString(16);
                return backslash + hex + ' ';
            });
        }

        function normalizeAnchorId(raw) {
            if (!raw) return '';
            let id = String(raw).trim();
            id = id.replace(/^#/, '');
            id = id.replace(/\\s+/g, '-');
            return id;
        }

        function assignHeadingAutoIds(root) {
            if (!root) return;
            const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const used = new Set();
            headings.forEach(h => {
                if (h.id) {
                    used.add(h.id);
                    return;
                }
                const base = normalizeAnchorId(h.textContent || '') || '标题';
                let candidate = base;
                let i = 2;
                while (candidate && (used.has(candidate) || root.querySelector('#' + escapeCssSelectorValue(candidate)))) {
                    candidate = base + '-' + i;
                    i++;
                }
                if (!candidate) return;
                h.id = candidate;
                used.add(candidate);
            });
        }

        function scrollToAnchorInContent(anchorId) {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return false;
            const id = normalizeAnchorId(anchorId);
            if (!id) return false;
            let el = contentBody.querySelector('#' + escapeCssSelectorValue(id));
            if (!el) {
                el = contentBody.querySelector('.sora-anchor[data-sora-anchor="true"][data-anchor-name="' + escapeCssSelectorValue(id) + '"]');
            }
            if (!el) {
                const headings = contentBody.querySelectorAll('h1, h2, h3, h4, h5, h6');
                for (const h of headings) {
                    if (normalizeAnchorId(h.textContent || '') === id) {
                        el = h;
                        break;
                    }
                }
            }
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return true;
            }
            return false;
        }

        function readExportRoute() {
            const raw = String(location.hash || '').replace(/^#/, '');
            if (!raw.startsWith('sora-dir=')) return null;
            try {
                const params = new URLSearchParams(raw);
                return {
                    dirId: params.get('sora-dir') || '',
                    anchorId: normalizeAnchorId(params.get('sora-anchor') || '')
                };
            } catch (_) {
                return null;
            }
        }

        function writeExportRoute(dirId, anchorId, mode) {
            if (!dirId || mode === 'none') return;
            const params = new URLSearchParams();
            params.set('sora-dir', dirId);
            const normalizedAnchor = normalizeAnchorId(anchorId || '');
            if (normalizedAnchor) params.set('sora-anchor', normalizedAnchor);
            const nextHash = '#' + params.toString();
            if (location.hash === nextHash) return;
            try {
                const url = location.href.split('#')[0] + nextHash;
                if (mode === 'replace') history.replaceState({ soraDirId: dirId, soraAnchorId: normalizedAnchor }, '', url);
                else history.pushState({ soraDirId: dirId, soraAnchorId: normalizedAnchor }, '', url);
            } catch (_) {
                location.hash = nextHash;
            }
        }

        function captureExportDirectoryView(dirId) {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody || !dirId) return;
            soraDirectoryViewStates.set(dirId, {
                scrollTop: Math.max(0, contentBody.scrollTop || 0),
                updatedAt: Date.now()
            });
        }

        function restoreExportDirectoryView(dirId, mode) {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody || mode === 'preserve') return;
            if (mode === 'top') {
                contentBody.scrollTop = 0;
                return;
            }
            const state = soraDirectoryViewStates.get(dirId);
            contentBody.scrollTop = state ? Math.max(0, Number(state.scrollTop) || 0) : 0;
        }

        function selectDirectory(dirId, toggleExpand = false, options = {}) {
            methodDebugLog('[Sora方法] selectDirectory被调用, dirId:', dirId);
            const previousDirId = currentDirId;
            const viewMode = options.viewMode || (previousDirId === dirId ? 'preserve' : 'restore');
            const anchorId = normalizeAnchorId(options.anchorId || '');
            if (previousDirId) captureExportDirectoryView(previousDirId);
            if (currentDirId && currentDirId !== dirId) {
                handleSoraMethodTriggersCascade('leave_dir');
                if (!soraHistoryNavigation) {
                    soraDirectoryHistory.push(currentDirId);
                    if (soraDirectoryHistory.length > 50) soraDirectoryHistory.shift();
                }
            }
            releaseActiveMedia();
            if (currentSelected) {
                currentSelected.classList.remove('selected');
                currentSelected.setAttribute('aria-selected', 'false');
                currentSelected.setAttribute('tabindex', '-1');
            }
            const element = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');

            currentDirId = dirId;
            if (element) {
                element.classList.add('selected');
                element.setAttribute('aria-selected', 'true');
                element.setAttribute('tabindex', '0');
                currentSelected = element;
                if (toggleExpand && element.classList.contains('has-children')) {
                    element.classList.toggle('expanded');
                    element.setAttribute('aria-expanded', element.classList.contains('expanded') ? 'true' : 'false');
                    updateChildrenVisibility(dirId, element.classList.contains('expanded'));
                }
            }

            const content = getContent(dirId) || '';
            methodDebugLog('[Sora方法] 目录内容长度:', content.length, '前100字符:', content.substring(0, 100));
            const title = nameMap[dirId] || '未命名';
            document.getElementById('contentTitle').textContent = title;
            document.getElementById('contentBody').innerHTML = content || '<div class="empty-state">此目录暂无内容</div>';
            document.title = title + ' · ' + ${JSON.stringify(baseName)};
            assignHeadingAutoIds(document.getElementById('contentBody'));
            buildContentOutline();
            updateReadingProgress();
            initCodeBlocks();
            initImageViewer();
            initSpoilers();
            initArchiveDownloads();
            setTimeout(() => {
                loadLazyMedia();
                initVisibleMethodTriggers();
            }, 100);

            if (anchorId) {
                document.getElementById('contentBody').scrollTop = 0;
                requestAnimationFrame(function() { scrollToAnchorInContent(anchorId); });
            } else {
                restoreExportDirectoryView(dirId, viewMode);
            }
            writeExportRoute(dirId, anchorId, options.historyMode || 'push');
            if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
                setExportSidebarOpen(false, false);
            }

            methodDebugLog('[Sora方法] 开始执行enter_dir触发');
            handleSoraMethodTriggersCascade('enter_dir');
        }

        function resolveDirIdFromName(dirName) {
            const name = (dirName || '').trim();
            if (!name) return null;
            const ids = nameIndex[name];

            if (ids && ids.length > 0) {
                if (ids.length > 1) {
                    console.warn('存在重复目录名，已跳转到第一个匹配项:', name);
                }
                return ids[0];
            }
            return null;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function escapeHtmlAttr(str) {
            return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function showExportToast(message, duration = 2500, tone = 'info') {
            if (!message) return;
            let el = document.getElementById('soraExportToast');
            if (!el) {
                el = document.createElement('div');
                el.id = 'soraExportToast';
                el.style.position = 'fixed';
                el.style.left = '50%';
                el.style.bottom = '18px';
                el.style.transform = 'translateX(-50%)';
                el.style.maxWidth = '80vw';
                el.style.padding = '10px 14px';
                el.style.background = 'rgba(0, 0, 0, 0.78)';
                el.style.color = '#fff';
                el.style.borderRadius = '8px';
                el.style.fontSize = '14px';
                el.style.lineHeight = '1.4';
                el.style.zIndex = '10000';
                el.style.display = 'none';
                el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
                document.body.appendChild(el);
            }
            el.textContent = String(message);
            const tones = {
                info: 'rgba(15, 23, 42, 0.9)',
                success: 'rgba(21, 128, 61, 0.92)',
                warning: 'rgba(180, 83, 9, 0.94)',
                error: 'rgba(185, 28, 28, 0.94)'
            };
            el.style.background = tones[tone] || tones.info;
            el.style.display = 'block';
            clearTimeout(el._hideTimer);
            el._hideTimer = setTimeout(() => {
                el.style.display = 'none';
            }, duration);
        }

        function safeParseJson(raw, fallback) {
            try {
                if (raw === null || raw === undefined) return fallback;
                const text = String(raw).trim();
                if (!text) return fallback;
                return JSON.parse(text);
            } catch (e) {
                console.error('[Sora方法] JSON解析失败:', e, '原始数据:', raw);
                return fallback;
            }
        }

        /* SORA_OPTIONAL_METHOD_RUNTIME_START */
        function stringToHash(str) {
            let hash = 0;
            const s = String(str || '');
            for (let i = 0; i < s.length; i++) {
                hash = ((hash << 5) - hash) + s.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash);
        }

        function ensureMethodId(cfg, idx, salt) {
            if (!cfg || typeof cfg !== 'object') return null;
            if (cfg.methodId) return cfg.methodId;
            const h = stringToHash(JSON.stringify(cfg) + '_' + String(idx || 0) + '_' + String(salt || ''));
            cfg.methodId = 'm_' + h;
            return cfg.methodId;
        }

        function normalizeRuntimeMethodConfig(cfg, idx, salt) {
            if (!cfg || typeof cfg !== 'object') return null;
            if (!cfg.configVersion) cfg.configVersion = 1;
            if (!cfg.trigger) cfg.trigger = 'click';
            if (cfg.enabled === undefined) cfg.enabled = true;
            cfg.delayMs = Math.max(0, Number(cfg.delayMs) || 0);
            cfg.debounceMs = Math.max(0, Number(cfg.debounceMs) || 0);
            cfg.throttleMs = Math.max(0, Number(cfg.throttleMs) || 0);
            cfg.maxExecutions = Math.max(1, Math.min(1000, Number(cfg.maxExecutions) || (cfg.once ? 1 : 20)));
            cfg.conditions = Array.isArray(cfg.conditions) ? cfg.conditions : [];
            if (!cfg.formatCommand && cfg.formatType) {
                cfg.formatCommand = cfg.formatType;
                delete cfg.formatType;
            }
            if (Array.isArray(cfg.formatMethods)) {
                cfg.formatMethods = cfg.formatMethods
                    .map(function(item, nestedIndex) {
                        return normalizeRuntimeMethodConfig(item, nestedIndex, salt + '_nested_' + nestedIndex);
                    })
                    .filter(Boolean);
            }
            ['elseMethods', 'confirmMethods', 'cancelMethods'].forEach(function(key) {
                if (!Array.isArray(cfg[key])) return;
                cfg[key] = cfg[key]
                    .map(function(item, nestedIndex) {
                        return normalizeRuntimeMethodConfig(item, nestedIndex, salt + '_' + key + '_' + nestedIndex);
                    })
                    .filter(Boolean);
            });
            ensureMethodId(cfg, idx, salt);
            return cfg;
        }

        function readMethodsFromElement(a) {
            if (!a || !a.getAttribute) return [];
            const raw = a.getAttribute('data-sora-methods') || '';
            const parsed = safeParseJson(raw, []);
            const arr = Array.isArray(parsed) ? parsed : [];
            return arr
                .map(function(cfg, i) {
                    return normalizeRuntimeMethodConfig(cfg, i, (a.textContent || '').slice(0, 30));
                })
                .filter(Boolean);
        }

        function extractMethodLinksFromHtml(html) {
            if (!html) return [];
            const template = document.createElement('template');
            template.innerHTML = String(html);
            return Array.from(template.content.querySelectorAll('a[data-sora-link="method"][data-sora-methods]'));
        }

        function executeMethodsForElement(a, trigger) {
            const methods = readMethodsFromElement(a);
            if (!methods || methods.length === 0) return false;
            const executedInRun = arguments.length >= 3 ? arguments[2] : null;
            let anyOk = false;
            for (let i = 0; i < methods.length; i++) {
                const cfg = methods[i];
                if (!cfg || typeof cfg !== 'object') continue;
                if (cfg.enabled === false) continue;
                if ((cfg.trigger || 'click') !== trigger) continue;
                const id = ensureMethodId(cfg, i, (a.textContent || '').slice(0, 30));
                if (executedInRun && id && executedInRun.has(id)) {
                    continue;
                }
                if (cfg.once && id && soraExecutedMethodIds.has(id)) {
                    continue;
                }
                const ok = executeConfiguredMethod(cfg, a);
                if (!ok) continue;
                anyOk = true;
                if (executedInRun && id) {
                    executedInRun.add(id);
                }
                if (cfg.once && id) {
                    soraExecutedMethodIds.add(id);
                }
            }
            return anyOk;
        }

        function handleSoraMethodTriggersCascade(reason) {
            methodDebugLog('[Sora方法] 开始级联触发:', reason);
            const maxPasses = 20;
            const executedInRun = new Set();
            
            // 对于open触发，直接从所有目录数据中提取并执行
            if (reason === 'open') {
                let totalMethods = 0;
                let openMethods = 0;
                
                // 遍历所有.mulu元素获取目录ID
                const allDirElements = document.querySelectorAll('.mulu');
                methodDebugLog('[Sora方法] 开始遍历目录, 总数:', allDirElements.length);
                
                allDirElements.forEach(function(el) {
                    const dirId = el.dataset.dirId;
                    if (!dirId) return;
                    
                    const content = getContent(dirId);
                    if (!content) return;
                    
                    const methodLinks = extractMethodLinksFromHtml(content);
                    methodLinks.forEach(function(methodLink, linkIndex) {
                        const methods = readMethodsFromElement(methodLink);
                        totalMethods += methods.length;
                        for (let m = 0; m < methods.length; m++) {
                            const cfg = methods[m];
                            if (!cfg || typeof cfg !== 'object') continue;
                            if ((cfg.trigger || 'click') !== 'open') continue;
                            openMethods++;
                            const id = ensureMethodId(cfg, m, dirId + '_' + linkIndex);
                            if (cfg.once && id && soraExecutedMethodIds.has(id)) {
                                continue;
                            }

                            let ok = false;
                            soraMethodContextDirId = dirId;
                            try {
                                ok = executeConfiguredMethod(cfg, methodLink);
                            } finally {
                                soraMethodContextDirId = null;
                            }

                            if (ok && cfg.once && id) {
                                soraExecutedMethodIds.add(id);
                            }
                        }
                    });
                });
                
                methodDebugLog('[Sora方法] open触发执行完成, 总方法数:', totalMethods, 'open方法数:', openMethods);
                return;
            }
            
            // 其他触发方式使用级联循环
            for (let pass = 0; pass < maxPasses; pass++) {
                // 在当前显示的目录中查找
                const contentBody = document.getElementById('contentBody');
                if (!contentBody) {
                    methodDebugLog('[Sora方法] contentBody不存在');
                    return;
                }
                const links = Array.from(contentBody.querySelectorAll('a[data-sora-link="method"]'));
                methodDebugLog('[Sora方法] 找到方法链接数量:', links.length);
                
                let anyOk = false;
                for (let i = 0; i < links.length; i++) {
                    const a = links[i];
                    const methods = readMethodsFromElement(a);
                    methodDebugLog('[Sora方法] 链接', i, '方法数:', methods.length, '配置:', methods);
                    if (!methods || methods.length === 0) continue;
                    if (!methods.some(m => (m.trigger || 'click') === reason)) {
                        methodDebugLog('[Sora方法] 链接', i, '没有匹配', reason, '的方法');
                        continue;
                    }
                    const ok = executeMethodsForElement(a, reason, executedInRun);
                    methodDebugLog('[Sora方法] 链接', i, '执行结果:', ok);
                    if (ok) {
                        anyOk = true;
                    }
                }
                if (!anyOk) {
                    methodDebugLog('[Sora方法] 级联结束,没有方法执行');
                    return;
                }
            }
            showExportToast('方法触发次数过多，已停止继续执行');
        }

        function updateReadingProgress() {
            const contentBody = document.getElementById('contentBody');
            const bar = document.getElementById('readingProgressBar');
            if (!contentBody || !bar) return;
            const maximum = Math.max(1, contentBody.scrollHeight - contentBody.clientHeight);
            bar.style.width = Math.max(0, Math.min(100, contentBody.scrollTop / maximum * 100)) + '%';
        }

        function buildContentOutline() {
            const contentBody = document.getElementById('contentBody');
            const menu = document.getElementById('contentOutlineMenu');
            const details = document.getElementById('contentOutline');
            if (!contentBody || !menu || !details) return;
            const headings = Array.from(contentBody.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(function(heading) { return heading.id; });
            menu.innerHTML = '';
            details.hidden = headings.length === 0;
            headings.forEach(function(heading) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = heading.textContent || heading.id;
                button.style.paddingLeft = (8 + (Number(heading.tagName.slice(1)) - 1) * 10) + 'px';
                button.addEventListener('click', function() {
                    heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
                    details.open = false;
                    writeExportRoute(currentDirId, heading.id, 'replace');
                });
                menu.appendChild(button);
            });
        }

        function initReadingTools() {
            const contentBody = document.getElementById('contentBody');
            const readingButton = document.getElementById('readingModeBtn');
            const printButton = document.getElementById('printPageBtn');
            const readingTools = document.getElementById('readingTools');
            if (contentBody) contentBody.addEventListener('scroll', updateReadingProgress, { passive: true });
            if (readingButton) readingButton.addEventListener('click', function() {
                const active = document.body.classList.toggle('reading-mode');
                readingButton.setAttribute('aria-pressed', active ? 'true' : 'false');
                readingButton.textContent = active ? '退出阅读' : '阅读模式';
                if (readingTools) readingTools.open = false;
            });
            if (printButton) printButton.addEventListener('click', function() {
                if (readingTools) readingTools.open = false;
                window.print();
            });
        }

        function readVariableStore(scope) {
            if (scope === 'page') return soraPageVariables;
            const storage = scope === 'local' ? localStorage : sessionStorage;
            try {
                return safeParseJson(storage.getItem('soraDirectoryMethodVariables'), {}) || {};
            } catch (error) {
                return {};
            }
        }

        function writeVariableStore(scope, value) {
            if (scope === 'page') return;
            const storage = scope === 'local' ? localStorage : sessionStorage;
            try {
                storage.setItem('soraDirectoryMethodVariables', JSON.stringify(value));
            } catch (error) {
                console.warn('[Sora方法] 状态保存失败:', error);
            }
        }

        function getMethodVariable(name, scope) {
            const store = readVariableStore(scope || 'session');
            return store[String(name || '')];
        }

        function setMethodVariable(name, value, scope) {
            const actualScope = scope || 'session';
            const store = readVariableStore(actualScope);
            store[String(name || '')] = value;
            writeVariableStore(actualScope, store);
            return value;
        }

        function compareMethodValue(actual, operator, expected) {
            return SoraMethodRuntimeCore.compareValue(actual, operator, expected);
        }

        function evaluateMethodCondition(condition, cfg) {
            const type = condition.type || 'variable';
            let actual = '';
            if (type === 'variable') actual = getMethodVariable(condition.key, condition.scope || 'session');
            if (type === 'execution_count') actual = soraMethodExecutionCounts.get(cfg.methodId) || 0;
            if (type === 'current_dir') actual = currentDirId || '';
            if (type === 'visible') {
                const ref = parseAnchorRef(condition.key);
                const dirId = resolveDirIdFromRef(ref);
                const element = dirId ? document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]') : null;
                actual = !!(element && element.style.display !== 'none' && element.dataset.soraHidden !== 'true');
            }
            if (type === 'checkbox' || type === 'input_value') {
                const key = String(condition.key || '').replace(/^#/, '');
                const element = document.querySelector('#' + escapeCssSelectorValue(key) + ', [name="' + escapeCssSelectorValue(key) + '"]');
                actual = type === 'checkbox' ? !!(element && element.checked) : (element ? element.value : '');
            }
            return compareMethodValue(actual, condition.operator || 'equals', condition.value);
        }

        function evaluateMethodConditions(cfg) {
            return SoraMethodRuntimeCore.evaluateConditions(cfg, function(condition) {
                const type = condition.type || 'variable';
                let actual = '';
                if (type === 'variable') actual = getMethodVariable(condition.key, condition.scope || 'session');
                if (type === 'execution_count') actual = soraMethodExecutionCounts.get(cfg.methodId) || 0;
                if (type === 'current_dir') actual = currentDirId || '';
                if (type === 'visible') {
                    const ref = parseAnchorRef(condition.key);
                    const dirId = resolveDirIdFromRef(ref);
                    const element = dirId ? document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]') : null;
                    actual = !!(element && element.style.display !== 'none' && element.dataset.soraHidden !== 'true');
                }
                if (type === 'checkbox' || type === 'input_value') {
                    const key = String(condition.key || '').replace(/^#/, '');
                    const element = document.querySelector('#' + escapeCssSelectorValue(key) + ', [name="' + escapeCssSelectorValue(key) + '"]');
                    actual = type === 'checkbox' ? !!(element && element.checked) : (element ? element.value : '');
                }
                return actual;
            });
        }

        function recordMethodExecution(cfg, status, detail, durationMs) {
            soraMethodExecutionLog.unshift({
                time: new Date().toLocaleTimeString(),
                methodId: cfg.methodId || '',
                type: cfg.methodType || '',
                trigger: cfg.trigger || 'click',
                status: status,
                durationMs: Math.max(0, Number(durationMs) || 0),
                detail: detail || '',
                dirId: soraMethodContextDirId || currentDirId || ''
            });
            if (soraMethodExecutionLog.length > 100) soraMethodExecutionLog.length = 100;
        }

        function executeMethodArray(methods, executionMode) {
            if (!Array.isArray(methods) || !methods.length) return;
            methods.forEach(function(method, index) {
                const run = function() { executeConfiguredMethod(method, null, index); };
                if (executionMode === 'parallel') setTimeout(run, 0);
                else run();
            });
        }

        function executeConfiguredMethod(cfg, sourceElement) {
            if (!cfg || cfg.enabled === false) return false;
            const id = ensureMethodId(cfg, 0, cfg.methodType || 'method');
            const count = soraMethodExecutionCounts.get(id) || 0;
            if (count >= (Number(cfg.maxExecutions) || (cfg.once ? 1 : 20))) {
                recordMethodExecution(cfg, 'skipped', '已达到最大执行次数');
                return false;
            }
            if (!evaluateMethodConditions(cfg)) {
                recordMethodExecution(cfg, 'skipped', '条件未满足');
                if (cfg.failureMode === 'fallback') executeMethodArray(cfg.elseMethods, cfg.executionMode);
                return false;
            }
            const now = Date.now();
            const throttleMs = Number(cfg.throttleMs) || 0;
            if (throttleMs && now - (soraMethodLastRun.get(id) || 0) < throttleMs) {
                recordMethodExecution(cfg, 'skipped', '节流中');
                return false;
            }
            const run = function() {
                const startedAt = performance.now();
                soraMethodDebounceTimers.delete(id);
                soraMethodLastRun.set(id, Date.now());
                let ok = false;
                const previousContext = soraMethodContextDirId;
                if (cfg._contextDirId) soraMethodContextDirId = cfg._contextDirId;
                try {
                    ok = executeSingleMethod(cfg, sourceElement);
                } catch (error) {
                    console.error('[Sora方法] 执行失败:', error);
                } finally {
                    soraMethodContextDirId = previousContext;
                }
                if (ok) {
                    const nextCount = (soraMethodExecutionCounts.get(id) || 0) + 1;
                    soraMethodExecutionCounts.set(id, nextCount);
                    recordMethodExecution(cfg, 'success', '第 ' + nextCount + ' 次执行', performance.now() - startedAt);
                } else {
                    recordMethodExecution(cfg, 'failed', '动作未完成', performance.now() - startedAt);
                    if (cfg.failureMode === 'fallback') executeMethodArray(cfg.elseMethods, cfg.executionMode);
                }
            };
            const debounceMs = Number(cfg.debounceMs) || 0;
            const delayMs = Number(cfg.delayMs) || 0;
            if (debounceMs) {
                clearTimeout(soraMethodDebounceTimers.get(id));
                soraMethodDebounceTimers.set(id, setTimeout(run, debounceMs + delayMs));
                return true;
            }
            if (delayMs) {
                setTimeout(run, delayMs);
                return true;
            }
            run();
            return true;
        }

        function executeSingleMethod(cfg) {
            if (!cfg || typeof cfg !== 'object') return false;
            const type = cfg.methodType || '';
            methodDebugLog('[Sora方法] 执行单个方法, 类型:', type, '配置:', cfg);
            const result = SoraMethodRuntimeCore.dispatchAction(cfg, soraMethodRuntimeHandlers, function(handler) {
                if (handler === 'change_content') {
                    if (cfg.renameTo && String(cfg.renameTo).trim()) {
                        return executeRenameDirectoryMethod(cfg);
                    }
                    return executeChangeContentMethod(cfg);
                }
                if (handler === 'visibility_hide') return executeVisibilityMethod(cfg, 'hide');
                if (handler === 'visibility_hide_initially_visible') return executeVisibilityMethod(cfg, 'hide_init_visible');
                if (handler === 'visibility_show') return executeVisibilityMethod(cfg, 'show');
                if (handler === 'visibility_toggle') return executeVisibilityMethod(cfg, 'toggle');
                if (handler === 'add_format') return executeAddFormatMethod(cfg);
                if (handler === 'directory_action') return executeDirActionMethod(cfg);
                if (handler === 'navigate') return executeNavigateMethod(cfg, false);
                if (handler === 'navigate_back') return executeNavigateBackMethod();
                if (handler === 'navigate_sibling') return executeNavigateSiblingMethod(cfg);
                if (handler === 'expand_navigate') return executeNavigateMethod(cfg, true);
                if (handler === 'insert_content') return executeInsertContentMethod(cfg);
                if (handler === 'clear_range') return executeClearRangeMethod(cfg, false);
                if (handler === 'delete_range') return executeClearRangeMethod(cfg, true);
                if (handler === 'transfer_range') return executeTransferRangeMethod(cfg);
                if (handler === 'template_content') return executeTemplateContentMethod(cfg);
                if (handler === 'variable_set') return executeVariableMethod(cfg, 'set');
                if (handler === 'variable_adjust') return executeVariableMethod(cfg, 'adjust');
                if (handler === 'variable_toggle') return executeVariableMethod(cfg, 'toggle');
                if (handler === 'state_display') return executeStateDisplayMethod(cfg);
                if (handler === 'toast') {
                    showExportToast(interpolateMethodTemplate(cfg.message || '', cfg), 2500, cfg.tone || 'info');
                    return true;
                }
                if (handler === 'confirm') return executeConfirmMethod(cfg);
                if (handler === 'panel') return executePanelMethod(cfg);
                if (handler === 'component') return executeComponentMethod(cfg);
                if (handler === 'class_control') return executeClassControlMethod(cfg);
                if (handler === 'animation') return executeAnimationMethod(cfg);
                return false;
            });
            if (!result.ok && result.reason === 'unsupported') {
                console.warn('[Sora方法] 未支持的方法类型:', type);
                showExportToast('未支持的方法类型：' + type);
            }
            return result.ok;
        }

        function removeDirFromNameIndex(name, dirId) {
            const key = String(name || '').trim();
            if (!key) return;
            const arr = nameIndex[key];
            if (!arr || arr.length === 0) return;
            const next = arr.filter(id => id !== dirId);
            if (next.length === 0) {
                delete nameIndex[key];
            } else {
                nameIndex[key] = next;
            }
        }

        function addDirToNameIndex(name, dirId) {
            const key = String(name || '').trim();
            if (!key) return;
            if (!nameIndex[key]) nameIndex[key] = [];
            if (!nameIndex[key].includes(dirId)) {
                nameIndex[key].push(dirId);
            }
        }

        async function copyTextToClipboard(text) {
            const val = String(text || '');
            if (!val) return false;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(val);
                    return true;
                }
            } catch (err) {
            }
            return false;
        }

        function getMuluList() {
            return Array.from(document.querySelectorAll('.mulu'));
        }

        function getMuluLevel(el) {
            if (!el) return 0;
            const lvl = parseInt(el.dataset.level, 10);
            return isNaN(lvl) ? 0 : lvl;
        }

        function getMuluNameFromElement(el) {
            if (!el) return '';
            const nameEl = el.querySelector('.mulu-text');
            return (nameEl ? nameEl.textContent : el.textContent).trim();
        }

        function getSubtreeLastIndex(allMulu, startIndex) {
            if (!allMulu || startIndex < 0 || startIndex >= allMulu.length) return startIndex;
            const baseLevel = getMuluLevel(allMulu[startIndex]);
            let last = startIndex;
            for (let i = startIndex + 1; i < allMulu.length; i++) {
                const lvl = getMuluLevel(allMulu[i]);
                if (lvl <= baseLevel) break;
                last = i;
            }
            return last;
        }

        function refreshMuluVisibility() {
            const allMulu = getMuluList();
            const parentVisible = [];
            const parentExpanded = [];
            for (let i = 0; i < allMulu.length; i++) {
                const el = allMulu[i];
                const lvl = getMuluLevel(el);
                const hidden = el.dataset.soraHidden === 'true';
                const expanded = el.classList.contains('expanded');

                let visible = true;
                if (lvl > 0) {
                    const pv = parentVisible[lvl - 1] !== false;
                    const pe = parentExpanded[lvl - 1] === true;
                    visible = pv && pe;
                }
                if (hidden) visible = false;
                el.style.display = visible ? '' : 'none';

                parentVisible[lvl] = visible;
                parentExpanded[lvl] = expanded;
            }
        }

        function updateHasChildrenClass(dirId) {
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) return;
            
            const allMulu = getMuluList();
            const idx = allMulu.indexOf(el);
            if (idx < 0) return;
            
            const level = getMuluLevel(el);
            let hasVisibleChildren = false;
            
            for (let i = idx + 1; i < allMulu.length; i++) {
                const child = allMulu[i];
                const childLevel = getMuluLevel(child);
                
                if (childLevel <= level) break;
                
                if (childLevel === level + 1 && child.dataset.soraHidden !== 'true') {
                    hasVisibleChildren = true;
                    break;
                }
            }
            
            if (hasVisibleChildren) {
                if (!el.classList.contains('has-children')) {
                    el.classList.add('has-children');
                    const toggleIcon = el.querySelector('.toggle-icon');
                    if (!toggleIcon) {
                        const icon = document.createElement('span');
                        icon.className = 'toggle-icon';
                        el.insertBefore(icon, el.firstChild);
                    }
                }
            } else {
                el.classList.remove('has-children', 'expanded');
                const toggleIcon = el.querySelector('.toggle-icon');
                if (toggleIcon) {
                    toggleIcon.remove();
                }
            }
        }

        function updateParentHasChildrenClass(dirId) {
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) return;
            
            const allMulu = getMuluList();
            const idx = allMulu.indexOf(el);
            if (idx < 0) return;
            
            const level = getMuluLevel(el);
            
            for (let i = idx - 1; i >= 0; i--) {
                const parent = allMulu[i];
                const parentLevel = getMuluLevel(parent);
                
                if (parentLevel < level) {
                    updateHasChildrenClass(parent.dataset.dirId);
                    if (parentLevel === 0) break;
                }
            }
        }

        function hideDirectoryTree(dirId) {
            const allMulu = getMuluList();
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) return false;
            const idx = allMulu.indexOf(el);
            if (idx < 0) return false;
            const last = getSubtreeLastIndex(allMulu, idx);
            for (let i = idx; i <= last; i++) {
                allMulu[i].dataset.soraHidden = 'true';
            }
            refreshMuluVisibility();
            updateParentHasChildrenClass(dirId);
            if (currentDirId && currentDirId === dirId) {
                releaseActiveMedia();
                const contentBody = document.getElementById('contentBody');
                if (contentBody) {
                    contentBody.innerHTML = '<div class="empty-state">此目录已隐藏</div>';
                }
                const titleEl = document.getElementById('contentTitle');
                if (titleEl) {
                    titleEl.textContent = '选择一个目录查看内容';
                }
                if (currentSelected) {
                    currentSelected.classList.remove('selected');
                    currentSelected = null;
                }
                currentDirId = null;
            }
            return true;
        }

        function showDirectoryTree(dirId) {
            const allMulu = getMuluList();
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) return false;
            const idx = allMulu.indexOf(el);
            if (idx < 0) return false;
            const last = getSubtreeLastIndex(allMulu, idx);
            for (let i = idx; i <= last; i++) {
                if (allMulu[i].dataset.soraHidden === 'true') {
                    delete allMulu[i].dataset.soraHidden;
                }
            }
            refreshMuluVisibility();
            updateParentHasChildrenClass(dirId);
            return true;
        }

        function toggleDirectoryTree(dirId) {
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) return false;
            const hidden = el.dataset.soraHidden === 'true' || el.style.display === 'none';
            return hidden ? showDirectoryTree(dirId) : hideDirectoryTree(dirId);
        }

        function executeRenameDirectoryMethod(cfg) {
            const frontRef = parseAnchorRef(cfg.frontAnchor);
            if (!frontRef) {
                showExportToast('前锚点无效，无法执行目录重命名');
                return false;
            }
            const dirId = resolveDirIdFromRef(frontRef);
            if (!dirId) {
                showExportToast('未能确定目标目录，无法执行目录重命名');
                return false;
            }
            const newName = String(cfg.renameTo || '').trim();
            if (!newName) {
                showExportToast('目录新名称为空，无法执行目录重命名');
                return false;
            }
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) {
                showExportToast('未找到目标目录，无法执行目录重命名');
                return false;
            }
            const oldName = nameMap[dirId] || getMuluNameFromElement(el);
            const nameEl = el.querySelector('.mulu-text');
            if (nameEl) {
                nameEl.textContent = newName;
            } else {
                el.textContent = newName;
            }
            nameMap[dirId] = newName;
            removeDirFromNameIndex(oldName, dirId);
            addDirToNameIndex(newName, dirId);
            if (currentDirId && currentDirId === dirId) {
                const titleEl = document.getElementById('contentTitle');
                if (titleEl) {
                    titleEl.textContent = newName;
                }
            }
            return true;
        }

        function getRangeWrapperId(dirId, frontId, backId) {
            const key = String(dirId || '') + '|' + String(frontId || '') + '|' + String(backId || '');
            return 'rng_' + stringToHash(key);
        }

        function findRangeWrapper(root, wrapperId) {
            if (!root || !wrapperId) return null;
            return root.querySelector('[data-sora-range-id="' + escapeCssSelectorValue(wrapperId) + '"]');
        }

        function wrapRangeInRoot(root, frontId, backId, wrapperId, initialDisplay) {
            methodDebugLog('[Sora方法] wrapRangeInRoot, frontId:', frontId, 'backId:', backId, 'wrapperId:', wrapperId);
            if (!root) return null;
            const range = document.createRange();
            try {
                if (frontId) {
                    const frontEl = findAnchorElementInRoot(root, frontId);
                    if (!frontEl) {
                        console.error('[Sora方法] 找不到前锚点元素:', frontId);
                        return null;
                    }
                    methodDebugLog('[Sora方法] 找到前锚点:', frontEl);
                    range.setStartAfter(frontEl);
                } else {
                    range.setStart(root, 0);
                }
                if (backId) {
                    const backEl = findAnchorElementInRoot(root, backId);
                    if (!backEl) {
                        console.error('[Sora方法] 找不到后锚点元素:', backId);
                        return null;
                    }
                    methodDebugLog('[Sora方法] 找到后锚点:', backEl);
                    range.setEndBefore(backEl);
                } else {
                    range.setEnd(root, root.childNodes.length);
                }
            } catch (e) {
                console.error('[Sora方法] 创建Range失败:', e);
                return null;
            }
            const frag = range.extractContents();
            const wrapper = document.createElement('span');
            wrapper.setAttribute('data-sora-range-id', wrapperId);
            wrapper.style.display = initialDisplay;
            wrapper.appendChild(frag);
            range.insertNode(wrapper);
            methodDebugLog('[Sora方法] wrapper创建成功, display:', initialDisplay);
            return wrapper;
        }

        function applyRangeDisplay(wrapper, mode) {
            if (!wrapper) return false;
            if (mode === 'hide') {
                wrapper.style.display = 'none';
                return true;
            }
            if (mode === 'show') {
                wrapper.style.display = 'contents';
                return true;
            }
            if (mode === 'toggle') {
                wrapper.style.display = (wrapper.style.display === 'none') ? 'contents' : 'none';
                return true;
            }
            return false;
        }

        function executeVisibilityMethod(cfg, mode) {
            methodDebugLog('[Sora方法] executeVisibilityMethod, mode:', mode, 'frontAnchor:', cfg.frontAnchor, 'backAnchor:', cfg.backAnchor);
            const frontRef = parseAnchorRef(cfg.frontAnchor);
            if (!frontRef) {
                console.error('[Sora方法] 前锚点解析失败:', cfg.frontAnchor);
                showExportToast('前锚点无效，无法执行方法');
                return false;
            }
            methodDebugLog('[Sora方法] 前锚点解析结果:', frontRef);
            const targetDir = resolveDirIdFromRef(frontRef);
            methodDebugLog('[Sora方法] 目标目录:', targetDir, 'currentDirId:', currentDirId);
            if (!targetDir) {
                showExportToast('未能确定目标目录，无法执行方法');
                return false;
            }
            const isRange = !!(cfg.backAnchor && String(cfg.backAnchor).trim());
            methodDebugLog('[Sora方法] 是否范围操作:', isRange);
            if (!isRange) {
                if (mode === 'hide') return hideDirectoryTree(targetDir);
                if (mode === 'show') return showDirectoryTree(targetDir);
                if (mode === 'toggle') return toggleDirectoryTree(targetDir);
                if (mode === 'hide_init_visible') {
                    return showDirectoryTree(targetDir);
                }
                return false;
            }

            const backRef = parseAnchorRef(cfg.backAnchor);
            if (!backRef) {
                showExportToast('后锚点无效，无法执行方法');
                return false;
            }
            const backDirId = resolveDirIdFromRef(backRef);
            if (!backDirId || backDirId !== targetDir) {
                showExportToast('后锚点必须与前锚点在同一目录内');
                return false;
            }

            const frontId = frontRef.anchorId || '';
            const backId = backRef.anchorId || '';
            const wrapperId = getRangeWrapperId(targetDir, frontId, backId);

            const applyInRoot = (root, commit) => {
                let wrapper = findRangeWrapper(root, wrapperId);
                if (!wrapper) {
                    if (mode === 'hide_init_visible') {
                        wrapper = wrapRangeInRoot(root, frontId, backId, wrapperId, 'contents');
                        if (!wrapper) return false;
                        commit(root);
                        return true;
                    }
                    const initial = (mode === 'show') ? 'contents' : 'none';
                    wrapper = wrapRangeInRoot(root, frontId, backId, wrapperId, initial);
                    if (!wrapper) return false;
                    if (mode === 'toggle') {
                        wrapper.style.display = 'none';
                    }
                    commit(root);
                    return true;
                }
                const actualMode = (mode === 'hide_init_visible') ? 'hide' : mode;
                const ok = applyRangeDisplay(wrapper, actualMode);
                if (!ok) return false;
                commit(root);
                return true;
            };

            if (targetDir === currentDirId) {
                const contentBody = document.getElementById('contentBody');
                if (!contentBody) return false;
                const ok = applyInRoot(contentBody, (root) => setDirHtmlById(targetDir, root.innerHTML, true));
                if (!ok) {
                    showExportToast('目标锚点范围无效，无法执行方法');
                }
                return ok;
            }

            const html = getDirHtmlById(targetDir);
            const root = document.createElement('div');
            root.innerHTML = html;
            const ok = applyInRoot(root, (r) => setDirHtmlById(targetDir, r.innerHTML));
            if (!ok) {
                showExportToast('目标锚点范围无效，无法执行方法');
            }
            return ok;
        }

        function buildFormattedHtml(command, innerHtml, value, methods, fallbackText) {
            const cmd = String(command || '').trim();
            const html = String(innerHtml || '');
            if (!cmd) return html;
            if (cmd === 'bold') return '<strong>' + html + '</strong>';
            if (cmd === 'italic') return '<em>' + html + '</em>';
            if (cmd === 'underline') return '<u>' + html + '</u>';
            if (cmd === 'strikethrough') return '<s>' + html + '</s>';
            if (cmd === 'highlight') return '<mark>' + html + '</mark>';
            if (cmd === 'spoiler') return '<spoiler>' + html + '</spoiler>';
            if (cmd === 'superscript') return '<sup>' + html + '</sup>';
            if (cmd === 'subscript') return '<sub>' + html + '</sub>';
            if (cmd === 'code') {
                const div = document.createElement('div');
                div.innerHTML = html;
                return '<code>' + escapeHtml(div.textContent || '') + '</code>';
            }
            if (cmd === 'color') {
                const c = String(value || '').trim();
                if (!c) return html;
                return '<span style="color: ' + escapeHtml(c) + '">' + html + '</span>';
            }
            if (cmd === 'background-color') {
                const c = String(value || '').trim();
                if (!c) return html;
                return '<span style="background-color: ' + escapeHtml(c) + '">' + html + '</span>';
            }
            if (cmd === 'link') {
                const hrefRaw = String(value || '').trim();
                if (!hrefRaw) return html;
                if (!/^(https?:\\/\\/|mailto:|tel:|#|dir:|name:|sora-dir:)/i.test(hrefRaw)) return html;
                const display = html || escapeHtml(hrefRaw);
                if (hrefRaw.startsWith('#')) {
                    const id = normalizeAnchorId(hrefRaw);
                    return '<a href="#' + escapeHtml(id) + '">' + display + '</a>';
                }
                const lower = hrefRaw.toLowerCase();
                const isDir = lower.startsWith('dir:') || lower.startsWith('目录:');
                const isName = lower.startsWith('name:') || lower.startsWith('目录名:');
                if (isDir || isName) {
                    const prefixLen = hrefRaw.indexOf(':') + 1;
                    const rest = hrefRaw.substring(prefixLen);
                    const hashIndex = rest.indexOf('#');
                    const mainPart = (hashIndex >= 0 ? rest.substring(0, hashIndex) : rest).trim();
                    const anchorPartRaw = (hashIndex >= 0 ? rest.substring(hashIndex + 1) : '').trim();
                    const anchorPart = anchorPartRaw ? normalizeAnchorId(anchorPartRaw) : '';
                    const attrs = [];
                    attrs.push('href="sora-dir:' + escapeHtml(mainPart) + (anchorPart ? ('#' + escapeHtml(anchorPart)) : '') + '"');
                    attrs.push('data-sora-link="dir"');
                    if (isDir) {
                        attrs.push('data-dir-id="' + escapeHtml(mainPart) + '"');
                    } else {
                        attrs.push('data-dir-name="' + escapeHtml(mainPart) + '"');
                    }
                    if (anchorPart) {
                        attrs.push('data-anchor-id="' + escapeHtml(anchorPart) + '"');
                    }
                    return '<a ' + attrs.join(' ') + '>' + display + '</a>';
                }
                return '<a href="' + escapeHtml(hrefRaw) + '" target="_blank">' + display + '</a>';
            }
            if (cmd === 'method') {
                const ms = Array.isArray(methods) ? methods : [];
                if (!Array.isArray(ms) || ms.length === 0) {
                    return html;
                }
                const div = document.createElement('div');
                div.innerHTML = html;
                const textContent = String(div.textContent || '').trim();
                const empty = textContent === '';
                let display;
                if (empty) {
                    display = escapeHtml(String(fallbackText || '方法'));
                } else {
                    display = escapeHtml(textContent);
                }
                const methodsJson = escapeHtmlAttr(JSON.stringify(ms));
                return '<a href="#" data-sora-link="method" data-sora-methods="' + methodsJson + '">' + display + '</a>';
            }
            return html;
        }

        function executeAddFormatMethod(cfg) {
            const frontRef = parseAnchorRef(cfg.frontAnchor);
            const backRef = parseAnchorRef(cfg.backAnchor);
            if (!frontRef || !backRef) {
                showExportToast('锚点无效，无法执行添加格式');
                return false;
            }
            const targetDir = resolveDirIdFromRef(frontRef);
            const backDirId = resolveDirIdFromRef(backRef);
            if (!targetDir || !backDirId || targetDir !== backDirId) {
                showExportToast('前后锚点必须在同一目录内');
                return false;
            }
            const frontId = frontRef.anchorId || '';
            const backId = backRef.anchorId || '';
            const cmd = cfg.formatCommand || cfg.formatType || '';
            const value = cfg.formatValue || '';
            const methods = Array.isArray(cfg.formatMethods) ? cfg.formatMethods : [];
            const fallbackText = cfg.formatFallbackText || '';

            const applyInRoot = (root, commit) => {
                const extracted = extractHtmlBetweenAnchors(root, frontId, backId);
                if (extracted === null) return false;
                const formatted = buildFormattedHtml(cmd, extracted, value, methods, fallbackText);
                const ok = replaceHtmlBetweenAnchors(root, frontId, backId, formatted);
                if (!ok) return false;
                commit(root);
                return true;
            };

            if (targetDir === currentDirId) {
                const contentBody = document.getElementById('contentBody');
                if (!contentBody) return false;
                const ok = applyInRoot(contentBody, (root) => setDirHtmlById(targetDir, root.innerHTML, true));
                if (!ok) {
                    showExportToast('目标锚点范围无效，无法执行添加格式');
                }
                return ok;
            }

            const html = getDirHtmlById(targetDir);
            const root = document.createElement('div');
            root.innerHTML = html;
            const ok = applyInRoot(root, (r) => setDirHtmlById(targetDir, r.innerHTML));
            if (!ok) {
                showExportToast('目标锚点范围无效，无法执行添加格式');
            }
            return ok;
        }

        function genNewDirId() {
            let id = 'd_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
            while (document.querySelector('[data-dir-id="' + escapeCssSelectorValue(id) + '"]')) {
                id = 'd_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
            }
            return id;
        }

        const DEFAULT_EXPORTED_DIRECTORY_LEVEL_COLORS = [
            '#F9F9F9', '#F0D6DC', '#DBE8F5', '#DCEBD8',
            '#F3E5C7', '#E7DCF2', '#D7ECE8', '#F1D9C9'
        ];

        function normalizeExportedDirectoryColor(color) {
            const value = String(color || '').trim().toUpperCase();
            return /^#[0-9A-F]{6}$/.test(value) ? value : null;
        }

        function darkenExportedDirectoryColor(color, ratio) {
            const normalized = normalizeExportedDirectoryColor(color) || '#F9F9F9';
            const factor = Math.max(0, Math.min(1, 1 - ratio));
            const channels = [1, 3, 5].map(function(index) {
                return Math.round(parseInt(normalized.slice(index, index + 2), 16) * factor);
            });
            return '#' + channels.map(function(channel) {
                return channel.toString(16).padStart(2, '0');
            }).join('').toUpperCase();
        }

        function getExportedDirectoryTextColor(background) {
            const color = normalizeExportedDirectoryColor(background) || '#F9F9F9';
            const channels = [1, 3, 5].map(function(index) {
                return parseInt(color.slice(index, index + 2), 16) / 255;
            });
            const linear = channels.map(function(channel) {
                return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
            });
            const luminance = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
            return luminance > 0.36 ? '#1F2933' : '#FFFFFF';
        }

        function getDirectoryPaletteForLevel(level) {
            const normalizedLevel = Math.max(0, Math.min(100, parseInt(level, 10) || 0));
            const background = normalizeExportedDirectoryColor(directoryLevelColors[normalizedLevel])
                || DEFAULT_EXPORTED_DIRECTORY_LEVEL_COLORS[normalizedLevel % DEFAULT_EXPORTED_DIRECTORY_LEVEL_COLORS.length];
            const selected = darkenExportedDirectoryColor(background, 0.16);
            return {
                bg: background,
                hover: darkenExportedDirectoryColor(background, 0.08),
                selected: selected,
                text: getExportedDirectoryTextColor(selected)
            };
        }

        function buildMuluElement(dirId, name, level, hasChildren) {
            const el = document.createElement('div');
            el.classList.add('mulu');
            if (hasChildren) {
                el.classList.add('has-children', 'expanded');
            }
            el.dataset.dirId = dirId;
            el.dataset.level = String(level);
            const indent = 20 + (level * 20);
            const palette = getDirectoryPaletteForLevel(level);
            el.style.paddingLeft = indent + 'px';
            el.style.setProperty('--dir-bg', palette.bg);
            el.style.setProperty('--dir-hover-bg', palette.hover);
            el.style.setProperty('--dir-selected-bg', palette.selected);
            el.style.setProperty('--dir-text', palette.text);

            const toggleIcon = hasChildren
                ? '<span class="toggle-icon"></span>'
                : '<span class="bullet-icon"></span>';
            el.innerHTML = toggleIcon + '<span class="mulu-text">' + escapeHtml(String(name || '未命名')) + '</span>';
            return el;
        }

        function copyDirectoryDataFromDom(dirId, includeChildren) {
            const allMulu = getMuluList();
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) return null;
            const idx = allMulu.indexOf(el);
            if (idx < 0) return null;
            const baseLevel = getMuluLevel(el);

            const node = {
                name: nameMap[dirId] || getMuluNameFromElement(el) || '未命名',
                content: getDirHtmlById(dirId) || '',
                children: []
            };
            if (!includeChildren) return node;

            for (let i = idx + 1; i < allMulu.length; i++) {
                const lvl = getMuluLevel(allMulu[i]);
                if (lvl <= baseLevel) break;
                if (lvl === baseLevel + 1) {
                    const childId = allMulu[i].dataset.dirId;
                    if (childId) {
                        const child = copyDirectoryDataFromDom(childId, true);
                        if (child) node.children.push(child);
                    }
                    i = getSubtreeLastIndex(allMulu, i);
                }
            }
            return node;
        }

        function pasteDirectoryDataAfterDir(dirData, afterDirId) {
            if (!dirData || typeof dirData !== 'object') return null;
            const allMulu = getMuluList();
            const afterEl = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(afterDirId) + '"]');
            if (!afterEl) return null;
            const afterIndex = allMulu.indexOf(afterEl);
            if (afterIndex < 0) return null;
            const insertAfterIndex = getSubtreeLastIndex(allMulu, afterIndex);
            const refNode = allMulu[insertAfterIndex];
            const container = refNode.parentNode;
            const nextSibling = refNode.nextSibling;
            const baseLevel = getMuluLevel(afterEl);
            const created = [];
            const createdIds = [];

            function createSubtree(node, level) {
                const newDirId = genNewDirId();
                const children = Array.isArray(node.children) ? node.children : [];
                const el = buildMuluElement(newDirId, String(node.name || '未命名'), level, children.length > 0);
                created.push(el);
                createdIds.push(newDirId);
                nameMap[newDirId] = String(node.name || '未命名');
                addDirToNameIndex(String(node.name || '未命名'), newDirId);
                contentCache[newDirId] = String(node.content || '');

                for (let i = 0; i < children.length; i++) {
                    createSubtree(children[i], level + 1);
                }
                return newDirId;
            }

            const newTopId = createSubtree(dirData, baseLevel);
            for (let i = 0; i < created.length; i++) {
                container.insertBefore(created[i], nextSibling);
            }
            refreshMuluVisibility();
            return newTopId;
        }

        function deleteDirectoryFromDom(dirId) {
            const allMulu = getMuluList();
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) return false;
            const idx = allMulu.indexOf(el);
            if (idx < 0) return false;
            const last = getSubtreeLastIndex(allMulu, idx);
            const removedIds = [];
            for (let i = idx; i <= last; i++) {
                const id = allMulu[i].dataset.dirId;
                if (id) removedIds.push(id);
            }
            for (let i = last; i >= idx; i--) {
                allMulu[i].remove();
            }
            for (let i = 0; i < removedIds.length; i++) {
                const id = removedIds[i];
                const nm = nameMap[id];
                if (nm) removeDirFromNameIndex(nm, id);
                delete nameMap[id];
                delete contentCache[id];
            }
            refreshMuluVisibility();
            if (currentDirId && removedIds.includes(currentDirId)) {
                releaseActiveMedia();
                const contentBody = document.getElementById('contentBody');
                if (contentBody) {
                    contentBody.innerHTML = '<div class="empty-state">点击左侧目录查看内容</div>';
                }
                const titleEl = document.getElementById('contentTitle');
                if (titleEl) {
                    titleEl.textContent = '选择一个目录查看内容';
                }
                if (currentSelected) {
                    currentSelected.classList.remove('selected');
                    currentSelected = null;
                }
                currentDirId = null;
            }
            return true;
        }

        function setExpandedRecursively(dirId, expanded) {
            const allMulu = getMuluList();
            const el = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!el) return false;
            const idx = allMulu.indexOf(el);
            if (idx < 0) return false;
            const last = getSubtreeLastIndex(allMulu, idx);
            for (let i = idx; i <= last; i++) {
                const node = allMulu[i];
                if (node.classList.contains('has-children')) {
                    if (expanded) node.classList.add('expanded');
                    else node.classList.remove('expanded');
                    node.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                }
            }
            refreshMuluVisibility();
            return true;
        }

        function executeDirActionMethod(cfg) {
            const frontRef = parseAnchorRef(cfg.frontAnchor);
            if (!frontRef) {
                showExportToast('前锚点无效，无法执行目录动作');
                return false;
            }
            const targetDir = resolveDirIdFromRef(frontRef);
            if (!targetDir) {
                showExportToast('未能确定目标目录，无法执行目录动作');
                return false;
            }
            const action = String(cfg.dirAction || '').trim();
            if (!action) {
                showExportToast('目录动作未设置');
                return false;
            }

            if (action === '复制目录ID') {
                copyTextToClipboard(targetDir).then(ok => {
                    showExportToast(ok ? ('已复制目录ID：' + targetDir) : '复制失败，请手动复制');
                });
                return true;
            }
            if (action === '删除目录') {
                showExportChoice('是否删除此目录？此操作不可撤销。', function() {
                    const ok = deleteDirectoryFromDom(targetDir);
                    showExportToast(ok ? '目录已删除' : '删除失败：未找到目标目录');
                });
                return true;
            }
            if (action === '复制目录（含子目录）') {
                const data = copyDirectoryDataFromDom(targetDir, true);
                if (!data) {
                    showExportToast('复制失败：未找到目标目录');
                    return false;
                }
                soraDirClipboard = { data, includeChildren: true };
                showExportToast('已复制目录（含子目录）');
                return true;
            }
            if (action === '复制目录（不含子目录）') {
                const data = copyDirectoryDataFromDom(targetDir, false);
                if (!data) {
                    showExportToast('复制失败：未找到目标目录');
                    return false;
                }
                soraDirClipboard = { data, includeChildren: false };
                showExportToast('已复制目录（不含子目录）');
                return true;
            }
            if (action === '粘贴目录') {
                if (!soraDirClipboard || !soraDirClipboard.data) {
                    showExportToast('剪贴板为空，请先复制目录');
                    return false;
                }
                const newId = pasteDirectoryDataAfterDir(soraDirClipboard.data, targetDir);
                if (!newId) {
                    showExportToast('粘贴失败');
                    return false;
                }
                showExportToast('已粘贴目录' + (soraDirClipboard.includeChildren ? '（含子目录）' : ''));
                return true;
            }
            if (action === '快速复制目录（含子目录）') {
                const data = copyDirectoryDataFromDom(targetDir, true);
                if (!data) {
                    showExportToast('快速复制失败：未找到目标目录');
                    return false;
                }
                soraDirClipboard = { data, includeChildren: true };
                const newId = pasteDirectoryDataAfterDir(data, targetDir);
                if (!newId) {
                    showExportToast('快速复制失败：粘贴失败');
                    return false;
                }
                showExportToast('已快速复制目录（含子目录）');
                return true;
            }
            if (action === '快速复制目录（不含子目录）') {
                const data = copyDirectoryDataFromDom(targetDir, false);
                if (!data) {
                    showExportToast('快速复制失败：未找到目标目录');
                    return false;
                }
                soraDirClipboard = { data, includeChildren: false };
                const newId = pasteDirectoryDataAfterDir(data, targetDir);
                if (!newId) {
                    showExportToast('快速复制失败：粘贴失败');
                    return false;
                }
                showExportToast('已快速复制目录（不含子目录）');
                return true;
            }
            if (action === '展开此目录') {
                const ok = setExpandedRecursively(targetDir, true);
                if (!ok) {
                    showExportToast('展开失败');
                    return false;
                }
                return true;
            }
            if (action === '收起此目录') {
                const ok = setExpandedRecursively(targetDir, false);
                if (!ok) {
                    showExportToast('收起失败');
                    return false;
                }
                return true;
            }

            showExportToast('未支持的目录动作：' + action);
            return false;
        }

        function executeChangeContentMethod(cfg) {
            const targetFrontRef = parseAnchorRef(cfg.frontAnchor);
            if (!targetFrontRef) {
                showExportToast('前锚点无效，无法执行更换内容');
                return false;
            }
            const targetDir = resolveDirIdFromRef(targetFrontRef);
            if (!targetDir) {
                showExportToast('未能确定目标目录，无法执行更换内容');
                return false;
            }

            const targetBackRef = parseAnchorRef(cfg.backAnchor);
            if (cfg.backAnchor && targetBackRef) {
                const backDirId = resolveDirIdFromRef(targetBackRef);
                if (backDirId && backDirId !== targetDir) {
                    showExportToast('后锚点必须与前锚点在同一目录内');
                    return false;
                }
            }

            let replacementHtml = '';
            if (cfg.replaceSourceType === 'text') {
                replacementHtml = escapeHtml(cfg.replaceText || '');
            } else {
                const srcFrontRef = parseAnchorRef(cfg.replaceFromFrontAnchor);
                if (!srcFrontRef) {
                    showExportToast('替换来源前锚点无效，无法执行更换内容');
                    return false;
                }
                const srcDir = resolveDirIdFromRef(srcFrontRef);
                if (!srcDir) {
                    showExportToast('未能确定替换来源目录，无法执行更换内容');
                    return false;
                }
                const srcBackRef = parseAnchorRef(cfg.replaceFromBackAnchor);
                if (cfg.replaceFromBackAnchor && srcBackRef) {
                    const backDirId = resolveDirIdFromRef(srcBackRef);
                    if (backDirId && backDirId !== srcDir) {
                        showExportToast('替换来源后锚点必须与前锚点在同一目录内');
                        return false;
                    }
                }
                const srcHtml = getDirHtmlById(srcDir);
                const srcRoot = document.createElement('div');
                srcRoot.innerHTML = srcHtml;
                const extracted = extractHtmlBetweenAnchors(
                    srcRoot,
                    srcFrontRef.anchorId || '',
                    srcBackRef && srcBackRef.anchorId ? srcBackRef.anchorId : ''
                );
                if (extracted === null) {
                    showExportToast('无法从替换来源锚点范围提取内容');
                    return false;
                }
                replacementHtml = extracted;
            }

            if (targetDir === currentDirId) {
                const contentBody = document.getElementById('contentBody');
                if (!contentBody) return false;
                const ok = replaceHtmlBetweenAnchors(
                    contentBody,
                    targetFrontRef.anchorId || '',
                    targetBackRef && targetBackRef.anchorId ? targetBackRef.anchorId : '',
                    replacementHtml
                );
                if (!ok) {
                    showExportToast('目标锚点范围无效，无法执行更换内容');
                    return false;
                }
                setDirHtmlById(targetDir, contentBody.innerHTML, true);
                return true;
            }

            const targetHtml = getDirHtmlById(targetDir);
            const targetRoot = document.createElement('div');
            targetRoot.innerHTML = targetHtml;
            const ok = replaceHtmlBetweenAnchors(
                targetRoot,
                targetFrontRef.anchorId || '',
                targetBackRef && targetBackRef.anchorId ? targetBackRef.anchorId : '',
                replacementHtml
            );
            if (!ok) {
                showExportToast('目标锚点范围无效，无法执行更换内容');
                return false;
            }
            setDirHtmlById(targetDir, targetRoot.innerHTML);
            return true;
        }

        function resolveMethodTarget(cfg) {
            const frontRef = parseAnchorRef(cfg.frontAnchor);
            if (!frontRef) return null;
            const dirId = resolveDirIdFromRef(frontRef);
            if (!dirId) return null;
            const backRef = cfg.backAnchor ? parseAnchorRef(cfg.backAnchor) : null;
            if (backRef && resolveDirIdFromRef(backRef) !== dirId) return null;
            return {
                dirId: dirId,
                frontId: frontRef.anchorId || '',
                backId: backRef && backRef.anchorId ? backRef.anchorId : ''
            };
        }

        function mutateMethodTarget(cfg, callback) {
            const target = resolveMethodTarget(cfg);
            if (!target) {
                showExportToast('目标目录或锚点无效');
                return false;
            }
            const root = target.dirId === currentDirId
                ? document.getElementById('contentBody')
                : document.createElement('div');
            if (!root) return false;
            if (target.dirId !== currentDirId) root.innerHTML = getDirHtmlById(target.dirId);
            const ok = callback(root, target);
            if (!ok) return false;
            setDirHtmlById(target.dirId, root.innerHTML, target.dirId === currentDirId);
            return true;
        }

        function executeNavigateMethod(cfg, expand) {
            const target = resolveMethodTarget(cfg);
            if (!target) {
                showExportToast('跳转目标无效');
                return false;
            }
            if (expand) expandDirectoryAncestors(target.dirId);
            selectDirectory(target.dirId, false, {
                viewMode: target.frontId ? 'top' : 'restore',
                anchorId: target.frontId || ''
            });
            return true;
        }

        function executeNavigateBackMethod() {
            const previous = soraDirectoryHistory.pop();
            if (!previous) {
                showExportToast('没有上一浏览位置');
                return false;
            }
            soraHistoryNavigation = true;
            try {
                selectDirectory(previous, false, { viewMode: 'restore' });
            } finally {
                soraHistoryNavigation = false;
            }
            return true;
        }

        function executeNavigateSiblingMethod(cfg) {
            const current = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(currentDirId) + '"]');
            if (!current) return false;
            const all = getMuluList();
            const level = getMuluLevel(current);
            const parentId = current.dataset.parentId || '';
            const siblings = all.filter(function(element) {
                return getMuluLevel(element) === level && (element.dataset.parentId || '') === parentId;
            });
            const index = siblings.indexOf(current);
            const nextIndex = cfg.siblingDirection === 'previous' ? index - 1 : index + 1;
            if (nextIndex < 0 || nextIndex >= siblings.length) {
                showExportToast(cfg.siblingDirection === 'previous' ? '已经是第一个同级目录' : '已经是最后一个同级目录');
                return false;
            }
            selectDirectory(siblings[nextIndex].dataset.dirId, false, { viewMode: 'restore' });
            return true;
        }

        function expandDirectoryAncestors(dirId) {
            const all = getMuluList();
            let target = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!target) return;
            let level = getMuluLevel(target);
            let index = all.indexOf(target) - 1;
            while (level > 0 && index >= 0) {
                const candidate = all[index];
                if (getMuluLevel(candidate) === level - 1) {
                    candidate.classList.add('expanded');
                    candidate.setAttribute('aria-expanded', 'true');
                    level--;
                }
                index--;
            }
            refreshMuluVisibility();
        }

        function interpolateMethodTemplate(value, cfg) {
            const text = String(value || '');
            return text.replace(/\\{\\{([^{}]+)\\}\\}/g, function(match, key) {
                const name = String(key || '').trim();
                if (name === '目录名') return nameMap[currentDirId] || '';
                if (name === '日期') return new Date().toLocaleDateString();
                if (name === '时间') return new Date().toLocaleTimeString();
                const variable = getMethodVariable(name, (cfg && cfg.variableScope) || 'session');
                return variable === undefined ? '' : String(variable);
            });
        }

        function extractMethodSourceHtml(frontValue, backValue) {
            const front = parseAnchorRef(frontValue);
            if (!front) return null;
            const dirId = resolveDirIdFromRef(front);
            if (!dirId) return null;
            const back = backValue ? parseAnchorRef(backValue) : null;
            if (back && resolveDirIdFromRef(back) !== dirId) return null;
            const root = document.createElement('div');
            root.innerHTML = getDirHtmlById(dirId);
            return extractHtmlBetweenAnchors(root, front.anchorId || '', back && back.anchorId ? back.anchorId : '');
        }

        function getInsertionHtml(cfg) {
            if (cfg.contentSourceType === 'reference') {
                return extractMethodSourceHtml(cfg.contentFrontAnchor, cfg.contentBackAnchor);
            }
            const content = interpolateMethodTemplate(cfg.contentText || '', cfg);
            return escapeHtml(content).replace(/\\n/g, '<br>');
        }

        function executeInsertContentMethod(cfg) {
            const insertion = getInsertionHtml(cfg);
            if (insertion === null) {
                showExportToast('插入内容来源无效');
                return false;
            }
            return mutateMethodTarget(cfg, function(root, target) {
                const front = target.frontId ? findAnchorElementInRoot(root, target.frontId) : null;
                const back = target.backId ? findAnchorElementInRoot(root, target.backId) : null;
                const holder = document.createElement('div');
                holder.innerHTML = insertion;
                const fragment = document.createDocumentFragment();
                while (holder.firstChild) fragment.appendChild(holder.firstChild);
                const position = cfg.insertPosition || 'after';
                if (position === 'before' && front) front.before(fragment);
                else if (position === 'after' && back) back.after(fragment);
                else if (position === 'start' && front) front.after(fragment);
                else if (position === 'end' && back) back.before(fragment);
                else root.appendChild(fragment);
                return true;
            });
        }

        function executeClearRangeMethod(cfg, removeAnchors) {
            return mutateMethodTarget(cfg, function(root, target) {
                if (!target.frontId || !target.backId) return false;
                const front = findAnchorElementInRoot(root, target.frontId);
                const back = findAnchorElementInRoot(root, target.backId);
                if (!front || !back) return false;
                const ok = replaceHtmlBetweenAnchors(root, target.frontId, target.backId, '');
                if (ok && removeAnchors) {
                    front.remove();
                    back.remove();
                }
                return ok;
            });
        }

        function executeTransferRangeMethod(cfg) {
            const source = resolveMethodTarget(cfg);
            const destinationCfg = { frontAnchor: cfg.destinationFrontAnchor, backAnchor: cfg.destinationBackAnchor };
            const destination = resolveMethodTarget(destinationCfg);
            if (!source || !destination || !source.frontId || !source.backId || !destination.frontId || !destination.backId) {
                showExportToast('传送范围的来源或目标无效');
                return false;
            }
            const sourceHtml = extractMethodSourceHtml(cfg.frontAnchor, cfg.backAnchor);
            const destinationHtml = extractMethodSourceHtml(cfg.destinationFrontAnchor, cfg.destinationBackAnchor);
            if (sourceHtml === null || destinationHtml === null) return false;
            const replaceDestination = mutateMethodTarget(destinationCfg, function(root, target) {
                return replaceHtmlBetweenAnchors(root, target.frontId, target.backId, sourceHtml);
            });
            if (!replaceDestination) return false;
            if (cfg.transferMode === 'move' || cfg.transferMode === 'swap') {
                return mutateMethodTarget(cfg, function(root, target) {
                    return replaceHtmlBetweenAnchors(root, target.frontId, target.backId, cfg.transferMode === 'swap' ? destinationHtml : '');
                });
            }
            return true;
        }

        function executeTemplateContentMethod(cfg) {
            const html = escapeHtml(interpolateMethodTemplate(cfg.templateText || '', cfg)).replace(/\\n/g, '<br>');
            return mutateMethodTarget(cfg, function(root, target) {
                return replaceHtmlBetweenAnchors(root, target.frontId, target.backId, html);
            });
        }

        function executeVariableMethod(cfg, operation) {
            const name = String(cfg.variableName || '').trim();
            if (!name) return false;
            const scope = cfg.variableScope || 'session';
            const current = getMethodVariable(name, scope);
            let value = cfg.variableValue;
            if (operation === 'adjust') value = (Number(current) || 0) + (Number(cfg.variableDelta) || 0);
            if (operation === 'toggle') value = !Boolean(current);
            if (operation === 'set') {
                if (cfg.variableType === 'number') value = Number(value) || 0;
                if (cfg.variableType === 'boolean') value = value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
            }
            setMethodVariable(name, value, scope);
            return true;
        }

        function executeStateDisplayMethod(cfg) {
            const value = getMethodVariable(cfg.variableName, cfg.variableScope || 'session');
            let html = '<span class="sora-state-value">' + escapeHtml(value === undefined ? '' : value) + '</span>';
            if (cfg.stateDisplayType === 'counter') html = '<span class="sora-state-counter">' + escapeHtml(value || 0) + '</span>';
            if (cfg.stateDisplayType === 'progress') {
                const number = Math.max(0, Math.min(100, Number(value) || 0));
                html = '<progress max="100" value="' + number + '">' + number + '%</progress>';
            }
            if (cfg.stateDisplayType === 'complete') html = value ? '<span class="sora-state-complete">✓ 已完成</span>' : '<span class="sora-state-pending">未完成</span>';
            if (!cfg.frontAnchor) {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                showExportToast(temp.textContent || '');
                return true;
            }
            return mutateMethodTarget(cfg, function(root, target) {
                return replaceHtmlBetweenAnchors(root, target.frontId, target.backId, html);
            });
        }

        function ensureExportDialog() {
            let overlay = document.getElementById('soraMethodDialog');
            if (overlay) return overlay;
            overlay = document.createElement('div');
            overlay.id = 'soraMethodDialog';
            overlay.className = 'sora-method-dialog-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = '<section class="sora-method-dialog" role="dialog" aria-modal="true" aria-labelledby="soraMethodDialogTitle"><h2 class="sr-only" id="soraMethodDialogTitle">交互提示</h2><button type="button" class="sora-method-dialog-close" aria-label="关闭">×</button><div class="sora-method-dialog-content"></div><div class="sora-method-dialog-actions"></div></section>';
            document.body.appendChild(overlay);
            overlay._soraClose = function(runDismiss) {
                if (!overlay.classList.contains('active')) return;
                overlay.classList.remove('active');
                overlay.setAttribute('aria-hidden', 'true');
                if (runDismiss && typeof overlay._soraOnDismiss === 'function') overlay._soraOnDismiss();
                overlay._soraOnDismiss = null;
                const target = overlay._soraReturnFocus;
                overlay._soraReturnFocus = null;
                if (target && target.isConnected && typeof target.focus === 'function') target.focus();
            };
            overlay._soraOpen = function(title, onDismiss) {
                overlay._soraReturnFocus = document.activeElement;
                overlay._soraOnDismiss = onDismiss || null;
                overlay.querySelector('#soraMethodDialogTitle').textContent = title || '交互提示';
                overlay.setAttribute('aria-hidden', 'false');
                overlay.classList.add('active');
                requestAnimationFrame(function() {
                    const focusTarget = overlay.querySelector('.primary, .sora-method-dialog-actions button, .sora-method-dialog-close');
                    if (focusTarget) focusTarget.focus();
                });
            };
            overlay.querySelector('.sora-method-dialog-close').addEventListener('click', function() { overlay._soraClose(true); });
            overlay.addEventListener('click', function(event) { if (event.target === overlay) overlay._soraClose(true); });
            overlay.addEventListener('keydown', function(event) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    overlay._soraClose(true);
                    return;
                }
                if (event.key !== 'Tab') return;
                const focusable = Array.from(overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(function(item) {
                    return !item.disabled && item.offsetParent !== null;
                });
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            });
            return overlay;
        }

        function showExportChoice(message, onConfirm, onCancel) {
            const overlay = ensureExportDialog();
            overlay.querySelector('.sora-method-dialog').className = 'sora-method-dialog';
            overlay.querySelector('.sora-method-dialog-content').textContent = String(message || '请确认');
            const actions = overlay.querySelector('.sora-method-dialog-actions');
            actions.innerHTML = '<button type="button" data-choice="cancel">取消</button><button type="button" data-choice="confirm" class="primary">确认</button>';
            actions.onclick = function(event) {
                const button = event.target.closest('[data-choice]');
                if (!button) return;
                overlay._soraClose(false);
                if (button.dataset.choice === 'confirm') {
                    if (onConfirm) onConfirm();
                } else if (onCancel) onCancel();
            };
            overlay._soraOpen('请确认', onCancel);
        }

        function executeConfirmMethod(cfg) {
            const overlay = ensureExportDialog();
            showExportChoice(interpolateMethodTemplate(cfg.message || '是否继续？', cfg), function() {
                executeMethodArray(cfg.confirmMethods, cfg.executionMode);
            }, function() {
                executeMethodArray(cfg.cancelMethods, cfg.executionMode);
            });
            const timeout = Number(cfg.confirmTimeoutMs) || 0;
            if (timeout > 0) {
                setTimeout(function() {
                    if (!overlay.classList.contains('active')) return;
                    overlay._soraClose(false);
                    executeMethodArray(cfg.confirmDefault === 'confirm' ? cfg.confirmMethods : cfg.cancelMethods, cfg.executionMode);
                }, timeout);
            }
            return true;
        }

        function executePanelMethod(cfg) {
            const overlay = ensureExportDialog();
            overlay.querySelector('.sora-method-dialog').className = 'sora-method-dialog mode-' + (cfg.panelMode || 'modal');
            overlay.querySelector('.sora-method-dialog-content').textContent = interpolateMethodTemplate(cfg.message || '', cfg);
            overlay.querySelector('.sora-method-dialog-actions').innerHTML = '<button type="button" data-close-panel>关闭</button>';
            overlay.querySelector('[data-close-panel]').onclick = function() { overlay._soraClose(false); };
            overlay._soraOpen('内容面板');
            return true;
        }

        function executeComponentMethod(cfg) {
            return mutateMethodTarget(cfg, function(root, target) {
                const content = extractHtmlBetweenAnchors(root, target.frontId, target.backId);
                if (content === null) return false;
                const label = escapeHtml(cfg.componentLabel || '内容');
                let html = '';
                if (cfg.componentType === 'collapse') html = '<details class="sora-component"><summary>' + label + '</summary><div>' + content + '</div></details>';
                else if (cfg.componentType === 'progress') html = '<div class="sora-component"><label>' + label + '</label><progress max="100" value="0">0%</progress></div>';
                else if (cfg.componentType === 'input') html = '<label class="sora-component">' + label + '<input type="text"></label>';
                else if (cfg.componentType === 'radio') html = '<label class="sora-component"><input type="radio" name="sora-' + stringToHash(label) + '"> ' + label + '</label>';
                else if (cfg.componentType === 'checkbox') html = '<label class="sora-component"><input type="checkbox"> ' + label + '</label>';
                else if (cfg.componentType === 'tabs') html = buildTabsComponent(label, content);
                else if (cfg.componentType === 'faq') html = buildFaqComponent(label, content);
                else if (cfg.componentType === 'gallery') html = buildGalleryComponent(label, content);
                else html = buildStepsComponent(label, content);
                return replaceHtmlBetweenAnchors(root, target.frontId, target.backId, html);
            });
        }

        function componentSegments(content) {
            const holder = document.createElement('div');
            holder.innerHTML = content;
            const segments = [];
            let current = null;
            Array.from(holder.childNodes).forEach(function(node) {
                if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(node.tagName)) {
                    current = { title: node.textContent || '内容', html: '' };
                    segments.push(current);
                    return;
                }
                if (!current) {
                    current = { title: '内容', html: '' };
                    segments.push(current);
                }
                const box = document.createElement('div');
                box.appendChild(node.cloneNode(true));
                current.html += box.innerHTML;
            });
            return segments.length ? segments : [{ title: '内容', html: content }];
        }

        function buildTabsComponent(label, content) {
            const segments = componentSegments(content);
            const base = 'sora-tabs-' + stringToHash(label + content.length + Date.now());
            const tabs = segments.map(function(segment, index) {
                return '<button type="button" role="tab" aria-selected="' + (index === 0 ? 'true' : 'false') + '" aria-controls="' + base + '-panel-' + index + '" id="' + base + '-tab-' + index + '" tabindex="' + (index === 0 ? '0' : '-1') + '">' + escapeHtml(segment.title) + '</button>';
            }).join('');
            const panels = segments.map(function(segment, index) {
                return '<section role="tabpanel" id="' + base + '-panel-' + index + '" aria-labelledby="' + base + '-tab-' + index + '"' + (index === 0 ? '' : ' hidden') + '>' + segment.html + '</section>';
            }).join('');
            return '<section class="sora-component sora-component-tabs" aria-label="' + escapeHtmlAttr(label) + '"><div role="tablist">' + tabs + '</div>' + panels + '</section>';
        }

        function buildStepsComponent(label, content) {
            const segments = componentSegments(content);
            return '<section class="sora-component"><h3>' + label + '</h3><ol class="sora-component-steps">' + segments.map(function(segment) { return '<li><strong>' + escapeHtml(segment.title) + '</strong><div>' + segment.html + '</div></li>'; }).join('') + '</ol></section>';
        }

        function buildFaqComponent(label, content) {
            const segments = componentSegments(content);
            return '<section class="sora-component"><h3>' + label + '</h3><div class="sora-component-faq">' + segments.map(function(segment) { return '<details><summary>' + escapeHtml(segment.title) + '</summary><div>' + segment.html + '</div></details>'; }).join('') + '</div></section>';
        }

        function buildGalleryComponent(label, content) {
            const holder = document.createElement('div');
            holder.innerHTML = content;
            const items = Array.from(holder.querySelectorAll('figure, img')).filter(function(item) { return !item.closest('figure') || item.matches('figure'); });
            return '<section class="sora-component"><h3>' + label + '</h3><div class="sora-component-gallery">' + items.map(function(item) { return item.outerHTML; }).join('') + '</div></section>';
        }

        function initComponentInteractions() {
            document.addEventListener('click', function(event) {
                const tab = event.target.closest('.sora-component-tabs [role="tab"]');
                if (!tab) return;
                const tablist = tab.closest('[role="tablist"]');
                const component = tab.closest('.sora-component-tabs');
                tablist.querySelectorAll('[role="tab"]').forEach(function(item) {
                    const active = item === tab;
                    item.setAttribute('aria-selected', active ? 'true' : 'false');
                    item.setAttribute('tabindex', active ? '0' : '-1');
                    const panel = component.querySelector('#' + escapeCssSelectorValue(item.getAttribute('aria-controls')));
                    if (panel) panel.hidden = !active;
                });
            });
            document.addEventListener('keydown', function(event) {
                const tab = event.target.closest && event.target.closest('.sora-component-tabs [role="tab"]');
                if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const tabs = Array.from(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
                let index = tabs.indexOf(tab);
                if (event.key === 'Home') index = 0;
                else if (event.key === 'End') index = tabs.length - 1;
                else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                event.preventDefault();
                tabs[index].focus();
                tabs[index].click();
            });
        }

        function wrapTargetWithClass(cfg, className, dataAttribute) {
            return mutateMethodTarget(cfg, function(root, target) {
                const id = getRangeWrapperId(target.dirId, target.frontId, target.backId);
                let wrapper = findRangeWrapper(root, id);
                if (!wrapper) wrapper = wrapRangeInRoot(root, target.frontId, target.backId, id, 'contents');
                if (!wrapper) return false;
                if (dataAttribute) wrapper.setAttribute(dataAttribute.name, dataAttribute.value);
                wrapper.classList.add(className);
                return true;
            });
        }

        function executeClassControlMethod(cfg) {
            const token = 'sora-style-' + String(cfg.classToken || 'accent').replace(/[^a-z0-9_-]/gi, '');
            return mutateMethodTarget(cfg, function(root, target) {
                const id = getRangeWrapperId(target.dirId, target.frontId, target.backId);
                let wrapper = findRangeWrapper(root, id);
                if (!wrapper) wrapper = wrapRangeInRoot(root, target.frontId, target.backId, id, 'contents');
                if (!wrapper) return false;
                if (cfg.classOperation === 'add') wrapper.classList.add(token);
                else if (cfg.classOperation === 'remove') wrapper.classList.remove(token);
                else wrapper.classList.toggle(token);
                return true;
            });
        }

        function executeAnimationMethod(cfg) {
            const name = String(cfg.animationName || 'fade').replace(/[^a-z0-9_-]/gi, '');
            return wrapTargetWithClass(cfg, 'sora-animation-' + name, { name: 'data-sora-animate', value: String(Date.now()) });
        }

        function parseAnchorRef(input) {
            const trimmed = String(input || '').trim();
            if (!trimmed) return null;
            const lower = trimmed.toLowerCase();
            const build = (dirId, dirName, anchorId) => {
                const aid = anchorId ? normalizeAnchorId(anchorId) : '';
                return {
                    dirId: dirId || null,
                    dirName: dirName || null,
                    anchorId: aid || ''
                };
            };
            if (lower.startsWith('dir:') || lower.startsWith('目录:')) {
                const prefixLen = trimmed.indexOf(':') + 1;
                const rest = trimmed.substring(prefixLen);
                const hashIndex = rest.indexOf('#');
                const mainPart = (hashIndex >= 0 ? rest.substring(0, hashIndex) : rest).trim();
                const anchorPart = (hashIndex >= 0 ? rest.substring(hashIndex + 1) : '').trim();
                return build(mainPart, null, anchorPart);
            }
            if (lower.startsWith('name:') || lower.startsWith('目录名:')) {
                const prefixLen = trimmed.indexOf(':') + 1;
                const rest = trimmed.substring(prefixLen);
                const hashIndex = rest.indexOf('#');
                const mainPart = (hashIndex >= 0 ? rest.substring(0, hashIndex) : rest).trim();
                const anchorPart = (hashIndex >= 0 ? rest.substring(hashIndex + 1) : '').trim();
                return build(null, mainPart, anchorPart);
            }
            if (trimmed.startsWith('#')) {
                return build(null, null, trimmed.substring(1));
            }
            return build(null, null, trimmed);
        }

        function resolveDirIdFromRef(ref) {
            if (!ref) return null;
            if (ref.dirId) return ref.dirId;
            if (ref.dirName) {
                return resolveDirIdFromName(ref.dirName);
            }
            return soraMethodContextDirId || currentDirId;
        }

        function getDirHtmlById(dirId) {
            if (!dirId) return '';
            const cachedHtml = contentCache[dirId];
            if (cachedHtml) return cachedHtml;
            const html = getContent(dirId);
            contentCache[dirId] = html;
            return html;
        }

        function setDirHtmlById(dirId, html, skipDomUpdate) {
            if (!dirId) return;
            const storedHtml = normalizeRuntimeMediaHtml(html);
            contentCache[dirId] = storedHtml;
            if (skipDomUpdate) return;
            if (currentDirId && currentDirId === dirId) {
                const contentBody = document.getElementById('contentBody');
                if (contentBody) {
                    releaseActiveMedia();
                    contentBody.innerHTML = storedHtml || '<div class="empty-state">此目录暂无内容</div>';
                    assignHeadingAutoIds(contentBody);
                    initCodeBlocks();
                    initImageViewer();
                    initSpoilers();
                    initArchiveDownloads();
                    setTimeout(() => {
                        loadLazyMedia();
                    }, 100);
                }
            }
        }

        function initVisibleMethodTriggers() {
            if (soraVisibleObserver) soraVisibleObserver.disconnect();
            if (!('IntersectionObserver' in window)) return;
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            const visibleLinks = Array.from(contentBody.querySelectorAll('a[data-sora-link="method"]')).filter(function(link) {
                return readMethodsFromElement(link).some(function(method) { return method.trigger === 'visible'; });
            });
            const thresholds = Array.from(new Set([0.01].concat(visibleLinks.flatMap(function(link) {
                return readMethodsFromElement(link).filter(function(method) { return method.trigger === 'visible'; }).map(function(method) {
                    return Math.max(0, Math.min(1, Number(method.visibleThreshold) || 0.35));
                });
            })))).sort(function(a, b) { return a - b; });
            soraVisibleObserver = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (!entry.isIntersecting) return;
                    readMethodsFromElement(entry.target).forEach(function(method) {
                        if (method.trigger !== 'visible') return;
                        const threshold = Math.max(0, Math.min(1, Number(method.visibleThreshold) || 0.35));
                        if (entry.intersectionRatio >= threshold) executeConfiguredMethod(method, entry.target);
                    });
                });
            }, { root: contentBody, threshold: thresholds });
            visibleLinks.forEach(function(link) { soraVisibleObserver.observe(link); });
        }

        function scheduleTimeMethodTriggers() {
            document.querySelectorAll('.mulu').forEach(function(element) {
                const dirId = element.dataset.dirId;
                if (!dirId) return;
                extractMethodLinksFromHtml(getContent(dirId) || '').forEach(function(link) {
                    readMethodsFromElement(link).forEach(function(method) {
                        if (method.enabled === false) return;
                        method._contextDirId = dirId;
                        if (method.trigger === 'delay') {
                            setTimeout(function() { executeConfiguredMethod(method, link); }, Math.max(0, Number(method.triggerDelayMs) || 0));
                        }
                        if (method.trigger === 'interval') {
                            const interval = Math.max(250, Number(method.intervalMs) || 5000);
                            const timer = setInterval(function() {
                                const count = soraMethodExecutionCounts.get(method.methodId) || 0;
                                if (count >= method.maxExecutions) {
                                    clearInterval(timer);
                                    return;
                                }
                                executeConfiguredMethod(method, link);
                            }, interval);
                        }
                    });
                });
            });
        }

        function normalizeShortcut(event) {
            const parts = [];
            if (event.ctrlKey) parts.push('Ctrl');
            if (event.altKey) parts.push('Alt');
            if (event.shiftKey) parts.push('Shift');
            if (event.metaKey) parts.push('Meta');
            const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
            if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) parts.push(key);
            return parts.join('+').toLowerCase();
        }

        function showMethodDebugPanel() {
            const overlay = ensureExportDialog();
            overlay.querySelector('.sora-method-dialog').className = 'sora-method-dialog mode-drawer';
            const pageVars = JSON.stringify(soraPageVariables, null, 2);
            const sessionVars = JSON.stringify(readVariableStore('session'), null, 2);
            overlay.querySelector('.sora-method-dialog-content').innerHTML =
                '<h2>方法调试</h2>' +
                '<p>当前目录：<code>' + escapeHtml(currentDirId || '无') + '</code> · 已记录 ' + soraMethodExecutionLog.length + ' 条</p>' +
                '<details><summary>页面变量</summary><pre>' + escapeHtml(pageVars) + '</pre></details>' +
                '<details><summary>会话变量</summary><pre>' + escapeHtml(sessionVars) + '</pre></details>' +
                '<ul class="sora-method-debug-list">' + soraMethodExecutionLog.map(function(item) {
                    return '<li><strong>' + escapeHtml(item.status) + '</strong> · ' + escapeHtml(item.time + ' ' + item.type) + '<br><small>' + escapeHtml(item.detail + ' · ' + item.methodId + ' · ' + Math.round(item.durationMs || 0) + 'ms') + '</small></li>';
                }).join('') + '</ul>';
            overlay.querySelector('.sora-method-dialog-actions').innerHTML = '<button type="button" data-debug-copy>复制脱敏诊断摘要</button><button type="button" data-debug-reset>重置执行状态</button><button type="button" data-debug-close>关闭</button>';
            overlay.querySelector('[data-debug-copy]').onclick = async function() {
                const summary = {
                    app: 'SoraDirectory export',
                    time: new Date().toISOString(),
                    publication: { capabilityLevel: SORA_PUBLICATION.capabilityLevel, theme: SORA_PUBLICATION.theme, mediaPolicy: SORA_PUBLICATION.mediaPolicy },
                    environment: { protocol: location.protocol, online: navigator.onLine, language: navigator.language },
                    currentDirId: currentDirId || '',
                    executionLog: soraMethodExecutionLog.slice(0, 100).map(function(item) {
                        return SoraMethodRuntimeCore.redactTimelineEntry(item);
                    })
                };
                try {
                    await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
                    showExportToast('已复制脱敏诊断摘要', 1800, 'success');
                } catch (_) {
                    showExportToast('当前环境不能写入剪贴板', 2200, 'error');
                }
            };
            overlay.querySelector('[data-debug-reset]').onclick = function() {
                soraExecutedMethodIds.clear();
                soraMethodExecutionCounts.clear();
                soraMethodExecutionLog.length = 0;
                Object.keys(soraPageVariables).forEach(function(key) { delete soraPageVariables[key]; });
                showExportToast('方法执行状态已重置');
                overlay._soraClose(false);
            };
            overlay.querySelector('[data-debug-close]').onclick = function() { overlay._soraClose(false); };
            overlay._soraOpen('方法调试');
        }

        function initMethodDebugButton() {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'sora-method-debug-button';
            button.textContent = '方法调试';
            button.addEventListener('click', showMethodDebugPanel);
            document.body.appendChild(button);
        }
        /* SORA_OPTIONAL_METHOD_RUNTIME_END */

        function findAnchorElementInRoot(root, anchorId) {
            if (!root || !anchorId) return null;
            const id = normalizeAnchorId(anchorId);
            if (!id) return null;
            const selector1 = '#' + escapeCssSelectorValue(id);
            let el = root.querySelector(selector1);
            if (!el) {
                const selector2 = '.sora-anchor[data-sora-anchor="true"][data-anchor-name="' + escapeCssSelectorValue(id) + '"]';
                el = root.querySelector(selector2);
                if (!el) {
                    methodDebugLog('[Sora方法] 找不到锚点, id:', id, '选择器:', selector1, selector2);
                }
            }
            return el;
        }

        function extractHtmlBetweenAnchors(root, frontId, backId) {
            if (!root) return null;
            if (!frontId && !backId) {
                return root.innerHTML;
            }
            const range = document.createRange();
            try {
                if (frontId) {
                    const frontEl = findAnchorElementInRoot(root, frontId);
                    if (!frontEl) return null;
                    range.setStartAfter(frontEl);
                } else {
                    range.setStart(root, 0);
                }
                if (backId) {
                    const backEl = findAnchorElementInRoot(root, backId);
                    if (!backEl) return null;
                    range.setEndBefore(backEl);
                } else {
                    range.setEnd(root, root.childNodes.length);
                }
            } catch (e) {
                return null;
            }
            const frag = range.cloneContents();
            const div = document.createElement('div');
            div.appendChild(frag);
            return div.innerHTML;
        }

        function replaceHtmlBetweenAnchors(root, frontId, backId, replacementHtml) {
            if (!root) return false;
            const range = document.createRange();
            try {
                if (frontId) {
                    const frontEl = findAnchorElementInRoot(root, frontId);
                    if (!frontEl) return false;
                    range.setStartAfter(frontEl);
                } else {
                    range.setStart(root, 0);
                }
                if (backId) {
                    const backEl = findAnchorElementInRoot(root, backId);
                    if (!backEl) return false;
                    range.setEndBefore(backEl);
                } else {
                    range.setEnd(root, root.childNodes.length);
                }
            } catch (e) {
                return false;
            }
            range.deleteContents();
            const div = document.createElement('div');
            div.innerHTML = replacementHtml;
            const frag = document.createDocumentFragment();
            while (div.firstChild) {
                frag.appendChild(div.firstChild);
            }
            range.insertNode(frag);
            return true;
        }

        function handleInternalLinkClick(e) {
            const a = e.target && e.target.closest ? e.target.closest('a') : null;
            if (!a) return;
            const href = a.getAttribute('href') || '';
            const soraType = a.getAttribute('data-sora-link') || '';

            if (!href) return;

            if (soraType === 'method') {
                e.preventDefault();
                e.stopPropagation();
                executeMethodsForElement(a, 'click');
                return;
            }

            if (href.startsWith('#') || soraType === 'anchor') {
                e.preventDefault();
                e.stopPropagation();
                const anchorId = normalizeAnchorId(href);
                if (scrollToAnchorInContent(anchorId)) {
                    writeExportRoute(currentDirId, anchorId, 'push');
                }
                return;
            }

            if (href.toLowerCase().startsWith('sora-dir:') || soraType === 'dir') {
                e.preventDefault();
                e.stopPropagation();

                let dirId = a.getAttribute('data-dir-id');
                const dirName = a.getAttribute('data-dir-name');
                let anchorId = a.getAttribute('data-anchor-id');

                if (!anchorId) {
                    const hashIndex = href.indexOf('#');
                    if (hashIndex >= 0) {
                        anchorId = href.substring(hashIndex + 1);
                    }
                }
                if (!dirId && !dirName) {
                    const raw = href.substring('sora-dir:'.length);
                    const hashIndex = raw.indexOf('#');
                    dirId = (hashIndex >= 0 ? raw.substring(0, hashIndex) : raw).trim();
                }
                if (!dirId && dirName) {
                    dirId = resolveDirIdFromName(dirName);
                }
                if (dirId) {
                    const exists = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
                    if (!exists) {
                        const resolved = resolveDirIdFromName(dirId);
                        if (resolved) {
                            dirId = resolved;
                        }
                    }
                }
                if (!dirId) return;

                selectDirectory(dirId, false, {
                    viewMode: anchorId ? 'top' : 'restore',
                    anchorId: anchorId || ''
                });
                return;
            }
        }

        function toggleDirectory(dirId, event) {
            if (event) {
                event.stopPropagation();
            }
            const element = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (element && element.classList.contains('has-children')) {
                element.classList.toggle('expanded');
                element.setAttribute('aria-expanded', element.classList.contains('expanded') ? 'true' : 'false');
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
                
                if (child.dataset.soraHidden === 'true') {
                    child.style.display = 'none';
                    continue;
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

        const exportSearchIndex = [];
        let exportSearchIndexedCount = 0;
        let exportSearchTotalCount = 0;
        let exportSearchReady = false;
        let exportSearchTimer = null;

        function normalizeExportSearchText(value) {
            return String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
        }

        function buildExportSearchEntry(element) {
            const dirId = element.dataset.dirId || '';
            const title = nameMap[dirId] || '未命名';
            const temp = document.createElement('div');
            temp.innerHTML = getContent(dirId) || '';
            temp.querySelectorAll('script, style, template').forEach(function(item) { item.remove(); });
            const text = String(temp.textContent || '').replace(/\s+/g, ' ').trim();
            return {
                dirId: dirId,
                title: title,
                text: text,
                normalizedTitle: normalizeExportSearchText(title),
                normalizedText: normalizeExportSearchText(text)
            };
        }

        function updateExportSearchStatus(message) {
            const status = document.getElementById('exportSearchStatus');
            if (status) status.textContent = message;
        }

        function scheduleExportSearchIndexBuild() {
            const elements = Array.from(document.querySelectorAll('.mulu'));
            exportSearchIndex.length = 0;
            exportSearchIndexedCount = 0;
            exportSearchTotalCount = elements.length;
            exportSearchReady = elements.length === 0;
            updateExportSearchStatus(exportSearchReady ? '没有可搜索的目录' : '正在准备搜索索引…');

            const schedule = function(callback) {
                if (typeof requestIdleCallback === 'function') requestIdleCallback(callback, { timeout: 180 });
                else setTimeout(function() { callback({ timeRemaining: function() { return 0; } }); }, 0);
            };
            const work = function(deadline) {
                let processed = 0;
                while (exportSearchIndexedCount < elements.length &&
                    (processed < 12 || (deadline.timeRemaining && deadline.timeRemaining() > 4))) {
                    exportSearchIndex.push(buildExportSearchEntry(elements[exportSearchIndexedCount]));
                    exportSearchIndexedCount++;
                    processed++;
                }
                const input = document.getElementById('exportSearchInput');
                const query = input ? input.value.trim() : '';
                if (exportSearchIndexedCount < elements.length) {
                    updateExportSearchStatus('正在准备搜索索引：' + exportSearchIndexedCount + ' / ' + elements.length);
                    if (query) renderExportSearchResults(query);
                    schedule(work);
                    return;
                }
                exportSearchReady = true;
                updateExportSearchStatus(query ? '' : '可搜索 ' + elements.length + ' 个目录');
                if (query) renderExportSearchResults(query);
            };
            if (!exportSearchReady) schedule(work);
        }

        function getExportSearchSnippet(text, normalizedText, query) {
            const index = normalizedText.indexOf(query);
            if (index < 0) return text.slice(0, 90);
            const start = Math.max(0, index - 32);
            const end = Math.min(text.length, index + query.length + 58);
            return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
        }

        function highlightExportSearchTerm(query) {
            const contentBody = document.getElementById('contentBody');
            const normalizedQuery = normalizeExportSearchText(query);
            if (!contentBody || !normalizedQuery) return false;
            const walker = document.createTreeWalker(contentBody, NodeFilter.SHOW_TEXT, {
                acceptNode: function(node) {
                    const parent = node.parentElement;
                    if (!parent || parent.closest('script, style, .code-lang-label')) return NodeFilter.FILTER_REJECT;
                    return normalizeExportSearchText(node.textContent).includes(normalizedQuery)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP;
                }
            });
            const node = walker.nextNode();
            if (!node) return false;
            const source = node.textContent || '';
            const index = source.toLocaleLowerCase().indexOf(normalizedQuery);
            if (index < 0) return false;
            const mark = document.createElement('mark');
            mark.className = 'export-search-hit';
            mark.textContent = source.slice(index, index + query.length);
            const after = node.splitText(index);
            after.deleteData(0, query.length);
            after.parentNode.insertBefore(mark, after);
            mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
        }

        function renderExportSearchResults(rawQuery) {
            const resultsContainer = document.getElementById('exportSearchResults');
            const clearButton = document.getElementById('exportSearchClear');
            if (!resultsContainer) return;
            const query = normalizeExportSearchText(rawQuery);
            if (clearButton) clearButton.hidden = !query;
            resultsContainer.innerHTML = '';
            resultsContainer.hidden = !query;
            if (!query) {
                updateExportSearchStatus(exportSearchReady
                    ? '可搜索 ' + exportSearchTotalCount + ' 个目录'
                    : '正在准备搜索索引：' + exportSearchIndexedCount + ' / ' + exportSearchTotalCount);
                return;
            }
            const matches = exportSearchIndex.map(function(item) {
                const titleIndex = item.normalizedTitle.indexOf(query);
                const textIndex = item.normalizedText.indexOf(query);
                if (titleIndex < 0 && textIndex < 0) return null;
                return {
                    item: item,
                    score: titleIndex === 0 ? 300 : (titleIndex > 0 ? 220 : 100),
                    snippet: getExportSearchSnippet(item.text, item.normalizedText, query)
                };
            }).filter(Boolean).sort(function(a, b) {
                return b.score - a.score || a.item.title.localeCompare(b.item.title);
            }).slice(0, 50);
            matches.forEach(function(match) {
                const item = document.createElement('div');
                item.setAttribute('role', 'listitem');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'export-search-result';
                button.dataset.exportSearchDir = match.item.dirId;
                const title = document.createElement('strong');
                title.textContent = match.item.title;
                const snippet = document.createElement('small');
                snippet.textContent = match.snippet || '目录名匹配';
                button.appendChild(title);
                button.appendChild(snippet);
                item.appendChild(button);
                resultsContainer.appendChild(item);
            });
            const suffix = exportSearchReady ? '' : '（索引仍在构建）';
            updateExportSearchStatus(matches.length ? '找到 ' + matches.length + ' 项' + suffix : '未找到匹配项' + suffix);
        }

        function initExportSearch() {
            const input = document.getElementById('exportSearchInput');
            const clearButton = document.getElementById('exportSearchClear');
            const results = document.getElementById('exportSearchResults');
            if (!input || !results) return;
            input.addEventListener('input', function() {
                clearTimeout(exportSearchTimer);
                exportSearchTimer = setTimeout(function() { renderExportSearchResults(input.value); }, 160);
            });
            input.addEventListener('keydown', function(event) {
                if (event.key !== 'Escape') return;
                input.value = '';
                renderExportSearchResults('');
                input.blur();
            });
            if (clearButton) clearButton.addEventListener('click', function() {
                input.value = '';
                renderExportSearchResults('');
                input.focus();
            });
            results.addEventListener('click', function(event) {
                const button = event.target.closest('[data-export-search-dir]');
                if (!button) return;
                const query = input.value.trim();
                selectDirectory(button.dataset.exportSearchDir, false, { viewMode: 'top' });
                requestAnimationFrame(function() { highlightExportSearchTerm(query); });
            });
        }

        let mediaObserver = null;
        let mediaLoadEpoch = 0;
        let videoLoadQueue = Promise.resolve();
        const activeMediaUrls = new Set();
        const MANUAL_VIDEO_LOAD_SIZE = SORA_PUBLICATION.mediaPolicy === 'manual' ? 0 : 64 * 1024 * 1024;

        function createVideoPlaceholder(placeholderId, message = '准备视频', isError = false) {
            const placeholder = document.createElement('div');
            placeholder.className = 'lazy-media video-load-shell' + (isError ? ' is-error' : '');
            placeholder.setAttribute('data-placeholder-id', placeholderId || '');
            if (!isError) placeholder.setAttribute('data-loading', 'true');
            placeholder.innerHTML = '<div class="video-load-status"></div><div class="video-load-track"><span></span></div>';
            const status = placeholder.querySelector('.video-load-status');
            if (status) status.textContent = message;
            return placeholder;
        }

        function normalizeRuntimeMediaHtml(html) {
            if (!html || !String(html).includes('data-media-runtime="video"')) return html || '';
            const root = document.createElement('div');
            root.innerHTML = String(html);
            root.querySelectorAll('video[data-media-runtime="video"][data-placeholder-id]').forEach(video => {
                const placeholderId = video.getAttribute('data-placeholder-id') || '';
                video.replaceWith(createVideoPlaceholder(placeholderId));
            });
            return root.innerHTML;
        }

        function releaseActiveMedia() {
            mediaLoadEpoch++;
            if (mediaObserver) {
                mediaObserver.disconnect();
                mediaObserver = null;
            }
            activeMediaUrls.forEach(url => URL.revokeObjectURL(url));
            activeMediaUrls.clear();
        }

        function updateVideoLoadProgress(media, current, total) {
            const percent = total > 0 ? Math.round(current / total * 100) : 0;
            const status = media.querySelector('.video-load-status');
            const bar = media.querySelector('.video-load-track span');
            if (status) status.textContent = '正在准备视频 ' + percent + '%';
            if (bar) bar.style.width = percent + '%';
        }

        function formatMediaSize(bytes) {
            const size = Number(bytes) || 0;
            if (size < 1024) return size + ' B';
            if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
            if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB';
            return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        }

        function initManualVideoLoad(media, mediaInfo) {
            if (media.dataset.manualLoadInit === 'true') return;
            media.dataset.manualLoadInit = 'true';
            const status = media.querySelector('.video-load-status');
            if (status) status.textContent = '视频 ' + formatMediaSize(mediaInfo.size);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'video-load-button';
            button.textContent = '加载视频';
            button.addEventListener('click', () => {
                button.disabled = true;
                button.textContent = '准备中';
                loadSingleMedia(media);
            }, { once: true });
            media.appendChild(button);
        }

        function showMediaError(media, placeholderId, message) {
            const errorPlaceholder = createVideoPlaceholder(placeholderId, message || '视频加载失败', true);
            if (media && media.parentNode) media.parentNode.replaceChild(errorPlaceholder, media);
        }

        function decodeBase64Chunk(base64) {
            const binary = atob(String(base64 || '').replace(/\\s+/g, ''));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return new Blob([bytes.buffer]);
        }

        async function createChunkedVideoUrl(mediaInfo, media, epoch) {
            const chunkIds = Array.isArray(mediaInfo.chunks) ? mediaInfo.chunks : [];
            if (chunkIds.length === 0) throw new Error('视频分块缺失');
            const blobParts = [];
            for (let i = 0; i < chunkIds.length; i++) {
                if (epoch !== mediaLoadEpoch || !media.isConnected) {
                    const abortError = new Error('视频加载已取消');
                    abortError.name = 'AbortError';
                    throw abortError;
                }
                const chunkElement = document.getElementById(chunkIds[i]);
                if (!chunkElement) throw new Error('视频分块不完整');
                blobParts.push(decodeBase64Chunk(chunkElement.textContent));
                updateVideoLoadProgress(media, i + 1, chunkIds.length);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            const blob = new Blob(blobParts, { type: mediaInfo.mimeType || 'application/octet-stream' });
            const objectUrl = URL.createObjectURL(blob);
            activeMediaUrls.add(objectUrl);
            return objectUrl;
        }

        function normalizeLegacyVideoDataUrl(dataUrl, mimeType) {
            if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
            if (mimeType && mimeType !== 'application/octet-stream') {
                return dataUrl.replace(/^data:[^;,]+/i, 'data:' + mimeType);
            }
            if (!/^data:application\\/octet-stream/i.test(dataUrl)) return dataUrl;
            try {
                const commaIndex = dataUrl.indexOf(',');
                const sample = atob(dataUrl.slice(commaIndex + 1, commaIndex + 45));
                if (sample.length >= 8 && sample.slice(4, 8) === 'ftyp') {
                    return dataUrl.replace(/^data:application\\/octet-stream/i, 'data:video/mp4');
                }
            } catch (e) {
            }
            return dataUrl;
        }

        async function loadVideoMedia(media, mediaInfo, placeholderId) {
            const epoch = mediaLoadEpoch;
            let sourceUrl = '';
            try {
                if (mediaInfo.error) throw new Error(mediaInfo.error);
                if (mediaInfo.storage === 'chunks' || Array.isArray(mediaInfo.chunks)) {
                    sourceUrl = await createChunkedVideoUrl(mediaInfo, media, epoch);
                } else {
                    sourceUrl = normalizeLegacyVideoDataUrl(mediaInfo.data || '', mediaInfo.mimeType || '');
                }
                if (epoch !== mediaLoadEpoch || !media.isConnected) {
                    if (sourceUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(sourceUrl);
                        activeMediaUrls.delete(sourceUrl);
                    }
                    return;
                }
                if (!sourceUrl) throw new Error('视频数据不可用');

                const video = document.createElement('video');
                video.controls = true;
                video.preload = 'metadata';
                video.playsInline = true;
                video.setAttribute('data-media-runtime', 'video');
                video.setAttribute('data-placeholder-id', placeholderId);
                if (mediaInfo.title) video.title = mediaInfo.title;
                else if (mediaInfo.originalTag) {
                    const titleMatch = mediaInfo.originalTag.match(/\\stitle=["']([^"']*)["']/);
                    if (titleMatch) video.title = titleMatch[1];
                }
                video.addEventListener('error', () => {
                    if (sourceUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(sourceUrl);
                        activeMediaUrls.delete(sourceUrl);
                    }
                    showMediaError(video, placeholderId, '视频格式不受浏览器支持');
                }, { once: true });
                video.src = sourceUrl;
                if (media.parentNode) media.parentNode.replaceChild(video, media);
                video.load();
            } catch (err) {
                if (err && err.name === 'AbortError') return;
                console.error('加载视频失败:', err);
                showMediaError(media, placeholderId, err && err.message ? err.message : '视频加载失败');
            }
        }

        function queueVideoLoad(media, mediaInfo, placeholderId) {
            const task = videoLoadQueue
                .catch(() => {})
                .then(() => loadVideoMedia(media, mediaInfo, placeholderId));
            videoLoadQueue = task;
            return task;
        }

        function initMediaObserver() {
            if (typeof IntersectionObserver === 'undefined') return;
            if (mediaObserver) mediaObserver.disconnect();
            mediaObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const media = entry.target;
                    if (media.getAttribute('data-loading') === 'true') loadSingleMedia(media);
                    mediaObserver.unobserve(media);
                });
            }, { rootMargin: '100px' });
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            contentBody.querySelectorAll('.lazy-media[data-loading="true"]').forEach(media => {
                const placeholderId = media.getAttribute('data-placeholder-id');
                const mediaInfo = placeholderId ? mediaDataMap[placeholderId] : null;
                if (mediaInfo && mediaInfo.type === 'video' && SORA_PUBLICATION.mediaPolicy === 'blocked') {
                    showMediaError(media, placeholderId, '发布设置已禁止加载视频');
                    return;
                }
                if (mediaInfo && mediaInfo.type === 'video' && Number(mediaInfo.size) >= MANUAL_VIDEO_LOAD_SIZE) {
                    initManualVideoLoad(media, mediaInfo);
                    return;
                }
                mediaObserver.observe(media);
            });
        }

        async function loadSingleMedia(media) {
            if (media.hasAttribute('data-loading-media')) return;
            media.setAttribute('data-loading-media', 'true');
            const placeholderId = media.getAttribute('data-placeholder-id');
            const mediaInfo = placeholderId ? mediaDataMap[placeholderId] : null;
            if (!mediaInfo) {
                media.removeAttribute('data-loading-media');
                return;
            }
            if (mediaInfo.type === 'video') {
                await queueVideoLoad(media, mediaInfo, placeholderId);
                return;
            }
            const dataUrl = mediaInfo.data;
            if (mediaInfo.type !== 'image' || !dataUrl) {
                media.removeAttribute('data-loading-media');
                return;
            }
            await new Promise(resolve => {
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
        }

        async function loadLazyMedia() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            if (typeof IntersectionObserver !== 'undefined') {
                initMediaObserver();
                return;
            }
            const lazyMedias = contentBody.querySelectorAll('.lazy-media[data-loading="true"]');
            const automaticMedia = Array.from(lazyMedias).filter(media => {
                const placeholderId = media.getAttribute('data-placeholder-id');
                const mediaInfo = placeholderId ? mediaDataMap[placeholderId] : null;
                if (mediaInfo && mediaInfo.type === 'video' && SORA_PUBLICATION.mediaPolicy === 'blocked') {
                    showMediaError(media, placeholderId, '发布设置已禁止加载视频');
                    return false;
                }
                if (mediaInfo && mediaInfo.type === 'video' && Number(mediaInfo.size) >= MANUAL_VIDEO_LOAD_SIZE) {
                    initManualVideoLoad(media, mediaInfo);
                    return false;
                }
                return true;
            });
            Promise.all(automaticMedia.map(media => loadSingleMedia(media))).catch(err => {
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
            const dirId = el.dataset.dirId;
            const nameEl = el.querySelector('.mulu-text');
            const name = (nameEl ? nameEl.textContent : el.textContent).trim();
            nameMap[dirId] = name;
            if (!nameIndex[name]) nameIndex[name] = [];
            nameIndex[name].push(dirId);
        });

        const mobileNavToggle = document.getElementById('mobileNavToggle');
        const sidebarBackdrop = document.getElementById('sidebarBackdrop');
        function setExportSidebarOpen(open, restoreFocus = true) {
            document.body.classList.toggle('sidebar-open', !!open);
            if (mobileNavToggle) mobileNavToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                const target = currentSelected || document.querySelector('.mulu');
                if (target) requestAnimationFrame(function() { target.focus(); });
            } else if (restoreFocus && mobileNavToggle) {
                mobileNavToggle.focus();
            }
        }
        if (mobileNavToggle) {
            mobileNavToggle.addEventListener('click', function() {
                setExportSidebarOpen(!document.body.classList.contains('sidebar-open'));
            });
        }
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', function() { setExportSidebarOpen(false); });
        }

        (function() {
            const container = document.querySelector('.sidebar-content-inner') || document.querySelector('.sidebar-content') || document.querySelector('.sidebar');
            if (!container) return;
            container.addEventListener('click', function(e) {
                const toggle = e.target && e.target.closest ? e.target.closest('.toggle-icon') : null;
                if (toggle) {
                    const muluEl = toggle.closest ? toggle.closest('.mulu') : null;
                    if (!muluEl) return;
                    const id = muluEl.dataset ? (muluEl.dataset.dirId || '') : '';
                    toggleDirectory(id, e);
                    return;
                }
                const muluEl = e.target && e.target.closest ? e.target.closest('.mulu') : null;
                if (!muluEl) return;
                const id = muluEl.dataset ? (muluEl.dataset.dirId || '') : '';
                selectDirectory(id, false, {
                    viewMode: currentDirId === id ? 'preserve' : 'restore'
                });
            });

            container.addEventListener('keydown', function(e) {
                const current = e.target && e.target.closest ? e.target.closest('.mulu') : null;
                if (!current) return;
                const visible = Array.from(container.querySelectorAll('.mulu')).filter(function(item) {
                    return item.style.display !== 'none' && !item.classList.contains('collapsed-child');
                });
                const index = visible.indexOf(current);
                let focusTarget = null;
                if (e.key === 'ArrowDown') focusTarget = visible[Math.min(visible.length - 1, index + 1)];
                else if (e.key === 'ArrowUp') focusTarget = visible[Math.max(0, index - 1)];
                else if (e.key === 'Home') focusTarget = visible[0];
                else if (e.key === 'End') focusTarget = visible[visible.length - 1];
                else if (e.key === 'ArrowRight' && current.classList.contains('has-children')) {
                    if (!current.classList.contains('expanded')) toggleDirectory(current.dataset.dirId, e);
                    else focusTarget = visible[index + 1];
                } else if (e.key === 'ArrowLeft') {
                    if (current.classList.contains('has-children') && current.classList.contains('expanded')) {
                        toggleDirectory(current.dataset.dirId, e);
                    } else {
                        const level = Number(current.dataset.level) || 0;
                        for (let i = index - 1; i >= 0; i--) {
                            if ((Number(visible[i].dataset.level) || 0) < level) {
                                focusTarget = visible[i];
                                break;
                            }
                        }
                    }
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectDirectory(current.dataset.dirId, false, {
                        viewMode: currentDirId === current.dataset.dirId ? 'preserve' : 'restore'
                    });
                    return;
                } else {
                    return;
                }
                e.preventDefault();
                if (focusTarget) focusTarget.focus();
            });
        })();

        window.addEventListener('popstate', function() {
            const route = readExportRoute();
            if (!route || !route.dirId) return;
            const target = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(route.dirId) + '"]');
            if (!target) return;
            expandDirectoryAncestors(route.dirId);
            soraHistoryNavigation = true;
            try {
                selectDirectory(route.dirId, false, {
                    viewMode: route.anchorId ? 'top' : 'restore',
                    anchorId: route.anchorId,
                    historyMode: 'none'
                });
            } finally {
                soraHistoryNavigation = false;
            }
        });

        (function() {
            const contentBody = document.getElementById('contentBody');
            if (contentBody) {
                contentBody.addEventListener('click', handleInternalLinkClick);
                contentBody.addEventListener('dblclick', function(e) {
                    const a = e.target && e.target.closest ? e.target.closest('a[data-sora-link="method"]') : null;
                    if (a) executeMethodsForElement(a, 'dblclick');
                });
                contentBody.addEventListener('change', function() {
                    handleSoraMethodTriggersCascade('change');
                });
                contentBody.addEventListener('ended', function() {
                    handleSoraMethodTriggersCascade('media_end');
                }, true);
                contentBody.addEventListener('mouseover', function(e) {
                    const a = e.target && e.target.closest ? e.target.closest('a[data-sora-link="method"]') : null;
                    if (!a) return;
                    const methods = readMethodsFromElement(a);
                    if (!methods || methods.length === 0) return;
                    if (!methods.some(m => (m.trigger || 'click') === 'hover')) return;
                    const now = Date.now();
                    const last = soraMethodHoverCooldownMap.get(a) || 0;
                    if (now - last < 400) return;
                    soraMethodHoverCooldownMap.set(a, now);
                    executeMethodsForElement(a, 'hover');
                });
                let longPressTimer = null;
                contentBody.addEventListener('pointerdown', function(e) {
                    const a = e.target && e.target.closest ? e.target.closest('a[data-sora-link="method"]') : null;
                    if (!a) return;
                    const methods = readMethodsFromElement(a).filter(function(method) { return method.trigger === 'longpress'; });
                    if (!methods.length) return;
                    const duration = Math.max(300, Math.min.apply(Math, methods.map(function(method) { return Number(method.longPressMs) || 600; })));
                    longPressTimer = setTimeout(function() { executeMethodsForElement(a, 'longpress'); }, duration);
                });
                ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(name) {
                    contentBody.addEventListener(name, function() {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    });
                });
            }
        })();

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
                setExportSidebarOpen(false);
                return;
            }
            const searchInput = document.getElementById('exportSearchInput');
            const target = event.target;
            const isTextInput = target && target.matches && target.matches('input, textarea, [contenteditable="true"]');
            if (searchInput && (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !isTextInput))) {
                event.preventDefault();
                if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) setExportSidebarOpen(true, false);
                searchInput.focus();
                searchInput.select();
                return;
            }
            const shortcut = normalizeShortcut(event);
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            contentBody.querySelectorAll('a[data-sora-link="method"]').forEach(function(link) {
                const matches = readMethodsFromElement(link).filter(function(method) {
                    return method.trigger === 'keyboard' && String(method.shortcut || '').toLowerCase() === shortcut;
                });
                matches.forEach(function(method) { executeConfiguredMethod(method, link); });
            });
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
                        langLabel.textContent = '复制失败';
                        setTimeout(() => {
                            langLabel.textContent = langLabel.dataset.lang;
                        }, 2000);
                    }
                });
                pre.appendChild(langLabel);
            });
        }
        function initSpoilers() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            contentBody.querySelectorAll('spoiler').forEach(function(spoiler) {
                if (spoiler.dataset.soraSpoilerInit === 'true') return;
                spoiler.dataset.soraSpoilerInit = 'true';
                spoiler.setAttribute('role', 'button');
                spoiler.setAttribute('tabindex', '0');
                spoiler.setAttribute('aria-expanded', 'false');
                const toggle = function() {
                    const revealed = spoiler.getAttribute('data-revealed') === 'true';
                    spoiler.setAttribute('data-revealed', revealed ? 'false' : 'true');
                    spoiler.setAttribute('aria-expanded', revealed ? 'false' : 'true');
                };
                spoiler.addEventListener('click', toggle);
                spoiler.addEventListener('keydown', function(event) {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    toggle();
                });
            });
        }
        const imageViewer = document.getElementById('imageViewer');
        const imageViewerImg = document.getElementById('imageViewerImg');
        const imageViewerClose = document.getElementById('imageViewerClose');
        let imageViewerOpener = null;
        function initImageViewer() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            const images = contentBody.querySelectorAll('img');
            images.forEach(img => {
                if (img.dataset.viewerInit) return;
                img.dataset.viewerInit = 'true';
                img.setAttribute('tabindex', '0');
                img.setAttribute('role', 'button');
                const openViewer = () => {
                    imageViewerOpener = img;
                    imageViewerImg.src = img.src;
                    imageViewerImg.alt = img.alt ? '放大查看：' + img.alt : '放大查看';
                    imageViewer.classList.add('active');
                    imageViewerClose.focus();
                };
                img.addEventListener('click', openViewer);
                img.addEventListener('keydown', function(event) {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    openViewer();
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
                            showExportToast('文件数据不可用');
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
                        showExportToast('加载文件失败，请重试');
                    } finally {
                        downloadBtn.textContent = originalText;
                        downloadBtn.disabled = false;
                    }
                });
            });
        }
        function closeImageViewer() {
            imageViewer.classList.remove('active');
            imageViewerImg.removeAttribute('src');
            if (imageViewerOpener && imageViewerOpener.isConnected) imageViewerOpener.focus();
            imageViewerOpener = null;
        }
        imageViewerClose.addEventListener('click', closeImageViewer);
        imageViewer.addEventListener('click', (e) => {
            if (e.target === imageViewer) {
                closeImageViewer();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && imageViewer.classList.contains('active')) {
                closeImageViewer();
            }
        });
        window.addEventListener('beforeunload', releaseActiveMedia);
        window.selectDirectory = selectDirectory;
        window.toggleDirectory = toggleDirectory;
        initReadingTools();
        initComponentInteractions();
        if (SORA_PUBLICATION.searchEnabled) {
            initExportSearch();
            scheduleExportSearchIndexBuild();
        }
        
        const defaultDirId = ${JSON.stringify(firstDirId || '').replace(/<\/script>/gi, '<\\/script')};
        const initialRoute = readExportRoute();
        const initialRouteTarget = initialRoute && initialRoute.dirId
            ? document.querySelector('[data-dir-id="' + escapeCssSelectorValue(initialRoute.dirId) + '"]')
            : null;
        const initialDirId = initialRouteTarget ? initialRoute.dirId : defaultDirId;
        const initialAnchorId = initialRouteTarget ? initialRoute.anchorId : '';
        (function applyInitialTreeState() {
            const mode = SORA_PUBLICATION.initialTreeState || 'expanded';
            document.querySelectorAll('.mulu.has-children').forEach(function(node) {
                const expanded = mode === 'expanded';
                node.classList.toggle('expanded', expanded);
                node.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            });
            refreshMuluVisibility();
            if (mode === 'current-path' && initialDirId) expandDirectoryAncestors(initialDirId);
        })();
        if (initialDirId) {
            methodDebugLog('[Sora方法] 即将调用selectDirectory, dirId:', initialDirId);
            if (initialRouteTarget) expandDirectoryAncestors(initialDirId);
            selectDirectory(initialDirId, false, {
                viewMode: 'top',
                anchorId: initialAnchorId,
                historyMode: 'replace'
            });
            methodDebugLog('[Sora方法] selectDirectory调用完成');
        }
        
        methodDebugLog('[Sora方法] 网页加载完成，开始执行open触发');
        handleSoraMethodTriggersCascade('open');
        scheduleTimeMethodTriggers();
        if (SORA_METHOD_DEBUG) initMethodDebugButton();
        if (SORA_PUBLICATION.deploymentMode === 'pwa-folder' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
            navigator.serviceWorker.register('./sora-service-worker.js').catch(function() {
                showExportToast('离线缓存未启用，基础阅读仍可使用', 2600, 'warning');
            });
        }
    </script>
</body>
</html>`;

    if (!hasMethodRuntime) {
        const optionalStart = '/* SORA_OPTIONAL_METHOD_RUNTIME_START */';
        const optionalEnd = '/* SORA_OPTIONAL_METHOD_RUNTIME_END */';
        const startIndex = htmlContent.indexOf(optionalStart);
        const endIndex = htmlContent.indexOf(optionalEnd);
        if (startIndex >= 0 && endIndex > startIndex) {
            const noMethodRuntime = `
        function executeMethodsForElement() { return false; }
        function handleSoraMethodTriggersCascade() {}
        function scheduleTimeMethodTriggers() {}
        function initMethodDebugButton() {}
        function initComponentInteractions() {}
        function getMuluList() { return Array.from(document.querySelectorAll('.mulu')); }
        function getMuluLevel(element) { const value = parseInt(element && element.dataset.level, 10); return Number.isNaN(value) ? 0 : value; }
        function refreshMuluVisibility() {
            const visibleByLevel = [];
            const expandedByLevel = [];
            getMuluList().forEach(function(element) {
                const level = getMuluLevel(element);
                let visible = element.dataset.soraHidden !== 'true';
                if (level > 0) visible = visible && visibleByLevel[level - 1] !== false && expandedByLevel[level - 1] === true;
                element.style.display = visible ? '' : 'none';
                visibleByLevel[level] = visible;
                expandedByLevel[level] = element.classList.contains('expanded');
            });
        }
        function expandDirectoryAncestors(dirId) {
            const all = getMuluList();
            const target = document.querySelector('[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
            if (!target) return;
            let level = getMuluLevel(target);
            let index = all.indexOf(target) - 1;
            while (level > 0 && index >= 0) {
                if (getMuluLevel(all[index]) === level - 1) {
                    all[index].classList.add('expanded');
                    all[index].setAttribute('aria-expanded', 'true');
                    level--;
                }
                index--;
            }
            refreshMuluVisibility();
        }
        `;
            htmlContent = htmlContent.slice(0, startIndex) + noMethodRuntime + htmlContent.slice(endIndex + optionalEnd.length);
        }
    }
    const markerIndex = htmlContent.indexOf(mediaChunkMarker);
    if (markerIndex < 0) {
        throw new Error('网页媒体分块插入点缺失');
    }
    const htmlPrefix = htmlContent.slice(0, markerIndex);
    const htmlSuffix = htmlContent.slice(markerIndex + mediaChunkMarker.length);
    const spooledChunks = mediaChunkTemporary ? await mediaChunkTemporary.handle.getFile() : null;
    const htmlParts = [htmlPrefix, ...(spooledChunks ? [spooledChunks] : mediaChunkScriptParts), htmlSuffix];

    // 如果加密，包装 HTML
    let outputParts = htmlParts;
    if (encrypt && password) {
        const encryptedHtml = await encryptData(htmlParts.join(''), password);
        outputParts = [generateEncryptedHtmlWrapper(baseName, encryptedHtml)];
    }

    // 创建并下载文件
    if (deploymentDirectoryHandle) {
        await writePartsToDirectoryHandle(deploymentDirectoryHandle, 'index.html', outputParts);
        if (publicationSettings.deploymentMode === 'pwa-folder') {
            const manifest = {
                name: publicationSettings.title,
                short_name: publicationSettings.title.slice(0, 24),
                description: publicationSettings.description,
                start_url: './index.html',
                scope: './',
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: '#075bbd',
                icons: publicationSettings.icon ? [{ src: publicationSettings.icon, sizes: 'any', purpose: 'any' }] : []
            };
            const serviceWorker = `const CACHE='sora-directory-v1';const FILES=['./','./index.html','./manifest.webmanifest'];self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match('./index.html'))));});`;
            await writePartsToDirectoryHandle(deploymentDirectoryHandle, 'manifest.webmanifest', [JSON.stringify(manifest, null, 2)]);
            await writePartsToDirectoryHandle(deploymentDirectoryHandle, 'sora-service-worker.js', [serviceWorker]);
        }
    } else if (selectedFileHandle) {
        await writePartsToFileHandle(selectedFileHandle, outputParts);
    } else {
        let prepared = null;
        try {
            prepared = await createTemporaryExport(filename, fileHandle =>
                writePartsToFileHandle(fileHandle, outputParts)
            );
        } catch (err) {
            console.warn('OPFS webpage export failed, using memory fallback:', err);
        }
        const file = prepared
            ? prepared.file
            : new File(outputParts, filename, { type: 'text/html;charset=utf-8' });
        const action = await showPreparedFileActions(file, filename, prepared && prepared.cleanup);
        if (action === 'cancel') return false;
    }
    if (mediaChunkTemporary) {
        try {
            await mediaChunkTemporary.directory.removeEntry(mediaChunkTemporary.filename);
        } catch (err) {
            console.warn('Unable to remove webpage media spool:', err);
        }
    }
    showToast(deploymentDirectoryHandle
        ? `已导出${publicationSettings.deploymentMode === 'pwa-folder' ? ' PWA' : ''}网站目录：${filename}`
        : `已导出${encrypt ? '加密' : ''}网页：${filename}`, 'success', 2500);
    return true;
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
