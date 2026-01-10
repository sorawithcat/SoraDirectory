const FileCache = (function() {
    const DB_NAME = 'SoraDirectoryFileCacheDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'fileCache';
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
        return `${name}_${size}_${lastModified}`;
    }
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
                        resolve(null);
                        return;
                    }
                    const now = Date.now();
                    const age = now - result.timestamp;
                    if (age > CACHE_EXPIRY) {
                        deleteCache(fileKey).then(() => resolve(null));
                        return;
                    }
                    resolve(result.parsedData);
                };
                request.onerror = () => {
                    console.error('FileCache: 读取缓存失败', request.error);
                    resolve(null); 
                };
            });
        } catch (err) {
            console.error('FileCache: 获取缓存失败', err);
            return null; 
        }
    }
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
        }
    }
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
                    resolve(); 
                };
            });
        } catch (err) {
            console.error('FileCache: 删除缓存失败', err);
        }
    }
    async function cleanExpired() {
        try {
            const database = await initDB();
            const now = Date.now();
            let cleanedCount = 0;
            return new Promise((resolve, reject) => {
                const transaction = database.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const index = store.index('timestamp');
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
    if (typeof indexedDB !== 'undefined') {
        setTimeout(() => {
            cleanExpired().then(count => {
                if (count > 0) {
                    console.log(`FileCache: 已清理 ${count} 个过期缓存项`);
                }
            });
        }, 1000);
    }
    return {
        get: get,
        set: set,
        clearAll: clearAll,
        cleanExpired: cleanExpired,
        getStats: getStats
    };
})();