// ============================================
// preview 模块 (preview.js)
// ============================================

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

// 更新预览（从 textarea 同步到预览区域）
function updateMarkdownPreview() {
    if (markdownPreview && jiedianwords) {
        isUpdating = true;
        markdownPreview.innerHTML = jiedianwords.value || '';
        isUpdating = false;
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
        
        // 如果没有图片，粘贴文本
        if (!hasImage) {
            const text = clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
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
