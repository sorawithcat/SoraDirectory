// ============================================
// markdown 模块 (markdown.js)
// 使用 Marked.js 进行 Markdown 解析
// 使用 Turndown.js 进行 HTML 到 Markdown 转换
// 使用 Turndown GFM 插件支持 GitHub Flavored Markdown
// ============================================

// 初始化 Marked.js 配置
let markedRenderer = null;
let turndownService = null;

// 初始化 Marked.js
function initMarked() {
    // 创建自定义渲染器
    markedRenderer = new marked.Renderer();
    
    // 自定义 blockquote 渲染，保留原始格式
    markedRenderer.blockquote = function(quote) {
        // 直接返回 blockquote，保留内部格式
        return '<blockquote>' + quote + '</blockquote>\n';
    };
    
    // 自定义代码块渲染
    markedRenderer.code = function(code, infostring, escaped) {
        const lang = (infostring || '').match(/\S*/)[0];
        if (this.options.highlight) {
            const out = this.options.highlight(code, lang);
            if (out != null && out !== code) {
                escaped = true;
                code = out;
            }
        }
        if (!lang) {
            return '<pre><code>' + (escaped ? code : escapeHtml(code)) + '</code></pre>\n';
        }
        return '<pre><code class="language-' + escapeHtml(lang) + '">' + (escaped ? code : escapeHtml(code)) + '</code></pre>\n';
    };
    
    // 自定义列表渲染，保留格式
    markedRenderer.list = function(body, ordered, start) {
        const type = ordered ? 'ol' : 'ul';
        const startAttr = (ordered && start !== 1) ? (' start="' + start + '"') : '';
        return '<' + type + startAttr + '>\n' + body + '</' + type + '>\n';
    };
    
    // 自定义列表项渲染
    markedRenderer.listitem = function(text) {
        return '<li>' + text + '</li>\n';
    };
    
    // 自定义表格渲染
    markedRenderer.table = function(header, body) {
        if (body) {
            return '<table>\n<thead>\n' + header + '</thead>\n<tbody>\n' + body + '</tbody>\n</table>\n';
        }
        return '<table>\n<thead>\n' + header + '</thead>\n</table>\n';
    };
    
    markedRenderer.tablerow = function(content) {
        return '<tr>\n' + content + '</tr>\n';
    };
    
    markedRenderer.tablecell = function(content, flags) {
        const type = flags.header ? 'th' : 'td';
        const tag = flags.align ? '<' + type + ' style="text-align:' + flags.align + '">' : '<' + type + '>';
        return tag + content + '</' + type + '>\n';
    };
    
    // 扩展 marked 以支持高亮、上标、下标（在文本渲染时处理）
    const originalText = markedRenderer.text || function(text) { return text; };
    markedRenderer.text = function(text) {
        // 处理高亮 ==text==
        text = text.replace(/==([^=]+)==/g, '<mark>$1</mark>');
        // 处理上标 ^text^
        text = text.replace(/\^([^\^]+)\^/g, '<sup>$1</sup>');
        // 处理下标 ~text~
        text = text.replace(/~([^~]+)~/g, '<sub>$1</sub>');
        return originalText.call(this, text);
    };
    
    // 配置 Marked.js 选项
    marked.setOptions({
        renderer: markedRenderer,
        gfm: true, // GitHub Flavored Markdown
        breaks: true, // 将换行符转换为 <br>
        headerIds: false, // 不生成标题 ID
        mangle: false, // 不混淆邮箱地址
        pedantic: false,
        sanitize: false,
        smartLists: true,
        smartypants: false
    });
}

// 初始化 Turndown.js
function initTurndown() {
    turndownService = new TurndownService({
        headingStyle: 'atx', // 使用 # 格式的标题
        codeBlockStyle: 'fenced', // 使用 ``` 格式的代码块
        fence: '```', // 代码块分隔符
        emDelimiter: '*', // 斜体使用 *
        strongDelimiter: '**', // 粗体使用 **
        bulletListMarker: '-', // 无序列表使用 -
        linkStyle: 'inlined', // 链接使用内联格式
        linkReferenceStyle: 'full', // 链接引用使用完整格式
        br: '\n', // 换行转换为 \n
        blankReplacement: function(content, node) {
            // 对于块级元素，只返回一个换行（Turndown 会自动添加段落分隔）
            return node.isBlock ? '\n' : '';
        }
    });
    
    // 添加 GFM 插件支持
    const { gfm } = turndownPluginGfm;
    turndownService.use(gfm);
    
    // 自定义规则：保留 blockquote 的原始格式（递归处理内部所有元素）
    turndownService.addRule('blockquote', {
        filter: 'blockquote',
        replacement: function(content, node) {
            // 创建一个临时的 Turndown 实例来处理 blockquote 内部的内容
            // 这样可以递归处理所有嵌套的块级元素（标题、表格、代码块等）
            const tempService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced',
                fence: '```',
                emDelimiter: '*',
                strongDelimiter: '**',
                bulletListMarker: '-',
                linkStyle: 'inlined',
                linkReferenceStyle: 'full',
                br: '\n'
            });
            
            // 添加 GFM 插件支持
            const { gfm: gfmPlugin } = turndownPluginGfm;
            tempService.use(gfmPlugin);
            
            // 添加所有自定义规则到临时服务（确保 blockquote 内部的所有元素都能正确转换）
            // 代码块规则
            tempService.addRule('codeBlock', {
                filter: function(n) {
                    return n.nodeName === 'PRE' && n.firstChild && n.firstChild.nodeName === 'CODE';
                },
                replacement: function(content, n) {
                    const code = n.firstChild;
                    const lang = code.className ? code.className.replace('language-', '') : '';
                    const codeContent = code.textContent || code.innerText;
                    return '```' + (lang ? lang + '\n' : '\n') + codeContent + '\n```\n';
                }
            });
            
            // 水平线规则
            tempService.addRule('horizontalRule', {
                filter: 'hr',
                replacement: function() {
                    return '\n---\n\n';
                }
            });
            
            tempService.addRule('table', {
                filter: 'table',
                replacement: function(content, n) {
                    const rows = n.querySelectorAll('tr');
                    let markdown = '\n';
                    
                    rows.forEach((row, rowIndex) => {
                        const cells = row.querySelectorAll('th, td');
                        let rowText = '|';
                        
                        cells.forEach(cell => {
                            // 处理单元格内的格式元素
                            let cellContent = cell.innerHTML;
                            // 转换行内格式
                            cellContent = cellContent.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
                            cellContent = cellContent.replace(/<b>(.*?)<\/b>/gi, '**$1**');
                            cellContent = cellContent.replace(/<em>(.*?)<\/em>/gi, '*$1*');
                            cellContent = cellContent.replace(/<i>(.*?)<\/i>/gi, '*$1*');
                            cellContent = cellContent.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
                            cellContent = cellContent.replace(/<code>(.*?)<\/code>/gi, '`$1`');
                            cellContent = cellContent.replace(/<mark>(.*?)<\/mark>/gi, '==$1==');
                            cellContent = cellContent.replace(/<sup>(.*?)<\/sup>/gi, '^$1^');
                            cellContent = cellContent.replace(/<sub>(.*?)<\/sub>/gi, '~$1~');
                            cellContent = cellContent.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
                            // 清理其他标签，保留文本
                            cellContent = cellContent.replace(/<[^>]+>/g, '');
                            // 解码 HTML 实体
                            const textarea = document.createElement('textarea');
                            textarea.innerHTML = cellContent;
                            cellContent = textarea.value.trim();
                            
                            rowText += ' ' + cellContent + ' |';
                        });
                        
                        markdown += rowText + '\n';
                        
                        // 添加表头分隔符
                        if (rowIndex === 0 && row.querySelector('th')) {
                            let separator = '|';
                            for (let i = 0; i < cells.length; i++) {
                                separator += ' --- |';
                            }
                            markdown += separator + '\n';
                        }
                    });
                    
                    return markdown + '\n';
                }
            });
            
            tempService.addRule('highlight', {
                filter: 'mark',
                replacement: function(content) {
                    return '==' + content + '==';
                }
            });
            
            tempService.addRule('superscript', {
                filter: 'sup',
                replacement: function(content) {
                    return '^' + content + '^';
                }
            });
            
            tempService.addRule('subscript', {
                filter: 'sub',
                replacement: function(content) {
                    return '~' + content + '~';
                }
            });
            
            // 使用临时服务转换 blockquote 内部内容
            // 创建一个临时容器，只包含 blockquote 的内容（不包含 blockquote 标签本身）
            const tempContainer = document.createElement('div');
            // 使用 innerHTML 克隆内容，避免移动原始节点
            tempContainer.innerHTML = node.innerHTML;
            const innerMarkdown = tempService.turndown(tempContainer);
            
            // 按行分割，每行前加 > 前缀
            const lines = innerMarkdown.split('\n');
            const quotedLines = lines.map(line => {
                // 空行也保留，但只加一个 >
                if (line.trim() === '') {
                    return '>';
                }
                return '> ' + line;
            });
            
            // 合并结果，确保末尾有换行
            let result = quotedLines.join('\n');
            if (result && !result.endsWith('\n')) {
                result += '\n';
            }
            
            return result;
        }
    });
    
    // 自定义规则：保留列表格式
    turndownService.addRule('list', {
        filter: ['ul', 'ol'],
        replacement: function(content, node) {
                const items = content.trim().split('\n');
                const listItems = items.map(item => {
                    if (item.trim()) {
                        if (node.tagName === 'OL') {
                            // 有序列表，需要保持编号
                            const match = item.match(/^(\d+)\.\s*(.*)$/);
                            if (match) {
                                return match[1] + '. ' + match[2];
                            }
                            return '1. ' + item.trim();
                        } else {
                            // 无序列表
                            if (!item.match(/^[-*+]\s/)) {
                                return '- ' + item.trim();
                            }
                            return item;
                        }
                    }
                    return item;
                });
            return listItems.join('\n') + '\n';
        }
    });
    
    // 自定义规则：保留代码块格式
    turndownService.addRule('codeBlock', {
        filter: function(node) {
                return node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
            },
            replacement: function(content, node) {
                const code = node.firstChild;
                const lang = code.className ? code.className.replace('language-', '') : '';
            const codeContent = code.textContent || code.innerText;
            return '```' + (lang ? lang + '\n' : '\n') + codeContent + '\n```\n';
        }
    });
    
    // 自定义规则：保留水平线
    turndownService.addRule('horizontalRule', {
        filter: 'hr',
        replacement: function() {
            return '\n---\n\n';
        }
    });
    
    // 自定义规则：高亮文本
    turndownService.addRule('highlight', {
        filter: 'mark',
        replacement: function(content) {
            return '==' + content + '==';
        }
    });
    
    // 自定义规则：上标
    turndownService.addRule('superscript', {
        filter: 'sup',
        replacement: function(content) {
            return '^' + content + '^';
        }
    });
    
    // 自定义规则：下标
    turndownService.addRule('subscript', {
        filter: 'sub',
        replacement: function(content) {
            return '~' + content + '~';
        }
    });
    
    // 自定义规则：任务列表（GFM 插件应该已经支持，但确保正确处理）
    turndownService.addRule('taskList', {
        filter: function(node) {
                return node.type === 'checkbox' && 
                       node.parentNode && 
                       node.parentNode.tagName === 'LI' &&
                       (node.parentNode.classList.contains('task-list-item') || 
                        node.parentNode.parentNode.classList.contains('contains-task-list'));
            },
            replacement: function(content, node) {
            const checked = node.checked ? 'x' : ' ';
            // 移除 checkbox 后的内容，只保留文本
            const textContent = content.replace(/^\s*/, '');
            return '- [' + checked + '] ' + textContent;
        }
    });
    
    // 自定义规则：表格（GFM 插件应该已经支持，但确保正确转换）
    // 注意：这个规则需要在 blockquote 规则之前添加，以确保优先级
    turndownService.addRule('table', {
        filter: 'table',
        replacement: function(content, node) {
                const rows = node.querySelectorAll('tr');
                let markdown = '\n';
                
                rows.forEach((row, rowIndex) => {
                    const cells = row.querySelectorAll('th, td');
                    let rowText = '|';
                    
                    cells.forEach(cell => {
                        // 处理单元格内的格式元素
                        let cellContent = cell.innerHTML;
                        // 转换行内格式
                        cellContent = cellContent.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
                        cellContent = cellContent.replace(/<b>(.*?)<\/b>/gi, '**$1**');
                        cellContent = cellContent.replace(/<em>(.*?)<\/em>/gi, '*$1*');
                        cellContent = cellContent.replace(/<i>(.*?)<\/i>/gi, '*$1*');
                        cellContent = cellContent.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
                        cellContent = cellContent.replace(/<code>(.*?)<\/code>/gi, '`$1`');
                        cellContent = cellContent.replace(/<mark>(.*?)<\/mark>/gi, '==$1==');
                        cellContent = cellContent.replace(/<sup>(.*?)<\/sup>/gi, '^$1^');
                        cellContent = cellContent.replace(/<sub>(.*?)<\/sub>/gi, '~$1~');
                        cellContent = cellContent.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
                        // 清理其他标签，保留文本
                        cellContent = cellContent.replace(/<[^>]+>/g, '');
                        // 解码 HTML 实体
                        const textarea = document.createElement('textarea');
                        textarea.innerHTML = cellContent;
                        cellContent = textarea.value.trim();
                        
                        rowText += ' ' + cellContent + ' |';
                    });
                    
                    markdown += rowText + '\n';
                    
                    // 添加表头分隔符
                    if (rowIndex === 0 && row.querySelector('th')) {
                        let separator = '|';
                        for (let i = 0; i < cells.length; i++) {
                            separator += ' --- |';
                        }
                        markdown += separator + '\n';
                    }
                });
                
            return markdown + '\n';
        }
    });
    
    // 保留换行
    turndownService.keep(['br']);
    
    // 自定义规则：如果段落只包含 <br> 标签，直接转换为换行，不用段落包裹
    // 这个规则需要在段落规则之前执行，所以使用较高的优先级
    turndownService.addRule('paragraphWithOnlyBr', {
        filter: function(node) {
            // 检查是否是段落，且只包含 <br> 标签和空白
            if (node.nodeName === 'P') {
                // 获取所有子节点
                const children = Array.from(node.childNodes);
                // 检查是否只有文本节点（空白）和 <br> 标签
                const onlyBrAndWhitespace = children.every(child => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        // 文本节点只包含空白
                        return /^\s*$/.test(child.textContent);
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        // 元素节点必须是 <br>
                        return child.tagName === 'BR';
                    }
                    return false;
                });
                // 至少有一个 <br> 标签
                const hasBr = node.querySelector('br') !== null;
                return onlyBrAndWhitespace && hasBr;
            }
            return false;
        },
        replacement: function(content, node) {
            // 计算 <br> 的数量
            const brs = node.querySelectorAll('br');
            // 返回对应数量的换行
            return '\n'.repeat(brs.length);
        }
    });
}

// HTML 转义辅助函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 初始化（在 DOM 加载后）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initMarked();
        initTurndown();
    });
} else {
    initMarked();
    initTurndown();
}

// Markdown 解析器 - 使用 Marked.js，但保留段落中的 blockquote
function parseMarkdown(text) {
    if (!text) return '';
    
    try {
        // 先处理段落中的 blockquote（不在行首的 blockquote）
        // 使用正则表达式查找段落中的 blockquote 模式
        // 模式：文本后跟 > 开头的行（但不是行首）
        const lines = text.split('\n');
            const processedLines = [];
            let inParagraph = false;
            let paragraphContent = [];
            
            // 预处理：识别表格块
            let inTable = false;
            let tableLines = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const isBlockquote = /^> /.test(line);
                const trimmedLine = line.trim();
                const isEmptyLine = trimmedLine === '';
                // 移除 blockquote 前缀后检查
                const lineWithoutQuote = isBlockquote ? line.replace(/^>\s*/, '') : line;
                const trimmedWithoutQuote = lineWithoutQuote.trim();
                const isBlockElement = /^(#{1,6} |[-*+] |\d+\. |```|---)/.test(trimmedLine);
                // 检查表格行（包括 blockquote 中的表格）
                const isTableRow = !isEmptyLine && /^\|.*\|/.test(trimmedWithoutQuote);
                const isTableSeparator = !isEmptyLine && /^\|[\s\-:|]+\|/.test(trimmedWithoutQuote);
                
                // 处理空行
                if (isEmptyLine) {
                    // 如果正在处理表格，结束表格
                    if (inTable) {
                        if (tableLines.length > 0) {
                            processedLines.push(tableLines.join('\n'));
                            tableLines = [];
                        }
                        inTable = false;
                    }
                    // 如果正在处理段落，结束段落
                    if (inParagraph) {
                        if (paragraphContent.length > 0) {
                            processedLines.push(paragraphContent.join(' '));
                            paragraphContent = [];
                        }
                        inParagraph = false;
                    }
                    // 保留空行
                    processedLines.push('');
                    continue;
                }
                
                // 处理表格
                if (isTableRow || isTableSeparator) {
                    if (!inTable) {
                        // 开始新表格，先处理之前的段落
                        if (inParagraph && paragraphContent.length > 0) {
                            processedLines.push(paragraphContent.join(' '));
                            paragraphContent = [];
                            inParagraph = false;
                        }
                        inTable = true;
                        tableLines = [];
                    }
                    tableLines.push(line);
                    continue;
                } else if (inTable) {
                    // 表格结束，添加表格块
                    if (tableLines.length > 0) {
                        processedLines.push(tableLines.join('\n'));
                        tableLines = [];
                    }
                    inTable = false;
                }
                
                if (isBlockElement && !isBlockquote) {
                    // 遇到块级元素，先处理之前的段落
                    if (inParagraph && paragraphContent.length > 0) {
                        processedLines.push(paragraphContent.join(' '));
                        paragraphContent = [];
                        inParagraph = false;
                    }
                    processedLines.push(line);
                } else if (isBlockquote && inParagraph) {
                    // 段落中的 blockquote，保留在段落中
                    paragraphContent.push(line);
                } else if (isBlockquote) {
                    // 独立的 blockquote
                    if (paragraphContent.length > 0) {
                        processedLines.push(paragraphContent.join(' '));
                        paragraphContent = [];
                    }
                    processedLines.push(line);
                    inParagraph = false;
                } else {
                    // 普通文本行
                    if (!inParagraph) {
                        inParagraph = true;
                        paragraphContent = [];
                    }
                    paragraphContent.push(line);
                }
            }
            
            // 处理剩余的表格
            if (inTable && tableLines.length > 0) {
                if (inParagraph && paragraphContent.length > 0) {
                    processedLines.push(paragraphContent.join(' '));
                    paragraphContent = [];
                    inParagraph = false;
                }
                processedLines.push(tableLines.join('\n'));
            }
            
            // 处理剩余的段落内容
            if (paragraphContent.length > 0) {
                processedLines.push(paragraphContent.join(' '));
            }
            
            // 重新组合文本
            let processedText = processedLines.join('\n');
            
            // 使用 Marked.js 解析
            let html = marked.parse(processedText);
            
            // 处理图片点击事件
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // 为图片添加点击事件
            const images = tempDiv.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (src) {
                    img.setAttribute('data-click-attached', 'true');
                    img.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (typeof showImageViewer === 'function') {
                            showImageViewer(src);
                        }
                    });
                }
            });
            
            // 为链接添加 target="_blank"
            const links = tempDiv.querySelectorAll('a');
            links.forEach(link => {
                if (!link.getAttribute('target')) {
                    link.setAttribute('target', '_blank');
                }
            });
        
        return tempDiv.innerHTML;
    } catch (error) {
        console.error('Marked.js 解析错误:', error);
        throw error;
    }
}

// HTML 转 Markdown - 使用 Turndown.js
function htmlToMarkdown(html) {
    if (!html) return '';
    
    // 创建临时容器
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 特殊处理：如果段落只包含 <br> 标签，移除 <p> 包裹
    const paragraphs = tempDiv.querySelectorAll('p');
    paragraphs.forEach(p => {
        // 获取所有子节点
        const children = Array.from(p.childNodes);
        // 检查是否只有文本节点（空白）和 <br> 标签
        const onlyBrAndWhitespace = children.every(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                // 文本节点只包含空白
                return /^\s*$/.test(child.textContent);
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                // 元素节点必须是 <br>
                return child.tagName === 'BR';
            }
            return false;
        });
        // 至少有一个 <br> 标签
        const hasBr = p.querySelector('br') !== null;
        
        if (onlyBrAndWhitespace && hasBr) {
            // 移除 <p> 标签，只保留 <br>
            const parent = p.parentNode;
            if (parent) {
                // 将 <br> 直接插入到父元素中
                const brs = p.querySelectorAll('br');
                brs.forEach(br => {
                    parent.insertBefore(br.cloneNode(true), p);
                });
                p.remove();
            }
        }
    });
    
    // 重新获取段落（因为可能已经移除了一些）
    const remainingParagraphs = tempDiv.querySelectorAll('p');
    
    // 特殊处理：处理段落中的 blockquote，保留其在段落中的位置
    // 先处理段落中的 blockquote，将它们转换为内联格式
    remainingParagraphs.forEach(p => {
        const blockquotes = p.querySelectorAll('blockquote');
        if (blockquotes.length > 0) {
            // 段落中包含 blockquote，需要特殊处理
            // 将段落内容按 blockquote 分割，保留顺序
            let pContent = p.innerHTML;
            
            // 用占位符替换 blockquote，稍后恢复
            const placeholders = [];
            blockquotes.forEach((bq, index) => {
                const placeholder = `__BLOCKQUOTE_PLACEHOLDER_${index}__`;
                placeholders.push({
                    placeholder: placeholder,
                    blockquote: bq.cloneNode(true)
                });
                // 使用正则表达式精确替换，避免替换错误
                const bqOuterHTML = bq.outerHTML;
                pContent = pContent.replace(bqOuterHTML, placeholder);
            });
            
            // 处理段落中的其他内容（格式元素）
            let processedContent = pContent;
            // 处理格式元素
            processedContent = processedContent.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
            processedContent = processedContent.replace(/<b>(.*?)<\/b>/gi, '**$1**');
            processedContent = processedContent.replace(/<em>(.*?)<\/em>/gi, '*$1*');
            processedContent = processedContent.replace(/<i>(.*?)<\/i>/gi, '*$1*');
            processedContent = processedContent.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
            processedContent = processedContent.replace(/<code>(.*?)<\/code>/gi, '`$1`');
            processedContent = processedContent.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
            // 每个 <br> 对应一个换行
            processedContent = processedContent.replace(/<br\s*\/?>/gi, '\n');
            processedContent = processedContent.replace(/<p[^>]*>/gi, '');
            processedContent = processedContent.replace(/<\/p>/gi, ' ');
            processedContent = processedContent.replace(/<div[^>]*>/gi, '');
            processedContent = processedContent.replace(/<\/div>/gi, ' ');
            processedContent = processedContent.replace(/<[^>]+>/g, '');
            
            // 恢复 blockquote 占位符，转换为 Markdown（保留在段落中）
            placeholders.forEach(item => {
                let bqContent = item.blockquote.innerHTML;
                // 处理 blockquote 内部的格式
                bqContent = bqContent.replace(/<p[^>]*>/gi, '');
                bqContent = bqContent.replace(/<\/p>/gi, ' ');
                // 每个 <br> 对应一个换行
                bqContent = bqContent.replace(/<br\s*\/?>/gi, '\n');
                bqContent = bqContent.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
                bqContent = bqContent.replace(/<b>(.*?)<\/b>/gi, '**$1**');
                bqContent = bqContent.replace(/<em>(.*?)<\/em>/gi, '*$1*');
                bqContent = bqContent.replace(/<i>(.*?)<\/i>/gi, '*$1*');
                bqContent = bqContent.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
                bqContent = bqContent.replace(/<code>(.*?)<\/code>/gi, '`$1`');
                bqContent = bqContent.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
                bqContent = bqContent.replace(/<div[^>]*>/gi, '');
                bqContent = bqContent.replace(/<\/div>/gi, ' ');
                bqContent = bqContent.replace(/<[^>]+>/g, '');
                
                // 解码 HTML 实体
                const textarea = document.createElement('textarea');
                textarea.innerHTML = bqContent;
                bqContent = textarea.value;
                
                // 按行分割，每行前加 >，完全保留原始格式（包括空行和空格）
                const lines = bqContent.split('\n');
                const quotedLines = lines.map(line => {
                    return '> ' + line;
                });
                const blockquoteMarkdown = quotedLines.join('\n');
                
                // 替换占位符，保留在段落内容中
                processedContent = processedContent.replace(item.placeholder, blockquoteMarkdown);
            });
            
            // 将处理后的内容直接设置为段落的文本内容（不包含 p 标签）
            // 这样 Turndown 会将其作为段落内容处理
            p.innerHTML = processedContent;
        }
    });
    
    try {
        // 处理图片，保留 data-click-attached 属性
        const images = tempDiv.querySelectorAll('img[data-click-attached]');
        images.forEach(img => {
            // 图片会被 Turndown 自动转换
        });
        
        // 使用 Turndown 转换
        let markdown = turndownService.turndown(tempDiv);
        
        return markdown;
    } catch (error) {
        console.error('Turndown.js 转换错误:', error);
        throw error;
    }
}
