const MediaStorage = (function() {
    const DB_NAME = 'SoraDirectoryMediaDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'media';
    let db = null;
    const processedContentCache = new Map();
    const mediaUrlCache = new Map();
    /**
     * 简单哈希函数，用于生成缓存键
     * @param {string} str - 要哈希的字符串
     * @returns {string} - 哈希值
     */
function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; 
        }
        return hash.toString(36);
    }
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
                console.error('MediaStorage: 无法打开 IndexedDB', request.error);
                reject(request.error);
            };
            request.onsuccess = () => {
                db = request.result;
                db.onversionchange = () => {
                    db.close();
                    db = null;
                };
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

    function requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function getRecord(database, id) {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        return requestToPromise(store.get(id));
    }

    function readChunkRecords(database, chunkIds, onChunk) {
        return new Promise((resolve, reject) => {
            if (!chunkIds || chunkIds.length === 0) {
                resolve();
                return;
            }
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            let index = 0;

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);

            const readNext = () => {
                if (index >= chunkIds.length) return;
                const currentIndex = index;
                const chunkId = chunkIds[index++];
                const request = store.get(chunkId);
                request.onsuccess = () => {
                    try {
                        onChunk(request.result, currentIndex, chunkId);
                        readNext();
                    } catch (err) {
                        reject(err);
                    }
                };
                request.onerror = (event) => {
                    event.preventDefault();
                    reject(request.error);
                };
            };

            readNext();
        });
    }

    function enqueueChunk(controller, chunkRecord, index, blobChunked) {
        const chunkData = chunkRecord && chunkRecord.data;
        if (!chunkData) {
            throw new Error(`分块 ${index} 数据丢失`);
        }
        if (blobChunked) {
            if (chunkData instanceof ArrayBuffer) {
                controller.enqueue(new Uint8Array(chunkData));
                return;
            }
            if (chunkData instanceof Uint8Array) {
                controller.enqueue(chunkData);
                return;
            }
            throw new Error(`分块 ${index} 数据格式错误`);
        }

        try {
            const binaryString = atob(chunkData);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
            }
            controller.enqueue(bytes);
        } catch (err) {
            throw new Error(`分块 ${index} 解码失败`);
        }
    }

    function createChunkedStream(database, record) {
        showProgressToast(`加载中: 0/${record.chunks.length} (0%)`);
        return new ReadableStream({
            async start(controller) {
                try {
                    await readChunkRecords(database, record.chunks, (chunkRecord, index) => {
                        reportProgress(index + 1, record.chunks.length, 'loading');
                        enqueueChunk(controller, chunkRecord, index, !!record.blobChunked);
                    });
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
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
    const CHUNK_SIZE = 10 * 1024 * 1024;
    const HTML_EXPORT_CHUNK_SIZE = 1024 * 1024;

    function bytesToBase64(bytes) {
        const parts = [];
        const batchSize = 0x8000;
        for (let i = 0; i < bytes.length; i += batchSize) {
            parts.push(String.fromCharCode(...bytes.subarray(i, i + batchSize)));
        }
        return btoa(parts.join(''));
    }

    function getRecordMimeType(record) {
        let mimeType = record && record.mimeType ? record.mimeType : 'application/octet-stream';
        const source = record && (record.header || (typeof record.data === 'string' ? record.data : ''));
        const mimeMatch = source && source.match(/^data:([^;,]+)/i);
        if (mimeMatch) mimeType = mimeMatch[1];
        return mimeType;
    }

    function detectMediaMimeType(bytes, fallback, mediaType) {
        if (fallback && fallback !== 'application/octet-stream') return fallback;
        if (bytes && bytes.length >= 12) {
            const ascii = (start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
            if (ascii(4, 4) === 'ftyp') return 'video/mp4';
            if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
            if (ascii(0, 4) === 'OggS') return mediaType === 'audio' ? 'audio/ogg' : 'video/ogg';
            if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'AVI ') return 'video/x-msvideo';
        }
        return fallback || 'application/octet-stream';
    }

    async function exportMediaChunks(mediaId, onChunk, chunkSize = HTML_EXPORT_CHUNK_SIZE) {
        if (typeof onChunk !== 'function') {
            throw new Error('缺少媒体分块处理函数');
        }
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        if (!record) throw new Error(`媒体不存在: ${mediaId}`);

        const safeChunkSize = Math.max(256 * 1024, Number(chunkSize) || HTML_EXPORT_CHUNK_SIZE);
        const base64ChunkSize = Math.max(4, Math.floor((safeChunkSize * 4 / 3) / 4) * 4);
        let mimeType = getRecordMimeType(record);
        let firstBytes = null;
        let chunkCount = 0;
        let rawSize = 0;

        const emitBytes = async (value) => {
            const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
            if (!firstBytes && bytes.length) firstBytes = bytes.subarray(0, Math.min(bytes.length, 32));
            for (let offset = 0; offset < bytes.length; offset += safeChunkSize) {
                const part = bytes.subarray(offset, Math.min(offset + safeChunkSize, bytes.length));
                rawSize += part.byteLength;
                await onChunk(bytesToBase64(part), chunkCount++);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        };

        const emitBase64 = async (value) => {
            const base64 = String(value || '').replace(/\s+/g, '');
            for (let offset = 0; offset < base64.length; offset += base64ChunkSize) {
                const part = base64.slice(offset, Math.min(offset + base64ChunkSize, base64.length));
                if (!part) continue;
                if (!firstBytes) {
                    const sample = atob(part.slice(0, Math.min(part.length, 44)));
                    firstBytes = Uint8Array.from(sample, char => char.charCodeAt(0));
                }
                rawSize += Math.floor(part.length * 3 / 4) - ((part.endsWith('==')) ? 2 : (part.endsWith('=') ? 1 : 0));
                await onChunk(part, chunkCount++);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        };

        if (record.chunked && Array.isArray(record.chunks)) {
            for (let i = 0; i < record.chunks.length; i++) {
                const chunkRecord = await getRecord(database, record.chunks[i]);
                if (!chunkRecord || chunkRecord.data == null) {
                    throw new Error(`媒体分块 ${i} 数据丢失`);
                }
                if (record.blobChunked) {
                    await emitBytes(chunkRecord.data);
                } else {
                    await emitBase64(chunkRecord.data);
                }
            }
        } else if (typeof record.data === 'string') {
            const commaIndex = record.data.indexOf(',');
            await emitBase64(commaIndex >= 0 ? record.data.slice(commaIndex + 1) : record.data);
        } else if (record.data instanceof ArrayBuffer || record.data instanceof Uint8Array) {
            await emitBytes(record.data);
        } else {
            throw new Error(`媒体格式不支持: ${mediaId}`);
        }

        mimeType = detectMediaMimeType(firstBytes, mimeType, record.type);
        return {
            id: mediaId,
            type: record.type || 'media',
            mimeType,
            size: Number.isFinite(record.totalSize) && record.blobChunked ? record.totalSize : rawSize,
            chunkCount
        };
    }
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
    async function saveBlobChunked(database, blob, type, id) {
        const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
        const chunks = [];
        const mimeType = blob.type || 'application/octet-stream';
        showProgressToast(`保存中: 0/${totalChunks} (0%)`);
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, blob.size);
            const chunkBlob = blob.slice(start, end);
            const chunkId = `${id}_chunk_${i}`;
            reportProgress(i + 1, totalChunks, 'saving');
            const arrayBuffer = await chunkBlob.arrayBuffer();
            await new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({
                    id: chunkId,
                    data: arrayBuffer,  
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
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({
                id: id,
                type: type,
                chunked: true,
                blobChunked: true,  
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
    async function saveBase64Chunked(database, mediaData, type, id) {
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
    async function getMedia(mediaId) {
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        if (!record) {
            return null;
        }
        if (record.chunked && record.chunks) {
            return getMediaChunked(database, record.chunks);
        }
        return record.data;
    }
    async function getMediaChunked(database, chunkIds) {
        const chunks = [];
        await readChunkRecords(database, chunkIds, (chunkRecord, index, chunkId) => {
            if (!chunkRecord) {
                throw new Error(`分块 ${index} 数据丢失: ${chunkId}`);
            }
            chunks.push(chunkRecord.data);
        });
        return chunks.join('');
    }
    async function getChunkedBlobStream(mediaId) {
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        if (!record) {
            console.error('MediaStorage: 记录不存在', mediaId);
            return null;
        }
        if (record.chunked && record.chunks) {
            return createChunkedStream(database, record);
        }
        return null;
    }
    async function getChunkedBlob(mediaId) {
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        if (!record) {
            console.error('MediaStorage: 记录不存在', mediaId);
            return null;
        }
        let mimeType = record.mimeType || 'application/octet-stream';
        if (record.chunked && record.chunks) {
            if (record.header) {
                const mimeMatch = record.header.match(/data:([^;]+)/);
                if (mimeMatch) {
                    mimeType = mimeMatch[1];
                }
            }
            const stream = createChunkedStream(database, record);
            const response = new Response(stream, { headers: { 'Content-Type': mimeType } });
            return await response.blob();
        }
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
            if (record.data instanceof ArrayBuffer) {
                return new Blob([record.data], { type: mimeType });
            }
        }
        return null;
    }
    async function deleteMedia(mediaId) {
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const keys = record && record.chunked && record.chunks
                ? record.chunks.concat(mediaId)
                : [mediaId];
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            keys.forEach(key => store.delete(key));
        });
    }
    async function mediaExists(mediaId) {
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        return !!record;
    }
    async function getMediaInfo(mediaId) {
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        if (!record) return null;
        let mimeType = record.mimeType || 'application/octet-stream';
        if (record.header) {
            const mimeMatch = record.header.match(/data:([^;]+)/);
            if (mimeMatch) mimeType = mimeMatch[1];
        } else if (typeof record.data === 'string') {
            const mimeMatch = record.data.match(/^data:([^;]+)/);
            if (mimeMatch) mimeType = mimeMatch[1];
        }
        let size = null;
        if (Number.isFinite(record.totalSize)) {
            size = record.blobChunked ? record.totalSize : Math.max(0, Math.floor(record.totalSize * 3 / 4));
        } else if (record.data instanceof ArrayBuffer) {
            size = record.data.byteLength;
        } else if (typeof record.data === 'string') {
            const commaIndex = record.data.indexOf(',');
            const payloadLength = commaIndex >= 0 ? record.data.length - commaIndex - 1 : record.data.length;
            const padding = record.data.endsWith('==') ? 2 : (record.data.endsWith('=') ? 1 : 0);
            size = Math.max(0, Math.floor(payloadLength * 3 / 4) - padding);
        }
        return {
            id: mediaId,
            type: record.type || 'media',
            mimeType,
            size,
            chunked: !!record.chunked,
            blobChunked: !!record.blobChunked
        };
    }
    async function writeMediaToWritable(mediaId, writable) {
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        if (!record) {
            throw new Error(`媒体不存在: ${mediaId}`);
        }
        if (record.chunked && record.chunks && record.blobChunked) {
            showProgressToast(`导出中: 0/${record.chunks.length} (0%)`);
            for (let i = 0; i < record.chunks.length; i++) {
                const chunkRecord = await getRecord(database, record.chunks[i]);
                if (!chunkRecord || !chunkRecord.data) {
                    throw new Error(`分块 ${i} 数据丢失`);
                }
                reportProgress(i + 1, record.chunks.length, 'loading');
                await writable.write(chunkRecord.data);
            }
            return record.totalSize || 0;
        }
        const blob = await getChunkedBlob(mediaId);
        if (!blob) {
            throw new Error(`媒体读取失败: ${mediaId}`);
        }
        await writable.write(blob);
        return blob.size;
    }
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
    async function cleanupOrphanedData() {
        const allIds = await getAllMediaIds();
        const mainIds = allIds.filter(id => !id.includes('_chunk_'));
        const usedIds = new Set();
        document.querySelectorAll('[data-media-storage-id]').forEach(el => {
            usedIds.add(el.getAttribute('data-media-storage-id'));
        });
        if (typeof mulufile !== 'undefined' && Array.isArray(mulufile)) {
            for (const item of mulufile) {
                if (item && item.length === 4) {
                    const content = item[3] || '';
                    const mediaIdMatches = content.match(/data-media-storage-id=["']([^"']+)["']/gi);
                    if (mediaIdMatches) {
                        mediaIdMatches.forEach(match => {
                            const mediaId = match.match(/["']([^"']+)["']/)[1];
                            if (mediaId) usedIds.add(mediaId);
                        });
                    }
                }
            }
        }
        const orphanedIds = mainIds.filter(id => !usedIds.has(id));
        let deletedCount = 0;
        for (const id of orphanedIds) {
            try {
                await deleteMedia(id);
                deletedCount++;
            } catch (err) {
                console.warn(`清理孤立数据 ${id} 失败:`, err);
            }
        }
        const orphanedChunks = allIds.filter(id => {
            if (!id.includes('_chunk_')) return false;
            const mainId = id.replace(/_chunk_\d+$/, '');
            return !mainIds.includes(mainId) || orphanedIds.includes(mainId);
        });
        if (orphanedChunks.length > 0) {
            const database = await initDB();
            for (const chunkId of orphanedChunks) {
                try {
                    await new Promise((resolve, reject) => {
                        const transaction = database.transaction([STORE_NAME], 'readwrite');
                        const store = transaction.objectStore(STORE_NAME);
                        const request = store.delete(chunkId);
                        request.onsuccess = () => {
                            deletedCount++;
                            resolve();
                        };
                        request.onerror = () => {
                            console.warn(`删除孤立分块 ${chunkId} 失败:`, request.error);
                            resolve(); 
                        };
                    });
                } catch (err) {
                    console.warn(`删除孤立分块 ${chunkId} 时出错:`, err);
                }
            }
        }
        return deletedCount;
    }
    async function clearAll() {
        mediaUrlCache.clear();
        processedContentCache.clear();
        const database = await initDB();
        const allKeys = await getAllMediaIds();
        try {
            return new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();
                request.onsuccess = () => {
                    resolve();
                };
                request.onerror = () => {
                    console.warn('clear() 失败，尝试逐个删除:', request.error);
                    deleteAllKeys(database, allKeys).then(resolve).catch(reject);
                };
            });
        } catch (err) {
            console.warn('清空数据库时出错，尝试逐个删除:', err);
            return deleteAllKeys(database, allKeys);
        }
    }
    async function deleteAllKeys(database, keys) {
        if (!keys || keys.length === 0) {
            return;
        }
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize);
            await Promise.all(
                batch.map(key => {
                    return new Promise((resolve, reject) => {
                        const transaction = database.transaction([STORE_NAME], 'readwrite');
                        const store = transaction.objectStore(STORE_NAME);
                        const request = store.delete(key);
                        request.onsuccess = () => resolve();
                        request.onerror = () => {
                            console.warn(`删除键 ${key} 失败:`, request.error);
                            resolve(); 
                        };
                    });
                })
            );
        }
    }
    async function getMediaAsUrl(mediaId) {
        const cachedUrl = mediaUrlCache.get(mediaId);
        if (cachedUrl) {
            return cachedUrl;
        }
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        if (!record) return null;
        if (record.chunked) {
            const blob = await getChunkedBlob(mediaId);
            if (blob) {
                const blobUrl = URL.createObjectURL(blob);
                mediaUrlCache.set(mediaId, blobUrl);
                return blobUrl;
            }
            return null;
        }
        return record.data || null;
    }
    async function processHtmlForLoad(html, useCache = true) {
        if (!html) return html;
        if (useCache) {
            const cacheKey = html.length < 10000 ? html : hashString(html);
            const cached = processedContentCache.get(cacheKey);
            if (cached) {
                if (html.length >= 10000) {
                    if (cached.fullContent === html) {
                        return cached.processedContent;
                    }
                } else {
                    return cached.processedContent;
                }
            }
        }
        let result = html;
        if (result.includes('data-media-storage-id')) {
            const videoRegex = /<video([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            let match;
            const videoReplacements = [];
            while ((match = videoRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const mediaId = match[2];
                const srcMatch = fullMatch.match(/\ssrc=["']([^"']+)["']/);
                const existingSrc = srcMatch ? srcMatch[1] : '';
                if (existingSrc && existingSrc.startsWith('data:') && !existingSrc.includes('about:blank')) {
                    try {
                        const exists = await mediaExists(mediaId);
                        if (!exists) {
                            await saveMedia(existingSrc, 'video', mediaId);
                        }
                    } catch (err) {
                        console.error('保存视频到 IndexedDB 失败:', err);
                    }
                    continue; 
                }
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
        if (result.includes('data-media-storage-id')) {
            const imgRegex = /<img([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            let match;
            const imgReplacements = [];
            while ((match = imgRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const mediaId = match[2];
                const srcMatch = fullMatch.match(/\ssrc=["']([^"']+)["']/);
                const existingSrc = srcMatch ? srcMatch[1] : '';
                if (existingSrc && existingSrc.startsWith('data:') && !existingSrc.includes('about:blank')) {
                    try {
                        const exists = await mediaExists(mediaId);
                        if (!exists) {
                            await saveMedia(existingSrc, 'image', mediaId);
                        }
                    } catch (err) {
                        console.error('保存图片到 IndexedDB 失败:', err);
                    }
                    continue; 
                }
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
        if (result.includes('src="data:')) {
            const imgRegex = /<img([^>]*)\ssrc=["'](data:[^"']+)["']([^>]*)>/gi;
            let match;
            const imgReplacements = [];
            while ((match = imgRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const beforeSrc = match[1];
                const dataUrl = match[2];
                const afterSrc = match[3];
                if (fullMatch.includes('data-media-storage-id')) {
                    continue;
                }
                try {
                    const mediaId = generateMediaId('image');
                    await saveMedia(dataUrl, 'image', mediaId);
                    let newTag = fullMatch;
                    newTag = newTag.replace('<img', `<img data-media-storage-id="${mediaId}"`);
                    imgReplacements.push({ from: fullMatch, to: newTag });
                } catch (err) {
                    console.error('保存图片到 IndexedDB 失败:', err);
                }
            }
            for (const { from, to } of imgReplacements) {
                result = result.replace(from, to);
            }
            const videoRegex = /<video([^>]*)\ssrc=["'](data:[^"']+)["']([^>]*)>/gi;
            const videoReplacements = [];
            while ((match = videoRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const beforeSrc = match[1];
                const dataUrl = match[2];
                const afterSrc = match[3];
                if (fullMatch.includes('data-media-storage-id')) {
                    continue;
                }
                try {
                    const mediaId = generateMediaId('video');
                    await saveMedia(dataUrl, 'video', mediaId);
                    let newTag = fullMatch;
                    newTag = newTag.replace('<video', `<video data-media-storage-id="${mediaId}"`);
                    videoReplacements.push({ from: fullMatch, to: newTag });
                } catch (err) {
                    console.error('保存视频到 IndexedDB 失败:', err);
                }
            }
            for (const { from, to } of videoReplacements) {
                result = result.replace(from, to);
            }
        }
        if (result.includes('archive-attachment')) {
            const archiveRegex = /<div([^>]*)class=["']archive-attachment["']([^>]*)>/gi;
            let match;
            const archiveReplacements = [];
            while ((match = archiveRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                if (!fullMatch.includes('data-media-storage-id')) {
                    console.warn('发现压缩包元素缺少 data-media-storage-id 属性');
                }
            }
        }
        if (useCache) {
            const cacheKey = html.length < 10000 ? html : hashString(html);
            processedContentCache.set(cacheKey, {
                fullContent: html,
                processedContent: result
            });
            if (processedContentCache.size > 1000) {
                const firstKey = processedContentCache.keys().next().value;
                processedContentCache.delete(firstKey);
            }
        }
        return result;
    }
    async function preloadAllDirectoryContent(mulufile) {
        if (!mulufile || !Array.isArray(mulufile)) {
            return;
        }
        const contentsToProcess = [];
        for (const item of mulufile) {
            if (item && item.length === 4) {
                const content = item[3] || '';
                if (content && content.includes('data-media-storage-id')) {
                    contentsToProcess.push(content);
                }
            }
        }
        if (contentsToProcess.length === 0) {
            return;
        }
        const batchSize = 10;
        for (let i = 0; i < contentsToProcess.length; i += batchSize) {
            const batch = contentsToProcess.slice(i, i + batchSize);
            await Promise.all(
                batch.map(content => processHtmlForLoad(content, true))
            );
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        console.log(`已预加载 ${contentsToProcess.length} 个目录的媒体内容`);
    }
    async function getMediaAsDataUrl(mediaId) {
        const database = await initDB();
        const record = await getRecord(database, mediaId);
        if (!record) return null;
        if (!record.chunked) {
            return record.data || null;
        }
        const blob = await getChunkedBlob(mediaId);
        if (!blob) return null;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }
    async function processHtmlForExport(html, options = {}) {
        if (!html) return html;
        let result = html;
        let totalMediaCount = 0;
        let processedCount = 0;
        if (result.includes('data-media-storage-id')) {
            const allMatches = result.match(/data-media-storage-id=["']([^"']+)["']/gi);
            totalMediaCount = allMatches ? allMatches.length : 0;
        }
        if (!options.skipVideo && result.includes('data-media-storage-id')) {
            const videoRegex = /<video([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            let match;
            const videoReplacements = [];
            while ((match = videoRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const mediaId = match[2];
                const srcMatch = fullMatch.match(/\ssrc=["']([^"']+)["']/);
                const existingSrc = srcMatch ? srcMatch[1] : '';
                if (existingSrc && existingSrc.startsWith('data:') && !existingSrc.includes('about:blank')) {
                    continue; 
                }
                processedCount++;
                if (totalMediaCount > 1) {
                    showProgressToast(`正在处理媒体文件... (${processedCount}/${totalMediaCount})`);
                }
                const dataUrl = await getMediaAsDataUrl(mediaId);
                if (dataUrl) {
                    let newTag = fullMatch;
                    if (/\ssrc=["'][^"']*["']/.test(newTag)) {
                        newTag = newTag.replace(/\ssrc=["'][^"']*["']/, ` src="${dataUrl}"`);
                    } else {
                        newTag = newTag.replace('<video', `<video src="${dataUrl}"`);
                    }
                    videoReplacements.push({ from: fullMatch, to: newTag });
                }
            }
            for (const { from, to } of videoReplacements) {
                result = result.replace(from, to);
            }
        }
        if (result.includes('data-media-storage-id')) {
            const imgRegex = /<img([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            let match;
            const imgReplacements = [];
            while ((match = imgRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const mediaId = match[2];
                const srcMatch = fullMatch.match(/\ssrc=["']([^"']+)["']/);
                const existingSrc = srcMatch ? srcMatch[1] : '';
                if (existingSrc && existingSrc.startsWith('data:') && !existingSrc.includes('about:blank')) {
                    continue; 
                }
                processedCount++;
                if (totalMediaCount > 1) {
                    showProgressToast(`正在处理媒体文件... (${processedCount}/${totalMediaCount})`);
                }
                const dataUrl = await getMediaAsDataUrl(mediaId);
                if (dataUrl) {
                    let newTag = fullMatch;
                    if (/\ssrc=["'][^"']*["']/.test(newTag)) {
                        newTag = newTag.replace(/\ssrc=["'][^"']*["']/, ` src="${dataUrl}"`);
                    } else {
                        newTag = newTag.replace('<img', `<img src="${dataUrl}"`);
                    }
                    imgReplacements.push({ from: fullMatch, to: newTag });
                }
            }
            for (const { from, to } of imgReplacements) {
                result = result.replace(from, to);
            }
        }
        if (totalMediaCount > 0) {
            hideProgressToast();
        }
        if (result.includes('data-media-storage-id')) {
            const archiveRegex = /<div([^>]*)class=["']archive-attachment["']([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)>/gi;
            const archiveRegex2 = /<div([^>]*)data-media-storage-id=["']([^"']+)["']([^>]*)class=["']archive-attachment["']([^>]*)>/gi;
            for (const regex of [archiveRegex, archiveRegex2]) {
                let match;
                const archiveReplacements = [];
                while ((match = regex.exec(result)) !== null) {
                    const fullMatch = match[0];
                    const mediaId = regex === archiveRegex ? match[3] : match[2];
                    const urlMatch = fullMatch.match(/\sdata-export-url=["']([^"']+)["']/);
                    const existingUrl = urlMatch ? urlMatch[1] : '';
                    if (existingUrl && existingUrl.startsWith('data:') && !existingUrl.includes('about:blank')) {
                        continue; 
                    }
                    const dataUrl = await getMediaAsDataUrl(mediaId);
                    if (dataUrl) {
                        let newTag = fullMatch;
                        if (/\sdata-export-url=["'][^"']*["']/.test(newTag)) {
                            newTag = newTag.replace(/\sdata-export-url=["'][^"']*["']/, ` data-export-url="${dataUrl}"`);
                        } else {
                            newTag = newTag.replace(/>$/, ` data-export-url="${dataUrl}">`);
                        }
                        archiveReplacements.push({ from: fullMatch, to: newTag });
                    }
                }
                for (const { from, to } of archiveReplacements) {
                    result = result.replace(from, to);
                }
            }
        }
        return result;
    }
    initDB().catch(err => {
        console.error('MediaStorage: 初始化失败', err);
    });
    return {
        saveMedia,
        getMedia,
        getChunkedBlob,  
        getChunkedBlobStream,  
        getMediaAsUrl,   
        setProgressCallback,  
        hideProgressToast,    
        deleteMedia,
        mediaExists,
        getMediaInfo,
        exportMediaChunks,
        writeMediaToWritable,
        cleanupOrphanedData,  
        getAllMediaIds,
        clearAll,
        processHtmlForLoad,
        processHtmlForExport,
        generateMediaId,
        saveVideo: (data, id) => saveMedia(data, 'video', id),
        generateVideoId: () => generateMediaId('video'),
        saveImage: (data, id) => saveMedia(data, 'image', id),
        generateImageId: () => generateMediaId('image'),
        saveArchive: (data, id) => saveMedia(data, 'archive', id),
        generateArchiveId: () => generateMediaId('archive'),
        save: saveMedia,
        get: getMedia,
        preloadAllDirectoryContent
    };
})();
window.MediaStorage = MediaStorage;
