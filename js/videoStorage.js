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
    
    /**
     * 保存媒体数据到 IndexedDB
     * @param {string} mediaData - base64 媒体数据
     * @param {string} type - 媒体类型 ('video' 或 'image')
     * @param {string} [mediaId] - 可选的媒体 ID，不提供则自动生成
     * @returns {Promise<string>} - 返回媒体 ID
     */
    async function saveMedia(mediaData, type = 'media', mediaId = null) {
        const database = await initDB();
        const id = mediaId || generateMediaId(type);
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.put({
                id: id,
                data: mediaData,
                type: type,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => {
                resolve(id);
            };
            
            request.onerror = () => {
                console.error('MediaStorage: 保存媒体失败', request.error);
                reject(request.error);
            };
        });
    }
    
    /**
     * 从 IndexedDB 获取媒体数据
     * @param {string} mediaId - 媒体 ID
     * @returns {Promise<string|null>} - 返回 base64 媒体数据或 null
     */
    async function getMedia(mediaId) {
        const database = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(mediaId);
            
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.data);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                console.error('MediaStorage: 获取媒体失败', request.error);
                reject(request.error);
            };
        });
    }
    
    /**
     * 删除媒体数据
     * @param {string} mediaId - 媒体 ID
     * @returns {Promise<void>}
     */
    async function deleteMedia(mediaId) {
        const database = await initDB();
        
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
     * 处理 HTML 内容，从 IndexedDB 恢复媒体数据（视频和图片）
     * 支持 data-media-storage-id 属性
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
                const mediaData = await getMedia(mediaId);
                
                if (mediaData) {
                    let newTag = fullMatch;
                    if (/\ssrc=["'][^"']*["']/.test(newTag)) {
                        newTag = newTag.replace(/\ssrc=["'][^"']*["']/, ` src="${mediaData}"`);
                    } else {
                        newTag = newTag.replace('<video', `<video src="${mediaData}"`);
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
                const mediaData = await getMedia(mediaId);
                
                if (mediaData) {
                    let newTag = fullMatch;
                    if (/\ssrc=["'][^"']*["']/.test(newTag)) {
                        newTag = newTag.replace(/\ssrc=["'][^"']*["']/, ` src="${mediaData}"`);
                    } else {
                        newTag = newTag.replace('<img', `<img src="${mediaData}"`);
                    }
                    imgReplacements.push({ from: fullMatch, to: newTag });
                }
            }
            
            for (const { from, to } of imgReplacements) {
                result = result.replace(from, to);
            }
        }
        
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
        deleteMedia,
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
        generateImageId: () => generateMediaId('image')
    };
})();

