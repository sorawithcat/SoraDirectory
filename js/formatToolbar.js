// ============================================
// 格式工具栏模块 (formatToolbar.js)
// 功能：悬浮格式工具栏、文本格式化操作
// 依赖：globals.js, preview.js, dialog.js
// ============================================

// -------------------- 常量定义 --------------------

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
    
    // 检查选中范围是否在预览区域内
    if (!markdownPreview.contains(range.commonAncestorContainer) && 
        !range.commonAncestorContainer.contains(markdownPreview)) {
        // 如果选中范围不在预览区域内，检查是否有交集
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
    // 先同步预览区域到 textarea
    syncPreviewToTextarea();
    
    const previewSelection = getPreviewSelection();
    const hasSelection = previewSelection && previewSelection.text && previewSelection.text.length > 0;
    
    if (hasSelection) {
        selectedText = previewSelection.text;
        selectionRange = previewSelection.range;
    } else {
        selectionRange = null;
    }
    
    // 先显示工具栏（但可能暂时在屏幕外），以便获取尺寸
    textFormatToolbar.style.display = 'flex';
    textFormatToolbar.style.visibility = 'hidden'; // 先隐藏，等位置计算好后再显示
    
    // 获取工具栏尺寸
    const toolbarWidth = textFormatToolbar.offsetWidth || 400;
    const toolbarHeight = textFormatToolbar.offsetHeight || 40;
    
    // 显示工具栏
    const rect = markdownPreview.getBoundingClientRect();
    let x, y;
    
    if (hasSelection && previewSelection.range) {
        // 有选中文字，使用选中区域的位置
        const rangeRect = previewSelection.range.getBoundingClientRect();
        x = rangeRect.left + rangeRect.width / 2;
        y = rangeRect.top;
    } else if (e) {
        // 没有选中文字，使用鼠标右键点击位置
        x = e.clientX;
        y = e.clientY;
    } else {
        // 使用光标位置
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
    
    // 计算位置（使用视口坐标，因为 position: fixed）
    let leftPos = x - toolbarWidth / 2;
    let topPos = y - toolbarHeight - 10;
    
    // 边界检查（相对于视口）
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 水平边界检查
    if (leftPos < 10) {
        leftPos = 10; // 距离左边缘至少10px
    } else if (leftPos + toolbarWidth > viewportWidth - 10) {
        leftPos = viewportWidth - toolbarWidth - 10; // 距离右边缘至少10px
    }
    
    // 垂直边界检查
    if (topPos < 10) {
        topPos = y + toolbarHeight + 10; // 显示在下方
    } else if (topPos + toolbarHeight > viewportHeight - 10) {
        topPos = viewportHeight - toolbarHeight - 10; // 确保不超出视口底部
    }
    
    // 根据是否有选中文字来控制按钮显示
    if (hasSelection) {
        textFormatToolbar.classList.add('has-selection');
    } else {
        textFormatToolbar.classList.remove('has-selection');
    }
    
    // 设置位置并显示
    textFormatToolbar.style.left = leftPos + 'px';
    textFormatToolbar.style.top = topPos + 'px';
    textFormatToolbar.style.visibility = 'visible';
}

// -------------------- 预览区域事件绑定 --------------------

// 预览区域鼠标抬起事件（显示工具栏）
if (markdownPreview) {
    markdownPreview.addEventListener("mouseup", function(e) {
        setTimeout(() => {
            const previewSelection = getPreviewSelection();
            // 有选中文字时显示工具栏
            if (previewSelection && previewSelection.text && previewSelection.text.length > 0) {
                showTextFormatToolbar(e);
            } else {
                textFormatToolbar.style.display = 'none';
                textFormatToolbar.style.visibility = 'hidden';
            }
        }, 10);
    });
    
}

// -------------------- 格式按钮事件绑定 --------------------

// 格式化按钮点击事件
document.querySelectorAll('.format-btn').forEach(btn => {
    // 跳过链接按钮，因为它有单独的处理
    if (btn.id === 'linkBtn') return;
    
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const command = this.getAttribute('data-command');
        if (command) {
            applyFormat(command);
        }
    });
});

// 链接按钮点击事件（单独处理，避免重复绑定）
const linkBtn = document.getElementById('linkBtn');
if (linkBtn) {
    linkBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // 插入链接
        applyFormat('link');
    });
}

// 预览区域中的链接支持 Ctrl+单击打开
if (markdownPreview) {
    markdownPreview.addEventListener('click', function(e) {
        // 检查是否按下了 Ctrl 或 Cmd 键
        if (e.ctrlKey || e.metaKey) {
            // 查找点击的元素是否是链接或其父元素是链接
            let target = e.target;
            while (target && target !== markdownPreview) {
                if (target.tagName === 'A') {
                    const href = target.getAttribute('href');
                    if (href) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(href, '_blank');
                        return;
                    }
                }
                target = target.parentNode;
            }
        }
        
    });
}

// -------------------- 格式化核心函数 --------------------
// 注意：escapeHtml 函数已移至 globals.js

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
        // 链接和图片
        case 'link':
            const url = await customPrompt('输入链接地址:', 'https://');
            if (!url) return;
            
            if (selectedText) {
                formattedHtml = '<a href="' + escapeHtml(url) + '" target="_blank">' + selectedHtml + '</a>';
            } else {
                formattedHtml = '<a href="' + escapeHtml(url) + '" target="_blank">' + escapeHtml(url) + '</a>';
            }
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
    // 暂时禁用自动添加复制按钮，以确保代码块可正常编辑
    // 用户可以通过选中代码后 Ctrl+C 复制
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
        // 降级方案
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
    
    // 先转义 HTML
    let escaped = escapeHtml(code);
    
    // 根据语言应用不同的高亮规则
    const lang = (language || '').toLowerCase();
    
    // 通用规则
    const rules = {
        // 字符串
        string: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        // 注释
        comment: /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|&lt;!--[\s\S]*?--&gt;)/gm,
        // 数字
        number: /\b(\d+\.?\d*)\b/g,
    };
    
    // JavaScript/TypeScript 关键词
    if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(lang)) {
        rules.keyword = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|null|undefined|true|false)\b/g;
        rules.function = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;
        rules.class = /\b([A-Z][a-zA-Z0-9_$]*)\b/g;
    }
    // Python 关键词
    else if (['python', 'py'].includes(lang)) {
        rules.keyword = /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|lambda|yield|pass|break|continue|and|or|not|in|is|None|True|False|self)\b/g;
        rules.function = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g;
    }
    // HTML/XML
    else if (['html', 'xml', 'svg'].includes(lang)) {
        rules.tag = /(&lt;\/?[a-zA-Z][a-zA-Z0-9]*)/g;
        rules.attr = /\s([a-zA-Z\-]+)=/g;
    }
    // CSS
    else if (['css', 'scss', 'less'].includes(lang)) {
        rules.property = /([a-zA-Z\-]+)\s*:/g;
        rules.keyword = /(@[a-zA-Z]+|!important)/g;
    }
    // SQL
    else if (['sql'].includes(lang)) {
        rules.keyword = /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|NULL|NOT|IN|LIKE|BETWEEN|IS|TRUE|FALSE|COUNT|SUM|AVG|MIN|MAX|DISTINCT)\b/gi;
    }
    // C/C++/C#/Java
    else if (['c', 'cpp', 'c++', 'csharp', 'c#', 'java'].includes(lang)) {
        rules.keyword = /\b(int|float|double|char|void|bool|boolean|string|class|struct|enum|public|private|protected|static|const|final|new|return|if|else|for|while|do|switch|case|break|continue|try|catch|throw|finally|null|true|false|this|super|import|package|using|namespace|include)\b/g;
        rules.function = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g;
    }
    // Go
    else if (['go', 'golang'].includes(lang)) {
        rules.keyword = /\b(package|import|func|return|var|const|type|struct|interface|map|chan|go|defer|if|else|for|range|switch|case|default|break|continue|select|nil|true|false|make|new|len|cap|append|copy|delete)\b/g;
    }
    // Rust
    else if (['rust', 'rs'].includes(lang)) {
        rules.keyword = /\b(fn|let|mut|const|if|else|match|loop|while|for|in|return|struct|enum|impl|trait|pub|use|mod|crate|self|super|true|false|Some|None|Ok|Err)\b/g;
    }
    
    // 应用高亮规则（注意顺序很重要）
    // 先处理注释和字符串，避免其中的关键词被误匹配
    const tokens = [];
    let result = escaped;
    
    // 提取注释和字符串，用占位符替代
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
    
    // 应用其他规则
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
    
    // 还原占位符
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
    
    // 计算从元素开头到光标的文本偏移量
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
    
    // 遍历文本节点找到正确的位置
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
    
    // 如果没找到，放到末尾
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
    
    // 获取语言
    const langAttr = pre.getAttribute('data-lang');
    const langClass = Array.from(codeElement.classList).find(c => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '') : langAttr;
    
    if (!lang || lang === 'code') return;
    
    // 获取纯文本内容
    const code = codeElement.textContent;
    
    // 应用高亮
    codeElement.innerHTML = highlightCode(code, lang);
    
    // 设置代码块不可编辑
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
        // 设置不可编辑
        pre.setAttribute('contenteditable', 'false');
        pre.classList.add('code-block-editable');
        
        // 应用语法高亮
        const codeElement = pre.querySelector('code');
        if (codeElement) {
            applyHighlightToCodeBlock(codeElement);
        }
        
        // 添加复制按钮（如果还没有）
        addCopyButtonToCodeBlock(pre);
        
        // 确保代码块前后有可编辑的元素，避免光标无法定位
        ensureEditableAroundCodeBlock(pre);
    });
}

/**
 * 为代码块添加语言标签（点击可复制）
 */
function addCopyButtonToCodeBlock(pre) {
    if (!pre) return;
    
    // 检查是否已经有语言标签
    if (pre.querySelector('.code-lang-label')) return;
    
    // 获取语言
    const lang = pre.getAttribute('data-lang') || 'code';
    
    const langLabel = document.createElement('button');
    langLabel.className = 'code-lang-label';
    langLabel.textContent = lang.toUpperCase();
    langLabel.type = 'button';
    langLabel.dataset.lang = lang.toUpperCase(); // 保存原始语言名称
    
    // 悬浮在代码块上时显示"复制"
    pre.addEventListener('mouseenter', () => {
        if (!langLabel.classList.contains('copied')) {
            langLabel.textContent = '复制';
        }
    });
    
    // 移出代码块时恢复语言名称
    pre.addEventListener('mouseleave', () => {
        if (!langLabel.classList.contains('copied')) {
            langLabel.textContent = langLabel.dataset.lang;
        }
    });
    
    langLabel.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation(); // 阻止触发代码块编辑
        
        const codeElement = pre.querySelector('code');
        if (!codeElement) return;
        
        const code = codeElement.textContent;
        
        try {
            await navigator.clipboard.writeText(code);
            
            // 显示复制成功
            langLabel.textContent = '已复制!';
            langLabel.classList.add('copied');
            
            // 2秒后恢复
            setTimeout(() => {
                langLabel.textContent = langLabel.dataset.lang;
                langLabel.classList.remove('copied');
            }, 2000);
        } catch (err) {
            // 降级方案：使用传统方法
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
    
    // 检查前面是否有可编辑的块级元素
    let prevSibling = pre.previousSibling;
    // 跳过空白文本节点
    while (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && !prevSibling.textContent.trim()) {
        prevSibling = prevSibling.previousSibling;
    }
    
    // 如果前面没有元素，或者前面也是一个不可编辑的 PRE，添加一个空段落
    if (!prevSibling || (prevSibling.nodeType === Node.ELEMENT_NODE && prevSibling.tagName === 'PRE' && prevSibling.getAttribute('contenteditable') === 'false')) {
        const beforePara = document.createElement('p');
        beforePara.innerHTML = '<br>';
        pre.parentNode.insertBefore(beforePara, pre);
    }
    
    // 检查后面是否有可编辑的块级元素
    let nextSibling = pre.nextSibling;
    // 跳过空白文本节点
    while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.trim()) {
        nextSibling = nextSibling.nextSibling;
    }
    
    // 如果后面没有元素，或者后面也是一个不可编辑的 PRE，添加一个空段落
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
        
        // 检查是否只包含 <br> 或为空
        const isEmpty = !element.textContent.trim() && 
            (element.innerHTML === '<br>' || element.innerHTML === '' || element.childNodes.length === 0);
        if (!isEmpty) return false;
        
        // 检查前面是否紧邻代码块
        let prevSibling = element.previousSibling;
        while (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && !prevSibling.textContent.trim()) {
            prevSibling = prevSibling.previousSibling;
        }
        if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE && 
            prevSibling.tagName === 'PRE' && prevSibling.getAttribute('contenteditable') === 'false') {
            return true;
        }
        
        // 检查后面是否紧邻代码块
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
    
    /**
     * 监听键盘事件，保护代码块前后的空段落，并处理图片删除
     */
    markdownPreview.addEventListener('keydown', (e) => {
        if (e.key !== 'Backspace' && e.key !== 'Delete') return;
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let container = range.startContainer;
        
        // 检查是否选中了媒体元素（图片或视频）或光标在媒体/figure 附近
        // 处理媒体删除：同时删除整个 figure
        const selectedMedia = getSelectedMedia(range, e.key);
        if (selectedMedia.element) {
            e.preventDefault();
            deleteMediaElement(selectedMedia.element);
            return;
        }
        
        // 检查是否选中或在压缩包附件附近
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
        
        // 检查是否在 figcaption 中，阻止单独删除图注/注释
        const figcaption = container.nodeType === Node.TEXT_NODE 
            ? container.parentNode.closest('figcaption') 
            : container.closest?.('figcaption');
        if (figcaption) {
            // 允许编辑图注内容，但如果整个图注被选中或要被完全删除，则删除整个 figure
            const figure = figcaption.closest('figure');
            if (figure) {
                const figcaptionText = figcaption.textContent || '';
                if (!figcaptionText.trim() || range.toString() === figcaptionText) {
                    e.preventDefault();
                    // 查找图片或视频
                    const media = figure.querySelector('img') || figure.querySelector('video');
                    if (media) {
                        deleteMediaElement(media);
                    }
                    return;
                }
            }
        }
        
        // 找到包含光标的段落元素
        let currentPara = container;
        if (currentPara.nodeType === Node.TEXT_NODE) {
            currentPara = currentPara.parentNode;
        }
        while (currentPara && currentPara !== markdownPreview && currentPara.tagName !== 'P') {
            currentPara = currentPara.parentNode;
        }
        
        if (!currentPara || currentPara === markdownPreview) return;
        
        // 检查当前段落是否是保护段落
        if (isProtectedParagraph(currentPara)) {
            // 如果是空段落且按了 Backspace 或 Delete
            const isEmpty = !currentPara.textContent.trim();
            if (isEmpty) {
                e.preventDefault();
                return;
            }
        }
        
        // 检查 Backspace 是否会删除到保护段落
        if (e.key === 'Backspace') {
            // 光标在段落开头
            if (range.collapsed && range.startOffset === 0) {
                let prevElement = currentPara.previousSibling;
                while (prevElement && prevElement.nodeType === Node.TEXT_NODE && !prevElement.textContent.trim()) {
                    prevElement = prevElement.previousSibling;
                }
                
                // 如果前一个元素是保护段落，阻止删除
                if (prevElement && isProtectedParagraph(prevElement)) {
                    e.preventDefault();
                    return;
                }
                
                // 如果前一个元素是代码块，阻止删除（不能合并到代码块）
                if (prevElement && prevElement.nodeType === Node.ELEMENT_NODE && 
                    prevElement.tagName === 'PRE' && prevElement.getAttribute('contenteditable') === 'false') {
                    e.preventDefault();
                    return;
                }
            }
        }
        
        // 检查 Delete 是否会删除到保护段落
        if (e.key === 'Delete') {
            // 光标在段落末尾
            const atEnd = range.collapsed && 
                (range.startOffset === (container.nodeType === Node.TEXT_NODE ? container.textContent.length : container.childNodes.length));
            
            if (atEnd || (currentPara.textContent && range.startOffset >= currentPara.textContent.length)) {
                let nextElement = currentPara.nextSibling;
                while (nextElement && nextElement.nodeType === Node.TEXT_NODE && !nextElement.textContent.trim()) {
                    nextElement = nextElement.nextSibling;
                }
                
                // 如果下一个元素是保护段落，阻止删除
                if (nextElement && isProtectedParagraph(nextElement)) {
                    e.preventDefault();
                    return;
                }
                
                // 如果下一个元素是代码块，阻止删除（不能合并到代码块）
                if (nextElement && nextElement.nodeType === Node.ELEMENT_NODE && 
                    nextElement.tagName === 'PRE' && nextElement.getAttribute('contenteditable') === 'false') {
                    e.preventDefault();
                    return;
                }
            }
        }
    });
    
    // 监听 DOM 变化，初始化新插入的代码块并确保保护段落存在
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
                
                // 检查是否有节点被删除
                if (mutation.removedNodes.length > 0) {
                    needsProtectionCheck = true;
                }
            }
        });
        
        if (needsUpdate) {
            setTimeout(initCodeBlocks, 10);
        }
        
        // 如果有节点被删除，检查并恢复代码块周围的保护段落，同时清理孤立的图注
        if (needsProtectionCheck) {
            setTimeout(() => {
                const codeBlocks = markdownPreview.querySelectorAll('pre[contenteditable="false"]');
                codeBlocks.forEach(pre => {
                    ensureEditableAroundCodeBlock(pre);
                });
                // 清理孤立的 figcaption 和空的 figure
                cleanupOrphanedFigcaptions();
            }, 10);
        }
    });
    
    codeObserver.observe(markdownPreview, {
        childList: true,
        subtree: true
    });
    
    // 初始化现有代码块
    setTimeout(initCodeBlocks, 100);
}
