const FeatureDialog = (function() {
    let overlay = null;
    let titleElement = null;
    let bodyElement = null;
    let returnFocus = null;
    let coveredDialog = null;

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
            .workspace-nav-btn { min-width: 30px; padding: 3px 7px; cursor: pointer; font-size: 18px; }
            .workspace-nav-btn.workspace-nav-text { font-size: 12px; white-space: nowrap; }
            .workspace-nav-select { max-width: 150px; padding: 3px 6px; }
            .feature-dialog-overlay { position: fixed; inset: 0; z-index: 12000; display: none; align-items: center; justify-content: center; padding: 18px; background: rgba(15, 23, 42, 0.42); }
            .feature-dialog-overlay.above-custom-dialog { z-index: 13500; }
            .feature-dialog-overlay.active { display: flex; }
            .feature-dialog, .feature-dialog * { box-sizing: border-box; }
            .feature-dialog { width: min(920px, 96vw); max-width: 100%; max-height: 88vh; display: flex; flex-direction: column; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28); overflow: hidden; }
            .feature-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
            .feature-dialog-title { margin: 0; font-size: 17px; }
            .feature-dialog-close { border: 0; background: transparent; font-size: 22px; cursor: pointer; color: #64748b; }
            .feature-dialog-body { width: 100%; min-width: 0; padding: 14px 16px; overflow: auto; overscroll-behavior: contain; }
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
            .command-search { width:100%; min-height:42px; padding:8px 11px; border:1px solid #94a3b8; border-radius:7px; font-size:16px; }
            .command-hint { margin:7px 0 10px; color:#64748b; font-size:12px; }
            .command-results { display:grid; gap:4px; }
            .command-result-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:5px; align-items:stretch; }
            .command-result { display:grid; grid-template-columns:32px minmax(0,1fr) auto; gap:9px; align-items:center; width:100%; min-height:48px; padding:7px 9px; border:1px solid transparent; border-radius:7px; background:#fff; color:#172033; text-align:left; cursor:pointer; }
            .command-result:hover, .command-result.active { border-color:#93c5fd; background:#eff6ff; }
            .command-result small { color:#64748b; }
            .command-result-secondary { border:1px solid #cbd5e1; border-radius:7px; padding:0 10px; background:#fff; color:#1d4ed8; cursor:pointer; }
            .command-result-secondary:hover { border-color:#2563eb; background:#eff6ff; }
            .command-empty { padding:24px; text-align:center; color:#64748b; }
            .directory-issue-badge { float:right; min-width:18px; height:18px; margin:7px 6px 0 4px; padding:0 5px; border-radius:999px; background:#b91c1c; color:#fff; font:700 11px/18px system-ui,sans-serif; text-align:center; }
            .directory-issue-badge.is-warning { background:#b45309; }
            #issueCountBadge:not(:empty) { display:inline-flex; min-width:18px; height:18px; align-items:center; justify-content:center; padding:0 4px; border-radius:999px; background:#b91c1c; color:#fff; font-size:11px; }
            .issue-center-summary { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
            .issue-center-pill { padding:4px 8px; border-radius:999px; background:#f1f5f9; color:#475569; font-size:12px; }
            .issue-section { margin:0 0 14px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
            .issue-section h3 { margin:0; padding:9px 11px; background:#f8fafc; font-size:14px; }
            .issue-item { display:block; width:100%; padding:8px 11px; border:0; border-top:1px solid #eef2f7; background:#fff; color:#334155; text-align:left; cursor:pointer; }
            .issue-item:hover { background:#eff6ff; }
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
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <section class="feature-dialog" role="dialog" aria-modal="true" aria-labelledby="soraFeatureDialogTitle">
                <header class="feature-dialog-header">
                    <h2 class="feature-dialog-title" id="soraFeatureDialogTitle"></h2>
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
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = Array.from(overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
                .filter(element => !element.disabled && element.offsetParent !== null);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    function open(title, content) {
        ensure();
        titleElement.textContent = title;
        if (bodyElement.childNodes.length) {
            overlay.dispatchEvent(new CustomEvent('sora:feature-dialog-clear', { detail: { reason: 'replace' } }));
        }
        bodyElement.innerHTML = '';
        if (typeof content === 'string') {
            bodyElement.textContent = content;
        } else if (content) {
            bodyElement.appendChild(content);
        }
        returnFocus = document.activeElement;
        if (!overlay.classList.contains('active')) {
            const activeCustomDialog = document.getElementById('customDialogOverlay');
            if (activeCustomDialog?.classList.contains('active')) {
                coveredDialog = {
                    element: activeCustomDialog,
                    ariaHidden: activeCustomDialog.getAttribute('aria-hidden'),
                    hadInert: activeCustomDialog.hasAttribute('inert')
                };
                activeCustomDialog.setAttribute('aria-hidden', 'true');
                activeCustomDialog.setAttribute('inert', '');
                overlay.classList.add('above-custom-dialog');
            }
        }
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('active');
        requestAnimationFrame(() => {
            const target = bodyElement.querySelector('input, select, textarea, button, [href]')
                || overlay.querySelector('.feature-dialog-close');
            if (target) target.focus();
        });
    }

    function close() {
        if (!overlay) return;
        overlay.classList.remove('active');
        overlay.classList.remove('above-custom-dialog');
        overlay.setAttribute('aria-hidden', 'true');
        if (bodyElement) {
            if (bodyElement.childNodes.length) {
                overlay.dispatchEvent(new CustomEvent('sora:feature-dialog-clear', { detail: { reason: 'close' } }));
            }
            bodyElement.innerHTML = '';
        }
        const covered = coveredDialog;
        coveredDialog = null;
        if (covered?.element?.isConnected) {
            if (covered.ariaHidden === null) covered.element.removeAttribute('aria-hidden');
            else covered.element.setAttribute('aria-hidden', covered.ariaHidden);
            if (!covered.hadInert) covered.element.removeAttribute('inert');
        }
        const target = returnFocus;
        returnFocus = null;
        if (target && target.isConnected && typeof target.focus === 'function') target.focus();
    }

    ensure();
    return { open, close };
})();
window.FeatureDialog = FeatureDialog;

const DraftManager = (function() {
    const DB_NAME = 'SoraDirectoryDraftDB';
    const STORE_NAME = 'drafts';
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
    let dbPromise = null;
    let saveTimer = null;
    let restoring = false;
    let lastSnapshotAt = 0;
    let lastSnapshotHash = '';
    const SNAPSHOT_INTERVAL = 5 * 60 * 1000;
    const SNAPSHOT_LIMIT = 20;

    function documentIdentity() {
        return window.SoraDocumentIdentity ? window.SoraDocumentIdentity.get() : { id: 'legacy', label: '当前文档' };
    }

    function draftId() {
        return `latest:${documentIdentity().id}`;
    }

    function snapshotPrefix() {
        return `snapshot:${documentIdentity().id}:`;
    }

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
                const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(draftId());
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.warn('读取自动草稿失败:', err);
            return null;
        }
    }

    async function listSnapshots() {
        try {
            const db = await openDB();
            const records = await new Promise((resolve, reject) => {
                const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
            const prefix = snapshotPrefix();
            return records.filter(record => String(record.id || '').startsWith(prefix))
                .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
        } catch (error) {
            console.warn('读取草稿快照失败:', error);
            return [];
        }
    }

    function fingerprint(data) {
        const text = JSON.stringify(data || []);
        let hash = 0;
        for (let index = 0; index < text.length; index++) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
        return `${text.length}:${hash}`;
    }

    async function trimSnapshots() {
        const snapshots = await listSnapshots();
        const db = await openDB();
        for (const record of snapshots.slice(SNAPSHOT_LIMIT)) {
            await new Promise((resolve, reject) => {
                const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(record.id);
                request.onsuccess = resolve;
                request.onerror = () => reject(request.error);
            });
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
            const identity = documentIdentity();
            const draft = {
                id: draftId(),
                documentId: identity.id,
                documentLabel: identity.label,
                updatedAt: Date.now(),
                fileName: typeof currentFileName !== 'undefined' ? currentFileName : '',
                displayName: fileNameInput ? fileNameInput.value : '',
                selectedDirId: getSelectedDirId(),
                directoryLevelColors: typeof serializeDirectoryLevelColors === 'function' ? serializeDirectoryLevelColors() : null,
                directoryMetadata: window.DirectoryMetadata ? window.DirectoryMetadata.serialize() : null,
                data: mulufile.map(row => Array.isArray(row) ? row.slice() : row)
            };
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.put(draft);
                const nextHash = fingerprint([draft.data, draft.directoryMetadata]);
                if (nextHash !== lastSnapshotHash && Date.now() - lastSnapshotAt >= SNAPSHOT_INTERVAL) {
                    store.put({ ...draft, id: `${snapshotPrefix()}${draft.updatedAt}`, kind: 'snapshot' });
                    lastSnapshotHash = nextHash;
                    lastSnapshotAt = draft.updatedAt;
                }
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
            });
            await trimSnapshots();
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
                const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(draftId());
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
            if (window.SoraDocumentIdentity && draft.documentId) {
                window.SoraDocumentIdentity.adopt(draft.documentId, draft.documentLabel || draft.displayName || draft.fileName, 'draft');
            }
            if (typeof loadDirectoryLevelColors === 'function') {
                loadDirectoryLevelColors(draft.directoryLevelColors || null);
            }
            if (window.DirectoryMetadata) window.DirectoryMetadata.load(draft.directoryMetadata);
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

    async function applySelectedDirectories(draft, selectedIds) {
        const ids = new Set(selectedIds || []);
        if (!ids.size) return false;
        const snapshotById = new Map(draft.data.map(row => [row[2], row]));
        const requestedCount = ids.size;
        Array.from(ids).forEach(id => {
            let row = snapshotById.get(id);
            const visited = new Set();
            while (row && row[0] && row[0] !== 'mulu' && !visited.has(row[0])) {
                visited.add(row[0]);
                ids.add(row[0]);
                row = snapshotById.get(row[0]);
            }
        });
        restoring = true;
        try {
            if (typeof syncPreviewToTextarea === 'function') syncPreviewToTextarea();
            const current = new Map(mulufile.map(row => [row[2], row.slice()]));
            draft.data.forEach(row => {
                if (ids.has(row[2])) current.set(row[2], row.slice());
            });
            const next = [];
            const emitted = new Set();
            mulufile.forEach(row => {
                const value = current.get(row[2]);
                if (value) {
                    next.push(value);
                    emitted.add(row[2]);
                }
            });
            draft.data.forEach(row => {
                if (ids.has(row[2]) && !emitted.has(row[2])) next.push(row.slice());
            });
            mulufile = next;
            if (window.DirectoryMetadata && draft.directoryMetadata) {
                ids.forEach(id => {
                    if (draft.directoryMetadata[id]) window.DirectoryMetadata.set(id, draft.directoryMetadata[id], { markUnsaved: false });
                });
            }
            rebuildMulufileIndex();
            LoadMulu();
            const target = document.querySelector('.mulu');
            if (target) await switchToDirectoryElement(target, { syncCurrent: false, forceRender: true });
            hasUnsavedChanges = true;
            updateSaveButtonState();
            const ancestorCount = ids.size - requestedCount;
            showToast(`已从快照恢复 ${requestedCount} 个目录${ancestorCount ? `，并补齐 ${ancestorCount} 个父目录` : ''}`, 'success');
            return true;
        } finally {
            restoring = false;
        }
    }

    function plainSnapshotText(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        return String(template.content.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function snapshotTextPreview(currentHtml, snapshotHtml) {
        const currentText = plainSnapshotText(currentHtml);
        const snapshotText = plainSnapshotText(snapshotHtml);
        if (currentText === snapshotText) return null;
        let prefix = 0;
        while (prefix < currentText.length && prefix < snapshotText.length && currentText[prefix] === snapshotText[prefix]) prefix++;
        const start = Math.max(0, prefix - 60);
        const clip = (value) => `${start ? '…' : ''}${value.slice(start, start + 240)}${value.length > start + 240 ? '…' : ''}` || '（空）';
        return { current: clip(currentText), snapshot: clip(snapshotText) };
    }

    function snapshotDiff(snapshot) {
        const currentById = new Map(mulufile.map(row => [row[2], row]));
        const snapshotById = new Map(snapshot.data.map(row => [row[2], row]));
        const changed = [];
        snapshotById.forEach((row, id) => {
            const current = currentById.get(id);
            const metadataChanged = JSON.stringify(window.DirectoryMetadata ? window.DirectoryMetadata.get(id) : null) !== JSON.stringify((snapshot.directoryMetadata || {})[id] || null);
            if (!current || JSON.stringify(current) !== JSON.stringify(row) || metadataChanged) {
                changed.push({
                    id,
                    name: row[1],
                    type: current ? (metadataChanged ? '内容或字段已修改' : '已修改') : '快照中新增',
                    preview: current ? snapshotTextPreview(current[3], row[3]) : null
                });
            }
        });
        currentById.forEach((row, id) => {
            if (!snapshotById.has(id)) changed.push({ id, name: row[1], type: '当前新增' });
        });
        return changed;
    }

    async function openManager() {
        const wrapper = document.createElement('div');
        wrapper.textContent = '正在读取草稿快照…';
        FeatureDialog.open('草稿与恢复', wrapper);
        const snapshots = await listSnapshots();
        wrapper.innerHTML = '';
        const identity = documentIdentity();
        const controls = document.createElement('div');
        controls.className = 'method-workbench-actions';
        controls.innerHTML = `<input type="text" maxlength="60" aria-label="快照名称" placeholder="快照名称（可选）"><button type="button" data-create-snapshot>立即建立命名快照</button>`;
        const estimate = document.createElement('p');
        estimate.className = 'media-summary';
        estimate.textContent = `当前文档：${identity.label} · ${snapshots.length}/${SNAPSHOT_LIMIT} 个历史快照`;
        wrapper.append(controls, estimate);
        controls.querySelector('[data-create-snapshot]').addEventListener('click', async () => {
            const name = controls.querySelector('input').value.trim();
            await createNamedSnapshot(name);
            FeatureDialog.close();
            openManager();
        });
        if (!snapshots.length) {
            const empty = document.createElement('div');
            empty.className = 'command-empty';
            empty.textContent = '尚无历史快照。编辑内容后会自动保留，也可立即建立命名快照。';
            wrapper.appendChild(empty);
            return;
        }
        snapshots.forEach((snapshot, snapshotIndex) => {
            const diff = snapshotDiff(snapshot);
            const section = document.createElement('section');
            section.className = 'issue-section';
            section.innerHTML = `<h3>${new Date(snapshot.updatedAt).toLocaleString()} · ${escapeHtml(snapshot.snapshotName || snapshot.displayName || snapshot.fileName || '未命名')}</h3>
                <div style="padding:10px"><p class="media-summary">${snapshot.data.length} 个目录，与当前相比 ${diff.length} 项变化</p>
                <div>${diff.length ? diff.map(item => `<div class="snapshot-diff-item"><label style="display:block;padding:5px"><input type="checkbox" value="${encodeURIComponent(item.id)}"> ${escapeHtml(item.name || item.id)} <small>(${item.type})</small></label>${item.preview ? `<details><summary>查看文本变化片段</summary><div class="snapshot-text-diff"><p><strong>当前：</strong>${escapeHtml(item.preview.current)}</p><p><strong>快照：</strong>${escapeHtml(item.preview.snapshot)}</p></div></details>` : ''}</div>`).join('') : '<p>与当前内容相同。</p>'}</div>
                <div class="method-workbench-actions"><button type="button" data-select-all="${snapshotIndex}">全选变化</button><button type="button" data-restore-selected="${snapshotIndex}"${diff.length ? '' : ' disabled'}>恢复所选目录</button><button type="button" data-restore-all="${snapshotIndex}">恢复整个快照</button></div></div>`;
            wrapper.appendChild(section);
        });
        wrapper.addEventListener('click', async event => {
            const allButton = event.target.closest('[data-select-all]');
            const selectedButton = event.target.closest('[data-restore-selected]');
            const restoreAllButton = event.target.closest('[data-restore-all]');
            const button = allButton || selectedButton || restoreAllButton;
            if (!button) return;
            const index = Number(button.getAttribute(allButton ? 'data-select-all' : selectedButton ? 'data-restore-selected' : 'data-restore-all'));
            const snapshot = snapshots[index];
            const section = button.closest('.issue-section');
            if (allButton) {
                section.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true; });
                return;
            }
            FeatureDialog.close();
            if (restoreAllButton) await applyDraft(snapshot);
            else {
                const ids = Array.from(section.querySelectorAll('input:checked')).map(input => decodeURIComponent(input.value));
                await applySelectedDirectories(snapshot, ids);
            }
        });
    }

    async function createNamedSnapshot(name = '') {
        if (typeof syncPreviewToTextarea === 'function') syncPreviewToTextarea();
        const identity = documentIdentity();
        const updatedAt = Date.now();
        const record = {
            id: `${snapshotPrefix()}${updatedAt}`,
            kind: 'snapshot',
            snapshotName: String(name || '').trim().slice(0, 60) || `快照 ${new Date(updatedAt).toLocaleString()}`,
            documentId: identity.id,
            documentLabel: identity.label,
            updatedAt,
            fileName: typeof currentFileName !== 'undefined' ? currentFileName : '',
            displayName: fileNameInput ? fileNameInput.value : '',
            selectedDirId: getSelectedDirId(),
            directoryLevelColors: typeof serializeDirectoryLevelColors === 'function' ? serializeDirectoryLevelColors() : null,
            directoryMetadata: window.DirectoryMetadata ? window.DirectoryMetadata.serialize() : null,
            data: mulufile.map(row => Array.isArray(row) ? row.slice() : row)
        };
        const db = await openDB();
        await new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        await trimSnapshots();
        showToast(`已建立命名快照“${record.snapshotName}”`, 'success', 2200);
        return record;
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

    document.getElementById('draftManagerBtn')?.addEventListener('click', openManager);
    return { schedule, saveNow, clear, resetAfterLoad: clear, offerRestore, listSnapshots, openManager, createNamedSnapshot };
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
            directoryLevelColors: typeof serializeDirectoryLevelColors === 'function' ? serializeDirectoryLevelColors() : null,
            directoryMetadata: window.DirectoryMetadata ? window.DirectoryMetadata.serialize() : null
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
            if (window.DirectoryMetadata) window.DirectoryMetadata.load(state.directoryMetadata);
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

    async function open(dirId, options = {}) {
        if (!dirId) return false;
        const target = Array.from(document.querySelectorAll('.mulu')).find(el => el.getAttribute('data-dir-id') === dirId);
        if (!target) return false;
        if (typeof expandParentDirectories === 'function') expandParentDirectories(target);
        await switchToDirectoryElement(target, {
            syncCurrent: true,
            viewMode: options.viewMode || 'restore',
            forceRender: false
        });
        target.scrollIntoView({ block: 'nearest' });
        return true;
    }

    async function openCurrentAtTop() {
        const dirId = currentDirId();
        if (!dirId) return false;
        return open(dirId, { viewMode: 'top' });
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
    document.getElementById('openDirectoryAtTopBtn')?.addEventListener('click', openCurrentAtTop);
    document.getElementById('recentDirectorySelect')?.addEventListener('change', event => {
        if (event.target.value) open(event.target.value);
        event.target.value = '';
    });
    document.getElementById('favoriteDirectorySelect')?.addEventListener('change', event => {
        if (event.target.value) open(event.target.value);
        event.target.value = '';
    });

    return {
        track,
        refresh,
        open,
        openCurrentAtTop,
        toggleFavorite,
        getCurrentDirId: currentDirId,
        getFavorites: () => favorites.slice(),
        getRecents: () => recents.slice()
    };
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
                    references.set(id, { count: 0, dirIds: new Set(), name: '', tag: el.tagName.toLowerCase(), width: '', align: '', loading: '' });
                }
                const ref = references.get(id);
                ref.count++;
                ref.dirIds.add(row[2]);
                const caption = el.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '';
                ref.name = ref.name || caption || el.getAttribute('data-archive-name') || el.getAttribute('alt') || el.getAttribute('title') || '';
                ref.width = ref.width || el.getAttribute('data-media-width') || '';
                ref.align = ref.align || el.getAttribute('data-media-align') || el.closest('figure')?.getAttribute('data-media-align') || '';
                ref.loading = ref.loading || (el.matches('img') ? el.getAttribute('loading') : (el.matches('video') ? el.getAttribute('preload') : '')) || '';
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

    function syncCurrentMediaEditor() {
        const currentDirId = DirectoryNavigation.getCurrentDirId();
        const currentRow = mulufile.find(row => row[2] === currentDirId);
        if (currentRow && jiedianwords) jiedianwords.value = currentRow[3] || '';
        if (typeof updateMarkdownPreview === 'function') updateMarkdownPreview({ force: true });
    }

    async function replaceItem(item) {
        const input = document.createElement('input');
        input.type = 'file';
        input.hidden = true;
        input.accept = item.info.type === 'image' ? 'image/*' : (item.info.type === 'video' ? 'video/*' : '.zip,.rar,.7z,.tar,.gz,.tgz,.bz2,.xz');
        document.body.appendChild(input);
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            input.remove();
            if (!file) return;
            const family = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'archive');
            if (family !== item.info.type) {
                showToast(`请选择同类型的${item.info.type === 'image' ? '图片' : item.info.type === 'video' ? '视频' : '压缩文件'}`, 'warning', 2400);
                return;
            }
            try {
                showToast('正在替换媒体并保留引用…', 'info', 1800);
                const mediaPayload = family === 'image' && typeof optimizeImageFile === 'function'
                    ? await optimizeImageFile(file)
                    : file;
                const newId = await MediaStorage.save(mediaPayload, item.info.type, null, { deduplicate: family === 'image' });
                let changed = 0;
                mulufile.forEach(row => {
                    const template = document.createElement('template');
                    template.innerHTML = String(row[3] || '');
                    const elements = template.content.querySelectorAll(`[data-media-storage-id="${CSS.escape(String(item.id))}"]`);
                    elements.forEach(element => {
                        element.setAttribute('data-media-storage-id', newId);
                        if (element.matches('img,video')) {
                            element.removeAttribute('src');
                            element.removeAttribute('data-export-url');
                        }
                        if (element.classList.contains('archive-attachment')) {
                            element.dataset.archiveSize = String(file.size);
                            const size = element.querySelector('.archive-size');
                            if (size) size.textContent = displaySize(file.size);
                        }
                        changed++;
                    });
                    if (elements.length) row[3] = template.innerHTML;
                });
                if (!changed) {
                    await MediaStorage.deleteMedia(newId);
                    showToast('未找到需要替换的引用', 'warning');
                    return;
                }
                if (typeof markUnsavedChanges === 'function') markUnsavedChanges();
                syncCurrentMediaEditor();
                try {
                    await MediaStorage.deleteMedia(item.id);
                } catch (cleanupError) {
                    console.warn('旧媒体清理失败，已保留为孤立数据:', cleanupError);
                }
                FeatureDialog.close();
                showToast(`已替换媒体，保留 ${changed} 处引用`, 'success', 2200);
            } catch (error) {
                console.error('替换媒体失败:', error);
                showToast(`替换媒体失败：${error.message || error}`, 'error', 3000);
            }
        }, { once: true });
        input.click();
    }

    function openProperties(item) {
        const wrapper = document.createElement('div');
        const escapedName = String(item.reference.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const isArchive = item.info.type === 'archive';
        const loadingOptions = item.info.type === 'video'
            ? [['none', '不预加载'], ['metadata', '仅元数据'], ['auto', '自动预加载']]
            : [['lazy', '懒加载'], ['eager', '立即加载']];
        const selectedLoading = item.reference.loading || (item.info.type === 'video' ? 'none' : 'lazy');
        wrapper.innerHTML = `<div class="method-form-grid">
            <div class="form-group method-grid-full"><label for="mediaPropertyName">显示名称或图注</label><input id="mediaPropertyName" class="form-control" maxlength="200" value="${escapedName}"></div>
            ${isArchive ? '' : `<div class="form-group"><label for="mediaPropertyWidth">显示宽度</label><select id="mediaPropertyWidth" class="form-control"><option value=""${item.reference.width ? '' : ' selected'}>自动</option>${['25','50','75','100'].map(value => `<option value="${value}"${item.reference.width === value ? ' selected' : ''}>${value}%</option>`).join('')}</select></div>
            <div class="form-group"><label for="mediaPropertyAlign">对齐</label><select id="mediaPropertyAlign" class="form-control"><option value=""${item.reference.align ? '' : ' selected'}>跟随正文</option><option value="left"${item.reference.align === 'left' ? ' selected' : ''}>左对齐</option><option value="center"${item.reference.align === 'center' ? ' selected' : ''}>居中</option><option value="right"${item.reference.align === 'right' ? ' selected' : ''}>右对齐</option></select></div>
            <div class="form-group"><label for="mediaPropertyLoading">加载策略</label><select id="mediaPropertyLoading" class="form-control">${loadingOptions.map(([value, label]) => `<option value="${value}"${selectedLoading === value ? ' selected' : ''}>${label}</option>`).join('')}</select></div>`}
            <div><strong>资源 ID</strong><p class="media-meta">${escapeHtml(item.id)}</p></div>
            <div><strong>类型</strong><p class="media-meta">${escapeHtml(item.info.mimeType || item.info.type || '未知')}</p></div>
            <div><strong>大小</strong><p class="media-meta">${displaySize(item.info.size)}</p></div>
            <div><strong>引用</strong><p class="media-meta">${item.reference.count} 次 / ${item.directoryNames.length} 个目录</p></div>
            </div><div class="method-workbench-actions"><button type="button" data-save-media-properties>保存属性</button></div>`;
        wrapper.querySelector('[data-save-media-properties]').addEventListener('click', () => {
            const value = wrapper.querySelector('#mediaPropertyName').value.trim();
            const width = wrapper.querySelector('#mediaPropertyWidth')?.value || '';
            const align = wrapper.querySelector('#mediaPropertyAlign')?.value || '';
            const loading = wrapper.querySelector('#mediaPropertyLoading')?.value || '';
            let changed = 0;
            mulufile.forEach(row => {
                const template = document.createElement('template');
                template.innerHTML = String(row[3] || '');
                const elements = template.content.querySelectorAll(`[data-media-storage-id="${CSS.escape(String(item.id))}"]`);
                elements.forEach(element => {
                    if (element.matches('img')) element.alt = value;
                    element.title = value;
                    if (element.classList.contains('archive-attachment')) {
                        element.dataset.archiveName = value;
                        const name = element.querySelector('.archive-name');
                        if (name) {
                            name.textContent = value;
                            name.title = value;
                        }
                    }
                    if (element.matches('img,video')) {
                        if (width) {
                            element.dataset.mediaWidth = width;
                            element.style.width = `${width}%`;
                            element.style.maxWidth = '100%';
                        } else {
                            element.removeAttribute('data-media-width');
                            element.style.removeProperty('width');
                        }
                        if (loading) {
                            if (element.matches('img')) element.setAttribute('loading', loading);
                            else element.setAttribute('preload', loading);
                        }
                    }
                    let figure = element.closest('figure');
                    if (!figure && value && element.matches('img,video')) {
                        figure = document.createElement('figure');
                        element.replaceWith(figure);
                        figure.appendChild(element);
                    }
                    const alignTarget = figure || element;
                    if (align) {
                        element.dataset.mediaAlign = align;
                        alignTarget.dataset.mediaAlign = align;
                        alignTarget.style.marginLeft = align === 'left' ? '0' : 'auto';
                        alignTarget.style.marginRight = align === 'right' ? '0' : 'auto';
                    } else {
                        element.removeAttribute('data-media-align');
                        alignTarget.removeAttribute('data-media-align');
                        alignTarget.style.removeProperty('margin-left');
                        alignTarget.style.removeProperty('margin-right');
                    }
                    let caption = figure && figure.querySelector('figcaption');
                    if (figure && value && !caption) {
                        caption = document.createElement('figcaption');
                        figure.appendChild(caption);
                    }
                    if (caption) {
                        if (value) caption.textContent = value;
                        else caption.remove();
                    }
                    changed++;
                });
                if (elements.length) row[3] = template.innerHTML;
            });
            if (changed && typeof markUnsavedChanges === 'function') markUnsavedChanges();
            FeatureDialog.close();
            showToast(`已更新 ${changed} 处媒体属性`, 'success');
            syncCurrentMediaEditor();
        });
        FeatureDialog.open('媒体属性', wrapper);
    }

    function createCard(item) {
        const card = document.createElement('article');
        card.className = 'media-card' + (item.reference.count === 0 ? ' is-orphan' : '');
        card.dataset.search = `${item.id} ${item.reference.name} ${item.directoryNames.join(' ')}`.toLowerCase();
        card.dataset.orphan = item.reference.count === 0 ? 'true' : 'false';
        card.dataset.type = item.info.type || 'media';
        card.dataset.size = String(Number(item.info.size) || 0);
        card.dataset.current = item.reference.dirIds.has(DirectoryNavigation.getCurrentDirId()) ? 'true' : 'false';

        const preview = document.createElement('div');
        preview.className = 'media-preview';
        const isImage = item.info.type === 'image' || (item.info.mimeType || '').startsWith('image/');
        if (isImage) {
            const img = document.createElement('img');
            img.alt = item.reference.name || '媒体缩略图';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.dataset.mediaPreviewId = item.id;
            preview.appendChild(img);
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
        const propertiesBtn = document.createElement('button');
        propertiesBtn.type = 'button';
        propertiesBtn.textContent = '属性';
        propertiesBtn.addEventListener('click', () => openProperties(item));
        actions.appendChild(propertiesBtn);
        if (item.reference.count > 0) {
            const replaceBtn = document.createElement('button');
            replaceBtn.type = 'button';
            replaceBtn.textContent = '替换';
            replaceBtn.title = '替换媒体数据并保留所有正文引用';
            replaceBtn.addEventListener('click', () => replaceItem(item));
            actions.appendChild(replaceBtn);
        }
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
            const currentLabel = document.createElement('label');
            const currentOnly = document.createElement('input');
            currentOnly.type = 'checkbox';
            currentLabel.append(currentOnly, document.createTextNode(' 当前目录'));
            const typeFilter = document.createElement('select');
            typeFilter.className = 'workspace-nav-select';
            typeFilter.innerHTML = '<option value="">全部类型</option><option value="image">图片</option><option value="video">视频</option><option value="archive">压缩文件</option>';
            const sizeFilter = document.createElement('select');
            sizeFilter.className = 'workspace-nav-select';
            sizeFilter.innerHTML = '<option value="">全部大小</option><option value="1048576">小于 1 MB</option><option value="10485760">小于 10 MB</option><option value="52428800">小于 50 MB</option>';
            const summary = document.createElement('span');
            summary.className = 'media-summary';
            summary.textContent = `${items.length} 个资源，${items.filter(item => item.reference.count === 0).length} 个孤立`;
            toolbar.append(search, typeFilter, sizeFilter, currentLabel, orphanLabel, summary);
            wrapper.appendChild(toolbar);
            const grid = document.createElement('div');
            grid.className = 'media-grid';
            items.forEach(item => grid.appendChild(createCard(item)));
            wrapper.appendChild(grid);
            const previewImages = Array.from(grid.querySelectorAll('img[data-media-preview-id]'));
            const previewUrls = new Set();
            let previewsClosed = false;
            const loadPreview = async img => {
                if (!img || img.dataset.mediaPreviewLoaded === 'true' || previewsClosed) return;
                img.dataset.mediaPreviewLoaded = 'true';
                try {
                    const url = await MediaStorage.getMediaAsUrl(img.dataset.mediaPreviewId);
                    if (!url) return;
                    if (previewsClosed || !img.isConnected) {
                        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
                        return;
                    }
                    img.src = url;
                    if (url.startsWith('blob:')) previewUrls.add(url);
                } catch (_) {
                    delete img.dataset.mediaPreviewLoaded;
                }
            };
            let previewObserver = null;
            if (typeof IntersectionObserver === 'undefined') {
                previewImages.forEach(loadPreview);
            } else {
                previewObserver = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting) return;
                        previewObserver?.unobserve(entry.target);
                        loadPreview(entry.target);
                    });
                }, { root: wrapper.closest('.feature-dialog-body'), rootMargin: '180px 0px' });
                previewImages.forEach(img => previewObserver.observe(img));
            }
            wrapper.closest('.feature-dialog-overlay')?.addEventListener('sora:feature-dialog-clear', () => {
                previewsClosed = true;
                previewObserver?.disconnect();
                previewUrls.forEach(url => URL.revokeObjectURL(url));
                previewUrls.clear();
            }, { once: true });
            const applyFilter = () => {
                const keyword = search.value.trim().toLowerCase();
                grid.querySelectorAll('.media-card').forEach(card => {
                    const matchesType = !typeFilter.value || card.dataset.type === typeFilter.value;
                    const matchesSize = !sizeFilter.value || Number(card.dataset.size) <= Number(sizeFilter.value);
                    const visible = (!keyword || card.dataset.search.includes(keyword)) && matchesType && matchesSize && (!currentOnly.checked || card.dataset.current === 'true') && (!orphanOnly.checked || card.dataset.orphan === 'true');
                    card.style.display = visible ? 'grid' : 'none';
                });
            };
            search.addEventListener('input', applyFilter);
            orphanOnly.addEventListener('change', applyFilter);
            currentOnly.addEventListener('change', applyFilter);
            typeFilter.addEventListener('change', applyFilter);
            sizeFilter.addEventListener('change', applyFilter);
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

const IssueCenter = (function() {
    const labels = {
        duplicateDirectoryIds: '重复目录 ID', missingParents: '父目录缺失', brokenLinks: '目录链接失效',
        missingAnchors: '锚点缺失', duplicateAnchors: '重复锚点', invalidMethods: '方法配置无效',
        missingMethodTargets: '方法目标缺失', duplicateMethodIds: '方法 ID 重复', missingMedia: '媒体缺失', emptyDirectories: '空目录',
        unsafeContent: '不安全的发布内容', headingJumps: '标题层级跳跃', duplicateHeadings: '重复标题',
        missingAltText: '图片缺少替代文本', longParagraphs: '过长段落'
    };
    const warningKeys = new Set(['duplicateAnchors', 'emptyDirectories', 'headingJumps', 'duplicateHeadings', 'missingAltText', 'longParagraphs']);
    let latestIssues = null;
    let timer = null;
    let idleHandle = null;
    let running = false;
    let pending = false;

    function total(issues) {
        return Object.values(issues || {}).reduce((sum, values) => sum + (Array.isArray(values) ? values.length : 0), 0);
    }

    function matchDirectory(value) {
        const text = String(value || '');
        return (Array.isArray(mulufile) ? mulufile : []).find(row => text.includes(row[2]) || text.includes(row[1])) || null;
    }

    function renderBadges() {
        document.querySelectorAll('.directory-issue-badge').forEach(badge => badge.remove());
        const counts = new Map();
        Object.entries(latestIssues || {}).forEach(([key, values]) => {
            values.forEach(value => {
                const row = matchDirectory(value);
                if (!row) return;
                const current = counts.get(row[2]) || { critical: 0, warning: 0 };
                current[warningKeys.has(key) ? 'warning' : 'critical']++;
                counts.set(row[2], current);
            });
        });
        counts.forEach((count, dirId) => {
            const element = document.querySelector(`.mulu[data-dir-id="${CSS.escape(String(dirId))}"]`);
            if (!element) return;
            const badge = document.createElement('button');
            badge.type = 'button';
            badge.className = 'directory-issue-badge' + (count.critical ? '' : ' is-warning');
            badge.textContent = String(count.critical + count.warning);
            badge.title = `${count.critical} 个错误，${count.warning} 个提醒`;
            badge.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                open(dirId);
            });
            element.appendChild(badge);
        });
        const globalBadge = document.getElementById('issueCountBadge');
        if (globalBadge) globalBadge.textContent = total(latestIssues) ? String(total(latestIssues)) : '';
    }

    async function refresh() {
        if (typeof collectExportPreflightIssues !== 'function') return;
        if (running) {
            pending = true;
            return;
        }
        running = true;
        try {
            latestIssues = await collectExportPreflightIssues(mulufile);
            renderBadges();
        } finally {
            running = false;
            if (pending) {
                pending = false;
                schedule(600);
            }
        }
    }

    function schedule(delay = 900) {
        clearTimeout(timer);
        if (idleHandle !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleHandle);
        idleHandle = null;
        timer = setTimeout(() => {
            timer = null;
            if (typeof requestIdleCallback === 'function') {
                idleHandle = requestIdleCallback(() => {
                    idleHandle = null;
                    refresh();
                }, { timeout: 1400 });
            } else refresh();
        }, delay);
    }

    function normalizeMethodIds() {
        const used = new Set();
        let changed = 0;
        const visit = method => {
            if (!method || typeof method !== 'object') return;
            if (!method.methodId || used.has(method.methodId)) {
                method.methodId = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
                changed++;
            }
            used.add(method.methodId);
            ['formatMethods', 'elseMethods', 'confirmMethods', 'cancelMethods'].forEach(key => (method[key] || []).forEach(visit));
        };
        mulufile.forEach(row => {
            const template = document.createElement('template');
            template.innerHTML = String(row[3] || '');
            let rowChanged = false;
            template.content.querySelectorAll('a[data-sora-methods]').forEach(link => {
                try {
                    const methods = JSON.parse(link.getAttribute('data-sora-methods') || '[]');
                    const before = changed;
                    methods.forEach(visit);
                    if (changed !== before) {
                        link.setAttribute('data-sora-methods', JSON.stringify(methods));
                        rowChanged = true;
                    }
                } catch (_) {}
            });
            if (rowChanged) row[3] = template.innerHTML;
        });
        if (changed) {
            if (typeof markUnsavedChanges === 'function') markUnsavedChanges();
            const selected = currentMuluName ? document.getElementById(currentMuluName) : null;
            if (selected && jiedianwords) jiedianwords.value = findMulufileData(selected);
            if (typeof updateMarkdownPreview === 'function') updateMarkdownPreview({ force: true });
            showToast(`已修复 ${changed} 个缺失或重复的方法 ID`, 'success');
        } else showToast('方法 ID 无需修复', 'info');
        schedule();
    }

    function open(directoryId = '') {
        const wrapper = document.createElement('div');
        const issues = latestIssues || {};
        const sections = Object.entries(issues).filter(([, values]) => values.length).map(([key, values]) => {
            const filtered = directoryId ? values.filter(value => matchDirectory(value)?.[2] === directoryId) : values;
            if (!filtered.length) return '';
            return `<section class="issue-section"><h3>${escapeHtml(labels[key] || key)}（${filtered.length}）</h3>${filtered.map(value => `<button type="button" class="issue-item" data-issue-value="${encodeURIComponent(String(value))}">${escapeHtml(value)}</button>`).join('')}</section>`;
        }).join('');
        wrapper.innerHTML = `<div class="issue-center-summary"><span class="issue-center-pill">共 ${total(issues)} 项</span><button type="button" class="method-workbench-btn" data-fix-method-ids>修复方法 ID</button></div>${sections || '<div class="command-empty">当前没有发现问题。</div>'}`;
        wrapper.addEventListener('click', event => {
            if (event.target.closest('[data-fix-method-ids]')) {
                FeatureDialog.close();
                normalizeMethodIds();
                return;
            }
            const item = event.target.closest('[data-issue-value]');
            if (!item) return;
            const row = matchDirectory(decodeURIComponent(item.dataset.issueValue || ''));
            if (row) {
                FeatureDialog.close();
                DirectoryNavigation.open(row[2]);
            }
        });
        FeatureDialog.open(directoryId ? '当前目录问题' : '问题中心', wrapper);
    }

    document.getElementById('issueCenterBtn')?.addEventListener('click', () => open());
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    setTimeout(refresh, 800);
    return { open, refresh, schedule };
})();
window.IssueCenter = IssueCenter;

const DirectoryFilter = (function() {
    const input = document.getElementById('directoryFilterInput');
    const branchButton = document.getElementById('directoryBranchFilterBtn');
    let branchOnly = false;

    function apply() {
        if (!input) return;
        const query = input.value.trim().toLocaleLowerCase();
        const currentDirId = DirectoryNavigation.getCurrentDirId();
        const elements = Array.from(document.querySelectorAll('.mulu'));
        const byDirId = new Map(elements.map(element => [element.getAttribute('data-dir-id'), element]));
        const allowedBranch = new Set();
        if (branchOnly && currentDirId) {
            elements.forEach(element => {
                let cursor = element.getAttribute('data-dir-id');
                const visited = new Set();
                while (cursor && cursor !== 'mulu' && !visited.has(cursor)) {
                    if (cursor === currentDirId) {
                        allowedBranch.add(element.getAttribute('data-dir-id'));
                        break;
                    }
                    visited.add(cursor);
                    const row = getMulufileByDirId(cursor);
                    cursor = row ? row[0] : '';
                }
            });
        }
        const visible = new Set();
        elements.forEach(element => {
            const dirId = element.getAttribute('data-dir-id') || '';
            const text = `${element.textContent} ${dirId}`.toLocaleLowerCase();
            if ((!query || text.includes(query)) && (!branchOnly || !currentDirId || allowedBranch.has(dirId))) {
                visible.add(dirId);
                let row = getMulufileByDirId(dirId);
                while (row && row[0] && row[0] !== 'mulu') {
                    visible.add(row[0]);
                    row = getMulufileByDirId(row[0]);
                }
            }
        });
        elements.forEach(element => {
            element.classList.toggle('directory-filter-hidden', !visible.has(element.getAttribute('data-dir-id')));
        });
    }

    input?.addEventListener('input', apply);
    branchButton?.addEventListener('click', () => {
        branchOnly = !branchOnly;
        branchButton.setAttribute('aria-pressed', String(branchOnly));
        apply();
    });
    const observer = new MutationObserver(() => {
        if ((input && input.value) || branchOnly) apply();
    });
    const root = document.querySelector('.firststep');
    if (root) observer.observe(root, { childList: true, subtree: true });
    return { apply };
})();
window.DirectoryFilter = DirectoryFilter;

const GlobalCommandPalette = (function() {
    const RECENTS_KEY = 'sora_command_recents_v1';

    function loadRecents() {
        try {
            const value = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
            return Array.isArray(value) ? value.slice(0, 12) : [];
        } catch (_) {
            return [];
        }
    }

    function recordRecent(key) {
        if (!key) return;
        const next = [key, ...loadRecents().filter(item => item !== key)].slice(0, 12);
        try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch (_) {}
    }

    function captureEditorRange() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount || !markdownPreview) return null;
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentNode
            : range.commonAncestorContainer;
        return container && markdownPreview.contains(container) ? range.cloneRange() : null;
    }

    function insertReference(directory, anchor, savedRange) {
        if (!markdownPreview || !DirectoryNavigation.getCurrentDirId()) {
            showToast('请先选择一个目录', 'warning');
            return;
        }
        const range = savedRange && savedRange.commonAncestorContainer && document.contains(savedRange.commonAncestorContainer)
            ? savedRange
            : document.createRange();
        if (!savedRange) {
            range.selectNodeContents(markdownPreview);
            range.collapse(false);
        }
        const link = document.createElement('a');
        link.href = `sora-dir:${directory.id}${anchor ? `#${anchor.id}` : ''}`;
        link.dataset.soraLink = 'dir';
        link.dataset.dirId = directory.id;
        if (anchor) link.dataset.anchorId = anchor.id;
        link.textContent = anchor ? (anchor.label || anchor.id) : directory.name;
        range.deleteContents();
        range.insertNode(link);
        const space = document.createTextNode(' ');
        link.after(space);
        range.setStartAfter(space);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        syncPreviewToTextarea();
        showToast('已插入内部链接', 'success');
    }

    function createItems(savedRange) {
        const items = [];
        const seen = new Set();
        const shortcutById = { saveBtn: 'Ctrl+S', searchBtn: 'Ctrl+F', replaceBtn: 'Ctrl+H', globalCommandBtn: 'Ctrl+K' };
        document.querySelectorAll('#topToolbar .top-toolbar-btn:not(#mobileMoreBtn)').forEach(button => {
            const buttonText = button.textContent.trim();
            const label = buttonText || button.title;
            if (!label || seen.has(label)) return;
            seen.add(label);
            const shortcut = shortcutById[button.id] || '';
            const disabledReason = button.disabled ? (button.title || '当前状态不可用') : '';
            items.push({ key: `toolbar:${button.id || label}`, type: 'command', icon: '⌘', title: label, shortcut, disabled: button.disabled, disabledReason, meta: disabledReason || button.title || '功能命令', search: `${label} ${button.title || ''} ${shortcut}`, run: () => button.click() });
        });
        (Array.isArray(window.SoraFeatureCommands) ? window.SoraFeatureCommands : []).forEach(command => {
            if (!command || !command.key || typeof command.run !== 'function' || seen.has(command.key)) return;
            seen.add(command.key);
            const disabledReason = typeof command.disabledReason === 'function' ? command.disabledReason() : (command.disabledReason || '');
            items.push({
                key: `feature:${command.key}`,
                type: 'command',
                icon: command.icon || '◇',
                title: command.title || command.key,
                shortcut: command.shortcut || '',
                disabled: !!disabledReason,
                disabledReason,
                meta: disabledReason || command.meta || '扩展功能',
                search: `${command.title || command.key} ${command.meta || ''} ${command.keywords || ''} ${command.shortcut || ''}`,
                run: command.run
            });
        });
        if (window.SoraReferencePicker) {
            const index = window.SoraReferencePicker.buildIndex();
            index.directories.forEach(directory => {
                items.push({
                    type: 'directory', icon: '▤', title: directory.name, meta: directory.path,
                    search: `${directory.name} ${directory.path} ${directory.id}`,
                    run: () => DirectoryNavigation.open(directory.id),
                    secondaryLabel: '插入链接',
                    secondaryRun: () => insertReference(directory, null, savedRange)
                });
                directory.anchors.forEach(anchor => {
                    items.push({
                        type: 'anchor', icon: '#', title: anchor.label || anchor.id, meta: `${directory.path} · #${anchor.id}`,
                        search: `${anchor.id} ${anchor.label} ${anchor.preview} ${directory.name} ${directory.path}`,
                        run: async () => {
                            await DirectoryNavigation.open(directory.id);
                            requestAnimationFrame(() => scrollToAnchorInPreview(anchor.id));
                        },
                        secondaryLabel: '插入链接',
                        secondaryRun: () => insertReference(directory, anchor, savedRange)
                    });
                });
            });
        }
        const recents = loadRecents();
        return items.sort((left, right) => {
            const leftIndex = recents.indexOf(left.key);
            const rightIndex = recents.indexOf(right.key);
            if (leftIndex < 0 && rightIndex < 0) return 0;
            if (leftIndex < 0) return 1;
            if (rightIndex < 0) return -1;
            return leftIndex - rightIndex;
        });
    }

    function open() {
        const savedRange = captureEditorRange();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<input type="search" class="command-search" placeholder="搜索目录、锚点或功能，例如：导出、媒体、章节" aria-label="全局搜索与命令"><p class="command-hint">↑↓ 选择 · Enter 执行 · Esc 关闭</p><div class="command-results"></div>';
        const input = wrapper.querySelector('input');
        const results = wrapper.querySelector('.command-results');
        let allItems = [];
        try {
            allItems = createItems(savedRange);
        } catch (error) {
            console.error('打开全局搜索失败:', error);
            wrapper.innerHTML = `<div class="command-empty">全局索引创建失败：${escapeHtml(error.message || error)}</div>`;
            FeatureDialog.open('全局搜索与命令', wrapper);
            return;
        }
        let visibleItems = [];
        let activeIndex = 0;
        const render = () => {
            const terms = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
            visibleItems = allItems.filter(item => terms.every(term => item.search.toLocaleLowerCase().includes(term))).slice(0, 60);
            activeIndex = Math.min(activeIndex, Math.max(0, visibleItems.length - 1));
            results.innerHTML = visibleItems.length ? visibleItems.map((item, index) => `<div class="command-result-row">
                <button type="button" class="command-result${index === activeIndex ? ' active' : ''}" data-command-index="${index}"${item.disabled ? ' disabled aria-disabled="true"' : ''}>
                    <span>${item.icon}</span><span><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.meta)}</small></span><small>${item.shortcut ? escapeHtml(item.shortcut) : (item.type === 'command' ? '执行' : '打开')}</small>
                </button>${item.secondaryRun ? `<button type="button" class="command-result-secondary" data-command-secondary-index="${index}">${escapeHtml(item.secondaryLabel)}</button>` : ''}</div>`).join('') : '<div class="command-empty">没有匹配结果。</div>';
        };
        const run = index => {
            const item = visibleItems[index];
            if (!item || item.disabled) return;
            recordRecent(item.key);
            FeatureDialog.close();
            item.run();
        };
        const runSecondary = index => {
            const item = visibleItems[index];
            if (!item || !item.secondaryRun) return;
            FeatureDialog.close();
            item.secondaryRun();
        };
        input.addEventListener('input', () => { activeIndex = 0; render(); });
        input.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                activeIndex = (activeIndex + delta + visibleItems.length) % Math.max(1, visibleItems.length);
                render();
                results.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
            } else if (event.key === 'Enter') {
                event.preventDefault();
                run(activeIndex);
            } else if (event.key === 'Escape') {
                FeatureDialog.close();
            }
        });
        results.addEventListener('click', event => {
            const secondary = event.target.closest('[data-command-secondary-index]');
            if (secondary) {
                runSecondary(Number(secondary.dataset.commandSecondaryIndex));
                return;
            }
            const button = event.target.closest('[data-command-index]');
            if (button) run(Number(button.dataset.commandIndex));
        });
        render();
        FeatureDialog.open('全局搜索与命令', wrapper);
        setTimeout(() => input.focus(), 0);
    }

    document.getElementById('globalCommandBtn')?.addEventListener('click', open);
    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            open();
        }
    });
    return { open };
})();
window.GlobalCommandPalette = GlobalCommandPalette;

(function initWorkspaceMode() {
    const select = document.getElementById('workspaceModeSelect');
    if (!select) return;
    const saved = localStorage.getItem('soraWorkspaceMode') || 'all';
    select.value = ['all', 'content', 'structure', 'automation'].includes(saved) ? saved : 'all';
    const apply = () => {
        document.body.dataset.workspaceMode = select.value;
        localStorage.setItem('soraWorkspaceMode', select.value);
    };
    select.addEventListener('change', apply);
    apply();
})();

document.getElementById('preflightBtn')?.addEventListener('click', async () => {
    if (typeof syncPreviewToTextarea === 'function') syncPreviewToTextarea();
    if (typeof showExportPreflight === 'function') {
        await showExportPreflight(mulufile);
    }
});
