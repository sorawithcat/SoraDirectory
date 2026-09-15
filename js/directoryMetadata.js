(function() {
    'use strict';

    const STATUSES = new Set(['', 'todo', 'doing', 'done', 'blocked']);
    const PRIORITIES = new Set(['', 'low', 'medium', 'high', 'urgent']);
    let records = Object.create(null);

    function normalizeText(value, maxLength) {
        return String(value || '').trim().slice(0, maxLength);
    }

    function normalizeRecord(value) {
        const source = value && typeof value === 'object' ? value : {};
        const custom = {};
        if (source.custom && typeof source.custom === 'object' && !Array.isArray(source.custom)) {
            Object.entries(source.custom).slice(0, 30).forEach(([key, itemValue]) => {
                const safeKey = normalizeText(key, 40);
                if (safeKey) custom[safeKey] = normalizeText(itemValue, 300);
            });
        }
        return {
            tags: Array.from(new Set((Array.isArray(source.tags) ? source.tags : String(source.tags || '').split(','))
                .map(tag => normalizeText(tag, 30))
                .filter(Boolean))).slice(0, 20),
            status: STATUSES.has(source.status) ? source.status : '',
            date: /^\d{4}-\d{2}-\d{2}$/.test(String(source.date || '')) ? String(source.date) : '',
            priority: PRIORITIES.has(source.priority) ? source.priority : '',
            custom
        };
    }

    function isEmpty(record) {
        const item = normalizeRecord(record);
        return !item.tags.length && !item.status && !item.date && !item.priority && Object.keys(item.custom).length === 0;
    }

    function get(dirId) {
        return normalizeRecord(records[String(dirId || '')]);
    }

    function set(dirId, value, options = {}) {
        const id = String(dirId || '');
        if (!id) return false;
        const record = normalizeRecord(value);
        if (isEmpty(record)) delete records[id];
        else records[id] = record;
        if (options.markUnsaved !== false && typeof markUnsavedChanges === 'function') markUnsavedChanges();
        return true;
    }

    function remove(dirId, options = {}) {
        const id = String(dirId || '');
        if (!Object.prototype.hasOwnProperty.call(records, id)) return false;
        delete records[id];
        if (options.markUnsaved !== false && typeof markUnsavedChanges === 'function') markUnsavedChanges();
        return true;
    }

    function reset(options = {}) {
        records = Object.create(null);
        if (options.markUnsaved && typeof markUnsavedChanges === 'function') markUnsavedChanges();
    }

    function serialize(allowedIds) {
        const result = {};
        const allowed = allowedIds instanceof Set ? allowedIds : null;
        Object.entries(records).forEach(([dirId, value]) => {
            if (allowed && !allowed.has(dirId)) return;
            const record = normalizeRecord(value);
            if (!isEmpty(record)) result[dirId] = record;
        });
        return result;
    }

    function load(value, options = {}) {
        const incoming = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        if (!options.merge) records = Object.create(null);
        const validIds = new Set((typeof mulufile !== 'undefined' && Array.isArray(mulufile) ? mulufile : [])
            .filter(row => Array.isArray(row) && row.length === 4)
            .map(row => String(row[2])));
        Object.entries(incoming).forEach(([dirId, record]) => {
            if (validIds.size && !validIds.has(String(dirId))) return;
            const normalized = normalizeRecord(record);
            if (!isEmpty(normalized)) records[String(dirId)] = normalized;
        });
    }

    function parseCustom(text) {
        const custom = {};
        String(text || '').split(/\r?\n/).forEach(line => {
            const separator = line.indexOf('=');
            if (separator < 1) return;
            const key = normalizeText(line.slice(0, separator), 40);
            if (key) custom[key] = normalizeText(line.slice(separator + 1), 300);
        });
        return custom;
    }

    function stringifyCustom(custom) {
        return Object.entries(custom || {}).map(([key, value]) => `${key}=${value}`).join('\n');
    }

    function currentDirectoryId() {
        if (typeof currentMuluName === 'undefined' || !currentMuluName) return '';
        const element = document.getElementById(currentMuluName);
        return element ? String(element.getAttribute('data-dir-id') || '') : '';
    }

    function directoryRows() {
        return typeof mulufile !== 'undefined' && Array.isArray(mulufile)
            ? mulufile.filter(row => Array.isArray(row) && row.length === 4)
            : [];
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

    function addField(parent, labelText, control, helpText) {
        const label = document.createElement('label');
        label.className = 'directory-metadata-field';
        const caption = document.createElement('span');
        caption.textContent = labelText;
        label.append(caption, control);
        if (helpText) {
            const help = document.createElement('small');
            help.textContent = helpText;
            label.appendChild(help);
        }
        parent.appendChild(label);
        return control;
    }

    function ensureStyle() {
        if (document.getElementById('directoryMetadataStyle')) return;
        const style = document.createElement('style');
        style.id = 'directoryMetadataStyle';
        style.textContent = `
            .directory-metadata { display:grid; gap:14px; }
            .directory-metadata-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
            .directory-metadata-field { display:grid; gap:5px; font-size:13px; color:#334155; }
            .directory-metadata-field > span { font-weight:700; }
            .directory-metadata-field input, .directory-metadata-field select, .directory-metadata-field textarea { width:100%; min-height:38px; padding:7px 9px; border:1px solid #94a3b8; border-radius:6px; background:#fff; color:#0f172a; font:inherit; }
            .directory-metadata-field textarea { min-height:92px; resize:vertical; }
            .directory-metadata-field small { color:#64748b; line-height:1.45; }
            .directory-metadata-actions { display:flex; justify-content:flex-end; gap:8px; padding-top:12px; border-top:1px solid #e2e8f0; }
            .directory-metadata-actions button { min-height:38px; padding:7px 12px; border:1px solid #94a3b8; border-radius:6px; background:#fff; cursor:pointer; }
            .directory-metadata-actions .primary { border-color:#2563eb; background:#2563eb; color:#fff; }
            .smart-collection-toolbar { display:grid; grid-template-columns:repeat(4,minmax(120px,1fr)); gap:8px; }
            .smart-collection-toolbar input, .smart-collection-toolbar select { min-height:38px; padding:7px 9px; border:1px solid #94a3b8; border-radius:6px; }
            .smart-collection-results { display:grid; gap:6px; }
            .smart-collection-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; width:100%; padding:9px 10px; border:1px solid #dbe3ee; border-radius:7px; background:#fff; color:#1e293b; text-align:left; cursor:pointer; }
            .smart-collection-item small { color:#64748b; }
            @media (max-width:700px) { .directory-metadata-grid, .smart-collection-toolbar { grid-template-columns:1fr; } }
        `;
        document.head.appendChild(style);
    }

    function openEditor(dirId) {
        const id = dirId || currentDirectoryId();
        const row = directoryRows().find(item => String(item[2]) === String(id));
        if (!row || !window.FeatureDialog) {
            if (typeof showToast === 'function') showToast('请先选择目录', 'warning', 2000);
            return;
        }
        ensureStyle();
        const value = get(id);
        const wrapper = document.createElement('div');
        wrapper.className = 'directory-metadata';
        const grid = document.createElement('div');
        grid.className = 'directory-metadata-grid';
        const tags = document.createElement('input');
        tags.type = 'text';
        tags.value = value.tags.join('，');
        addField(grid, '标签', tags, '用逗号分隔，最多 20 个');
        const status = addField(grid, '状态', createSelect([
            ['', '未设置'], ['todo', '待处理'], ['doing', '进行中'], ['done', '已完成'], ['blocked', '已阻塞']
        ], value.status));
        const priority = addField(grid, '优先级', createSelect([
            ['', '未设置'], ['low', '低'], ['medium', '中'], ['high', '高'], ['urgent', '紧急']
        ], value.priority));
        const date = document.createElement('input');
        date.type = 'date';
        date.value = value.date;
        addField(grid, '日期', date);
        const custom = document.createElement('textarea');
        custom.value = stringifyCustom(value.custom);
        addField(grid, '自定义字段', custom, '每行 key=value，不会写入正文');
        wrapper.appendChild(grid);
        const actions = document.createElement('div');
        actions.className = 'directory-metadata-actions';
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.textContent = '清空字段';
        clear.addEventListener('click', () => {
            tags.value = '';
            status.value = '';
            priority.value = '';
            date.value = '';
            custom.value = '';
        });
        const collections = document.createElement('button');
        collections.type = 'button';
        collections.textContent = '查看智能集合';
        collections.addEventListener('click', openCollections);
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'primary';
        save.textContent = '保存字段';
        save.addEventListener('click', () => {
            set(id, {
                tags: tags.value.split(/[,，]/),
                status: status.value,
                priority: priority.value,
                date: date.value,
                custom: parseCustom(custom.value)
            });
            if (typeof showToast === 'function') showToast(`已保存“${row[1] || row[2]}”的目录字段`, 'success', 2200);
            FeatureDialog.close();
        });
        actions.append(clear, collections, save);
        wrapper.appendChild(actions);
        FeatureDialog.open(`目录字段 · ${row[1] || row[2]}`, wrapper);
    }

    function openCollections() {
        if (!window.FeatureDialog) return;
        ensureStyle();
        const wrapper = document.createElement('div');
        wrapper.className = 'directory-metadata';
        const toolbar = document.createElement('div');
        toolbar.className = 'smart-collection-toolbar';
        const query = document.createElement('input');
        query.type = 'search';
        query.placeholder = '搜索目录、标签或字段';
        const status = createSelect([['', '全部状态'], ['todo', '待处理'], ['doing', '进行中'], ['done', '已完成'], ['blocked', '已阻塞']], '');
        const priority = createSelect([['', '全部优先级'], ['low', '低'], ['medium', '中'], ['high', '高'], ['urgent', '紧急']], '');
        const dateMode = createSelect([['', '全部日期'], ['overdue', '已过期'], ['today', '今天'], ['future', '今后']], '');
        toolbar.append(query, status, priority, dateMode);
        const summary = document.createElement('div');
        summary.className = 'publication-status';
        summary.setAttribute('role', 'status');
        const results = document.createElement('div');
        results.className = 'smart-collection-results';
        wrapper.append(toolbar, summary, results);
        function render() {
            const keyword = query.value.trim().toLocaleLowerCase();
            const today = new Date().toISOString().slice(0, 10);
            const matches = directoryRows().filter(row => {
                const record = get(row[2]);
                const haystack = `${row[1]} ${record.tags.join(' ')} ${Object.entries(record.custom).flat().join(' ')}`.toLocaleLowerCase();
                const dateMatches = !dateMode.value || (dateMode.value === 'overdue' && record.date && record.date < today) ||
                    (dateMode.value === 'today' && record.date === today) || (dateMode.value === 'future' && record.date > today);
                return (!keyword || haystack.includes(keyword)) && (!status.value || record.status === status.value) &&
                    (!priority.value || record.priority === priority.value) && dateMatches;
            });
            summary.textContent = `符合 ${matches.length} 个目录；此视图不会改动或删除正文`;
            results.innerHTML = '';
            matches.forEach(row => {
                const record = get(row[2]);
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'smart-collection-item';
                const name = document.createElement('strong');
                name.textContent = row[1] || row[2];
                const meta = document.createElement('small');
                meta.textContent = [record.status, record.priority, record.date, record.tags.join('、')].filter(Boolean).join(' · ') || '未设置字段';
                button.append(name, meta);
                button.addEventListener('click', () => {
                    if (window.DirectoryNavigation) window.DirectoryNavigation.open(row[2]);
                    FeatureDialog.close();
                });
                results.appendChild(button);
            });
        }
        [query, status, priority, dateMode].forEach(control => control.addEventListener(control === query ? 'input' : 'change', render));
        render();
        FeatureDialog.open('智能集合', wrapper);
    }

    document.getElementById('directoryMetadataBtn')?.addEventListener('click', () => openEditor());
    window.DirectoryMetadata = { get, set, remove, reset, serialize, load, openEditor, openCollections };
})();
