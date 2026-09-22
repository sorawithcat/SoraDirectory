/* 正文点击定位输入；按内容流寻找落点，不依赖具体格式命令。 */
(function() {
    'use strict';
    const root = markdownPreview;
    if (!root) return;
    const flowContainers = 'div,section,article,main,aside,blockquote,li,td,th,dd,figcaption';
    const controls = '[contenteditable="false"],a,button,input,textarea,select,summary,pre,code,video,audio,img,[role="button"]';
    let gesture = null;

    function ready() {
        return root.isContentEditable && !isUpdating && window.SoraEditor && !SoraEditor.isComposing();
    }
    function blankParagraph(node) {
        return node?.nodeType === Node.ELEMENT_NODE && node.matches('p,div:not([class])') &&
            !node.textContent && Array.from(node.children).every(child => child.tagName === 'BR') && node.isContentEditable;
    }
    function lineHeight(node) {
        const style = getComputedStyle(node);
        return parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 16) * 1.6;
    }
    function focusLine(paragraph, clientY) {
        const breaks = Array.from(paragraph.children).filter(node => node.tagName === 'BR');
        const row = Math.max(0, Math.floor((clientY - paragraph.getBoundingClientRect().top) / lineHeight(paragraph)));
        const range = document.createRange();
        if (breaks.length) range.setStartBefore(breaks[Math.min(row, breaks.length - 1)]);
        else range.setStart(paragraph, 0);
        range.collapse(true);
        root.focus({ preventScroll: true });
        const selection = window.getSelection();
        selection.removeAllRanges(); selection.addRange(range);
        SoraEditor.remember();
        window.SoraFormatting?.updateState();
    }
    function gapAt(container, clientY) {
        let previous = null, next = null;
        for (const node of container.childNodes) {
            let rect;
            if (node.nodeType === Node.TEXT_NODE) {
                if (!node.textContent.trim()) continue;
                const range = document.createRange(); range.selectNodeContents(node);
                rect = range.getBoundingClientRect();
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (!node.getClientRects().length) continue;
                rect = node.getBoundingClientRect();
            } else continue;
            // 文字、表格或其他块占据的行仍交给浏览器按横向点击位置定位。
            if (clientY >= rect.top && clientY <= rect.bottom) return null;
            if (rect.bottom < clientY) previous = node;
            else if (!next && rect.top > clientY) next = node;
        }
        return { previous, next };
    }
    function fillToLine(paragraph, clientY) {
        const height = lineHeight(paragraph);
        const rows = Math.max(1, Math.floor((clientY - paragraph.getBoundingClientRect().top) / height) + 1);
        const existing = paragraph.children.length;
        // 点击仅补齐当前可见空白；异常样式也不能一次生成无限换行。
        const limit = existing + Math.min(1000, Math.ceil(root.clientHeight / height) + 1);
        const count = Math.min(rows, limit);
        const fragment = document.createDocumentFragment();
        for (let i = existing; i < count; i++) fragment.append(document.createElement('br'));
        paragraph.append(fragment);
    }
    function locate(event) {
        const target = event.target instanceof Element ? event.target : event.target.parentElement;
        if (!target || !root.contains(target) || target.closest(controls)) return false;
        const paragraph = target.tagName === 'BR' ? target.parentElement : target;
        if (paragraph !== root && blankParagraph(paragraph)) {
            focusLine(paragraph, event.clientY);
            return true;
        }
        if (target !== root && (!target.matches(flowContainers) || !target.isContentEditable)) return false;
        const display = getComputedStyle(target).display;
        if (display !== 'block' && display !== 'flow-root' && display !== 'list-item' && display !== 'table-cell') return false;
        const bounds = target.getBoundingClientRect();
        const left = bounds.left + target.clientLeft, top = bounds.top + target.clientTop;
        if (event.clientX < left || event.clientX >= left + target.clientWidth ||
            event.clientY < top || event.clientY >= top + target.clientHeight) return false;
        const gap = gapAt(target, event.clientY);
        if (!gap) return false;
        const empty = [gap.previous, gap.next].filter(blankParagraph)
            .sort((a, b) => Math.abs(a.getBoundingClientRect().top - event.clientY) - Math.abs(b.getBoundingClientRect().top - event.clientY))[0];
        const extend = !gap.next;
        if (empty && (!extend || event.clientY < empty.getBoundingClientRect().bottom)) {
            focusLine(empty, event.clientY);
            return true;
        }
        const range = document.createRange();
        if (empty) range.selectNodeContents(empty);
        else if (gap.next) range.setStartBefore(gap.next);
        else range.setStart(target, target.childNodes.length);
        range.collapse(true);
        const token = SoraEditor.capture(range);
        if (!token) return false;
        return SoraEditor.transaction('点击空白输入', token, () => {
            const line = empty || document.createElement('p');
            if (!empty) {
                line.append(document.createElement('br'));
                target.insertBefore(line, gap.next);
            }
            if (extend) fillToLine(line, event.clientY);
            focusLine(line, event.clientY);
        }, { refreshWidgets: false });
    }

    root.addEventListener('pointerdown', event => {
        gesture = null;
        if (!ready() || !event.isPrimary || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now() };
    }, true);
    root.addEventListener('pointermove', event => {
        if (gesture && event.pointerId === gesture.id && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) gesture = null;
    }, { passive: true });
    root.addEventListener('pointercancel', () => { gesture = null; }, { passive: true });
    root.addEventListener('scroll', () => { gesture = null; }, { passive: true, capture: true });
    root.addEventListener('compositionstart', () => { gesture = null; }, true);
    document.addEventListener('sora:document-loaded', () => { gesture = null; });
    root.addEventListener('click', event => {
        const click = gesture; gesture = null;
        if (!click || !ready() || event.defaultPrevented || event.button !== 0 || event.detail !== 1 ||
            event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || performance.now() - click.started > 600 ||
            Math.hypot(event.clientX - click.x, event.clientY - click.y) > 6 || !window.getSelection()?.isCollapsed) return;
        if (locate(event)) event.preventDefault();
    });
})();
