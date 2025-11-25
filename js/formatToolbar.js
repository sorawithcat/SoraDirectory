// ============================================
// formatToolbar 模块 (formatToolbar.js)
// ============================================

// 显示/隐藏悬浮工具栏
let selectedText = '';
let selectionRange = null;

// 获取预览区域的选中内容
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

// 显示文字格式工具栏的函数
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

// 预览区域鼠标抬起事件
if (markdownPreview) {
    markdownPreview.addEventListener("mouseup", function(e) {
        setTimeout(() => {
            const previewSelection = getPreviewSelection();
            // 有选中文字时显示完整工具栏，没有选中文字时不显示（右键会显示）
            if (previewSelection && previewSelection.text && previewSelection.text.length > 0) {
                showTextFormatToolbar(e);
            } else {
                textFormatToolbar.style.display = 'none';
                textFormatToolbar.style.visibility = 'hidden';
            }
        }, 10);
    });
    
    // 右键点击时显示工具栏（不需要选中文字）
    markdownPreview.addEventListener("contextmenu", function(e) {
        setTimeout(() => {
            showTextFormatToolbar(e);
        }, 10);
    });
}

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

// HTML 转义辅助函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 应用格式化（在预览区域直接应用 HTML 格式）
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
    
    // 辅助函数：检查选中范围是否完全在指定的格式标签内
    function isWrappedInTag(range, tagNames) {
        if (!range || !selectedText) return false;
        
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        
        // 检查起始和结束容器是否都在同一个格式标签内
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
                            // 进一步检查：选中范围是否覆盖了整个标签的内容
                            // 如果选中范围等于标签内容，则返回标签
                            const tagStartCompare = range.compareBoundaryPoints(Range.START_TO_START, tagRange);
                            const tagEndCompare = range.compareBoundaryPoints(Range.END_TO_END, tagRange);
                            
                            // 如果选中范围完全在标签内，返回标签元素
                            if (tagStartCompare >= 0 && tagEndCompare <= 0) {
                                return startParent;
                            }
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
    
    switch(command) {
        // 标题 H1-H6
        case 'h1':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H1']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h1>' + selectedText + '</h1>';
            }
            break;
        case 'h2':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H2']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h2>' + selectedText + '</h2>';
            }
            break;
        case 'h3':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H3']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h3>' + selectedText + '</h3>';
            }
            break;
        case 'h4':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H4']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h4>' + selectedText + '</h4>';
            }
            break;
        case 'h5':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H5']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h5>' + selectedText + '</h5>';
            }
            break;
        case 'h6':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['H6']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<h6>' + selectedText + '</h6>';
            }
            break;
        // 文本格式
        case 'bold':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['STRONG', 'B']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<strong>' + selectedText + '</strong>';
            }
            break;
        case 'italic':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['EM', 'I']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<em>' + selectedText + '</em>';
            }
            break;
        case 'underline':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['U']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<u>' + selectedText + '</u>';
            }
            break;
        case 'strikethrough':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['S', 'STRIKE', 'DEL']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<s>' + selectedText + '</s>';
            }
            break;
        case 'code':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['CODE']);
            if (unwrapTag && !unwrapTag.closest('pre')) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<code>' + selectedText + '</code>';
            }
            break;
        case 'code-block':
            if (selectedText) {
                const lang = await customPrompt('输入编程语言（可选，直接按确定跳过）:', '');
                formattedHtml = '<pre><code' + (lang ? ' class="language-' + escapeHtml(lang) + '"' : '') + '>' + escapeHtml(selectedText) + '</code></pre>';
            } else {
                formattedHtml = '<pre><code></code></pre>';
            }
            break;
        case 'highlight':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['MARK']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<mark>' + selectedText + '</mark>';
            }
            break;
        case 'superscript':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['SUP']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<sup>' + selectedText + '</sup>';
            }
            break;
        case 'subscript':
            if (!selectedText) return;
            unwrapTag = isWrappedInTag(range, ['SUB']);
            if (unwrapTag) {
                shouldUnwrap = true;
            } else {
                formattedHtml = '<sub>' + selectedText + '</sub>';
            }
            break;
        // 链接和图片
        case 'link':
            const url = await customPrompt('输入链接地址:', 'https://');
            if (!url) return;
            
            if (selectedText) {
                formattedHtml = '<a href="' + escapeHtml(url) + '" target="_blank">' + selectedText + '</a>';
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
                        return '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox"' + 
                               (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]') ? ' checked' : '') + 
                               ' disabled> ' + trimmed.replace(/^-\s*\[[ xX]\]\s*/, '') + '</li>';
                    }
                    return '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled> ' + trimmed + '</li>';
                }).join('') + '</ul>';
            } else {
                formattedHtml = '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled> </li></ul>';
            }
            break;
        // 其他块级元素
        case 'quote':
            if (selectedText) {
                formattedHtml = '<blockquote>' + selectedText + '</blockquote>';
            } else {
                formattedHtml = '<blockquote><br></blockquote>';
            }
            break;
        case 'paragraph':
            if (selectedText) {
                formattedHtml = '<p>' + selectedText + '</p>';
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
        
        // 获取标签内的所有内容（包括文本和嵌套元素）
        const contents = Array.from(unwrapTag.childNodes);
        
        // 在格式标签之前插入所有内容，并保存插入的节点引用
        const insertedNodes = [];
        contents.forEach(node => {
            const cloned = node.cloneNode(true);
            parent.insertBefore(cloned, unwrapTag);
            insertedNodes.push(cloned);
        });
        
        // 删除格式标签
        unwrapTag.remove();
        
        // 重新设置选中范围，选中刚才插入的内容
        const newRange = document.createRange();
        const selection = window.getSelection();
        
        if (insertedNodes.length > 0) {
            const firstNode = insertedNodes[0];
            const lastNode = insertedNodes[insertedNodes.length - 1];
            
            // 尝试在插入的节点中查找包含选中文本的节点
            let foundTextNode = null;
            let textOffset = 0;
            
            for (let node of insertedNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(textToKeep)) {
                    foundTextNode = node;
                    textOffset = node.textContent.indexOf(textToKeep);
                    break;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // 在元素内查找文本节点
                    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
                    let textNode;
                    while (textNode = walker.nextNode()) {
                        if (textNode.textContent.includes(textToKeep)) {
                            foundTextNode = textNode;
                            textOffset = textNode.textContent.indexOf(textToKeep);
                            break;
                        }
                    }
                    if (foundTextNode) break;
                }
            }
            
            if (foundTextNode) {
                // 如果找到了包含选中文本的节点，选中该文本
                newRange.setStart(foundTextNode, textOffset);
                newRange.setEnd(foundTextNode, textOffset + textToKeep.length);
            } else {
                // 否则选中所有插入的节点
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
            }
            
            selection.removeAllRanges();
            selection.addRange(newRange);
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
        
        if (insertedElement) {
            const parent = insertedElement.parentNode;
            if (parent) {
                // 在格式化元素之后创建一个文本节点用于放置光标
                const textNode = document.createTextNode('');
                if (insertedElement.nextSibling) {
                    parent.insertBefore(textNode, insertedElement.nextSibling);
                } else {
                    parent.appendChild(textNode);
                }
                // 将光标设置在文本节点上（位置0，即节点开始）
                newRange.setStart(textNode, 0);
                newRange.setEnd(textNode, 0);
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
                const textNode = document.createTextNode('');
                if (range.startContainer.nextSibling) {
                    parent.insertBefore(textNode, range.startContainer.nextSibling);
                } else {
                    parent.appendChild(textNode);
                }
                newRange.setStart(textNode, 0);
                newRange.setEnd(textNode, 0);
            } else {
                // 最后备用：光标放在预览区域末尾
                newRange.setStart(markdownPreview, markdownPreview.childNodes.length);
                newRange.setEnd(markdownPreview, markdownPreview.childNodes.length);
            }
        }
        
        // 清除当前选择并设置新光标位置
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        // 确保预览区域获得焦点
        markdownPreview.focus();
        
        // 同步到 textarea
        syncPreviewToTextarea();
    }
    
    textFormatToolbar.style.display = 'none';
    textFormatToolbar.style.visibility = 'hidden';
    selectionRange = null;
}
