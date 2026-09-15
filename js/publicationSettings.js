const PublicationSettings = (function() {
    const STORAGE_KEY = 'sora_publication_settings_v1';
    const MAX_HISTORY = 10;
    const DEFAULTS = Object.freeze({
        title: '',
        description: '',
        icon: '',
        language: 'zh-CN',
        theme: 'system',
        defaultDirectory: 'first',
        initialTreeState: 'expanded',
        navigationMode: 'sidebar',
        capabilityLevel: 'standard',
        searchEnabled: true,
        mediaPolicy: 'balanced',
        deploymentMode: 'single-html',
        debugEnabled: false
    });
    const ALLOWED = {
        theme: new Set(['system', 'light', 'dark', 'high-contrast']),
        initialTreeState: new Set(['expanded', 'collapsed', 'current-path']),
        navigationMode: new Set(['sidebar', 'content-first']),
        capabilityLevel: new Set(['compact', 'standard', 'full']),
        mediaPolicy: new Set(['balanced', 'manual', 'blocked']),
        deploymentMode: new Set(['single-html', 'static-folder', 'pwa-folder'])
    };
    let state = loadState();

    function normalizeText(value, maxLength) {
        return String(value || '').trim().slice(0, maxLength);
    }

    function sanitize(value) {
        const source = value && typeof value === 'object' ? value : {};
        const next = { ...DEFAULTS };
        next.title = normalizeText(source.title, 120);
        next.description = normalizeText(source.description, 300);
        const icon = normalizeText(source.icon, 2000);
        next.icon = /^(?:https?:|data:image\/|\.\.?\/)/i.test(icon) ? icon : '';
        next.language = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(String(source.language || ''))
            ? String(source.language)
            : DEFAULTS.language;
        Object.keys(ALLOWED).forEach(key => {
            next[key] = ALLOWED[key].has(source[key]) ? source[key] : DEFAULTS[key];
        });
        const defaultDirectory = String(source.defaultDirectory || 'first');
        next.defaultDirectory = defaultDirectory === 'first' || defaultDirectory === 'current' || /^dir:/.test(defaultDirectory)
            ? defaultDirectory
            : 'first';
        next.searchEnabled = source.searchEnabled !== false;
        next.debugEnabled = source.debugEnabled === true;
        return next;
    }

    function loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            const presets = {};
            if (saved && saved.presets && typeof saved.presets === 'object') {
                Object.entries(saved.presets).forEach(([name, value]) => {
                    const safeName = normalizeText(name, 40);
                    if (safeName) presets[safeName] = sanitize(value);
                });
            }
            return {
                active: sanitize(saved && saved.active),
                presets,
                history: Array.isArray(saved && saved.history)
                    ? saved.history.slice(0, MAX_HISTORY).map(sanitize)
                    : []
            };
        } catch (_) {
            return { active: sanitize(DEFAULTS), presets: {}, history: [] };
        }
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (_) {
            if (typeof showToast === 'function') showToast('发布设置无法写入本地存储', 'warning', 2600);
            return false;
        }
    }

    function same(a, b) {
        return JSON.stringify(sanitize(a)) === JSON.stringify(sanitize(b));
    }

    function commit(next, keepHistory = true) {
        const normalized = sanitize(next);
        if (same(normalized, state.active)) return false;
        if (keepHistory) state.history.unshift(sanitize(state.active));
        state.history = state.history.slice(0, MAX_HISTORY);
        state.active = normalized;
        persist();
        return true;
    }

    function get() {
        return sanitize(state.active);
    }

    function resolve(muluData, currentDirId, fallbackTitle) {
        const settings = get();
        if (settings.capabilityLevel === 'compact') {
            settings.searchEnabled = false;
            settings.debugEnabled = false;
        } else if (settings.capabilityLevel !== 'full') {
            settings.debugEnabled = false;
        }
        const rows = Array.isArray(muluData) ? muluData.filter(row => Array.isArray(row) && row.length === 4) : [];
        const ids = new Set(rows.map(row => String(row[2])));
        let defaultDirId = rows.length ? String(rows[0][2]) : '';
        if (settings.defaultDirectory === 'current' && ids.has(String(currentDirId || ''))) {
            defaultDirId = String(currentDirId);
        } else if (settings.defaultDirectory.startsWith('dir:')) {
            const requestedId = settings.defaultDirectory.slice(4);
            if (ids.has(requestedId)) defaultDirId = requestedId;
        }
        return {
            ...settings,
            title: settings.title || normalizeText(fallbackTitle, 120) || 'SoraDirectory',
            defaultDirId
        };
    }

    function addField(grid, labelText, control, helpText) {
        const label = document.createElement('label');
        label.className = 'publication-field';
        const caption = document.createElement('span');
        caption.textContent = labelText;
        label.appendChild(caption);
        label.appendChild(control);
        if (helpText) {
            const help = document.createElement('small');
            help.textContent = helpText;
            label.appendChild(help);
        }
        grid.appendChild(label);
        return control;
    }

    function createInput(type, value) {
        const input = document.createElement('input');
        input.type = type;
        if (type === 'checkbox') input.checked = Boolean(value);
        else input.value = value || '';
        return input;
    }

    function createSelect(options, value) {
        const select = document.createElement('select');
        options.forEach(([optionValue, label]) => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = label;
            select.appendChild(option);
        });
        select.value = value;
        return select;
    }

    function readForm(controls) {
        return sanitize({
            title: controls.title.value,
            description: controls.description.value,
            icon: controls.icon.value,
            language: controls.language.value,
            theme: controls.theme.value,
            defaultDirectory: controls.defaultDirectory.value,
            initialTreeState: controls.initialTreeState.value,
            navigationMode: controls.navigationMode.value,
            capabilityLevel: controls.capabilityLevel.value,
            searchEnabled: controls.searchEnabled.checked,
            mediaPolicy: controls.mediaPolicy.value,
            deploymentMode: controls.deploymentMode.value,
            debugEnabled: controls.debugEnabled.checked
        });
    }

    function fillForm(controls, value) {
        const settings = sanitize(value);
        Object.entries(settings).forEach(([key, fieldValue]) => {
            const control = controls[key];
            if (!control) return;
            if (control.type === 'checkbox') control.checked = Boolean(fieldValue);
            else control.value = fieldValue;
        });
    }

    function describeDifferences(a, b) {
        const labels = {
            title: '标题', description: '说明', icon: '图标', language: '语言', theme: '主题',
            defaultDirectory: '默认目录', initialTreeState: '目录初始状态', navigationMode: '导航方式',
            capabilityLevel: '产物等级', searchEnabled: '搜索', mediaPolicy: '媒体策略', deploymentMode: '部署方式', debugEnabled: '调试'
        };
        const left = sanitize(a);
        const right = sanitize(b);
        const differences = Object.keys(DEFAULTS).filter(key => left[key] !== right[key]);
        return differences.length ? `与当前设置有 ${differences.length} 项差异：${differences.map(key => labels[key]).join('、')}` : '与当前设置一致';
    }

    function ensureStyle() {
        if (document.getElementById('publicationSettingsStyle')) return;
        const style = document.createElement('style');
        style.id = 'publicationSettingsStyle';
        style.textContent = `
            .publication-settings { display:grid; gap:14px; }
            .publication-settings-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
            .publication-field { display:grid; gap:5px; color:#334155; font-size:13px; }
            .publication-field > span { font-weight:700; }
            .publication-field input:not([type="checkbox"]), .publication-field select, .publication-field textarea { width:100%; min-height:38px; padding:7px 9px; border:1px solid #94a3b8; border-radius:6px; background:#fff; color:#0f172a; font:inherit; }
            .publication-field textarea { min-height:76px; resize:vertical; }
            .publication-field small, .publication-status { color:#64748b; line-height:1.45; }
            .publication-check { display:flex; align-items:center; gap:8px; min-height:38px; }
            .publication-check input { width:18px; height:18px; }
            .publication-preset { display:grid; grid-template-columns:minmax(160px,1fr) minmax(160px,1fr) auto auto; gap:8px; padding-top:12px; border-top:1px solid #e2e8f0; }
            .publication-preset input, .publication-preset select { min-height:38px; padding:7px 9px; border:1px solid #94a3b8; border-radius:6px; background:#fff; }
            .publication-actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; padding-top:12px; border-top:1px solid #e2e8f0; }
            .publication-actions button, .publication-preset button { min-height:38px; padding:7px 11px; border:1px solid #94a3b8; border-radius:6px; background:#fff; color:#1e293b; cursor:pointer; }
            .publication-actions .primary { border-color:#2563eb; background:#2563eb; color:#fff; }
            @media (max-width:700px) { .publication-settings-grid { grid-template-columns:1fr; } .publication-preset { grid-template-columns:1fr 1fr; } }
        `;
        document.head.appendChild(style);
    }

    function open() {
        if (typeof FeatureDialog === 'undefined') {
            if (typeof customAlert === 'function') customAlert('发布设置界面尚未就绪');
            return;
        }
        ensureStyle();
        const wrapper = document.createElement('div');
        wrapper.className = 'publication-settings';
        const grid = document.createElement('div');
        grid.className = 'publication-settings-grid';
        const active = get();
        const controls = {};

        controls.title = addField(grid, '发布标题', createInput('text', active.title), '留空时使用项目文件名');
        controls.language = addField(grid, '页面语言', createInput('text', active.language), '例如 zh-CN、en-US');
        controls.description = document.createElement('textarea');
        controls.description.value = active.description;
        controls.description.maxLength = 300;
        addField(grid, '发布说明', controls.description, '写入网页摘要，不会改动正文');
        controls.icon = addField(grid, '页面图标', createInput('text', active.icon), '支持 HTTPS、data:image 或相对路径；危险协议会被清空');
        controls.theme = addField(grid, '主题', createSelect([
            ['system', '跟随系统'], ['light', '浅色'], ['dark', '深色'], ['high-contrast', '高对比度']
        ], active.theme));
        const directoryOptions = [['first', '第一个目录'], ['current', '导出时当前目录']];
        (typeof mulufile !== 'undefined' && Array.isArray(mulufile) ? mulufile : []).forEach(row => {
            if (Array.isArray(row) && row.length === 4) directoryOptions.push([`dir:${row[2]}`, row[1]]);
        });
        controls.defaultDirectory = addField(grid, '默认目录', createSelect(directoryOptions, active.defaultDirectory));
        controls.initialTreeState = addField(grid, '目录初始状态', createSelect([
            ['expanded', '全部展开'], ['collapsed', '全部收起'], ['current-path', '仅展开当前路径']
        ], active.initialTreeState));
        controls.navigationMode = addField(grid, '导航方式', createSelect([
            ['sidebar', '桌面侧边栏'], ['content-first', '正文优先（目录按需打开）']
        ], active.navigationMode));
        controls.capabilityLevel = addField(grid, '产物等级', createSelect([
            ['compact', '精简阅读'], ['standard', '标准互动'], ['full', '完整互动']
        ], active.capabilityLevel), '精简模式关闭搜索与调试；完整模式可显式开启调试');
        controls.mediaPolicy = addField(grid, '媒体策略', createSelect([
            ['balanced', '平衡（大视频手动）'], ['manual', '视频全部手动加载'], ['blocked', '不在阅读页加载视频']
        ], active.mediaPolicy));
        controls.deploymentMode = addField(grid, '部署方式', createSelect([
            ['single-html', '单 HTML（默认）'], ['static-folder', '静态托管目录'], ['pwa-folder', '可安装离线站点（PWA）']
        ], active.deploymentMode), '目录模式需浏览器支持目录写入；PWA 只在 HTTP/HTTPS 部署后注册缓存');
        controls.searchEnabled = createInput('checkbox', active.searchEnabled);
        const searchWrap = document.createElement('div');
        searchWrap.className = 'publication-check';
        searchWrap.append(controls.searchEnabled, document.createTextNode('开启本地搜索'));
        addField(grid, '搜索', searchWrap);
        controls.debugEnabled = createInput('checkbox', active.debugEnabled);
        const debugWrap = document.createElement('div');
        debugWrap.className = 'publication-check';
        debugWrap.append(controls.debugEnabled, document.createTextNode('显示方法调试入口'));
        addField(grid, '调试', debugWrap, '只建议在完整互动产物中开启');
        wrapper.appendChild(grid);

        const presetRow = document.createElement('div');
        presetRow.className = 'publication-preset';
        const presetName = createInput('text', '');
        presetName.placeholder = '预设名称';
        presetName.maxLength = 40;
        const presetSelect = createSelect([['', '选择预设']], '');
        const refreshPresets = () => {
            const selected = presetSelect.value;
            presetSelect.innerHTML = '<option value="">选择预设</option>';
            Object.keys(state.presets).sort((a, b) => a.localeCompare(b)).forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                presetSelect.appendChild(option);
            });
            if (state.presets[selected]) presetSelect.value = selected;
        };
        const savePreset = document.createElement('button');
        savePreset.type = 'button';
        savePreset.textContent = '保存预设';
        const loadPreset = document.createElement('button');
        loadPreset.type = 'button';
        loadPreset.textContent = '加载预设';
        presetRow.append(presetName, presetSelect, savePreset, loadPreset);
        wrapper.appendChild(presetRow);

        const status = document.createElement('div');
        status.className = 'publication-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        const updateEstimate = () => {
            const settings = readForm(controls);
            const rows = typeof mulufile !== 'undefined' && Array.isArray(mulufile) ? mulufile : [];
            const textBytes = rows.reduce((sum, row) => sum + (Array.isArray(row) ? String(row[3] || '').length * 2 : 0), 0);
            const methodCount = rows.reduce((sum, row) => sum + (Array.isArray(row) ? (String(row[3] || '').match(/data-sora-methods=/g) || []).length : 0), 0);
            const levelText = settings.capabilityLevel === 'compact' ? '精简：无搜索/调试' : settings.capabilityLevel === 'full' ? '完整：允许诊断' : '标准：搜索可用、无调试';
            status.textContent = `正文约 ${(textBytes / 1024).toFixed(1)} KB · ${methodCount} 个方法入口 · ${levelText} · ${settings.deploymentMode === 'single-html' ? '单文件离线' : settings.deploymentMode === 'pwa-folder' ? 'PWA 目录' : '静态目录'}`;
        };
        updateEstimate();
        wrapper.appendChild(status);
        Object.values(controls).forEach(control => control.addEventListener(control.type === 'checkbox' || control.tagName === 'SELECT' ? 'change' : 'input', updateEstimate));

        presetSelect.addEventListener('change', () => {
            status.textContent = presetSelect.value
                ? describeDifferences(readForm(controls), state.presets[presetSelect.value])
                : `已保存 ${Object.keys(state.presets).length} 个预设`;
        });
        savePreset.addEventListener('click', () => {
            const name = normalizeText(presetName.value, 40);
            if (!name) {
                status.textContent = '请先输入预设名称';
                presetName.focus();
                return;
            }
            state.presets[name] = readForm(controls);
            persist();
            refreshPresets();
            presetSelect.value = name;
            status.textContent = `已保存预设“${name}”`;
        });
        loadPreset.addEventListener('click', () => {
            const value = state.presets[presetSelect.value];
            if (!value) {
                status.textContent = '请先选择预设';
                return;
            }
            fillForm(controls, value);
            status.textContent = `已加载“${presetSelect.value}”，点击“应用并保存”后生效`;
        });

        const actions = document.createElement('div');
        actions.className = 'publication-actions';
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = '恢复默认';
        reset.addEventListener('click', () => {
            fillForm(controls, DEFAULTS);
            status.textContent = '已填入默认设置，尚未保存';
        });
        const rollback = document.createElement('button');
        rollback.type = 'button';
        rollback.textContent = '回退上次';
        rollback.disabled = state.history.length === 0;
        rollback.addEventListener('click', () => {
            if (!state.history.length) return;
            const previous = state.history.shift();
            state.history.unshift(sanitize(state.active));
            state.active = sanitize(previous);
            persist();
            fillForm(controls, state.active);
            status.textContent = '已回退到上一个已保存版本';
        });
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = '复制配置';
        copy.addEventListener('click', async () => {
            const text = JSON.stringify(readForm(controls), null, 2);
            try {
                await navigator.clipboard.writeText(text);
                status.textContent = '已复制当前配置 JSON';
            } catch (_) {
                controls.description.focus();
                status.textContent = '当前环境不允许写入剪贴板';
            }
        });
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'primary';
        apply.textContent = '应用并保存';
        apply.addEventListener('click', () => {
            const next = readForm(controls);
            if (next.capabilityLevel === 'compact') {
                next.searchEnabled = false;
                next.debugEnabled = false;
            } else if (next.capabilityLevel !== 'full') {
                next.debugEnabled = false;
            }
            commit(next);
            if (typeof showToast === 'function') showToast('发布设置已保存', 'success', 2200);
            FeatureDialog.close();
        });
        actions.append(reset, rollback, copy, apply);
        wrapper.appendChild(actions);
        refreshPresets();
        FeatureDialog.open('发布设置', wrapper);
    }

    document.getElementById('publicationSettingsBtn')?.addEventListener('click', open);
    return { get, resolve, open, sanitize };
})();

window.PublicationSettings = PublicationSettings;
