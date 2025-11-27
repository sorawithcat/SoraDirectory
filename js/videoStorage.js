// ============================================
// 媒体存储模块 (videoStorage.js)
// 功能：使用 IndexedDB 存储大型媒体数据（视频、图片）
// 依赖：无（需在其他模块之前加载）
// ============================================

const MediaStorage = (function() {
    const DB_NAME = 'SoraDirectoryMediaDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'media';
    
    let db = null;
    
    /**
     * 初始化 IndexedDB 数据库
     * @returns {Promise<IDBDatabase>}
     */
    function initDB() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }
            
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => {
                console.error('VideoStorage: 无法打开 IndexedDB', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }
    
    /**
     * 生成唯一的媒体 ID
     * @param {string} type - 媒体类型 ('video' 或 'image')
     * @returns {string}
     */
    function generateMediaId(type = 'media') {
        return `${type}_` + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 分块大小：10MB
    const CHUNK_SIZE = 10 * 1024 * 1024;
    
    /**
     * 保存媒体数据到 IndexedDB（支持分块存储大文件）
     * @param {string|Blob|File} mediaData - 媒体数据（base64 字符串、Blob 或 File）
     * @param {string} type - 媒体类型 ('video', 'image', 'archive')
     * @param {string} [mediaId] - 可选的媒体 ID，不提供则自动生成
     * @returns {Promise<string>} - 返回媒体 ID
     */
    async function saveMedia(mediaData, type = 'media', mediaId = null) {
        const database = await initDB();
        const id = mediaId || generateMediaId(type);
        
        // 如果是 Blob 或 File，使用二进制分块存储
        if (mediaData instanceof Blob || mediaData instanceof File) {
            return saveBlobChunked(database, mediaData, type, id);
        }
        
        // 字符串数据（base64）
        if (typeof mediaData === 'string') {
            // 小文件直接存储
            if (mediaData.length <= CHUNK_SIZE) {
                return new Promise((resolve, reject) => {
                    const transaction = database.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    
                    const request = store.put({
                        id: id,
                        data: mediaData,
                        type: type,
                        timestamp: Date.now()
                    });
                    
                    request.onsuccess = () => resolve(id);
                    request.onerror = () => reject(request.error);
                });
            }
            
            // 大文件分块存储
            return saveBase64Chunked(database, mediaData, type, id);
        }
        
        throw new Error('不支持的数据类型');
    }
    
    // 进度回调函数（外部设置）
    let progressCallback = null;
    // 进度显示元素
    let progressElement = null;
    
    /**
     * 设置进度回调
     * @param {Function} callback - 回调函数 (current, total, action)
     */
    function setProgressCallback(callback) {
        progressCallback = callback;
    }
    
    /**
     * 显示进度条
     * @param {string} message - 消息内容
     */
    function showProgressToast(message) {
        // 创建或更新进度显示元素
        if (!progressElement) {
            progressElement = document.createElement('div');
            progressElement.id = 'mediaStorageProgress';
            progressElement.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                background: #2196F3;
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                z-index: 10001;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(progressElement);
        }
        progressElement.textContent = message;
    }
    
    /**
     * 隐藏进度显示
     */
    function hideProgressToast() {
        if (progressElement && progressElement.parentNode) {
            progressElement.parentNode.removeChild(progressElement);
            progressElement = null;
        }
    }
    
    /**
     * 报告进度
     * @param {number} current - 当前进度
     * @param {number} total - 总数
     * @param {string} action - 动作 ('saving' 或 'loading')
     */
    function reportProgress(current, total, action) {
        const percent = Math.round(current / total * 100);
        const actionText = action === 'saving' ? '保存中' : '加载中';
        showProgressToast(`${actionText}: ${current}/${total} (${percent}%)`);
        
        if (progressCallback) {
            progressCallback(current, total, action);
        }
    }
    
    /**
     * 分块保存 Blob/File（直接存储二进制，不转换 base64）
     * @param {IDBDatabase} database - 数据库实例
     * @param {Blob|File} blob - 文件数据
     * @param {string} type - 媒体类型
     * @param {string} id - 媒体 ID
     * @returns {Promise<string>} - 返回媒体 ID
     */
    async function saveBlobChunked(database, blob, type, id) {
        const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
        const chunks = [];
        const mimeType = blob.type || 'application/octet-stream';
        
        // 显示开始提示
        showProgressToast(`保存中: 0/${totalChunks} (0%)`);
        
        // 分块保存
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, blob.size);
            const chunkBlob = blob.slice(start, end);
            const chunkId = `${id}_chunk_${i}`;
            
            // 报告进度
            reportProgress(i + 1, totalChunks, 'saving');
            
            // 将 Blob 转换为 ArrayBuffer 存储
            const arrayBuffer = await chunkBlob.arrayBuffer();
            
            await new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const request = store.put({
                    id: chunkId,
                    data: arrayBuffer,  // 存储二进制数据
                    type: 'blobChunk',
                    parentId: id,
                    chunkIndex: i,
                    timestamp: Date.now()
                });
                
                request.onsuccess = () => {
                    chunks.push(chunkId);
                    resolve();
                };
                
                request.onerror = () => {
                    console.error(`MediaStorage: 保存分块 ${i} 失败`, request.error);
                    reject(request.error);
                };
            });
            
        }
        
        // 保存主记录
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.put({
                id: id,
                type: type,
                chunked: true,
                blobChunked: true,  // 标记为二进制分块
                mimeType: mimeType,
                chunks: chunks,
                totalSize: blob.size,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => {
                resolve(id);
            };
            
            request.onerror = () => {
                console.error('MediaStorage: 保存主记录失败', request.error);
                reject(request.error);
            };
        });
    }
    
    /**
     * 分块保存 base64 字符串
     * @param {IDBDatabase} database - 数据库实例
     * @param {string} mediaData - base64 媒体数据 (data URL 格式)
     * @param {string} type - 媒体类型
     * @param {string} id - 媒体 ID
     * @returns {Promise<string>} - 返回媒体 ID
     */
    async function saveBase64Chunked(database, mediaData, type, id) {
        // 分离 header 和 base64 数据
        const commaIndex = mediaData.indexOf(',');
        const header = mediaData.substring(0, commaIndex + 1);
        const base64Data = mediaData.substring(commaIndex + 1);
        
        const chunks = [];
        const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
        
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, base64Data.length);
            const chunkData = base64Data.substring(start, end);
            const chunkId = `${id}_chunk_${i}`;
            
            await new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const request = store.put({
                    id: chunkId,
                    data: chunkData,
                    type: 'chunk',
                    parentId: id,
                    chunkIndex: i,
                    timestamp: Date.now()
                });
                
                request.onsuccess = () => {
                    chunks.push(chunkId);
                    resolve();
                };
                
                request.onerror = () => reject(request.error);
            });
        }
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.put({
                id: id,
                type: type,
                chunked: true,
                header: header,
                chunks: chunks,
                totalSize: base64Data.length,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * 从 IndexedDB 获取媒体数据（支持分块读取）
     * @param {string} mediaId - 媒体 ID
     * @returns {Promise<string|null>} - 返回 base64 媒体数据或 null
     */
    async function getMedia(mediaId) {
        const database = await initDB();
        
        // 先获取主记录
        const record = await new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(mediaId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        if (!record) {
            return null;
        }
        
        // 如果是分块存储的文件，需要读取所有分块并合并
        if (record.chunked && record.chunks) {
            return getMediaChunked(database, record.chunks);
        }
        
        // 普通文件直接返回数据
        return record.data;
    }
    
    /**
     * 读取分块数据并合并为字符串
     * @param {IDBDatabase} database - 数据库实例
     * @param {string[]} chunkIds - 分块 ID 列表
     * @returns {Promise<string>} - 合并后的数据
     */
    async function getMediaChunked(database, chunkIds) {
        const chunks = [];
        
        for (let i = 0; i < chunkIds.length; i++) {
            const chunkId = chunkIds[i];
            
            const chunkData = await new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(chunkId);
                
                request.onsuccess = () => {
                    if (request.result) {
                        resolve(request.result.data);
                    } else {
                        console.error(`MediaStorage: 分块 ${chunkId} 不存在`);
                        resolve(null);
                    }
                };
                
                request.onerror = () => {
                    console.error(`MediaStorage: 读取分块 ${chunkId} 失败`, request.error);
                    reject(request.error);
                };
            });
            
            if (chunkData === null) {
                throw new Error(`分块 ${i} 数据丢失`);
            }
            
            chunks.push(chunkData);
        }
        
        // 合并所有分块
        return chunks.join('');
    }
    
    /**
     * 获取分块存储的文件，直接返回 Blob
     * @param {string} mediaId - 媒体 ID
     * @returns {Promise<Blob|null>} - 返回 Blob 或 null
     */
    async function getChunkedBlob(mediaId) {
        const database = await initDB();
        
        // 先获取主记录
        const record = await new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(mediaId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        if (!record) {
            console.error('MediaStorage: 记录不存在', mediaId);
            return null;
        }
        
        // 确定 MIME 类型
        let mimeType = record.mimeType || 'application/octet-stream';
        
        // 如果是分块存储
        if (record.chunked && record.chunks) {
            // 显示开始提示
            showProgressToast(`加载中: 0/${record.chunks.length} (0%)`);
            
            const blobParts = [];
            
            // 二进制分块（新格式）
            if (record.blobChunked) {
                for (let i = 0; i < record.chunks.length; i++) {
                    const chunkId = record.chunks[i];
                    
                    // 报告进度
                    reportProgress(i + 1, record.chunks.length, 'loading');
                    
                    const chunkData = await new Promise((resolve, reject) => {
                        const transaction = database.transaction([STORE_NAME], 'readonly');
                        const store = transaction.objectStore(STORE_NAME);
                        const request = store.get(chunkId);
                        
                        request.onsuccess = () => resolve(request.result?.data);
                        request.onerror = () => reject(request.error);
                    });
                    
                    if (!chunkData) {
                        throw new Error(`分块 ${i} 数据丢失`);
                    }
                    
                    // ArrayBuffer 直接添加
                    blobParts.push(chunkData);
                }
                
                return new Blob(blobParts, { type: mimeType });
            }
            
            // base64 分块（旧格式兼容）
            if (record.header) {
                const mimeMatch = record.header.match(/data:([^;]+)/);
                if (mimeMatch) {
                    mimeType = mimeMatch[1];
                }
            }
            
            for (let i = 0; i < record.chunks.length; i++) {
                const chunkId = record.chunks[i];
                
                const chunkData = await new Promise((resolve, reject) => {
                    const transaction = database.transaction([STORE_NAME], 'readonly');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.get(chunkId);
                    
                    request.onsuccess = () => resolve(request.result?.data);
                    request.onerror = () => reject(request.error);
                });
                
                if (!chunkData) {
                    throw new Error(`分块 ${i} 数据丢失`);
                }
                
                // 解码 base64 为二进制
                try {
                    const binaryString = atob(chunkData);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) {
                        bytes[j] = binaryString.charCodeAt(j);
                    }
                    blobParts.push(bytes);
                } catch (e) {
                    console.error(`解码分块 ${i} 失败:`, e);
                    throw new Error(`分块 ${i} 解码失败`);
                }
                
            }
            
            return new Blob(blobParts, { type: mimeType });
        }
        
        // 非分块文件，直接转换
        if (record.data) {
            if (typeof record.data === 'string') {
                const commaIndex = record.data.indexOf(',');
                if (commaIndex === -1) {
                    console.error('MediaStorage: 数据格式错误');
                    return null;
                }
                
                const header = record.data.substring(0, commaIndex);
                const base64Data = record.data.substring(commaIndex + 1);
                
                const mimeMatch = header.match(/data:([^;]+)/);
                if (mimeMatch) {
                    mimeType = mimeMatch[1];
                }
                
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                return new Blob([bytes], { type: mimeType });
            }
            
            // ArrayBuffer
            if (record.data instanceof ArrayBuffer) {
                return new Blob([record.data], { type: mimeType });
            }
        }
        
        return null;
    }
    
    /**
     * 删除媒体数据（支持删除分块数据）
     * @param {string} mediaId - 媒体 ID
     * @returns {Promise<void>}
     */
    async function deleteMedia(mediaId) {
        const database = await initDB();
        
        // 先获取记录，检查是否是分块存储
        const record = await new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(mediaId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        // 如果是分块存储，先删除所有分块
        if (record && record.chunked && record.chunks) {
            for (const chunkId of record.chunks) {
                await new Promise((resolve, reject) => {
                    const transaction = database.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.delete(chunkId);
                    
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        }
        
        // 删除主记录
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(mediaId);
            
            request.onsuccess = () => {
                resolve();
            };
            
            request.onerror = () => {
                console.error('MediaStorage: 删除媒体失败', request.error);
                reject(request.error);
            };
        });
    }
    
    /**
     * 获取所有媒体 ID
     * @returns {Promise<string[]>}
     */
    async function getAllMediaIds() {
        const database = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAllKeys();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    /**
     * 清理孤立数据（删除没有对应 DOM 元素的媒体数据）
     * @returns {Promise<number>} - 返回删除的数量
     */
    async function cleanupOrphanedData() {
        const allIds = await getAllMediaIds();
        
        // 过滤出主记录 ID（排除 _chunk_ 分块）
        const mainIds = allIds.filter(id => !id.includes('_chunk_'));
        
        // 获取页面中所有使用的 storage ID
        const usedIds = new Set();
        document.querySelectorAll('[data-media-storage-id]').forEach(el => {
            usedIds.add(el.getAttribute('data-media-storage-id'));
        });
        
        // 找出孤立的 ID
        const orphanedIds = mainIds.filter(id => !usedIds.has(id));
        
        // 删除孤立数据
        let deletedCount = 0;
        for (const id of orphanedIds) {
            try {
                await deleteMedia(id);
                deletedCount++;
            } catch (err) {
                console.error('清理孤立数据失败:', id, err);
            }
        }
        
        return deletedCount;
    }
    
    /**
     * 清空所有媒体数据
     * @returns {Promise<void>}
     */
    async function clearAll() {
        const database = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => {
                resolve();
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    /**
     * 获取媒体数据作为可用于 src 的 URL
     * 对于 base64 存储的返回 data URL，对于分块存储的返回 Blob URL
     * @param {string} mediaId - 媒体 ID
     * @returns {Promise<string|null>} - 返回 URL 或 null
     */
    async function getMediaAsUrl(mediaId) {
        const database = await initDB();
        
        // 获取记录信息
        const record = await new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(mediaId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        if (!record) return null;
        
        // 分块存储：使用 Blob URL
        if (record.chunked) {
            const blob = await getChunkedBlob(mediaId);
            if (blob) {
                return URL.createObjectURL(blob);
            }
            return null;
        }
        
        // base64 存储：直接返回
        return record.data || null;
    }
    
    /**
     * 处理 HTML 内容，从 IndexedDB 恢复媒体数据（视频和图片）
     * 支持 data-media-storage-id 属性，支持分块存储
     * @param {string} html - 包含媒体引用的 HTML
     * @returns {Promise<string>} - 恢复后的 HTML
     */
    async function processHtmlForLoad(html) {
        if (!html) return html;
        
        let result = html;
        
        // 处理视频（新属性 data-media-storage-id）
        if (result.includes('data-media-storage-id')) {
            const videoRegex = /<video([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            let match;
            const videoReplacements = [];
            
            while ((match = videoRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const mediaId = match[2];
                // 使用新的函数，支持分块存储
                const mediaUrl = await getMediaAsUrl(mediaId);
                
                if (mediaUrl) {
                    let newTag = fullMatch;
                    if (/\ssrc=["'][^"']*["']/.test(newTag)) {
                        newTag = newTag.replace(/\ssrc=["'][^"']*["']/, ` src="${mediaUrl}"`);
                    } else {
                        newTag = newTag.replace('<video', `<video src="${mediaUrl}"`);
                    }
                    videoReplacements.push({ from: fullMatch, to: newTag });
                }
            }
            
            for (const { from, to } of videoReplacements) {
                result = result.replace(from, to);
            }
        }
        
        // 处理图片
        if (result.includes('data-media-storage-id')) {
            const imgRegex = /<img([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            let match;
            const imgReplacements = [];
            
            while ((match = imgRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const mediaId = match[2];
                // 使用新的函数，支持分块存储
                const mediaUrl = await getMediaAsUrl(mediaId);
                
                if (mediaUrl) {
                    let newTag = fullMatch;
                    if (/\ssrc=["'][^"']*["']/.test(newTag)) {
                        newTag = newTag.replace(/\ssrc=["'][^"']*["']/, ` src="${mediaUrl}"`);
                    } else {
                        newTag = newTag.replace('<img', `<img src="${mediaUrl}"`);
                    }
                    imgReplacements.push({ from: fullMatch, to: newTag });
                }
            }
            
            for (const { from, to } of imgReplacements) {
                result = result.replace(from, to);
            }
        }
        
        // 压缩文件附件：不需要在 HTML 中嵌入数据
        // 下载时直接从 IndexedDB 获取（通过 data-media-storage-id）
        // 这样可以支持大文件，避免 HTML 属性过大导致数据丢失
        
        return result;
    }
    
    /**
     * 处理 HTML 内容用于导出（将 IndexedDB 中的媒体数据嵌入）
     * @param {string} html - 包含媒体引用的 HTML
     * @returns {Promise<string>} - 导出用的 HTML
     */
    async function processHtmlForExport(html) {
        return await processHtmlForLoad(html);
    }
    
    // 初始化数据库
    initDB().catch(err => {
        console.error('MediaStorage: 初始化失败', err);
    });
    
    // 公开 API
    return {
        // 通用媒体 API
        saveMedia,
        getMedia,
        getChunkedBlob,  // 大文件下载专用（直接返回 Blob）
        getMediaAsUrl,   // 获取媒体 URL（支持分块存储）
        setProgressCallback,  // 设置进度回调
        hideProgressToast,    // 隐藏进度提示
        deleteMedia,
        cleanupOrphanedData,  // 清理孤立数据
        getAllMediaIds,
        clearAll,
        processHtmlForLoad,
        processHtmlForExport,
        generateMediaId,
        
        // 视频专用 API
        saveVideo: (data, id) => saveMedia(data, 'video', id),
        generateVideoId: () => generateMediaId('video'),
        
        // 图片专用 API
        saveImage: (data, id) => saveMedia(data, 'image', id),
        generateImageId: () => generateMediaId('image'),
        
        // 压缩文件专用 API
        saveArchive: (data, id) => saveMedia(data, 'archive', id),
        generateArchiveId: () => generateMediaId('archive'),
        
        // 通用别名（兼容简化调用）
        save: saveMedia,
        get: getMedia
    };
})();

