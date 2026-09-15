const SoraMethodWorkbench = (function() {
    const PRESET_KEY = 'soraDirectoryMethodPresetsV1';

    function escapeHtml(value) {
        const element = document.createElement('div');
        element.textContent = String(value ?? '');
        return element.innerHTML;
    }

    function registry() {
        return window.SoraMethodRegistry;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function injectStyles() {
        if (document.getElementById('soraMethodWorkbenchStyles')) return;
        const style = document.createElement('style');
        style.id = 'soraMethodWorkbenchStyles';
        style.textContent = `
            .method-workbench-toolbar { display:grid; grid-template-columns:minmax(180px,1fr) 160px 160px auto; gap:8px; margin-bottom:12px; }
            .method-workbench-toolbar input, .method-workbench-toolbar select { min-height:36px; border:1px solid #cbd5e1; border-radius:6px; padding:6px 9px; background:#fff; }
            .method-workbench-list { display:grid; gap:9px; }
            .method-workbench-card { border:1px solid #dbe3ee; border-radius:8px; padding:11px 12px; background:#fff; }
            .method-workbench-card.is-disabled { opacity:.62; background:#f8fafc; }
            .method-workbench-main { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
            .method-workbench-title { font-weight:700; color:#172033; }
            .method-workbench-meta { margin-top:4px; color:#64748b; font-size:12px; overflow-wrap:anywhere; }
            .method-workbench-actions { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
            .method-workbench-actions button, .method-workbench-btn { border:1px solid #cbd5e1; border-radius:5px; background:#fff; min-height:30px; padding:4px 9px; cursor:pointer; }
            .method-workbench-actions button:hover, .method-workbench-btn:hover { border-color:#2563eb; color:#1d4ed8; }
            .method-workbench-danger { color:#b91c1c; }
            .method-workbench-empty { padding:26px; border:1px dashed #cbd5e1; border-radius:8px; text-align:center; color:#64748b; }
            .method-info-panel { border:1px solid #dbe3ee; border-radius:8px; padding:12px; background:#f8fafc; }
            .method-info-panel h3 { margin:0 0 8px; font-size:15px; }
            .method-flow-log { margin:0; padding-left:20px; color:#334155; }
            .method-preset-list { display:grid; gap:8px; margin-top:12px; }
            .method-preset-row { display:flex; align-items:center; justify-content:space-between; gap:10px; border:1px solid #e2e8f0; border-radius:7px; padding:9px; }
            @media(max-width:720px) {
                .method-workbench-toolbar { grid-template-columns:1fr 1fr; }
                .method-workbench-toolbar input { grid-column:1 / -1; }
                .method-workbench-main { display:block; }
                .method-workbench-actions { justify-content:flex-start; margin-top:9px; }
            }
        `;
        document.head.appendChild(style);
    }

    function readMethods(link) {
        try {
            const value = JSON.parse(link.getAttribute('data-sora-methods') || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            return [];
        }
    }

    function collectEntries() {
        const entries = [];
        if (typeof mulufile === 'undefined' || !Array.isArray(mulufile)) return entries;
        mulufile.forEach((row, rowIndex) => {
            if (!row || row.length !== 4) return;
            const template = document.createElement('template');
            template.innerHTML = String(row[3] || '');
            const links = Array.from(template.content.querySelectorAll('a[data-sora-link="method"][data-sora-methods]'));
            links.forEach((link, linkIndex) => {
                readMethods(link).forEach((method, methodIndex) => {
                    const normalized = registry() ? registry().normalize(clone(method), { assignId: true }) : method;
                    entries.push({
                        rowIndex,
                        linkIndex,
                        methodIndex,
                        dirId: row[2],
                        dirName: row[1],
                        displayText: link.textContent || '方法',
                        method: normalized
                    });
                });
            });
        });
        return entries;
    }

    function mutateEntry(entry, mutator) {
        const row = typeof mulufile !== 'undefined' ? mulufile[entry.rowIndex] : null;
        if (!row) return false;
        const template = document.createElement('template');
        template.innerHTML = String(row[3] || '');
        const link = template.content.querySelectorAll('a[data-sora-link="method"][data-sora-methods]')[entry.linkIndex];
        if (!link) return false;
        const methods = readMethods(link);
        if (!methods[entry.methodIndex]) return false;
        mutator(methods, entry.methodIndex, link);
        if (!methods.length) {
            link.replaceWith(...Array.from(link.childNodes));
        } else {
            link.setAttribute('data-sora-methods', JSON.stringify(methods));
            link.removeAttribute('data-sora-methods-executed');
        }
        row[3] = template.innerHTML;
        if (typeof markUnsavedChanges === 'function') markUnsavedChanges();
        const selected = document.querySelector(`.mulu[data-dir-id="${CSS.escape(String(row[2]))}"]`);
        if (selected && typeof currentMuluName !== 'undefined' && selected.id === currentMuluName) {
            if (jiedianwords) jiedianwords.value = row[3];
            if (typeof updateMarkdownPreview === 'function') updateMarkdownPreview({ force: true });
        }
        return true;
    }

    function migrateStoredMethods() {
        if (!registry() || typeof mulufile === 'undefined') return 0;
        let changed = 0;
        mulufile.forEach(row => {
            const template = document.createElement('template');
            template.innerHTML = String(row[3] || '');
            let rowChanged = false;
            template.content.querySelectorAll('a[data-sora-methods]').forEach(link => {
                let methods;
                try { methods = JSON.parse(link.getAttribute('data-sora-methods') || '[]'); } catch (_) { return; }
                if (!Array.isArray(methods)) return;
                const before = JSON.stringify(methods);
                const normalized = methods.map(method => registry().normalize(method, { assignId: true })).filter(Boolean);
                const after = JSON.stringify(normalized);
                if (before !== after) {
                    link.setAttribute('data-sora-methods', after);
                    rowChanged = true;
                    changed++;
                }
            });
            if (rowChanged) row[3] = template.innerHTML;
        });
        if (changed) {
            if (typeof markUnsavedChanges === 'function') markUnsavedChanges();
            if (typeof updateMarkdownPreview === 'function') updateMarkdownPreview({ force: true });
            toast(`已升级 ${changed} 处旧方法配置`);
        } else toast('所有方法配置均为当前版本', 'info');
        return changed;
    }

    function toast(message, type = 'success') {
        if (typeof showToast === 'function') showToast(message, type);
    }

    function getBuiltInPresets() {
        return [
            { name: '点击切换范围', builtIn: true, config: { trigger: 'click', methodType: '切换', frontAnchor: '' } },
            { name: '进入目录时展开并跳转', builtIn: true, config: { trigger: 'enter_dir', methodType: '展开并跳转', frontAnchor: '' } },
            { name: '输入变化后显示状态', builtIn: true, config: { trigger: 'change', methodType: '显示状态', stateDisplayType: 'value', variableName: 'inputValue' } },
            { name: '变量满足时显示', builtIn: true, config: { trigger: 'click', methodType: '显示', frontAnchor: '', conditions: [{ type: 'variable', key: 'progress', operator: 'greater', value: '0', join: 'AND' }] } }
        ];
    }

    function getUserPresets() {
        try {
            const value = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            return [];
        }
    }

    function writeUserPresets(presets) {
        localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
    }

    function savePreset(config, presetName = '') {
        injectStyles();
        const directName = String(presetName || '').trim().slice(0, 60);
        if (directName) {
            const presets = getUserPresets();
            presets.unshift({ id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: directName, config: clone(config), updatedAt: Date.now() });
            writeUserPresets(presets.slice(0, 50));
            return true;
        }
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <label for="methodPresetName"><strong>预设名称</strong></label>
            <input id="methodPresetName" class="form-control" maxlength="60" placeholder="例如：点击后展开章节" style="width:100%;margin-top:7px" />
            <div class="method-workbench-actions" style="margin-top:12px">
                <button type="button" data-save>保存预设</button>
            </div>`;
        wrapper.querySelector('[data-save]').addEventListener('click', () => {
            const name = wrapper.querySelector('#methodPresetName').value.trim();
            if (!name) {
                wrapper.querySelector('#methodPresetName').focus();
                return;
            }
            const presets = getUserPresets();
            presets.unshift({ id: `preset_${Date.now()}`, name, config: clone(config), updatedAt: Date.now() });
            writeUserPresets(presets.slice(0, 50));
            FeatureDialog.close();
            toast('方法预设已保存');
        });
        FeatureDialog.open('保存方法预设', wrapper);
        setTimeout(() => wrapper.querySelector('#methodPresetName').focus(), 0);
    }

    function choosePreset() {
        injectStyles();
        return new Promise(resolve => {
            const wrapper = document.createElement('div');
            const presets = [...getBuiltInPresets(), ...getUserPresets()];
            const list = document.createElement('div');
            list.className = 'method-preset-list';
            presets.forEach((preset, index) => {
                const row = document.createElement('div');
                row.className = 'method-preset-row';
                row.innerHTML = `<span><strong>${escapeHtml(preset.name)}</strong><br><small>${escapeHtml(registry() ? registry().summarize(preset.config) : preset.config.methodType)}</small></span>
                    <div class="method-workbench-actions"><button type="button" data-use="${index}">使用</button>${preset.builtIn ? '' : `<button type="button" class="method-workbench-danger" data-delete="${escapeHtml(preset.id)}">删除</button>`}</div>`;
                list.appendChild(row);
            });
            wrapper.appendChild(list);
            wrapper.addEventListener('click', event => {
                const useButton = event.target.closest('[data-use]');
                const deleteButton = event.target.closest('[data-delete]');
                if (useButton) {
                    FeatureDialog.close();
                    resolve(clone(presets[Number(useButton.dataset.use)].config));
                } else if (deleteButton) {
                    writeUserPresets(getUserPresets().filter(item => item.id !== deleteButton.dataset.delete));
                    FeatureDialog.close();
                    resolve(choosePreset());
                }
            });
            FeatureDialog.open('方法预设', wrapper);
        });
    }

    function locateEntry(entry) {
        const target = document.querySelector(`.mulu[data-dir-id="${CSS.escape(String(entry.dirId))}"]`);
        if (target && typeof switchToDirectoryElement === 'function') {
            FeatureDialog.close();
            switchToDirectoryElement(target, { syncCurrent: true, viewMode: 'restore', forceRender: true });
            setTimeout(() => {
                const link = markdownPreview && markdownPreview.querySelectorAll('a[data-sora-link="method"]')[entry.linkIndex];
                if (link) link.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 80);
        }
    }

    function showRelations(methodId) {
        injectStyles();
        const entries = collectEntries();
        const selected = entries.find(entry => entry.method.methodId === methodId);
        const refs = [];
        const visit = (method, source, seen = new Set()) => {
            if (!method || seen.has(method)) return;
            seen.add(method);
            ['frontAnchor', 'backAnchor', 'replaceFromFrontAnchor', 'replaceFromBackAnchor', 'destinationFrontAnchor', 'destinationBackAnchor', 'contentFrontAnchor', 'contentBackAnchor', 'navigateTarget'].forEach(key => {
                if (method[key]) refs.push({ source, key, value: method[key] });
            });
            [...(method.formatMethods || []), ...(method.elseMethods || []), ...(method.confirmMethods || []), ...(method.cancelMethods || [])]
                .forEach(nested => visit(nested, `${source} → ${nested.methodType || '嵌套方法'}`, seen));
        };
        if (selected) visit(selected.method, selected.dirName);
        const dependents = entries.filter(entry => {
            const raw = JSON.stringify(entry.method);
            return methodId && entry.method.methodId !== methodId && raw.includes(methodId);
        });
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <p><strong>${escapeHtml(selected ? registry().summarize(selected.method) : '尚未保存的方法')}</strong></p>
            <p class="method-workbench-meta">所在目录：${escapeHtml(selected ? selected.dirName : '当前配置尚未写入目录')}</p>
            <h3>引用目标（${refs.length}）</h3>
            ${refs.length ? `<ul>${refs.map(item => `<li>${escapeHtml(item.source)} · ${escapeHtml(item.key)} → <code>${escapeHtml(item.value)}</code></li>`).join('')}</ul>` : '<p class="method-workbench-empty">没有目标引用。</p>'}
            <h3>被其他方法引用（${dependents.length}）</h3>
            ${dependents.length ? `<ul>${dependents.map(item => `<li>${escapeHtml(item.dirName)} · ${escapeHtml(registry().summarize(item.method))}</li>`).join('')}</ul>` : '<p class="method-workbench-empty">没有检测到依赖此方法的配置。</p>'}`;
        FeatureDialog.open('方法关系', wrapper);
    }

    function showFlow(config) {
        const core = window.SoraMethodRuntimeCore;
        const steps = core ? core.flattenFlow(config) : [{ method: config, branch: 'main', depth: 0, trigger: config.trigger || 'click', type: config.methodType || '未知动作' }];
        const branchNames = { main: '主流程', nested: '嵌套', fallback: '失败备用', confirm: '确认分支', cancel: '取消分支' };
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<p class="method-workbench-meta">按实际嵌套顺序展示配置；运行耗时和结果可在完整互动导出的诊断时间线中查看。</p><ol class="method-flow-log">${steps.map((step, index) => `<li style="margin-left:${Math.min(4, step.depth) * 18}px"><strong>${index + 1}. ${escapeHtml(step.type)}</strong><br><small>${escapeHtml(branchNames[step.branch] || step.branch)} · ${escapeHtml(step.trigger || 'click')} · ${escapeHtml(step.methodId || '未保存 ID')}</small></li>`).join('')}</ol>`;
        FeatureDialog.open('方法流程视图', wrapper);
    }

    function openManager() {
        injectStyles();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="method-workbench-toolbar">
                <input type="search" placeholder="搜索目录、动作、触发或目标" aria-label="搜索方法" />
                <select data-trigger><option value="">全部触发</option></select>
                <select data-action><option value="">全部动作</option></select>
                <span><button type="button" class="method-workbench-btn" data-preset>预设库</button> <button type="button" class="method-workbench-btn" data-migrate>升级配置</button></span>
            </div>
            <div class="method-workbench-list"></div>`;
        const search = wrapper.querySelector('input');
        const trigger = wrapper.querySelector('[data-trigger]');
        const action = wrapper.querySelector('[data-action]');
        if (registry()) {
            registry().getTriggers().forEach(item => trigger.add(new Option(item.label, item.value)));
            registry().getActions().forEach(item => action.add(new Option(item.label, item.value)));
        }
        let entries = collectEntries();
        const render = () => {
            const query = search.value.trim().toLowerCase();
            const filtered = entries.filter(entry => {
                if (trigger.value && entry.method.trigger !== trigger.value) return false;
                if (action.value && entry.method.methodType !== action.value) return false;
                return !query || `${entry.dirName} ${entry.displayText} ${registry() ? registry().summarize(entry.method) : ''} ${JSON.stringify(entry.method)}`.toLowerCase().includes(query);
            }).sort((a, b) => a.dirName.localeCompare(b.dirName, 'zh-CN') || a.linkIndex - b.linkIndex || a.methodIndex - b.methodIndex);
            const list = wrapper.querySelector('.method-workbench-list');
            if (!filtered.length) {
                list.innerHTML = '<div class="method-workbench-empty">没有符合条件的方法。</div>';
                return;
            }
            list.innerHTML = filtered.map((entry, index) => `
                <article class="method-workbench-card${entry.method.enabled === false ? ' is-disabled' : ''}" data-visible-index="${index}">
                    <div class="method-workbench-main"><div><div class="method-workbench-title">${escapeHtml(registry() ? registry().summarize(entry.method) : entry.method.methodType)}</div>
                    <div class="method-workbench-meta">${escapeHtml(entry.dirName)} · 显示为“${escapeHtml(entry.displayText)}” · ${escapeHtml(entry.method.methodId || '无 ID')}</div></div>
                    <div class="method-workbench-actions">
                        <button type="button" data-action-name="locate">定位</button><button type="button" data-action-name="flow">流程</button><button type="button" data-action-name="relations">关系</button>
                        <button type="button" data-action-name="toggle">${entry.method.enabled === false ? '启用' : '禁用'}</button><button type="button" data-action-name="copy">复制</button><button type="button" data-action-name="edit">编辑</button><button type="button" class="method-workbench-danger" data-action-name="delete">删除</button>
                    </div></div>
                </article>`).join('');
            list.onclick = async event => {
                const button = event.target.closest('[data-action-name]');
                const card = event.target.closest('[data-visible-index]');
                if (!button || !card) return;
                const entry = filtered[Number(card.dataset.visibleIndex)];
                const name = button.dataset.actionName;
                if (name === 'locate') return locateEntry(entry);
                if (name === 'flow') return showFlow(entry.method);
                if (name === 'relations') return showRelations(entry.method.methodId);
                if (name === 'edit') {
                    FeatureDialog.close();
                    const updated = await showMethodConfigDialog(entry.method);
                    if (updated && mutateEntry(entry, methods => { methods[entry.methodIndex] = updated; })) toast('方法已更新');
                    return openManager();
                }
                mutateEntry(entry, (methods, methodIndex) => {
                    if (name === 'toggle') methods[methodIndex].enabled = methods[methodIndex].enabled === false;
                    if (name === 'copy') {
                        const copy = clone(methods[methodIndex]);
                        delete copy.methodId;
                        methods.splice(methodIndex + 1, 0, registry() ? registry().normalize(copy, { assignId: true }) : copy);
                    }
                    if (name === 'delete') methods.splice(methodIndex, 1);
                });
                entries = collectEntries();
                render();
            };
        };
        [search, trigger, action].forEach(control => control.addEventListener(control === search ? 'input' : 'change', render));
        wrapper.querySelector('[data-preset]').addEventListener('click', async () => {
            const preset = await choosePreset();
            if (!preset) return openManager();
            FeatureDialog.close();
            const configured = await showMethodConfigDialog(preset);
            if (!configured) return openManager();
            savePreset(configured);
        });
        wrapper.querySelector('[data-migrate]').addEventListener('click', () => {
            migrateStoredMethods();
            entries = collectEntries();
            render();
        });
        render();
        FeatureDialog.open('方法管理', wrapper);
    }

    function init() {
        injectStyles();
        const button = document.getElementById('methodManagerBtn');
        if (button) button.addEventListener('click', openManager);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    return { collectEntries, savePreset, choosePreset, showRelations, openManager, migrateStoredMethods };
})();

window.SoraMethodWorkbench = SoraMethodWorkbench;
