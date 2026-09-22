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
        for (const match of String(body || '').matchAll(/<(?:img|video|audio)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
            if (!/^(?:https?:|data:|blob:|#)/i.test(match[1])) result.add(match[1]);
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

    function importedHtml(source, context) {
        const template = document.createElement('template'); template.innerHTML = source;
        template.content.querySelectorAll('img[src],video[src],audio[src]').forEach(media => {
            if (/^(?:https?:|data:)/i.test(media.getAttribute('src') || '')) return;
            const replacement = document.createElement('template');
            replacement.innerHTML = context.asset(media.getAttribute('src'), media.getAttribute('alt') || '');
            const next = replacement.content.firstElementChild;
            if (next && next.matches('img,video,audio')) {
                ['style', 'width', 'height', 'title'].forEach(name => { if (media.hasAttribute(name)) next.setAttribute(name, media.getAttribute(name)); });
            }
            media.replaceWith(replacement.content);
        });
        template.content.querySelectorAll('a[data-dir-id]').forEach(link => {
            if (!context.directoryId) return;
            const target = context.directoryId(link.dataset.dirId);
            link.dataset.dirId = target;
            link.href = `sora-dir:${target}${link.dataset.anchorId ? '#' + link.dataset.anchorId : ''}`;
        });
        if (typeof sanitizeExportContent === 'function') sanitizeExportContent(template.content);
        return template.innerHTML;
    }

    function inlineMarkdown(source, context) {
        const tokens = [];
        const hold = html => `\u0000${tokens.push(html) - 1}\u0000`;
        let text = String(source || '');
        text = text.replace(/(`+)([\s\S]*?)\1(?!`)/g, (_, ticks, code) => hold(`<code>${escapeText(code.startsWith(' ') && code.endsWith(' ') && code.trim() ? code.slice(1, -1) : code)}</code>`));
        text = text.replace(/\\([\\`*_\[\]|])/g, (_, char) => hold(escapeText(char)));
        text = text.replace(/<br\s*\/?>/gi, () => hold('<br>'));
        const inlineTag = /<(span|kbd|mark|spoiler|sup|sub|u|s|del|a)\b[^>]*>/gi;
        let found;
        while ((found = inlineTag.exec(text))) {
            const tags = new RegExp('<(\\/?)' + found[1] + '\\b[^>]*>', 'gi');
            tags.lastIndex = found.index;
            let depth = 0, end = -1, tag;
            while ((tag = tags.exec(text))) { depth += tag[1] ? -1 : 1; if (!depth) { end = tags.lastIndex; break; } }
            if (end < 0) continue;
            const token = hold(importedHtml(text.slice(found.index, end), context));
            text = text.slice(0, found.index) + token + text.slice(end); inlineTag.lastIndex = found.index + token.length;
        }
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
        text = escapeText(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>').replace(/(?<!\*)\*([^*]+)\*/g, '<em>$1</em>').replace(/~~([^~]+)~~/g, '<s>$1</s>');
        for (let pass = 0; pass < 3; pass++) text = text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '');
        return text;
    }

    function markdownToHtml(body, context) {
        const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
        const output = [];
        const cellValues = line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(value => value.trim().replace(/\\\|/g, '|'));
        let index = 0;
        function renderList(indent) {
            let type = '', html = '';
            while (index < lines.length) {
                const match = lines[index].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
                if (!match || match[1].length < indent) break;
                if (match[1].length > indent) break;
                const next = /\d/.test(match[2]) ? 'ol' : 'ul';
                if (type && next !== type) break;
                type = next; index++;
                const task = match[3].match(/^\[([ xX])\]\s*(.*)$/);
                let content = inlineMarkdown(task ? task[2] : match[3], context);
                while (index < lines.length) {
                    const nested = lines[index].match(/^(\s*)([-*+]|\d+\.)\s+/);
                    if (nested && nested[1].length > indent) content += renderList(nested[1].length);
                    else break;
                }
                html += task ? `<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" aria-label="任务完成状态"${task[1].toLowerCase() === 'x' ? ' checked' : ''}> ${content}</li>` : `<li>${content}</li>`;
            }
            return `<${type || 'ul'}${html.includes('task-list-item-checkbox') ? ' class="contains-task-list"' : ''}>${html}</${type || 'ul'}>`;
        }
        while (index < lines.length) {
            const line = lines[index];
            if (!line.trim()) { index++; continue; }
            const fence = line.match(/^\s*(`{3,}|~{3,})([\w-]*)\s*$/);
            if (fence) {
                const code = []; index++;
                const closing = new RegExp('^\\s*' + fence[1][0] + '{' + fence[1].length + ',}\\s*$');
                while (index < lines.length && !closing.test(lines[index])) code.push(lines[index++]);
                if (index < lines.length) index++;
                output.push(`<pre data-lang="${escapeAttribute(fence[2] || 'code')}"><code${fence[2] ? ` class="language-${escapeAttribute(fence[2])}"` : ''}>${escapeText(code.join('\n'))}</code></pre>`); continue;
            }
            const htmlBlock = line.match(/^\s*<(table|details|aside|dl|section|figure|div|p|pre|blockquote|h[1-6]|video|audio)\b/i);
            if (htmlBlock) {
                const tag = htmlBlock[1].toLowerCase(), chunk = [];
                let depth = 0, cursor = index;
                for (; cursor < lines.length; cursor++) {
                    chunk.push(lines[cursor]);
                    for (const match of lines[cursor].matchAll(new RegExp('<(\\/?)' + tag + '\\b[^>]*>', 'gi'))) depth += match[1] ? -1 : 1;
                    if (depth <= 0) break;
                }
                if (depth <= 0) { output.push(importedHtml(chunk.join('\n'), context)); index = cursor + 1; continue; }
            }
            if (index + 1 < lines.length && line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) {
                const headers = cellValues(line), separators = cellValues(lines[index + 1]);
                const alignments = separators.map(value => value.startsWith(':') && value.endsWith(':') ? 'center' : value.endsWith(':') ? 'right' : 'left');
                const cell = (value, column, tag) => `<${tag}${tag === 'th' ? ' scope="col"' : ''} style="text-align:${alignments[column] || 'left'}">${inlineMarkdown(value, context)}</${tag}>`;
                const rows = []; index += 2;
                while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
                    const values = cellValues(lines[index++]); rows.push('<tr>' + headers.map((_, column) => cell(values[column] || '', column, 'td')).join('') + '</tr>');
                }
                output.push('<table><thead><tr>' + headers.map((value, column) => cell(value, column, 'th')).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>'); continue;
            }
            const heading = line.match(/^(#{1,6})\s+(.+)$/);
            if (heading) { const level = heading[1].length; output.push(`<h${level}>${inlineMarkdown(heading[2], context)}</h${level}>`); index++; continue; }
            const item = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
            if (item) { output.push(renderList(item[1].length)); continue; }
            if (/^>/.test(line)) { const quoted = []; while (index < lines.length && /^>/.test(lines[index])) quoted.push(lines[index++].replace(/^>\s?/, '')); output.push(`<blockquote>${markdownToHtml(quoted.join('\n'), context)}</blockquote>`); continue; }
            if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) { output.push('<hr>'); index++; continue; }
            const paragraph = [line.trim()]; index++;
            while (index < lines.length && lines[index].trim() && !/^(?:#{1,6}\s|>|\s*(?:[-*+] |\d+\. )|\s*[`~]{3}|\s*<(?:table|details|aside|dl|section|figure|div|p|pre|blockquote|h[1-6]|video|audio)\b)/.test(lines[index]) && !(index + 1 < lines.length && /\|/.test(lines[index]) && /---/.test(lines[index + 1]))) paragraph.push(lines[index++].trim());
            output.push(`<p>${inlineMarkdown(paragraph.join('\n'), context).replace(/ {2}\n/g, '<br>')}</p>`);
        }
        const template = document.createElement('template'); template.innerHTML = output.join('\n');
        if (typeof sanitizeExportContent === 'function') sanitizeExportContent(template.content);
        return template.innerHTML;
    }

    function htmlForMarkdown(node, context) {
        const copy = node.cloneNode(true);
        copy.querySelectorAll('[data-media-storage-id]').forEach(media => {
            const target = context.mediaPath(media.getAttribute('data-media-storage-id'), media.getAttribute('src') || '');
            if (media.matches('img,video,audio')) media.setAttribute('src', target);
        });
        copy.querySelectorAll('a[data-sora-link="method"]').forEach(link => link.replaceWith(document.createTextNode(link.textContent)));
        window.SoraContentFormats?.forStorage(copy);
        return copy.outerHTML;
    }

    function nodeToMarkdown(node, context) {
        if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/([\\`*_[\]])/g, '\\$1');
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName.toLowerCase();
        const children = () => Array.from(node.childNodes).map(child => nodeToMarkdown(child, context)).join('');
        const rich = node.matches('[data-footnote-ref],[data-sora-footnotes],details[data-sora-details],.sora-callout,dl.sora-definitions,kbd,mark,spoiler,sup,sub,u,s,del,span[style],p[style],h1[style],h2[style],h3[style],h4[style],h5[style],h6[style]');
        if (rich && context.preserveHtml !== false) {
            return htmlForMarkdown(node, context) + (/^(DETAILS|ASIDE|SECTION|DL|P|H[1-6])$/.test(node.tagName) ? '\n\n' : '');
        }
        if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
        if (['p', 'div', 'section', 'figure', 'aside', 'details'].includes(tag)) return `${children().trim()}\n\n`;
        if (tag === 'br') return '  \n';
        if (tag === 'strong' || tag === 'b') return `**${children()}**`;
        if (tag === 'em' || tag === 'i') return `*${children()}*`;
        if (tag === 's' || tag === 'del') return `~~${children()}~~`;
        if (tag === 'code' && node.parentElement?.tagName !== 'PRE') { const content = node.textContent || ''; const ticks = '`'.repeat(Math.max(1, ...Array.from(content.matchAll(/`+/g), match => match[0].length + 1))); return `${ticks} ${content} ${ticks}`; }
        if (tag === 'pre') {
            const code = node.querySelector('code'), content = code ? code.textContent : node.textContent;
            const language = (code && Array.from(code.classList).find(value => value.startsWith('language-'))?.slice(9)) || node.dataset.lang || '';
            const fence = '`'.repeat(Math.max(3, ...Array.from(content.matchAll(/`+/g), match => match[0].length + 1)));
            return `${fence}${language === 'code' ? '' : language}\n${content}\n${fence}\n\n`;
        }
        if (tag === 'blockquote') return children().trim().split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        if (tag === 'ul' || tag === 'ol') return Array.from(node.children).filter(child => child.tagName === 'LI').map((child, index) => {
            const box = Array.from(child.children).find(element => element.matches('input[type="checkbox"]'));
            const marker = tag === 'ol' ? `${(Number(node.getAttribute('start')) || 1) + index}.` : '-';
            const content = nodeToMarkdown(child, context).trim().split('\n');
            const prefix = `${marker} ${box ? box.hasAttribute('checked') ? '[x] ' : '[ ] ' : ''}`;
            return prefix + content[0] + (content.length > 1 ? '\n' + content.slice(1).map(line => ' '.repeat(marker.length + 1) + line).join('\n') : '');
        }).join('\n') + '\n\n';
        if (tag === 'li') return Array.from(node.childNodes).map(child => /^(UL|OL)$/.test(child.nodeName) ? '\n' + nodeToMarkdown(child, context) : nodeToMarkdown(child, context)).join('');
        if (tag === 'input') return '';
        if (tag === 'hr') return '---\n\n';
        if (tag === 'dt') return `**${children()}**\n`;
        if (tag === 'dd' || tag === 'summary') return children() + '\n\n';
        if (tag === 'img') return `![${node.getAttribute('alt') || ''}](${context.mediaPath(node.getAttribute('data-media-storage-id') || '', node.getAttribute('src') || '')})`;
        if (tag === 'video' || tag === 'audio') { const target = context.mediaPath(node.getAttribute('data-media-storage-id') || '', node.getAttribute('src') || ''); return target ? `<${tag} controls src="${escapeAttribute(target)}"></${tag}>\n\n` : ''; }
        if (tag === 'a') {
            const label = children().trim() || node.getAttribute('href') || '链接', href = node.getAttribute('href') || '';
            if (node.getAttribute('data-sora-link') === 'method') return label;
            const archive = node.closest('.archive-attachment');
            if (archive) return `[${label}](${context.mediaPath(archive.getAttribute('data-media-storage-id') || '', node.getAttribute('data-export-url') || href)})`;
            if (node.getAttribute('data-dir-id') || node.getAttribute('data-dir-name') || href.toLowerCase().startsWith('sora-dir:')) {
                const targetId = node.getAttribute('data-dir-id') || href.slice('sora-dir:'.length).split('#')[0], anchor = node.getAttribute('data-anchor-id') || href.split('#')[1] || '';
                return `[[${context.directoryName(targetId) || node.getAttribute('data-dir-name') || targetId}${anchor ? `#${anchor}` : ''}|${label}]]`;
            }
            return `[${label}](${href || '#'})`;
        }
        if (tag === 'table') {
            const rows = Array.from(node.rows);
            const hasCellStyles = rows.some(row => Array.from(row.cells).some((cell, column) => Array.from(cell.style).some(name => name !== 'text-align') || cell.style.textAlign !== rows[0].cells[column]?.style.textAlign));
            if (hasCellStyles || node.querySelector('[colspan]:not([colspan="1"]),[rowspan]:not([rowspan="1"]),td p,td ul,td ol,td pre') || !rows.length || Array.from(rows[0].cells).some(cell => cell.tagName !== 'TH')) return `${htmlForMarkdown(node, context)}\n\n`;
            const values = rows.map(row => Array.from(row.cells).map(cell => Array.from(cell.childNodes).map(child => nodeToMarkdown(child, context)).join('').trim().replace(/\n/g, '<br>').replace(/\|/g, '\\|')));
            const rule = Array.from(rows[0].cells).map(cell => cell.style.textAlign === 'center' ? ':---:' : cell.style.textAlign === 'right' ? '---:' : ':---');
            return [values[0], rule, ...values.slice(1)].map(row => '| ' + row.join(' | ') + ' |').join('\n') + '\n\n';
        }
        return children();
    }

    function mimeExtension(mimeType) {
        return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'application/pdf': 'pdf', 'application/zip': 'zip' })[String(mimeType || '').toLowerCase()] || 'bin';
    }

    async function buildExportPlan(directoryHandle, options = {}) {
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
            window.SoraContentFormats?.forStorage(root);
            const richFormats = [
                ['[style]', '颜色和段落样式'], ['mark,spoiler,sup,sub,u,kbd', '特殊文字格式'],
                ['.sora-callout,details,dl', '提示、折叠及术语块'], ['[data-sora-footnotes]', '脚注']
            ].filter(([selector]) => root.querySelector(selector)).map(([, label]) => label);
            if (richFormats.length) warnings.push(`${entry.row[1]}：${richFormats.join('、')}${options.preserveHtml === false ? '将简化为通用 Markdown，样式或交互会丢失' : '将保留为 HTML；其他 Markdown 阅读器的样式和交互支持可能不同'}`);
            if (root.querySelector('table')) warnings.push(`${entry.row[1]}：简单表格使用 Markdown 表格语法；无表头、合并单元格或复杂内容表格使用 HTML 保留结构。`);
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
            const markdown = Array.from(root.childNodes).map(node => nodeToMarkdown(node, { preserveHtml: options.preserveHtml !== false, directoryName: id => nameById.get(String(id || '')) || '', mediaPath: (id, fallback) => media.has(id) ? `_assets/${media.get(id).name}` : fallback })).join('').trim();
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
        await DraftManager.beforeSwitch();
        const mediaByPath = new Map();
        for (const [path, asset] of plan.assets) {
            const file = await asset.handle.getFile();
            const type = mediaType(file);
            const mediaPayload = type === 'image' && typeof optimizeImageFile === 'function'
                ? await optimizeImageFile(file)
                : file;
            mediaByPath.set(path, { id: await MediaStorage.save(mediaPayload, type, null, { deduplicate: type === 'image' }), type, name: file.name });
        }
        const usedIds = new Set(mode === 'merge' ? rows().map(row => String(row[2]).toLocaleLowerCase()) : []);
        const idMap = new Map();
        plan.notes.forEach(note => idMap.set(note.id, uniqueValue(note.id, usedIds)));
        const importedRows = [];
        const importedMetadata = {};
        plan.notes.forEach(note => {
            const id = idMap.get(note.id);
            const context = {
                directoryId(original) { return idMap.get(original) || original; },
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
        if (mode !== 'merge') soraDocumentEncrypted = false;
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
        const format = await customSelect('选择 Markdown 格式保留方式；写入前会列出受影响内容。', [
            { value: 'html', label: '保留丰富格式（使用 HTML，适合本工具往返）' },
            { value: 'portable', label: '通用 Markdown（简化文字和内容块样式）' }
        ], 'html', 'Markdown 导出');
        if (format === null) return;
        let handle;
        try { handle = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch (error) { if (error.name !== 'AbortError') showToast(`无法打开文件夹：${error.message}`, 'error', 3000); return; }
        const plan = await buildExportPlan(handle, { preserveHtml: format === 'html' });
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
