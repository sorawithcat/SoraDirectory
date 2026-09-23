/** 代码块支持的语言选项 */
const CODE_LANG_OPTIONS = [
    { value: '', label: '纯文本（无高亮）' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'scss', label: 'SCSS/SASS' },
    { value: 'sql', label: 'SQL' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' },
    { value: 'bash', label: 'Bash/Shell' },
    { value: 'php', label: 'PHP' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'swift', label: 'Swift' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'markdown', label: 'Markdown' }
];
// -------------------- 状态变量 --------------------
/** 当前选中的文本 */
let selectedText = '';
/** 当前选中范围 */
let selectionRange = null;
let selectionToolbarTimer = null;
// -------------------- 辅助函数 --------------------
/**
 * 获取预览区域的选中内容
 * @returns {Object|null} - { text: string, range: Range } 或 null
 */
function getPreviewSelection() {
    if (!markdownPreview) {
        return null;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return { text: '', range: null };
    }
    const range = selection.getRangeAt(0);
    if (!markdownPreview.contains(range.startContainer) || !markdownPreview.contains(range.endContainer)) return { text: '', range: null };
    const text = range.toString().trim();
    return {
        text: text,
        range: range.cloneRange()
    };
}
function placeContextMenuCaret(event) {
    const current = getPreviewSelection()?.range;
    if (!event || (event.clientX === 0 && event.clientY === 0 && current)) return;
    // 在原选区上右键保留选区；在其他位置右键则定位到实际单元格或正文。
    if (current && !current.collapsed && Array.from(current.getClientRects()).some(rect =>
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)) return;
    let range = null;
    if (document.caretPositionFromPoint) {
        const point = document.caretPositionFromPoint(event.clientX, event.clientY);
        if (point) { range = document.createRange(); range.setStart(point.offsetNode, point.offset); range.collapse(true); }
    } else if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(event.clientX, event.clientY);
    const cell = event.target.closest?.('td,th');
    if (cell && (!range || !cell.contains(range.startContainer))) {
        range = document.createRange(); range.selectNodeContents(cell); range.collapse(true);
    }
    if (!range || !markdownPreview.contains(range.startContainer)) {
        range = document.createRange(); range.selectNodeContents(markdownPreview); range.collapse(false);
    }
    markdownPreview.focus({ preventScroll: true });
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    window.SoraEditor?.remember();
}
function hideTextFormatToolbar() {
    clearTimeout(selectionToolbarTimer);
    textFormatToolbar.style.display = 'none';
    textFormatToolbar.style.visibility = 'hidden';
}
function showTextFormatToolbar(e) {
    clearTimeout(selectionToolbarTimer);
    if (e?.type === 'contextmenu') placeContextMenuCaret(e);
    syncPreviewToTextarea();
    const previewSelection = getPreviewSelection();
    const hasSelection = previewSelection && previewSelection.text && previewSelection.text.length > 0;
    selectedText = previewSelection?.text || '';
    selectionRange = previewSelection?.range || null;
    window.SoraFormatting?.updateState();
    textFormatToolbar.style.display = 'flex';
    textFormatToolbar.style.visibility = 'hidden'; 
    const toolbarWidth = textFormatToolbar.offsetWidth || 400;
    const toolbarHeight = textFormatToolbar.offsetHeight || 40;
    const rect = markdownPreview.getBoundingClientRect();
    let x, y;
    if (hasSelection && previewSelection.range) {
        const rangeRect = previewSelection.range.getBoundingClientRect();
        x = rangeRect.left + rangeRect.width / 2;
        y = rangeRect.top;
    } else if (e) {
        x = e.clientX;
        y = e.clientY;
    } else {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rangeRect = range.getBoundingClientRect();
            x = rangeRect.left;
            y = rangeRect.top;
        } else {
            x = rect.left + rect.width / 2;
            y = rect.top + 50;
        }
    }
    let leftPos = x - toolbarWidth / 2;
    let topPos = y - toolbarHeight - 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (leftPos < 10) {
        leftPos = 10; 
    } else if (leftPos + toolbarWidth > viewportWidth - 10) {
        leftPos = viewportWidth - toolbarWidth - 10; 
    }
    if (topPos < 10) {
        topPos = y + toolbarHeight + 10; 
    } else if (topPos + toolbarHeight > viewportHeight - 10) {
        topPos = viewportHeight - toolbarHeight - 10; 
    }
    if (hasSelection) {
        textFormatToolbar.classList.add('has-selection');
    } else {
        textFormatToolbar.classList.remove('has-selection');
    }
    textFormatToolbar.style.left = leftPos + 'px';
    textFormatToolbar.style.top = topPos + 'px';
    textFormatToolbar.style.visibility = 'visible';
}
if (markdownPreview) {
    markdownPreview.addEventListener("mouseup", function(e) {
        if (e.button !== 0) return;
        clearTimeout(selectionToolbarTimer);
        selectionToolbarTimer = setTimeout(() => {
            const previewSelection = getPreviewSelection();
            if (previewSelection && previewSelection.text && previewSelection.text.length > 0) {
                showTextFormatToolbar(e);
            } else {
                hideTextFormatToolbar();
            }
        }, 10);
    });
    document.addEventListener('pointerdown', event => {
        if (!textFormatToolbar.contains(event.target)) hideTextFormatToolbar();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') hideTextFormatToolbar();
    });
}
document.querySelectorAll('.format-btn').forEach(btn => {
    if (btn.id === 'linkBtn' || btn.id === 'anchorBtn') return;
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const command = this.getAttribute('data-command');
        if (command) {
            applyFormat(command);
        }
    });
});
const linkBtn = document.getElementById('linkBtn');
if (linkBtn) {
    linkBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await applyFormat('link');
    });
}
const anchorBtn = document.getElementById('anchorBtn');
if (anchorBtn) {
    anchorBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await applyFormat('anchor');
    });
}

function normalizeAnchorName(raw) {
    if (!raw) return '';
    let id = String(raw).trim();
    id = id.replace(/^#/, '');
    id = id.replace(/\s+/g, '-');
    return id;
}

function generateShortRandomId(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

function generateUniqueAnchorDomId(anchorName) {
    const name = normalizeAnchorName(anchorName) || '锚点';
    const base = 'sora-anchor-' + name;
    for (let i = 0; i < 50; i++) {
        const id = base + '-' + generateShortRandomId(6);
        if (!document.getElementById(id)) return id;
    }
    return base + '-' + Date.now();
}

function buildLinkValueForEdit(a) {
    if (!a) return '';
    const href = a.getAttribute('href') || '';
    const soraType = a.getAttribute('data-sora-link') || '';
    if (href.startsWith('#') || soraType === 'anchor') {
        const anchorId = a.getAttribute('data-anchor-id') || href.replace(/^#/, '');
        return '#' + (anchorId || '');
    }
    if (href.toLowerCase().startsWith('sora-dir:') || soraType === 'dir') {
        const dirId = a.getAttribute('data-dir-id');
        const dirName = a.getAttribute('data-dir-name');
        const anchorId = a.getAttribute('data-anchor-id');
        const suffix = anchorId ? ('#' + anchorId) : '';
        if (dirId) return 'dir:' + dirId + suffix;
        if (dirName) return 'name:' + dirName + suffix;
        const raw = href.substring('sora-dir:'.length);
        return 'dir:' + raw;
    }
    return href;
}

function applyLinkAttributesToElement(a, inputValue) {
    if (!a) return;
    const trimmed = String(inputValue || '').trim();
    if (!trimmed) return;

    a.removeAttribute('data-sora-link');
    a.removeAttribute('data-dir-id');
    a.removeAttribute('data-dir-name');
    a.removeAttribute('data-anchor-id');

    const lower = trimmed.toLowerCase();
    if (trimmed.startsWith('#')) {
        const anchorName = normalizeAnchorName(trimmed);
        a.setAttribute('href', '#' + anchorName);
        a.setAttribute('data-sora-link', 'anchor');
        a.setAttribute('data-anchor-id', anchorName);
        a.removeAttribute('target');
        return;
    }
    const isDir = lower.startsWith('dir:') || lower.startsWith('目录:');
    const isName = lower.startsWith('name:') || lower.startsWith('目录名:');
    if (isDir || isName) {
        const prefixLen = trimmed.indexOf(':') + 1;
        const rest = trimmed.substring(prefixLen);
        const hashIndex = rest.indexOf('#');
        const mainPart = (hashIndex >= 0 ? rest.substring(0, hashIndex) : rest).trim();
        const anchorPart = (hashIndex >= 0 ? rest.substring(hashIndex + 1) : '').trim();

        a.setAttribute('href', 'sora-dir:' + mainPart + (anchorPart ? ('#' + anchorPart) : ''));
        a.setAttribute('data-sora-link', 'dir');
        if (isDir) {
            a.setAttribute('data-dir-id', mainPart);
        } else {
            a.setAttribute('data-dir-name', mainPart);
        }
        if (anchorPart) {
            a.setAttribute('data-anchor-id', normalizeAnchorName(anchorPart));
        }
        a.removeAttribute('target');
        return;
    }

    a.setAttribute('href', trimmed);
    a.setAttribute('target', '_blank');
}

async function editLinkElement(a) {
    const token = window.SoraEditor?.captureElement(a);
    const initial = buildLinkValueForEdit(a);
    const val = await showLinkConfigDialog(initial, '编辑链接');
    if (!val) return;
    if (token) SoraEditor.transaction('编辑链接', token, () => applyLinkAttributesToElement(a, val));
}

function showLinkConfigDialog(initialValue, title = '插入链接') {
    return new Promise(resolve => {
        const initial = String(initialValue || '');
        const isInternal = initial.startsWith('#') || /^(dir|name|目录|目录名):/i.test(initial);
        customDialogTitle.textContent = title;
        customDialogInput.style.display = 'none';
        customDialogMessage.innerHTML = `
            <div class="link-config-form">
                <div class="link-type-switch" role="group" aria-label="链接类型">
                    <button type="button" data-link-mode="internal" class="${isInternal ? 'active' : ''}">目录或锚点</button>
                    <button type="button" data-link-mode="external" class="${isInternal ? '' : 'active'}">外部网址</button>
                </div>
                <div class="form-group" data-link-section="internal"${isInternal ? '' : ' hidden'}>
                    <label for="linkInternalTarget">目录或锚点</label>
                    <input id="linkInternalTarget" class="form-control" value="${escapeHtmlAttribute(isInternal ? initial : '')}" placeholder="搜索目录名、ID、锚点或正文预览" />
                    <small>可切换当前目录、当前分支、最近访问、收藏或全部目录。</small>
                </div>
                <div class="form-group" data-link-section="external"${isInternal ? ' hidden' : ''}>
                    <label for="linkExternalTarget">网址</label>
                    <input id="linkExternalTarget" class="form-control" type="url" value="${escapeHtmlAttribute(isInternal ? 'https://' : (initial || 'https://'))}" placeholder="https://example.com" />
                </div>
                <small class="method-field-error" data-link-error role="alert"></small>
            </div>`;
        customDialogFooter.innerHTML =
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        const internalInput = document.getElementById('linkInternalTarget');
        const externalInput = document.getElementById('linkExternalTarget');
        const error = customDialogMessage.querySelector('[data-link-error]');
        let mode = isInternal ? 'internal' : 'external';
        const picker = window.SoraReferencePicker ? window.SoraReferencePicker.attach(internalInput, {
            allowDirectory: true,
            currentDirId: window.SoraReferencePicker.getCurrentDirectoryId(),
            openOnFocus: true,
            buttonLabel: '选择链接目标'
        }) : null;
        const close = value => {
            if (picker) picker.destroy();
            customDialogOverlay.classList.remove('active');
            customDialogMessage.innerHTML = '';
            resolve(value);
        };
        customDialogMessage.querySelectorAll('[data-link-mode]').forEach(button => {
            button.addEventListener('click', () => {
                mode = button.dataset.linkMode;
                customDialogMessage.querySelectorAll('[data-link-mode]').forEach(item => item.classList.toggle('active', item === button));
                customDialogMessage.querySelectorAll('[data-link-section]').forEach(section => {
                    section.hidden = section.dataset.linkSection !== mode;
                });
                (mode === 'internal' ? internalInput : externalInput).focus();
            });
        });
        document.getElementById('customDialogOk').onclick = () => {
            const value = (mode === 'internal' ? internalInput.value : externalInput.value).trim();
            if (!value) {
                error.textContent = '请选择目标或输入网址';
                return;
            }
            if (mode === 'internal' && picker) {
                const resolved = picker.resolve(value);
                if (!resolved || !resolved.exists) {
                    error.textContent = resolved && resolved.error ? resolved.error : '内部链接目标不存在';
                    return;
                }
            }
            if (mode === 'external' && !/^(https?:|mailto:|tel:)/i.test(value)) {
                error.textContent = '外部链接需以 http://、https://、mailto: 或 tel: 开头';
                return;
            }
            close(value);
        };
        document.getElementById('customDialogCancel').onclick = () => close(null);
        customDialogClose.onclick = () => close(null);
        customDialogOverlay.onclick = event => { if (event.target === customDialogOverlay) close(null); };
        customDialogOverlay.classList.add('active');
        setTimeout(() => (mode === 'internal' ? internalInput : externalInput).focus(), 0);
    });
}

async function editAnchorElement(anchorEl) {
    const token = window.SoraEditor?.captureElement(anchorEl);
    const current = anchorEl.getAttribute('data-anchor-name') || '';
    const val = await customPrompt('编辑锚点名:', current);
    if (!val) return;
    const name = normalizeAnchorName(val);

    if (!name) return;
    if (!token) return;
    SoraEditor.transaction('编辑锚点', token, () => {
    anchorEl.setAttribute('data-anchor-name', name);
    anchorEl.setAttribute('data-sora-anchor', 'true');
    if (!anchorEl.id || !String(anchorEl.id).startsWith('sora-anchor-')) {
        anchorEl.id = generateUniqueAnchorDomId(name);
    }
    });
}

function escapeCssSelectorValue(value) {
    if (value === null || value === undefined) return '';
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(String(value));
    }
    const backslash = String.fromCharCode(92);
    return String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function(ch) {
        const hex = ch.charCodeAt(0).toString(16);
        return backslash + hex + ' ';
    });
}

function safeParseJson(raw, fallback) {
    try {
        if (raw === null || raw === undefined) return fallback;
        const text = String(raw).trim();
        if (!text) return fallback;
        return JSON.parse(text);
    } catch (e) {
        return fallback;
    }
}

function escapeHtmlAttribute(value) {
    return escapeHtml(String(value || ''))
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureMethodId(cfg) {
    if (!cfg || typeof cfg !== 'object') return null;
    if (cfg.methodId) return cfg.methodId;
    cfg.methodId = 'm_' + Date.now() + '_' + generateShortRandomId(6);
    return cfg.methodId;
}

function normalizeMethodConfig(cfg, options = {}) {
    if (!cfg || typeof cfg !== 'object') return null;
    if (window.SoraMethodRegistry) {
        const normalized = window.SoraMethodRegistry.normalize(cfg, {
            assignId: false
        });
        if (options.assignId !== false) ensureMethodId(normalized);
        return normalized;
    }
    if (!cfg.trigger) {
        cfg.trigger = 'click';
    }
    if (!cfg.formatCommand && cfg.formatType) {
        cfg.formatCommand = cfg.formatType;
        delete cfg.formatType;
    }
    if (Array.isArray(cfg.formatMethods)) {
        cfg.formatMethods = cfg.formatMethods
            .map(item => normalizeMethodConfig(item, options))
            .filter(Boolean);
    }
    if (options.assignId !== false) {
        ensureMethodId(cfg);
    }
    return cfg;
}

function readMethodsFromElement(a) {
    if (!a || !a.getAttribute) return [];
    const raw = a.getAttribute('data-sora-methods') || '';
    const parsed = safeParseJson(raw, []);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr
        .map(cfg => normalizeMethodConfig(cfg, { assignId: false }))
        .filter(Boolean);
}

function writeMethodsToElement(a, methods) {
    if (!a || !a.setAttribute) return;
    const arr = (Array.isArray(methods) ? methods : [])
        .map(cfg => normalizeMethodConfig(cfg, { assignId: true }))
        .filter(Boolean);
    a.setAttribute('data-sora-link', 'method');
    a.setAttribute('href', '#');
    a.setAttribute('data-sora-methods', JSON.stringify(arr));
}

function readExecutedMethodIdsFromElement(a) {
    if (!a || !a.getAttribute) return new Set();
    const raw = a.getAttribute('data-sora-methods-executed') || '';
    const parsed = safeParseJson(raw, []);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(v => typeof v === 'string' && v));
}

function writeExecutedMethodIdsToElement(a, idSet) {
    if (!a || !a.setAttribute) return;
    const arr = Array.from(idSet || []);
    a.setAttribute('data-sora-methods-executed', JSON.stringify(arr));
}

function buildTriggerLabel(trigger) {
    if (window.SoraMethodRegistry) {
        const definition = window.SoraMethodRegistry.getTrigger(trigger);
        if (definition) return definition.label;
    }
    switch (trigger) {
        case 'open':
            return '打开时';
        case 'enter_dir':
            return '进入此目录时';
        case 'hover':
            return '悬浮时';
        case 'click':
        default:
            return '点击时';
    }
}

function buildMethodLabel(cfg) {
    if (!cfg || typeof cfg !== 'object') return '方法';
    if (window.SoraMethodRegistry) return window.SoraMethodRegistry.summarize(cfg);
    const type = cfg.methodType || '未设置';
    const triggerLabel = buildTriggerLabel(cfg.trigger || 'click');
    const onceLabel = cfg.once ? '一次性' : '可重复';
    const front = cfg.frontAnchor || '';
    const back = cfg.backAnchor || '';
    const rangeLabel = back ? (front + ' ~ ' + back) : (front || '未设置');
    return type + ' / ' + triggerLabel + ' / ' + onceLabel + ' / ' + rangeLabel;
}
window.buildMethodLabel = buildMethodLabel;

function parseAnchorRef(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    const build = (dirId, dirName, anchorId) => {
        const aid = anchorId ? normalizeAnchorName(anchorId) : '';
        return {
            dirId: dirId || null,
            dirName: dirName || null,
            anchorId: aid || ''
        };
    };
    if (lower.startsWith('dir:') || lower.startsWith('目录:')) {
        const prefixLen = trimmed.indexOf(':') + 1;
        const rest = trimmed.substring(prefixLen);
        const hashIndex = rest.indexOf('#');
        const mainPart = (hashIndex >= 0 ? rest.substring(0, hashIndex) : rest).trim();
        const anchorPart = (hashIndex >= 0 ? rest.substring(hashIndex + 1) : '').trim();
        return build(mainPart, null, anchorPart);
    }
    if (lower.startsWith('name:') || lower.startsWith('目录名:')) {
        const prefixLen = trimmed.indexOf(':') + 1;
        const rest = trimmed.substring(prefixLen);
        const hashIndex = rest.indexOf('#');
        const mainPart = (hashIndex >= 0 ? rest.substring(0, hashIndex) : rest).trim();
        const anchorPart = (hashIndex >= 0 ? rest.substring(hashIndex + 1) : '').trim();
        return build(null, mainPart, anchorPart);
    }
    if (trimmed.startsWith('#')) {
        return build(null, null, trimmed.substring(1));
    }
    return build(null, null, trimmed);
}

function resolveDirIdFromRef(ref) {
    if (!ref) return null;
    if (ref.dirId) return ref.dirId;
    const name = (ref.dirName || '').trim();
    if (!name) return null;
    if (typeof mulufile === 'undefined' || !Array.isArray(mulufile)) return null;
    let foundId = null;
    let duplicate = 0;
    for (let i = 0; i < mulufile.length; i++) {
        const item = mulufile[i];
        if (item && item.length === 4 && item[1] === name) {
            duplicate++;
            if (!foundId) foundId = item[2];
        }
    }
    if (duplicate > 1 && typeof showToast === 'function') {
        showToast('存在重复目录名，已使用第一个匹配项：' + name, 'warning', 2500);
    }
    return foundId;
}

function getCurrentDirIdForEditor() {
    if (!currentMuluName) return null;
    const el = document.getElementById(currentMuluName);
    if (!el) return null;
    return el.getAttribute('data-dir-id') || null;
}

function getDirHtmlById(dirId) {
    if (!dirId) return '';
    if (typeof getMulufileByDirId === 'function') {
        const data = getMulufileByDirId(dirId);
        return data ? (data[3] || '') : '';
    }
    if (typeof mulufile !== 'undefined' && Array.isArray(mulufile)) {
        for (let i = 0; i < mulufile.length; i++) {
            const item = mulufile[i];
            if (item && item.length === 4 && item[2] === dirId) {
                return item[3] || '';
            }
        }
    }
    return '';
}

async function setDirHtmlById(dirId, html) {
    if (!dirId) return;
    const selector = '.mulu[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]';
    const el = document.querySelector(selector);
    if (el && typeof updateMulufileData === 'function') {
        updateMulufileData(el, html);
    } else if (typeof getMulufileByDirId === 'function') {
        const data = getMulufileByDirId(dirId);
        if (data) {
            data[3] = typeof normalizeEditorHtmlForStorage === 'function'
                ? normalizeEditorHtmlForStorage(html)
                : html;
            if (typeof markUnsavedChanges === 'function') {
                markUnsavedChanges();
            }
        }
    }
    const currentDirId = getCurrentDirIdForEditor();
    if (currentDirId && currentDirId === dirId && typeof updateMarkdownPreview === 'function') {
        isUpdating = true;
        jiedianwords.value = html;
        await updateMarkdownPreview({ force: true });
        isUpdating = false;
    }
}

function findAnchorElementInRoot(root, anchorId) {
    if (!root || !anchorId) return null;
    const id = normalizeAnchorName(anchorId);
    if (!id) return null;
    let el = root.querySelector('#' + escapeCssSelectorValue(id));
    if (!el) {
        el = root.querySelector('.sora-anchor[data-sora-anchor="true"][data-anchor-name="' + escapeCssSelectorValue(id) + '"]');
    }
    return el;
}

function extractHtmlBetweenAnchors(root, frontId, backId) {
    if (!root) return null;
    if (!frontId && !backId) {
        return root.innerHTML;
    }

    const range = document.createRange();
    try {
        if (frontId) {
            const frontEl = findAnchorElementInRoot(root, frontId);
            if (!frontEl) return null;
            range.setStartAfter(frontEl);
        } else {
            range.setStart(root, 0);
        }

        if (backId) {
            const backEl = findAnchorElementInRoot(root, backId);
            if (!backEl) return null;
            range.setEndBefore(backEl);
        } else {
            range.setEnd(root, root.childNodes.length);
        }
    } catch (e) {
        return null;
    }
    const frag = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(frag);
    return div.innerHTML;
}

function replaceHtmlBetweenAnchors(root, frontId, backId, replacementHtml) {
    if (!root) return false;
    const range = document.createRange();
    try {
        if (frontId) {
            const frontEl = findAnchorElementInRoot(root, frontId);
            if (!frontEl) return false;
            range.setStartAfter(frontEl);
        } else {
            range.setStart(root, 0);
        }

        if (backId) {
            const backEl = findAnchorElementInRoot(root, backId);
            if (!backEl) return false;
            range.setEndBefore(backEl);
        } else {
            range.setEnd(root, root.childNodes.length);
        }
    } catch (e) {
        return false;
    }
    range.deleteContents();

    const div = document.createElement('div');
    div.innerHTML = replacementHtml;
    const frag = document.createDocumentFragment();
    while (div.firstChild) {
        frag.appendChild(div.firstChild);
    }
    range.insertNode(frag);
    return true;
}

async function promptMethodConfig(existing) {
    // 使用统一表单弹窗
    return await showMethodConfigDialog(existing);
}

async function editMethodElement(a) {
    const token = window.SoraEditor?.captureElement(a);
    if (!token) return;
    const methods = readMethodsFromElement(a);
    const options = methods.map((method, index) => ({ value: 'edit_' + index, label: '编辑：' + buildMethodLabel(method) }));
    options.push({ value: 'add', label: '添加方法' });
    if (methods.length) options.push({ value: 'delete', label: '删除方法' }, { value: 'clear', label: '清空所有方法' });
    const action = await customSelect('选择操作：', options, methods.length ? 'edit_0' : 'add', '方法');
    if (action === null) return;
    if (action === 'add') {
        const method = await promptMethodConfig(null);
        if (!method) return;
        methods.push(method);
    } else if (action === 'clear') {
        if (!await customConfirm('清空此链接的所有方法？', '清空方法', '取消')) return;
        methods.length = 0;
    } else if (action === 'delete') {
        const selected = await customSelect('选择要删除的方法：', methods.map((method, index) => ({ value: String(index), label: buildMethodLabel(method) })), '0', '删除方法');
        if (selected === null || !methods[Number(selected)]) return;
        if (!await customConfirm('删除所选方法？', '删除方法', '取消')) return;
        methods.splice(Number(selected), 1);
    } else if (action.startsWith('edit_')) {
        const index = Number(action.slice(5));
        if (!methods[index]) return;
        const method = await promptMethodConfig(methods[index]);
        if (!method) return;
        methods[index] = method;
    } else return;
    SoraEditor.transaction('编辑方法', token, () => {
        writeMethodsToElement(a, methods);
        a.removeAttribute('data-sora-methods-executed');
    });
}

if (markdownPreview) {
    markdownPreview.addEventListener('click', async function(e) {
        const clickedAnchor = e.target && e.target.closest ? e.target.closest('.sora-anchor[data-sora-anchor="true"]') : null;
        if (clickedAnchor) {
            e.preventDefault();
            e.stopPropagation();
            await editAnchorElement(clickedAnchor);
            return;
        }

        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!a) return;
        const href = a.getAttribute('href') || '';
        const soraType = a.getAttribute('data-sora-link') || '';
        if (soraType === 'method') {
            e.preventDefault();
            e.stopPropagation();
            await editMethodElement(a);
            return;
        }
        if (!href) return;

        if (e.ctrlKey || e.metaKey) {
            if (href.startsWith('#') || soraType === 'anchor') {
                e.preventDefault();
                e.stopPropagation();
                if (typeof scrollToAnchorInPreview === 'function') {
                    scrollToAnchorInPreview(href);
                }
                return;
            }

            if (href.toLowerCase().startsWith('sora-dir:') || soraType === 'dir') {
                e.preventDefault();
                e.stopPropagation();

                let dirId = a.getAttribute('data-dir-id');
                let dirName = a.getAttribute('data-dir-name');
                let anchorId = a.getAttribute('data-anchor-id');

                if (!anchorId) {
                    const hashIndex = href.indexOf('#');
                    if (hashIndex >= 0) {
                        anchorId = href.substring(hashIndex + 1);
                    }
                }
                if (!dirId && !dirName) {
                    const raw = href.substring('sora-dir:'.length);
                    const hashIndex = raw.indexOf('#');
                    dirId = (hashIndex >= 0 ? raw.substring(0, hashIndex) : raw).trim();
                }

                if (dirName) {
                    if (typeof mulufile !== 'undefined' && Array.isArray(mulufile)) {
                        let foundId = null;
                        let duplicate = 0;
                        for (let i = 0; i < mulufile.length; i++) {
                            const item = mulufile[i];
                            if (item && item.length === 4 && item[1] === dirName) {
                                duplicate++;
                                if (!foundId) foundId = item[2];
                            }
                        }
                        if (duplicate > 1 && typeof showToast === 'function') {
                            showToast('存在重复目录名，已跳转到第一个匹配项：' + dirName, 'warning', 2500);
                        }
                        if (foundId && typeof navigateToDirectoryInternalLink === 'function') {
                            navigateToDirectoryInternalLink(foundId, anchorId);
                        } else if (typeof showToast === 'function') {
                            showToast('未找到目标目录：' + dirName, 'warning', 2500);
                        }
                    }
                } else if (dirId && typeof navigateToDirectoryInternalLink === 'function') {
                    navigateToDirectoryInternalLink(dirId, anchorId);
                }
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            const opened = window.open(href, '_blank', 'noopener,noreferrer');
            if (opened) opened.opener = null;
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        await editLinkElement(a);
    });

}

/**
 * 应用格式化命令
 * 在预览区域直接应用 HTML 格式，支持切换（再次点击取消格式）
 *
 * 
 * 支持的命令：
 * - 标题：h1, h2, h3, h4, h5, h6
 * - 文本格式：bold, italic, underline, strikethrough, code, code-block, highlight, spoiler, superscript, subscript
 * - 链接：link
 * - 列表：unordered-list, ordered-list, task-list
 * - 块级元素：quote, paragraph, hr, table
 * 
 * @param {string} command - 格式化命令
 */
async function applyFormat(command) {
    return window.SoraFormatting?.apply(command);
}
// ============================================
// 代码块辅助功能
// ============================================
/**
 * 为代码块添加复制按钮（悬停时显示）
 */
function addCopyButtonsToCodeBlocks() {
}
/**
 * 复制代码块内容
 * @param {HTMLElement} btn - 复制按钮元素
 */
function copyCodeBlock(btn) {
    const pre = btn.closest('pre');
    if (!pre) return;
    const codeElement = pre.querySelector('code');
    const code = codeElement ? codeElement.textContent : pre.textContent;
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '已复制!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '复制';
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        btn.textContent = '复制失败';
        setTimeout(() => {
            btn.textContent = '复制';
        }, 2000);
    });
}
/**
 * 简单的语法高亮（支持常见语言）
 * @param {string} code - 代码内容
 * @param {string} language - 语言类型
 * @returns {string} - 高亮后的 HTML
 */
function highlightCode(code, language) {
    const source = String(code || '');
    const lang = String(language || '').toLowerCase();
    if (!lang || ['code', 'text', 'plaintext'].includes(lang)) return escapeHtml(source);
    const keywordSets = {
        javascript: 'const let var function return if else for while do switch case break continue new this class extends import export from default async await try catch finally throw typeof instanceof in of null undefined true false',
        typescript: 'const let var function return if else for while class interface type enum public private readonly extends implements import export from default async await try catch throw null undefined true false',
        python: 'def class if elif else for while return import from as try except finally raise with lambda yield pass break continue and or not in is None True False self',
        java: 'int float double char void bool boolean string class struct enum public private protected static const final new return if else for while do switch case break continue try catch throw finally null true false this super import package using namespace include',
        go: 'package import func return var const type struct interface map chan go defer if else for range switch case default break continue select nil true false make new len cap append copy delete',
        rust: 'fn let mut const if else match loop while for in return struct enum impl trait pub use mod crate self super true false Some None Ok Err',
        sql: 'select from where and or insert into values update set delete create table drop alter join left right inner outer on as order by group having limit offset null not in like between is true false count sum avg min max distinct'
    };
    const alias = { js: 'javascript', ts: 'typescript', py: 'python', c: 'java', cpp: 'java', csharp: 'java', 'c++': 'java', 'c#': 'java' };
    const family = alias[lang] || lang;
    if (!keywordSets[family] && !['html', 'xml', 'css', 'scss', 'json', 'bash', 'ruby', 'php'].includes(family)) return escapeHtml(source);
    const keywords = new Set((keywordSets[family] || '').split(' '));
    const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|<\/?[A-Za-z][^>]*>|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;
    let output = '', cursor = 0;
    for (const match of source.matchAll(pattern)) {
        output += escapeHtml(source.slice(cursor, match.index));
        const token = match[0];
        let kind = '';
        if (/^["'`]/.test(token)) kind = 'string';
        else if (/^\/\/|^\/\*/.test(token) || (token.startsWith('#') && ['python', 'bash', 'ruby'].includes(family))) kind = 'comment';
        else if (token.startsWith('<') && ['html', 'xml'].includes(family)) kind = 'tag';
        else if (/^\d/.test(token)) kind = 'number';
        else if (keywords.has(family === 'sql' ? token.toLowerCase() : token)) kind = 'keyword';
        else if (/^\s*\(/.test(source.slice(match.index + token.length))) kind = 'function';
        output += kind ? '<span class="' + kind + '">' + escapeHtml(token) + '</span>' : escapeHtml(token);
        cursor = match.index + token.length;
    }
    return output + escapeHtml(source.slice(cursor));
}
/**
 * 保存光标位置（文本偏移量）
 */
function saveCaretPosition(element) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer)) return null;
    const preRange = document.createRange();
    preRange.selectNodeContents(element);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
}
/**
 * 恢复光标位置
 */
function restoreCaretPosition(element, offset) {
    if (offset === null || offset === undefined) return;
    const selection = window.getSelection();
    const range = document.createRange();
    let currentOffset = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeLength = node.textContent.length;
        if (currentOffset + nodeLength >= offset) {
            range.setStart(node, offset - currentOffset);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }
        currentOffset += nodeLength;
    }
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}
/**
 * 对单个代码块应用语法高亮
 */
function applyHighlightToCodeBlock(codeElement) {
    if (!codeElement) return;
    const pre = codeElement.closest('pre');
    if (!pre) return;
    const langAttr = pre.getAttribute('data-lang');
    const langClass = Array.from(codeElement.classList).find(c => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '') : langAttr;
    if (!lang || lang === 'code') return;
    const code = codeElement.textContent;
    codeElement.innerHTML = highlightCode(code, lang);
    pre.setAttribute('contenteditable', 'false');
    pre.classList.add('code-block-editable');
}
/**
 * 初始化所有代码块
 */
function initCodeBlocks() {
    if (!markdownPreview) return;
    const codeBlocks = markdownPreview.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
        pre.setAttribute('contenteditable', 'false');
        pre.classList.add('code-block-editable');
        const codeElement = pre.querySelector('code');
        if (codeElement) {
            applyHighlightToCodeBlock(codeElement);
        }
        addCopyButtonToCodeBlock(pre);
        ensureEditableAroundCodeBlock(pre);
    });
}
/**
 * 为代码块添加语言标签（点击可复制）
 */
function addCopyButtonToCodeBlock(pre) {
    if (!pre) return;
    if (pre.querySelector('.code-lang-label')) return;
    const lang = pre.getAttribute('data-lang') || 'code';
    const langLabel = document.createElement('button');
    langLabel.className = 'code-lang-label';
    langLabel.textContent = lang.toUpperCase();
    langLabel.type = 'button';
    langLabel.dataset.lang = lang.toUpperCase(); 
    pre.addEventListener('mouseenter', () => {
        if (!langLabel.classList.contains('copied')) {
            langLabel.textContent = '复制';
        }
    });
    pre.addEventListener('mouseleave', () => {
        if (!langLabel.classList.contains('copied')) {
            langLabel.textContent = langLabel.dataset.lang;
        }
    });
    langLabel.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation(); 
        const codeElement = pre.querySelector('code');
        if (!codeElement) return;
        const code = codeElement.textContent;
        try {
            await navigator.clipboard.writeText(code);
            langLabel.textContent = '已复制!';
            langLabel.classList.add('copied');
            setTimeout(() => {
                langLabel.textContent = langLabel.dataset.lang;
                langLabel.classList.remove('copied');
            }, 2000);
        } catch (err) {
            langLabel.textContent = '复制失败';
            setTimeout(() => {
                langLabel.textContent = langLabel.dataset.lang;
            }, 2000);
        }
    });
    pre.appendChild(langLabel);
}
/**
 * 确保代码块前后有可编辑的元素
 */
function ensureEditableAroundCodeBlock(pre) {
    if (!pre || !pre.parentNode) return;
    let prevSibling = pre.previousSibling;
    while (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && !prevSibling.textContent.trim()) {
        prevSibling = prevSibling.previousSibling;
    }
    if (!prevSibling || (prevSibling.nodeType === Node.ELEMENT_NODE && prevSibling.tagName === 'PRE' && prevSibling.getAttribute('contenteditable') === 'false')) {
        const beforePara = document.createElement('p');
        beforePara.innerHTML = '<br>';
        pre.parentNode.insertBefore(beforePara, pre);
    }
    let nextSibling = pre.nextSibling;
    while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.trim()) {
        nextSibling = nextSibling.nextSibling;
    }
    if (!nextSibling || (nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.tagName === 'PRE' && nextSibling.getAttribute('contenteditable') === 'false')) {
        const afterPara = document.createElement('p');
        afterPara.innerHTML = '<br>';
        if (pre.nextSibling) {
            pre.parentNode.insertBefore(afterPara, pre.nextSibling);
        } else {
            pre.parentNode.appendChild(afterPara);
        }
    }
}
/**
 * 编辑代码块
 */
async function editCodeBlock(pre) {
    if (!pre) return;
    const codeElement = pre.querySelector('code');
    if (!codeElement) return;
    const token = window.SoraEditor?.captureElement(pre);
    const scrollTop = markdownPreview.scrollTop;
    const scrollLeft = markdownPreview.scrollLeft;
    // 获取当前语言和代码
    const langAttr = pre.getAttribute('data-lang') || '';
    const langClass = Array.from(codeElement.classList).find(c => c.startsWith('language-'));
    const currentLang = langClass ? langClass.replace('language-', '') : langAttr;
    const currentCode = codeElement.textContent;
    // 弹出编辑对话框
    const result = await codeEditDialog(currentCode, currentLang, CODE_LANG_OPTIONS, '编辑代码块');
    if (result === null) {
        if (pre.isConnected) { markdownPreview.scrollTop = scrollTop; markdownPreview.scrollLeft = scrollLeft; }
        return;
    }
    if (!token) return;
    const changed = SoraEditor.transaction('编辑代码块', token, () => {
    if (result.delete) {
        // 删除代码块
        pre.remove();
        return;
    }
    // 更新代码块
    const langValue = result.language ? result.language.toLowerCase() : 'code';
    pre.setAttribute('data-lang', langValue);
    // 更新 code 元素的类名
    codeElement.className = result.language ? 'language-' + langValue : '';
    // 应用高亮
    codeElement.innerHTML = highlightCode(result.code, result.language);
    // 更新语言标签
    const langLabel = pre.querySelector('.code-lang-label');
    if (langLabel) {
        langLabel.textContent = langValue.toUpperCase();
        langLabel.dataset.lang = langValue.toUpperCase();
    }
    });
    if (changed) {
        markdownPreview.scrollTop = scrollTop;
        markdownPreview.scrollLeft = scrollLeft;
    }
}
// -------------------- 预览区域事件监听 --------------------
// 注意：图片相关功能已移至 imageHandler.js
// 监听预览区域的代码块点击
if (markdownPreview) {
    markdownPreview.addEventListener('click', (e) => {
        const pre = e.target.closest('pre.code-block-editable');
        if (pre) {
            e.preventDefault();
            e.stopPropagation();
            editCodeBlock(pre);
        }
    });
    /**
     * 检查段落是否是代码块的保护段落（不能被删除）
     */
function isProtectedParagraph(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
        if (element.tagName !== 'P') return false;
        const isEmpty = !element.textContent.trim() && 
            (element.innerHTML === '<br>' || element.innerHTML === '' || element.childNodes.length === 0);
        if (!isEmpty) return false;
        let prevSibling = element.previousSibling;
        while (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && !prevSibling.textContent.trim()) {
            prevSibling = prevSibling.previousSibling;
        }
        if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE && 
            prevSibling.tagName === 'PRE' && prevSibling.getAttribute('contenteditable') === 'false') {
            return true;
        }
        let nextSibling = element.nextSibling;
        while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.trim()) {
            nextSibling = nextSibling.nextSibling;
        }
        if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && 
            nextSibling.tagName === 'PRE' && nextSibling.getAttribute('contenteditable') === 'false') {
            return true;
        }
        return false;
    }
    markdownPreview.addEventListener('keydown', (e) => {
        if (e.key !== 'Backspace' && e.key !== 'Delete') return;
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        let container = range.startContainer;
        const selectedMedia = getSelectedMedia(range, e.key);
        if (selectedMedia.element) {
            e.preventDefault();
            deleteMediaElement(selectedMedia.element);
            return;
        }
        const archiveElement = getSelectedArchive(range, e.key);
        if (archiveElement) {
            e.preventDefault();
            if (typeof deleteArchiveElement === 'function') {
                deleteArchiveElement(archiveElement);
            } else {
                archiveElement.remove();
                syncPreviewToTextarea();
            }
            return;
        }
        const figcaption = container.nodeType === Node.TEXT_NODE 
            ? container.parentNode.closest('figcaption') 
            : container.closest?.('figcaption');
        if (figcaption) {
            const figure = figcaption.closest('figure');
            if (figure) {
                const figcaptionText = figcaption.textContent || '';
                if (!figcaptionText.trim() || range.toString() === figcaptionText) {
                    e.preventDefault();
                    const media = figure.querySelector('img') || figure.querySelector('video');
                    if (media) {
                        deleteMediaElement(media);
                    }
                    return;
                }
            }
        }
        let currentPara = container;
        if (currentPara.nodeType === Node.TEXT_NODE) {
            currentPara = currentPara.parentNode;
        }
        while (currentPara && currentPara !== markdownPreview && currentPara.tagName !== 'P') {
            currentPara = currentPara.parentNode;
        }
        if (!currentPara || currentPara === markdownPreview) return;
        if (isProtectedParagraph(currentPara)) {
            const isEmpty = !currentPara.textContent.trim();
            if (isEmpty) {
                e.preventDefault();
                return;
            }
        }
        if (e.key === 'Backspace') {
            if (range.collapsed && range.startOffset === 0) {
                let prevElement = currentPara.previousSibling;
                while (prevElement && prevElement.nodeType === Node.TEXT_NODE && !prevElement.textContent.trim()) {
                    prevElement = prevElement.previousSibling;
                }
                if (prevElement && isProtectedParagraph(prevElement)) {
                    e.preventDefault();
                    return;
                }
                if (prevElement && prevElement.nodeType === Node.ELEMENT_NODE && 
                    prevElement.tagName === 'PRE' && prevElement.getAttribute('contenteditable') === 'false') {
                    e.preventDefault();
                    return;
                }
            }
        }
        if (e.key === 'Delete') {
            const atEnd = range.collapsed && 
                (range.startOffset === (container.nodeType === Node.TEXT_NODE ? container.textContent.length : container.childNodes.length));
            if (atEnd || (currentPara.textContent && range.startOffset >= currentPara.textContent.length)) {
                let nextElement = currentPara.nextSibling;
                while (nextElement && nextElement.nodeType === Node.TEXT_NODE && !nextElement.textContent.trim()) {
                    nextElement = nextElement.nextSibling;
                }
                if (nextElement && isProtectedParagraph(nextElement)) {
                    e.preventDefault();
                    return;
                }
                if (nextElement && nextElement.nodeType === Node.ELEMENT_NODE && 
                    nextElement.tagName === 'PRE' && nextElement.getAttribute('contenteditable') === 'false') {
                    e.preventDefault();
                    return;
                }
            }
        }
    });
    const codeObserver = new MutationObserver((mutations) => {
        let needsUpdate = false;
        let needsProtectionCheck = false;
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && (node.matches('pre') || node.querySelector('pre'))) {
                            needsUpdate = true;
                        }
                    }
                });
                if (mutation.removedNodes.length > 0) {
                    needsProtectionCheck = true;
                }
            }
        });
        if (needsUpdate) {
            setTimeout(initCodeBlocks, 10);
        }
        if (needsProtectionCheck) {
            setTimeout(() => {
                const codeBlocks = markdownPreview.querySelectorAll('pre[contenteditable="false"]');
                codeBlocks.forEach(pre => {
                    ensureEditableAroundCodeBlock(pre);
                });
                cleanupOrphanedFigcaptions();
            }, 10);
        }
    });
    codeObserver.observe(markdownPreview, {
        childList: true,
        subtree: true
    });
    setTimeout(initCodeBlocks, 100);
}
