(function() {
    'use strict';
    const rowCache = new Map();

    function normalizeText(value) {
        return String(value || '').trim().toLocaleLowerCase();
    }

    function normalizeAnchor(value) {
        return String(value || '').trim().replace(/^#/, '').replace(/\s+/g, '-');
    }

    function escapeText(value) {
        const span = document.createElement('span');
        span.textContent = String(value || '');
        return span.innerHTML;
    }

    function getCurrentDirectoryId() {
        if (typeof currentMuluName === 'undefined' || !currentMuluName) return null;
        const element = document.getElementById(currentMuluName);
        return element ? element.getAttribute('data-dir-id') : null;
    }

    function makeDirectoryPath(row, rowsById) {
        const names = [row[1] || row[2]];
        let parentId = row[0];
        const visited = new Set([row[2]]);
        while (parentId && parentId !== 'mulu' && !visited.has(parentId)) {
            visited.add(parentId);
            const parent = rowsById.get(parentId);
            if (!parent) break;
            names.unshift(parent[1] || parent[2]);
            parentId = parent[0];
        }
        return names.join(' / ');
    }

    function getAnchorPreview(element) {
        let text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
        let cursor = element.nextSibling;
        while (text.length < 80 && cursor) {
            text += ' ' + String(cursor.textContent || '').replace(/\s+/g, ' ').trim();
            cursor = cursor.nextSibling;
        }
        if (!text && element.parentElement) {
            text = String(element.parentElement.textContent || '').replace(/\s+/g, ' ').trim();
        }
        return text.slice(0, 80);
    }

    function buildIndex(data) {
        const rows = Array.isArray(data)
            ? data.filter(row => row && row.length === 4)
            : (typeof mulufile !== 'undefined' && Array.isArray(mulufile)
                ? mulufile.filter(row => row && row.length === 4)
                : []);
        const rowsById = new Map(rows.map(row => [row[2], row]));
        const directories = [];

        const activeIds = new Set();
        rows.forEach((row, directoryOrder) => {
            const cacheKey = String(row[2] || '');
            activeIds.add(cacheKey);
            const dir = {
                id: String(row[2] || ''),
                name: String(row[1] || row[2] || '未命名目录'),
                parentId: String(row[0] || ''),
                path: makeDirectoryPath(row, rowsById),
                order: directoryOrder,
                anchors: []
            };
            const content = String(row[3] || '');
            const cached = rowCache.get(cacheKey);
            let anchors;
            if (cached && cached.content === content) {
                anchors = cached.anchors;
            } else {
                const template = document.createElement('template');
                template.innerHTML = content;
                if (typeof ensureAnchorElements === 'function') ensureAnchorElements(template.content);
                if (typeof assignHeadingAutoIds === 'function') assignHeadingAutoIds(template.content);
                const seen = new Set();
                anchors = [];
                template.content.querySelectorAll('[id], .sora-anchor[data-anchor-name]').forEach((element, anchorOrder) => {
                    const explicitName = element.getAttribute('data-anchor-name');
                    const anchorId = normalizeAnchor(explicitName || element.getAttribute('id'));
                    if (!anchorId || seen.has(anchorId)) return;
                    seen.add(anchorId);
                    anchors.push({ id: anchorId, label: explicitName || element.textContent.trim() || anchorId, preview: getAnchorPreview(element), order: anchorOrder });
                });
                rowCache.set(cacheKey, { content, anchors });
            }
            dir.anchors = anchors.map(anchor => ({ ...anchor, directory: dir }));
            directories.push(dir);
        });
        rowCache.forEach((_, id) => { if (!activeIds.has(id)) rowCache.delete(id); });

        return {
            directories,
            byId: new Map(directories.map(dir => [dir.id, dir])),
            byName: directories.reduce((map, dir) => {
                if (!map.has(dir.name)) map.set(dir.name, []);
                map.get(dir.name).push(dir);
                return map;
            }, new Map())
        };
    }

    function parse(value) {
        const text = String(value || '').trim();
        if (!text) return null;
        const lower = text.toLocaleLowerCase();
        const make = (dirId, dirName, anchorId) => ({
            dirId: dirId || null,
            dirName: dirName || null,
            anchorId: normalizeAnchor(anchorId)
        });
        if (lower.startsWith('dir:') || lower.startsWith('目录:')) {
            const rest = text.slice(text.indexOf(':') + 1);
            const hashIndex = rest.indexOf('#');
            return make(
                (hashIndex >= 0 ? rest.slice(0, hashIndex) : rest).trim(),
                null,
                hashIndex >= 0 ? rest.slice(hashIndex + 1) : ''
            );
        }
        if (lower.startsWith('name:') || lower.startsWith('目录名:')) {
            const rest = text.slice(text.indexOf(':') + 1);
            const hashIndex = rest.indexOf('#');
            return make(
                null,
                (hashIndex >= 0 ? rest.slice(0, hashIndex) : rest).trim(),
                hashIndex >= 0 ? rest.slice(hashIndex + 1) : ''
            );
        }
        if (text.startsWith('#')) return make(null, null, text.slice(1));
        return make(null, null, text);
    }

    function resolve(value, index, currentDirId) {
        const parsed = parse(value);
        if (!parsed) return { valid: false, exists: false, error: '请选择目录或锚点' };
        const source = index || buildIndex();
        let directory = null;
        if (parsed.dirId) {
            directory = source.byId.get(parsed.dirId) || null;
        } else if (parsed.dirName) {
            const matches = source.byName.get(parsed.dirName) || [];
            if (matches.length > 1) {
                return { valid: true, exists: false, parsed, error: '目录名重复，请改用目录 ID' };
            }
            directory = matches[0] || null;
        } else if (currentDirId) {
            directory = source.byId.get(currentDirId) || null;
        }
        if (!directory) {
            return { valid: true, exists: false, parsed, error: '目标目录不存在或当前目录尚未确定' };
        }
        if (!parsed.anchorId) {
            return { valid: true, exists: true, type: 'directory', parsed, directory };
        }
        const anchor = directory.anchors.find(item => item.id === parsed.anchorId) || null;
        if (!anchor) {
            return { valid: true, exists: false, type: 'anchor', parsed, directory, error: `目录“${directory.name}”中不存在锚点 #${parsed.anchorId}` };
        }
        return { valid: true, exists: true, type: 'anchor', parsed, directory, anchor };
    }

    function getItems(index, options, query) {
        const normalizedQuery = normalizeText(query)
            .replace(/^(dir|name|目录|目录名):/, '')
            .replace(/#/g, ' ');
        const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
        const filterDirectoryId = typeof options.filterDirectoryId === 'function'
            ? options.filterDirectoryId()
            : options.filterDirectoryId;
        const scope = options.scope || 'all';
        const currentDirId = options.currentDirId || getCurrentDirectoryId();
        const navigation = window.DirectoryNavigation;
        const recents = new Set(navigation && navigation.getRecents ? navigation.getRecents() : []);
        const favorites = new Set(navigation && navigation.getFavorites ? navigation.getFavorites() : []);
        const branchRootId = options.branchRootId || currentDirId;
        const isInBranch = directory => {
            if (!branchRootId) return true;
            let cursor = directory;
            const visited = new Set();
            while (cursor && !visited.has(cursor.id)) {
                if (cursor.id === branchRootId) return true;
                visited.add(cursor.id);
                cursor = index.byId.get(cursor.parentId);
            }
            return false;
        };
        const items = [];
        index.directories.forEach(directory => {
            if (filterDirectoryId && directory.id !== filterDirectoryId) return;
            if (scope === 'current' && directory.id !== currentDirId) return;
            if (scope === 'recent' && !recents.has(directory.id)) return;
            if (scope === 'favorite' && !favorites.has(directory.id)) return;
            if (scope === 'branch' && !isInBranch(directory)) return;
            const directorySearch = normalizeText(`${directory.name} ${directory.path} ${directory.id}`);
            if (options.allowDirectory !== false && queryTerms.every(term => directorySearch.includes(term))) {
                items.push({
                    type: 'directory',
                    value: `dir:${directory.id}`,
                    title: directory.name,
                    meta: directory.path === directory.name ? `目录 · ${directory.id}` : `目录 · ${directory.path}`,
                    order: directory.order * 10000
                });
            }
            directory.anchors.forEach(anchor => {
                const anchorSearch = normalizeText(`${directory.id} ${directory.name} ${directory.path} ${anchor.id} ${anchor.label} ${anchor.preview}`);
                if (!queryTerms.every(term => anchorSearch.includes(term))) return;
                items.push({
                    type: 'anchor',
                    value: `dir:${directory.id}#${anchor.id}`,
                    title: `#${anchor.id}`,
                    meta: directory.path,
                    preview: anchor.preview,
                    order: directory.order * 10000 + anchor.order + 1
                });
            });
        });
        return items.sort((a, b) => a.order - b.order).slice(0, options.maxResults || 80);
    }

    function attach(input, options = {}) {
        if (!input || !input.parentNode) return null;
        const indexFactory = () => {
            if (typeof options.index === 'function') return options.index();
            if (options.index) return options.index;
            return buildIndex(options.data);
        };
        let index = indexFactory();
        let activeIndex = -1;
        let open = false;
        let destroyed = false;
        let blurTimer = null;
        let scope = options.defaultScope || (options.filterDirectoryId ? 'current' : 'all');

        const wrapper = document.createElement('div');
        wrapper.className = 'reference-picker';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        input.classList.add('reference-picker-input');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');

        const chooseButton = document.createElement('button');
        chooseButton.type = 'button';
        chooseButton.className = 'reference-picker-button';
        chooseButton.textContent = '选择';
        chooseButton.setAttribute('aria-label', options.buttonLabel || '选择目录或锚点');
        wrapper.appendChild(chooseButton);

        const scopeBar = document.createElement('div');
        scopeBar.className = 'reference-picker-scopes';
        scopeBar.innerHTML = `
            <label>范围
                <select class="reference-picker-scope" aria-label="引用搜索范围">
                    <option value="all">全部目录</option>
                    <option value="current">当前目录</option>
                    <option value="branch">当前分支</option>
                    <option value="recent">最近访问</option>
                    <option value="favorite">收藏目录</option>
                </select>
            </label>`;
        const scopeSelect = scopeBar.querySelector('select');
        scopeSelect.value = scope;
        scopeBar.hidden = true;
        wrapper.appendChild(scopeBar);

        const panel = document.createElement('div');
        panel.className = 'reference-picker-panel';
        panel.setAttribute('role', 'listbox');
        panel.hidden = true;
        wrapper.appendChild(panel);

        function setOpen(next) {
            open = !!next;
            panel.hidden = !open;
            scopeBar.hidden = !open || options.showScopes === false;
            input.setAttribute('aria-expanded', String(open));
        }

        function render() {
            if (destroyed) return;
            index = indexFactory();
            const items = getItems(index, { ...options, scope }, input.value);
            activeIndex = items.length ? 0 : -1;
            if (!items.length) {
                panel.innerHTML = '<div class="reference-picker-empty">未找到匹配项。仍可保留手工输入。</div>';
                return;
            }
            panel.innerHTML = items.map((item, itemIndex) => `
                <button type="button" class="reference-picker-option${itemIndex === activeIndex ? ' active' : ''}" role="option" aria-selected="${itemIndex === activeIndex}" data-reference-index="${itemIndex}">
                    <span class="reference-picker-option-main"><strong>${escapeText(item.title)}</strong><span>${escapeText(item.meta)}</span></span>
                    ${item.preview ? `<small>${escapeText(item.preview)}</small>` : ''}
                </button>
            `).join('');
            panel._items = items;
        }

        function selectItem(itemIndex) {
            const items = panel._items || [];
            const item = items[itemIndex];
            if (!item) return;
            input.value = item.value;
            setOpen(false);
            input.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof options.onSelect === 'function') options.onSelect(item, index);
            input.focus();
        }

        function moveActive(delta) {
            const items = panel._items || [];
            if (!items.length) return;
            activeIndex = (activeIndex + delta + items.length) % items.length;
            panel.querySelectorAll('.reference-picker-option').forEach((option, itemIndex) => {
                const active = itemIndex === activeIndex;
                option.classList.toggle('active', active);
                option.setAttribute('aria-selected', String(active));
                if (active) option.scrollIntoView({ block: 'nearest' });
            });
        }

        chooseButton.addEventListener('mousedown', event => event.preventDefault());
        chooseButton.addEventListener('click', () => {
            if (open) {
                setOpen(false);
                return;
            }
            render();
            setOpen(true);
            input.focus();
        });
        input.addEventListener('focus', () => {
            if (blurTimer) {
                clearTimeout(blurTimer);
                blurTimer = null;
            }
            if (options.openOnFocus === false) return;
            render();
            setOpen(true);
        });
        input.addEventListener('input', () => {
            render();
            setOpen(true);
            if (typeof options.onChange === 'function') options.onChange(input.value, index);
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!open) {
                    render();
                    setOpen(true);
                } else {
                    moveActive(1);
                }
            } else if (event.key === 'ArrowUp' && open) {
                event.preventDefault();
                moveActive(-1);
            } else if (event.key === 'Enter' && open && activeIndex >= 0) {
                event.preventDefault();
                selectItem(activeIndex);
            } else if (event.key === 'Escape' && open) {
                event.preventDefault();
                setOpen(false);
            }
        });
        panel.addEventListener('mousedown', event => event.preventDefault());
        panel.addEventListener('click', event => {
            const option = event.target.closest('[data-reference-index]');
            if (!option) return;
            selectItem(Number(option.getAttribute('data-reference-index')));
        });
        input.addEventListener('blur', () => {
            blurTimer = setTimeout(() => {
                blurTimer = null;
                if (wrapper.contains(document.activeElement)) return;
                setOpen(false);
            }, 120);
        });
        scopeSelect.addEventListener('mousedown', event => event.stopPropagation());
        scopeSelect.addEventListener('focus', () => {
            if (blurTimer) {
                clearTimeout(blurTimer);
                blurTimer = null;
            }
            setOpen(true);
        });
        scopeSelect.addEventListener('change', () => {
            scope = scopeSelect.value;
            render();
            setOpen(true);
            input.focus();
        });

        return {
            refresh() {
                index = indexFactory();
                if (open) render();
            },
            close() {
                setOpen(false);
            },
            resolve(value) {
                return resolve(value === undefined ? input.value : value, index, options.currentDirId || getCurrentDirectoryId());
            },
            destroy() {
                destroyed = true;
                if (blurTimer) clearTimeout(blurTimer);
                if (wrapper.parentNode) {
                    wrapper.parentNode.insertBefore(input, wrapper);
                    wrapper.remove();
                }
            }
        };
    }

    window.SoraReferencePicker = Object.freeze({
        attach,
        buildIndex,
        clearCache: () => rowCache.clear(),
        parse,
        resolve,
        getCurrentDirectoryId
    });
})();
