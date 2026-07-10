const FileCache = (function() {
    const DB_NAME = 'SoraDirectoryFileCacheDB';
    const DB_VERSION = 2;
    const STORE_NAME = 'fileCache';
    const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
    const MAX_CACHE_ENTRIES = 12;
    const MAX_CACHE_BYTES = 32 * 1024 * 1024;
    const MAX_MEMORY_ENTRIES = 3;

    let db = null;
    let maintenanceTimer = null;
    const memoryCache = new Map();

    function requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function initDB() {
        if (typeof indexedDB === 'undefined') {
            return Promise.reject(new Error('IndexedDB is not supported'));
        }
        if (db) {
            return Promise.resolve(db);
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => {
                console.error('FileCache: 无法打开 IndexedDB', request.error);
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
                let store;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    store = database.createObjectStore(STORE_NAME, { keyPath: 'fileKey' });
                } else {
                    store = request.transaction.objectStore(STORE_NAME);
                }
                if (!store.indexNames.contains('timestamp')) {
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!store.indexNames.contains('cacheBytes')) {
                    store.createIndex('cacheBytes', 'cacheBytes', { unique: false });
                }
            };
        });
    }

    function generateFileKey(file) {
        const name = file.name || '';
        const size = file.size || 0;
        const lastModified = file.lastModified || 0;
        return `${name}_${size}_${lastModified}`;
    }

    function estimatePayloadBytes(parsedData) {
        try {
            const json = JSON.stringify(parsedData);
            if (typeof Blob !== 'undefined') {
                return new Blob([json]).size;
            }
            return json.length * 2;
        } catch (err) {
            return 0;
        }
    }

    function isExpired(entry) {
        return !entry || Date.now() - (entry.timestamp || 0) > CACHE_EXPIRY;
    }

    function rememberInMemory(entry) {
        if (!entry || !entry.fileKey) return;
        memoryCache.delete(entry.fileKey);
        memoryCache.set(entry.fileKey, entry);
        while (memoryCache.size > MAX_MEMORY_ENTRIES) {
            const oldestKey = memoryCache.keys().next().value;
            memoryCache.delete(oldestKey);
        }
    }

    async function get(file) {
        const fileKey = generateFileKey(file);
        const memoryEntry = memoryCache.get(fileKey);
        if (memoryEntry && !isExpired(memoryEntry)) {
            return memoryEntry.parsedData;
        }
        if (memoryEntry) {
            memoryCache.delete(fileKey);
        }

        try {
            const database = await initDB();
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const result = await requestToPromise(store.get(fileKey));
            if (!result) return null;
            if (isExpired(result)) {
                deleteCache(fileKey).catch(() => {});
                return null;
            }
            rememberInMemory(result);
            return result.parsedData;
        } catch (err) {
            console.warn('FileCache: 获取缓存失败', err);
            return null;
        }
    }

    async function set(file, parsedData) {
        const fileKey = generateFileKey(file);
        const fileSize = file && file.size ? file.size : 0;

        if (fileSize > MAX_CACHE_BYTES) {
            await deleteCache(fileKey);
            console.info('FileCache: 文件过大，跳过缓存', file.name || '', fileSize);
            return;
        }

        const cacheBytes = estimatePayloadBytes(parsedData);

        if (cacheBytes > MAX_CACHE_BYTES) {
            await deleteCache(fileKey);
            console.info('FileCache: 文件过大，跳过缓存', file.name || '', cacheBytes);
            return;
        }

        try {
            const database = await initDB();
            const cacheEntry = {
                fileKey,
                fileName: file.name || '',
                fileSize: file.size || 0,
                lastModified: file.lastModified || 0,
                parsedData,
                cacheBytes,
                timestamp: Date.now()
            };
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await requestToPromise(store.put(cacheEntry));
            rememberInMemory(cacheEntry);
            scheduleMaintenance();
        } catch (err) {
            console.warn('FileCache: 保存缓存失败', err);
        }
    }

    async function deleteCache(fileKey) {
        memoryCache.delete(fileKey);
        try {
            const database = await initDB();
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await requestToPromise(store.delete(fileKey));
        } catch (err) {
            console.warn('FileCache: 删除缓存失败', err);
        }
    }

    async function cleanExpired() {
        try {
            const database = await initDB();
            const now = Date.now();
            let cleanedCount = 0;
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('timestamp');

            await new Promise((resolve) => {
                const request = index.openCursor();
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (!cursor) {
                        resolve();
                        return;
                    }
                    const entry = cursor.value;
                    if (now - (entry.timestamp || 0) > CACHE_EXPIRY) {
                        memoryCache.delete(entry.fileKey);
                        cursor.delete();
                        cleanedCount++;
                    }
                    cursor.continue();
                };
                request.onerror = () => {
                    console.warn('FileCache: 清理过期缓存失败', request.error);
                    resolve();
                };
            });
            return cleanedCount;
        } catch (err) {
            console.warn('FileCache: 清理过期缓存失败', err);
            return 0;
        }
    }

    async function trimCache() {
        try {
            const database = await initDB();
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const entries = await requestToPromise(store.getAll());
            const validEntries = (entries || [])
                .filter(entry => !isExpired(entry))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            let totalBytes = 0;
            const deleteKeys = [];
            for (let i = 0; i < validEntries.length; i++) {
                const entry = validEntries[i];
                totalBytes += entry.cacheBytes || estimatePayloadBytes(entry.parsedData);
                if (i >= MAX_CACHE_ENTRIES || totalBytes > MAX_CACHE_BYTES) {
                    deleteKeys.push(entry.fileKey);
                }
            }
            for (const key of deleteKeys) {
                await deleteCache(key);
            }
            return deleteKeys.length;
        } catch (err) {
            console.warn('FileCache: 修剪缓存失败', err);
            return 0;
        }
    }

    function scheduleMaintenance() {
        if (maintenanceTimer) return;
        maintenanceTimer = setTimeout(async () => {
            maintenanceTimer = null;
            await cleanExpired();
            await trimCache();
        }, 1500);
    }

    async function clearAll() {
        memoryCache.clear();
        try {
            const database = await initDB();
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await requestToPromise(store.clear());
        } catch (err) {
            console.error('FileCache: 清空缓存失败', err);
            throw err;
        }
    }

    async function getStats() {
        try {
            const database = await initDB();
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const entries = await requestToPromise(store.getAll());
            const now = Date.now();
            let totalSize = 0;
            let validCount = 0;
            let expiredCount = 0;

            (entries || []).forEach(entry => {
                if (now - (entry.timestamp || 0) > CACHE_EXPIRY) {
                    expiredCount++;
                    return;
                }
                validCount++;
                totalSize += entry.cacheBytes || estimatePayloadBytes(entry.parsedData);
            });

            return {
                total: entries ? entries.length : 0,
                valid: validCount,
                expired: expiredCount,
                totalSize,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                maxEntries: MAX_CACHE_ENTRIES,
                maxSizeMB: (MAX_CACHE_BYTES / 1024 / 1024).toFixed(0)
            };
        } catch (err) {
            console.warn('FileCache: 获取统计信息失败', err);
            return { total: 0, valid: 0, expired: 0, totalSize: 0, totalSizeMB: '0.00' };
        }
    }

    if (typeof indexedDB !== 'undefined') {
        scheduleMaintenance();
    }

    return {
        get,
        set,
        clearAll,
        cleanExpired,
        trimCache,
        getStats
    };
})();
window.FileCache = FileCache;
