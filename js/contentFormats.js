(function() {
    'use strict';
    const styles = `
    :is(.markdown-preview,.content-body) .sora-callout { margin:1em 0; padding:14px 16px; border:1px solid #94a3b8; border-radius:8px; background:#f1f5f9; color:#172033; }
    :is(.markdown-preview,.content-body) .sora-callout[data-callout="warning"] { background:#fff7ed; border-color:#c2410c; }
    :is(.markdown-preview,.content-body) .sora-callout[data-callout="danger"] { background:#fff1f2; border-color:#be123c; }
    :is(.markdown-preview,.content-body) .sora-callout[data-callout="success"] { background:#f0fdf4; border-color:#15803d; }
    :is(.markdown-preview,.content-body) .sora-callout-title { font-weight:700; margin:0 0 8px; }
    :is(.markdown-preview,.content-body) .sora-callout-kind { font-weight:600; margin:0 0 6px; }
    :is(.markdown-preview,.content-body) .sora-callout-body > :last-child { margin-bottom:0; }
    :is(.markdown-preview,.content-body) details[data-sora-details] { margin:1em 0; padding:12px 16px; border:1px solid #94a3b8; border-radius:8px; }
    :is(.markdown-preview,.content-body) details[data-sora-details] > summary { cursor:pointer; font-weight:600; min-height:28px; overflow-wrap:anywhere; }
    :is(.markdown-preview,.content-body) .sora-details-body { padding-top:10px; }
    :is(.markdown-preview,.content-body) kbd { font:inherit; font-size:.9em; padding:.1em .35em; border:1px solid #94a3b8; border-radius:4px; background:#f8fafc; color:#172033; }
    :is(.markdown-preview,.content-body) dl.sora-definitions { margin:1em 0; }
    :is(.markdown-preview,.content-body) dl.sora-definitions dt { font-weight:700; margin-top:12px; }
    :is(.markdown-preview,.content-body) dl.sora-definitions dd { margin:6px 0 12px 1.5em; }
    :is(.markdown-preview,.content-body) .sora-footnotes { border-top:1px solid #94a3b8; margin-top:2em; padding-top:12px; font-size:.9em; }
    :is(.markdown-preview,.content-body) .sora-footnotes li { margin-block:8px; }
    :is(.markdown-preview,.content-body) [data-footnote-ref] { white-space:nowrap; }
    :is(.markdown-preview,.content-body) [data-footnote-backlink] { display:inline-block; margin-inline-start:8px; }
    :is(.markdown-preview,.content-body) .sora-footnote-body { display:inline; }
    :is(.markdown-preview,.content-body) .sora-callout-title:empty::before { content:'标题'; color:#64748b; }
    :is(.markdown-preview,.content-body) .sora-manual { max-width:74ch; margin-inline:auto; color:#243247; font-size:15px; line-height:1.8; white-space:normal; overflow-wrap:anywhere; }
    :is(.markdown-preview,.content-body) .sora-manual h1 { margin:0 0 12px; padding:0; border:0; color:#142237; font-size:28px; line-height:1.35; font-weight:700; }
    :is(.markdown-preview,.content-body) .sora-manual h2 { margin:0 0 16px; padding:0; border:0; color:#142237; font-size:21px; line-height:1.45; font-weight:650; }
    :is(.markdown-preview,.content-body) .sora-manual h3 { margin:24px 0 10px; color:#243247; font-size:17px; line-height:1.5; }
    :is(.markdown-preview,.content-body) .sora-manual p { margin:10px 0; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-manual-lead { margin:0 0 28px; color:#536278; font-size:16px; line-height:1.8; }
    :is(.markdown-preview,.content-body) .sora-manual-section { margin-top:36px; }
    :is(.markdown-preview,.content-body) .sora-manual :is(ul,ol) { margin:12px 0; padding-inline-start:1.6em; }
    :is(.markdown-preview,.content-body) .sora-manual li { margin:8px 0; padding-inline-start:4px; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-manual-steps > li { padding-inline-start:8px; margin:0 0 20px; }
    :is(.markdown-preview,.content-body) .sora-manual-steps > li::marker { color:#536278; font-weight:600; font-variant-numeric:tabular-nums; }
    :is(.markdown-preview,.content-body) .sora-manual-steps > li > p { margin:4px 0; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-manual-entry { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin:0 0 20px; color:#536278; font-size:14px; }
    :is(.markdown-preview,.content-body) .sora-manual-entry > strong { color:#536278; font-weight:500; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-manual-result { margin:20px 0 0; padding-top:12px; border-top:1px solid #e2e8f0; }
    :is(.markdown-preview,.content-body) .sora-manual-table { max-width:100%; margin:16px 0; overflow-x:auto; border:1px solid #dbe2ea; border-radius:6px; }
    :is(.markdown-preview,.content-body) .sora-manual table { display:table; width:100%; margin:0; border:0; border-collapse:collapse; font-size:14px; line-height:1.7; }
    :is(.markdown-preview,.content-body) .sora-manual :is(th,td) { padding:11px 12px; border:0; border-bottom:1px solid #e2e8f0; text-align:left; vertical-align:top; }
    :is(.markdown-preview,.content-body) .sora-manual th { color:#334155; background:#f3f6f9; font-weight:600; }
    :is(.markdown-preview,.content-body) .sora-manual tbody tr:last-child > td { border-bottom:0; }
    :is(.markdown-preview,.content-body) .sora-manual :is(th,td):first-child { min-width:7em; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-callout { margin:20px 0; padding:14px 16px; border-radius:6px; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-callout-kind { display:none; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-callout-title { margin:0 0 6px; font-size:15px; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-callout-body > p { margin:0; }
    :is(.markdown-preview,.content-body) .sora-manual details[data-sora-details] { margin:14px 0; padding:0; border:1px solid #dbe2ea; border-radius:6px; background:transparent; }
    :is(.markdown-preview,.content-body) .sora-manual details[data-sora-details] > summary { padding:12px 16px; min-height:44px; box-sizing:border-box; color:#334155; font-size:15px; line-height:1.6; font-weight:600; }
    :is(.markdown-preview,.content-body) .sora-manual details[data-sora-details] > summary:hover { background:#f5f7fa; }
    :is(.markdown-preview,.content-body) .sora-manual details[data-sora-details][open] > summary { border-bottom:1px solid #e2e8f0; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-details-body { padding:8px 16px 14px; }
    :is(.markdown-preview,.content-body) .sora-manual .sora-details-body > :first-child { margin-top:8px; }
    :is(.markdown-preview,.content-body) .sora-manual blockquote { margin:20px 0; padding:4px 0 4px 20px; border:0; border-inline-start:1px solid #94a3b8; background:none; color:#536278; }
    :is(.markdown-preview,.content-body) .sora-manual :is(kbd,code) { font-size:.9em; overflow-wrap:anywhere; }
    :is(.markdown-preview,.content-body) .sora-manual kbd { display:inline; white-space:nowrap; padding:.12em .35em; border-color:#c2ccd8; background:#f8fafc; }
    :is(.markdown-preview,.content-body) .sora-manual a { text-underline-offset:.2em; }
    :is(.markdown-preview,.content-body) .sora-manual pre { white-space:pre; overflow:auto; }
    :is(.markdown-preview,.content-body) .sora-manual .task-list { padding-inline-start:0; list-style:none; }
    :is(.markdown-preview,.content-body) .sora-manual :is(a,summary,[tabindex]):focus-visible { outline:2px solid #2563eb; outline-offset:3px; }
    @media(max-width:640px) {
        :is(.markdown-preview,.content-body) .sora-manual { font-size:15px; }
        :is(.markdown-preview,.content-body) .sora-manual h1 { font-size:24px; }
        :is(.markdown-preview,.content-body) .sora-manual h2 { font-size:20px; }
        :is(.markdown-preview,.content-body) .sora-manual :is(th,td) { padding:9px 10px; }
    }
    `;
    function id() { return `fn_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36) + Math.random().toString(36).slice(2)}`; }
    function normalizeFootnotes(container) {
        const entries = Array.from(container.querySelectorAll('li[data-footnote-id]'));
        const notes = new Map(), queues = new Map(), retained = new Set();
        entries.forEach(node => {
            const target = node.dataset.footnoteId;
            if (!notes.has(target)) notes.set(target, node);
            if (!queues.has(target)) queues.set(target, []);
            queues.get(target).push(node);
        });
        const used = new Set();
        const previousByList = new Map();
        let number = 0;
        container.querySelectorAll('sup[data-footnote-ref]').forEach(ref => {
            let target = ref.dataset.footnoteRef, note = queues.get(target)?.shift() || notes.get(target);
            if (!note) {
                const link = ref.querySelector('a') || document.createElement('a');
                link.href = `#sora-${target}`; link.textContent = '[注释缺失]'; ref.replaceChildren(link); return;
            }
            if (used.has(target)) {
                if (retained.has(note)) { const copy = note.cloneNode(true); note.after(copy); note = copy; }
                target = id(); note.dataset.footnoteId = target; ref.dataset.footnoteRef = target;
            }
            retained.add(note);
            ref.setAttribute('contenteditable', 'false');
            used.add(target); number++;
            note.id = `sora-${target}`;
            const link = ref.querySelector('a') || document.createElement('a');
            link.id = `sora-ref-${target}`; link.href = `#sora-${target}`; link.textContent = `[${number}]`;
            link.setAttribute('aria-label', `注释 ${number}`);
            ref.replaceChildren(link);
            note.value = number;
            const back = note.querySelector('[data-footnote-backlink]') || document.createElement('a');
            back.dataset.footnoteBacklink = ''; back.href = `#sora-ref-${target}`; back.textContent = '返回正文';
            back.setAttribute('contenteditable', 'false');
            if (!back.parentNode) note.append(back);
            const list = note.parentNode, previous = previousByList.get(list);
            if (previous ? previous.nextElementSibling !== note : list.firstElementChild !== note) {
                if (previous) previous.after(note);
                else list.prepend(note);
            }
            previousByList.set(list, note);
        });
        entries.forEach(note => { if (!retained.has(note)) note.remove(); });
        container.querySelectorAll('[data-sora-footnotes]').forEach(section => { if (!section.querySelector('li[data-footnote-id]')) section.remove(); });
    }
    function forStorage(container) {
        container.querySelectorAll('[data-sora-caret]').forEach(node => {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) walker.currentNode.textContent = walker.currentNode.textContent.replace(/\u200B/g, '');
            node.replaceWith(...node.childNodes);
        });
        container.querySelectorAll('details[data-sora-details]').forEach(node => node.toggleAttribute('open', node.dataset.defaultOpen === 'true'));
        container.querySelectorAll('pre').forEach(pre => {
            pre.querySelectorAll('.code-lang-label,.copy-code-btn').forEach(node => node.remove());
            const code = pre.querySelector('code');
            if (code) code.textContent = code.textContent;
        });
    }
    function normalizeCallouts(container) {
        const labels = { info: '提示', warning: '注意', danger: '警告', success: '成功' };
        container.querySelectorAll('.sora-callout').forEach(node => {
            let label = node.querySelector(':scope > .sora-callout-kind');
            if (!label) { label = document.createElement('p'); label.className = 'sora-callout-kind'; node.prepend(label); }
            label.textContent = labels[node.dataset.callout] || '提示';
            label.setAttribute('contenteditable', 'false');
        });
    }
    window.SoraContentFormats = { styles, id, normalizeFootnotes, normalizeCallouts, forStorage };
    const style = document.createElement('style'); style.id = 'soraContentFormatStyles'; style.textContent = styles; document.head.append(style);
})();
