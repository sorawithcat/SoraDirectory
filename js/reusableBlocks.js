(function() {
    'use strict';

    function rows(data) {
        const source = Array.isArray(data) ? data : (typeof mulufile !== 'undefined' && Array.isArray(mulufile) ? mulufile : []);
        return source.filter(row => Array.isArray(row) && row.length === 4);
    }

    function getEditorRoot() {
        return document.querySelector('.markdown-preview');
    }

    function rowMap(data) {
        return new Map(rows(data).map(row => [String(row[2]), row]));
    }

    function expandElement(element, sourceRows, stack, occurrence, editorMode) {
        const sourceId = String(element.getAttribute('data-sora-block-ref') || '');
        const source = sourceRows.get(sourceId);
        element.setAttribute('contenteditable', 'false');
        element.classList.add('sora-block-reference');
        if (!source) {
            element.innerHTML = '<p role="status">引用块的源目录已不存在。</p>';
            element.setAttribute('data-sora-block-state', 'missing');
            return;
        }
        if (stack.has(sourceId)) {
            element.innerHTML = '<p role="status">引用块存在循环，已停止展开。</p>';
            element.setAttribute('data-sora-block-state', 'cycle');
            return;
        }
        const nextStack = new Set(stack);
        nextStack.add(sourceId);
        const template = document.createElement('template');
        template.innerHTML = String(source[3] || '');
        template.content.querySelectorAll('[data-sora-block-ref]').forEach((child, index) => expandElement(child, sourceRows, nextStack, `${occurrence}_${index}`, editorMode));
        const prefix = `sora-block-${sourceId.replace(/[^a-zA-Z0-9_-]/g, '')}-${occurrence}-`;
        const idMap = new Map();
        template.content.querySelectorAll('[id]').forEach(node => {
            const oldId = node.id;
            const nextId = prefix + oldId;
            idMap.set(oldId, nextId);
            node.id = nextId;
        });
        template.content.querySelectorAll('a[href^="#"]').forEach(link => {
            const target = link.getAttribute('href').slice(1);
            if (idMap.has(target)) link.setAttribute('href', `#${idMap.get(target)}`);
        });
        const holder = document.createElement('div');
        holder.className = 'sora-block-reference-content';
        holder.appendChild(template.content);
        element.innerHTML = '';
        if (editorMode) {
            const header = document.createElement('div');
            header.className = 'sora-block-reference-header';
            header.setAttribute('data-sora-runtime-only', 'true');
            header.append(document.createTextNode(`引用块 · ${source[1] || sourceId} `));
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = '编辑源块';
            button.setAttribute('data-edit-sora-block', sourceId);
            header.appendChild(button);
            element.appendChild(header);
        }
        element.appendChild(holder);
        element.setAttribute('data-sora-block-state', 'ready');
    }

    function expandTemplate(root, data) {
        if (!root || !root.querySelectorAll) return root;
        const sourceRows = rowMap(data);
        root.querySelectorAll('[data-sora-block-ref]').forEach((element, index) => expandElement(element, sourceRows, new Set(), String(index + 1), false));
        root.querySelectorAll('[data-sora-runtime-only]').forEach(element => element.remove());
        root.querySelectorAll('[data-sora-block-state]').forEach(element => element.removeAttribute('data-sora-block-state'));
        return root;
    }

    function renderEditor(root = getEditorRoot()) {
        if (!root || !root.querySelectorAll) return;
        const sourceRows = rowMap();
        root.querySelectorAll('[data-sora-block-ref]').forEach((element, index) => expandElement(element, sourceRows, new Set(), String(index + 1), true));
    }

    function cleanForStorage(root) {
        if (!root || !root.querySelectorAll) return root;
        root.querySelectorAll('[data-sora-block-ref]').forEach(element => {
            const sourceId = element.getAttribute('data-sora-block-ref');
            element.innerHTML = '';
            element.className = 'sora-block-reference';
            element.removeAttribute('contenteditable');
            element.removeAttribute('data-sora-block-state');
            element.setAttribute('data-sora-block-ref', sourceId);
        });
        return root;
    }

    function dependencies(data) {
        const graph = new Map(rows(data).map(row => [String(row[2]), new Set()]));
        rows(data).forEach(row => {
            const template = document.createElement('template');
            template.innerHTML = String(row[3] || '');
            template.content.querySelectorAll('[data-sora-block-ref]').forEach(element => graph.get(String(row[2])).add(String(element.getAttribute('data-sora-block-ref') || '')));
        });
        return graph;
    }

    function wouldCreateCycle(currentId, sourceId) {
        if (currentId === sourceId) return true;
        const graph = dependencies();
        const stack = [sourceId];
        const seen = new Set();
        while (stack.length) {
            const id = stack.pop();
            if (id === currentId) return true;
            if (seen.has(id)) continue;
            seen.add(id);
            (graph.get(id) || []).forEach(next => stack.push(next));
        }
        return false;
    }

    function insertReference(sourceId) {
        const currentId = window.DirectoryNavigation?.getCurrentDirId();
        const editorRoot = getEditorRoot();
        const source = rowMap().get(String(sourceId || ''));
        if (!currentId || !editorRoot) {
            showToast('未找到当前编辑区，请重新选择目录后再试', 'warning', 2400);
            return false;
        }
        if (!source || String(source[2]) === String(currentId)) {
            showToast('请选择仍然存在的其他目录作为引用源', 'warning', 2400);
            return false;
        }
        if (wouldCreateCycle(currentId, sourceId)) {
            showToast('该引用会形成循环，已阻止插入', 'warning', 2400);
            return false;
        }
        const wrapper = document.createElement('section');
        wrapper.className = 'sora-block-reference';
        wrapper.setAttribute('data-sora-block-ref', sourceId);
        const selection = window.getSelection();
        let range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        const container = range && (range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer);
        if (!container || !editorRoot.contains(container)) {
            range = document.createRange();
            range.selectNodeContents(editorRoot);
            range.collapse(false);
        }
        range.deleteContents();
        range.insertNode(wrapper);
        renderEditor(editorRoot);
        syncPreviewToTextarea();
        return true;
    }

    function open() {
        const currentId = window.DirectoryNavigation?.getCurrentDirId();
        if (!currentId) {
            showToast('请先选择要插入引用块的目录', 'warning', 2000);
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<p>引用块默认只读；源目录更新后会同步。编辑时使用块内“编辑源块”，导出时展开为静态内容。</p>';
        const select = document.createElement('select');
        select.className = 'form-control';
        select.setAttribute('aria-label', '引用源目录');
        const candidates = rows().filter(row => String(row[2]) !== currentId);
        const enabledCandidates = [];
        candidates.forEach(row => {
            const option = document.createElement('option');
            option.value = row[2];
            option.textContent = row[1] || row[2];
            option.disabled = wouldCreateCycle(currentId, String(row[2]));
            if (!option.disabled) enabledCandidates.push(row);
            select.appendChild(option);
        });
        if (enabledCandidates.length) select.value = String(enabledCandidates[0][2]);
        wrapper.appendChild(select);
        const error = document.createElement('p');
        error.className = 'method-field-error';
        error.dataset.blockError = '';
        error.setAttribute('role', 'alert');
        if (!candidates.length) error.textContent = '当前没有其他目录可供引用，请先新建或加载其他目录。';
        else if (!enabledCandidates.length) error.textContent = '其他目录都会形成循环引用，当前无法插入。';
        wrapper.appendChild(error);
        const actions = document.createElement('div');
        actions.className = 'method-workbench-actions';
        const insert = document.createElement('button');
        insert.type = 'button';
        insert.textContent = '插入引用块';
        insert.disabled = !enabledCandidates.length;
        select.addEventListener('change', () => { error.textContent = ''; });
        insert.addEventListener('click', () => {
            if (insertReference(select.value)) {
                FeatureDialog.close();
                showToast('已插入可复用内容块', 'success', 1800);
                return;
            }
            error.textContent = '未能插入引用块，请确认源目录仍存在且不会形成循环。';
        });
        actions.appendChild(insert);
        wrapper.appendChild(actions);
        FeatureDialog.open('可复用内容块', wrapper);
    }

    document.addEventListener('click', event => {
        const button = event.target.closest('[data-edit-sora-block]');
        if (!button) return;
        event.preventDefault();
        window.DirectoryNavigation?.open(button.getAttribute('data-edit-sora-block'));
    });

    window.SoraReusableBlocks = { expandTemplate, renderEditor, cleanForStorage, dependencies, wouldCreateCycle, insertReference, open };
    window.SoraFeatureCommands = window.SoraFeatureCommands || [];
    window.SoraFeatureCommands.push({ key: 'reusable-blocks', title: '插入可复用内容块', icon: '▧', meta: '引用其他目录片段并随源内容同步', keywords: '块引用 同步 源目录 复用', disabledReason: () => window.DirectoryNavigation?.getCurrentDirId() ? '' : '请先选择目录', run: open });
})();
