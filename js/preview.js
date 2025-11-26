// ============================================
// preview 模块 (preview.js)
// ============================================

// 图片大小限制配置（如果 imageHandler.js 未加载，则使用此配置）
if (typeof MAX_IMAGE_WIDTH === 'undefined') {
    var MAX_IMAGE_WIDTH = 800;  // 最大宽度（像素）
    var MAX_IMAGE_HEIGHT = 600;  // 最大高度（像素）
}

// 辅助函数：限制图片大小但保持比例（如果 imageHandler.js 未加载，则使用此函数）
if (typeof limitImageSize === 'undefined') {
    function limitImageSize(img, maxWidth = MAX_IMAGE_WIDTH, maxHeight = MAX_IMAGE_HEIGHT) {
        return new Promise((resolve) => {
            const applySizeLimit = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;
                
                if (width === 0 || height === 0) {
                    resolve();
                    return;
                }
                
                // 计算缩放比例
                const widthRatio = maxWidth / width;
                const heightRatio = maxHeight / height;
                const ratio = Math.min(widthRatio, heightRatio, 1); // 不超过1，即不放大
                
                // 如果图片超过限制，设置尺寸
                if (ratio < 1) {
                    img.style.width = (width * ratio) + 'px';
                    img.style.height = 'auto'; // 保持比例
                } else {
                    // 如果图片在限制内，只设置最大宽度为100%
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                }
                
                resolve();
            };
            
            // 如果图片已经加载完成
            if (img.complete && img.naturalWidth > 0) {
                applySizeLimit();
            } else {
                // 等待图片加载完成
                img.onload = applySizeLimit;
                
                // 如果图片加载失败，也resolve
                img.onerror = function() {
                    resolve();
                };
            }
        });
    }
}

// 同步预览区域内容到隐藏的 textarea
function syncPreviewToTextarea() {
    if (markdownPreview && jiedianwords) {
        const html = markdownPreview.innerHTML;
        isUpdating = true;
        jiedianwords.value = html;
        isUpdating = false;
        
        // 更新数据
        if (currentMuluName) {
            let changedmulu = document.querySelector(`#${currentMuluName}`);
            if (changedmulu) {
                updateMulufileData(changedmulu, html);
            }
        }
    }
}

// 为任务列表复选框添加事件监听器（全局函数，可在多处调用）
function attachTaskListEvents() {
    if (!markdownPreview) return;
    
    const checkboxes = markdownPreview.querySelectorAll('.task-list-item-checkbox');
    checkboxes.forEach(checkbox => {
        // 移除 disabled 属性（如果存在）
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

// 更新预览（从 textarea 同步到预览区域）
function updateMarkdownPreview() {
    if (markdownPreview && jiedianwords) {
        isUpdating = true;
        markdownPreview.innerHTML = jiedianwords.value || '';
        isUpdating = false;
        
        // 更新后绑定任务列表复选框事件
        attachTaskListEvents();
    }
}

// 预览区域内容改变时同步到 textarea

// 确保预览区域可编辑
if (markdownPreview) {
    markdownPreview.setAttribute('contenteditable', 'true');
    markdownPreview.setAttribute('spellcheck', 'true');
    
    // 处理回车键，强制使用 <p> 标签而不是 <div>
    markdownPreview.addEventListener("keydown", function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let container = range.commonAncestorContainer;
                
                // 如果是文本节点，获取父元素
                if (container.nodeType === Node.TEXT_NODE) {
                    container = container.parentNode;
                }
                
                // 查找最近的块级元素
                let currentBlock = container;
                while (currentBlock && currentBlock !== markdownPreview) {
                    const tagName = currentBlock.tagName;
                    
                    // 如果当前是普通的 DIV（不在特殊元素内），阻止默认行为并创建 <p>
                    if (tagName === 'DIV') {
                        // 检查是否在特殊元素内
                        const specialParent = currentBlock.closest('ul, ol, table, blockquote, h1, h2, h3, h4, h5, h6, pre, code');
                        if (!specialParent) {
                            e.preventDefault();
                            // 使用 formatBlock 命令强制使用 <p> 标签
                            try {
                                document.execCommand('formatBlock', false, 'p');
                            } catch (err) {
                                // 如果 execCommand 失败，手动创建 <p>
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
                    
                    // 如果已经是 P 或其他块级元素，让浏览器正常处理
                    if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE'].includes(tagName)) {
                        break;
                    }
                    
                    currentBlock = currentBlock.parentNode;
                }
            }
        }
    });
    
    markdownPreview.addEventListener("input", function (e) {
        if (isUpdating) return;
        
        // 检查光标是否在格式标签内，如果是则移出
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const formatTags = ['EM', 'I', 'STRONG', 'B', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'MARK', 'SUP', 'SUB'];
            
            // 检查光标位置是否在格式标签内
            let container = range.startContainer;
            let node = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
            
            // 向上查找格式标签
            while (node && node !== markdownPreview) {
                if (node.nodeType === Node.ELEMENT_NODE && formatTags.includes(node.tagName)) {
                    // 光标在格式标签内，需要移出
                    // 找到块级父元素
                    const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'UL', 'OL', 'PRE'];
                    let blockParent = node.parentNode;
                    while (blockParent && blockParent !== markdownPreview) {
                        if (blockParent.nodeType === Node.ELEMENT_NODE && blockTags.includes(blockParent.tagName)) {
                            break;
                        }
                        blockParent = blockParent.parentNode;
                    }
                    
                    if (!blockParent) blockParent = markdownPreview;
                    
                    // 在格式标签之后创建文本节点并移动光标
                    const textNode = document.createTextNode('');
                    if (node.nextSibling) {
                        node.parentNode.insertBefore(textNode, node.nextSibling);
                    } else {
                        node.parentNode.appendChild(textNode);
                    }
                    
                    // 如果文本节点仍在格式标签内，移到块级元素
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
        
        // 将普通的 <div> 替换为 <p>（排除列表、表格等特殊元素）
        const divs = markdownPreview.querySelectorAll('div');
        divs.forEach(div => {
            // 跳过已经在列表、表格、引用等块级元素内的 div
            if (div.closest('ul, ol, table, blockquote, h1, h2, h3, h4, h5, h6, pre, code')) {
                return;
            }
            
            // 检查 div 是否包含块级元素
            const hasBlockChildren = Array.from(div.children).some(child => 
                ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'PRE', 'CODE'].includes(child.tagName)
            );
            
            // 如果 div 只包含文本或行内元素，替换为 p
            if (!hasBlockChildren) {
                const p = document.createElement('p');
                // 保留所有属性和内容
                Array.from(div.attributes).forEach(attr => {
                    p.setAttribute(attr.name, attr.value);
                });
                p.innerHTML = div.innerHTML;
                div.parentNode.replaceChild(p, div);
            }
        });
        
        syncPreviewToTextarea();
    });
    
    // 处理任务列表复选框的状态切换
    markdownPreview.addEventListener("change", function(e) {
        if (e.target.classList.contains('task-list-item-checkbox')) {
            // 复选框状态改变时同步到 textarea
            syncPreviewToTextarea();
        }
    });
    
    // 初始绑定
    attachTaskListEvents();
    
    // 监听预览区域内容变化，为新插入的任务列表复选框添加事件
    const taskObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查是否是任务列表项或包含任务列表项
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
    
    if (markdownPreview) {
        taskObserver.observe(markdownPreview, {
            childList: true,
            subtree: true
        });
    }
}

// 复制事件（需要在 markdownPreview 存在时绑定）
if (markdownPreview) {
    markdownPreview.addEventListener("copy", function(e) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        
        // 检查选中范围是否在预览区域内
        if (!markdownPreview.contains(range.commonAncestorContainer) && 
            !range.commonAncestorContainer.contains(markdownPreview)) {
            return; // 如果不在预览区域内，使用默认行为
        }
        
        // 获取选中内容的HTML和纯文本
        const contents = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(contents);
        const html = tempDiv.innerHTML;
        const text = range.toString();
        
        // 将HTML和文本都放入剪贴板
        e.clipboardData.setData('text/html', html);
        e.clipboardData.setData('text/plain', text);
        
        // 阻止默认行为，使用我们设置的数据
        e.preventDefault();
    });
}

// 粘贴事件（需要在 markdownPreview 存在时绑定）
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
                    
                    // 提示用户输入图注
                    const caption = await customPrompt('输入图片图注（可选，直接按确定跳过）:', '');
                    
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.alt = '粘贴的图片';
                    if (caption) {
                        img.title = caption;
                    }
                    
                    // 限制图片大小但保持比例
                    limitImageSize(img);
                    
                    img.setAttribute('data-click-attached', 'true');
                    img.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        showImageViewer(imageData);
                    });
                    
                    // 创建图片容器
                    let imageContainer;
                    if (caption) {
                        // 如果有图注，使用 figure 和 figcaption
                        imageContainer = document.createElement('figure');
                        imageContainer.appendChild(img);
                        const figcaption = document.createElement('figcaption');
                        figcaption.textContent = caption;
                        imageContainer.appendChild(figcaption);
                    } else {
                        // 如果没有图注，只插入图片
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
        
        // 如果没有图片，粘贴文本或HTML
        if (!hasImage) {
            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;
            
            const range = selection.getRangeAt(0);
            
            // 优先使用HTML格式，如果没有HTML格式则使用纯文本
            let html = clipboardData.getData('text/html');
            const text = clipboardData.getData('text/plain');
            
            if (html && html.trim()) {
                // 有HTML格式，直接插入HTML
                range.deleteContents();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                
                // 将HTML内容插入到选中位置
                const fragment = document.createDocumentFragment();
                let lastNode = null;
                while (tempDiv.firstChild) {
                    const node = tempDiv.firstChild;
                    fragment.appendChild(node);
                    lastNode = node;
                }
                range.insertNode(fragment);
                
                // 将光标移动到插入内容的末尾
                const newRange = document.createRange();
                if (lastNode) {
                    // 找到最后一个节点的末尾位置
                    if (lastNode.nodeType === Node.TEXT_NODE) {
                        newRange.setStart(lastNode, lastNode.textContent.length);
                        newRange.setEnd(lastNode, lastNode.textContent.length);
                    } else {
                        // 如果是元素节点，在元素之后
                        newRange.setStartAfter(lastNode);
                        newRange.setEndAfter(lastNode);
                    }
                } else {
                    // 如果没有节点，使用原位置
                    newRange.setStart(range.startContainer, range.startOffset);
                    newRange.collapse(true);
                }
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else if (text) {
                // 没有HTML格式，使用纯文本
                document.execCommand('insertText', false, text);
            }
            
            setTimeout(() => {
                syncPreviewToTextarea();
            }, 10);
        }
    });
}

//节点内容改变时改变储存和预览（从外部设置内容时）
jiedianwords.addEventListener("input", function () {
    if (!isUpdating) {
        updateMarkdownPreview();
    }
})
