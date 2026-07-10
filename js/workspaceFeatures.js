const FeatureDialog = (function() {
    let overlay = null;
    let titleElement = null;
    let bodyElement = null;

    function ensure() {
        if (overlay) return;
        const style = document.createElement('style');
        style.textContent = `
            .draft-status { min-width: 88px; color: #64748b; font-size: 11px; text-align: center; }
            .workspace-navigation { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 5px 10px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; box-sizing: border-box; }
            .workspace-breadcrumb { display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; }
            .workspace-breadcrumb button { border: 0; background: transparent; color: #2563eb; cursor: pointer; padding: 3px 4px; }
            .workspace-breadcrumb button:last-child { color: #0f172a; font-weight: 700; }
            .workspace-breadcrumb-separator { color: #94a3b8; }
            .workspace-nav-btn, .workspace-nav-select { min-height: 28px; border: 1px solid #cbd5e1; border-radius: 5px; background: #fff; color: #334155; }
            .workspace-nav-btn { min-width: 30px; cursor: pointer; font-size: 18px; }
            .workspace-nav-select { max-width: 150px; padding: 3px 6px; }
            .feature-dialog-overlay { position: fixed; inset: 0; z-index: 12000; display: none; align-items: center; justify-content: center; padding: 18px; background: rgba(15, 23, 42, 0.42); }
            .feature-dialog-overlay.active { display: flex; }
            .feature-dialog { width: min(920px, 96vw); max-height: 88vh; display: flex; flex-direction: column; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28); overflow: hidden; }
            .feature-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
            .feature-dialog-title { margin: 0; font-size: 17px; }
            .feature-dialog-close { border: 0; background: transparent; font-size: 22px; cursor: pointer; color: #64748b; }
            .feature-dialog-body { padding: 14px 16px; overflow: auto; }
            .feature-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
            .feature-toolbar input[type="search"] { flex: 1; min-width: 200px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
            .media-summary { color: #64748b; font-size: 13px; }
            .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
            .media-card { display: grid; grid-template-columns: 72px 1fr; gap: 10px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
            .media-card.is-orphan { border-color: #f59e0b; background: #fffbeb; }
            .media-preview { width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: #f1f5f9; overflow: hidden; font-size: 30px; }
            .media-preview img { width: 100%; height: 100%; object-fit: cover; }
            .media-details { min-width: 0; }
            .media-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
            .media-meta, .media-dirs { margin-top: 4px; color: #64748b; font-size: 12px; overflow-wrap: anywhere; }
            .media-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
            .media-actions button, .toolbar-action-row button { padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 5px; background: #fff; cursor: pointer; }
            .toolbar-action-list { display: grid; gap: 6px; }
            .toolbar-action-row { display: grid; grid-template-columns: minmax(150px, 1fr) auto auto auto; gap: 6px; align-items: center; padding: 7px; border-bottom: 1px solid #eef2f7; }
            .toolbar-action-row .is-quick { color: #d97706; }
            .mobile-toolbar-group { display: none; }
            #mobileQuickActions { display: flex; gap: 4px; min-width: 0; }
            @media (max-width: 900px) {
                .top-toolbar > .top-toolbar-group:not(.mobile-toolbar-group) { display: none; }
                .top-toolbar > .mobile-toolbar-group { display: flex; width: 100%; margin: 0; padding: 0; border: 0; }
                .top-toolbar { min-height: 48px; padding: 6px 8px; }
                #mobileQuickActions { flex: 1; overflow-x: auto; }
                .workspace-navigation { gap: 5px; padding: 4px 6px; }
                .workspace-nav-select { max-width: 100px; }
                .workspace-breadcrumb { font-size: 12px; }
                .feature-dialog-overlay { padding: 8px; }
                .feature-dialog { width: 100%; max-height: 94vh; }
            }
        `;
        document.head.appendChild(style);

        overlay = document.createElement('div');
        overlay.className = 'feature-dialog-overlay';
        overlay.innerHTML = `
            <section class="feature-dialog" role="dialog" aria-modal="true">
                <header class="feature-dialog-header">
                    <h2 class="feature-dialog-title"></h2>
                    <button type="button" class="feature-dialog-close" aria-label="关闭">×</button>
                </header>
                <div class="feature-dialog-body"></div>
            </section>`;
        document.body.appendChild(overlay);
        titleElement = overlay.querySelector('.feature-dialog-title');
        bodyElement = overlay.querySelector('.feature-dialog-body');
        overlay.querySelector('.feature-dialog-close').addEventListener('click', close);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) close();
        });
    }

    function open(title, content) {
        ensure();
        titleElement.textContent = title;
        bodyElement.innerHTML = '';
        if (typeof content === 'string') {
            bodyElement.textContent = content;
        } else if (content) {
            bodyElement.appendChild(content);
        }
        overlay.classList.add('active');
    }

    function close() {
        if (!overlay) return;
        overlay.classList.remove('active');
        if (bodyElement) bodyElement.innerHTML = '';
    }

    ensure();
    return { open, close };
})();
window.FeatureDialog = FeatureDialog;

const DraftManager = (function() {
    const DB_NAME = 'SoraDirectoryDraftDB';
    const STORE_NAME = 'drafts';
    const DRAFT_ID = 'latest';
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
    let dbPromise = null;
    let saveTimer = null;
    let restoring = false;

    function setStatus(text, title = '') {
        const status = document.getElementById('draftStatus');
        if (!status) return;
        status.textContent = text;
        status.title = title || text;
    }

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return dbPromise;
    }

    async function read() {
        try {
            const db = await openDB();
            return await new Promise((resolve, reject) => {
                const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DRAFT_ID);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.warn('读取自动草稿失败:', err);
            return null;
        }
    }

    function getSelectedDirId() {
        const selected = currentMuluName ? document.getElementById(currentMuluName) : null;
        return selected ? (selected.getAttribute('data-dir-id') || '') : '';
    }

    async function saveNow() {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (restoring || typeof hasUnsavedChanges === 'undefined' || !hasUnsavedChanges || !Array.isArray(mulufile)) return false;
        try {
            if (typeof syncPreviewToTextarea === 'function') syncPreviewToTextarea();
            const draft = {
                id: DRAFT_ID,
                updatedAt: Date.now(),
                fileName: typeof currentFileName !== 'undefined' ? currentFileName : '',
                displayName: fileNameInput ? fileNameInput.value : '',
                selectedDirId: getSelectedDirId(),
                directoryLevelColors: typeof serializeDirectoryLevelColors === 'function' ? serializeDirectoryLevelColors() : null,
                data: mulufile.map(row => Array.isArray(row) ? row.slice() : row)
            };
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(draft);
                request.onsuccess = resolve;
                request.onerror = () => reject(request.error);
            });
            const time = new Date(draft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setStatus(`草稿 ${time}`, `自动草稿已保存：${new Date(draft.updatedAt).toLocaleString()}`);
            return true;
        } catch (err) {
            console.warn('保存自动草稿失败:', err);
            setStatus('草稿失败', err.message || '草稿保存失败');
            return false;
        }
    }

    function schedule() {
        if (restoring) return;
        clearTimeout(saveTimer);
        setStatus('草稿待存');
        saveTimer = setTimeout(saveNow, 1200);
    }

    async function clear() {
        clearTimeout(saveTimer);
        saveTimer = null;
        try {
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(DRAFT_ID);
                request.onsuccess = resolve;
                request.onerror = () => reject(request.error);
            });
            setStatus('');
        } catch (err) {
            console.warn('清除自动草稿失败:', err);
        }
    }

    async function applyDraft(draft) {
        restoring = true;
        try {
            mulufile = draft.data.map(row => Array.isArray(row) ? row.slice() : row);
            if (typeof loadDirectoryLevelColors === 'function') {
                loadDirectoryLevelColors(draft.directoryLevelColors || null);
            }
            if (typeof currentFileHandle !== 'undefined') currentFileHandle = null;
            if (typeof currentFileName !== 'undefined') currentFileName = draft.fileName || '恢复的草稿';
            if (fileNameInput) fileNameInput.value = draft.displayName || draft.fileName || '恢复的草稿';
            LoadMulu();
            const target = Array.from(document.querySelectorAll('.mulu')).find(el => el.getAttribute('data-dir-id') === draft.selectedDirId)
                || document.querySelector('.mulu');
            if (target && typeof switchToDirectoryElement === 'function') {
                await switchToDirectoryElement(target, { syncCurrent: false, scrollPreviewTop: true, forceRender: true });
            }
            hasUnsavedChanges = true;
            updateSaveButtonState();
            setStatus('草稿已恢复', `恢复时间：${new Date(draft.updatedAt).toLocaleString()}`);
            return true;
        } finally {
            restoring = false;
        }
    }

    async function offerRestore() {
        const draft = await read();
        if (!draft || !Array.isArray(draft.data) || draft.data.length === 0) return false;
        if (Date.now() - Number(draft.updatedAt || 0) > MAX_AGE) {
            await clear();
            return false;
        }
        const time = new Date(draft.updatedAt).toLocaleString();
        const restore = await customConfirm(`检测到 ${time} 的自动草稿，是否恢复？`, '恢复草稿', '忽略并删除', '自动草稿恢复');
        if (!restore) {
            await clear();
            return false;
        }
        return applyDraft(draft);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveNow();
    });

    return { schedule, saveNow, clear, resetAfterLoad: clear, offerRestore };
})();
window.DraftManager = DraftManager;

const DirectoryHistory = (function() {
    const LIMIT = 40;
    const undoStack = [];
    const redoStack = [];
    let restoring = false;

    function selectedDirId() {
        const selected = currentMuluName ? document.getElementById(currentMuluName) : null;
        return selected ? (selected.getAttribute('data-dir-id') || '') : '';
    }

    function snapshot(label) {
        if (typeof syncPreviewToTextarea === 'function') syncPreviewToTextarea();
        return {
            label,
            data: mulufile.map(row => Array.isArray(row) ? row.slice() : row),
            selectedDirId: selectedDirId(),
            directoryLevelColors: typeof serializeDirectoryLevelColors === 'function' ? serializeDirectoryLevelColors() : null
        };
    }

    function updateButtons() {
        const undoBtn = document.getElementById('undoDirectoryBtn');
        const redoBtn = document.getElementById('redoDirectoryBtn');
        if (undoBtn) {
            undoBtn.disabled = undoStack.length === 0;
            undoBtn.title = undoStack.length ? `撤销：${undoStack[undoStack.length - 1].label}` : '没有可撤销的目录操作';
        }
        if (redoBtn) {
            redoBtn.disabled = redoStack.length === 0;
            redoBtn.title = redoStack.length ? `重做：${redoStack[redoStack.length - 1].label}` : '没有可重做的目录操作';
        }
    }

    function record(label) {
        if (restoring || !Array.isArray(mulufile)) return;
        undoStack.push(snapshot(label));
        if (undoStack.length > LIMIT) undoStack.shift();
        redoStack.length = 0;
        updateButtons();
    }

    async function restore(state, actionLabel) {
        restoring = true;
        try {
            mulufile = state.data.map(row => Array.isArray(row) ? row.slice() : row);
            if (typeof loadDirectoryLevelColors === 'function') {
                loadDirectoryLevelColors(state.directoryLevelColors || null);
            }
            LoadMulu();
            const target = Array.from(document.querySelectorAll('.mulu')).find(el => el.getAttribute('data-dir-id') === state.selectedDirId)
                || document.querySelector('.mulu');
            if (target && typeof switchToDirectoryElement === 'function') {
                await switchToDirectoryElement(target, { syncCurrent: false, scrollPreviewTop: true, forceRender: true });
            } else {
                currentMuluName = null;
                if (jiedianwords) jiedianwords.value = '';
                if (markdownPreview) markdownPreview.innerHTML = '';
            }
            if (typeof markUnsavedChanges === 'function') markUnsavedChanges();
            showToast(actionLabel, 'success', 1800);
        } finally {
            restoring = false;
            updateButtons();
        }
    }

    async function undo() {
        if (!undoStack.length || restoring) return;
        const state = undoStack.pop();
        redoStack.push(snapshot(state.label));
        await restore(state, `已撤销：${state.label}`);
    }

    async function redo() {
        if (!redoStack.length || restoring) return;
        const state = redoStack.pop();
        undoStack.push(snapshot(state.label));
        await restore(state, `已重做：${state.label}`);
    }

    function clear() {
        undoStack.length = 0;
        redoStack.length = 0;
        updateButtons();
    }

    document.getElementById('undoDirectoryBtn')?.addEventListener('click', undo);
    document.getElementById('redoDirectoryBtn')?.addEventListener('click', redo);
    document.addEventListener('keydown', event => {
        const isCtrl = event.ctrlKey || event.metaKey;
        if (!isCtrl) return;
        const target = event.target;
        const isEditing = target && (target.closest?.('.markdown-preview') || target.matches?.('input, textarea, [contenteditable="true"]'));
        if (isEditing) return;
        if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
            event.preventDefault();
            undo();
        } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
            event.preventDefault();
            redo();
        }
    });
    updateButtons();

    return { record, undo, redo, clear, isRestoring: () => restoring };
})();
window.DirectoryHistory = DirectoryHistory;

const DirectoryNavigation = (function() {
    const FAVORITES_KEY = 'sora_directory_favorites';
    const RECENTS_KEY = 'sora_directory_recents';
    let favorites = load(FAVORITES_KEY);
    let recents = load(RECENTS_KEY);

    function load(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    }

    function save() {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
    }

    function currentDirId() {
        const selected = currentMuluName ? document.getElementById(currentMuluName) : null;
        return selected ? (selected.getAttribute('data-dir-id') || '') : '';
    }

    function getRow(dirId) {
        return typeof getMulufileByDirId === 'function' ? getMulufileByDirId(dirId) : null;
    }

    function renderSelect(select, placeholder, ids) {
        if (!select) return;
        select.innerHTML = '';
        const first = document.createElement('option');
        first.value = '';
        first.textContent = placeholder;
        select.appendChild(first);
        ids.forEach(dirId => {
            const row = getRow(dirId);
            if (!row) return;
            const option = document.createElement('option');
            option.value = dirId;
            option.textContent = row[1] || '未命名';
            select.appendChild(option);
        });
    }

    function renderBreadcrumb(dirId) {
        const container = document.getElementById('workspaceBreadcrumb');
        if (!container) return;
        container.innerHTML = '';
        const path = [];
        const visited = new Set();
        let current = dirId;
        while (current && current !== 'mulu' && !visited.has(current) && path.length < 30) {
            visited.add(current);
            const row = getRow(current);
            if (!row) break;
            path.unshift({ id: row[2], name: row[1] || '未命名' });
            current = row[0];
        }
        path.forEach((item, index) => {
            if (index > 0) {
                const separator = document.createElement('span');
                separator.className = 'workspace-breadcrumb-separator';
                separator.textContent = '›';
                container.appendChild(separator);
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = item.name;
            button.title = item.name;
            button.addEventListener('click', () => open(item.id));
            container.appendChild(button);
        });
    }

    function refresh(dirId = currentDirId()) {
        const visibleFavorites = favorites.filter(id => !!getRow(id));
        const visibleRecents = recents.filter(id => !!getRow(id));
        renderSelect(document.getElementById('recentDirectorySelect'), '最近访问', visibleRecents);
        renderSelect(document.getElementById('favoriteDirectorySelect'), '收藏目录', visibleFavorites);
        renderBreadcrumb(dirId);
        const favoriteBtn = document.getElementById('favoriteDirectoryBtn');
        if (favoriteBtn) {
            const active = !!dirId && favorites.includes(dirId);
            favoriteBtn.textContent = active ? '★' : '☆';
            favoriteBtn.classList.toggle('active', active);
            favoriteBtn.disabled = !dirId;
        }
    }

    function track(dirId) {
        if (!dirId || !getRow(dirId)) return;
        recents = [dirId, ...recents.filter(id => id !== dirId)].slice(0, 12);
        save();
        refresh(dirId);
    }

    async function open(dirId) {
        if (!dirId) return false;
        const target = Array.from(document.querySelectorAll('.mulu')).find(el => el.getAttribute('data-dir-id') === dirId);
        if (!target) return false;
        if (typeof expandParentDirectories === 'function') expandParentDirectories(target);
        await switchToDirectoryElement(target, { syncCurrent: true, scrollPreviewTop: true, forceRender: false });
        target.scrollIntoView({ block: 'nearest' });
        return true;
    }

    function toggleFavorite() {
        const dirId = currentDirId();
        if (!dirId) return;
        if (favorites.includes(dirId)) {
            favorites = favorites.filter(id => id !== dirId);
            showToast('已取消收藏目录', 'info', 1500);
        } else {
            favorites.push(dirId);
            showToast('已收藏目录', 'success', 1500);
        }
        save();
        refresh(dirId);
    }

    document.getElementById('favoriteDirectoryBtn')?.addEventListener('click', toggleFavorite);
    document.getElementById('recentDirectorySelect')?.addEventListener('change', event => {
        if (event.target.value) open(event.target.value);
        event.target.value = '';
    });
    document.getElementById('favoriteDirectorySelect')?.addEventListener('change', event => {
        if (event.target.value) open(event.target.value);
        event.target.value = '';
    });

    return { track, refresh, open, toggleFavorite, getCurrentDirId: currentDirId };
})();
window.DirectoryNavigation = DirectoryNavigation;

const MediaManager = (function() {
    let insertRange = null;

    function collectReferences() {
        const references = new Map();
        for (const row of (Array.isArray(mulufile) ? mulufile : [])) {
            if (!row || row.length !== 4 || !row[3]) continue;
            const template = document.createElement('template');
            template.innerHTML = row[3];
            template.content.querySelectorAll('[data-media-storage-id]').forEach(el => {
                const id = el.getAttribute('data-media-storage-id');
                if (!id) return;
                if (!references.has(id)) {
                    references.set(id, { count: 0, dirIds: new Set(), name: '', tag: el.tagName.toLowerCase() });
                }
                const ref = references.get(id);
                ref.count++;
                ref.dirIds.add(row[2]);
                ref.name = ref.name || el.getAttribute('data-archive-name') || el.getAttribute('alt') || el.getAttribute('title') || '';
            });
        }
        return references;
    }

    function displaySize(bytes) {
        if (!Number.isFinite(bytes)) return '大小未知';
        if (typeof formatStorageSize === 'function') return formatStorageSize(bytes);
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    async function insertItem(item) {
        if (!markdownPreview || !DirectoryNavigation.getCurrentDirId()) {
            showToast('请先选择一个目录', 'warning', 1800);
            return;
        }
        if (typeof insertStoredMediaResource !== 'function') {
            showToast('媒体插入功能不可用', 'error', 1800);
            return;
        }
        const range = insertRange ? insertRange.cloneRange() : null;
        FeatureDialog.close();
        await insertStoredMediaResource(item.id, item.info, {
            displayName: item.reference.name || (item.info.type === 'archive' ? `${item.id}.bin` : '媒体资源'),
            range
        });
    }

    async function removeItem(item) {
        if (item.reference.count > 0) {
            showToast('该资源仍被正文引用，不能直接删除', 'warning', 2200);
            return;
        }
        const confirmed = await customConfirm(`确定删除孤立资源 ${item.id}？`);
        if (!confirmed) return;
        await MediaStorage.deleteMedia(item.id);
        showToast('孤立资源已删除', 'success', 1600);
        open();
    }

    function createCard(item) {
        const card = document.createElement('article');
        card.className = 'media-card' + (item.reference.count === 0 ? ' is-orphan' : '');
        card.dataset.search = `${item.id} ${item.reference.name} ${item.directoryNames.join(' ')}`.toLowerCase();
        card.dataset.orphan = item.reference.count === 0 ? 'true' : 'false';

        const preview = document.createElement('div');
        preview.className = 'media-preview';
        const isImage = item.info.type === 'image' || (item.info.mimeType || '').startsWith('image/');
        if (isImage) {
            const img = document.createElement('img');
            img.alt = item.reference.name || '媒体缩略图';
            preview.appendChild(img);
            MediaStorage.getMediaAsUrl(item.id).then(url => {
                if (url && img.isConnected) img.src = url;
            }).catch(() => {});
        } else {
            preview.textContent = item.info.type === 'video' ? '🎬' : (item.info.type === 'archive' ? '📦' : '📄');
        }
        card.appendChild(preview);

        const details = document.createElement('div');
        details.className = 'media-details';
        const name = document.createElement('div');
        name.className = 'media-name';
        name.textContent = item.reference.name || item.id;
        name.title = item.reference.name || item.id;
        details.appendChild(name);
        const meta = document.createElement('div');
        meta.className = 'media-meta';
        meta.textContent = `${item.info.type || 'media'} · ${displaySize(item.info.size)} · 引用 ${item.reference.count} 次`;
        details.appendChild(meta);
        const dirs = document.createElement('div');
        dirs.className = 'media-dirs';
        dirs.textContent = item.directoryNames.length ? `目录：${item.directoryNames.join('、')}` : '孤立资源';
        details.appendChild(dirs);
        const actions = document.createElement('div');
        actions.className = 'media-actions';
        const insertBtn = document.createElement('button');
        insertBtn.type = 'button';
        insertBtn.textContent = '插入当前目录';
        insertBtn.addEventListener('click', () => insertItem(item));
        actions.appendChild(insertBtn);
        if (item.reference.dirIds.size > 0) {
            const locateBtn = document.createElement('button');
            locateBtn.type = 'button';
            locateBtn.textContent = '定位';
            locateBtn.addEventListener('click', () => {
                DirectoryNavigation.open(Array.from(item.reference.dirIds)[0]);
                FeatureDialog.close();
            });
            actions.appendChild(locateBtn);
        }
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '删除';
        deleteBtn.disabled = item.reference.count > 0;
        deleteBtn.addEventListener('click', () => removeItem(item));
        actions.appendChild(deleteBtn);
        details.appendChild(actions);
        card.appendChild(details);
        return card;
    }

    async function open() {
        insertRange = typeof getCurrentMarkdownRange === 'function' ? getCurrentMarkdownRange() : null;
        const wrapper = document.createElement('div');
        wrapper.textContent = '正在读取媒体资源...';
        FeatureDialog.open('媒体资源管理器', wrapper);
        try {
            const refs = collectReferences();
            const allIds = await MediaStorage.getAllMediaIds();
            const ids = allIds.filter(id => !String(id).includes('_chunk_'));
            const items = (await Promise.all(ids.map(async id => {
                const info = await MediaStorage.getMediaInfo(id);
                if (!info) return null;
                const reference = refs.get(id) || { count: 0, dirIds: new Set(), name: '', tag: '' };
                const directoryNames = Array.from(reference.dirIds).map(dirId => {
                    const row = getMulufileByDirId(dirId);
                    return row ? row[1] : dirId;
                });
                return { id, info, reference, directoryNames };
            }))).filter(Boolean);

            wrapper.innerHTML = '';
            const toolbar = document.createElement('div');
            toolbar.className = 'feature-toolbar';
            const search = document.createElement('input');
            search.type = 'search';
            search.placeholder = '搜索资源、目录或ID';
            const orphanLabel = document.createElement('label');
            const orphanOnly = document.createElement('input');
            orphanOnly.type = 'checkbox';
            orphanLabel.append(orphanOnly, document.createTextNode(' 仅看孤立资源'));
            const summary = document.createElement('span');
            summary.className = 'media-summary';
            summary.textContent = `${items.length} 个资源，${items.filter(item => item.reference.count === 0).length} 个孤立`;
            toolbar.append(search, orphanLabel, summary);
            wrapper.appendChild(toolbar);
            const grid = document.createElement('div');
            grid.className = 'media-grid';
            items.forEach(item => grid.appendChild(createCard(item)));
            wrapper.appendChild(grid);
            const applyFilter = () => {
                const keyword = search.value.trim().toLowerCase();
                grid.querySelectorAll('.media-card').forEach(card => {
                    const visible = (!keyword || card.dataset.search.includes(keyword)) && (!orphanOnly.checked || card.dataset.orphan === 'true');
                    card.style.display = visible ? 'grid' : 'none';
                });
            };
            search.addEventListener('input', applyFilter);
            orphanOnly.addEventListener('change', applyFilter);
        } catch (err) {
            wrapper.textContent = `读取媒体资源失败：${err.message || err}`;
        }
    }

    document.getElementById('mediaManagerBtn')?.addEventListener('click', open);
    return { open, collectReferences };
})();
window.MediaManager = MediaManager;

const ToolbarOrganizer = (function() {
    const STORAGE_KEY = 'sora_mobile_quick_actions';
    const DEFAULT_ACTIONS = ['saveBtn', 'addDirectoryBtn', 'searchBtn', 'topImageUploadBtn'];
    let quickActions = load();

    function load() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return Array.isArray(value) ? value.slice(0, 4) : DEFAULT_ACTIONS.slice();
        } catch (_) {
            return DEFAULT_ACTIONS.slice();
        }
    }

    function collectActions() {
        const actions = [];
        const seen = new Set();
        document.querySelectorAll('#topToolbar .top-toolbar-btn:not(#mobileMoreBtn)').forEach(button => {
            let key = button.id;
            if (!key && button.dataset.command) key = `format:${button.dataset.command}`;
            if (!key || seen.has(key)) return;
            seen.add(key);
            actions.push({ key, label: button.title || button.textContent.trim() || key, button });
        });
        return actions;
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(quickActions));
    }

    function renderMobile() {
        const container = document.getElementById('mobileQuickActions');
        if (!container) return;
        const actionMap = new Map(collectActions().map(action => [action.key, action]));
        quickActions = quickActions.filter(key => actionMap.has(key)).slice(0, 4);
        if (!quickActions.length) quickActions = DEFAULT_ACTIONS.filter(key => actionMap.has(key)).slice(0, 4);
        save();
        container.innerHTML = '';
        quickActions.forEach(key => {
            const action = actionMap.get(key);
            if (!action) return;
            const proxy = document.createElement('button');
            proxy.type = 'button';
            proxy.className = 'top-toolbar-btn';
            proxy.textContent = action.button.textContent.trim() || action.label;
            proxy.title = action.label;
            proxy.addEventListener('click', () => action.button.click());
            container.appendChild(proxy);
        });
    }

    function toggleQuick(key) {
        if (quickActions.includes(key)) {
            quickActions = quickActions.filter(item => item !== key);
        } else if (quickActions.length < 4) {
            quickActions.push(key);
        } else {
            showToast('移动端快捷按钮最多 4 个', 'warning', 1800);
            return;
        }
        save();
        renderMobile();
        open();
    }

    function move(key, direction) {
        const index = quickActions.indexOf(key);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= quickActions.length) return;
        [quickActions[index], quickActions[next]] = [quickActions[next], quickActions[index]];
        save();
        renderMobile();
        open();
    }

    function open() {
        const wrapper = document.createElement('div');
        const hint = document.createElement('p');
        hint.textContent = '点击功能名称立即执行；星标功能会显示在移动端快捷栏，可用箭头调整顺序。';
        wrapper.appendChild(hint);
        const list = document.createElement('div');
        list.className = 'toolbar-action-list';
        collectActions().forEach(action => {
            const row = document.createElement('div');
            row.className = 'toolbar-action-row';
            const run = document.createElement('button');
            run.type = 'button';
            run.textContent = action.label;
            run.addEventListener('click', () => {
                FeatureDialog.close();
                action.button.click();
            });
            const star = document.createElement('button');
            star.type = 'button';
            star.textContent = quickActions.includes(action.key) ? '★' : '☆';
            star.classList.toggle('is-quick', quickActions.includes(action.key));
            star.title = '切换移动端快捷按钮';
            star.addEventListener('click', () => toggleQuick(action.key));
            const up = document.createElement('button');
            up.type = 'button';
            up.textContent = '↑';
            up.disabled = quickActions.indexOf(action.key) <= 0;
            up.addEventListener('click', () => move(action.key, -1));
            const down = document.createElement('button');
            down.type = 'button';
            down.textContent = '↓';
            const index = quickActions.indexOf(action.key);
            down.disabled = index < 0 || index >= quickActions.length - 1;
            down.addEventListener('click', () => move(action.key, 1));
            row.append(run, star, up, down);
            list.appendChild(row);
        });
        wrapper.appendChild(list);
        FeatureDialog.open('更多功能与快捷按钮', wrapper);
    }

    document.getElementById('mobileMoreBtn')?.addEventListener('click', open);
    renderMobile();
    return { renderMobile, open };
})();
window.ToolbarOrganizer = ToolbarOrganizer;

document.getElementById('preflightBtn')?.addEventListener('click', async () => {
    if (typeof syncPreviewToTextarea === 'function') syncPreviewToTextarea();
    if (typeof showExportPreflight === 'function') {
        await showExportPreflight(mulufile);
    }
});
