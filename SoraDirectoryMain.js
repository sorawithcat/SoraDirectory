// 自定义对话框系统
        const customDialogOverlay = document.getElementById('customDialogOverlay');
        const customDialog = document.getElementById('customDialog');
        const customDialogTitle = document.getElementById('customDialogTitle');
        const customDialogMessage = document.getElementById('customDialogMessage');
        const customDialogInput = document.getElementById('customDialogInput');
        const customDialogFooter = document.getElementById('customDialogFooter');
        const customDialogClose = document.getElementById('customDialogClose');
        
        // 自定义 alert
        function customAlert(message, title = '提示') {
            return new Promise((resolve) => {
                customDialogTitle.textContent = title;
                customDialogMessage.textContent = message;
                customDialogInput.style.display = 'none';
                customDialogFooter.innerHTML = '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
                
                const okBtn = document.getElementById('customDialogOk');
                const closeBtn = customDialogClose;
                
                const closeDialog = () => {
                    customDialogOverlay.classList.remove('active');
                    resolve();
                };
                
                okBtn.onclick = closeDialog;
                closeBtn.onclick = closeDialog;
                customDialogOverlay.onclick = (e) => {
                    if (e.target === customDialogOverlay) closeDialog();
                };
                
                customDialogOverlay.classList.add('active');
                okBtn.focus();
            });
        }
        
        // 自定义 confirm
        function customConfirm(message, title = '确认') {
            return new Promise((resolve) => {
                customDialogTitle.textContent = title;
                customDialogMessage.textContent = message;
                customDialogInput.style.display = 'none';
                customDialogFooter.innerHTML = 
                    '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
                    '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
                
                const okBtn = document.getElementById('customDialogOk');
                const cancelBtn = document.getElementById('customDialogCancel');
                const closeBtn = customDialogClose;
                
                const closeDialog = (result) => {
                    customDialogOverlay.classList.remove('active');
                    resolve(result);
                };
                
                okBtn.onclick = () => closeDialog(true);
                cancelBtn.onclick = () => closeDialog(false);
                closeBtn.onclick = () => closeDialog(false);
                customDialogOverlay.onclick = (e) => {
                    if (e.target === customDialogOverlay) closeDialog(false);
                };
                
                customDialogOverlay.classList.add('active');
                okBtn.focus();
            });
        }
        
        // 自定义 prompt
        function customPrompt(message, defaultValue = '', title = '输入') {
            return new Promise((resolve) => {
                customDialogTitle.textContent = title;
                customDialogMessage.textContent = message;
                customDialogInput.style.display = 'block';
                customDialogInput.value = defaultValue;
                customDialogInput.placeholder = defaultValue;
                customDialogFooter.innerHTML = 
                    '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
                    '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
                
                const okBtn = document.getElementById('customDialogOk');
                const cancelBtn = document.getElementById('customDialogCancel');
                const closeBtn = customDialogClose;
                
                const closeDialog = (result) => {
                    customDialogOverlay.classList.remove('active');
                    resolve(result);
                };
                
                const handleOk = () => {
                    closeDialog(customDialogInput.value);
                };
                
                okBtn.onclick = handleOk;
                cancelBtn.onclick = () => closeDialog(null);
                closeBtn.onclick = () => closeDialog(null);
                customDialogInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleOk();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeDialog(null);
                    }
                };
                customDialogOverlay.onclick = (e) => {
                    if (e.target === customDialogOverlay) closeDialog(null);
                };
                
                customDialogOverlay.classList.add('active');
                setTimeout(() => customDialogInput.focus(), 100);
            });
        }
        
        //储存目录文件
        let mulufile = [["mulu", "目录名", "mulu目录名", "节点内容"]];

        //去除默认事件（但允许在编辑器中使用右键菜单）
        document.oncontextmenu = function (e) {
            // 如果是在预览区域，显示格式工具栏
            if (e.target === markdownPreview || markdownPreview.contains(e.target)) {
                e.preventDefault();
                showTextFormatToolbar(e);
                return false;
            }
            return false;
        }
        //所有物体
        const body = document.querySelector("body");
        const allThins = body.querySelectorAll("*");
        //包裹目录的两个盒子
        const bigbox = document.querySelector(".bigbox");
        const showbox = document.querySelector(".showbox");
        //所有的目录
        const mulus = document.querySelectorAll(".mulu");
        //拖动元素的框
        const box = document.querySelector('.box');
        //目录容器
        const firststep = document.querySelector(".firststep");

        //目录主体
        const mulubox = document.querySelector(".mulubox");
        //按钮容器
        //添加目录
        const addNewMuluButton = document.querySelector(".addNewMuluButton");
        //添加新节点
        const addNewPotsButton = document.querySelector(".addNewPotsButton");
        //添加节点内容
        //const addNewWordsButton = document.querySelector(".addNewWordsButton");
        
        // 顶部工具栏按钮
        const newBtn = document.getElementById("newBtn");
        const topSaveBtn = document.getElementById("saveBtn");
        const saveAsBtn = document.getElementById("saveAsBtn");
        const topLoadBtn = document.getElementById("loadBtn");
        const undoBtn = document.getElementById("undoBtn");
        const redoBtn = document.getElementById("redoBtn");
        const cutBtn = document.getElementById("cutBtn");
        const copyBtn = document.getElementById("copyBtn");
        const pasteBtn = document.getElementById("pasteBtn");
        const findBtn = document.getElementById("findBtn");
        const replaceBtn = document.getElementById("replaceBtn");
        const expandAllBtn = document.getElementById("expandAllBtn");
        const collapseAllBtn = document.getElementById("collapseAllBtn");
        const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
        const fullscreenBtn = document.getElementById("fullscreenBtn");
        const settingsBtn = document.getElementById("settingsBtn");
        const topImageUploadBtn = document.getElementById("topImageUploadBtn");
        const topLinkBtn = document.getElementById("topLinkBtn");
        const topToolbar = document.getElementById("topToolbar");
        //节点内容容器
        const jiedianwords = document.querySelector(".jiedianwords");
        const markdownPreview = document.querySelector(".markdown-preview");
        const textFormatToolbar = document.querySelector(".text-format-toolbar");
        const imageUploadBtn = document.getElementById("imageUploadBtn");
        const imageFileInput = document.getElementById("imageFileInput");
        //文件录入按键
        const anjiansss = document.querySelector(".anjiansss");
        //文件录入加载界面按键
        const loadssss = document.querySelector(".loadssss");
        //节点盒子
        const wordsbox = document.querySelector(".wordsbox");
        //右键菜单
        const rightmousemenu = document.querySelector(".rightmousemenu");
        //右键-删除
        const deleteMulu = document.querySelector(".deleteMulu");
        //右键-取消
        const noneRightMouseMenu = document.querySelector(".noneRightMouseMenu");
        //右键-展开所有目录
        const showAllMulu = document.querySelector(".showAllMulu");
        //右键-收缩所有目录
        const cutAllMulu = document.querySelector(".cutAllMulu");


        //规则/注意事项
        const bianxierule = document.querySelector(".bianxierule");

        //新/旧的目录名
        let newName, oldName;
        //所选择的目录
        let currentMuluName;
        
        // 辅助函数：安全获取类名
        function getClassNames(element) {
            let classList = Array.from(element.classList);
            // 过滤掉 "mulu" 和 "select" 类名
            let filtered = classList.filter(c => c !== "mulu" && c !== "select");
            return {
                parentClass: filtered[0] || null,
                selfClass: filtered[1] || filtered[0] || null,
                isTopLevel: filtered.length === 1 && filtered[0] !== null
            };
        }
        
        // 辅助函数：从mulufile中查找并更新数据 - 基于data属性
        function updateMulufileData(element, newContent) {
            let dirId = element.getAttribute("data-dir-id");
            let name = element.innerHTML;
            
            if (!dirId) return false;
            
            for (let i = 0; i < mulufile.length; i++) {
                let item = mulufile[i];
                if (item.length === 4 && item[2] === dirId && item[1] === name) {
                    mulufile[i][3] = newContent;
                    return true;
                }
            }
            return false;
        }
        
        // 辅助函数：从mulufile中查找数据 - 基于data属性
        function findMulufileData(element) {
            let dirId = element.getAttribute("data-dir-id");
            let name = element.innerHTML;
            
            if (!dirId) return "";
            
            for (let i = 0; i < mulufile.length; i++) {
                let item = mulufile[i];
                if (item.length === 4 && item[2] === dirId && item[1] === name) {
                    return item[3];
                }
            }
            return "";
        }
        
        // 根据目录ID查找所有子目录元素
        function findChildElementsByParentId(parentId) {
            let children = [];
            let allMulus = document.querySelectorAll(".mulu");
            for (let i = 0; i < allMulus.length; i++) {
                let mulu = allMulus[i];
                let parentIdAttr = mulu.getAttribute("data-parent-id");
                if (parentIdAttr === parentId) {
                    children.push(mulu);
                }
            }
            return children;
        }
        
        // 改进的显示/隐藏子目录函数 - 基于data属性
        function toggleChildDirectories(parentId, show) {
            if (!parentId) return;
            
            let children = findChildElementsByParentId(parentId);
            if (children.length === 0) return; // 没有子目录
            
            for (let i = 0; i < children.length; i++) {
                let child = children[i];
                
                // 设置显示/隐藏
                if (show) {
                    child.style.display = "block";
                    // 如果子目录本身是展开的，也展开它的子目录
                    if (child.classList.contains("has-children") && child.classList.contains("expanded")) {
                        let childId = child.getAttribute("data-dir-id");
                        if (childId) {
                            toggleChildDirectories(childId, true);
                        }
                    }
                } else {
                    child.style.display = "none";
                    // 递归隐藏所有子目录
                    let childId = child.getAttribute("data-dir-id");
                    if (childId) {
                        toggleChildDirectories(childId, false);
                    }
                }
            }
        }
        ////快捷按键
        //let ADD, REMOVE, SAVE;

        //快捷键（暂时停用
        //window.onkeyup = function () {
        //    if ((event.key == "a" && event.ctrlKey) || (event.key == "A" && event.ctrlKey)) {
        //        event.preventDefault();
        //        addNewMuluButton.click();
        //    }
        //}
        AddListStyleForFolder();
        //区分文件夹和文件 - 基于data属性
        function AddListStyleForFolder() {
            let allMulus = document.querySelectorAll(".mulu");
            let processedDirs = new Set();
            
            for (let i = 0; i < allMulus.length; i++) {
                let mulu = allMulus[i];
                let dirId = mulu.getAttribute("data-dir-id");
                
                if (dirId && !processedDirs.has(dirId)) {
                    // 检查是否有子目录
                    let children = findChildElementsByParentId(dirId);
                    if (children.length > 0) {
                        mulu.style.fontStyle = "italic";
                        processedDirs.add(dirId);
                    }
                }
            }
        }

        box.addEventListener("mouseup", function (e) {
            if (e.button == 2) {
                box.style.display = "none";
                wordsbox.style.display = "block";
                anjiansss.style.display = "none";
                bigbox.style.display = "block";
            }
        })
        // 简单的 Markdown 解析器
        function parseMarkdown(text) {
            if (!text) return '';
            
            let html = text;
            
            // 先按行分割，处理需要行级处理的元素（引用、列表、水平线）
            const lines = html.split('\n');
            let inList = false;
            let listType = '';
            let inBlockquote = false;
            let blockquoteContent = [];
            let result = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const quoteMatch = line.match(/^> (.*)$/);
                const ulMatch = line.match(/^[\*\-\+] (.*)$/);
                const olMatch = line.match(/^\d+\. (.*)$/);
                const hrMatch = line.trim() === '---' || /^---\s*$/.test(line.trim());
                
                // 检查是否是水平线
                if (hrMatch) {
                    // 先关闭列表和引用
                    if (inList) {
                        result.push(`</${listType}>`);
                        inList = false;
                        listType = '';
                    }
                    if (inBlockquote) {
                        result.push('<blockquote>' + blockquoteContent.join('<br>') + '</blockquote>');
                        inBlockquote = false;
                        blockquoteContent = [];
                    }
                    result.push('<hr>');
                } else if (quoteMatch) {
                    // 引用行 - 先处理行内的格式
                    let quoteLine = quoteMatch[1];
                    // 处理引用行内的格式（粗体、斜体等）
                    quoteLine = quoteLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    quoteLine = quoteLine.replace(/__(.*?)__/g, '<strong>$1</strong>');
                    quoteLine = quoteLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
                    quoteLine = quoteLine.replace(/_(.*?)_/g, '<em>$1</em>');
                    quoteLine = quoteLine.replace(/~~(.*?)~~/g, '<s>$1</s>');
                    quoteLine = quoteLine.replace(/`(.*?)`/g, '<code>$1</code>');
                    quoteLine = quoteLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
                    
                    if (inList) {
                        result.push(`</${listType}>`);
                        inList = false;
                        listType = '';
                    }
                    if (!inBlockquote) {
                        inBlockquote = true;
                        blockquoteContent = [];
                    }
                    blockquoteContent.push(quoteLine);
                } else if (ulMatch) {
                    // 先关闭引用
                    if (inBlockquote) {
                        result.push('<blockquote>' + blockquoteContent.join('<br>') + '</blockquote>');
                        inBlockquote = false;
                        blockquoteContent = [];
                    }
                    // 处理列表项内的格式
                    let listItem = ulMatch[1];
                    listItem = listItem.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    listItem = listItem.replace(/__(.*?)__/g, '<strong>$1</strong>');
                    listItem = listItem.replace(/\*(.*?)\*/g, '<em>$1</em>');
                    listItem = listItem.replace(/_(.*?)_/g, '<em>$1</em>');
                    listItem = listItem.replace(/~~(.*?)~~/g, '<s>$1</s>');
                    listItem = listItem.replace(/`(.*?)`/g, '<code>$1</code>');
                    listItem = listItem.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
                    
                    // 处理列表
                    if (!inList || listType !== 'ul') {
                        if (inList) result.push(`</${listType}>`);
                        result.push('<ul>');
                        inList = true;
                        listType = 'ul';
                    }
                    result.push(`<li>${listItem}</li>`);
                } else if (olMatch) {
                    // 先关闭引用
                    if (inBlockquote) {
                        result.push('<blockquote>' + blockquoteContent.join('<br>') + '</blockquote>');
                        inBlockquote = false;
                        blockquoteContent = [];
                    }
                    // 处理列表项内的格式
                    let listItem = olMatch[1];
                    listItem = listItem.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    listItem = listItem.replace(/__(.*?)__/g, '<strong>$1</strong>');
                    listItem = listItem.replace(/\*(.*?)\*/g, '<em>$1</em>');
                    listItem = listItem.replace(/_(.*?)_/g, '<em>$1</em>');
                    listItem = listItem.replace(/~~(.*?)~~/g, '<s>$1</s>');
                    listItem = listItem.replace(/`(.*?)`/g, '<code>$1</code>');
                    listItem = listItem.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
                    
                    // 处理列表
                    if (!inList || listType !== 'ol') {
                        if (inList) result.push(`</${listType}>`);
                        result.push('<ol>');
                        inList = true;
                        listType = 'ol';
                    }
                    result.push(`<li>${listItem}</li>`);
                } else {
                    // 普通行 - 处理格式
                    let processedLine = line;
                    
                    // 先检查是否是标题（必须在格式处理之前，因为标题可能包含格式）
                    const h3Match = processedLine.match(/^### (.*)$/);
                    const h2Match = processedLine.match(/^## (.*)$/);
                    const h1Match = processedLine.match(/^# (.*)$/);
                    
                    if (h3Match) {
                        processedLine = '<h3>' + h3Match[1] + '</h3>';
                    } else if (h2Match) {
                        processedLine = '<h2>' + h2Match[1] + '</h2>';
                    } else if (h1Match) {
                        processedLine = '<h1>' + h1Match[1] + '</h1>';
                    } else {
                        // 不是标题，处理格式
                        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        processedLine = processedLine.replace(/__(.*?)__/g, '<strong>$1</strong>');
                        processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
                        processedLine = processedLine.replace(/_(.*?)_/g, '<em>$1</em>');
                        processedLine = processedLine.replace(/~~(.*?)~~/g, '<s>$1</s>');
                        processedLine = processedLine.replace(/`(.*?)`/g, '<code>$1</code>');
                        processedLine = processedLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
                    }
                    
                    // 先关闭列表和引用
                    if (inList) {
                        result.push(`</${listType}>`);
                        inList = false;
                        listType = '';
                    }
                    if (inBlockquote) {
                        result.push('<blockquote>' + blockquoteContent.join('<br>') + '</blockquote>');
                        inBlockquote = false;
                        blockquoteContent = [];
                    }
                    // 添加到结果（保留所有行，包括空行）
                    result.push(processedLine);
                }
            }
            
            // 关闭未关闭的列表和引用
            if (inList) result.push(`</${listType}>`);
            if (inBlockquote) {
                result.push('<blockquote>' + blockquoteContent.join('<br>') + '</blockquote>');
            }
            
            html = result.join('\n');
            
            // 处理代码块和图片（这些需要在整个文本中处理，因为可能跨行）
            html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
            html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
            
            // 换行处理：将 \n 替换为 <br>
            // 先处理hr，避免被br包围
            html = html.replace(/\n\s*<hr>\s*\n/gi, '<hr>');
            html = html.replace(/\n\s*<hr>/gi, '<hr>');
            html = html.replace(/<hr>\s*\n/gi, '<hr>');
            
            // 然后处理其他换行
            html = html.replace(/\n/g, '<br>');
            
            // 如果结果为空或只包含空白，返回空字符串
            if (!html.trim()) {
                return '';
            }
            
            return html;
        }
        
        // 将 HTML 内容转换回 Markdown（简化版）
        function htmlToMarkdown(html) {
            if (!html) return '';
            
            let md = html;
            
            // 移除 HTML 标签，保留文本内容
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // 先处理水平线（hr），必须在其他处理之前
            tempDiv.querySelectorAll('hr').forEach(el => {
                el.outerHTML = '\n---\n';
            });
            
            // 处理引用 - 必须在处理其他格式元素之前，因为blockquote内部可能包含这些元素
            // 我们需要先处理blockquote内部的内容，然后再处理其他独立的元素
            // 注意：需要先收集所有blockquote，因为替换后querySelectorAll可能找不到
            const blockquotes = Array.from(tempDiv.querySelectorAll('blockquote'));
            blockquotes.forEach(el => {
                // 获取blockquote内部的HTML内容（在处理之前）
                let innerHTML = el.innerHTML;
                
                // 创建一个临时div来处理内部内容
                let innerDiv = document.createElement('div');
                innerDiv.innerHTML = innerHTML;
                
                // 先处理内部的格式元素（粗体、斜体、代码、链接等）
                // 需要递归处理，因为格式可能嵌套，并且需要从内到外处理
                function processFormatElements(element) {
                    // 从最内层开始处理，避免替换后找不到元素
                    // 先处理代码（最内层）
                    let codes = element.querySelectorAll('code');
                    codes.forEach(code => {
                        if (code.parentElement && code.parentElement.tagName === 'PRE') {
                            code.outerHTML = '```\n' + code.textContent + '\n```';
                        } else {
                            code.outerHTML = '`' + code.textContent + '`';
                        }
                    });
                    
                    // 处理strong/b标签
                    let strongs = element.querySelectorAll('strong, b');
                    strongs.forEach(strong => {
                        if (!strong.closest('code') && !strong.closest('pre')) {
                            const text = strong.textContent;
                            strong.outerHTML = '**' + text + '**';
                        }
                    });
                    
                    // 处理em/i标签
                    let ems = element.querySelectorAll('em, i');
                    ems.forEach(em => {
                        if (!em.closest('code') && !em.closest('pre')) {
                            const text = em.textContent;
                            em.outerHTML = '*' + text + '*';
                        }
                    });
                    
                    // 处理s/strike/del标签
                    let dels = element.querySelectorAll('s, strike, del');
                    dels.forEach(del => {
                        if (!del.closest('code') && !del.closest('pre')) {
                            const text = del.textContent;
                            del.outerHTML = '~~' + text + '~~';
                        }
                    });
                    
                    // 处理a标签
                    let links = element.querySelectorAll('a');
                    links.forEach(a => {
                        const text = a.textContent;
                        const href = a.getAttribute('href') || '';
                        a.outerHTML = '[' + text + '](' + href + ')';
                    });
                    
                    // 处理img标签
                    let imgs = element.querySelectorAll('img');
                    imgs.forEach(img => {
                        const alt = img.getAttribute('alt') || '';
                        const src = img.getAttribute('src') || '';
                        img.outerHTML = '![' + alt + '](' + src + ')';
                    });
                }
                
                // 处理格式元素（需要多次处理，因为格式可能嵌套）
                let maxIterations = 10;
                let iteration = 0;
                while (iteration < maxIterations) {
                    const beforeHTML = innerDiv.innerHTML;
                    processFormatElements(innerDiv);
                    const afterHTML = innerDiv.innerHTML;
                    // 如果内容没有变化，说明已经处理完成
                    if (beforeHTML === afterHTML) {
                        break;
                    }
                    iteration++;
                }
                
                // 再次检查，确保所有格式元素都被处理
                // 如果还有strong/b/em/i等标签，说明处理失败，使用备用方法
                if (innerDiv.querySelector('strong, b, em, i, s, strike, del, code, a, img')) {
                    // 备用方法：直接处理innerHTML字符串
                    let html = innerDiv.innerHTML;
                    html = html.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
                    html = html.replace(/<b>(.*?)<\/b>/gi, '**$1**');
                    html = html.replace(/<em>(.*?)<\/em>/gi, '*$1*');
                    html = html.replace(/<i>(.*?)<\/i>/gi, '*$1*');
                    html = html.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
                    html = html.replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~');
                    html = html.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');
                    html = html.replace(/<code>(.*?)<\/code>/gi, '`$1`');
                    html = html.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
                    html = html.replace(/<img[^>]+alt=["']([^"']*)["'][^>]+src=["']([^"']+)["'][^>]*>/gi, '![$1]($2)');
                    innerDiv.innerHTML = html;
                }
                
                // 获取处理后的内容
                let processedContent = innerDiv.innerHTML;
                
                // 清理剩余的HTML标签（p、br等），转换为换行
                processedContent = processedContent.replace(/<p[^>]*>/gi, '');
                processedContent = processedContent.replace(/<\/p>/gi, '\n');
                processedContent = processedContent.replace(/<br\s*\/?>/gi, '\n');
                processedContent = processedContent.replace(/<div[^>]*>/gi, '');
                processedContent = processedContent.replace(/<\/div>/gi, '\n');
                
                // 清理其他HTML标签，但保留已转换的markdown格式文本
                // 注意：markdown格式（如 **text**）不包含 < >，所以不会被清理
                processedContent = processedContent.replace(/<[^>]+>/g, '');
                
                // 解码HTML实体（如 &gt; 转换为 >）
                // 但要注意，markdown格式（如 **text**）不应该被转义
                const textarea = document.createElement('textarea');
                textarea.innerHTML = processedContent;
                processedContent = textarea.value;
                
                // 按行分割，每行前加 >
                let lines = processedContent.split('\n');
                let quotedLines = lines.map(line => {
                    line = line.trim();
                    if (line) {
                        return '> ' + line;
                    }
                    return '';
                }).filter(line => line).join('\n');
                
                // 使用文本节点替换，避免HTML实体转义
                const parent = el.parentNode;
                if (parent) {
                    const textNode = document.createTextNode(quotedLines + '\n');
                    parent.replaceChild(textNode, el);
                } else {
                    // 如果没有父节点，创建一个临时容器
                    const tempContainer = document.createElement('div');
                    tempContainer.textContent = quotedLines + '\n';
                    el.outerHTML = tempContainer.textContent;
                }
            });
            
            // 处理标题（包括所有级别的标题）
            tempDiv.querySelectorAll('h1').forEach(h => {
                if (!h.closest('blockquote')) {
                    h.outerHTML = '# ' + h.textContent + '\n';
                }
            });
            tempDiv.querySelectorAll('h2').forEach(h => {
                if (!h.closest('blockquote')) {
                    h.outerHTML = '## ' + h.textContent + '\n';
                }
            });
            tempDiv.querySelectorAll('h3').forEach(h => {
                if (!h.closest('blockquote')) {
                    h.outerHTML = '### ' + h.textContent + '\n';
                }
            });
            tempDiv.querySelectorAll('h4').forEach(h => {
                if (!h.closest('blockquote')) {
                    h.outerHTML = '#### ' + h.textContent + '\n';
                }
            });
            tempDiv.querySelectorAll('h5').forEach(h => {
                if (!h.closest('blockquote')) {
                    h.outerHTML = '##### ' + h.textContent + '\n';
                }
            });
            tempDiv.querySelectorAll('h6').forEach(h => {
                if (!h.closest('blockquote')) {
                    h.outerHTML = '###### ' + h.textContent + '\n';
                }
            });
            
            // 处理粗体（排除blockquote内部的，因为已经处理过了）
            tempDiv.querySelectorAll('strong, b').forEach(el => {
                // 检查是否在blockquote内部
                if (!el.closest('blockquote')) {
                    el.outerHTML = '**' + el.textContent + '**';
                }
            });
            
            // 处理斜体（排除blockquote内部的）
            tempDiv.querySelectorAll('em, i').forEach(el => {
                if (!el.closest('blockquote')) {
                    el.outerHTML = '*' + el.textContent + '*';
                }
            });
            
            // 处理删除线（排除blockquote内部的）
            tempDiv.querySelectorAll('s, strike, del').forEach(el => {
                if (!el.closest('blockquote')) {
                    el.outerHTML = '~~' + el.textContent + '~~';
                }
            });
            
            // 处理下划线（排除blockquote内部的）
            tempDiv.querySelectorAll('u').forEach(el => {
                if (!el.closest('blockquote')) {
                    // Markdown 本身不支持下划线，但我们可以用 HTML 标签保存，或者转换为其他格式
                    // 这里我们保留为 HTML 标签，在 parseMarkdown 中需要支持
                    // 或者可以转换为其他格式，但为了保持一致性，我们保留 HTML
                    el.outerHTML = '<u>' + el.textContent + '</u>';
                }
            });
            
            // 处理代码块（pre）- 必须在处理单个code之前
            tempDiv.querySelectorAll('pre').forEach(pre => {
                if (!pre.closest('blockquote')) {
                    const code = pre.querySelector('code');
                    if (code) {
                        pre.outerHTML = '```\n' + code.textContent + '\n```';
                    } else {
                        pre.outerHTML = '```\n' + pre.textContent + '\n```';
                    }
                }
            });
            
            // 处理代码（排除blockquote内部和pre内部的）
            tempDiv.querySelectorAll('code').forEach(el => {
                if (!el.closest('blockquote') && el.parentElement.tagName !== 'PRE') {
                    el.outerHTML = '`' + el.textContent + '`';
                }
            });
            
            // 处理链接（排除blockquote内部的）
            tempDiv.querySelectorAll('a').forEach(el => {
                if (!el.closest('blockquote')) {
                    el.outerHTML = '[' + el.textContent + '](' + el.href + ')';
                }
            });
            
            // 处理图片（排除blockquote内部的）
            tempDiv.querySelectorAll('img').forEach(el => {
                if (!el.closest('blockquote')) {
                    el.outerHTML = '![' + (el.alt || '') + '](' + el.src + ')';
                }
            });
            
            // 处理列表 - 改进：保留列表项内部的格式
            tempDiv.querySelectorAll('ul, ol').forEach(list => {
                if (list.closest('blockquote')) {
                    // 如果列表在blockquote内部，已经处理过了，跳过
                    return;
                }
                
                const items = list.querySelectorAll('li');
                let listText = '';
                items.forEach(li => {
                    // 获取列表项的HTML内容，保留内部格式
                    let liHTML = li.innerHTML;
                    
                    // 创建一个临时div来处理列表项内部的内容
                    let liDiv = document.createElement('div');
                    liDiv.innerHTML = liHTML;
                    
                    // 处理列表项内部的格式元素
                    liDiv.querySelectorAll('strong, b').forEach(strong => {
                        strong.outerHTML = '**' + strong.textContent + '**';
                    });
                    liDiv.querySelectorAll('em, i').forEach(em => {
                        em.outerHTML = '*' + em.textContent + '*';
                    });
                    liDiv.querySelectorAll('s, strike, del').forEach(del => {
                        del.outerHTML = '~~' + del.textContent + '~~';
                    });
                    liDiv.querySelectorAll('u').forEach(u => {
                        u.outerHTML = '<u>' + u.textContent + '</u>';
                    });
                    liDiv.querySelectorAll('code').forEach(code => {
                        if (code.parentElement && code.parentElement.tagName === 'PRE') {
                            code.outerHTML = '```\n' + code.textContent + '\n```';
                        } else {
                            code.outerHTML = '`' + code.textContent + '`';
                        }
                    });
                    liDiv.querySelectorAll('a').forEach(a => {
                        a.outerHTML = '[' + a.textContent + '](' + a.href + ')';
                    });
                    
                    // 获取处理后的内容
                    let processedContent = liDiv.innerHTML;
                    
                    // 清理HTML标签，保留已转换的markdown格式
                    processedContent = processedContent.replace(/<p[^>]*>/gi, '');
                    processedContent = processedContent.replace(/<\/p>/gi, ' ');
                    processedContent = processedContent.replace(/<br\s*\/?>/gi, ' ');
                    processedContent = processedContent.replace(/<div[^>]*>/gi, '');
                    processedContent = processedContent.replace(/<\/div>/gi, ' ');
                    processedContent = processedContent.replace(/<[^>]+>/g, '');
                    
                    // 清理多余空格
                    processedContent = processedContent.trim().replace(/\s+/g, ' ');
                    
                    listText += (list.tagName === 'UL' ? '* ' : '1. ') + processedContent + '\n';
                });
                list.outerHTML = listText;
            });
            
            // 处理段落（p）- 保留内部格式
            tempDiv.querySelectorAll('p').forEach(p => {
                if (!p.closest('blockquote') && !p.closest('li')) {
                    let pHTML = p.innerHTML;
                    
                    // 创建一个临时div来处理段落内部的内容
                    let pDiv = document.createElement('div');
                    pDiv.innerHTML = pHTML;
                    
                    // 处理段落内部的格式元素（如果还没有处理过）
                    pDiv.querySelectorAll('strong, b').forEach(strong => {
                        if (!strong.closest('blockquote') && !strong.closest('li')) {
                            strong.outerHTML = '**' + strong.textContent + '**';
                        }
                    });
                    pDiv.querySelectorAll('em, i').forEach(em => {
                        if (!em.closest('blockquote') && !em.closest('li')) {
                            em.outerHTML = '*' + em.textContent + '*';
                        }
                    });
                    pDiv.querySelectorAll('s, strike, del').forEach(del => {
                        if (!del.closest('blockquote') && !del.closest('li')) {
                            del.outerHTML = '~~' + del.textContent + '~~';
                        }
                    });
                    pDiv.querySelectorAll('u').forEach(u => {
                        if (!u.closest('blockquote') && !u.closest('li')) {
                            u.outerHTML = '<u>' + u.textContent + '</u>';
                        }
                    });
                    
                    let processedContent = pDiv.innerHTML;
                    // 清理HTML标签，保留已转换的markdown格式
                    processedContent = processedContent.replace(/<[^>]+>/g, '');
                    processedContent = processedContent.trim();
                    
                    p.outerHTML = processedContent + '\n';
                }
            });
            
            // 获取最终的markdown文本
            // 优先使用textContent，因为它不会转义HTML实体
            // 但如果还有HTML元素，需要先清理
            md = tempDiv.textContent || tempDiv.innerText || '';
            
            // 如果textContent为空或只包含空白，说明可能还有HTML元素需要处理
            if (!md.trim() && tempDiv.innerHTML) {
                // 使用innerHTML并清理
                md = tempDiv.innerHTML;
                md = md.replace(/<br\s*\/?>/gi, '\n');
                
                // 清理剩余的 HTML 标签（但保留u标签，因为Markdown不原生支持下划线）
                // 先临时替换u标签，避免被清理
                const uTagPlaceholders = [];
                let uTagIndex = 0;
                md = md.replace(/<u>(.*?)<\/u>/gi, function(match, content) {
                    const placeholder = `__U_TAG_${uTagIndex}__`;
                    uTagPlaceholders.push({ placeholder: placeholder, match: match });
                    uTagIndex++;
                    return placeholder;
                });
                
                // 清理其他HTML标签
                md = md.replace(/<[^>]+>/g, '');
                
                // 恢复u标签
                uTagPlaceholders.forEach(item => {
                    md = md.replace(item.placeholder, item.match);
                });
                
                // 解码 HTML 实体
                const textarea = document.createElement('textarea');
                textarea.innerHTML = md;
                md = textarea.value;
            }
            
            return md.trim();
        }
        
        // 同步预览区域内容到隐藏的 textarea
        function syncPreviewToTextarea() {
            if (markdownPreview && jiedianwords) {
                const html = markdownPreview.innerHTML;
                const markdown = htmlToMarkdown(html);
                jiedianwords.value = markdown;
                
                // 更新数据
                if (currentMuluName) {
                    let changedmulu = document.querySelector(`#${currentMuluName}`);
                    if (changedmulu) {
                        updateMulufileData(changedmulu, markdown);
                    }
                }
            }
        }
        
        // 更新 Markdown 预览（从 textarea 同步到预览区域）
        function updateMarkdownPreview() {
            if (markdownPreview && jiedianwords) {
                markdownPreview.innerHTML = parseMarkdown(jiedianwords.value);
            }
        }
        
        // 预览区域内容改变时同步到 textarea
        let isUpdating = false;
        
        // 确保预览区域可编辑
        if (markdownPreview) {
            markdownPreview.setAttribute('contenteditable', 'true');
            markdownPreview.setAttribute('spellcheck', 'true');
            
            markdownPreview.addEventListener("input", function () {
                if (isUpdating) return;
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
            
            let formattedHtml = '';
            
            switch(command) {
                case 'bold':
                    if (!selectedText) return;
                    formattedHtml = '<strong>' + selectedText + '</strong>';
                    break;
                case 'italic':
                    if (!selectedText) return;
                    formattedHtml = '<em>' + selectedText + '</em>';
                    break;
                case 'underline':
                    if (!selectedText) return;
                    formattedHtml = '<u>' + selectedText + '</u>';
                    break;
                case 'strikethrough':
                    if (!selectedText) return;
                    formattedHtml = '<s>' + selectedText + '</s>';
                    break;
                case 'heading':
                    if (!selectedText) return;
                    formattedHtml = '<h2>' + selectedText + '</h2>';
                    break;
                case 'link':
                    const url = await customPrompt('输入链接地址:', 'https://');
                    if (!url) return;
                    
                    if (selectedText) {
                        // 有选中文字，用选中文字作为链接文本
                        formattedHtml = '<a href="' + url + '" target="_blank">' + selectedText + '</a>';
                    } else {
                        // 没有选中文字，用链接地址作为链接文本
                        formattedHtml = '<a href="' + url + '" target="_blank">' + url + '</a>';
                    }
                    break;
                case 'code':
                    if (!selectedText) return;
                    formattedHtml = '<code>' + selectedText + '</code>';
                    break;
                case 'paragraph':
                    if (selectedText) {
                        formattedHtml = '<p>' + selectedText + '</p>';
                    } else {
                        formattedHtml = '<p><br></p>';
                    }
                    break;
                case 'unordered-list':
                    if (selectedText) {
                        // 将选中文本按行分割，每行作为一个列表项
                        const lines = selectedText.split('\n').filter(line => line.trim());
                        formattedHtml = '<ul>' + lines.map(line => '<li>' + line.trim() + '</li>').join('') + '</ul>';
                    } else {
                        formattedHtml = '<ul><li><br></li></ul>';
                    }
                    break;
                case 'ordered-list':
                    if (selectedText) {
                        // 将选中文本按行分割，每行作为一个列表项
                        const lines = selectedText.split('\n').filter(line => line.trim());
                        formattedHtml = '<ol>' + lines.map(line => '<li>' + line.trim() + '</li>').join('') + '</ol>';
                    } else {
                        formattedHtml = '<ol><li><br></li></ol>';
                    }
                    break;
                case 'quote':
                    if (selectedText) {
                        formattedHtml = '<blockquote>' + selectedText + '</blockquote>';
                    } else {
                        formattedHtml = '<blockquote><br></blockquote>';
                    }
                    break;
                case 'hr':
                    formattedHtml = '<hr>';
                    break;
            }
            
            if (formattedHtml) {
                range.deleteContents();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = formattedHtml;
                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }
                range.insertNode(fragment);
                
                // 同步到 textarea
                syncPreviewToTextarea();
            }
            
            textFormatToolbar.style.display = 'none';
            textFormatToolbar.style.visibility = 'hidden';
            selectionRange = null;
        }
        
        // 图片上传（通过按钮、拖拽或粘贴）
        if (imageUploadBtn) {
            imageUploadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (imageFileInput) {
                    imageFileInput.click();
                }
            });
        }
        
        if (imageFileInput) {
            imageFileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                
                if (!file.type.startsWith('image/')) {
                    customAlert('请选择图片文件');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = async function(e) {
                    const imageData = e.target.result;
                    const imageName = file.name || 'image';
                    
                    // 提示用户输入图注
                    const caption = await customPrompt('输入图片图注（可选，直接按确定跳过）:', '');
                    
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.alt = imageName;
                    if (caption) {
                        img.title = caption;
                    }
                    // 保持原图大小，不设置 max-width
                    
                    // 添加点击展开功能
                    img.addEventListener('click', function() {
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
                    
                    // 在预览区域插入图片
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(imageContainer);
                        // 在图片后插入换行
                        const br = document.createElement('br');
                        range.setStartAfter(imageContainer);
                        range.insertNode(br);
                    } else {
                        // 如果没有选中，插入到末尾
                        markdownPreview.appendChild(imageContainer);
                        markdownPreview.appendChild(document.createElement('br'));
                    }
                    
                    // 同步到 textarea
                    syncPreviewToTextarea();
                    
                    // 重置文件输入
                    imageFileInput.value = '';
                };
                reader.readAsDataURL(file);
            });
        }
        
        // 图片查看器
        let imageViewerOverlay = null;
        
        function createImageViewer() {
            if (imageViewerOverlay) return imageViewerOverlay;
            
            imageViewerOverlay = document.createElement('div');
            imageViewerOverlay.className = 'image-viewer-overlay';
            imageViewerOverlay.addEventListener('click', function() {
                hideImageViewer();
            });
            
            const img = document.createElement('img');
            imageViewerOverlay.appendChild(img);
            document.body.appendChild(imageViewerOverlay);
            
            return imageViewerOverlay;
        }
        
        function showImageViewer(imageSrc) {
            const viewer = createImageViewer();
            const img = viewer.querySelector('img');
            img.src = imageSrc;
            viewer.classList.add('active');
        }
        
        function hideImageViewer() {
            if (imageViewerOverlay) {
                imageViewerOverlay.classList.remove('active');
            }
        }
        
        // 为预览区域中已有的图片添加点击事件
        function attachImageClickEvents() {
            const images = markdownPreview.querySelectorAll('img');
            images.forEach(img => {
                // 避免重复绑定
                if (!img.hasAttribute('data-click-attached')) {
                    img.setAttribute('data-click-attached', 'true');
                    img.addEventListener('click', function(e) {
                        e.stopPropagation();
                        showImageViewer(img.src);
                    });
                }
            });
        }
        
        // 监听预览区域内容变化，为新插入的图片添加点击事件
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeName === 'IMG') {
                            node.addEventListener('click', function(e) {
                                e.stopPropagation();
                                showImageViewer(node.src);
                            });
                        }
                    });
                }
            });
            attachImageClickEvents();
        });
        
        if (markdownPreview) {
            observer.observe(markdownPreview, {
                childList: true,
                subtree: true
            });
            // 初始绑定已有图片
            attachImageClickEvents();
        }
        
        // 支持拖拽图片到预览区域
        if (markdownPreview) {
            markdownPreview.addEventListener("dragover", function(e) {
                e.preventDefault();
                e.stopPropagation();
            });
            
            markdownPreview.addEventListener("drop", function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        if (file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = async function(e) {
                                const imageData = e.target.result;
                                const imageName = file.name || '图片';
                                
                                // 提示用户输入图注
                                const caption = await customPrompt('输入图片图注（可选，直接按确定跳过）:', '');
                                
                                const img = document.createElement('img');
                                img.src = imageData;
                                img.alt = imageName;
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
                        }
                    }
                }
            });
        }
        
        // 点击其他地方隐藏工具栏
        document.addEventListener('click', function(e) {
            if (textFormatToolbar && !textFormatToolbar.contains(e.target) && 
                e.target !== markdownPreview && !markdownPreview.contains(e.target)) {
                textFormatToolbar.style.display = 'none';
                textFormatToolbar.style.visibility = 'hidden';
            }
        });

        // 计算目录层级
        function calculateLevel(parentId, mulufile) {
            if (parentId === "mulu") return 0;
            let level = 0;
            let currentParent = parentId;
            let visited = new Set();
            
            while (currentParent && currentParent !== "mulu" && !visited.has(currentParent)) {
                visited.add(currentParent);
                level++;
                // 查找当前父目录的父目录
                for (let i = 0; i < mulufile.length; i++) {
                    if (mulufile[i].length === 4 && mulufile[i][2] === currentParent) {
                        currentParent = mulufile[i][0];
                        break;
                    }
                }
                if (level > 20) break; // 防止无限循环
            }
            return level;
        }
        
        // 根据层级计算并设置偏移量（使用公式）
        function setLevelPadding(element, level) {
            // 公式：基础偏移20px + 每级增加20px
            // level 0: 20px, level 1: 40px, level 2: 60px, ...
            let paddingLeft = 20 + (level * 20);
            element.style.paddingLeft = paddingLeft + 'px';
        }
        
        //加载目录
        function LoadMulu() {
            if (!Array.isArray(mulufile) || mulufile.length === 0) {
                customAlert("无效的文件格式");
                return;
            }
            if (mulufile[0][0] !== "mulu") {
                customAlert("文件格式错误：第一个目录必须以'mulu'开头");
                return;
            }
            let error = 0;
            let warning = 0;
            let idName
            let muluss = document.querySelectorAll(".mulu");
            for (let i = 0; i < muluss.length; i++) {
                muluss[i].remove();
            }
            for (let i = 0; i < mulufile.length; i++) {
                if (mulufile[i].length == 4) {
                    if (mulufile[i][2] == "mulufirststep" || mulufile[i][0] == "mulufirststep") {
                        warning++;
                    }
                    
                    // 使用data属性查找父目录，而不是类名
                    let parentElement = null;
                    if (i > 0 && mulufile[i][0] !== "mulu") {
                        // 查找父目录元素
                        let parentElements = document.querySelectorAll(`[data-dir-id="${mulufile[i][0]}"]`);
                        if (parentElements.length > 0) {
                            parentElement = parentElements[0];
                        }
                    }
                    
                    // 创建新目录元素，只使用基础类名 "mulu"
                    if (i == 0) {
                        idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
                    } else {
                        if (parentElement) {
                            // 如果有父目录，插入到父目录的最后一个子目录后面
                            let siblings = findChildElementsByParentId(mulufile[i][0]);
                            if (siblings.length > 0) {
                                idName = creatDivByIdBefore(siblings[siblings.length - 1].id, getOneId(10, 0), "mulu");
                            } else {
                                // 如果没有兄弟节点，插入到父目录后面
                                idName = creatDivByIdBefore(parentElement.id, getOneId(10, 0), "mulu");
                            }
                        } else {
                            // 如果没有父目录，插入到firststep
                            idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
                        }
                    }
                    let newMulu = document.querySelector(`#${idName}`);
                    newMulu.innerHTML = mulufile[i][1];
                    
                    // 设置层级
                    let level = calculateLevel(mulufile[i][0], mulufile);
                    newMulu.setAttribute("data-level", level);
                    // 使用公式计算并设置偏移量
                    setLevelPadding(newMulu, level);
                    
                    // 设置目录ID和父目录ID（用于查找子目录）
                    newMulu.setAttribute("data-dir-id", mulufile[i][2]); // 当前目录的ID
                    newMulu.setAttribute("data-parent-id", mulufile[i][0]); // 父目录的ID
                    
                    // 检查是否有子目录
                    let hasChildren = false;
                    for (let j = 0; j < mulufile.length; j++) {
                        if (j !== i && mulufile[j].length === 4 && mulufile[j][0] === mulufile[i][2]) {
                            hasChildren = true;
                            break;
                        }
                    }
                    if (hasChildren) {
                        newMulu.classList.add("has-children");
                        newMulu.classList.add("expanded"); // 默认展开
                    }
                    // 使用定时器来区分单击和双击
                    let clickTimer = null;
                    newMulu.addEventListener("mouseup", function (e) {
                        if (e.button == 0) {
                            // 检查是否点击在三角区域（左侧20px内）
                            let clickX = e.offsetX || (e.clientX - newMulu.getBoundingClientRect().left);
                            let isClickOnTriangle = clickX < 20;
                            
                            // 如果有子目录且点击在三角区域，切换折叠/展开
                            if (newMulu.classList.contains("has-children") && isClickOnTriangle) {
                                e.stopPropagation();
                                // 清除单击定时器，避免与双击冲突
                                if (clickTimer) {
                                    clearTimeout(clickTimer);
                                    clickTimer = null;
                                }
                                let isExpanded = newMulu.classList.contains("expanded");
                                let dirId = newMulu.getAttribute("data-dir-id");
                                
                                if (isExpanded) {
                                    newMulu.classList.remove("expanded");
                                    if (dirId) {
                                        toggleChildDirectories(dirId, false);
                                    }
                                } else {
                                    newMulu.classList.add("expanded");
                                    if (dirId) {
                                        toggleChildDirectories(dirId, true);
                                    }
                                }
                                return;
                            }
                            
                            // 延迟执行单击操作，等待可能的双击
                            if (clickTimer) {
                                clearTimeout(clickTimer);
                            }
                            clickTimer = setTimeout(function() {
                                // 正常选择目录
                                currentMuluName = newMulu.id;
                                RemoveOtherSelect();
                                newMulu.classList.add("select");
                                jiedianwords.value = mulufile[i][3];
                            isUpdating = true;
                            updateMarkdownPreview();
                            isUpdating = false;
                                clickTimer = null;
                            }, 300); // 300ms延迟，如果在这期间有双击则取消

                        } else if (e.button == 2) {
                            // 清除单击定时器
                            if (clickTimer) {
                                clearTimeout(clickTimer);
                                clickTimer = null;
                            }
                            currentMuluName = newMulu.id;
                            RemoveOtherSelect();
                            newMulu.classList.add("select");
                            jiedianwords.value = mulufile[i][3];
                            isUpdating = true;
                            updateMarkdownPreview();
                            isUpdating = false;
                            rightMouseMenu(e);
                        }
                    })
                    newMulu.addEventListener("dblclick", function (e) {
                        e.preventDefault(); // 阻止默认事件
                        e.stopPropagation(); // 阻止事件冒泡
                        // 清除单击定时器，避免触发单击操作
                        if (clickTimer) {
                            clearTimeout(clickTimer);
                            clickTimer = null;
                        }
                        oldName = newMulu.innerHTML;
                        customPrompt("新的名字", oldName).then(newName => {
                            if (!newName || newName.length === 0) {
                                newMulu.innerHTML = oldName;
                                return;
                            }
                            if (!ChangeChildName(currentMuluName, newName)) {
                                newMulu.innerHTML = oldName;
                                return;
                            }
                            newMulu.innerHTML = newName;
                        });
                        return;
                        if (newName && newName.length > 0) {
                            if (!ChangeChildName(currentMuluName, newName)) {
                                return; // 如果改名失败，直接返回
                            }
                            newMulu.innerHTML = newName;
                            console.log(mulufile);
                        } else {
                            newMulu.innerHTML = oldName;
                        }
                    })



                } else {
                    error++;
                }
            }
            DuplicateMuluHints();
            if (error == 0 && warning == 0) {
                console.log(`error:${error},warning:${warning}`);
            } else {
                console.warn(`error:${error},warning:${warning}`);

            }
        }
        //加载所有元素后执行
        document.addEventListener("DOMContentLoaded", function () {
            //给所有body里的东西添加id
            for (let i = 0; i < allThins.length; i++) {
                allThins[i].id = getOneId(10, 0);
            }
            LoadMulu();
            // 延迟执行，确保所有目录都已创建
            setTimeout(() => {
                // 初始化所有有子目录的目录，展开它们
                let allMulus = document.querySelectorAll(".mulu.has-children");
                for (let i = 0; i < allMulus.length; i++) {
                    let mulu = allMulus[i];
                    let dirId = mulu.getAttribute("data-dir-id");
                    if (dirId && mulu.classList.contains("expanded")) {
                        toggleChildDirectories(dirId, true);
                    }
                }
                NoneChildMulu();
                
                // 默认选中第一个根目录
                let firstRootMulu = null;
                let allMulusForSelect = document.querySelectorAll(".mulu");
                for (let i = 0; i < allMulusForSelect.length; i++) {
                    let mulu = allMulusForSelect[i];
                    let parentId = mulu.getAttribute("data-parent-id");
                    if (!parentId || parentId === "mulu") {
                        firstRootMulu = mulu;
                        break;
                    }
                }
                if (firstRootMulu) {
                    currentMuluName = firstRootMulu.id;
                    RemoveOtherSelect();
                    firstRootMulu.classList.add("select");
                    // 显示第一个目录的内容
                    jiedianwords.value = findMulufileData(firstRootMulu);
                    isUpdating = true;
                    updateMarkdownPreview();
                    isUpdating = false;
                }
            }, 10);
        })

        //初始隐藏子目录
        function NoneChildMulu() {
            cutAllMulu.click();
        }

        //检查目录名是否重复
        function isDuplicateName(name) {
            let allNames = [];
            let mulus = document.querySelectorAll(".mulu");
            for (let i = 0; i < mulus.length; i++) {
                allNames.push(mulus[i].innerHTML);
            }
            return allNames.includes(name);
        }

        //添加目录
        addNewMuluButton.addEventListener("click", async function () {
            let nMulu, newMuLuName;
            nMulu = await customPrompt("输入目录名", "");
            if (nMulu == "" || nMulu == null) {
                customAlert("已取消添加");
                return;
            }
            if (isDuplicateName(nMulu)) {
                customAlert("目录名已存在，请使用其他名称");
                return;
            }
            newMuLuName = `mulu${nMulu}`;
            let idName;
            
            // 检查是否有目录存在
            let allMulus = document.querySelectorAll(".mulu");
            let hasAnyMulu = allMulus.length > 0;
            
            // 如果没有选中目录或没有目录，创建根目录
            let currentElement = null;
            let currentDirId = null;
            let currentParentId = null;
            let parentIdForFile = "mulu";
            let newLevel = 0;
            
            if (checkid(currentMuluName, 1) && hasAnyMulu) {
                // 有选中目录，在当前目录的同级创建
                currentElement = document.getElementById(currentMuluName);
                currentDirId = currentElement.getAttribute("data-dir-id");
                currentParentId = currentElement.getAttribute("data-parent-id");
                
                // 确定父目录ID（用于mulufile）
                parentIdForFile = currentParentId || "mulu";
                if (currentParentId === "mulu" || !currentParentId) {
                    parentIdForFile = "mulu";
                }
                
                // 设置层级（同级目录）
                let parentLevel = currentElement.getAttribute("data-level") || 0;
                newLevel = parseInt(parentLevel);
            } else {
                // 没有选中目录或没有目录，创建根目录
                parentIdForFile = "mulu";
                newLevel = 0;
            }
            
            // 查找同级目录，确定插入位置
            let siblings = [];
            if (currentParentId && currentElement) {
                siblings = findChildElementsByParentId(currentParentId);
            } else {
                // 顶级目录
                for (let i = 0; i < allMulus.length; i++) {
                    let pId = allMulus[i].getAttribute("data-parent-id");
                    if (!pId || pId === "mulu") {
                        siblings.push(allMulus[i]);
                    }
                }
            }
            
            // 插入新目录
            if (currentElement && currentElement.nextSibling) {
                idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
            } else if (siblings.length > 0 && currentElement && siblings[siblings.length - 1] !== currentElement) {
                idName = creatDivByIdBefore(siblings[siblings.length - 1].id, getOneId(10, 0), "mulu");
            } else if (currentElement) {
                idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
            } else {
                // 没有目录，创建第一个根目录
                idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
            }
            
            mulufile.push([parentIdForFile, nMulu, newMuLuName, `${nMulu}`]);

            let newMulu = document.querySelector(`#${idName}`);
            newMulu.innerHTML = nMulu;
            
            // 设置层级
            newMulu.setAttribute("data-level", newLevel);
            // 使用公式计算并设置偏移量
            setLevelPadding(newMulu, newLevel);
            
            // 设置目录ID和父目录ID
            newMulu.setAttribute("data-dir-id", newMuLuName);
            newMulu.setAttribute("data-parent-id", parentIdForFile);
            
            // 检查是否有子目录（新添加的目录默认没有子目录）
            // has-children会在添加子目录时自动添加
            
            // 从同级目录获取样式
            if (siblings.length > 0 && siblings[0] !== newMulu) {
                let sibling = siblings[0];
                newMulu.style.display = sibling.style.display || "block";
            } else {
                newMulu.style.display = "block";
            }
            
            // 更新父目录的has-children标记（如果有父目录）
            if (currentElement && currentDirId && !currentElement.classList.contains("has-children")) {
                currentElement.classList.add("has-children");
                currentElement.classList.add("expanded");
            }
            
            // 使用定时器来区分单击和双击
            let clickTimer2 = null;
            newMulu.addEventListener("mouseup", function (e) {
                    if (e.button == 0) {
                        // 检查是否点击在三角区域
                        let clickX = e.offsetX || (e.clientX - newMulu.getBoundingClientRect().left);
                        let isClickOnTriangle = clickX < 20;
                        
                        if (newMulu.classList.contains("has-children") && isClickOnTriangle) {
                            e.stopPropagation();
                            // 清除单击定时器，避免与双击冲突
                            if (clickTimer2) {
                                clearTimeout(clickTimer2);
                                clickTimer2 = null;
                            }
                            let isExpanded = newMulu.classList.contains("expanded");
                            let dirId = newMulu.getAttribute("data-dir-id");
                            
                            if (isExpanded) {
                                newMulu.classList.remove("expanded");
                                if (dirId) {
                                    toggleChildDirectories(dirId, false);
                                }
                            } else {
                                newMulu.classList.add("expanded");
                                if (dirId) {
                                    toggleChildDirectories(dirId, true);
                                }
                            }
                            return;
                        }
                        
                        // 延迟执行单击操作，等待可能的双击
                        if (clickTimer2) {
                            clearTimeout(clickTimer2);
                        }
                        clickTimer2 = setTimeout(function() {
                            currentMuluName = newMulu.id;
                            RemoveOtherSelect();
                            newMulu.classList.add("select");
                            jiedianwords.value = findMulufileData(newMulu);
                            isUpdating = true;
                            updateMarkdownPreview();
                            isUpdating = false;
                            clickTimer2 = null;
                        }, 300); // 300ms延迟，如果在这期间有双击则取消
                    } else if (e.button == 2) {
                        // 清除单击定时器
                        if (clickTimer2) {
                            clearTimeout(clickTimer2);
                            clickTimer2 = null;
                        }
                        currentMuluName = newMulu.id;
                        RemoveOtherSelect();
                        newMulu.classList.add("select");
                        jiedianwords.value = findMulufileData(newMulu);
                        rightMouseMenu(e);
                    }
                });
                newMulu.addEventListener("dblclick", function (e) {
                    e.preventDefault(); // 阻止默认事件
                    e.stopPropagation(); // 阻止事件冒泡
                    // 清除单击定时器，避免触发单击操作
                    if (clickTimer2) {
                        clearTimeout(clickTimer2);
                        clickTimer2 = null;
                    }
                    oldName = newMulu.innerHTML;
                    customPrompt("新的名字", oldName).then(newName => {
                        if (newName && newName.length > 0) {
                            if (!ChangeChildName(newMulu.id, newName)) {
                                newMulu.innerHTML = oldName;
                                return;
                            }
                            newMulu.innerHTML = newName;
                            console.log(mulufile);
                        } else {
                            newMulu.innerHTML = oldName;
                        }
                    });
                })
                AddListStyleForFolder();
                DuplicateMuluHints();
        })

        //添加节点
        addNewPotsButton.addEventListener("click", async function () {
            let nMulu, newMuLuName;
            nMulu = await customPrompt("输入节点名", "");
            if (nMulu == "" || nMulu == null) {
                customAlert("已取消添加");
                return;
            }
            if (isDuplicateName(nMulu)) {
                customAlert("目录名已存在，请使用其他名称");
                return;
            }
            newMuLuName = `mulu${nMulu}`;
            let idName;
            
            // 检查是否有目录存在
            let allMulus = document.querySelectorAll(".mulu");
            let hasAnyMulu = allMulus.length > 0;
            
            // 如果没有选中目录或没有目录，创建根目录作为子节点
            let currentElement = null;
            let currentDirId = null;
            let currentParentId = null;
            let parentIdForFile = "mulu";
            let newLevel = 0;
            
            if (checkid(currentMuluName, 1) && hasAnyMulu) {
                // 有选中目录，作为子目录添加
                currentElement = document.getElementById(currentMuluName);
                currentDirId = currentElement.getAttribute("data-dir-id");
                currentParentId = currentElement.getAttribute("data-parent-id");
                
                // 确定父目录ID（用于mulufile）- 作为选中目录的子目录
                parentIdForFile = currentDirId || "mulu";
                
                // 设置层级（子目录）
                let parentLevel = currentElement.getAttribute("data-level") || 0;
                newLevel = parseInt(parentLevel) + 1;
            } else {
                // 没有选中目录或没有目录，创建根目录
                parentIdForFile = "mulu";
                newLevel = 0;
            }
            
            // 插入新目录
            if (currentElement) {
                idName = creatDivByIdBefore(currentMuluName, getOneId(10, 0), "mulu");
            } else {
                // 没有目录，创建第一个根目录
                idName = creatDivByClass("firststep", getOneId(10, 0), "mulu");
            }
            
            mulufile.push([parentIdForFile, nMulu, newMuLuName, `${nMulu}`]);
            
            let newMulu = document.querySelector(`#${idName}`);
            newMulu.innerHTML = nMulu;
            
            // 设置层级
            newMulu.setAttribute("data-level", newLevel);
            // 使用公式计算并设置偏移量
            setLevelPadding(newMulu, newLevel);
            
            // 设置目录ID和父目录ID
            newMulu.setAttribute("data-dir-id", newMuLuName);
            newMulu.setAttribute("data-parent-id", currentDirId || parentIdForFile);
            
            // 更新父目录的has-children标记（如果有父目录）
            if (currentElement && currentDirId && !currentElement.classList.contains("has-children")) {
                currentElement.classList.add("has-children");
                currentElement.classList.add("expanded");
            }
                
                // 从同级目录获取样式
                let siblings = findChildElementsByParentId(currentDirId || parentIdForFile);
                if (siblings.length > 1) {
                    let sibling = siblings[1];
                    newMulu.style.display = sibling.style.display || "block";
                } else {
                    newMulu.style.display = "block";
                }
                // 使用定时器来区分单击和双击
                let clickTimer2 = null;
                newMulu.addEventListener("mouseup", function (e) {
                    if (e.button == 0) {
                        // 检查是否点击在三角区域
                        let clickX = e.offsetX || (e.clientX - newMulu.getBoundingClientRect().left);
                        let isClickOnTriangle = clickX < 20;
                        
                        if (newMulu.classList.contains("has-children") && isClickOnTriangle) {
                            e.stopPropagation();
                            // 清除单击定时器，避免与双击冲突
                            if (clickTimer2) {
                                clearTimeout(clickTimer2);
                                clickTimer2 = null;
                            }
                            let isExpanded = newMulu.classList.contains("expanded");
                            let dirId = newMulu.getAttribute("data-dir-id");
                            
                            if (isExpanded) {
                                newMulu.classList.remove("expanded");
                                if (dirId) {
                                    toggleChildDirectories(dirId, false);
                                }
                            } else {
                                newMulu.classList.add("expanded");
                                if (dirId) {
                                    toggleChildDirectories(dirId, true);
                                }
                            }
                            return;
                        }
                        
                        // 延迟执行单击操作，等待可能的双击
                        if (clickTimer2) {
                            clearTimeout(clickTimer2);
                        }
                        clickTimer2 = setTimeout(function() {
                            currentMuluName = newMulu.id;
                            RemoveOtherSelect();
                            newMulu.classList.add("select");
                            jiedianwords.value = findMulufileData(newMulu);
                            isUpdating = true;
                            updateMarkdownPreview();
                            isUpdating = false;
                            clickTimer2 = null;
                        }, 300); // 300ms延迟，如果在这期间有双击则取消
                    } else if (e.button == 2) {
                        // 清除单击定时器
                        if (clickTimer2) {
                            clearTimeout(clickTimer2);
                            clickTimer2 = null;
                        }
                        currentMuluName = newMulu.id;
                        RemoveOtherSelect();
                        newMulu.classList.add("select");
                        jiedianwords.value = findMulufileData(newMulu);
                        rightMouseMenu(e);
                    }
                });
                newMulu.addEventListener("dblclick", function (e) {
                    e.preventDefault(); // 阻止默认事件
                    e.stopPropagation(); // 阻止事件冒泡
                    // 清除单击定时器，避免触发单击操作
                    if (clickTimer2) {
                        clearTimeout(clickTimer2);
                        clickTimer2 = null;
                    }
                    oldName = newMulu.innerHTML;
                    customPrompt("新的名字", oldName).then(newName => {
                        if (newName && newName.length > 0) {
                            if (!ChangeChildName(newMulu.id, newName)) {
                                newMulu.innerHTML = oldName;
                                return;
                            }
                            newMulu.innerHTML = newName;
                            console.log(mulufile);
                        } else {
                            newMulu.innerHTML = oldName;
                        }
                    });
                })
                AddListStyleForFolder();
                DuplicateMuluHints();
        })




        //显示右键菜单
        function rightMouseMenu(e) {
            rightmousemenu.style.display = "block";
            rightmousemenu.style.left = `${e.clientX}px`;
            rightmousemenu.style.top = `${e.clientY}px`;
        }
        //失去焦点后隐藏
        document.addEventListener('click', function () {
            noneRightMouseMenu.click();

        })

        //右键-取消
        noneRightMouseMenu.addEventListener("click", function () {
            rightmousemenu.style.display = "none";
        })

        //右键-删除 - 基于data属性
        deleteMulu.addEventListener("click", function () {
            customConfirm("是否删除此目录？").then(result => {
                if (!result) {
                    noneRightMouseMenu.click();
                    return;
                }
                let nowchild = document.getElementById(currentMuluName);
                if (!nowchild) {
                    noneRightMouseMenu.click();
                    return;
                }
                
                let currentDirId = nowchild.getAttribute("data-dir-id");
                
                // 递归删除所有子目录
                function deleteAllChildren(parentId) {
                    if (!parentId) return;
                    let children = findChildElementsByParentId(parentId);
                    
                    for (let i = children.length - 1; i >= 0; i--) {
                        let child = children[i];
                        if (child === nowchild) continue;
                        
                        let childId = child.getAttribute("data-dir-id");
                        
                        // 先递归删除子目录的子目录
                        if (childId) {
                            deleteAllChildren(childId);
                        }
                        
                        // 从mulufile中删除子目录数据
                        let childName = child.innerHTML;
                        for (let j = mulufile.length - 1; j >= 0; j--) {
                            let item = mulufile[j];
                            if (item.length === 4 && item[2] === childId && item[1] === childName) {
                                mulufile.splice(j, 1);
                                break;
                            }
                        }
                        
                        // 删除DOM元素
                        child.remove();
                    }
                }
                
                // 开始递归删除
                if (currentDirId) {
                    deleteAllChildren(currentDirId);
                }
                
                // 从mulufile中删除当前目录数据
                let currentName = nowchild.innerHTML;
                for (let i = mulufile.length - 1; i >= 0; i--) {
                    let item = mulufile[i];
                    if (item.length === 4 && item[2] === currentDirId && item[1] === currentName) {
                        mulufile.splice(i, 1);
                        break;
                    }
                }
                
                // 删除DOM元素
                nowchild.remove();
                
                // 重置状态
                currentMuluName = null;
                jiedianwords.value = "";
                isUpdating = true;
                updateMarkdownPreview();
                isUpdating = false;
                
                // 更新UI
                AddListStyleForFolder();
                DuplicateMuluHints();
                noneRightMouseMenu.click();
            });
        })


        //右键-展开目录
        showAllMulu.addEventListener("click", function () {
            let allMulus = document.querySelectorAll(".mulu.has-children");
            for (let i = 0; i < allMulus.length; i++) {
                let mulu = allMulus[i];
                mulu.classList.add("expanded");
                let dirId = mulu.getAttribute("data-dir-id");
                if (dirId) {
                    toggleChildDirectories(dirId, true);
                }
            }
        })

        //右键-收起目录
        cutAllMulu.addEventListener("click", function () {
            let allMulus = document.querySelectorAll(".mulu.has-children");
            for (let i = 0; i < allMulus.length; i++) {
                let mulu = allMulus[i];
                mulu.classList.remove("expanded");
                let dirId = mulu.getAttribute("data-dir-id");
                if (dirId) {
                    toggleChildDirectories(dirId, false);
                }
            }
        })
        
        // 更新工具栏高度（动态调整其他元素位置）
        function updateToolbarHeight() {
            if (topToolbar) {
                const toolbarHeight = topToolbar.offsetHeight;
                document.documentElement.style.setProperty('--toolbar-height', toolbarHeight + 'px');
                
                // 直接更新wordsbox的位置和高度，确保立即生效
                if (wordsbox) {
                    const availableHeight = window.innerHeight - toolbarHeight;
                    wordsbox.style.top = `${toolbarHeight}px`;
                    wordsbox.style.height = `${availableHeight}px`;
                    
                    // 确保内部容器高度正确
                    const markdownContainer = wordsbox.querySelector('.markdown-editor-container');
                    if (markdownContainer) {
                        markdownContainer.style.height = '100%';
                    }
                    const markdownPreview = wordsbox.querySelector('.markdown-preview');
                    if (markdownPreview) {
                        markdownPreview.style.height = '100%';
                    }
                }
                
                // 同时更新bigbox的位置和高度
                const bigbox = document.querySelector('.bigbox');
                if (bigbox) {
                    bigbox.style.top = `${toolbarHeight}px`;
                    bigbox.style.height = `${window.innerHeight - toolbarHeight}px`;
                }
            }
        }
        
        // 初始化时更新高度（立即执行，确保初始高度正确）
        if (topToolbar) {
            // 立即更新一次（使用requestAnimationFrame确保DOM已渲染）
            requestAnimationFrame(function() {
                updateToolbarHeight();
                // 再延迟一次确保完全渲染
                setTimeout(updateToolbarHeight, 0);
            });
            
            // 页面加载完成后更新
            window.addEventListener('load', function() {
                updateToolbarHeight();
            });
            
            // DOMContentLoaded时也更新
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    updateToolbarHeight();
                });
            } else {
                // 如果已经加载完成，立即更新
                updateToolbarHeight();
            }
            
            // 窗口大小改变时更新
            window.addEventListener('resize', function() {
                updateToolbarHeight();
            });
            
            // 使用MutationObserver监听工具栏内容变化
            const observer = new MutationObserver(function() {
                updateToolbarHeight();
            });
            observer.observe(topToolbar, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
        
        // 顶部工具栏按钮事件处理
        // 保存功能
        if (topSaveBtn) {
            topSaveBtn.addEventListener("click", function() {
                // 直接调用保存功能（保存功能代码在下面）
                handleSave();
            });
        }
        
        // 加载功能
        if (topLoadBtn) {
            topLoadBtn.addEventListener("click", function() {
                box.style.display = "block";
                anjiansss.style.display = "block";
                bigbox.style.display = "none";
                wordsbox.style.display = "none";
            });
        }
        
        // 规则按钮 - 切换显示
        const topRuleBtn = document.querySelector(".top-toolbar .ruleButton");
        if (topRuleBtn) {
            topRuleBtn.addEventListener("click", function() {
                if (bianxierule.style.display === "block") {
                    // 如果当前显示，则隐藏并恢复其他界面
                    bianxierule.style.display = "none";
                    bigbox.style.display = "block";
                    wordsbox.style.display = "block";
                    topRuleBtn.classList.remove("active");
                } else {
                    // 如果当前隐藏，则显示并隐藏其他界面
                    box.style.display = "none";
                    anjiansss.style.display = "none";
                    bigbox.style.display = "none";
                    wordsbox.style.display = "none";
                    bianxierule.style.display = "block";
                    topRuleBtn.classList.add("active");
                }
            });
        }
        
        if (expandAllBtn) {
            expandAllBtn.addEventListener("click", function() {
                if (showAllMulu) showAllMulu.click();
            });
        }
        
        if (collapseAllBtn) {
            collapseAllBtn.addEventListener("click", function() {
                if (cutAllMulu) cutAllMulu.click();
            });
        }
        
        // 切换侧边栏
        if (toggleSidebarBtn) {
            let sidebarVisible = true;
            toggleSidebarBtn.addEventListener("click", function() {
                sidebarVisible = !sidebarVisible;
                if (sidebarVisible) {
                    bigbox.style.display = "block";
                    wordsbox.style.left = "20%";
                    wordsbox.style.width = "calc(100% - 20%)";
                    toggleSidebarBtn.textContent = "隐藏侧边栏";
                } else {
                    bigbox.style.display = "none";
                    wordsbox.style.left = "0";
                    wordsbox.style.width = "100%";
                    toggleSidebarBtn.textContent = "显示侧边栏";
                }
            });
        }
        
        // 全屏功能
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener("click", function() {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        customAlert('无法进入全屏模式: ' + err.message);
                    });
                    fullscreenBtn.textContent = "退出全屏";
                } else {
                    document.exitFullscreen();
                    fullscreenBtn.textContent = "全屏";
                }
            });
            
            // 监听全屏状态变化
            document.addEventListener('fullscreenchange', function() {
                if (!document.fullscreenElement && fullscreenBtn) {
                    fullscreenBtn.textContent = "全屏";
                }
            });
        }
        
        // 设置按钮
        if (settingsBtn) {
            settingsBtn.addEventListener("click", function() {
                customAlert("设置功能开发中...");
            });
        }
        
        // 查找功能（简单实现）
        if (findBtn) {
            findBtn.addEventListener("click", function() {
                customPrompt("查找内容:", "").then(searchText => {
                    if (searchText && markdownPreview) {
                        const text = markdownPreview.innerText || markdownPreview.textContent;
                        if (text.indexOf(searchText) !== -1) {
                            customAlert(`找到 "${searchText}"`);
                            // 可以在这里实现高亮功能
                        } else {
                            customAlert(`未找到 "${searchText}"`);
                        }
                    }
                });
            });
        }
        
        // 撤销/重做功能（简单实现）
        if (undoBtn) {
            undoBtn.addEventListener("click", function() {
                document.execCommand('undo', false, null);
            });
        }
        
        if (redoBtn) {
            redoBtn.addEventListener("click", function() {
                document.execCommand('redo', false, null);
            });
        }
        
        // 新建功能
        if (newBtn) {
            newBtn.addEventListener("click", function() {
                if (confirm("确定要新建吗？当前未保存的内容将丢失。")) {
                    // 清空目录
                    const firststep = document.querySelector(".firststep");
                    if (firststep) {
                        firststep.innerHTML = "";
                    }
                    // 清空内容
                    if (jiedianwords) {
                        jiedianwords.value = "";
                    }
                    if (markdownPreview) {
                        markdownPreview.innerHTML = "";
                    }
                    customAlert("已新建");
                }
            });
        }
        
        // 另存为功能
        if (saveAsBtn) {
            saveAsBtn.addEventListener("click", async function() {
                // 另存为总是提示输入文件名
                let customName = await customPrompt("输入文件名（包含扩展名，如：mydata.json）", "");
                if (!customName) {
                    customAlert("已取消保存");
                    return;
                }
                // 调用保存功能，但使用自定义文件名
                await handleSaveAs(customName);
            });
        }
        
        // 复制功能
        if (copyBtn) {
            copyBtn.addEventListener("click", function() {
                if (markdownPreview) {
                    const selection = window.getSelection();
                    if (selection.toString()) {
                        document.execCommand('copy', false, null);
                    } else {
                        // 如果没有选中文字，复制整个内容
                        const text = markdownPreview.innerText || markdownPreview.textContent;
                        if (text) {
                            navigator.clipboard.writeText(text).then(() => {
                                customAlert("已复制到剪贴板");
                            }).catch(() => {
                                customAlert("复制失败");
                            });
                        }
                    }
                }
            });
        }
        
        // 剪切功能
        if (cutBtn) {
            cutBtn.addEventListener("click", function() {
                document.execCommand('cut', false, null);
                syncPreviewToTextarea();
            });
        }
        
        // 粘贴功能
        if (pasteBtn) {
            pasteBtn.addEventListener("click", function() {
                if (markdownPreview) {
                    markdownPreview.focus();
                    document.execCommand('paste', false, null);
                    syncPreviewToTextarea();
                }
            });
        }
        
        // 替换功能
        if (replaceBtn) {
            replaceBtn.addEventListener("click", function() {
                customPrompt("查找内容:", "").then(searchText => {
                    if (!searchText) return;
                    customPrompt("替换为:", "").then(replaceText => {
                        if (replaceText === null) return;
                        if (markdownPreview) {
                            const text = markdownPreview.innerText || markdownPreview.textContent;
                            if (text.indexOf(searchText) !== -1) {
                                const newText = text.replace(new RegExp(searchText, 'g'), replaceText);
                                markdownPreview.textContent = newText;
                                syncPreviewToTextarea();
                                customAlert(`已替换所有 "${searchText}" 为 "${replaceText}"`);
                            } else {
                                customAlert(`未找到 "${searchText}"`);
                            }
                        }
                    });
                });
            });
        }
        
        // 顶部工具栏格式按钮事件处理
        document.querySelectorAll('.format-toolbar-btn').forEach(btn => {
            if (btn.id === 'topLinkBtn') {
                // 链接按钮单独处理
                btn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = await customPrompt('输入链接地址:', 'https://');
                    if (!url) return;
                    
                    const selection = window.getSelection();
                    let selectedText = '';
                    if (selection.rangeCount > 0) {
                        selectedText = selection.toString();
                    }
                    
                    if (selectedText) {
                        await applyFormat('link');
                    } else {
                        await applyFormat('link');
                    }
                });
            } else {
                // 其他格式按钮
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const command = this.getAttribute('data-command');
                    if (command) {
                        applyFormat(command);
                    }
                });
            }
        });
        
        // 顶部图片上传按钮
        if (topImageUploadBtn) {
            topImageUploadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (imageFileInput) {
                    imageFileInput.click();
                }
            });
        }
        
        // 键盘快捷键支持
        document.addEventListener('keydown', function(e) {
            // 检查是否按下了Ctrl键（Windows/Linux）或Cmd键（Mac）
            const isCtrl = e.ctrlKey || e.metaKey;
            
            if (isCtrl) {
                switch(e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        if (topSaveBtn) topSaveBtn.click();
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            // Ctrl+Shift+Z 或 Ctrl+Y = 重做
                            if (redoBtn) redoBtn.click();
                        } else {
                            // Ctrl+Z = 撤销
                            if (undoBtn) undoBtn.click();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        if (redoBtn) redoBtn.click();
                        break;
                    case 'x':
                        e.preventDefault();
                        if (cutBtn) cutBtn.click();
                        break;
                    case 'c':
                        e.preventDefault();
                        if (copyBtn) copyBtn.click();
                        break;
                    case 'v':
                        e.preventDefault();
                        if (pasteBtn) pasteBtn.click();
                        break;
                    case 'f':
                        e.preventDefault();
                        if (findBtn) findBtn.click();
                        break;
                    case 'h':
                        e.preventDefault();
                        if (replaceBtn) replaceBtn.click();
                        break;
                    case 'b':
                        e.preventDefault();
                        const boldBtn = document.querySelector('.format-toolbar-btn[data-command="bold"]');
                        if (boldBtn) boldBtn.click();
                        break;
                    case 'i':
                        e.preventDefault();
                        const italicBtn = document.querySelector('.format-toolbar-btn[data-command="italic"]');
                        if (italicBtn) italicBtn.click();
                        break;
                    case 'u':
                        e.preventDefault();
                        const underlineBtn = document.querySelector('.format-toolbar-btn[data-command="underline"]');
                        if (underlineBtn) underlineBtn.click();
                        break;
                }
            }
        });

        //添加select分类
        function RemoveOtherSelect() {
            let mulus = document.querySelectorAll(".mulu");

            for (let i = 0; i < mulus.length; i++) {
                mulus[i].classList.remove("select");

            }
        }

        //重复目录名提示
        function DuplicateMuluHints() {
            let allparentmulu = [];
            let allparentmuluID = [];
            let duplicateMulu = [];
            let duplicateMuluID = [];
            let childs = firststep.children;

            for (let i = 0; i < childs.length; i++) {
                allparentmulu.push(document.getElementById(childs[i].id).innerHTML);
                allparentmuluID.push(childs[i].id);
            }
            const elementCount = {};

            // 遍历数组并计数
            for (let i = 0; i < allparentmulu.length; i++) {
                const element = allparentmulu[i];
                if (elementCount[element]) {
                    duplicateMuluID.push(allparentmuluID[i]);
                    elementCount[element]++;
                } else {
                    elementCount[element] = 1;
                }
            }
            // 找出重复的元素
            for (let key in elementCount) {
                if (elementCount[key] > 1) {
                    duplicateMulu.push(key); // 转换为整数，如果元素是字符串的话
                }
            }
            // 显示结果
            if (duplicateMulu.length != 0) {
                for (let i = 0; i < duplicateMulu.length; i++) {
                    console.warn(`重复目录名：${duplicateMulu[i]}    重复数量：${elementCount[duplicateMulu[i]] - 1}   其ID为：${duplicateMuluID[i]}    所在位置（悬浮显示）：`);
                    console.warn(document.getElementById(duplicateMuluID[i]));
                }
                customAlert(`重复目录名（按F12 > 控制台了解详情）: ${duplicateMulu.join(` , `)}`);
                return true;
            } else {
                console.log("无重复目录");
                return false;
            }

        }

        //修改目录名 - 基于data属性
        function ChangeChildName(idname = "", newName = "") {
            // 检查新名称是否与当前目录名相同
            let currentMulu = document.getElementById(idname);
            if (!currentMulu) return false;
            
            if (currentMulu.innerHTML === newName) {
                return false; // 如果新名称与当前名称相同，返回false
            }
            
            // 检查新名称是否与其他目录重复
            if (isDuplicateName(newName)) {
                customAlert("目录名已存在，请使用其他名称");
                return false; // 如果重名，返回false
            }
            
            let currentDirId = currentMulu.getAttribute("data-dir-id");
            let currentParentId = currentMulu.getAttribute("data-parent-id");
            let oldName = currentMulu.innerHTML;
            let newClassId = `mulu${newName}`;
            
            // 更新mulufile中的数据
            for (let i = 0; i < mulufile.length; i++) {
                let item = mulufile[i];
                if (item.length === 4) {
                    // 更新当前目录的数据
                    if (item[2] === currentDirId && item[1] === oldName) {
                        mulufile[i][1] = newName;
                        mulufile[i][2] = newClassId;
                    }
                    
                    // 更新子目录的父目录ID（在mulufile中，子目录的item[0]是父目录ID）
                    if (item[0] === currentDirId) {
                        // 子目录的父目录ID需要更新为新的类ID
                        mulufile[i][0] = newClassId;
                    }
                }
            }
            
            // 更新DOM元素的data-dir-id和类名
            currentMulu.setAttribute("data-dir-id", newClassId);
            
            // 更新所有子目录的data-parent-id
            let children = findChildElementsByParentId(currentDirId);
            for (let i = 0; i < children.length; i++) {
                children[i].setAttribute("data-parent-id", newClassId);
            }
            
            // 不再需要更新类名，只保留基础类名 "mulu" 和功能性类名
            // 类名只用于样式，目录关系完全由data属性管理
            
            return true; // 改名成功返回true
        }

        //从文件录入
        if (1) {

            //解决一旦拖拽外部文件就覆盖掉当前页面的问题
            //  解决：给document绑定drop事件
            //  drop事件默认触发不了，需要在dragover事件里面阻止默认事件
            document.ondrop = function () {
                return false;
            }
            // 这个阻止默认事件是为了让drop事件得以触发
            document.ondragover = function () {
                return false;
            }

            box.ondragenter = function () {
                box.style.boxShadow = '0 0 10px 5px rgba(255,0,0,.8)';
            }

            box.ondrop = function (e) {
                e.preventDefault();
                // 得到拖拽过来的文件
                let dataFile = e.dataTransfer.files[0];
                
                if (!dataFile) {
                    customAlert("未检测到文件");
                    return;
                }
                
                // 保存文件名用于后续解析
                let fileName = dataFile.name;

                // FileReader实例化
                let fr = new FileReader();
                // 异步读取文件
                fr.readAsText(dataFile);
                // 读取完毕之后执行
                fr.onload = function () {
                    // 获取得到的结果
                    let data = fr.result;

                    const ta = document.createElement('textarea');
                    ta.value = data;
                    ta.setAttribute("class", 'entity');
                    ta.setAttribute("data-filename", fileName); // 保存文件名

                    box.innerHTML = '';
                    box.appendChild(ta);
                }
                fr.onerror = function() {
                    customAlert("文件读取失败");
                }
            }
            // 解析不同格式的文件内容
            function parseFileContent(content, filename) {
                let ext = filename ? filename.toLowerCase().split('.').pop() : '';
                
                // 尝试解析XML格式
                if (ext === 'xml' || content.trim().startsWith('<?xml')) {
                    try {
                        let parser = new DOMParser();
                        let xmlDoc = parser.parseFromString(content, "text/xml");
                        let directories = xmlDoc.getElementsByTagName("directory");
                        let result = [];
                        for (let i = 0; i < directories.length; i++) {
                            let dir = directories[i];
                            let parent = dir.getAttribute("parent") || "mulu";
                            let name = dir.getAttribute("name") || "";
                            let id = dir.getAttribute("id") || "";
                            let contentNode = dir.getElementsByTagName("content")[0];
                            let contentText = contentNode ? contentNode.textContent : "";
                            result.push([parent, name, id, contentText]);
                        }
                        return result;
                    } catch (e) {
                        console.warn("XML解析失败，尝试其他格式", e);
                    }
                }
                
                // 尝试解析CSV格式
                if (ext === 'csv' || (content.includes(',') && content.includes('\n') && content.split('\n').length > 1)) {
                    try {
                        let lines = content.split('\n');
                        let result = [];
                        // 跳过标题行
                        for (let i = 1; i < lines.length; i++) {
                            if (lines[i].trim()) {
                                // 简单的CSV解析（处理引号）
                                let match = lines[i].match(/^"([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)"$/);
                                if (match) {
                                    result.push([
                                        match[1].replace(/""/g, '"'),
                                        match[2].replace(/""/g, '"'),
                                        match[3].replace(/""/g, '"'),
                                        match[4].replace(/""/g, '"')
                                    ]);
                                }
                            }
                        }
                        if (result.length > 0) {
                            return result;
                        }
                    } catch (e) {
                        console.warn("CSV解析失败，尝试其他格式", e);
                    }
                }
                
                // 尝试解析JSON格式
                if (ext === 'json' || content.trim().startsWith('[') || content.trim().startsWith('{')) {
                    try {
                        let parsed = JSON.parse(content);
                        if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
                            return parsed;
                        }
                    } catch (e) {
                        console.warn("JSON解析失败，尝试其他格式", e);
                    }
                }
                
                // 尝试使用stringToArr解析（旧格式）
                try {
                    return stringToArr(content);
                } catch (e) {
                    throw new Error("无法解析文件格式，请确保文件格式正确");
                }
            }
            
            loadssss.addEventListener("click", function () {
                let entityElement = document.querySelector(".box > .entity");
                if (!entityElement) {
                    customAlert("请先拖拽文件到拖拽区域");
                    return;
                }
                
                let fileContent = entityElement.value.trim();
                if (!fileContent) {
                    customAlert("文件内容为空");
                    return;
                }
                
                try {
                    // 从data属性获取文件名
                    let filename = entityElement.getAttribute("data-filename") || "";
                    
                    // 解析文件内容
                    mulufile = parseFileContent(fileContent, filename);
                    
                    // 验证数据格式
                    if (!Array.isArray(mulufile) || mulufile.length === 0) {
                        customAlert("文件格式错误：无法解析为有效的目录数据");
                        return;
                    }
                    
                    // 验证第一个目录
                    if (mulufile[0].length < 4 || mulufile[0][0] !== "mulu") {
                        customAlert("文件格式错误：第一个目录必须以'mulu'开头，且每个目录数据必须包含4个元素");
                        return;
                    }
                    
                    LoadMulu();
                    // 延迟执行，确保所有目录都已创建并设置好data属性
                    setTimeout(() => {
                        // 初始化所有有子目录的目录，展开它们
                        let allMulus = document.querySelectorAll(".mulu.has-children");
                        for (let i = 0; i < allMulus.length; i++) {
                            let mulu = allMulus[i];
                            let dirId = mulu.getAttribute("data-dir-id");
                            if (dirId && mulu.classList.contains("expanded")) {
                                toggleChildDirectories(dirId, true);
                            }
                        }
                        NoneChildMulu();
                        
                        // 默认选中第一个根目录
                        let firstRootMulu = null;
                        let allMulusForSelect = document.querySelectorAll(".mulu");
                        for (let i = 0; i < allMulusForSelect.length; i++) {
                            let mulu = allMulusForSelect[i];
                            let parentId = mulu.getAttribute("data-parent-id");
                            if (!parentId || parentId === "mulu") {
                                firstRootMulu = mulu;
                                break;
                            }
                        }
                        if (firstRootMulu) {
                            currentMuluName = firstRootMulu.id;
                            RemoveOtherSelect();
                            firstRootMulu.classList.add("select");
                            // 显示第一个目录的内容
                            jiedianwords.value = findMulufileData(firstRootMulu);
                    isUpdating = true;
                    updateMarkdownPreview();
                    isUpdating = false;
                        }
                        
                        AddListStyleForFolder();
                    }, 10);
                    box.style.display = "none";
                    wordsbox.style.display = "block";
                    anjiansss.style.display = "none";
                    bigbox.style.display = "block";
                } catch (error) {
                    console.error("文件加载错误:", error);
                    customAlert("文件加载失败：" + error.message);
                }
            })
        }

        // 根据文件扩展名获取MIME类型
        function getMimeType(filename) {
            let ext = filename.toLowerCase().split('.').pop();
            const mimeTypes = {
                'json': 'application/json',
                'txt': 'text/plain',
                'js': 'application/javascript',
                'xml': 'application/xml',
                'csv': 'text/csv',
                'html': 'text/html',
                'md': 'text/markdown',
                'yaml': 'text/yaml',
                'yml': 'text/yaml'
            };
            return mimeTypes[ext] || 'text/plain';
        }
        
        // 根据文件扩展名格式化数据
        function formatDataByExtension(data, filename) {
            let ext = filename.toLowerCase().split('.').pop();
            
            switch(ext) {
                case 'json':
                    return JSON.stringify(data, null, 2);
                case 'txt':
                    // 文本格式：转换为可读的字符串格式
                    return JSON.stringify(data);
                case 'xml':
                    // XML格式
                    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<directories>\n';
                    for (let i = 0; i < data.length; i++) {
                        if (data[i].length === 4) {
                            xml += `  <directory parent="${data[i][0]}" name="${data[i][1]}" id="${data[i][2]}">\n`;
                            xml += `    <content><![CDATA[${data[i][3]}]]></content>\n`;
                            xml += `  </directory>\n`;
                        }
                    }
                    xml += '</directories>';
                    return xml;
                case 'csv':
                    // CSV格式
                    let csv = '父目录ID,目录名,目录ID,内容\n';
                    for (let i = 0; i < data.length; i++) {
                        if (data[i].length === 4) {
                            csv += `"${data[i][0]}","${data[i][1]}","${data[i][2]}","${data[i][3].replace(/"/g, '""')}"\n`;
                        }
                    }
                    return csv;
                default:
                    // 默认使用JSON格式
                    return JSON.stringify(data, null, 2);
            }
        }
        
        // 保存功能函数
        async function handleSave() {
            // 创建格式选择对话框
            let formatChoice = await customPrompt("选择保存格式：\n1. JSON (.json)\n2. 文本 (.txt)\n3. XML (.xml)\n4. CSV (.csv)\n5. 自定义文件名\n\n请输入数字(1-5)或直接输入文件名（包含扩展名）", "");
            
            if (!formatChoice) {
                customAlert("已取消保存");
                return;
            }
            
            let filename, filenames, format, mimeType;
            let baseName = "soralist";
            
            // 判断用户输入
            if (formatChoice.match(/^\d+$/)) {
                // 数字选择
                let choice = parseInt(formatChoice);
                switch(choice) {
                    case 1:
                        filename = `${baseName}ForLoad.json`;
                        filenames = `${baseName}ForShow.json`;
                        format = 'json';
                        break;
                    case 2:
                        filename = `${baseName}ForLoad.txt`;
                        filenames = `${baseName}ForShow.txt`;
                        format = 'txt';
                        break;
                    case 3:
                        filename = `${baseName}ForLoad.xml`;
                        filenames = `${baseName}ForShow.xml`;
                        format = 'xml';
                        break;
                    case 4:
                        filename = `${baseName}ForLoad.csv`;
                        filenames = `${baseName}ForShow.csv`;
                        format = 'csv';
                        break;
                    case 5:
                        // 自定义文件名
                        let customName = await customPrompt("输入文件名（包含扩展名，如：mydata.json）", "");
                        if (!customName) {
                            customAlert("已取消保存");
                            return;
                        }
                        filename = customName;
                        let nameWithoutExt = customName.substring(0, customName.lastIndexOf('.'));
                        let ext = customName.substring(customName.lastIndexOf('.'));
                        filenames = `${nameWithoutExt}ForShow${ext}`;
                        format = ext.substring(1).toLowerCase();
                        break;
                    default:
                        customAlert("无效的选择");
                        return;
                }
            } else {
                // 直接输入文件名
                filename = formatChoice;
                let nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
                let ext = filename.substring(filename.lastIndexOf('.'));
                if (!nameWithoutExt || !ext) {
                    customAlert("文件名格式错误，请包含扩展名（如：data.json）");
                    return;
                }
                filenames = `${nameWithoutExt}ForShow${ext}`;
                format = ext.substring(1).toLowerCase();
            }
            
            // 获取MIME类型
            mimeType = getMimeType(filename);
            
            // 根据格式准备数据
            let stringData, showData;
            if (format === 'json') {
                // JSON格式：压缩版和格式化版
                stringData = JSON.stringify(mulufile);
                showData = JSON.stringify(mulufile, null, 2);
            } else {
                // 其他格式：都使用格式化版本
                stringData = formatDataByExtension(mulufile, filename);
                showData = formatDataByExtension(mulufile, filenames);
            }
            
            // 创建Blob对象，使用正确的MIME类型
            const blob = new Blob([stringData], {
                type: `${mimeType};charset=utf-8`
            });
            const blobs = new Blob([showData], {
                type: `${mimeType};charset=utf-8`
            });
            
            // 创建下载链接
            const objectURL = URL.createObjectURL(blob);
            const objectURLs = URL.createObjectURL(blobs);

            // 创建下载链接元素
            const aTag = document.createElement('a');
            const aTags = document.createElement('a');
            
            // 设置下载属性
            aTag.href = objectURL;
            aTags.href = objectURLs;
            aTag.download = filename;
            aTags.download = filenames;
            
            // 触发下载
            aTag.click();
            aTags.click();
            
            // 清理URL对象
            URL.revokeObjectURL(objectURL);
            URL.revokeObjectURL(objectURLs);
            
            customAlert(`文件保存成功！\n已保存：${filename} 和 ${filenames}`);
        }
        
        // 另存为功能
        async function handleSaveAs(customName) {
            if (!customName) {
                customAlert("已取消保存");
                return;
            }
            
            let filename = customName;
            let nameWithoutExt = customName.substring(0, customName.lastIndexOf('.'));
            let ext = customName.substring(customName.lastIndexOf('.'));
            
            if (!nameWithoutExt || !ext) {
                customAlert("文件名格式错误，请包含扩展名（如：data.json）");
                return;
            }
            
            let filenames = `${nameWithoutExt}ForShow${ext}`;
            let format = ext.substring(1).toLowerCase();
            let mimeType = getMimeType(filename);
            
            // 根据格式准备数据
            let stringData, showData;
            if (format === 'json') {
                stringData = JSON.stringify(mulufile);
                showData = JSON.stringify(mulufile, null, 2);
            } else {
                stringData = formatDataByExtension(mulufile, filename);
                showData = formatDataByExtension(mulufile, filenames);
            }
            
            // 创建Blob对象
            const blob = new Blob([stringData], {
                type: `${mimeType};charset=utf-8`
            });
            const blobs = new Blob([showData], {
                type: `${mimeType};charset=utf-8`
            });
            
            // 创建下载链接
            const objectURL = URL.createObjectURL(blob);
            const objectURLs = URL.createObjectURL(blobs);
            
            // 创建下载链接元素
            const aTag = document.createElement('a');
            const aTags = document.createElement('a');
            
            // 设置下载属性
            aTag.href = objectURL;
            aTags.href = objectURLs;
            aTag.download = filename;
            aTags.download = filenames;
            
            // 触发下载
            aTag.click();
            aTags.click();
            
            // 清理URL对象
            URL.revokeObjectURL(objectURL);
            URL.revokeObjectURL(objectURLs);
            
            customAlert(`文件另存为成功！\n已保存：${filename} 和 ${filenames}`);
        }