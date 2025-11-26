// ============================================
// 视频存储模块 (videoStorage.js)
// 功能：使用 IndexedDB 存储大型视频数据
// 依赖：无（需在其他模块之前加载）
// ============================================

const VideoStorage = (function() {
    const DB_NAME = 'SoraDirectoryVideoDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'videos';
    
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
     * 生成唯一的视频 ID
     * @returns {string}
     */
    function generateVideoId() {
        return 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 保存视频数据到 IndexedDB
     * @param {string} videoData - base64 视频数据
     * @param {string} [videoId] - 可选的视频 ID，不提供则自动生成
     * @returns {Promise<string>} - 返回视频 ID
     */
    async function saveVideo(videoData, videoId = null) {
        const database = await initDB();
        const id = videoId || generateVideoId();
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.put({
                id: id,
                data: videoData,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => {
                resolve(id);
            };
            
            request.onerror = () => {
                console.error('VideoStorage: 保存视频失败', request.error);
                reject(request.error);
            };
        });
    }
    
    /**
     * 从 IndexedDB 获取视频数据
     * @param {string} videoId - 视频 ID
     * @returns {Promise<string|null>} - 返回 base64 视频数据或 null
     */
    async function getVideo(videoId) {
        const database = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(videoId);
            
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.data);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                console.error('VideoStorage: 获取视频失败', request.error);
                reject(request.error);
            };
        });
    }
    
    /**
     * 删除视频数据
     * @param {string} videoId - 视频 ID
     * @returns {Promise<void>}
     */
    async function deleteVideo(videoId) {
        const database = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(videoId);
            
            request.onsuccess = () => {
                resolve();
            };
            
            request.onerror = () => {
                console.error('VideoStorage: 删除视频失败', request.error);
                reject(request.error);
            };
        });
    }
    
    /**
     * 获取所有视频 ID
     * @returns {Promise<string[]>}
     */
    async function getAllVideoIds() {
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
     * 清空所有视频数据
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
     * 处理 HTML 内容，将视频 base64 数据保存到 IndexedDB 并替换为引用
     * @param {string} html - 包含视频的 HTML
     * @returns {Promise<string>} - 处理后的 HTML（视频 src 替换为 ID 引用）
     */
    async function processHtmlForSave(html) {
        if (!html || !html.includes('<video')) {
            return html;
        }
        
        // 匹配所有带有 base64 src 的视频标签
        const videoRegex = /<video([^>]*)\ssrc=["'](data:video\/[^"']+)["']([^>]*)>/gi;
        let match;
        let result = html;
        const replacements = [];
        
        while ((match = videoRegex.exec(html)) !== null) {
            const fullMatch = match[0];
            const beforeSrc = match[1];
            const videoData = match[2];
            const afterSrc = match[3];
            
            // 检查是否已经有 data-video-storage-id
            if (beforeSrc.includes('data-video-storage-id') || afterSrc.includes('data-video-storage-id')) {
                continue; // 已经处理过了
            }
            
            // 保存视频到 IndexedDB
            const videoId = await saveVideo(videoData);
            
            // 创建新的视频标签（使用占位符 src，添加 data-video-storage-id）
            const newTag = `<video${beforeSrc} src="about:blank" data-video-storage-id="${videoId}"${afterSrc}>`;
            
            replacements.push({ from: fullMatch, to: newTag });
        }
        
        // 应用所有替换
        for (const { from, to } of replacements) {
            result = result.replace(from, to);
        }
        
        return result;
    }
    
    /**
     * 处理 HTML 内容，从 IndexedDB 恢复视频数据
     * @param {string} html - 包含视频引用的 HTML
     * @returns {Promise<string>} - 恢复后的 HTML（视频 src 填充为实际数据）
     */
    async function processHtmlForLoad(html) {
        if (!html || !html.includes('data-video-storage-id')) {
            return html;
        }
        
        // 匹配所有带有 data-video-storage-id 的视频标签
        const videoRegex = /<video([^>]*)data-video-storage-id=["']([^"']+)["']([^>]*)>/gi;
        let match;
        let result = html;
        const replacements = [];
        
        while ((match = videoRegex.exec(html)) !== null) {
            const fullMatch = match[0];
            const videoId = match[2];
            
            // 从 IndexedDB 获取视频数据
            const videoData = await getVideo(videoId);
            
            if (videoData) {
                // 替换 src 属性为实际数据
                let newTag = fullMatch;
                
                // 检查是否有 src 属性
                if (/\ssrc=["'][^"']*["']/.test(newTag)) {
                    newTag = newTag.replace(/\ssrc=["'][^"']*["']/, ` src="${videoData}"`);
                } else {
                    // 如果没有 src 属性，添加一个
                    newTag = newTag.replace('<video', `<video src="${videoData}"`);
                }
                
                replacements.push({ from: fullMatch, to: newTag });
            }
        }
        
        // 应用所有替换
        for (const { from, to } of replacements) {
            result = result.replace(from, to);
        }
        
        return result;
    }
    
    /**
     * 处理 HTML 内容用于导出（将 IndexedDB 中的视频数据嵌入）
     * @param {string} html - 包含视频引用的 HTML
     * @returns {Promise<string>} - 导出用的 HTML（视频数据完整嵌入）
     */
    async function processHtmlForExport(html) {
        // 与 processHtmlForLoad 相同，但用于导出
        return await processHtmlForLoad(html);
    }
    
    // 初始化数据库
    initDB().catch(err => {
        console.error('VideoStorage: 初始化失败', err);
    });
    
    // 公开 API
    return {
        saveVideo,
        getVideo,
        deleteVideo,
        getAllVideoIds,
        clearAll,
        processHtmlForSave,
        processHtmlForLoad,
        processHtmlForExport,
        generateVideoId
    };
})();

