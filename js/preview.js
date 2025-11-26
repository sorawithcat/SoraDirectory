// ============================================
// 预览模块 (preview.js)
// 功能：内容预览区域的编辑、同步功能
// 依赖：globals.js, directoryUtils.js
// 注意：图片大小限制配置和 limitImageSize 函数在 globals.js 中定义
// ============================================

/**
 * 从 HTML 内容中移除搜索高亮标签
 * @param {string} html - HTML 内容
 * @returns {string} - 清理后的内容
 */
function removeSearchHighlights(html) {
    if (!html) return html;
    
    // 使用临时元素精确移除高亮标签
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const highlights = tempDiv.querySelectorAll('.search-highlight, .search-highlight-current');
    highlights.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
    });
    tempDiv.normalize();
    return tempDiv.innerHTML;
}

/**
 * 同步预览区域内容到隐藏的 textarea，并更新数据
 */
function syncPreviewToTextarea() {
    if (markdownPreview && jiedianwords) {
        // 同步复选框的 checked 状态到 HTML 属性
        const checkboxes = markdownPreview.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                checkbox.setAttribute('checked', 'checked');
            } else {
                checkbox.removeAttribute('checked');
            }
        });
        
        // 移除搜索高亮标签，避免被保存到数据中
        const html = removeSearchHighlights(markdownPreview.innerHTML);
        
        isUpdating = true;
        jiedianwords.value = html;
        isUpdating = false;
        
        // 同步更新 mulufile 数据
        if (currentMuluName) {
            let changedmulu = document.querySelector(`#${currentMuluName}`);
            if (changedmulu) {
                updateMulufileData(changedmulu, html);
            }
        }
    }
}

/**
 * 为任务列表复选框添加事件监听器
 * 使复选框可点击切换状态
 */
function attachTaskListEvents() {
    if (!markdownPreview) return;
    
    const checkboxes = markdownPreview.querySelectorAll('.task-list-item-checkbox');
    checkboxes.forEach(checkbox => {
        // 移除 disabled 属性
        if (checkbox.hasAttribute('disabled')) {
            checkbox.removeAttribute('disabled');
        }
        
        // 避免重复绑定
        if (!checkbox.hasAttribute('data-task-attached')) {
            checkbox.setAttribute('data-task-attached', 'true');
            checkbox.addEventListener('change', function() {
                syncPreviewToTextarea();
            });
        }
    });
}

/**
 * 从 textarea 同步内容到预览区域
 */
function updateMarkdownPreview() {
    if (markdownPreview && jiedianwords) {
        isUpdating = true;
        markdownPreview.innerHTML = jiedianwords.value || '';
        isUpdating = false;
        
        // 绑定任务列表复选框事件
        attachTaskListEvents();
    }
}

// -------------------- 预览区域事件绑定 --------------------

if (markdownPreview) {
    // 设置可编辑属性
    markdownPreview.setAttribute('contenteditable', 'true');
    markdownPreview.setAttribute('spellcheck', 'true');
    
    /**
     * 回车键处理：强制使用 <p> 标签而不是 <div>
     * 在代码块中插入换行符
     */
    markdownPreview.addEventListener("keydown", function(e) {
        if (e.key === 'Enter') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let container = range.commonAncestorContainer;
                
                if (container.nodeType === Node.TEXT_NODE) {
                    container = container.parentNode;
                }
                
                // 检查是否在代码块中
                const codeBlock = container.closest('pre, code');
                if (codeBlock) {
                    // 在代码块中，插入换行符
                    e.preventDefault();
                    const textNode = document.createTextNode('\n');
                    range.deleteContents();
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    syncPreviewToTextarea();
                    return;
                }
                
                // 非代码块，Shift+Enter 不做特殊处理
                if (e.shiftKey) return;
                
                // 查找最近的块级元素
                let currentBlock = container;
                while (currentBlock && currentBlock !== markdownPreview) {
                    const tagName = currentBlock.tagName;
                    
                    // 普通 DIV（不在特殊元素内）转换为 P
                    if (tagName === 'DIV') {
                        const specialParent = currentBlock.closest('ul, ol, table, blockquote, h1, h2, h3, h4, h5, h6, pre, code');
                        if (!specialParent) {
                            e.preventDefault();
                            try {
                                document.execCommand('formatBlock', false, 'p');
                            } catch (err) {
                                const p = document.createElement('p');
                                const br = document.createElement('br');
                                p.appendChild(br);
                                range.insertNode(p);
                                range.setStart(p, 0);
                                range.setEnd(p, 0);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            }
                            return;
                        }
                    }
                    
                    // 已经是块级元素，正常处理
                    if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE'].includes(tagName)) {
                        break;
                    }
                    
                    currentBlock = currentBlock.parentNode;
                }
            }
        }
    });
    
    /**
     * 防抖的数据同步函数（减少 DOM 操作频率）
     */
    const debouncedSync = debounce(syncPreviewToTextarea, 150);
    
    /**
     * 防抖的 DIV 转 P 操作
     */
    const debouncedDivToP = debounce(function() {
        const divs = markdownPreview.querySelectorAll('div:not([class])');
        divs.forEach(div => {
            if (div.closest('ul, ol, table, blockquote, h1, h2, h3, h4, h5, h6, pre, code')) {
                return;
            }
            
            const hasBlockChildren = Array.from(div.children).some(child => 
                ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'PRE', 'CODE'].includes(child.tagName)
            );
            
            if (!hasBlockChildren) {
                const p = document.createElement('p');
                Array.from(div.attributes).forEach(attr => {
                    p.setAttribute(attr.name, attr.value);
                });
                p.innerHTML = div.innerHTML;
                div.parentNode.replaceChild(p, div);
            }
        });
    }, 200);
    
    /**
     * 输入事件：处理格式标签和 DIV 转换
     */
    markdownPreview.addEventListener("input", function (e) {
        if (isUpdating) return;
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const formatTags = ['EM', 'I', 'STRONG', 'B', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'MARK', 'SUP', 'SUB'];
            
            // 检查光标是否在格式标签内
            let container = range.startContainer;
            let node = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
            
            while (node && node !== markdownPreview) {
                if (node.nodeType === Node.ELEMENT_NODE && formatTags.includes(node.tagName)) {
                    // 光标在格式标签内，需要移出
                    const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'UL', 'OL', 'PRE'];
                    let blockParent = node.parentNode;
                    
                    while (blockParent && blockParent !== markdownPreview) {
                        if (blockParent.nodeType === Node.ELEMENT_NODE && blockTags.includes(blockParent.tagName)) {
                            break;
                        }
                        blockParent = blockParent.parentNode;
                    }
                    
                    if (!blockParent) blockParent = markdownPreview;
                    
                    // 在格式标签之后创建文本节点
                    const textNode = document.createTextNode('');
                    if (node.nextSibling) {
                        node.parentNode.insertBefore(textNode, node.nextSibling);
                    } else {
                        node.parentNode.appendChild(textNode);
                    }
                    
                    // 检查是否仍在格式标签内
                    let checkNode = textNode.parentNode;
                    let stillInFormat = false;
                    while (checkNode && checkNode !== markdownPreview) {
                        if (checkNode.nodeType === Node.ELEMENT_NODE && formatTags.includes(checkNode.tagName)) {
                            stillInFormat = true;
                            break;
                        }
                        checkNode = checkNode.parentNode;
                    }
                    
                    if (stillInFormat) {
                        textNode.remove();
                        const newTextNode = document.createTextNode('');
                        blockParent.appendChild(newTextNode);
                        const newRange = document.createRange();
                        newRange.setStart(newTextNode, 0);
                        newRange.setEnd(newTextNode, 0);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } else {
                        const newRange = document.createRange();
                        newRange.setStart(textNode, textNode.textContent.length);
                        newRange.setEnd(textNode, textNode.textContent.length);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                    
                    break;
                }
                node = node.parentNode;
            }
        }
        
        // 使用防抖的 DIV 转 P
        debouncedDivToP();
        
        // 使用防抖的数据同步
        debouncedSync();
    });
    
    /**
     * 任务列表复选框状态改变事件
     */
    markdownPreview.addEventListener("change", function(e) {
        if (e.target.classList.contains('task-list-item-checkbox')) {
            syncPreviewToTextarea();
        }
    });
    
    // 初始绑定
    attachTaskListEvents();
    
    // MutationObserver：为新插入的任务列表复选框添加事件
    const taskObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const checkboxes = node.nodeName === 'INPUT' && node.classList.contains('task-list-item-checkbox') 
                            ? [node]
                            : (node.querySelectorAll ? node.querySelectorAll('.task-list-item-checkbox') : []);
                        
                        checkboxes.forEach(checkbox => {
                            if (!checkbox.hasAttribute('data-task-attached')) {
                                checkbox.setAttribute('data-task-attached', 'true');
                                checkbox.addEventListener('change', function() {
                                    syncPreviewToTextarea();
                                });
                            }
                        });
                    }
                });
            }
        });
        attachTaskListEvents();
    });
    
    taskObserver.observe(markdownPreview, {
        childList: true,
        subtree: true
    });
}

// -------------------- 复制事件 --------------------

if (markdownPreview) {
    markdownPreview.addEventListener("copy", function(e) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        
        // 检查是否在预览区域内
        if (!markdownPreview.contains(range.commonAncestorContainer) && 
            !range.commonAncestorContainer.contains(markdownPreview)) {
            return;
        }
        
        // 同时保存 HTML 和纯文本
        const contents = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(contents);
        
        e.clipboardData.setData('text/html', tempDiv.innerHTML);
        e.clipboardData.setData('text/plain', range.toString());
        e.preventDefault();
    });
}

// -------------------- 粘贴事件 --------------------

if (markdownPreview) {
    markdownPreview.addEventListener("paste", function(e) {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        
        // 检查是否有图片
        const items = clipboardData.items;
        let hasImage = false;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                hasImage = true;
                const file = items[i].getAsFile();
                const reader = new FileReader();
                
                reader.onload = async function(e) {
                    const imageData = e.target.result;
                    const caption = await customPrompt('输入图片图注（可选，直接按确定跳过）:', '');
                    
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.alt = '粘贴的图片';
                    if (caption) img.title = caption;
                    
                    limitImageSize(img);
                    
                    img.setAttribute('data-click-attached', 'true');
                    img.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        showImageViewer(imageData);
                    });
                    
                    // 创建图片容器
                    let imageContainer;
                    if (caption) {
                        imageContainer = document.createElement('figure');
                        imageContainer.appendChild(img);
                        const figcaption = document.createElement('figcaption');
                        figcaption.textContent = caption;
                        imageContainer.appendChild(figcaption);
                    } else {
                        imageContainer = img;
                    }
                    
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(imageContainer);
                        const br = document.createElement('br');
                        range.setStartAfter(imageContainer);
                        range.insertNode(br);
                    } else {
                        markdownPreview.appendChild(imageContainer);
                        markdownPreview.appendChild(document.createElement('br'));
                    }
                    
                    syncPreviewToTextarea();
                };
                reader.readAsDataURL(file);
                break;
            }
        }
        
        // 粘贴文本或 HTML
        if (!hasImage) {
            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;
            
            const range = selection.getRangeAt(0);
            let html = clipboardData.getData('text/html');
            const text = clipboardData.getData('text/plain');
            
            if (html && html.trim()) {
                range.deleteContents();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                
                const fragment = document.createDocumentFragment();
                let lastNode = null;
                while (tempDiv.firstChild) {
                    const node = tempDiv.firstChild;
                    fragment.appendChild(node);
                    lastNode = node;
                }
                range.insertNode(fragment);
                
                // 移动光标到末尾
                const newRange = document.createRange();
                if (lastNode) {
                    if (lastNode.nodeType === Node.TEXT_NODE) {
                        newRange.setStart(lastNode, lastNode.textContent.length);
                        newRange.setEnd(lastNode, lastNode.textContent.length);
                    } else {
                        newRange.setStartAfter(lastNode);
                        newRange.setEndAfter(lastNode);
                    }
                } else {
                    newRange.setStart(range.startContainer, range.startOffset);
                    newRange.collapse(true);
                }
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else if (text) {
                document.execCommand('insertText', false, text);
            }
            
            setTimeout(() => {
                syncPreviewToTextarea();
            }, 10);
        }
    });
}

// -------------------- textarea 输入事件 --------------------

jiedianwords.addEventListener("input", function () {
    if (!isUpdating) {
        updateMarkdownPreview();
    }
});
