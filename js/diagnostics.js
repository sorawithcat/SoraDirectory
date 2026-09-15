(function() {
    'use strict';

    const SETTINGS_KEY = 'sora_diagnostic_level_v1';
    const TREND_KEY = 'sora_storage_trend_v1';
    const LEVELS = { off: 0, error: 1, warning: 2, info: 3, debug: 4 };
    let level = loadLevel();
    const entries = [];

    function loadLevel() {
        try {
            const value = localStorage.getItem(SETTINGS_KEY) || 'warning';
            return Object.prototype.hasOwnProperty.call(LEVELS, value) ? value : 'warning';
        } catch (_) {
            return 'warning';
        }
    }

    function setLevel(value) {
        level = Object.prototype.hasOwnProperty.call(LEVELS, value) ? value : 'warning';
        try { localStorage.setItem(SETTINGS_KEY, level); } catch (_) {}
    }

    function safeDetail(value) {
        if (value instanceof Error) return value.message;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, 240);
        if (!value) return '';
        if (value.id || value.methodId || value.type) return JSON.stringify({ id: value.id || value.methodId || '', type: value.type || '' }).slice(0, 240);
        return '[对象详情已脱敏]';
    }

    function record(entryLevel, message, ...details) {
        if ((LEVELS[entryLevel] || 0) > LEVELS[level]) return;
        entries.unshift({
            time: new Date().toISOString(),
            level: entryLevel,
            message: String(message || '').replace(/[\r\n]+/g, ' ').slice(0, 240),
            detail: details.map(safeDetail).filter(Boolean).join(' · ').slice(0, 500)
        });
        if (entries.length > 150) entries.length = 150;
    }

    function referencedMediaIds() {
        const ids = new Set();
        (Array.isArray(mulufile) ? mulufile : []).forEach(row => {
            const html = Array.isArray(row) ? String(row[3] || '') : '';
            for (const match of html.matchAll(/data-media-storage-id=["']([^"']+)["']/g)) ids.add(match[1]);
        });
        return ids;
    }

    async function collectStorage() {
        const usage = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => ({})) : {};
        const ids = window.MediaStorage ? await MediaStorage.getAllMediaIds().catch(() => []) : [];
        const records = [];
        for (const id of ids) {
            const info = await MediaStorage.getMediaInfo(id).catch(() => null);
            if (info) records.push(info);
        }
        const referenced = referencedMediaIds();
        const missing = [];
        for (const id of referenced) {
            if (!ids.includes(id)) missing.push(id);
        }
        const totalMediaBytes = records.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
        const orphanIds = ids.filter(id => !referenced.has(id));
        const snapshot = { time: Date.now(), usage: Number(usage.usage) || 0, quota: Number(usage.quota) || 0, mediaBytes: totalMediaBytes, mediaCount: ids.length };
        saveTrend(snapshot);
        return { snapshot, records, missing, orphanIds };
    }

    function saveTrend(snapshot) {
        try {
            const current = JSON.parse(localStorage.getItem(TREND_KEY) || '[]');
            const list = Array.isArray(current) ? current : [];
            list.push(snapshot);
            localStorage.setItem(TREND_KEY, JSON.stringify(list.slice(-30)));
        } catch (_) {}
    }

    function readTrend() {
        try {
            const value = JSON.parse(localStorage.getItem(TREND_KEY) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    }

    function formatBytes(value) {
        const bytes = Number(value) || 0;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

    async function hashMedia(id) {
        const value = await MediaStorage.getMedia(id);
        let bytes;
        if (value instanceof Blob) bytes = await value.arrayBuffer();
        else if (value instanceof ArrayBuffer) bytes = value;
        else bytes = new TextEncoder().encode(String(value || '')).buffer;
        if (bytes.byteLength > 128 * 1024 * 1024) return '';
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map(item => item.toString(16).padStart(2, '0')).join('');
    }

    async function findDuplicates(records) {
        const candidates = new Map();
        records.forEach(item => {
            const key = `${item.mimeType}|${item.size}`;
            if (!candidates.has(key)) candidates.set(key, []);
            candidates.get(key).push(item.id);
        });
        const groups = [];
        for (const ids of candidates.values()) {
            if (ids.length < 2) continue;
            const hashes = new Map();
            for (const id of ids) {
                const hash = await hashMedia(id).catch(() => '');
                if (!hash) continue;
                if (!hashes.has(hash)) hashes.set(hash, []);
                hashes.get(hash).push(id);
            }
            hashes.forEach(group => { if (group.length > 1) groups.push(group); });
        }
        return groups;
    }

    function duplicateSavings(groups, records) {
        const sizes = new Map(records.map(item => [item.id, Number(item.size) || 0]));
        return groups.reduce((sum, group) => sum + group.slice(1).reduce((groupSum, id) => groupSum + (sizes.get(id) || 0), 0), 0);
    }

    async function consolidateDuplicates(groups) {
        if (!groups.length) return;
        const duplicateIds = groups.flatMap(group => group.slice(1));
        const confirmed = await customConfirm(`将合并 ${duplicateIds.length} 个内容完全相同的媒体资源，并把正文引用改到保留资源。是否继续？`, '合并重复媒体', '取消', '媒体去重');
        if (!confirmed) return;
        if (window.DirectoryHistory) DirectoryHistory.record('合并重复媒体');
        let changed = 0;
        for (const group of groups) {
            const canonical = group[0];
            for (const duplicate of group.slice(1)) {
                (Array.isArray(mulufile) ? mulufile : []).forEach(row => {
                    const before = String(row[3] || '');
                    const after = before.replace(new RegExp(`(data-media-storage-id=["'])${duplicate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`, 'g'), `$1${canonical}$2`);
                    if (after !== before) { row[3] = after; changed++; }
                });
                await MediaStorage.deleteMedia(duplicate);
            }
        }
        if (changed && typeof markUnsavedChanges === 'function') markUnsavedChanges();
        if (changed && typeof updateMarkdownPreview === 'function') updateMarkdownPreview({ force: true });
        showToast(`媒体去重完成，已更新 ${changed} 个目录`, 'success', 2400);
    }

    async function repairMissingReferences(missing) {
        if (!missing.length) return;
        const confirmed = await customConfirm(`将把 ${missing.length} 个缺失媒体引用标记为“资源缺失”，保留说明文字且不删除正文。是否继续？`, '修复缺失引用', '取消', '媒体引用修复');
        if (!confirmed) return;
        if (window.DirectoryHistory) DirectoryHistory.record('修复缺失媒体引用');
        let changed = 0;
        (Array.isArray(mulufile) ? mulufile : []).forEach(row => {
            const template = document.createElement('template');
            template.innerHTML = String(row[3] || '');
            let rowChanged = false;
            missing.forEach(id => template.content.querySelectorAll(`[data-media-storage-id="${CSS.escape(String(id))}"]`).forEach(element => {
                element.removeAttribute('src');
                element.setAttribute('data-media-missing', 'true');
                element.setAttribute('aria-label', `${element.getAttribute('aria-label') || element.getAttribute('alt') || '媒体'}（资源缺失）`);
                changed++;
                rowChanged = true;
            }));
            if (rowChanged) row[3] = template.innerHTML;
        });
        if (changed && typeof markUnsavedChanges === 'function') markUnsavedChanges();
        if (typeof updateMarkdownPreview === 'function') updateMarkdownPreview({ force: true });
        showToast(`已标记 ${changed} 处缺失媒体引用`, 'success', 2200);
    }

    function buildSummary(storage) {
        const identity = window.SoraDocumentIdentity ? window.SoraDocumentIdentity.get() : { id: 'legacy', source: 'legacy' };
        return {
            app: 'SoraDirectory',
            time: new Date().toISOString(),
            document: { id: identity.id, source: identity.source },
            environment: {
                secureContext: window.isSecureContext,
                fileSystemAccess: typeof window.showSaveFilePicker === 'function',
                opfs: !!(navigator.storage && navigator.storage.getDirectory),
                serviceWorker: 'serviceWorker' in navigator
            },
            project: { directories: Array.isArray(mulufile) ? mulufile.length : 0, unsaved: typeof hasUnsavedChanges !== 'undefined' && !!hasUnsavedChanges },
            storage: storage ? { usage: storage.snapshot.usage, quota: storage.snapshot.quota, mediaBytes: storage.snapshot.mediaBytes, mediaCount: storage.snapshot.mediaCount, orphanCount: storage.orphanIds.length, missingReferenceCount: storage.missing.length } : null,
            logs: entries.slice(0, 50)
        };
    }

    async function copySummary(storage) {
        const text = JSON.stringify(buildSummary(storage), null, 2);
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('当前环境不能写入剪贴板');
        await navigator.clipboard.writeText(text);
        showToast('已复制脱敏诊断摘要', 'success', 1800);
    }

    async function open() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<p>正在统计存储、媒体引用和迁移能力…</p>';
        FeatureDialog.open('存储与诊断', wrapper);
        const storage = await collectStorage();
        const duplicates = await findDuplicates(storage.records);
        const recoverableBytes = duplicateSavings(duplicates, storage.records);
        const trend = readTrend();
        const previous = trend.length > 1 ? trend[trend.length - 2] : null;
        const delta = previous ? storage.snapshot.usage - previous.usage : 0;
        wrapper.innerHTML = `
            <div class="method-form-grid">
                <section class="issue-section"><h3>浏览器空间</h3><div style="padding:10px"><strong>${formatBytes(storage.snapshot.usage)}</strong> / ${formatBytes(storage.snapshot.quota)}<br><small>较上次 ${delta >= 0 ? '+' : ''}${formatBytes(Math.abs(delta))}${delta < 0 ? '（减少）' : ''}</small></div></section>
                <section class="issue-section"><h3>媒体</h3><div style="padding:10px"><strong>${storage.records.length}</strong> 个 · ${formatBytes(storage.snapshot.mediaBytes)}<br><small>${storage.orphanIds.length} 个孤立，${storage.missing.length} 个缺失引用，${duplicates.length} 组重复；预计可释放 ${formatBytes(recoverableBytes)}</small></div></section>
                <section class="issue-section"><h3>迁移能力</h3><div style="padding:10px">IndexedDB ${window.indexedDB ? '可用' : '不可用'} · OPFS ${navigator.storage && navigator.storage.getDirectory ? '可用' : '不可用'}<br><small>旧分块媒体会在读取时按现有存储层迁移；失败保留原记录。</small></div></section>
                <section class="issue-section"><h3>诊断级别</h3><div style="padding:10px"><label>默认仅记录有效警告 <select data-diagnostic-level><option value="off">关闭</option><option value="error">错误</option><option value="warning">警告</option><option value="info">信息</option><option value="debug">调试</option></select></label></div></section>
            </div>
            <p class="media-summary">诊断摘要不包含正文、密码、附件内容和方法持久变量值。</p>
            <div class="method-workbench-actions"><button type="button" data-refresh-diagnostics>重新扫描</button><button type="button" data-copy-diagnostics>复制脱敏诊断摘要</button><button type="button" data-repair-missing${storage.missing.length ? '' : ' disabled'}>修复缺失引用</button><button type="button" data-consolidate${duplicates.length ? '' : ' disabled'}>合并重复媒体</button><button type="button" data-open-media>打开媒体库</button></div>`;
        const select = wrapper.querySelector('[data-diagnostic-level]');
        select.value = level;
        select.addEventListener('change', () => setLevel(select.value));
        wrapper.querySelector('[data-refresh-diagnostics]').addEventListener('click', () => { FeatureDialog.close(); open(); });
        wrapper.querySelector('[data-copy-diagnostics]').addEventListener('click', () => copySummary(storage).catch(error => showToast(error.message, 'error')));
        wrapper.querySelector('[data-repair-missing]').addEventListener('click', () => repairMissingReferences(storage.missing));
        wrapper.querySelector('[data-consolidate]').addEventListener('click', () => consolidateDuplicates(duplicates));
        wrapper.querySelector('[data-open-media]').addEventListener('click', () => { FeatureDialog.close(); window.MediaManager?.open(); });
    }

    window.SoraDiagnostics = {
        debug: (message, ...details) => record('debug', message, ...details),
        info: (message, ...details) => record('info', message, ...details),
        warning: (message, ...details) => record('warning', message, ...details),
        error: (message, ...details) => record('error', message, ...details),
        setLevel,
        getLevel: () => level,
        getEntries: () => entries.slice(),
        buildSummary,
        open
    };
    window.SoraFeatureCommands = window.SoraFeatureCommands || [];
    window.SoraFeatureCommands.push({ key: 'storage-diagnostics', title: '存储与诊断', icon: '▣', meta: '空间趋势、媒体去重、引用修复和脱敏诊断包', keywords: '存储 容量 去重 修复 迁移 日志', run: open });
})();
