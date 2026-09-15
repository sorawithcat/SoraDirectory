(function() {
    'use strict';

    const ROOT_ID = 'mulu';

    function rows() {
        return (typeof mulufile !== 'undefined' && Array.isArray(mulufile) ? mulufile : []).filter(row => Array.isArray(row) && row.length === 4);
    }

    function escapeText(value) {
        return String(value ?? '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
    }

    function escapeAttribute(value) {
        return escapeText(value).replace(/["']/g, char => char === '"' ? '&quot;' : '&#39;');
    }

    function normalizePath(value) {
        return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
    }

    function resolveRelativePath(basePath, relativePath) {
        const path = normalizePath(basePath);
        const stack = path.includes('/') ? path.slice(0, path.lastIndexOf('/')).split('/').filter(Boolean) : [];
        normalizePath(relativePath).split('/').forEach(part => {
            if (!part || part === '.') return;
            if (part === '..') stack.pop();
            else stack.push(part);
        });
        return stack.join('/');
    }

    function safeStem(value, fallback = '未命名') {
        const source = String(value || '').trim();
        const cleaned = source.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').replace(/^\.+$/g, '').slice(0, 100);
        return !cleaned || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(cleaned) ? fallback : cleaned;
    }

    function stableId(value) {
        let hash = 2166136261;
        for (const char of String(value || 'note')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
        return `kb_${(hash >>> 0).toString(36)}`;
    }

    function uniqueValue(base, used, suffix = '') {
        let value = `${base}${suffix}`;
        let index = 2;
        while (used.has(value.toLocaleLowerCase())) value = `${base}-${index++}${suffix}`;
        used.add(value.toLocaleLowerCase());
        return value;
    }

    function parseFrontMatter(source) {
        const text = String(source || '').replace(/^\uFEFF/, '');
        if (!/^---\r?\n/.test(text)) return { data: {}, body: text };
        const lines = text.split(/\r?\n/);
        const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
        if (end < 0) return { data: {}, body: text };
        const data = {};
        lines.slice(1, end).forEach(line => {
            const separator = line.indexOf(':');
            if (separator < 1) return;
            const key = line.slice(0, separator).trim();
            const raw = line.slice(separator + 1).trim();
            if (!key) return;
            try { data[key] = JSON.parse(raw); }
            catch (_) { data[key] = raw.replace(/^['"]|['"]$/g, ''); }
        });
        return { data, body: lines.slice(end + 1).join('\n') };
    }

    function buildFrontMatter(row, metadata, parentRow) {
        const values = {
            title: row[1] || row[2], sora_id: row[2], sora_parent: parentRow?.[2] || '', sora_parent_title: parentRow?.[1] || '',
            tags: metadata.tags, status: metadata.status, priority: metadata.priority, date: metadata.date, custom: metadata.custom
        };
        const lines = Object.entries(values).filter(([, value]) => value !== '' && value != null && (!Array.isArray(value) || value.length) && (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
        return ['---', ...lines, '---'].join('\n');
    }

    async function walkDirectory(handle, prefix = '', output = new Map()) {
        for await (const [name, entry] of handle.entries()) {
            if (name.startsWith('.')) continue;
            const path = normalizePath(prefix ? `${prefix}/${name}` : name);
            if (entry.kind === 'directory') await walkDirectory(entry, path, output);
            else output.set(path.toLocaleLowerCase(), { path, handle: entry });
        }
        return output;
    }

    function referencedAssetPaths(body) {
        const result = new Set();
        for (const match of String(body || '').matchAll(/!\[([^\]]*)\]\(([^)]+)\)|!\[\[([^\]]+)\]\]/g)) {
            const value = String(match[2] || match[3] || '').split('|')[0].trim().replace(/^<|>$/g, '');
            if (value && !/^(?:https?:|data:|#)/i.test(value)) result.add(value);
        }
        return result;
    }

    function wikiTargets(body) {
        return Array.from(String(body || '').matchAll(/(?<!!)\[\[([^\]]+)\]\]/g), match => match[1].split('|')[0].split('#')[0].trim()).filter(Boolean);
    }

    function findCycles(graph) {
        const cycles = [];
        const state = new Map();
        const stack = [];
        const seen = new Set();
        function visit(node) {
            state.set(node, 1); stack.push(node);
            (graph.get(node) || []).forEach(next => {
                if (!graph.has(next)) return;
                if (!state.has(next)) visit(next);
                else if (state.get(next) === 1) {
                    const cycle = stack.slice(stack.indexOf(next)).concat(next);
                    const key = Array.from(new Set(cycle)).sort().join('|');
                    if (!seen.has(key)) { seen.add(key); cycles.push(cycle); }
                }
            });
            stack.pop(); state.set(node, 2);
        }
        graph.forEach((_, node) => { if (!state.has(node)) visit(node); });
        return cycles;
    }

    function inlineMarkdown(source, context) {
        const tokens = [];
        const hold = html => `\u0000${tokens.push(html) - 1}\u0000`;
        let text = String(source || '');
        text = text.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${escapeText(code)}</code>`));
        text = text.replace(/!\[\[([^\]]+)\]\]/g, (_, raw) => { const [target, alt = ''] = raw.split('|'); return hold(context.asset(target.trim(), alt || target.trim())); });
        text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, target) => hold(context.asset(target.trim().replace(/^<|>$/g, ''), alt)));
        text = text.replace(/\[\[([^\]]+)\]\]/g, (_, raw) => {
            const [targetPart, label] = raw.split('|');
            const [target, anchor = ''] = targetPart.split('#');
            return hold(context.wiki(target.trim(), anchor.trim(), (label || target || anchor).trim()));
        });
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
            const safe = /^(?:https?:|mailto:|#|\.\.?\/)/i.test(href.trim()) ? href.trim() : '#';
            return hold(`<a href="${escapeAttribute(safe)}">${escapeText(label)}</a>`);
        });
        text = escapeText(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>').replace(/(?<!\*)\*([^*]+)\*/g, '<em>$1</em>');
        return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '');
    }

    function markdownToHtml(body, context) {
        const output = [];
        let paragraph = [];
        let listType = '';
        let inCode = false;
        let codeLanguage = '';
        let code = [];
        const flushParagraph = () => { if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.splice(0).join(' '), context)}</p>`); };
        const closeList = () => { if (listType) { output.push(`</${listType}>`); listType = ''; } };
        String(body || '').split(/\r?\n/).forEach(line => {
            const fence = line.match(/^```\s*([\w-]*)\s*$/);
            if (fence) {
                flushParagraph(); closeList();
                if (inCode) { output.push(`<pre><code${codeLanguage ? ` class="language-${escapeAttribute(codeLanguage)}"` : ''}>${escapeText(code.join('\n'))}</code></pre>`); code = []; codeLanguage = ''; inCode = false; }
                else { inCode = true; codeLanguage = fence[1] || ''; }
                return;
            }
            if (inCode) { code.push(line); return; }
            const heading = line.match(/^(#{1,6})\s+(.+)$/);
            if (heading) { flushParagraph(); closeList(); const level = heading[1].length; const label = heading[2].trim(); const id = safeStem(label, 'section').replace(/\s+/g, '-').toLocaleLowerCase(); output.push(`<h${level} id="${escapeAttribute(id)}">${inlineMarkdown(label, context)}</h${level}>`); return; }
            const item = line.match(/^\s*([-*+] |\d+\. )(.+)$/);
            if (item) { flushParagraph(); const nextType = /^\d/.test(item[1]) ? 'ol' : 'ul'; if (listType !== nextType) { closeList(); listType = nextType; output.push(`<${listType}>`); } output.push(`<li>${inlineMarkdown(item[2], context)}</li>`); return; }
            const quote = line.match(/^>\s?(.*)$/);
            if (quote) { flushParagraph(); closeList(); output.push(`<blockquote><p>${inlineMarkdown(quote[1], context)}</p></blockquote>`); return; }
            if (/^\s*---+\s*$/.test(line)) { flushParagraph(); closeList(); output.push('<hr>'); return; }
            if (!line.trim()) { flushParagraph(); closeList(); return; }
            paragraph.push(line.trim());
        });
        if (inCode) output.push(`<pre><code${codeLanguage ? ` class="language-${escapeAttribute(codeLanguage)}"` : ''}>${escapeText(code.join('\n'))}</code></pre>`);
        flushParagraph(); closeList();
        const template = document.createElement('template');
        template.innerHTML = output.join('\n');
        if (typeof sanitizeExportContent === 'function') sanitizeExportContent(template.content);
        return template.innerHTML;
    }

    function nodeToMarkdown(node, context) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName.toLowerCase();
        const children = () => Array.from(node.childNodes).map(child => nodeToMarkdown(child, context)).join('');
        if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
        if (['p', 'div', 'section', 'figure'].includes(tag)) return `${children().trim()}\n\n`;
        if (tag === 'br') return '\n';
        if (tag === 'strong' || tag === 'b') return `**${children()}**`;
        if (tag === 'em' || tag === 'i') return `*${children()}*`;
        if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${children()}\``;
        if (tag === 'pre') return `\`\`\`\n${node.textContent || ''}\n\`\`\`\n\n`;
        if (tag === 'blockquote') return children().trim().split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        if (tag === 'ul' || tag === 'ol') return Array.from(node.children).map((child, index) => `${tag === 'ol' ? `${index + 1}.` : '-'} ${nodeToMarkdown(child, context).trim()}`).join('\n') + '\n\n';
        if (tag === 'li') return children();
        if (tag === 'hr') return '---\n\n';
        if (tag === 'img') return `![${node.getAttribute('alt') || ''}](${context.mediaPath(node.getAttribute('data-media-storage-id') || '', node.getAttribute('src') || '')})`;
        if (tag === 'video' || tag === 'audio') { const target = context.mediaPath(node.getAttribute('data-media-storage-id') || '', node.getAttribute('src') || ''); return target ? `<${tag} controls src="${escapeAttribute(target)}"></${tag}>\n\n` : ''; }
        if (tag === 'a') {
            const label = children().trim() || node.getAttribute('href') || '链接';
            const href = node.getAttribute('href') || '';
            if (node.getAttribute('data-sora-link') === 'method') return label;
            const archive = node.closest('.archive-attachment');
            if (archive) return `[${label}](${context.mediaPath(archive.getAttribute('data-media-storage-id') || '', node.getAttribute('data-export-url') || href)})`;
            if (node.getAttribute('data-dir-id') || node.getAttribute('data-dir-name') || href.toLowerCase().startsWith('sora-dir:')) {
                const targetId = node.getAttribute('data-dir-id') || href.slice('sora-dir:'.length).split('#')[0];
                const anchor = node.getAttribute('data-anchor-id') || href.split('#')[1] || '';
                const targetName = context.directoryName(targetId) || node.getAttribute('data-dir-name') || targetId;
                return `[[${targetName}${anchor ? `#${anchor}` : ''}|${label}]]`;
            }
            return `[${label}](${href || '#'})`;
        }
        if (tag === 'table') return `${node.outerHTML}\n\n`;
        return children();
    }

    function mimeExtension(mimeType) {
        return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'application/pdf': 'pdf', 'application/zip': 'zip' })[String(mimeType || '').toLowerCase()] || 'bin';
    }

    async function buildExportPlan(directoryHandle) {
        if (typeof syncPreviewToTextarea === 'function') syncPreviewToTextarea();
        const sourceRows = rows();
        const rowById = new Map(sourceRows.map(row => [String(row[2]), row]));
        const nameById = new Map(sourceRows.map(row => [String(row[2]), String(row[1] || row[2])]));
        const existingPaths = await walkDirectory(directoryHandle);
        const usedNames = new Set(Array.from(existingPaths.keys()).filter(path => !path.includes('/')));
        const usedAssetNames = new Set(Array.from(existingPaths.keys()).filter(path => path.startsWith('_assets/') && !path.slice(8).includes('/')).map(path => path.slice(8)));
        const warnings = [];
        const entries = sourceRows.map(row => {
            const requestedStem = String(row[1] || row[2]);
            const stem = safeStem(requestedStem);
            if (stem !== requestedStem) warnings.push(`非法或不兼容文件名已映射：${requestedStem} → ${stem}`);
            const fileName = uniqueValue(stem, usedNames, '.md');
            if (fileName !== `${stem}.md`) warnings.push(`目标中存在同名文件，已避让：${stem}.md → ${fileName}`);
            return { row, fileName, content: '' };
        });
        const media = new Map();
        for (const entry of entries) {
            const root = document.createElement('div');
            root.innerHTML = String(entry.row[3] || '');
            if (window.SoraReusableBlocks) window.SoraReusableBlocks.expandTemplate(root, sourceRows);
            if (typeof sanitizeExportContent === 'function') sanitizeExportContent(root);
            for (const element of root.querySelectorAll('[data-media-storage-id]')) {
                const id = element.getAttribute('data-media-storage-id');
                if (!id || media.has(id) || !window.MediaStorage) continue;
                const info = await MediaStorage.getMediaInfo(id);
                if (!info) { warnings.push(`媒体缺失：${id}`); continue; }
                const label = element.getAttribute('data-file-name') || element.getAttribute('alt') || id;
                const stem = safeStem(String(label).replace(/\.[^.]+$/, ''), id);
                const ext = String(label).match(/\.([a-zA-Z0-9]{1,8})$/)?.[1] || mimeExtension(info.mimeType);
                const assetName = uniqueValue(stem, usedAssetNames, `.${ext.toLowerCase()}`);
                if (assetName !== `${stem}.${ext.toLowerCase()}`) warnings.push(`资源目录中存在同名文件，已避让：${stem}.${ext.toLowerCase()} → ${assetName}`);
                media.set(id, { id, name: assetName, info });
            }
            const markdown = Array.from(root.childNodes).map(node => nodeToMarkdown(node, { directoryName: id => nameById.get(String(id || '')) || '', mediaPath: (id, fallback) => media.has(id) ? `_assets/${media.get(id).name}` : fallback })).join('').replace(/\n{3,}/g, '\n\n').trim();
            const metadata = window.DirectoryMetadata ? DirectoryMetadata.get(entry.row[2]) : { tags: [], status: '', priority: '', date: '', custom: {} };
            entry.content = `${buildFrontMatter(entry.row, metadata, rowById.get(String(entry.row[0])) || null)}\n\n${markdown}\n`;
        }
        const graph = new Map(sourceRows.map(row => [String(row[2]), []]));
        sourceRows.forEach(row => {
            const template = document.createElement('template'); template.innerHTML = String(row[3] || '');
            template.content.querySelectorAll('a[data-sora-link="dir"],a[href^="sora-dir:"]').forEach(link => { const target = link.getAttribute('data-dir-id') || (link.getAttribute('href') || '').slice('sora-dir:'.length).split('#')[0]; if (target) graph.get(String(row[2])).push(String(target)); });
        });
        const cycles = findCycles(graph);
        cycles.forEach(cycle => warnings.push(`循环链接（允许导出）：${cycle.map(id => nameById.get(id) || id).join(' → ')}`));
        if (sourceRows.some(row => /data-sora-link=["']method/i.test(String(row[3] || '')))) warnings.push('方法链接在 Markdown 中导出为普通文字；运行逻辑仅保留在网页导出中。');
        return { entries, media: Array.from(media.values()), warnings, cycles };
    }

    async function writeFile(directory, name, content) {
        const handle = await directory.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        try { await writable.write(content); await writable.close(); }
        catch (error) { if (typeof writable.abort === 'function') await writable.abort(); throw error; }
    }

    async function applyExportPlan(directoryHandle, plan) {
        for (const entry of plan.entries) await writeFile(directoryHandle, entry.fileName, entry.content);
        if (plan.media.length) {
            const assets = await directoryHandle.getDirectoryHandle('_assets', { create: true });
            for (const asset of plan.media) { const blob = await MediaStorage.getChunkedBlob(asset.id); if (blob) await writeFile(assets, asset.name, blob); }
        }
    }

    async function buildImportPlan(directoryHandle) {
        const files = await walkDirectory(directoryHandle);
        const notes = [];
        const warnings = [];
        for (const item of files.values()) {
            if (!item.path.toLowerCase().endsWith('.md')) continue;
            const parsed = parseFrontMatter(await (await item.handle.getFile()).text());
            const baseName = item.path.split('/').pop().replace(/\.md$/i, '');
            notes.push({ path: item.path, title: String(parsed.data.title || baseName).trim() || baseName, frontMatter: parsed.data, body: parsed.body, requestedId: String(parsed.data.sora_id || parsed.data.id || stableId(item.path)) });
        }
        const usedIds = new Set();
        notes.forEach(note => { const base = /^[A-Za-z0-9_-]{1,100}$/.test(note.requestedId) ? note.requestedId : stableId(note.path); note.id = uniqueValue(base, usedIds); if (note.id !== note.requestedId) warnings.push(`目录 ID 已避让或净化：${note.requestedId} → ${note.id}`); });
        const byId = new Map(notes.map(note => [note.requestedId, note]));
        const byName = new Map();
        notes.forEach(note => [note.title, note.path.replace(/\.md$/i, ''), note.path.split('/').pop().replace(/\.md$/i, '')].forEach(key => { const normalized = String(key).toLocaleLowerCase(); if (!byName.has(normalized)) byName.set(normalized, note); else if (byName.get(normalized) !== note) warnings.push(`链接名称不唯一：${key}`); }));
        const resolveNote = value => byId.get(String(value || '')) || byName.get(String(value || '').replace(/\.md$/i, '').toLocaleLowerCase()) || null;
        notes.forEach(note => { const parentRef = note.frontMatter.sora_parent || note.frontMatter.parent || ''; const parent = resolveNote(parentRef); note.parentId = parent && parent !== note ? parent.id : ROOT_ID; if (parentRef && !parent) warnings.push(`父目录不存在，已转为根目录：${note.title} → ${parentRef}`); });
        const parentCycles = findCycles(new Map(notes.map(note => [note.id, note.parentId === ROOT_ID ? [] : [note.parentId]])));
        const cyclicIds = new Set(parentCycles.flat());
        notes.forEach(note => { if (cyclicIds.has(note.id)) note.parentId = ROOT_ID; });
        parentCycles.forEach(cycle => warnings.push(`父目录循环已断开并转为根目录：${cycle.join(' → ')}`));
        const linkCycles = findCycles(new Map(notes.map(note => [note.id, wikiTargets(note.body).map(target => resolveNote(target)?.id).filter(Boolean)])));
        linkCycles.forEach(cycle => warnings.push(`循环链接（允许导入）：${cycle.map(id => notes.find(note => note.id === id)?.title || id).join(' → ')}`));
        const assets = new Map();
        notes.forEach(note => referencedAssetPaths(note.body).forEach(assetPath => { const resolved = resolveRelativePath(note.path, assetPath); const item = files.get(resolved.toLocaleLowerCase()); if (item) assets.set(resolved.toLocaleLowerCase(), item); else warnings.push(`资源不存在：${note.path} → ${assetPath}`); }));
        if (!notes.length) warnings.push('所选文件夹中没有 Markdown 文件。');
        return { notes, assets, warnings, linkCycles, resolveNote };
    }

    function mediaType(file) {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        return 'archive';
    }

    async function applyImportPlan(plan, mode) {
        const mediaByPath = new Map();
        for (const [path, asset] of plan.assets) { const file = await asset.handle.getFile(); const type = mediaType(file); mediaByPath.set(path, { id: await MediaStorage.save(file, type), type, name: file.name }); }
        const usedIds = new Set(mode === 'merge' ? rows().map(row => String(row[2]).toLocaleLowerCase()) : []);
        const idMap = new Map();
        plan.notes.forEach(note => idMap.set(note.id, uniqueValue(note.id, usedIds)));
        const importedRows = [];
        const importedMetadata = {};
        plan.notes.forEach(note => {
            const id = idMap.get(note.id);
            const context = {
                wiki(target, anchor, label) { const resolved = plan.resolveNote(target); if (!resolved) return `<span data-sora-missing-link="${escapeAttribute(target)}">${escapeText(label)}</span>`; const targetId = idMap.get(resolved.id) || resolved.id; return `<a href="sora-dir:${escapeAttribute(targetId)}${anchor ? `#${escapeAttribute(anchor)}` : ''}" data-sora-link="dir" data-dir-id="${escapeAttribute(targetId)}"${anchor ? ` data-anchor-id="${escapeAttribute(anchor)}"` : ''}>${escapeText(label)}</a>`; },
                asset(target, alt) { const media = mediaByPath.get(resolveRelativePath(note.path, target).toLocaleLowerCase()); if (!media) return `<span data-media-missing="true">${escapeText(alt || target)}（资源缺失）</span>`; if (media.type === 'image') return `<img data-media-storage-id="${escapeAttribute(media.id)}" data-file-name="${escapeAttribute(media.name)}" alt="${escapeAttribute(alt || media.name)}">`; if (media.type === 'video' || media.type === 'audio') return `<${media.type} controls data-media-storage-id="${escapeAttribute(media.id)}" data-file-name="${escapeAttribute(media.name)}"></${media.type}>`; return `<div class="archive-attachment" data-media-storage-id="${escapeAttribute(media.id)}" data-file-name="${escapeAttribute(media.name)}"><span>${escapeText(media.name)}</span></div>`; }
            };
            importedRows.push([note.parentId === ROOT_ID ? ROOT_ID : (idMap.get(note.parentId) || ROOT_ID), note.title, id, markdownToHtml(note.body, context)]);
            importedMetadata[id] = { tags: Array.isArray(note.frontMatter.tags) ? note.frontMatter.tags : String(note.frontMatter.tags || '').split(',').filter(Boolean), status: note.frontMatter.status || '', priority: note.frontMatter.priority || '', date: note.frontMatter.date || '', custom: note.frontMatter.custom && typeof note.frontMatter.custom === 'object' ? note.frontMatter.custom : {} };
        });
        const depth = row => { let value = 0; let parent = row[0]; const seen = new Set(); while (parent !== ROOT_ID && !seen.has(parent) && value < importedRows.length) { seen.add(parent); value++; parent = importedRows.find(item => item[2] === parent)?.[0] || ROOT_ID; } return value; };
        importedRows.sort((a, b) => depth(a) - depth(b));
        if (window.DirectoryHistory && rows().length) DirectoryHistory.record('导入 Markdown 文件夹');
        mulufile = mode === 'merge' ? rows().concat(importedRows) : importedRows;
        rebuildMulufileIndex();
        if (window.DirectoryMetadata) DirectoryMetadata.load(importedMetadata, { merge: mode === 'merge' });
        currentMuluName = null;
        if (typeof currentFileHandle !== 'undefined') currentFileHandle = null;
        if (typeof currentFileName !== 'undefined' && mode !== 'merge') currentFileName = 'Markdown 知识库';
        if (fileNameInput && mode !== 'merge') fileNameInput.value = 'Markdown 知识库';
        if (window.SoraDocumentIdentity && mode !== 'merge') SoraDocumentIdentity.newDocument('Markdown 知识库');
        LoadMulu();
        if (typeof markUnsavedChanges === 'function') markUnsavedChanges();
        if (importedRows.length && window.DirectoryNavigation) DirectoryNavigation.open(importedRows[0][2], { viewMode: 'top' });
    }

    function reportView(kind, summary, warnings, apply) {
        const wrapper = document.createElement('div'); wrapper.className = 'knowledge-base-report';
        const intro = document.createElement('p'); intro.textContent = summary;
        const list = document.createElement('div'); list.className = 'knowledge-base-warnings';
        list.innerHTML = warnings.length ? warnings.map(item => `<div class="knowledge-base-warning">${escapeText(item)}</div>`).join('') : '<div class="knowledge-base-ok">未发现写入冲突或循环问题。</div>';
        const actions = document.createElement('div'); actions.className = 'method-workbench-actions';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消'; cancel.onclick = () => FeatureDialog.close();
        const confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = 'primary'; confirm.textContent = kind === 'export' ? '开始写入' : '应用导入';
        confirm.onclick = async () => { confirm.disabled = true; try { await apply(); FeatureDialog.close(); showToast(kind === 'export' ? 'Markdown 文件夹导出完成' : 'Markdown 文件夹导入完成', 'success', 2600); } catch (error) { confirm.disabled = false; showToast(`${kind === 'export' ? '导出' : '导入'}失败：${error.message || error}`, 'error', 4000); } };
        actions.append(cancel, confirm); wrapper.append(intro, list, actions); FeatureDialog.open(kind === 'export' ? 'Markdown 导出预检' : 'Markdown 导入预检', wrapper); return wrapper;
    }

    async function exportFolder() {
        if (typeof window.showDirectoryPicker !== 'function') { showToast('当前浏览器不支持文件夹写入', 'warning', 2600); return; }
        let handle;
        try { handle = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch (error) { if (error.name !== 'AbortError') showToast(`无法打开文件夹：${error.message}`, 'error', 3000); return; }
        const plan = await buildExportPlan(handle);
        reportView('export', `将写入 ${plan.entries.length} 个 Markdown 文件和 ${plan.media.length} 个资源；不会覆盖已有同名文件。`, plan.warnings, () => applyExportPlan(handle, plan));
    }

    async function importFolder() {
        if (typeof window.showDirectoryPicker !== 'function') { showToast('当前浏览器不支持文件夹读取', 'warning', 2600); return; }
        let handle;
        try { handle = await window.showDirectoryPicker({ mode: 'read' }); } catch (error) { if (error.name !== 'AbortError') showToast(`无法打开文件夹：${error.message}`, 'error', 3000); return; }
        const plan = await buildImportPlan(handle);
        const mode = document.createElement('select'); mode.innerHTML = '<option value="merge">追加到当前文档</option><option value="replace">替换当前文档</option>';
        const wrapper = reportView('import', `发现 ${plan.notes.length} 个 Markdown 文件和 ${plan.assets.size} 个可用资源。`, ['导入方式将在确认时应用；替换模式不会删除本地媒体。', ...plan.warnings], () => applyImportPlan(plan, mode.value));
        const label = document.createElement('label'); label.className = 'knowledge-base-mode'; label.append(document.createTextNode('导入方式'), mode); wrapper.insertBefore(label, wrapper.querySelector('.method-workbench-actions'));
    }

    function open() {
        const wrapper = document.createElement('div'); wrapper.className = 'knowledge-base-report'; wrapper.innerHTML = '<p>与 Markdown 文件夹和 Obsidian 知识库互操作。导入/导出都会先预检，方法运行逻辑不会写入 Markdown。</p>';
        const actions = document.createElement('div'); actions.className = 'knowledge-base-launcher';
        const importButton = document.createElement('button'); importButton.type = 'button'; importButton.textContent = '导入 Markdown 文件夹'; importButton.onclick = importFolder;
        const exportButton = document.createElement('button'); exportButton.type = 'button'; exportButton.textContent = '导出 Markdown 文件夹'; exportButton.disabled = !rows().length; exportButton.onclick = exportFolder;
        actions.append(importButton, exportButton); wrapper.appendChild(actions); FeatureDialog.open('Markdown / Obsidian 互操作', wrapper);
    }

    window.SoraKnowledgeBaseInterop = { safeStem, parseFrontMatter, referencedAssetPaths, wikiTargets, findCycles, markdownToHtml, buildImportPlan, buildExportPlan, open };
    window.SoraFeatureCommands = window.SoraFeatureCommands || [];
    window.SoraFeatureCommands.push({ key: 'knowledge-base-interop', title: 'Markdown / Obsidian 互操作', icon: 'M', meta: '文件夹、Front Matter、双链与资源目录', keywords: 'Markdown Obsidian 知识库 front matter 文件夹 导入 导出', run: open });
})();
