const SoraSaveWorkflow = (function() {
    let activeTask = null;
    const copy = value => JSON.parse(JSON.stringify(value || {}));

    function capture(data = null) {
        syncPreviewToTextarea();
        return {
            identity: SoraDocumentIdentity.get(),
            revision: soraEditRevision,
            data: (data || mulufile).map(row => Array.isArray(row) ? row.slice() : row),
            colors: typeof serializeDirectoryLevelColors === 'function' ? copy(serializeDirectoryLevelColors()) : {},
            metadata: window.DirectoryMetadata ? copy(DirectoryMetadata.serialize()) : {},
            encrypted: soraDocumentEncrypted
        };
    }

    function unchanged(state) {
        if (SoraDocumentIdentity.get().id !== state.identity.id || soraEditRevision !== state.revision) return false;
        const current = capture();
        return JSON.stringify([current.data, current.colors, current.metadata]) === JSON.stringify([state.data, state.colors, state.metadata]);
    }

    async function waitForMedia() {
        const pending = window.__soraMediaImportPromise;
        if (pending) {
            showToast('等待媒体导入完成后继续…', 'info');
            await pending;
        }
        if (window.__soraMediaImportError) {
            const missing = [];
            for (const id of collectSoraPackageMediaIds(mulufile)) if (!await MediaStorage.mediaExists(id)) missing.push(id);
            if (missing.length) throw new Error(`有 ${missing.length} 个媒体未导入，请重新加载原文件或在媒体库补齐后再保存`);
            window.__soraMediaImportError = null;
        }
    }

    async function finish(state, { written, encrypt }) {
        try { await DraftManager.rememberDocument(state.data, state.identity); }
        catch (error) {
            showToast(`${written ? '文件已写入，但' : ''}本地恢复保护更新失败：${error.message}，未清除草稿`, 'warning', 4500);
            return;
        }
        if (SoraDocumentIdentity.get().id !== state.identity.id) return;
        SoraDocumentIdentity.adopt(state.identity.id, currentFileName || state.identity.label, state.identity.source);
        soraDocumentEncrypted = encrypt;
        if (written && unchanged(state)) {
            clearUnsavedChanges({ keepDraft: true });
            await DraftManager.clear(state.identity.id);
        } else {
            hasUnsavedChanges = true;
            updateSaveButtonState();
            await DraftManager.saveNow({ force: true });
            if (written) showToast('已写入保存时的版本；后续修改仍未保存', 'info', 3500);
        }
    }

    function run(task) {
        if (activeTask) { showToast('文件正在处理，请稍候', 'info'); return activeTask; }
        activeTask = Promise.resolve().then(task).catch(async error => {
            if (error.name !== 'AbortError') await customAlert(error.message || '文件处理失败，请重试', '文件未完成');
            return false;
        }).finally(() => { activeTask = null; updateSaveButtonState(); });
        updateSaveButtonState();
        return activeTask;
    }

    function save() {
        return run(async () => {
            await waitForMedia();
            const state = capture();
            const scope = { mode: 'all', count: state.data.length, label: '全部目录', documentState: state };
            let password = null;
            if (state.encrypted) {
                password = await customPasswordPrompt('输入本次保存的加密密码：', '保存加密文件', 'new-password');
                if (!password) return false;
                const confirmation = await customPasswordPrompt('再次输入密码：', '确认加密密码', 'new-password');
                if (confirmation !== password) throw new Error('两次密码不一致，文件未保存');
            }
            if (currentFileHandle && isSoraPackageFile(currentFileName)) {
                if (state.encrypted) await writeEncryptedSoraPackageToFileHandle(currentFileHandle, state.data, scope, password);
                else await writeSoraPackageToFileHandle(currentFileHandle, state.data, scope);
                await finish(state, { written: true, encrypt: state.encrypted });
                showToast(`已写入：${currentFileName}`, 'success');
                return true;
            }
            if (currentFileHandle && !state.encrypted) {
                for (const id of collectSoraPackageMediaIds(state.data)) {
                    if (!await MediaStorage.mediaExists(id)) throw new Error(`媒体 ${id} 缺失，请补齐后再保存`);
                }
                const prepared = await prepareDataForExport(state.data);
                const content = formatDataByExtension(prepared, currentFileName);
                await writePartsToFileHandle(currentFileHandle, [content]);
                await finish(state, { written: true, encrypt: false });
                showToast(`已写入：${currentFileName}`, 'success');
                return true;
            }
            return handleSaveAsSoraPackage(null, state.data, scope, { setCurrent: true, encrypt: state.encrypted, password, saveState: state });
        });
    }

    async function exportPatch(mode, encrypt, password, state) {
        const modified = getModifiedDirectories();
        if (!modified.length) { showToast('没有可导出的目录修改', 'info'); return false; }
        const data = mode === 'diff' ? await prepareDiffDataForExport(modified) : await prepareModifiedDataForExport(modified);
        if (!unchanged(state)) throw new Error('准备补丁期间内容发生变化，请重新导出');
        let text = stringifyJsonData(data);
        if (encrypt) text = ENCRYPTED_FILE_HEADER + ':' + await encryptData(text, password);
        const name = `${getSoraBaseName(fileNameInput.value || currentFileName || 'soralist')}${mode === 'diff' ? '.patch' : '_incremental'}${encrypt ? '.encrypted' : ''}.json`;
        const action = await showPreparedFileActions(new File([text], name, { type: 'application/json' }), name);
        if (action !== 'cancel') showToast(action === 'share' ? '已交给分享应用，原文档保存状态未变' : '已发起补丁下载，原文档保存状态未变', 'info');
        return action !== 'cancel';
    }

    function openExport() {
        if (activeTask) { showToast('请等待当前文件处理完成', 'info'); return; }
        const wrapper = document.createElement('form');
        wrapper.className = 'sora-export-form';
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem('sora_export_options_v1') || '{}'); } catch (_) {}
        if (!saved || typeof saved !== 'object') saved = {};
        wrapper.innerHTML = `
            <div class="sora-export-grid">
                <label>导出格式<select name="format"><option value="sora">可编辑文件（.sora，包含媒体）</option><option value="webpage">阅读网页（.html）</option><option value="modified">修改目录（增量 JSON）</option><option value="diff">内容差异（补丁 JSON）</option></select></label>
                <label>导出范围<select name="scope"><option value="all">全部目录</option><option value="current">当前目录及子目录</option><option value="pick">手动选择目录</option></select></label>
                <label>文件保护<select name="encrypt"><option value="no">不加密</option><option value="yes">密码加密</option></select></label>
            </div>
            <div class="sora-export-grid" data-password-fields hidden>
                <label>密码<input name="password" type="password" autocomplete="new-password"></label>
                <label>确认密码<input name="confirmation" type="password" autocomplete="new-password"></label>
            </div>
            <div class="sora-export-grid" data-web-fields hidden>
                <label>网页形式<select name="deployment"><option value="single-html">单 HTML</option><option value="static-folder">静态网站目录</option><option value="pwa-folder">离线应用目录（PWA）</option></select></label>
                <label>媒体存放<select name="split"><option value="no">嵌入网页</option><option value="yes">拆分为独立文件</option></select></label>
            </div>
            <p class="media-summary" data-export-summary aria-live="polite"></p>
            <p class="sora-form-error" data-export-error role="alert"></p>
            <div class="method-workbench-actions"><button type="button" data-pick-directories>选择目录</button><button type="button" data-publication>更多发布设置</button><button type="submit">生成文件</button></div>`;
        const fields = wrapper.elements;
        if (['sora', 'webpage', 'modified', 'diff'].includes(saved.format)) fields.format.value = saved.format;
        if (['all', 'current', 'pick'].includes(saved.scope)) fields.scope.value = saved.scope;
        fields.encrypt.value = soraDocumentEncrypted ? 'yes' : saved.encrypt === 'yes' ? 'yes' : 'no';
        const publication = window.PublicationSettings?.get() || {};
        fields.deployment.value = publication.deploymentMode || 'single-html';
        fields.split.value = publication.splitMedia ? 'yes' : 'no';
        let selectedIds = [];
        const getRows = () => {
            if (fields.scope.value === 'all') return mulufile;
            const ids = fields.scope.value === 'current' ? collectDirectorySubtreeIds(getCurrentExportDirId()) : new Set(selectedIds);
            return buildPartialExportData(ids);
        };
        const refresh = () => {
            const patch = ['modified', 'diff'].includes(fields.format.value);
            const web = fields.format.value === 'webpage';
            fields.scope.disabled = patch;
            wrapper.querySelector('[data-password-fields]').hidden = fields.encrypt.value !== 'yes';
            fields.password.required = fields.confirmation.required = fields.encrypt.value === 'yes';
            wrapper.querySelector('[data-web-fields]').hidden = !web;
            wrapper.querySelector('[data-publication]').hidden = !web;
            wrapper.querySelector('[data-pick-directories]').hidden = patch || fields.scope.value !== 'pick';
            const modifiedIds = patch ? new Set(getModifiedDirectories()) : null;
            const rows = patch ? mulufile.filter(row => modifiedIds.has(row[2])) : getRows();
            const textBytes = new TextEncoder().encode(rows.map(row => row[3] || '').join('')).byteLength;
            const mediaCount = collectSoraPackageMediaIds(rows).size;
            let detail = `${rows.length} 个目录 · 正文约 ${formatSoraProgressBytes(textBytes)} · ${mediaCount} 个媒体；最终大小随媒体与加密变化。`;
            if (patch) detail += ' 补丁需合并到原文档，不包含目录删除操作。';
            if (web) detail += fields.split.value === 'yes' ? ' 将生成网页和媒体目录，请整体分享；本地打开可使用随包启动器。' : ' 媒体嵌入网页，适合单文件分享。';
            if (web && fields.encrypt.value === 'yes' && fields.deployment.value === 'pwa-folder') detail += ' 加密网页将使用静态目录。';
            wrapper.querySelector('[data-export-summary]').textContent = detail;
        };
        wrapper.addEventListener('change', refresh);
        wrapper.querySelector('[data-pick-directories]').onclick = async () => {
            const ids = await showDirectoryExportPicker(getCurrentExportDirId());
            if (ids) selectedIds = [...ids];
            refresh();
        };
        wrapper.querySelector('[data-publication]').onclick = () => {
            try { localStorage.setItem('sora_export_options_v1', JSON.stringify({ format: fields.format.value, scope: fields.scope.value, encrypt: fields.encrypt.value })); } catch (_) {}
            FeatureDialog.close();
            PublicationSettings.open();
        };
        wrapper.onsubmit = event => {
            event.preventDefault();
            const error = wrapper.querySelector('[data-export-error]');
            const encrypt = fields.encrypt.value === 'yes';
            const password = encrypt ? fields.password.value : null;
            if (encrypt && (!password || password !== fields.confirmation.value)) { error.textContent = '请填写密码，并确保两次输入一致。'; return; }
            const format = fields.format.value;
            const patch = ['modified', 'diff'].includes(format);
            const rows = patch ? mulufile : getRows();
            if (!rows.length) { error.textContent = '请选择至少一个目录。'; return; }
            if (format === 'webpage' && (fields.deployment.value !== 'single-html' || fields.split.value === 'yes') && typeof showDirectoryPicker !== 'function') {
                error.textContent = '当前浏览器无法写入目录，请选择单 HTML 并嵌入媒体，或改用支持目录写入的浏览器。'; return;
            }
            const scope = { mode: fields.scope.value === 'all' ? 'all' : 'partial', count: rows.length, label: fields.scope.selectedOptions[0].textContent };
            scope.publicationSettings = { ...PublicationSettings.get(), deploymentMode: fields.deployment.value, splitMedia: fields.split.value === 'yes' };
            const state = capture(rows);
            scope.documentState = state;
            try { localStorage.setItem('sora_export_options_v1', JSON.stringify({ format, scope: fields.scope.value, encrypt: fields.encrypt.value })); } catch (_) {}
            fields.password.value = fields.confirmation.value = '';
            FeatureDialog.close();
            run(async () => {
                await waitForMedia();
                await DraftManager.saveNow({ force: true });
                if (patch) return exportPatch(format, encrypt, password, state);
                if (!await confirmExportPreflight(state.data)) return false;
                if (format === 'sora') return handleSaveAsSoraPackage(null, state.data, scope, { encrypt, password, saveState: state });
                return handleSaveAsWebpage(encrypt, password, state.data, scope);
            });
        };
        refresh();
        FeatureDialog.open('导出与另存为', wrapper);
    }

    return { capture, finish, waitForMedia, save, openExport, busy: () => !!activeTask };
})();
window.SoraSaveWorkflow = SoraSaveWorkflow;
