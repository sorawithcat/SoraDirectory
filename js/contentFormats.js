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
