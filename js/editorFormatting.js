/* 正文编辑事务与格式命令；与目录结构撤销分开。 */
(function() {
    'use strict';
    const root = markdownPreview;
    if (!root) return;
    const histories = new Map();
    const HISTORY_LIMIT = 60;
    const HISTORY_BYTES = 8 * 1024 * 1024;
    let generation = 0;
    let savedRange = null;
    let inputBefore = null;
    let composing = false;
    let restoring = false;
    let executing = false;
    let transactionDepth = 0;
    let activeKey = '';
    const caretNodes = new Set();
    const blockSelector = 'p,div:not([class]),h1,h2,h3,h4,h5,h6,li,td,th,dt,dd,summary';
    const contentHostSelector = 'div,section,article,main,aside,details,blockquote,li,td,th,dd,figcaption';
    const inlineDefinitions = {
        bold: ['strong', 'b'], italic: ['em', 'i'], underline: ['u'], strikethrough: ['s', 'strike', 'del'],
        code: ['code'], highlight: ['mark'], spoiler: ['spoiler'], superscript: ['sup'], subscript: ['sub'], kbd: ['kbd']
    };
    const paragraphProperties = ['text-align', 'line-height', 'margin-top', 'margin-bottom'];
    const textProperties = ['color', 'background-color'];
    let brush = null;
    let stateSignature = '';
    let stateParts = null;

    function key() {
        const dir = currentMuluName && document.getElementById(currentMuluName)?.getAttribute('data-dir-id');
        return dir ? `${window.SoraDocumentIdentity?.get?.().id || 'document'}:${dir}` : '';
    }
    function inside(range) {
        return !!range && range.startContainer.isConnected && range.endContainer.isConnected &&
            root.contains(range.startContainer) && root.contains(range.endContainer);
    }
    function currentRange() {
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        return inside(range) ? range.cloneRange() : null;
    }
    function remember() {
        const range = currentRange();
        if (range && key()) savedRange = { range, key: key(), generation };
        return range;
    }
    function getRange() {
        const range = currentRange();
        if (range) return range;
        if (savedRange?.key === key() && savedRange.generation === generation && inside(savedRange.range)) return savedRange.range.cloneRange();
        return null;
    }
    function setRange(range, focus = true) {
        if (!inside(range)) return;
        if (focus) root.focus({ preventScroll: true });
        const selection = window.getSelection();
        selection.removeAllRanges(); selection.addRange(range);
        remember();
    }
    function element(node) { return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement; }
    function protectedNode(node) {
        return !!element(node)?.closest('[contenteditable="false"],.code-lang-label,.sora-anchor,[data-footnote-ref],[data-footnote-backlink]');
    }
    function textNodes(range, editableOnly = true) {
        const nodes = [];
        function visit(node) {
            if (!node.length || (editableOnly && protectedNode(node)) || !range.intersectsNode(node)) return;
            const start = node === range.startContainer ? range.startOffset : 0;
            const end = node === range.endContainer ? range.endOffset : node.length;
            if (end > start) nodes.push({ node, start, end });
        }
        if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) visit(range.commonAncestorContainer);
        else {
            const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) visit(walker.currentNode);
        }
        return nodes;
    }
    function stateNodes(range) {
        if (!stateParts || stateParts.start !== range.startContainer || stateParts.end !== range.endContainer || stateParts.startOffset !== range.startOffset || stateParts.endOffset !== range.endOffset) {
            stateParts = { start: range.startContainer, end: range.endContainer, startOffset: range.startOffset, endOffset: range.endOffset,
                nodes: range.collapsed ? [range.startContainer] : textNodes(range).map(part => part.node) };
        }
        return stateParts.nodes;
    }
    function pathTo(node) {
        const path = [];
        while (node && node !== root) {
            path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node));
            node = node.parentNode;
        }
        return path;
    }
    function point(path, offset) {
        let node = root;
        for (const index of path || []) { if (!node.childNodes[index]) return null; node = node.childNodes[index]; }
        return { node, offset: Math.min(offset, node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length) };
    }
    function bookmark(range = getRange()) {
        if (!inside(range)) return null;
        return { start: pathTo(range.startContainer), startOffset: range.startOffset, end: pathTo(range.endContainer), endOffset: range.endOffset };
    }
    function restoreBookmark(saved) {
        if (!saved) return;
        const start = point(saved.start, saved.startOffset), end = point(saved.end, saved.endOffset);
        if (!start || !end) return;
        const range = document.createRange();
        range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset);
        setRange(range);
    }
    function snapshot() {
        // 历史保留 DOM 形状以恢复精确选区；持久化仍由既有净化流程负责。
        const clone = root.cloneNode(true);
        const checkboxes = root.querySelectorAll('input[type="checkbox"]');
        clone.querySelectorAll('input[type="checkbox"]').forEach((node, index) => {
            node.toggleAttribute('checked', !!checkboxes[index]?.checked);
        });
        return { html: clone.innerHTML, selection: bookmark(), key: key() };
    }
    function sameContent(a, b) { return a?.html === b?.html || (!!a && !!b && contentStamp(a.html) === contentStamp(b.html)); }
    function contentStamp(html = root.innerHTML) {
        const clone = document.createElement('div'); clone.innerHTML = html;
        clone.querySelectorAll('[data-media-storage-id]').forEach(node => {
            if (node.matches('img,video,audio')) node.setAttribute('src', 'about:blank');
        });
        clone.querySelectorAll('.sora-issue-target').forEach(node => { node.classList.remove('sora-issue-target'); if (!node.className) node.removeAttribute('class'); });
        return normalizeEditorHtmlForStorage(clone.innerHTML);
    }
    function history() {
        const id = key();
        if (!histories.has(id)) histories.set(id, { undo: [], redo: [], last: null });
        return histories.get(id);
    }
    function commit(before, label) {
        if (!before?.key || before.key !== key() || restoring) return;
        const after = snapshot(), stack = history();
        if (!sameContent(before, after)) {
            stack.undo.push({ ...before, label }); stack.redo.length = 0;
            let bytes = stack.undo.reduce((sum, item) => sum + item.html.length * 2, 0);
            while (stack.undo.length > HISTORY_LIMIT || (bytes > HISTORY_BYTES && stack.undo.length > 1)) bytes -= stack.undo.shift().html.length * 2;
        }
        stack.last = after;
        let totalBytes = [...histories.values()].reduce((sum, item) => sum + [...item.undo, ...item.redo].reduce((size, entry) => size + entry.html.length * 2, 0), 0);
        for (const [id, item] of histories) {
            if (totalBytes <= HISTORY_BYTES || id === key()) continue;
            totalBytes -= [...item.undo, ...item.redo].reduce((size, entry) => size + entry.html.length * 2, 0);
            histories.delete(id);
        }
        updateState();
    }
    function refresh() {
        normalizeFootnotes(root);
        SoraContentFormats.normalizeCallouts(root);
        initCodeBlocks();
        attachTaskListEvents();
        root.querySelectorAll('details[data-sora-details]').forEach(node => { node.open = true; });
        syncPreviewToTextarea();
    }
    async function restoreSnapshot(saved) {
        restoring = true;
        try {
            root.innerHTML = saved.html;
            generation++; savedRange = null;
            root.querySelectorAll('.code-lang-label').forEach(node => node.remove());
            root.querySelectorAll('[data-task-attached]').forEach(node => node.removeAttribute('data-task-attached'));
            refresh();
            initializeStoredImages(); initializeVideos(); initializeArchiveDownloadButtons();
            restoreBookmark(saved.selection);
            history().last = snapshot();
        } finally { restoring = false; updateState(); }
    }
    async function undo(redo = false) {
        if (composing || executing || restoring || !key()) return;
        flushInput();
        const stack = history(), source = redo ? stack.redo : stack.undo;
        if (!source.length) return;
        const state = source.pop();
        (redo ? stack.undo : stack.redo).push({ ...snapshot(), label: state.label });
        await restoreSnapshot(state);
    }
    function capture(range = getRange()) {
        if (!key() || composing || restoring) return null;
        if (!inside(range)) return null;
        return { key: key(), generation, html: contentStamp(), range: range.cloneRange() };
    }
    function valid(token) {
        return !!token && token.key === key() && token.generation === generation && token.html === contentStamp() && inside(token.range);
    }
    function transaction(label, token, action, options = {}) {
        if (!valid(token)) { showToast('正文或选区已变化，请重新选择后操作', 'warning'); return false; }
        flushInput();
        setRange(token.range);
        const before = snapshot();
        transactionDepth++;
        try {
            action(token.range);
            // 普通补行只需同步正文，避免重置组件当前的展开等显示状态。
            if (options.refreshWidgets === false) syncPreviewToTextarea();
            else refresh();
            commit(before, label);
            remember();
            return true;
        } catch (error) {
            root.innerHTML = before.html;
            generation++; savedRange = null;
            refresh(); restoreBookmark(before.selection);
            showToast(error.message || '格式操作未完成，已恢复原内容', 'warning');
            return false;
        } finally { transactionDepth--; }
    }
    function didSync() {
        if (!key() || composing || restoring || transactionDepth || isUpdating) return;
        const before = inputBefore || history().last;
        inputBefore = null;
        if (before) commit(before, '编辑正文');
        else history().last = snapshot();
    }
    function flushInput() {
        if (!inputBefore || composing) return;
        const before = inputBefore; inputBefore = null;
        commit(before, '编辑正文');
    }
    function onRender() {
        generation++; savedRange = null; inputBefore = null; caretNodes.clear();
        const nextKey = key();
        // 加载、恢复及外部目录变更会重建正文，旧 DOM 选区不能跨重建使用。
        if (nextKey !== activeKey) activeKey = nextKey;
        initCodeBlocks();
        SoraContentFormats.normalizeCallouts(root);
        if (nextKey && !restoring) {
            const previous = histories.get(nextKey)?.last;
            if (previous && contentStamp(previous.html) !== contentStamp()) histories.delete(nextKey);
            history().last = snapshot();
        }
        root.querySelectorAll('details[data-sora-details]').forEach(node => { node.open = true; });
        updateState();
    }

    function unwrap(node) { node.replaceWith(...node.childNodes); }
    function cloneShell(node) {
        const copy = node.cloneNode(false);
        copy.removeAttribute('id'); copy.removeAttribute('data-auto-heading-id');
        return copy;
    }
    function isolateBranch(branch, parent) {
        const before = cloneShell(parent), after = cloneShell(parent);
        while (parent.firstChild !== branch) before.appendChild(parent.firstChild);
        while (branch.nextSibling) after.appendChild(branch.nextSibling);
        if (before.hasChildNodes()) parent.before(before);
        if (after.hasChildNodes()) parent.after(after);
    }
    function removeAncestorStyle(node, selector) {
        let ancestor = node.parentElement?.closest(selector);
        while (ancestor && ancestor !== root && root.contains(ancestor) && !ancestor.matches(blockSelector)) {
            let branch = node;
            while (branch.parentNode !== ancestor) { isolateBranch(branch, branch.parentElement); branch = branch.parentElement; }
            isolateBranch(branch, ancestor);
            if (ancestor.id || ancestor.hasAttribute('data-anchor-name')) {
                const marker = document.createElement('span');
                ['id', 'data-anchor-name', 'data-sora-anchor'].forEach(name => { if (ancestor.hasAttribute(name)) marker.setAttribute(name, ancestor.getAttribute(name)); });
                ancestor.before(marker);
            }
            unwrap(ancestor);
            ancestor = node.parentElement?.closest(selector);
        }
    }
    function ancestors(node) {
        const result = [];
        for (let parent = element(node); parent && parent !== root; parent = parent.parentElement) result.push(parent);
        return result;
    }
    function marked(node, tags) { return ancestors(node).some(parent => tags.includes(parent.tagName.toLowerCase()) && !parent.closest('pre')); }
    function isolateText(part) {
        let node = part.node;
        if (part.end < node.length) node.splitText(part.end);
        if (part.start > 0) node = node.splitText(part.start);
        return node;
    }
    function inline(range, command, value) {
        const tags = inlineDefinitions[command];
        const property = textProperties.includes(command) ? command : '';
        const collapsed = range.collapsed;
        let parts = textNodes(range);
        if (collapsed) {
            if (protectedNode(range.startContainer)) throw new Error('请把光标放在可编辑正文中');
            const node = document.createTextNode('\u200B'); range.insertNode(node); caretNodes.add(node);
            parts = [{ node, start: 0, end: 1 }];
        }
        if (!parts.length) return;
        const remove = tags && parts.every(part => marked(part.node, tags));
        const selected = parts.map(isolateText);
        selected.forEach(node => {
            if (command === 'superscript' && !remove) removeAncestorStyle(node, 'sub');
            if (command === 'subscript' && !remove) removeAncestorStyle(node, 'sup');
            if (command === 'clear-format') {
                Object.entries(inlineDefinitions).filter(([name]) => !['code', 'kbd'].includes(name)).forEach(([, names]) => removeAncestorStyle(node, names.join(',')));
                textProperties.forEach(style => removeProperty(node, style));
            } else if (property) {
                removeProperty(node, property);
                if (value) { const span = document.createElement('span'); span.style.setProperty(property, value); node.replaceWith(span); span.append(node); }
            } else if (remove) removeAncestorStyle(node, tags.join(','));
            else if (!marked(node, tags)) { const tag = document.createElement(tags[0]); node.replaceWith(tag); tag.append(node); }
        });
        const selection = document.createRange();
        selection.setStart(selected[0], collapsed ? selected[0].length : 0);
        selection.setEnd(selected[selected.length - 1], selected[selected.length - 1].length);
        setRange(selection);
    }
    function removeProperty(node, property) {
        const candidates = ancestors(node).filter(parent => !parent.matches(blockSelector) && parent.style.getPropertyValue(property));
        candidates.forEach(parent => {
            if (!parent.isConnected || !parent.contains(node)) return;
            let branch = node;
            while (branch.parentNode !== parent) { isolateBranch(branch, branch.parentElement); branch = branch.parentElement; }
            isolateBranch(branch, parent);
            parent.style.removeProperty(property);
            if (!parent.getAttribute('style')) parent.removeAttribute('style');
            if (parent.tagName === 'SPAN' && !parent.attributes.length) unwrap(parent);
        });
    }
    function ensureBlocks(container = root) {
        // 旧文档及单元格、列表项允许直接放行内内容，先组成当前区域的段落。
        let paragraph = null;
        Array.from(container.childNodes).forEach(node => {
            if (node.nodeType === Node.COMMENT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.matches('input.task-list-item-checkbox'))) { paragraph = null; return; }
            if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim() && !paragraph) return;
            if (node.nodeType === Node.ELEMENT_NODE && /^(P|DIV|H[1-6]|UL|OL|TABLE|PRE|BLOCKQUOTE|ASIDE|DETAILS|SUMMARY|SECTION|ARTICLE|MAIN|DL|FIGURE|HR)$/.test(node.tagName)) { paragraph = null; return; }
            if (!paragraph) { paragraph = document.createElement('p'); node.before(paragraph); }
            paragraph.append(node);
        });
    }
    function contentHost(node) {
        const origin = element(node);
        if (protectedNode(node) || origin?.closest('summary,dt,.sora-callout-title,.sora-callout-kind')) throw new Error('请把光标放在内容正文中，标题或只读内容内不能插入块');
        for (let parent = origin; parent && root.contains(parent); parent = parent.parentElement) {
            if (parent.matches('details[data-sora-details],.sora-callout')) throw new Error('请把光标放进内容块的正文区域');
            if (parent === root || parent.matches(contentHostSelector)) return parent;
            if (parent.matches('table,thead,tbody,tfoot,tr,ul,ol,dl')) break;
        }
        throw new Error('请把光标放在正文、单元格或列表项内');
    }
    function prepareBlockRange(range) {
        const host = contentHost(range.startContainer);
        if (contentHost(range.endContainer) !== host) throw new Error('请选择同一正文区域的内容，不要跨越不同单元格或内容块层级');
        const savePoint = (node, offset) => node === host ? { boundary: true, next: host.childNodes[offset] || null } : { node, offset };
        const start = savePoint(range.startContainer, range.startOffset), end = savePoint(range.endContainer, range.endOffset);
        ensureBlocks(host);
        const restorePoint = point => point.boundary
            ? point.next ? { node: point.next.parentNode, offset: Array.prototype.indexOf.call(point.next.parentNode.childNodes, point.next) } : { node: host, offset: host.childNodes.length }
            : point;
        const first = restorePoint(start), last = restorePoint(end);
        range.setStart(first.node, first.offset); range.setEnd(last.node, last.offset);
        return host;
    }
    function contentBlocks(range) {
        const host = prepareBlockRange(range);
        let selected;
        if (range.collapsed) {
            let node = range.startContainer === host ? host.childNodes[range.startOffset] : range.startContainer;
            while (node && node.parentNode !== host) node = node.parentNode;
            selected = node?.nodeType === Node.ELEMENT_NODE ? [node] : [];
            if (!selected.length) { const p = document.createElement('p'); p.append(document.createElement('br')); range.insertNode(p); selected = [p]; }
        } else selected = Array.from(host.children).filter(node => range.intersectsNode(node));
        if (!selected.length || selected.some(node => node.matches('summary,.sora-callout-title,.sora-callout-kind,input.task-list-item-checkbox'))) throw new Error('请选择内容正文，不要包含块标题或任务勾选框');
        return selected;
    }
    function paragraphAfter(node) {
        let next = node.nextSibling;
        while (next && (next.nodeType === Node.COMMENT_NODE || (next.nodeType === Node.TEXT_NODE && !next.textContent.trim()))) next = next.nextSibling;
        if (next?.nodeType === Node.ELEMENT_NODE && next.tagName === 'P' && !protectedNode(next) && !next.matches('.sora-callout-title')) return next;
        const paragraph = document.createElement('p'); paragraph.append(document.createElement('br')); node.after(paragraph);
        return paragraph;
    }
    function insertContainerBlock(range, wrapper, body = wrapper) {
        if (range.collapsed) {
            const p = document.createElement('p'); p.append(document.createElement('br')); body.append(p);
            insertBlock(range, wrapper);
            const next = document.createRange(); next.selectNodeContents(p); next.collapse(true); setRange(next);
        } else {
            const selected = contentBlocks(range);
            selected[0].before(wrapper); selected.forEach(node => body.append(node));
            paragraphAfter(wrapper); selectBlocks(selected);
        }
    }
    function currentContentBlock(range, kind) {
        const selector = kind === 'callout' ? '.sora-callout' : 'details[data-sora-details]';
        const node = element(range.startContainer)?.closest(selector);
        return node && root.contains(node) && node === element(range.endContainer)?.closest(selector) ? node : null;
    }
    function currentListItem(node) {
        const host = element(node)?.closest(contentHostSelector);
        return host?.tagName === 'LI' ? host : null;
    }
    function blocks(range) {
        const nodes = range.collapsed ? [range.startContainer] : textNodes(range, false).map(part => part.node);
        const startNode = range.startContainer, endNode = range.endContainer, startOffset = range.startOffset, endOffset = range.endOffset;
        ensureBlocks();
        if (root.contains(startNode) && root.contains(endNode)) {
            range.setStart(startNode, Math.min(startOffset, startNode.nodeType === 3 ? startNode.length : startNode.childNodes.length));
            range.setEnd(endNode, Math.min(endOffset, endNode.nodeType === 3 ? endNode.length : endNode.childNodes.length));
        }
        const selected = new Set();
        nodes.forEach(node => {
            if (protectedNode(node)) return;
            const block = element(node)?.closest(blockSelector);
            if (block && root.contains(block)) selected.add(block);
        });
        if (!selected.size) {
            const child = root.childNodes[Math.min(range.startOffset, root.childNodes.length - 1)];
            if (child?.nodeType === Node.ELEMENT_NODE && child.matches(blockSelector)) selected.add(child);
            else if (range.collapsed && range.startContainer === root) {
                const p = document.createElement('p'); p.append(document.createElement('br')); range.insertNode(p); selected.add(p);
            }
        }
        return Array.from(selected).filter(node => !Array.from(selected).some(other => other !== node && node.contains(other)));
    }
    function selectBlocks(nodes) {
        if (!nodes.length) return;
        const range = document.createRange(); range.setStart(nodes[0], 0); range.setEnd(nodes[nodes.length - 1], nodes[nodes.length - 1].childNodes.length); setRange(range);
    }
    function changeBlock(range, tag) {
        const selected = blocks(range);
        const changed = selected.map(block => {
            if (/^(LI|TD|TH|DT|DD|SUMMARY)$/.test(block.tagName)) {
                if (block.tagName === 'SUMMARY') throw new Error('折叠标题保持为标题文字，请在正文中设置段落格式');
                const child = document.createElement(tag);
                const children = Array.from(block.childNodes).filter(node => !element(node)?.matches('input[type="checkbox"],ul,ol'));
                if (children.some(node => node.nodeType === 1 && /^(P|H[1-6]|DIV|TABLE|PRE)$/.test(node.tagName))) throw new Error('请先选择单个段落再转换');
                children.forEach(node => child.append(node)); block.append(child); return child;
            }
            const replacement = document.createElement(tag);
            if (block.tagName === 'DIV' && block.querySelector('p,div,h1,h2,h3,h4,h5,h6,ul,ol,table,pre')) throw new Error('请选择单个正文段落后再转换');
            Array.from(block.attributes).forEach(attr => replacement.setAttribute(attr.name, attr.value));
            replacement.append(...block.childNodes); block.replaceWith(replacement); return replacement;
        });
        selectBlocks(changed);
    }
    function insertBlock(range, node) {
        const host = prepareBlockRange(range);
        range.deleteContents();
        const block = element(range.startContainer)?.closest('p,h1,h2,h3,h4,h5,h6');
        if (block && host.contains(block)) {
            const tailRange = document.createRange(); tailRange.selectNodeContents(block); tailRange.setStart(range.startContainer, range.startOffset);
            const tail = cloneShell(block); tail.append(tailRange.extractContents());
            block.after(node);
            if (tail.hasChildNodes()) node.after(tail);
            if (!block.textContent && !block.id && !block.querySelector('img,video,input,.sora-anchor')) block.remove();
        } else range.insertNode(node);
        const after = paragraphAfter(node);
        const next = document.createRange(); next.selectNodeContents(after); next.collapse(true); setRange(next);
    }

    function listKind(list) { return list.classList.contains('contains-task-list') ? 'task-list' : list.tagName === 'OL' ? 'ordered-list' : 'unordered-list'; }
    function newList(kind, old) {
        const list = document.createElement(kind === 'ordered-list' ? 'ol' : 'ul');
        if (old) Array.from(old.attributes).filter(attr => !['id', 'class', 'start', 'reversed'].includes(attr.name)).forEach(attr => list.setAttribute(attr.name, attr.value));
        if (kind === 'task-list') list.className = 'contains-task-list';
        return list;
    }
    function taskItem(item, task) {
        const checkbox = Array.from(item.children).find(node => node.matches('input.task-list-item-checkbox'));
        item.classList.toggle('task-list-item', task);
        if (!task) checkbox?.remove();
        else if (!checkbox) { const input = document.createElement('input'); input.type = 'checkbox'; input.className = 'task-list-item-checkbox'; input.setAttribute('aria-label', '任务完成状态'); item.prepend(input, document.createTextNode(' ')); }
    }
    function splitList(items, kind, remove) {
        const list = items[0].parentElement;
        const before = cloneShell(list), after = cloneShell(list), middle = newList(kind, list);
        let started = false, ended = false;
        Array.from(list.children).forEach(item => {
            if (items.includes(item)) { started = true; taskItem(item, kind === 'task-list' && !remove); middle.append(item); }
            else if (!started) before.append(item);
            else { ended = true; after.append(item); }
        });
        if (ended && list.tagName === 'OL') after.start = (list.start || 1) + before.children.length + middle.children.length;
        const replacement = document.createDocumentFragment();
        if (before.children.length) replacement.append(before);
        const changed = [];
        if (remove) {
            Array.from(middle.children).forEach(item => {
                const p = document.createElement('p');
                Array.from(item.attributes).filter(attr => !['class', 'value'].includes(attr.name)).forEach(attr => p.setAttribute(attr.name, attr.value));
                const nested = [];
                Array.from(item.childNodes).forEach(node => {
                    if (node.nodeType === 1 && /^(P|DIV|H[1-6]|UL|OL|PRE|TABLE|BLOCKQUOTE|ASIDE|DETAILS|DL|SECTION|FIGURE|HR)$/.test(node.tagName)) nested.push(node);
                    else p.append(node);
                });
                if (p.hasChildNodes() || !nested.length) { replacement.append(p); changed.push(p); }
                nested.forEach(node => { replacement.append(node); changed.push(node); });
            });
        } else { replacement.append(middle); changed.push(...middle.children); }
        if (after.children.length) replacement.append(after);
        list.replaceWith(replacement);
        return changed;
    }
    function list(range, kind, forceRemove = false) {
        if (contentHost(range.startContainer) === contentHost(range.endContainer)) prepareBlockRange(range);
        const selected = blocks(range).map(block => currentListItem(block) || block);
        const unique = [...new Set(selected)].filter(node => !selected.some(other => other !== node && other.contains(node)));
        const remove = forceRemove || unique.every(node => node.tagName === 'LI' && listKind(node.parentElement) === kind);
        const changed = [];
        while (unique.length) {
            const first = unique.shift();
            if (first.tagName === 'LI') {
                const items = [first];
                while (unique[0]?.parentElement === first.parentElement && items[items.length - 1].nextElementSibling === unique[0]) items.push(unique.shift());
                changed.push(...splitList(items, kind, remove));
            } else {
                if (forceRemove) continue;
                if (/^(TD|TH|SUMMARY|DT|DD)$/.test(first.tagName)) throw new Error('请先选择单元格或内容块中的正文段落');
                const group = [first];
                while (unique[0]?.parentElement === first.parentElement && group[group.length - 1].nextElementSibling === unique[0] && unique[0].tagName !== 'LI') group.push(unique.shift());
                const container = newList(kind); first.before(container);
                group.forEach(block => {
                    const item = document.createElement('li');
                    Array.from(block.attributes).forEach(attr => item.setAttribute(attr.name, attr.value));
                    item.append(...block.childNodes); taskItem(item, kind === 'task-list');
                    container.append(item); block.remove(); changed.push(item);
                });
            }
        }
        selectBlocks(changed);
    }
    function indent(range, out = false) {
        const items = [...new Set(blocks(range).map(currentListItem).filter(Boolean))];
        if (!items.length) throw new Error('请把光标放在列表项内');
        if (items.some(item => item.parentElement !== items[0].parentElement)) throw new Error('请选择同一级列表项');
        const container = items[0].parentElement;
        if (!out) {
            const previous = items[0].previousElementSibling;
            if (!previous) throw new Error('第一项前面没有可作为父级的列表项');
            let nested = Array.from(previous.children).find(node => /^(UL|OL)$/.test(node.tagName) && listKind(node) === listKind(container));
            if (!nested) { nested = newList(listKind(container)); previous.append(nested); }
            items.forEach(item => nested.append(item));
        } else {
            const parentItem = container.parentElement.closest('li');
            if (!parentItem) {
                const changed = splitList(items, listKind(container), true); selectBlocks(changed);
                const next = currentRange(); if (next) { next.collapse(true); setRange(next); }
                return;
            }
            const remainder = newList(listKind(container));
            while (items[items.length - 1].nextElementSibling) remainder.append(items[items.length - 1].nextElementSibling);
            if (remainder.children.length) items[items.length - 1].append(remainder);
            let cursor = parentItem;
            items.forEach(item => { cursor.after(item); taskItem(item, listKind(parentItem.parentElement) === 'task-list'); cursor = item; });
        }
        if (!container.children.length) container.remove();
        selectBlocks(items);
    }
    function quote(range) {
        const selected = contentBlocks(range);
        const remove = selected.every(node => node.parentElement.tagName === 'BLOCKQUOTE');
        if (remove) selected.forEach(block => { const parent = block.parentElement; isolateBranch(block, parent); unwrap(parent); });
        else { const wrapper = document.createElement('blockquote'); selected[0].before(wrapper); selected.forEach(node => wrapper.append(node)); paragraphAfter(wrapper); }
        selectBlocks(selected);
    }
    function form(title, fields, initial = {}, validate) {
        return new Promise(resolve => {
            const wrapper = document.createElement('form'); wrapper.className = 'sora-format-form';
            wrapper.noValidate = true;
            const controls = {};
            fields.forEach(field => {
                const label = document.createElement('label'); label.textContent = field.label;
                const control = document.createElement(field.options ? 'select' : field.multiline ? 'textarea' : 'input');
                if (field.options) field.options.forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option); });
                else if (!field.multiline) control.type = field.type || 'text';
                if (field.type === 'checkbox') control.checked = !!initial[field.key];
                else control.value = initial[field.key] ?? field.default ?? '';
                if (field.min != null) control.min = field.min;
                if (field.max != null) control.max = field.max;
                if (field.type === 'number') control.step = '1';
                if (field.required) control.required = true;
                if (!field.options && field.type !== 'number') control.maxLength = field.maxLength || 10000;
                control.name = field.key;
                if (field.type === 'checkbox') { label.className = 'sora-checkbox-field'; label.prepend(control); }
                else label.append(control);
                wrapper.append(label); controls[field.key] = control;
            });
            const error = document.createElement('p'); error.className = 'sora-form-error'; error.setAttribute('role', 'alert'); wrapper.append(error);
            const actions = document.createElement('div'); actions.className = 'sora-format-actions';
            const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消';
            const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = '应用';
            actions.append(cancel, submit); wrapper.append(actions);
            let finished = false;
            const finish = value => { if (finished) return; finished = true; resolve(value); };
            cancel.onclick = () => { finish(null); FeatureDialog.close(); };
            wrapper.onsubmit = event => {
                event.preventDefault();
                const values = Object.fromEntries(fields.map(field => [field.key, field.type === 'checkbox' ? controls[field.key].checked : controls[field.key].value]));
                const invalid = fields.find(field => (field.required && !String(values[field.key]).trim()) ||
                    (field.type === 'number' && (!Number.isInteger(Number(values[field.key])) || Number(values[field.key]) < field.min || Number(values[field.key]) > field.max)));
                if (invalid) { error.textContent = `请填写有效的${invalid.label}`; controls[invalid.key].focus(); return; }
                const message = validate?.(values);
                if (message) { error.textContent = message; return; }
                finish(values); FeatureDialog.close();
            };
            FeatureDialog.open(title, wrapper);
            wrapper.closest('.feature-dialog-overlay').addEventListener('sora:feature-dialog-clear', () => finish(null), { once: true });
        });
    }
    function tableCell(range) { return element(range.startContainer)?.closest('td,th'); }
    function tableEdit(range, action) {
        const cell = tableCell(range), table = cell?.closest('table');
        if (!cell || !table) throw new Error('请把光标放在表格单元格内');
        const row = cell.parentElement, column = cell.cellIndex;
        const rows = Array.from(table.rows);
        if (rows.some(item => Array.from(item.cells).some(td => td.rowSpan !== 1 || td.colSpan !== 1))) throw new Error('此表格含合并单元格，请先在原工具拆分后再调整行列');
        if (action === 'delete-table') { const p = document.createElement('p'); p.append(document.createElement('br')); table.replaceWith(p); selectBlocks([p]); return; }
        if (action.startsWith('row-')) {
            if (action === 'row-delete') { if (rows.length === 1) throw new Error('最后一行请使用“删除表格”'); row.remove(); selectBlocks([rows.find(item => item !== row).cells[0]]); return; }
            if (rows.length >= 100 || (rows.length + 1) * row.cells.length > 1000) throw new Error('表格最多 100 行、1000 个单元格');
            const next = document.createElement('tr');
            Array.from(row.cells).forEach(old => { const td = document.createElement(row.parentElement.tagName === 'THEAD' ? 'th' : 'td'); td.append(document.createElement('br')); next.append(td); });
            action === 'row-before' ? row.before(next) : row.after(next); selectBlocks([next.cells[column]]); return;
        }
        if (action.startsWith('column-')) {
            if (action === 'column-delete' && row.cells.length === 1) throw new Error('最后一列请使用“删除表格”');
            if (action !== 'column-delete' && (row.cells.length >= 20 || rows.length * (row.cells.length + 1) > 1000)) throw new Error('表格最多 20 列、1000 个单元格');
            rows.forEach(item => {
                const target = item.cells[column]; if (!target) return;
                if (action === 'column-delete') target.remove();
                else { const td = document.createElement(target.tagName.toLowerCase()); td.append(document.createElement('br')); action === 'column-before' ? target.before(td) : target.after(td); }
            });
            selectBlocks([row.cells[Math.min(column, row.cells.length - 1)]]); return;
        }
        if (action === 'table-header') {
            const first = table.rows[0];
            const header = first.parentElement.tagName !== 'THEAD';
            const section = header ? (table.tHead || table.createTHead()) : (table.tBodies[0] || table.createTBody());
            section.prepend(first);
            Array.from(first.cells).forEach(old => { const replacement = document.createElement(header ? 'th' : 'td'); replacement.append(...old.childNodes); replacement.style.cssText = old.style.cssText; if (header) replacement.scope = 'col'; old.replaceWith(replacement); });
            if (!header) table.tHead?.remove();
            selectBlocks([first.cells[Math.min(column, first.cells.length - 1)]]);
        }
    }
    function normalizeFootnotes(container) { window.SoraContentFormats.normalizeFootnotes(container); }
    function footnote(range, text) {
        const id = SoraContentFormats.id(), ref = document.createElement('sup');
        ref.dataset.footnoteRef = id;
        range.collapse(false); range.insertNode(ref);
        let section = root.querySelector('[data-sora-footnotes]');
        if (!section) {
            section = document.createElement('section'); section.className = 'sora-footnotes'; section.dataset.soraFootnotes = '';
            const heading = document.createElement('h2'); heading.textContent = '注释'; section.append(heading, document.createElement('ol')); root.append(section);
        }
        const note = document.createElement('li'); note.dataset.footnoteId = id;
        const body = document.createElement('span'); body.className = 'sora-footnote-body'; body.textContent = text;
        note.append(body); section.querySelector('ol').append(note);
        const after = document.createTextNode(''); ref.after(after); const next = document.createRange(); next.setStart(after, 0); next.collapse(true); setRange(next);
    }

    const definitions = [
        ['bold', '粗体', 'B', '文字'], ['italic', '斜体', 'I', '文字'], ['underline', '下划线', 'U', '文字'],
        ['strikethrough', '删除线', '删除线', '文字'], ['highlight', '高亮', '高亮', '文字'], ['spoiler', '防剧透', '防剧透', '文字'],
        ['superscript', '上标', '上标', '文字'], ['subscript', '下标', '下标', '文字'], ['code', '行内代码', '代码', '文字'], ['kbd', '键盘按键', '按键', '文字'],
        ['color', '文字颜色', '文字色', '文字'], ['background-color', '背景颜色', '背景色', '文字'], ['default-color', '恢复默认文字色', '默认文字色', '文字'], ['default-background', '清除背景颜色', '清除背景色', '文字'],
        ['clear-format', '清除文字样式（保留链接、锚点和代码）', '清除样式', '文字'],
        ['paragraph', '正文段落', '正文', '段落'], ...[1, 2, 3, 4, 5, 6].map(level => [`h${level}`, `标题 ${level}`, `H${level}`, '段落']),
        ['paragraph-settings', '段落对齐、行距和间距', '段落设置', '段落'],
        ['unordered-list', '无序列表', '无序列表', '段落'], ['ordered-list', '有序列表', '有序列表', '段落'], ['task-list', '任务列表', '任务列表', '段落'],
        ['indent', '增加列表缩进', '增加缩进', '段落'], ['outdent', '减少列表缩进', '减少缩进', '段落'], ['quote', '引用', '引用', '段落'],
        ['link', '链接', '链接', '插入'], ['anchor', '锚点', '锚点', '插入'], ['method', '方法', '方法', '插入'],
        ['code-block', '代码块', '代码块', '插入'], ['hr', '分隔线', '分隔线', '插入'], ['table', '插入表格', '表格', '插入'],
        ['callout', '插入提示块', '提示块', '插入'], ['details', '插入折叠块', '折叠块', '插入'], ['quote-block', '插入引用块（可嵌套）', '引用块', '插入'], ['footnote', '脚注 / 尾注', '脚注', '插入'], ['definition', '术语解释', '术语解释', '插入'],
        ['row-before', '上方插入行', '上方插行', '表格'], ['row-after', '下方插入行', '下方插行', '表格'], ['row-delete', '删除当前行', '删除行', '表格'],
        ['column-before', '左侧插入列', '左侧插列', '表格'], ['column-after', '右侧插入列', '右侧插列', '表格'], ['column-delete', '删除当前列', '删除列', '表格'],
        ['table-header', '切换首行表头', '首行表头', '表格'], ['cell-left', '单元格左对齐', '左对齐', '表格'], ['cell-center', '单元格居中', '居中', '表格'], ['cell-right', '单元格右对齐', '右对齐', '表格'], ['delete-table', '删除表格', '删除表格', '表格'],
        ['edit-callout', '编辑当前提示块', '编辑提示块', '编辑'], ['edit-details', '编辑当前折叠块', '编辑折叠块', '编辑'],
        ['brush-copy', '复制文字和段落样式', '复制样式', '编辑'], ['brush-apply', '应用已复制样式', '应用样式', '编辑'],
        ['undo', '撤销正文编辑', '撤销正文', '编辑'], ['redo', '重做正文编辑', '重做正文', '编辑']
    ].map(([command, label, text, group]) => ({ command, label, text, group }));
    const labels = new Map(definitions.map(item => [item.command, item.label]));
    function colorValue(range, property) {
        const values = textNodes(range).map(part => getComputedStyle(part.node.parentElement).getPropertyValue(property));
        if (!values.length) values.push(getComputedStyle(element(range.startContainer)).getPropertyValue(property));
        const unique = [...new Set(values)];
        const rgb = unique[0]?.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
        return { mixed: unique.length > 1, value: rgb ? '#' + rgb.slice(1, 4).map(number => Number(number).toString(16).padStart(2, '0')).join('') : property === 'color' ? '#000000' : '#FFFF00' };
    }
    function inlineLink(range, configure, fallback) {
        if (range.collapsed) { const link = document.createElement('a'); configure(link); link.textContent = fallback; range.insertNode(link); const next = document.createRange(); next.selectNodeContents(link); setRange(next); return; }
        const selected = textNodes(range).map(isolateText);
        selected.forEach(node => {
            if (node.parentElement.closest('[data-sora-link="method"]')) throw new Error('方法链接请使用方法编辑入口修改');
            removeAncestorStyle(node, 'a');
            const link = document.createElement('a'); configure(link); node.replaceWith(link); link.append(node);
        });
        if (selected.length) { const next = document.createRange(); next.setStart(selected[0], 0); next.setEnd(selected[selected.length - 1], selected[selected.length - 1].length); setRange(next); }
    }
    async function apply(command, suppliedToken = null) {
        if (executing || composing || restoring) return;
        if (command === 'undo' || command === 'redo') { await undo(command === 'redo'); return; }
        if (command === 'more') { openMore(); return; }
        const token = suppliedToken || capture();
        if (!token) { showToast('请先在正文中放置光标或选择内容', 'warning'); return; }
        executing = true;
        try {
            let value = null;
            const contentKind = ['callout', 'details'].find(kind => command === kind || command === 'edit-' + kind);
            if (textProperties.includes(command)) {
                const current = colorValue(token.range, command);
                value = await colorPickerDialog(current.value, `${command === 'color' ? '文字颜色' : '背景颜色'}${current.mixed ? '（选区包含多种颜色）' : ''}`, command === 'color' ? 'text' : 'background');
                if (value == null) return;
            } else if (command === 'link') { value = await showLinkConfigDialog('https://', '插入链接'); if (!value) return; }
            else if (command === 'anchor') { value = await customPrompt('输入锚点名:', ''); if (!value) return; }
            else if (command === 'method') { value = await promptMethodConfig(null); if (!value) return; }
            else if (command === 'code-block') { value = await codeEditDialog(token.range.toString(), '', CODE_LANG_OPTIONS, '插入代码块'); if (!value) return; }
            else if (command === 'kbd' && token.range.collapsed) { value = await customPrompt('输入按键，例如 Ctrl+S:', ''); if (!value) return; }
            else if (command === 'table') {
                value = await form('插入表格', [
                    { key: 'rows', label: '总行数（含表头，1–100）', type: 'number', min: 1, max: 100, required: true },
                    { key: 'columns', label: '列数（1–20）', type: 'number', min: 1, max: 20, required: true },
                    { key: 'header', label: '首行为表头', type: 'checkbox' }
                ], { rows: 3, columns: 3, header: true }, data => {
                    const r = Number(data.rows), c = Number(data.columns);
                    return !Number.isInteger(r) || !Number.isInteger(c) || r < 1 || r > 100 || c < 1 || c > 20 || r * c > 1000 ? '请输入有效行列数，总单元格数不能超过 1000' : '';
                }); if (!value) return;
            } else if (command === 'paragraph-settings') {
                const parent = element(token.range.startContainer)?.closest(blockSelector);
                value = await form('段落设置', [
                    { key: 'text-align', label: '对齐', options: [['', '默认'], ['left', '左对齐'], ['center', '居中'], ['right', '右对齐'], ['justify', '两端对齐']] },
                    { key: 'line-height', label: '行距', options: [['', '默认'], ['1.2', '紧凑 1.2'], ['1.5', '标准 1.5'], ['1.8', '宽松 1.8'], ['2', '双倍 2.0']] },
                    { key: 'margin-top', label: '段前间距', options: [['', '默认'], ['0px', '无'], ['8px', '小'], ['16px', '中'], ['24px', '大']] },
                    { key: 'margin-bottom', label: '段后间距', options: [['', '默认'], ['0px', '无'], ['8px', '小'], ['16px', '中'], ['24px', '大']] }
                ], Object.fromEntries(paragraphProperties.map(name => [name, parent?.style.getPropertyValue(name) || '']))); if (!value) return;
            } else if (contentKind) {
                const editing = command.startsWith('edit-');
                const existing = editing ? currentContentBlock(token.range, contentKind) : null;
                if (editing && !existing) throw new Error('请把光标放在需要编辑的内容块内');
                const titleSelector = contentKind === 'callout' ? ':scope > .sora-callout-title' : ':scope > summary';
                const fields = [{ key: 'title', label: '标题', required: true, maxLength: 200 }];
                if (contentKind === 'callout') fields.push({ key: 'type', label: '类型', options: [['info', '提示'], ['warning', '注意'], ['danger', '警告'], ['success', '成功']] });
                else fields.push({ key: 'open', label: '导出后默认展开', type: 'checkbox' });
                value = await form(labels.get(command), fields, { title: existing?.querySelector(titleSelector)?.textContent || (contentKind === 'callout' ? '提示' : '补充说明'), type: existing?.dataset.callout || 'info', open: existing?.dataset.defaultOpen === 'true' });
                if (!value) return;
                value.existing = existing;
            } else if (command === 'footnote') {
                value = await form('添加脚注 / 尾注', [{ key: 'text', label: '注释内容', multiline: true, required: true }]); if (!value) return;
            } else if (command === 'definition') {
                value = await form('术语解释', [{ key: 'term', label: '术语', required: true, maxLength: 200 }, { key: 'description', label: '解释', multiline: true, required: true }]); if (!value) return;
            } else if (command === 'delete-table') { if (!await customConfirm('删除整张表格及其中内容？可通过“撤销正文”恢复。', '删除表格', '取消')) return; }
            if (command === 'brush-copy') {
                if (!valid(token)) { showToast('正文已变化，请重新选择', 'warning'); return; }
                const node = token.range.startContainer, block = element(node)?.closest(blockSelector);
                brush = { marks: Object.fromEntries(Object.entries(inlineDefinitions).filter(([name]) => !['code', 'kbd'].includes(name)).map(([name, tags]) => [name, marked(node, tags)])),
                    text: Object.fromEntries(textProperties.map(name => [name, ancestors(node).find(parent => parent.style.getPropertyValue(name))?.style.getPropertyValue(name) || ''])),
                    paragraph: Object.fromEntries(paragraphProperties.map(name => [name, block?.style.getPropertyValue(name) || ''])) };
                showToast('已复制文字和段落样式', 'success'); updateState(); return;
            }
            transaction(labels.get(command) || command, token, range => {
                if (inlineDefinitions[command] || textProperties.includes(command) || command === 'clear-format') {
                    if (command === 'kbd' && value) { const node = document.createElement('kbd'); node.textContent = value; range.insertNode(node); const next = document.createRange(); next.selectNodeContents(node); setRange(next); }
                    else inline(range, command, value);
                } else if (command === 'default-color' || command === 'default-background') inline(range, command === 'default-color' ? 'color' : 'background-color', '');
                else if (/^h[1-6]$/.test(command) || command === 'paragraph') changeBlock(range, command === 'paragraph' ? 'p' : command);
                else if (['unordered-list', 'ordered-list', 'task-list'].includes(command)) list(range, command);
                else if (command === 'indent' || command === 'outdent') indent(range, command === 'outdent');
                else if (command === 'quote') quote(range);
                else if (command === 'quote-block') insertContainerBlock(range, document.createElement('blockquote'));
                else if (command === 'paragraph-settings') blocks(range).forEach(block => paragraphProperties.forEach(name => value[name] ? block.style.setProperty(name, value[name]) : block.style.removeProperty(name)));
                else if (command === 'link') inlineLink(range, link => applyLinkAttributesToElement(link, value), value);
                else if (command === 'method') inlineLink(range, link => { link.href = '#'; writeMethodsToElement(link, [value]); }, '方法');
                else if (command === 'anchor') {
                    const name = normalizeAnchorName(value); if (!name) throw new Error('请输入有效锚点名');
                    const anchor = document.createElement('span'); anchor.id = generateUniqueAnchorDomId(name); anchor.className = 'sora-anchor'; anchor.dataset.soraAnchor = 'true'; anchor.dataset.anchorName = name; anchor.textContent = '\u200B';
                    range.collapse(true); range.insertNode(anchor);
                } else if (command === 'code-block') {
                    const pre = document.createElement('pre'), code = document.createElement('code'); pre.dataset.lang = value.language || 'code';
                    code.textContent = value.code; if (value.language) code.className = 'language-' + value.language; pre.append(code); insertBlock(range, pre);
                } else if (command === 'hr') insertBlock(range, document.createElement('hr'));
                else if (command === 'table') {
                    const table = document.createElement('table'), body = table.createTBody();
                    for (let r = 0; r < Number(value.rows); r++) {
                        const row = document.createElement('tr');
                        for (let c = 0; c < Number(value.columns); c++) { const cell = document.createElement(value.header && !r ? 'th' : 'td'); if (cell.tagName === 'TH') cell.scope = 'col'; cell.append(document.createElement('br')); row.append(cell); }
                        (value.header && !r ? table.createTHead() : body).append(row);
                    }
                    insertBlock(range, table); const next = document.createRange(); next.selectNodeContents(table.rows[0].cells[0]); next.collapse(true); setRange(next);
                } else if (command.startsWith('cell-')) {
                    const cell = tableCell(range); if (!cell) throw new Error('请把光标放在单元格内');
                    const table = cell.closest('table');
                    const cells = Array.from(table.querySelectorAll('td,th')).filter(node => node.closest('table') === table && (range.collapsed ? node === cell : range.intersectsNode(node)));
                    cells.forEach(node => { node.style.textAlign = command.slice(5); });
                } else if (labels.has(command) && definitions.find(item => item.command === command)?.group === '表格') tableEdit(range, command);
                else if (contentKind) {
                    if (value.existing) {
                        const node = value.existing;
                        const title = node.querySelector(contentKind === 'callout' ? ':scope > .sora-callout-title' : ':scope > summary');
                        if (!title) throw new Error('此内容块缺少标题，请先恢复标题结构');
                        title.textContent = value.title;
                        if (contentKind === 'callout') node.dataset.callout = value.type;
                        else node.dataset.defaultOpen = String(value.open);
                    } else {
                        const wrapper = document.createElement(contentKind === 'callout' ? 'aside' : 'details');
                        const title = document.createElement(contentKind === 'callout' ? 'p' : 'summary'), body = document.createElement('div');
                        title.textContent = value.title;
                        if (contentKind === 'callout') { wrapper.className = 'sora-callout'; wrapper.dataset.callout = value.type; title.className = 'sora-callout-title'; body.className = 'sora-callout-body'; }
                        else { wrapper.dataset.soraDetails = ''; wrapper.dataset.defaultOpen = String(value.open); wrapper.open = true; body.className = 'sora-details-body'; }
                        wrapper.append(title, body);
                        insertContainerBlock(range, wrapper, body);
                    }
                } else if (command === 'footnote') footnote(range, value.text);
                else if (command === 'definition') {
                    const dl = document.createElement('dl'), dt = document.createElement('dt'), dd = document.createElement('dd'); dl.className = 'sora-definitions'; dt.textContent = value.term; dd.textContent = value.description; dl.append(dt, dd); insertBlock(range, dl);
                } else if (command === 'brush-apply') {
                    if (!brush) throw new Error('请先选择来源文字并点击“复制样式”');
                    inline(range, 'clear-format');
                    Object.entries(brush.marks).forEach(([name, enabled]) => { if (enabled) inline(getRange(), name); });
                    textProperties.forEach(name => { if (brush.text[name]) inline(getRange(), name, brush.text[name]); });
                    blocks(getRange()).forEach(block => paragraphProperties.forEach(name => brush.paragraph[name] ? block.style.setProperty(name, brush.paragraph[name]) : block.style.removeProperty(name)));
                }
            });
        } catch (error) { showToast(error.message || '格式操作未完成', 'error'); }
        finally { executing = false; updateState(); }
    }

    function state(command, range = getRange()) {
        if (!key() || !range || composing || restoring) return { disabled: true, pressed: 'false' };
        if (command === 'edit-callout' || command === 'edit-details') return { disabled: !currentContentBlock(range, command.slice(5)), pressed: 'false' };
        if (command === 'undo' || command === 'redo') return { disabled: !history()[command === 'undo' ? 'undo' : 'redo'].length, pressed: 'false' };
        if (command === 'brush-apply') return { disabled: !brush, pressed: 'false' };
        const def = definitions.find(item => item.command === command);
        if (def?.group === '表格') return { disabled: !tableCell(range), pressed: 'false' };
        const names = inlineDefinitions[command];
        if (names) {
            const nodes = stateNodes(range);
            const statuses = nodes.map(node => marked(node, names));
            return { disabled: false, pressed: statuses.length && statuses.every(Boolean) ? 'true' : statuses.some(Boolean) ? 'mixed' : 'false' };
        }
        if (['unordered-list', 'ordered-list', 'task-list', 'quote'].includes(command)) {
            const nodes = stateNodes(range);
            const statuses = nodes.map(node => {
                if (command === 'quote') return element(node)?.closest(contentHostSelector)?.tagName === 'BLOCKQUOTE';
                const container = currentListItem(node)?.parentElement;
                return !!container && listKind(container) === command;
            });
            return { disabled: false, pressed: statuses.length && statuses.every(Boolean) ? 'true' : statuses.some(Boolean) ? 'mixed' : 'false' };
        }
        return { disabled: false, pressed: 'false' };
    }
    function button(command) {
        const definition = definitions.find(item => item.command === command);
        const node = document.createElement('button'); node.type = 'button'; node.dataset.command = command;
        node.textContent = definition?.text || '更多格式'; node.title = definition?.label || '全部格式与表格操作';
        node.setAttribute('aria-label', node.title); node.setAttribute('aria-pressed', 'false');
        node.className = 'top-toolbar-btn format-toolbar-btn';
        if (command === 'link') node.id = 'topLinkBtn';
        if (command === 'anchor') node.id = 'topAnchorBtn';
        if (command === 'method') node.id = 'topMethodBtn';
        node.onmousedown = event => { remember(); event.preventDefault(); };
        node.onclick = event => { event.preventDefault(); apply(command); };
        return node;
    }
    function openMore() {
        const token = capture();
        if (!token) { showToast('请先在正文中放置光标', 'warning'); return; }
        const wrapper = document.createElement('div'); wrapper.className = 'sora-format-menu'; wrapper.dataset.soraFormatUi = '';
        const search = document.createElement('input'); search.type = 'search'; search.placeholder = '搜索格式或表格操作'; search.setAttribute('aria-label', '搜索格式'); wrapper.append(search);
        [...new Set(definitions.map(item => item.group))].forEach(group => {
            const section = document.createElement('section'), heading = document.createElement('h3'), controls = document.createElement('div');
            heading.textContent = group; controls.className = 'sora-format-actions'; section.append(heading, controls);
            definitions.filter(item => item.group === group).forEach(item => {
                const node = button(item.command); node.removeAttribute('id'); node.disabled = state(item.command, token.range).disabled;
                node.onclick = () => { FeatureDialog.close(); apply(item.command, token); };
                controls.append(node);
            }); wrapper.append(section);
        });
        search.oninput = () => wrapper.querySelectorAll('section').forEach(section => {
            section.querySelectorAll('button').forEach(node => { node.hidden = !node.title.includes(search.value.trim()); });
            section.hidden = !section.querySelector('button:not([hidden])');
        });
        FeatureDialog.open('格式与表格操作', wrapper);
    }
    function mount() {
        const toolbar = document.querySelector('.format-toolbar-scroll');
        toolbar.querySelectorAll('.format-toolbar-btn').forEach(node => node.remove());
        const select = document.createElement('select'); select.id = 'blockFormatSelect'; select.setAttribute('aria-label', '正文或标题类型');
        [['paragraph', '正文'], ...[1, 2, 3, 4, 5, 6].map(level => [`h${level}`, `标题 ${level}`])].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); });
        const mixed = document.createElement('option'); mixed.value = 'mixed'; mixed.textContent = '混合段落'; mixed.disabled = true; select.append(mixed);
        select.onpointerdown = remember; select.onchange = () => apply(select.value);
        const controls = document.createDocumentFragment(); controls.append(select);
        ['bold', 'italic', 'underline', 'color', 'background-color', 'clear-format', 'paragraph-settings', 'unordered-list', 'ordered-list', 'task-list', 'link', 'anchor', 'method', 'code-block', 'table', 'more'].forEach(command => controls.append(button(command)));
        toolbar.prepend(controls); toolbar.dataset.soraFormatUi = '';
        textFormatToolbar.replaceChildren(); textFormatToolbar.dataset.soraFormatUi = '';
        ['bold', 'italic', 'underline', 'highlight', 'link', 'clear-format', 'more'].forEach(command => { const node = button(command); node.removeAttribute('id'); node.className = 'format-btn'; textFormatToolbar.append(node); });
        updateState();
    }
    function updateState() {
        stateParts = null;
        const range = getRange();
        document.querySelectorAll('[data-sora-format-ui] [data-command]').forEach(node => {
            const value = state(node.dataset.command, range);
            if (node.disabled !== value.disabled) node.disabled = value.disabled;
            if (node.getAttribute('aria-pressed') !== value.pressed) node.setAttribute('aria-pressed', value.pressed);
            if (node.classList.contains('active') !== (value.pressed === 'true')) node.classList.toggle('active', value.pressed === 'true');
        });
        const select = document.getElementById('blockFormatSelect');
        if (select) {
            select.disabled = !range || !key() || composing;
            const nodes = !range ? [] : stateNodes(range);
            const types = [...new Set(nodes.map(node => { const block = element(node)?.closest(blockSelector); return /^H[1-6]$/.test(block?.tagName || '') ? block.tagName.toLowerCase() : 'paragraph'; }))];
            select.value = types.length > 1 ? 'mixed' : types[0] || 'paragraph';
        }
        const signature = definitions.map(item => { const value = state(item.command, range); return `${item.command}:${value.disabled}:${value.pressed}`; }).join('|');
        if (signature !== stateSignature) { stateSignature = signature; document.dispatchEvent(new Event('sora:format-state')); }
    }
    function collectMediaIds(target) {
        histories.forEach(stack => [...stack.undo, ...stack.redo].forEach(item => {
            const template = document.createElement('template'); template.innerHTML = item.html;
            template.content.querySelectorAll('[data-media-storage-id]').forEach(node => target.add(node.getAttribute('data-media-storage-id')));
        }));
        return target;
    }
    function captureElement(node) {
        if (!node || !root.contains(node)) return null;
        const range = document.createRange(); range.selectNode(node);
        return { key: key(), generation, html: contentStamp(), range };
    }
    async function editFootnote(ref) {
        const token = captureElement(ref), id = ref.dataset.footnoteRef;
        const note = Array.from(root.querySelectorAll('[data-footnote-id]')).find(node => node.dataset.footnoteId === id);
        if (!token || !note) { showToast('此注释内容缺失，请删除引用后重新添加注释', 'warning'); return; }
        const values = await form('编辑注释', [{ key: 'text', label: '注释内容', multiline: true }, { key: 'remove', label: '删除此引用及注释', type: 'checkbox' }], { text: note.querySelector('.sora-footnote-body')?.textContent || '' });
        if (!values) return;
        transaction('编辑注释', token, () => { if (values.remove) { ref.remove(); note.remove(); } else note.querySelector('.sora-footnote-body').textContent = values.text; });
    }
    root.addEventListener('compositionstart', () => { flushInput(); inputBefore = snapshot(); composing = true; updateState(); }, true);
    root.addEventListener('compositionend', () => { composing = false; finishInput(); }, true);
    root.addEventListener('beforeinput', event => {
        if (restoring || isUpdating) return;
        if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); undo(event.inputType === 'historyRedo'); return; }
        if (!inputBefore) inputBefore = snapshot();
    }, true);
    function finishInput() {
        if (composing || restoring || isUpdating) return;
        const range = currentRange();
        caretNodes.forEach(node => {
            if (node.isConnected && node.textContent.length > 1 && node.textContent.includes('\u200B')) {
                const position = node.textContent.indexOf('\u200B');
                node.deleteData(position, 1);
                if (range?.startContainer === node) setRange(range, false);
                caretNodes.delete(node);
            } else if (!node.isConnected) caretNodes.delete(node);
        });
        normalizeFootnotes(root);
        flushInput(); remember(); updateState();
    }
    root.addEventListener('input', finishInput);
    root.addEventListener('pointerdown', () => { if (!composing) history().last = snapshot(); }, true);
    root.addEventListener('change', event => {
        if (event.target.matches('input[type="checkbox"]')) { const before = history().last; syncPreviewToTextarea(); commit(before, '任务状态'); }
    });
    root.addEventListener('keydown', event => {
        if (event.isComposing || composing || event.keyCode === 229) return;
        const ctrl = event.ctrlKey || event.metaKey;
        const command = ctrl && ({ b: 'bold', i: 'italic', u: 'underline', z: event.shiftKey ? 'redo' : 'undo', y: 'redo' })[event.key.toLowerCase()];
        if (command) { event.preventDefault(); event.stopImmediatePropagation(); apply(command); return; }
        const range = currentRange(), item = range && currentListItem(range.startContainer);
        if (event.key === 'Tab' && item && !item.closest('[data-sora-footnotes]')) { event.preventDefault(); apply(event.shiftKey ? 'outdent' : 'indent'); }
        if (event.key === 'Enter' && !event.shiftKey && item && !item.closest('[data-sora-footnotes]') && !item.textContent.replace(/\u200B/g, '').trim() && !item.querySelector('img,video,table,ul,ol')) {
            event.preventDefault(); event.stopImmediatePropagation();
            const token = capture(); transaction('退出空列表项', token, selection => indent(selection, true));
        }
    }, true);
    root.addEventListener('click', event => {
        const back = event.target.closest('[data-footnote-backlink]');
        if (back) { event.preventDefault(); event.stopImmediatePropagation(); scrollToAnchorInPreview(back.getAttribute('href').slice(1)); return; }
        const ref = event.target.closest('[data-footnote-ref]');
        if (ref && !event.ctrlKey && !event.metaKey) { event.preventDefault(); event.stopImmediatePropagation(); editFootnote(ref); }
    }, true);
    document.addEventListener('selectionchange', () => { if (!composing && !restoring) { remember(); updateState(); } });
    document.addEventListener('sora:document-loaded', () => { generation++; savedRange = null; inputBefore = null; histories.clear(); });
    window.SoraEditor = { capture, captureElement, transaction, onRender, remember, undo, collectMediaIds, isComposing: () => composing, flushInput, didSync };
    window.SoraFormatting = { apply, definitions, state, openMore, updateState };
    mount();
})();
