// ============================================
// 文件缓存模块 (fileCache.js)
// 功能：使用 IndexedDB 缓存解析后的文件数据，提高大文件加载速度
// 依赖：无（需在 fileOperations.js 之前加载）
// ============================================

const FileCache = (function() {
    const DB_NAME = 'SoraDirectoryFileCacheDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'fileCache';
    
    // 缓存有效期：7天（毫秒）
    const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
    
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
                console.error('FileCache: 无法打开 IndexedDB', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const store = database.createObjectStore(STORE_NAME, { keyPath: 'fileKey' });
                    // 创建索引用于按时间戳查询（用于清理过期缓存）
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }
    
    /**
     * 生成文件缓存键
     * 使用文件名、大小和最后修改时间生成唯一标识
     * @param {File} file - 文件对象
     * @returns {string} - 缓存键
     */
    function generateFileKey(file) {
        const name = file.name || '';
        const size = file.size || 0;
        const lastModified = file.lastModified || 0;
        // 使用文件名、大小和修改时间生成哈希键
        return `${name}_${size}_${lastModified}`;
    }
    
    /**
     * 从缓存中获取解析后的文件数据
     * @param {File} file - 文件对象
     * @returns {Promise<Array|null>} - 解析后的数据，如果不存在或已过期则返回 null
     */
    async function get(file) {
        try {
            const database = await initDB();
            const fileKey = generateFileKey(file);
            
            return new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(fileKey);
                
                request.onsuccess = () => {
                    const result = request.result;
                    
                    if (!result) {
                        // 缓存不存在
                        resolve(null);
                        return;
                    }
                    
                    // 检查缓存是否过期
                    const now = Date.now();
                    const age = now - result.timestamp;
                    
                    if (age > CACHE_EXPIRY) {
                        // 缓存已过期，删除并返回 null
                        deleteCache(fileKey).then(() => resolve(null));
                        return;
                    }
                    
                    // 返回缓存的数据
                    resolve(result.parsedData);
                };
                
                request.onerror = () => {
                    console.error('FileCache: 读取缓存失败', request.error);
                    resolve(null); // 出错时返回 null，不阻塞加载流程
                };
            });
        } catch (err) {
            console.error('FileCache: 获取缓存失败', err);
            return null; // 出错时返回 null，不阻塞加载流程
        }
    }
    
    /**
     * 将解析后的文件数据保存到缓存
     * @param {File} file - 文件对象
     * @param {Array} parsedData - 解析后的数据
     * @returns {Promise<void>}
     */
    async function set(file, parsedData) {
        try {
            const database = await initDB();
            const fileKey = generateFileKey(file);
            
            return new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const cacheEntry = {
                    fileKey: fileKey,
                    fileName: file.name || '',
                    fileSize: file.size || 0,
                    lastModified: file.lastModified || 0,
                    parsedData: parsedData,
                    timestamp: Date.now()
                };
                
                const request = store.put(cacheEntry);
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('FileCache: 保存缓存失败', request.error);
                    reject(request.error);
                };
            });
        } catch (err) {
            console.error('FileCache: 保存缓存失败', err);
            // 不抛出错误，缓存失败不应该阻塞主流程
        }
    }
    
    /**
     * 删除指定的缓存项
     * @param {string} fileKey - 缓存键
     * @returns {Promise<void>}
     */
    async function deleteCache(fileKey) {
        try {
            const database = await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(fileKey);
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('FileCache: 删除缓存失败', request.error);
                    resolve(); // 删除失败不影响主流程
                };
            });
        } catch (err) {
            console.error('FileCache: 删除缓存失败', err);
        }
    }
    
    /**
     * 清理过期的缓存
     * @returns {Promise<number>} - 清理的缓存数量
     */
    async function cleanExpired() {
        try {
            const database = await initDB();
            const now = Date.now();
            let cleanedCount = 0;
            
            return new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const index = store.index('timestamp');
                
                // 查询所有缓存项
                const request = index.openCursor();
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    
                    if (!cursor) {
                        resolve(cleanedCount);
                        return;
                    }
                    
                    const entry = cursor.value;
                    const age = now - entry.timestamp;
                    
                    if (age > CACHE_EXPIRY) {
                        cursor.delete();
                        cleanedCount++;
                    }
                    
                    cursor.continue();
                };
                
                request.onerror = () => {
                    console.error('FileCache: 清理过期缓存失败', request.error);
                    resolve(cleanedCount);
                };
            });
        } catch (err) {
            console.error('FileCache: 清理过期缓存失败', err);
            return 0;
        }
    }
    
    /**
     * 清空所有缓存
     * @returns {Promise<void>}
     */
    async function clearAll() {
        try {
            const database = await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('FileCache: 清空缓存失败', request.error);
                    reject(request.error);
                };
            });
        } catch (err) {
            console.error('FileCache: 清空缓存失败', err);
            throw err;
        }
    }
    
    /**
     * 获取缓存统计信息
     * @returns {Promise<Object>} - 缓存统计信息
     */
    async function getStats() {
        try {
            const database = await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const entries = request.result || [];
                    const now = Date.now();
                    let totalSize = 0;
                    let validCount = 0;
                    let expiredCount = 0;
                    
                    entries.forEach(entry => {
                        const age = now - entry.timestamp;
                        if (age > CACHE_EXPIRY) {
                            expiredCount++;
                        } else {
                            validCount++;
                            // 估算大小（JSON 字符串长度）
                            totalSize += JSON.stringify(entry.parsedData).length;
                        }
                    });
                    
                    resolve({
                        total: entries.length,
                        valid: validCount,
                        expired: expiredCount,
                        totalSize: totalSize,
                        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
                    });
                };
                
                request.onerror = () => {
                    console.error('FileCache: 获取统计信息失败', request.error);
                    resolve({ total: 0, valid: 0, expired: 0, totalSize: 0, totalSizeMB: '0.00' });
                };
            });
        } catch (err) {
            console.error('FileCache: 获取统计信息失败', err);
            return { total: 0, valid: 0, expired: 0, totalSize: 0, totalSizeMB: '0.00' };
        }
    }
    
    // 初始化时清理过期缓存（异步，不阻塞）
    if (typeof indexedDB !== 'undefined') {
        setTimeout(() => {
            cleanExpired().then(count => {
                if (count > 0) {
                    console.log(`FileCache: 已清理 ${count} 个过期缓存项`);
                }
            });
        }, 1000);
    }
    
    // 公开 API
    return {
        get: get,
        set: set,
        clearAll: clearAll,
        cleanExpired: cleanExpired,
        getStats: getStats
    };
})();

