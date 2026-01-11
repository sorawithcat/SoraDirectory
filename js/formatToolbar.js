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
    if (!markdownPreview.contains(range.commonAncestorContainer) && 
        !range.commonAncestorContainer.contains(markdownPreview)) {
        const previewRange = document.createRange();
        previewRange.selectNodeContents(markdownPreview);
        if (range.compareBoundaryPoints(Range.START_TO_START, previewRange) < 0 ||
            range.compareBoundaryPoints(Range.END_TO_END, previewRange) > 0) {
            return { text: '', range: null };
        }
    }
    const text = range.toString().trim();
    return {
        text: text,
        range: range.cloneRange()
    };
}
/**
 * 显示文字格式工具栏
 * @param {MouseEvent} e - 鼠标事件对象
 */
function showTextFormatToolbar(e) {
    syncPreviewToTextarea();
    const previewSelection = getPreviewSelection();
    const hasSelection = previewSelection && previewSelection.text && previewSelection.text.length > 0;
    if (hasSelection) {
        selectedText = previewSelection.text;
        selectionRange = previewSelection.range;
    } else {
        selectionRange = null;
    }
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
        setTimeout(() => {
            const previewSelection = getPreviewSelection();
            if (previewSelection && previewSelection.text && previewSelection.text.length > 0) {
                showTextFormatToolbar(e);
            } else {
                textFormatToolbar.style.display = 'none';
                textFormatToolbar.style.visibility = 'hidden';
            }
        }, 10);
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
    const initial = buildLinkValueForEdit(a);
    const val = await customPrompt('编辑链接地址:', initial);
    if (!val) return;
    applyLinkAttributesToElement(a, val);
    syncPreviewToTextarea();
}

async function editAnchorElement(anchorEl) {
    const current = anchorEl.getAttribute('data-anchor-name') || '';
    const val = await customPrompt('编辑锚点名:', current);
    if (!val) return;
    const name = normalizeAnchorName(val);
    if (!name) return;
    anchorEl.setAttribute('data-anchor-name', name);
    anchorEl.setAttribute('data-sora-anchor', 'true');
    if (!anchorEl.id || !String(anchorEl.id).startsWith('sora-anchor-')) {
        anchorEl.id = generateUniqueAnchorDomId(name);
    }
    syncPreviewToTextarea();
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
            window.open(href, '_blank');
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
    const selection = window.getSelection();
    let range;
    let selectedText = '';
    if (selectionRange) {
        range = selectionRange.cloneRange();
        selectedText = range.toString();
        selectionRange = null;
    } else if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0).cloneRange();
        selectedText = range.toString();
    } else {
        // 没有选中文字，尝试获取光标位置
        if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0).cloneRange();
        } else {
            // 创建光标位置的范围
            range = document.createRange();
            const textNode = markdownPreview.childNodes[0] || markdownPreview;
            if (textNode.nodeType === Node.TEXT_NODE) {
                range.setStart(textNode, textNode.length);
                range.setEnd(textNode, textNode.length);
            } else {
                range.setStart(markdownPreview, markdownPreview.childNodes.length);
                range.setEnd(markdownPreview, markdownPreview.childNodes.length);
            }
        }
    }
    if (!range) return;

    if (textFormatToolbar) {
        textFormatToolbar.style.display = 'none';
        textFormatToolbar.style.visibility = 'hidden';
    }

    // 辅助函数：提取选中范围的完整HTML内容（保留嵌套格式）
    function getRangeHtml(range) {
        const contents = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(contents);
        return tempDiv.innerHTML;
    }
    // 辅助函数：在选中范围内查找指定标签（处理选中内容包含完整标签的情况）
    function findTagInSelection(range, tagName) {
        // 获取选中范围的公共祖先
        const ancestor = range.commonAncestorContainer;
        const container = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode : ancestor;
        // 在公共祖先中查找指定标签
        const tags = container.getElementsByTagName ? container.getElementsByTagName(tagName) : [];
        for (let tag of tags) {
            // 使用 intersectsNode 检查选中范围是否与标签有交集
            if (range.intersectsNode(tag)) {
                return tag;
            }
        }
        // 也检查祖先链中是否有该标签
        let parent = container;
        while (parent && parent !== markdownPreview) {
            if (parent.tagName === tagName) {
                return parent;
            }
            parent = parent.parentNode;
        }
        return null;
    }
    // 辅助函数：检查选中范围是否完全在指定的格式标签内
    function isWrappedInTag(range, tagNames) {
        if (!range || !selectedText) return false;
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        // 方法1：检查选中内容是否恰好是一个格式标签（双击选中整个标签的情况）
        const contents = range.cloneContents();
        if (contents.childNodes.length === 1) {
            const singleChild = contents.childNodes[0];
            if (singleChild.nodeType === Node.ELEMENT_NODE && tagNames.includes(singleChild.tagName)) {
                // 选中的内容恰好是一个格式标签，找到原始DOM中的标签
                // 需要从父元素中找到这个标签
                const parentElement = startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentNode : startContainer;
                if (parentElement && parentElement.nodeType === Node.ELEMENT_NODE) {
                    // 遍历父元素的子节点，找到包含选中内容的标签
                    for (let child of parentElement.childNodes) {
                        if (child.nodeType === Node.ELEMENT_NODE && tagNames.includes(child.tagName)) {
                            // 检查这个标签是否在选中范围内
                            const childRange = document.createRange();
                            childRange.selectNode(child);
                            if (range.compareBoundaryPoints(Range.START_TO_START, childRange) <= 0 &&
                                range.compareBoundaryPoints(Range.END_TO_END, childRange) >= 0) {
                                return child;
                            }
                        }
                    }
                }
            }
        }
        // 方法2：检查起始和结束容器是否都在同一个格式标签内（原有逻辑）
        let startParent = startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentNode : startContainer;
        let endParent = endContainer.nodeType === Node.TEXT_NODE ? endContainer.parentNode : endContainer;
        // 向上查找格式标签
        while (startParent && startParent !== markdownPreview) {
            if (startParent.nodeType === Node.ELEMENT_NODE && tagNames.includes(startParent.tagName)) {
                // 检查结束位置是否也在同一个标签内
                let checkParent = endParent;
                while (checkParent && checkParent !== markdownPreview) {
                    if (checkParent === startParent) {
                        // 检查选中范围是否完全包含在标签内
                        const tagRange = document.createRange();
                        tagRange.selectNodeContents(startParent);
                        // 检查选中范围的开始和结束是否都在标签范围内
                        const startCompare = range.compareBoundaryPoints(Range.START_TO_START, tagRange);
                        const endCompare = range.compareBoundaryPoints(Range.END_TO_END, tagRange);
                        // 如果选中范围完全在标签内（开始>=标签开始，结束<=标签结束）
                        if (startCompare >= 0 && endCompare <= 0) {
                            return startParent;
                        }
                    }
                    checkParent = checkParent.parentNode;
                }
            }
            startParent = startParent.parentNode;
        }
        return false;
    }
    // 辅助函数：移除格式标签但保留内容
    function unwrapFormatTag(tagElement, range) {
        const parent = tagElement.parentNode;
        if (!parent) return;
        // 获取标签内的所有内容
        const contents = Array.from(tagElement.childNodes);
        // 在标签之前插入所有内容
        contents.forEach(node => {
            parent.insertBefore(node.cloneNode(true), tagElement);
        });
        // 删除原标签
        tagElement.remove();
        // 重新设置选中范围
        const newRange = document.createRange();
        if (contents.length > 0) {
            const firstNode = contents[0];
            const lastNode = contents[contents.length - 1];
            if (firstNode.nodeType === Node.TEXT_NODE) {
                newRange.setStart(firstNode, 0);
            } else {
                newRange.setStartBefore(firstNode);
            }
            if (lastNode.nodeType === Node.TEXT_NODE) {
                newRange.setEnd(lastNode, lastNode.textContent.length);
            } else {
                newRange.setEndAfter(lastNode);
            }
        } else {
            newRange.setStartAfter(tagElement);
            newRange.setEndAfter(tagElement);
        }
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
    // 辅助函数：查找包含指定样式的元素
    function findElementWithStyle(range, styleProperty) {
        const ancestor = range.commonAncestorContainer;
        const container = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode : ancestor;
        // 向上查找包含该样式的元素
        let parent = container;
        while (parent && parent !== markdownPreview) {
            if (parent.nodeType === Node.ELEMENT_NODE && parent.tagName === 'SPAN') {
                const style = parent.getAttribute('style') || '';
                if (style.includes(styleProperty)) {
                    return parent;
                }
            }
            parent = parent.parentNode;
        }
        // 也在选中范围内查找
        const contents = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(contents);
        const spans = tempDiv.querySelectorAll('span[style]');
        for (let span of spans) {
            const style = span.getAttribute('style') || '';
            if (style.includes(styleProperty)) {
                // 在原始DOM中查找对应的元素
                const containerSpans = container.getElementsByTagName ? container.getElementsByTagName('SPAN') : [];
                for (let s of containerSpans) {
                    if (s.getAttribute('style') === span.getAttribute('style') && range.intersectsNode(s)) {
                        return s;
                    }
                }
            }
        }
        return null;
    }
    // 辅助函数：获取元素中指定样式属性的值
    function getStyleValue(element, styleProperty) {
        if (!element || !element.getAttribute) return null;
        const style = element.getAttribute('style') || '';
        const regex = new RegExp(styleProperty + ':\\s*([^;]+)', 'i');
        const match = style.match(regex);
        return match ? match[1].trim() : null;
    }
    let formattedHtml = '';
    let shouldUnwrap = false;
    let unwrapTag = null;
    // 获取选中范围的完整HTML内容（保留嵌套格式）
    const selectedHtml = selectedText ? getRangeHtml(range) : '';
    switch(command) {
        // 标题 H1-H6
        case 'h1':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H1']);
            if (!unwrapTag) unwrapTag = findTagInSelection(range, 'H1');
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h1>' + selectedHtml + '</h1>';
            }
            break;
        case 'h2':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H2']);
            if (!unwrapTag) unwrapTag = findTagInSelection(range, 'H2');
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h2>' + selectedHtml + '</h2>';
            }
            break;
        case 'h3':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H3']);
            if (!unwrapTag) unwrapTag = findTagInSelection(range, 'H3');
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h3>' + selectedHtml + '</h3>';
            }
            break;
        case 'h4':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H4']);
            if (!unwrapTag) unwrapTag = findTagInSelection(range, 'H4');
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h4>' + selectedHtml + '</h4>';
            }
            break;
        case 'h5':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H5']);
            if (!unwrapTag) unwrapTag = findTagInSelection(range, 'H5');
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h5>' + selectedHtml + '</h5>';
            }
            break;
        case 'h6':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H6']);
            if (!unwrapTag) unwrapTag = findTagInSelection(range, 'H6');
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h6>' + selectedHtml + '</h6>';
            }
            break;
        // 文本格式
        case 'bold':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['STRONG', 'B']);
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'STRONG') || findTagInSelection(range, 'B');
            }
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<strong>' + selectedHtml + '</strong>';
            }
            break;
        case 'italic':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['EM', 'I']);
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'EM') || findTagInSelection(range, 'I');
            }
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<em>' + selectedHtml + '</em>';
            }
            break;
        case 'underline':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['U']);
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'U');
            }
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<u>' + selectedHtml + '</u>';
            }
            break;
        case 'strikethrough':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['S', 'STRIKE', 'DEL']);
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'S') || findTagInSelection(range, 'STRIKE') || findTagInSelection(range, 'DEL');
            }
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<s>' + selectedHtml + '</s>';
            }
            break;
        case 'code':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['CODE']);
            // 如果没有检测到，再检查选中内容是否包含完整的 CODE 标签
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'CODE');
            }
            if (unwrapTag && !unwrapTag.closest('pre')) {
                shouldUnwrap = true;
            } else if (!unwrapTag) {
                // code标签内不应该有HTML，使用纯文本
                formattedHtml = '<code>' + escapeHtml(selectedText) + '</code>';
            }
            break;
        case 'code-block':
            {
                // 弹出代码编辑对话框
                const result = await codeEditDialog(selectedText || '', 'javascript', CODE_LANG_OPTIONS, '插入代码块');
                if (result === null) return; // 用户取消
                const langValue = result.language ? escapeHtml(result.language.toLowerCase()) : 'code';
                const langClass = result.language ? ' class="language-' + langValue + '"' : '';
                const codeContent = escapeHtml(result.code);
                const highlightedCode = highlightCode(result.code, result.language);
                // 代码块不可编辑，点击时弹出编辑对话框
                formattedHtml = '<pre data-lang="' + langValue + '" contenteditable="false" class="code-block-editable"><code' + langClass + '>' + highlightedCode + '</code></pre>';
            }
            break;
        case 'highlight':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['MARK']);
            // 如果没有检测到，再检查选中内容是否包含完整的 MARK 标签
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'MARK');
            }
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<mark>' + selectedHtml + '</mark>';
            }
            break;
        case 'spoiler':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['SPOILER']);
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'SPOILER');
            }
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<spoiler>' + selectedHtml + '</spoiler>';
            }
            break;
        case 'superscript':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['SUP']);
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'SUP');
            }
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<sup>' + selectedHtml + '</sup>';
            }
            break;
        case 'subscript':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['SUB']);
            if (!unwrapTag) {
                unwrapTag = findTagInSelection(range, 'SUB');
            }
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<sub>' + selectedHtml + '</sub>';
            }
            break;
        case 'anchor':
            {
                const nameInput = await customPrompt('输入锚点名:', '');
                if (!nameInput) return;
                const anchorName = normalizeAnchorName(nameInput);
                if (!anchorName) return;

                const domId = generateUniqueAnchorDomId(anchorName);
                const anchorHtml = '<span id="' + escapeHtml(domId) + '" class="sora-anchor" data-sora-anchor="true" data-anchor-name="' + escapeHtml(anchorName) + '">\u200B</span>';
                formattedHtml = selectedText ? (anchorHtml + selectedHtml) : anchorHtml;
            }
            break;
        case 'link':
            {
                const url = await customPrompt('输入链接地址:', 'https://');
                if (!url) return;

                const trimmed = String(url).trim();
                const displayHtml = selectedText ? selectedHtml : escapeHtml(trimmed);

                if (trimmed.startsWith('#')) {
                    const anchorName = normalizeAnchorName(trimmed);
                    formattedHtml = '<a href="#' + escapeHtml(anchorName) + '" data-sora-link="anchor" data-anchor-id="' + escapeHtml(anchorName) + '">' + displayHtml + '</a>';
                    break;
                }

                const lower = trimmed.toLowerCase();
                const isDir = lower.startsWith('dir:') || lower.startsWith('目录:');
                const isName = lower.startsWith('name:') || lower.startsWith('目录名:');
                if (isDir || isName) {
                    const prefixLen = trimmed.indexOf(':') + 1;
                    const rest = trimmed.substring(prefixLen);
                    const hashIndex = rest.indexOf('#');
                    const mainPart = (hashIndex >= 0 ? rest.substring(0, hashIndex) : rest).trim();
                    const anchorPartRaw = (hashIndex >= 0 ? rest.substring(hashIndex + 1) : '').trim();
                    const anchorPart = anchorPartRaw ? normalizeAnchorName(anchorPartRaw) : '';

                    const attrs = [];
                    attrs.push('href="sora-dir:' + escapeHtml(mainPart) + (anchorPart ? ('#' + escapeHtml(anchorPart)) : '') + '"');
                    attrs.push('data-sora-link="dir"');

                    if (isDir) {
                        attrs.push('data-dir-id="' + escapeHtml(mainPart) + '"');
                    } else {
                        attrs.push('data-dir-name="' + escapeHtml(mainPart) + '"');
                    }
                    if (anchorPart) {
                        attrs.push('data-anchor-id="' + escapeHtml(anchorPart) + '"');
                    }
                    formattedHtml = '<a ' + attrs.join(' ') + '>' + displayHtml + '</a>';
                    break;
                }

                if (selectedText) {
                    formattedHtml = '<a href="' + escapeHtml(trimmed) + '" target="_blank">' + selectedHtml + '</a>';
                } else {
                    formattedHtml = '<a href="' + escapeHtml(trimmed) + '" target="_blank">' + escapeHtml(trimmed) + '</a>';
                }
            }
            break;
        // 文本颜色
        case 'color':
            if (!selectedText) return;
            // 查找是否已经有颜色样式
            const colorElement = findElementWithStyle(range, 'color');
            let currentColor = '#000000';
            if (colorElement) {
                const colorValue = getStyleValue(colorElement, 'color');
                if (colorValue) {
                    // 转换颜色值为十六进制
                    if (colorValue.startsWith('#')) {
                        currentColor = colorValue.toUpperCase();
                    } else if (colorValue.startsWith('rgb')) {
                        // 简单处理，提取rgb值并转换为十六进制（简化版）
                        const rgbMatch = colorValue.match(/\d+/g);
                        if (rgbMatch && rgbMatch.length >= 3) {
                            const r = parseInt(rgbMatch[0]).toString(16).padStart(2, '0');
                            const g = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
                            const b = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
                            currentColor = '#' + r + g + b;
                        }
                    }
                }
            }
            const selectedColor = await colorPickerDialog(currentColor, '选择文字颜色');
            if (!selectedColor) return;
            // 如果已经有颜色样式，需要移除后重新应用
            if (colorElement) {
                // 检查是否完全选中，如果是则移除样式
                const tagRange = document.createRange();
                tagRange.selectNodeContents(colorElement);
                const tagText = colorElement.textContent;
                const selectedTextClean = selectedText.replace(/\u200B/g, '');
                if (tagText.trim() === selectedTextClean.trim() || tagText === selectedTextClean) {
                    // 完全选中，直接替换颜色
                    colorElement.style.color = selectedColor;
                    syncPreviewToTextarea();
                    textFormatToolbar.style.display = 'none';
                    textFormatToolbar.style.visibility = 'hidden';
                    selectionRange = null;
                    return;
                }
            }
            formattedHtml = '<span style="color: ' + escapeHtml(selectedColor) + '">' + selectedHtml + '</span>';
            break;
        // 背景颜色
        case 'background-color':
            if (!selectedText) return;
            // 查找是否已经有背景颜色样式
            const bgColorElement = findElementWithStyle(range, 'background-color');
            let currentBgColor = '#FFFF00';
            if (bgColorElement) {
                const bgColorValue = getStyleValue(bgColorElement, 'background-color');
                if (bgColorValue) {
                    // 转换颜色值为十六进制
                    if (bgColorValue.startsWith('#')) {
                        currentBgColor = bgColorValue.toUpperCase();
                    } else if (bgColorValue.startsWith('rgb')) {
                        const rgbMatch = bgColorValue.match(/\d+/g);
                        if (rgbMatch && rgbMatch.length >= 3) {
                            const r = parseInt(rgbMatch[0]).toString(16).padStart(2, '0');
                            const g = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
                            const b = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
                            currentBgColor = '#' + r + g + b;
                        }
                    }
                }
            }
            const selectedBgColor = await colorPickerDialog(currentBgColor, '选择背景颜色');
            if (!selectedBgColor) return;
            // 如果已经有背景颜色样式，需要移除后重新应用
            if (bgColorElement) {
                const tagRange = document.createRange();
                tagRange.selectNodeContents(bgColorElement);
                const tagText = bgColorElement.textContent;
                const selectedTextClean = selectedText.replace(/\u200B/g, '');
                if (tagText.trim() === selectedTextClean.trim() || tagText === selectedTextClean) {
                    // 完全选中，直接替换背景颜色
                    bgColorElement.style.backgroundColor = selectedBgColor;
                    syncPreviewToTextarea();
                    textFormatToolbar.style.display = 'none';
                    textFormatToolbar.style.visibility = 'hidden';
                    selectionRange = null;
                    return;
                }
            }
            formattedHtml = '<span style="background-color: ' + escapeHtml(selectedBgColor) + '">' + selectedHtml + '</span>';
            break;
        // 列表
        case 'unordered-list':
            if (selectedText) {
                const lines = selectedText.split('\n').filter(line => line.trim());
                formattedHtml = '<ul>' + lines.map(line => '<li>' + line.trim() + '</li>').join('') + '</ul>';
            } else {
                formattedHtml = '<ul><li><br></li></ul>';
            }
            break;
        case 'ordered-list':
            if (selectedText) {
                const lines = selectedText.split('\n').filter(line => line.trim());
                formattedHtml = '<ol>' + lines.map(line => '<li>' + line.trim() + '</li>').join('') + '</ol>';
            } else {
                formattedHtml = '<ol><li><br></li></ol>';
            }
            break;
        case 'task-list':
            if (selectedText) {
                const lines = selectedText.split('\n').filter(line => line.trim());
                formattedHtml = '<ul class="contains-task-list">' + lines.map(line => {
                    const trimmed = line.trim();
                    // 检查是否已经是任务项格式
                    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
                        const content = trimmed.replace(/^-\s*\[[ xX]\]\s*/, '');
                        return '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox"' + 
                               (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]') ? ' checked' : '') + 
                               '> ' + content + '</li>';
                    }
                    return '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox"> ' + trimmed + '</li>';
                }).join('') + '</ul>';
            } else {
                formattedHtml = '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox"> <br></li></ul>';
            }
            break;
        // 其他块级元素
        case 'quote':
            if (selectedText) {
                formattedHtml = '<blockquote>' + selectedHtml + '</blockquote>';
            } else {
                formattedHtml = '<blockquote><br></blockquote>';
            }
            break;
        case 'paragraph':
            if (selectedText) {
                formattedHtml = '<p>' + selectedHtml + '</p>';
            } else {
                formattedHtml = '<p><br></p>';
            }
            break;
        case 'hr':
            formattedHtml = '<hr>';
            break;
        case 'table':
            const rows = await customPrompt('输入表格行数（默认3）:', '3');
            const cols = await customPrompt('输入表格列数（默认3）:', '3');
            const rowCount = parseInt(rows) || 3;
            const colCount = parseInt(cols) || 3;
            let tableHtml = '<table>\n<thead>\n<tr>';
            for (let i = 0; i < colCount; i++) {
                tableHtml += '<th>列' + (i + 1) + '</th>';
            }
            tableHtml += '</tr>\n</thead>\n<tbody>\n';
            for (let i = 0; i < rowCount - 1; i++) {
                tableHtml += '<tr>';
                for (let j = 0; j < colCount; j++) {
                    tableHtml += '<td>内容</td>';
                }
                tableHtml += '</tr>\n';
            }
            tableHtml += '</tbody>\n</table>';
            formattedHtml = tableHtml;
            break;
    }
    // 如果需要取消格式，先处理取消格式
    if (shouldUnwrap && unwrapTag) {
        // 获取标签的父节点
        const parent = unwrapTag.parentNode;
        if (!parent) {
            textFormatToolbar.style.display = 'none';
            textFormatToolbar.style.visibility = 'hidden';
            selectionRange = null;
            return;
        }
        // 保存选中文本，用于后续重新选中
        const textToKeep = selectedText;
        const tagName = unwrapTag.tagName;
        // 检查选中范围是否完全覆盖格式标签的内容
        const tagRange = document.createRange();
        tagRange.selectNodeContents(unwrapTag);
        const tagText = unwrapTag.textContent;
        const selectedTextClean = selectedText.replace(/\u200B/g, ''); // 移除零宽字符
        // 判断是否完全选中（允许一些误差，如零宽字符）
        const isFullySelected = selectedTextClean === tagText || 
                               tagText.startsWith(selectedTextClean) && tagText.length - selectedTextClean.length <= 1 ||
                               selectedTextClean.startsWith(tagText);
        if (isFullySelected || unwrapTag.textContent.trim() === selectedTextClean.trim()) {
            // 完全选中，移除整个标签
            const contents = Array.from(unwrapTag.childNodes);
            const insertedNodes = [];
            contents.forEach(node => {
                const cloned = node.cloneNode(true);
                parent.insertBefore(cloned, unwrapTag);
                insertedNodes.push(cloned);
            });
            unwrapTag.remove();
            // 重新设置选中范围
            const newRange = document.createRange();
            const selection = window.getSelection();
            if (insertedNodes.length > 0) {
                const firstNode = insertedNodes[0];
                const lastNode = insertedNodes[insertedNodes.length - 1];
                if (firstNode.nodeType === Node.TEXT_NODE) {
                    newRange.setStart(firstNode, 0);
                } else {
                    newRange.setStartBefore(firstNode);
                }
                if (lastNode.nodeType === Node.TEXT_NODE) {
                    newRange.setEnd(lastNode, lastNode.textContent.length);
                } else {
                    newRange.setEndAfter(lastNode);
                }
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        } else {
            // 部分选中，需要拆分标签
            // 获取格式标签内选中部分的相对位置
            const fullText = unwrapTag.textContent;
            const selStart = fullText.indexOf(selectedTextClean);
            if (selStart !== -1) {
                const selEnd = selStart + selectedTextClean.length;
                const beforeText = fullText.substring(0, selStart);
                const afterText = fullText.substring(selEnd);
                // 构建新的 HTML 结构
                const fragment = document.createDocumentFragment();
                // 前面部分（保持格式）
                if (beforeText) {
                    const beforeTag = document.createElement(tagName);
                    beforeTag.textContent = beforeText;
                    fragment.appendChild(beforeTag);
                }
                // 选中部分（无格式）
                const middleText = document.createTextNode(selectedTextClean);
                fragment.appendChild(middleText);
                // 后面部分（保持格式）
                if (afterText) {
                    const afterTag = document.createElement(tagName);
                    afterTag.textContent = afterText;
                    fragment.appendChild(afterTag);
                }
                // 替换原标签
                parent.insertBefore(fragment, unwrapTag);
                unwrapTag.remove();
                // 选中中间的无格式文本
                const newRange = document.createRange();
                const selection = window.getSelection();
                newRange.selectNode(middleText);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // 找不到选中文本的位置，回退到移除整个标签
                const contents = Array.from(unwrapTag.childNodes);
                contents.forEach(node => {
                    parent.insertBefore(node.cloneNode(true), unwrapTag);
                });
                unwrapTag.remove();
            }
        }
        // 同步到 textarea
        syncPreviewToTextarea();
        textFormatToolbar.style.display = 'none';
        textFormatToolbar.style.visibility = 'hidden';
        selectionRange = null;
        return;
    }
    if (formattedHtml) {
        range.deleteContents();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = formattedHtml;
        const fragment = document.createDocumentFragment();
        let insertedElement = null;
        while (tempDiv.firstChild) {
            const node = tempDiv.firstChild;
            fragment.appendChild(node);
            insertedElement = node; // 保存最后插入的元素
        }
        range.insertNode(fragment);
        // 将光标移动到格式化元素之后，避免后续输入也被格式化
        const newRange = document.createRange();
        const selection = window.getSelection();
        // 辅助函数：检查节点是否在格式标签内
        function isInFormatTag(node) {
            const formatTags = ['EM', 'I', 'STRONG', 'B', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'MARK', 'SUP', 'SUB', 'SPOILER'];
            let parent = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
            while (parent && parent !== markdownPreview) {
                if (parent.nodeType === Node.ELEMENT_NODE && formatTags.includes(parent.tagName)) {
                    return true;
                }
                parent = parent.parentNode;
            }
            return false;
        }
        // 辅助函数：找到最近的块级元素
        function findBlockParent(node) {
            const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'UL', 'OL', 'PRE'];
            let parent = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
            while (parent && parent !== markdownPreview) {
                if (parent.nodeType === Node.ELEMENT_NODE && blockTags.includes(parent.tagName)) {
                    return parent;
                }
                parent = parent.parentNode;
            }
            return markdownPreview;
        }
        if (insertedElement) {
            const parent = insertedElement.parentNode;
            if (parent) {
                // 检查插入的元素是否是行内格式标签
                const inlineFormatTags = ['EM', 'I', 'STRONG', 'B', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'MARK', 'SUP', 'SUB', 'A', 'SPOILER'];
                const isInlineFormat = inlineFormatTags.includes(insertedElement.tagName);
                if (isInlineFormat) {
                    // 对于行内格式，需要将光标放在格式标签外部
                    // 在格式标签之后创建一个文本节点用于放置光标
                    const textNode = document.createTextNode('\u200B'); // 零宽空格
                    if (insertedElement.nextSibling) {
                        parent.insertBefore(textNode, insertedElement.nextSibling);
                    } else {
                        parent.appendChild(textNode);
                    }
                    // 检查文本节点是否在格式标签内（理论上不应该，但检查一下）
                    if (isInFormatTag(textNode)) {
                        // 如果还在格式标签内，向上移动到块级元素
                        const blockParent = findBlockParent(textNode);
                        // 移除刚才创建的文本节点
                        textNode.remove();
                        // 在块级元素中创建新的文本节点
                        const newTextNode = document.createTextNode('\u200B');
                        blockParent.appendChild(newTextNode);
                        newRange.setStart(newTextNode, 0);
                        newRange.setEnd(newTextNode, 0);
                    } else {
                        newRange.setStart(textNode, 0);
                        newRange.setEnd(textNode, 0);
                    }
                } else {
                    // 对于块级元素，检查是否是列表
                    if (insertedElement.tagName === 'UL' || insertedElement.tagName === 'OL') {
                        // 对于列表，光标应该放在第一个列表项内部
                        const firstLi = insertedElement.querySelector('li');
                        if (firstLi) {
                            // 将光标放在第一个li内部，让浏览器自然处理
                            newRange.setStart(firstLi, 0);
                            newRange.setEnd(firstLi, 0);
                        } else {
                            // 如果没有li，在列表之后放置光标
                            newRange.setStartAfter(insertedElement);
                            newRange.setEndAfter(insertedElement);
                        }
                    } else if (insertedElement.tagName === 'PRE') {
                        // 对于代码块（contenteditable=false），需要在前后添加可编辑的段落
                        // 检查代码块前面是否有可编辑的元素
                        const prevSibling = insertedElement.previousSibling;
                        if (!prevSibling || (prevSibling.nodeType === Node.TEXT_NODE && !prevSibling.textContent.trim())) {
                            // 在代码块前面添加一个空段落
                            const beforePara = document.createElement('p');
                            beforePara.innerHTML = '<br>';
                            insertedElement.parentNode.insertBefore(beforePara, insertedElement);
                        }
                        // 检查代码块后面是否有可编辑的元素
                        const nextSibling = insertedElement.nextSibling;
                        if (!nextSibling || (nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.trim())) {
                            // 在代码块后面添加一个空段落
                            const afterPara = document.createElement('p');
                            afterPara.innerHTML = '<br>';
                            if (insertedElement.nextSibling) {
                                insertedElement.parentNode.insertBefore(afterPara, insertedElement.nextSibling);
                            } else {
                                insertedElement.parentNode.appendChild(afterPara);
                            }
                            // 将光标放在新段落中
                            newRange.setStart(afterPara, 0);
                            newRange.setEnd(afterPara, 0);
                        } else {
                            // 后面有内容，直接放在元素之后
                            newRange.setStartAfter(insertedElement);
                            newRange.setEndAfter(insertedElement);
                        }
                    } else {
                        // 对于其他块级元素，在元素之后放置光标
                        newRange.setStartAfter(insertedElement);
                        newRange.setEndAfter(insertedElement);
                    }
                }
            } else {
                // 如果找不到父节点，直接放在元素之后
                newRange.setStartAfter(insertedElement);
                newRange.setEndAfter(insertedElement);
            }
        } else {
            // 备用方案：光标放在插入位置之后
            if (range.startContainer && range.startContainer.parentNode) {
                const parent = range.startContainer.parentNode;
                // 创建一个文本节点用于放置光标
                const textNode = document.createTextNode('\u200B');
                if (range.startContainer.nextSibling) {
                    parent.insertBefore(textNode, range.startContainer.nextSibling);
                } else {
                    parent.appendChild(textNode);
                }
                newRange.setStart(textNode, 0);
                newRange.setEnd(textNode, 0);
            } else {
                // 最后备用：光标放在预览区域末尾
                const textNode = document.createTextNode('\u200B');
                markdownPreview.appendChild(textNode);
                newRange.setStart(textNode, 0);
                newRange.setEnd(textNode, 0);
            }
        }
        // 清除当前选择并设置新光标位置
        selection.removeAllRanges();
        selection.addRange(newRange);
        // 确保预览区域获得焦点
        markdownPreview.focus();
        // 使用 execCommand 清除格式状态，避免后续输入继承格式
        // 这会清除浏览器的格式状态，但不会影响已插入的HTML元素
        try {
            document.execCommand('removeFormat', false, null);
        } catch (e) {
            // 如果 execCommand 失败，忽略错误
        }
        // 再次确保光标位置正确（因为 removeFormat 可能会改变光标位置）
        setTimeout(() => {
            const currentSelection = window.getSelection();
            if (currentSelection.rangeCount > 0) {
                const currentRange = currentSelection.getRangeAt(0);
                // 检查光标是否在格式标签内
                let container = currentRange.startContainer;
                let node = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
                const formatTags = ['EM', 'I', 'STRONG', 'B', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'MARK', 'SUP', 'SUB', 'SPOILER'];
                while (node && node !== markdownPreview) {
                    if (node.nodeType === Node.ELEMENT_NODE && formatTags.includes(node.tagName)) {
                        // 光标仍在格式标签内，移出
                        const blockParent = findBlockParent(node);
                        const textNode = document.createTextNode('\u200B');
                        blockParent.appendChild(textNode);
                        const finalRange = document.createRange();
                        finalRange.setStart(textNode, 0);
                        finalRange.setEnd(textNode, 0);
                        currentSelection.removeAllRanges();
                        currentSelection.addRange(finalRange);
                        break;
                    }
                    node = node.parentNode;
                }
            }
        }, 0);
        // 同步到 textarea
        syncPreviewToTextarea();
    }
    textFormatToolbar.style.display = 'none';
    textFormatToolbar.style.visibility = 'hidden';
    selectionRange = null;
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
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        btn.textContent = '已复制!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '复制';
            btn.classList.remove('copied');
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
    if (!code) return code;
    let escaped = escapeHtml(code);
    const lang = (language || '').toLowerCase();
    const rules = {
        string: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        comment: /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|&lt;!--[\s\S]*?--&gt;)/gm,
        number: /\b(\d+\.?\d*)\b/g,
    };
    if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(lang)) {
        rules.keyword = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|null|undefined|true|false)\b/g;
        rules.function = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;
        rules.class = /\b([A-Z][a-zA-Z0-9_$]*)\b/g;
    }
    else if (['python', 'py'].includes(lang)) {
        rules.keyword = /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|lambda|yield|pass|break|continue|and|or|not|in|is|None|True|False|self)\b/g;
        rules.function = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g;
    }
    else if (['html', 'xml', 'svg'].includes(lang)) {
        rules.tag = /(&lt;\/?[a-zA-Z][a-zA-Z0-9]*)/g;
        rules.attr = /\s([a-zA-Z\-]+)=/g;
    }
    else if (['css', 'scss', 'less'].includes(lang)) {
        rules.property = /([a-zA-Z\-]+)\s*:/g;
        rules.keyword = /(@[a-zA-Z]+|!important)/g;
    }
    else if (['sql'].includes(lang)) {
        rules.keyword = /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|NULL|NOT|IN|LIKE|BETWEEN|IS|TRUE|FALSE|COUNT|SUM|AVG|MIN|MAX|DISTINCT)\b/gi;
    }
    else if (['c', 'cpp', 'c++', 'csharp', 'c#', 'java'].includes(lang)) {
        rules.keyword = /\b(int|float|double|char|void|bool|boolean|string|class|struct|enum|public|private|protected|static|const|final|new|return|if|else|for|while|do|switch|case|break|continue|try|catch|throw|finally|null|true|false|this|super|import|package|using|namespace|include)\b/g;
        rules.function = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g;
    }
    else if (['go', 'golang'].includes(lang)) {
        rules.keyword = /\b(package|import|func|return|var|const|type|struct|interface|map|chan|go|defer|if|else|for|range|switch|case|default|break|continue|select|nil|true|false|make|new|len|cap|append|copy|delete)\b/g;
    }
    else if (['rust', 'rs'].includes(lang)) {
        rules.keyword = /\b(fn|let|mut|const|if|else|match|loop|while|for|in|return|struct|enum|impl|trait|pub|use|mod|crate|self|super|true|false|Some|None|Ok|Err)\b/g;
    }
    const tokens = [];
    let result = escaped;
    if (rules.comment) {
        result = result.replace(rules.comment, (match) => {
            const index = tokens.length;
            tokens.push('<span class="comment">' + match + '</span>');
            return '___TOKEN_' + index + '___';
        });
    }
    if (rules.string) {
        result = result.replace(rules.string, (match) => {
            const index = tokens.length;
            tokens.push('<span class="string">' + match + '</span>');
            return '___TOKEN_' + index + '___';
        });
    }
    if (rules.keyword) {
        result = result.replace(rules.keyword, '<span class="keyword">$1</span>');
    }
    if (rules.function) {
        result = result.replace(rules.function, '<span class="function">$1</span>');
    }
    if (rules.class) {
        result = result.replace(rules.class, '<span class="class-name">$1</span>');
    }
    if (rules.number) {
        result = result.replace(rules.number, '<span class="number">$1</span>');
    }
    if (rules.tag) {
        result = result.replace(rules.tag, '<span class="tag">$1</span>');
    }
    if (rules.attr) {
        result = result.replace(rules.attr, ' <span class="attr-name">$1</span>=');
    }
    if (rules.property) {
        result = result.replace(rules.property, '<span class="property">$1</span>:');
    }
    tokens.forEach((token, index) => {
        result = result.replace('___TOKEN_' + index + '___', token);
    });
    return result;
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
            const textArea = document.createElement('textarea');
            textArea.value = code;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                langLabel.textContent = '已复制!';
                langLabel.classList.add('copied');
                setTimeout(() => {
                    langLabel.textContent = langLabel.dataset.lang;
                    langLabel.classList.remove('copied');
                }, 2000);
            } catch (e) {
                langLabel.textContent = '复制失败';
                setTimeout(() => {
                    langLabel.textContent = langLabel.dataset.lang;
                }, 2000);
            }
            document.body.removeChild(textArea);
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
    // 获取当前语言和代码
    const langAttr = pre.getAttribute('data-lang') || '';
    const langClass = Array.from(codeElement.classList).find(c => c.startsWith('language-'));
    const currentLang = langClass ? langClass.replace('language-', '') : langAttr;
    const currentCode = codeElement.textContent;
    // 弹出编辑对话框
    const result = await codeEditDialog(currentCode, currentLang, CODE_LANG_OPTIONS, '编辑代码块');
    if (result === null) return; // 用户取消
    if (result.delete) {
        // 删除代码块
        pre.remove();
        syncPreviewToTextarea();
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
    syncPreviewToTextarea();
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