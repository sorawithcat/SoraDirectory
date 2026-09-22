(function() {
    'use strict';

    function create({ name, version, label, upgrade }) {
        let database = null;
        let opening = null;

        function open() {
            if (database) return Promise.resolve(database);
            if (opening) return opening.promise;

            const attempt = {};
            opening = attempt;
            attempt.promise = new Promise((resolve, reject) => {
                let settled = false;
                let timer = null;
                const fail = error => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                };
                let request;
                try {
                    request = indexedDB.open(name, version);
                } catch (error) {
                    opening = null;
                    fail(error);
                    return;
                }
                timer = setTimeout(() => fail(new Error(`${label}数据库响应超时，请先保存当前文件，再刷新页面重试。`)), 15000);
                request.onblocked = () => fail(new Error(`${label}数据库升级被旧版页面占用。支持同时打开多个项目，请先保存其他旧版编辑器页面中的文件，再刷新那些页面后重试。`));
                request.onupgradeneeded = () => {
                    if (settled) { request.transaction.abort(); return; }
                    try { upgrade(request.result, request.transaction); }
                    catch (error) { request.transaction.abort(); fail(error); }
                };
                request.onerror = () => {
                    if (opening === attempt) opening = null;
                    fail(request.error || new Error(`${label}数据库打开失败`));
                };
                request.onsuccess = () => {
                    if (opening === attempt) opening = null;
                    clearTimeout(timer);
                    const connection = request.result;
                    // IndexedDB 的打开请求无法取消，失败后迟到的连接必须释放。
                    if (settled) { connection.close(); return; }
                    settled = true;
                    database = connection;
                    const release = () => {
                        connection.close();
                        if (database === connection) database = null;
                    };
                    connection.onversionchange = release;
                    connection.onclose = release;
                    resolve(connection);
                };
            });
            // 受阻请求结束前共用它的失败结果，避免重试不断堆积升级请求。
            return attempt.promise;
        }

        return { open };
    }

    window.SoraStorageDatabase = { create };
})();
