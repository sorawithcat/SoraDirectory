(function() {
    'use strict';

    const METHOD_REFERENCE_KEYS = new Set([
        'frontAnchor', 'backAnchor', 'contentFrontAnchor', 'contentBackAnchor',
        'destinationFrontAnchor', 'destinationBackAnchor',
        'replaceFromFrontAnchor', 'replaceFromBackAnchor'
    ]);

    function getRows(data) {
        const source = Array.isArray(data)
            ? data
            : (typeof mulufile !== 'undefined' && Array.isArray(mulufile) ? mulufile : []);
        return source.filter(row => Array.isArray(row) && row.length === 4);
    }

    function createEmptyListMap(rows) {
        return new Map(rows.map(row => [String(row[2]), []]));
    }

    function resolveReference(value, pickerIndex, sourceDirId) {
        const picker = window.SoraReferencePicker;
        if (!picker || typeof picker.resolve !== 'function') return null;
        const result = picker.resolve(value, pickerIndex, sourceDirId);
        return result && result.exists && result.directory ? result : null;
    }

    function addEdge(graph, sourceDirId, value, kind, label) {
        const resolved = resolveReference(value, graph.pickerIndex, sourceDirId);
        if (!resolved) {
            graph.missing.push({ sourceDirId, value: String(value || ''), kind, label });
            return;
        }
        const targetDirId = String(resolved.directory.id);
        const edge = {
            sourceDirId: String(sourceDirId),
            targetDirId,
            anchorId: resolved.anchor ? resolved.anchor.id : '',
            kind,
            label,
            value: String(value || '')
        };
        if (!graph.outgoing.has(edge.sourceDirId)) graph.outgoing.set(edge.sourceDirId, []);
        if (!graph.incoming.has(targetDirId)) graph.incoming.set(targetDirId, []);
        graph.outgoing.get(edge.sourceDirId).push(edge);
        graph.incoming.get(targetDirId).push(edge);
        graph.edges.push(edge);
    }

    function walkMethods(value, visitor, path = '方法') {
        if (Array.isArray(value)) {
            value.forEach((item, index) => walkMethods(item, visitor, `${path} ${index + 1}`));
            return;
        }
        if (!value || typeof value !== 'object') return;
        Object.keys(value).forEach(key => {
            if (METHOD_REFERENCE_KEYS.has(key) && typeof value[key] === 'string' && value[key].trim()) {
                visitor(value, key, `${path} / ${key}`);
            }
            if (Array.isArray(value[key]) || (value[key] && typeof value[key] === 'object')) {
                walkMethods(value[key], visitor, `${path} / ${key}`);
            }
        });
    }

    function readDirectoryLink(link, sourceDirId) {
        const href = String(link.getAttribute('href') || '').trim();
        const linkType = link.getAttribute('data-sora-link') || '';
        if (!/^sora-dir:/i.test(href) && linkType !== 'dir') return '';
        const anchor = link.getAttribute('data-anchor-id') || '';
        const dirId = link.getAttribute('data-dir-id') || '';
        const dirName = link.getAttribute('data-dir-name') || '';
        if (dirId) return `dir:${dirId}${anchor ? `#${anchor}` : ''}`;
        if (dirName) return `name:${dirName}${anchor ? `#${anchor}` : ''}`;
        if (/^sora-dir:/i.test(href)) return `dir:${href.slice('sora-dir:'.length)}`;
        return `dir:${sourceDirId}${anchor ? `#${anchor}` : ''}`;
    }

    function findCycles(graph) {
        const components = [];
        const stack = [];
        const onStack = new Set();
        const indexes = new Map();
        const lowLinks = new Map();
        let nextIndex = 0;
        function visit(dirId) {
            indexes.set(dirId, nextIndex);
            lowLinks.set(dirId, nextIndex);
            nextIndex++;
            stack.push(dirId);
            onStack.add(dirId);
            const targets = new Set((graph.outgoing.get(dirId) || []).map(edge => edge.targetDirId));
            targets.forEach(targetId => {
                if (!indexes.has(targetId)) {
                    visit(targetId);
                    lowLinks.set(dirId, Math.min(lowLinks.get(dirId), lowLinks.get(targetId)));
                } else if (onStack.has(targetId)) {
                    lowLinks.set(dirId, Math.min(lowLinks.get(dirId), indexes.get(targetId)));
                }
            });
            if (lowLinks.get(dirId) !== indexes.get(dirId)) return;
            const component = [];
            let current;
            do {
                current = stack.pop();
                onStack.delete(current);
                component.push(current);
            } while (current !== dirId);
            const selfLoop = component.length === 1 && targets.has(dirId);
            if (component.length > 1 || selfLoop) components.push(component);
        }
        graph.rows.forEach(row => {
            const dirId = String(row[2]);
            if (!indexes.has(dirId)) visit(dirId);
        });
        return components;
    }

    function build(data) {
        const rows = getRows(data);
        const picker = window.SoraReferencePicker;
        const graph = {
            rows,
            rowsById: new Map(rows.map(row => [String(row[2]), row])),
            pickerIndex: picker && typeof picker.buildIndex === 'function' ? picker.buildIndex(rows) : null,
            incoming: createEmptyListMap(rows),
            outgoing: createEmptyListMap(rows),
            edges: [],
            missing: [],
            cycles: []
        };
        rows.forEach(row => {
            const sourceDirId = String(row[2]);
            const template = document.createElement('template');
            template.innerHTML = String(row[3] || '');
            template.content.querySelectorAll('a[href], a[data-sora-link="dir"]').forEach(link => {
                const value = readDirectoryLink(link, sourceDirId);
                if (value) addEdge(graph, sourceDirId, value, 'link', '目录链接');
            });
            template.content.querySelectorAll('[data-sora-block-ref]').forEach(block => {
                const targetId = block.getAttribute('data-sora-block-ref') || '';
                if (targetId) addEdge(graph, sourceDirId, `dir:${targetId}`, 'block', '可复用内容块');
            });
            template.content.querySelectorAll('a[data-sora-link="method"][data-sora-methods]').forEach((link, linkIndex) => {
                let methods;
                try {
                    methods = JSON.parse(link.getAttribute('data-sora-methods') || '[]');
                } catch (_) {
                    graph.missing.push({ sourceDirId, value: '', kind: 'method', label: `方法 ${linkIndex + 1} 无法解析` });
                    return;
                }
                walkMethods(methods, (owner, key, path) => {
                    addEdge(graph, sourceDirId, owner[key], 'method', `方法 ${linkIndex + 1} / ${path}`);
                });
            });
        });
        graph.cycles = findCycles(graph);
        return graph;
    }

    function canonicalReference(resolved) {
        return `dir:${resolved.directory.id}${resolved.anchor ? `#${resolved.anchor.id}` : ''}`;
    }

    function rewriteDirectoryReferences(targetDirId, newName, data) {
        const rows = getRows(data);
        const picker = window.SoraReferencePicker;
        if (!picker || typeof picker.buildIndex !== 'function') return { changed: 0, changedDirIds: [] };
        const pickerIndex = picker.buildIndex(rows);
        let changed = 0;
        const changedDirIds = new Set();
        rows.forEach(row => {
            const sourceDirId = String(row[2]);
            const template = document.createElement('template');
            template.innerHTML = String(row[3] || '');
            let rowChanged = false;
            template.content.querySelectorAll('a[href], a[data-sora-link="dir"]').forEach(link => {
                const value = readDirectoryLink(link, sourceDirId);
                const resolved = value ? resolveReference(value, pickerIndex, sourceDirId) : null;
                if (!resolved || String(resolved.directory.id) !== String(targetDirId)) return;
                const anchorId = resolved.anchor ? resolved.anchor.id : '';
                link.setAttribute('href', `sora-dir:${targetDirId}${anchorId ? `#${anchorId}` : ''}`);
                link.setAttribute('data-sora-link', 'dir');
                link.setAttribute('data-dir-id', String(targetDirId));
                link.setAttribute('data-dir-name', String(newName || resolved.directory.name || ''));
                if (anchorId) link.setAttribute('data-anchor-id', anchorId);
                else link.removeAttribute('data-anchor-id');
                rowChanged = true;
                changed++;
            });
            template.content.querySelectorAll('a[data-sora-link="method"][data-sora-methods]').forEach(link => {
                let methods;
                try {
                    methods = JSON.parse(link.getAttribute('data-sora-methods') || '[]');
                } catch (_) {
                    return;
                }
                let methodChanged = false;
                walkMethods(methods, (owner, key) => {
                    const resolved = resolveReference(owner[key], pickerIndex, sourceDirId);
                    if (!resolved || String(resolved.directory.id) !== String(targetDirId)) return;
                    const next = canonicalReference(resolved);
                    if (owner[key] === next) return;
                    owner[key] = next;
                    methodChanged = true;
                    changed++;
                });
                if (methodChanged) {
                    link.setAttribute('data-sora-methods', JSON.stringify(methods));
                    rowChanged = true;
                }
            });
            if (rowChanged) {
                row[3] = template.innerHTML;
                changedDirIds.add(sourceDirId);
            }
        });
        return { changed, changedDirIds: Array.from(changedDirIds) };
    }

    function getSubtreeIds(targetDirId, rows) {
        const result = new Set([String(targetDirId)]);
        let added = true;
        while (added) {
            added = false;
            rows.forEach(row => {
                if (result.has(String(row[0])) && !result.has(String(row[2]))) {
                    result.add(String(row[2]));
                    added = true;
                }
            });
        }
        return result;
    }

    function getDeleteImpact(targetDirId, data) {
        const graph = build(data);
        const removedIds = getSubtreeIds(targetDirId, graph.rows);
        const incoming = [];
        removedIds.forEach(id => {
            (graph.incoming.get(id) || []).forEach(edge => {
                if (!removedIds.has(edge.sourceDirId)) incoming.push(edge);
            });
        });
        return { removedIds, incoming, graph };
    }

    function directoryName(graph, dirId) {
        const row = graph.rowsById.get(String(dirId));
        return row ? String(row[1] || row[2]) : String(dirId);
    }

    function createRelationButton(graph, edge, direction) {
        const targetId = direction === 'incoming' ? edge.sourceDirId : edge.targetDirId;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reference-graph-edge';
        button.textContent = `${directoryName(graph, targetId)} · ${edge.kind === 'method' ? '方法' : '链接'}${edge.anchorId ? ` #${edge.anchorId}` : ''}`;
        button.addEventListener('click', () => {
            if (window.DirectoryNavigation) window.DirectoryNavigation.open(targetId);
            if (window.FeatureDialog) window.FeatureDialog.close();
        });
        return button;
    }

    function ensureStyle() {
        if (document.getElementById('referenceGraphStyle')) return;
        const style = document.createElement('style');
        style.id = 'referenceGraphStyle';
        style.textContent = `
            .reference-graph { display:grid; gap:12px; }
            .reference-graph-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
            .reference-graph-toolbar select { min-height:38px; min-width:min(320px,100%); padding:7px 9px; border:1px solid #94a3b8; border-radius:6px; background:#fff; }
            .reference-graph-summary { display:flex; flex-wrap:wrap; gap:8px; }
            .reference-graph-summary span { padding:5px 8px; border-radius:999px; background:#f1f5f9; color:#475569; font-size:12px; }
            .reference-graph-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
            .reference-graph-section { border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
            .reference-graph-section h3 { margin:0; padding:9px 11px; background:#f8fafc; font-size:14px; }
            .reference-graph-list { display:grid; gap:4px; padding:8px; }
            .reference-graph-edge { width:100%; min-height:36px; padding:7px 9px; border:1px solid #dbe3ee; border-radius:6px; background:#fff; color:#1e293b; text-align:left; cursor:pointer; }
            .reference-graph-empty { padding:12px; color:#64748b; }
            @media (max-width:700px) { .reference-graph-columns { grid-template-columns:1fr; } }
        `;
        document.head.appendChild(style);
    }

    function open(initialDirId) {
        if (!window.FeatureDialog) return;
        ensureStyle();
        const graph = build();
        const wrapper = document.createElement('div');
        wrapper.className = 'reference-graph';
        const toolbar = document.createElement('div');
        toolbar.className = 'reference-graph-toolbar';
        const select = document.createElement('select');
        select.setAttribute('aria-label', '查看目录关系');
        graph.rows.forEach(row => {
            const option = document.createElement('option');
            option.value = row[2];
            option.textContent = row[1] || row[2];
            select.appendChild(option);
        });
        const current = initialDirId || (typeof currentMuluName !== 'undefined' && currentMuluName
            ? document.getElementById(currentMuluName)?.getAttribute('data-dir-id')
            : '');
        if (graph.rowsById.has(String(current || ''))) select.value = String(current);
        toolbar.appendChild(select);
        wrapper.appendChild(toolbar);
        const summary = document.createElement('div');
        summary.className = 'reference-graph-summary';
        const columns = document.createElement('div');
        columns.className = 'reference-graph-columns';
        wrapper.append(summary, columns);

        function render() {
            const dirId = select.value;
            const incoming = graph.incoming.get(dirId) || [];
            const outgoing = graph.outgoing.get(dirId) || [];
            const orphans = graph.rows.filter(row => (graph.incoming.get(String(row[2])) || []).length === 0);
            summary.innerHTML = '';
            [['入链', incoming.length], ['出链', outgoing.length], ['孤立目录', orphans.length], ['循环路径', graph.cycles.length], ['缺失目标', graph.missing.length]].forEach(([label, count]) => {
                const item = document.createElement('span');
                item.textContent = `${label} ${count}`;
                summary.appendChild(item);
            });
            columns.innerHTML = '';
            [['哪些目录链接到这里', incoming, 'incoming'], ['这个目录链接到哪里', outgoing, 'outgoing']].forEach(([title, edges, direction]) => {
                const section = document.createElement('section');
                section.className = 'reference-graph-section';
                const heading = document.createElement('h3');
                heading.textContent = `${title}（${edges.length}）`;
                const list = document.createElement('div');
                list.className = 'reference-graph-list';
                if (edges.length) edges.forEach(edge => list.appendChild(createRelationButton(graph, edge, direction)));
                else {
                    const empty = document.createElement('div');
                    empty.className = 'reference-graph-empty';
                    empty.textContent = '暂无关系';
                    list.appendChild(empty);
                }
                section.append(heading, list);
                columns.appendChild(section);
            });
        }
        select.addEventListener('change', render);
        render();
        FeatureDialog.open('目录关系', wrapper);
    }

    document.getElementById('referenceGraphBtn')?.addEventListener('click', () => open());
    window.SoraReferenceGraph = { build, open, rewriteDirectoryReferences, getDeleteImpact };
})();
