// ============================================
// 文件操作模块 (fileOperations.js)
// 功能：文件保存、加载、格式转换
// 依赖：globals.js, SoraDirectoryJS.js
// ============================================

/**
 * 解析不同格式的文件内容
 * 支持 JSON、XML、CSV 和旧版字符串格式
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名（用于判断格式）
 * @returns {Array} - 解析后的目录数据数组
 * @throws {Error} - 解析失败时抛出错误
 */
function parseFileContent(content, filename) {
    let ext = filename ? filename.toLowerCase().split('.').pop() : '';
    
    // 尝试解析 XML 格式
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
            console.warn("XML 解析失败，尝试其他格式", e);
        }
    }
    
    // 尝试解析 CSV 格式
    if (ext === 'csv' || (content.includes(',') && content.includes('\n') && content.split('\n').length > 1)) {
        try {
            let lines = content.split('\n');
            let result = [];
            
            // 跳过标题行
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
                    // CSV 解析（处理引号转义）
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
            console.warn("CSV 解析失败，尝试其他格式", e);
        }
    }
    
    // 尝试解析 JSON 格式
    if (ext === 'json' || content.trim().startsWith('[') || content.trim().startsWith('{')) {
        try {
            let parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
                return parsed;
            }
        } catch (e) {
            console.warn("JSON 解析失败，尝试其他格式", e);
        }
    }
    
    // 尝试使用旧版字符串解析
    try {
        return stringToArr(content);
    } catch (e) {
        throw new Error("无法解析文件格式，请确保文件格式正确");
    }
}

/**
 * 根据文件扩展名获取 MIME 类型
 * @param {string} filename - 文件名
 * @returns {string} - MIME 类型
 */
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

/**
 * 根据文件扩展名格式化数据
 * @param {Array} data - 目录数据数组
 * @param {string} filename - 目标文件名
 * @returns {string} - 格式化后的字符串
 */
function formatDataByExtension(data, filename) {
    let ext = filename.toLowerCase().split('.').pop();
    
    switch(ext) {
        case 'json':
            return JSON.stringify(data, null, 2);
            
        case 'txt':
            return JSON.stringify(data);
            
        case 'xml':
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
            let csv = '父目录ID,目录名,目录ID,内容\n';
            for (let i = 0; i < data.length; i++) {
                if (data[i].length === 4) {
                    csv += `"${data[i][0]}","${data[i][1]}","${data[i][2]}","${data[i][3].replace(/"/g, '""')}"\n`;
                }
            }
            return csv;
            
        default:
            return JSON.stringify(data, null, 2);
    }
}

/**
 * 保存文件（提供格式选择）
 */
async function handleSave() {
    // 格式选项列表
    const formatOptions = [
        { value: 'json', label: 'JSON 格式 (.json) - 推荐' },
        { value: 'txt', label: '文本格式 (.txt)' },
        { value: 'xml', label: 'XML 格式 (.xml)' },
        { value: 'csv', label: 'CSV 格式 (.csv)' }
    ];
    
    // 显示格式选择对话框
    const format = await customSelect('选择保存格式：', formatOptions, 'json', '保存文件');
    
    if (format === null) {
        showToast('已取消保存', 'info', 2000);
        return;
    }
    
    // 从输入框获取文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    // 移除可能的扩展名
    baseName = baseName.replace(/\.(json|txt|xml|csv)$/i, '');
    let filename = `${baseName}.${format}`;
    
    // 准备数据
    let mimeType = getMimeType(filename);
    let stringData = (format === 'json')
        ? JSON.stringify(mulufile, null, 2)
        : formatDataByExtension(mulufile, filename);
    
    // 创建并下载文件
    const blob = new Blob([stringData], { type: `${mimeType};charset=utf-8` });
    const objectURL = URL.createObjectURL(blob);
    
    const aTag = document.createElement('a');
    aTag.href = objectURL;
    aTag.download = filename;
    aTag.click();
    
    URL.revokeObjectURL(objectURL);
    showToast(`已保存：${filename}`, 'success', 2500);
}

/**
 * 另存为功能
 * @param {string} customName - 自定义文件名
 */
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
    
    let format = ext.substring(1).toLowerCase();
    let mimeType = getMimeType(filename);
    
    // 准备数据
    let stringData = (format === 'json')
        ? JSON.stringify(mulufile, null, 2)
        : formatDataByExtension(mulufile, filename);
    
    // 创建并下载文件
    const blob = new Blob([stringData], { type: `${mimeType};charset=utf-8` });
    const objectURL = URL.createObjectURL(blob);
    
    const aTag = document.createElement('a');
    aTag.href = objectURL;
    aTag.download = filename;
    aTag.click();
    
    URL.revokeObjectURL(objectURL);
    customAlert(`文件另存为成功！\n已保存：${filename}`);
}

/**
 * 另存为网页功能
 * 生成一个独立可浏览的HTML网页
 */
async function handleSaveAsWebpage() {
    // 从输入框获取文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    // 移除可能的扩展名
    baseName = baseName.replace(/\.(json|txt|xml|csv|html)$/i, '');
    let filename = `${baseName}.html`;
    
    // 构建目录树结构
    function buildDirectoryTree(muluData) {
        const tree = [];
        const idMap = {};
        
        // 创建ID到索引的映射
        muluData.forEach((item, index) => {
            if (item.length === 4) {
                idMap[item[2]] = {
                    parentId: item[0],
                    name: item[1],
                    id: item[2],
                    content: item[3],
                    children: []
                };
            }
        });
        
        // 构建树形结构
        Object.values(idMap).forEach(item => {
            if (item.parentId === 'mulu') {
                tree.push(item);
            } else if (idMap[item.parentId]) {
                idMap[item.parentId].children.push(item);
            }
        });
        
        return tree;
    }
    
    // 根据字符串生成哈希值
    function stringToHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    
    // 根据根目录ID生成颜色
    const rootColorCache = {};
    function getRootColor(rootId) {
        if (!rootId) return '#f9f9f9';
        if (rootColorCache[rootId]) return rootColorCache[rootId];
        
        const hash = stringToHash(rootId);
        const hue = hash % 360;
        const saturation = 40 + (hash % 20);
        const lightness = 88 + (hash % 5);
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        rootColorCache[rootId] = color;
        return color;
    }
    
    // 递归生成目录HTML，rootId 用于设置底色
    function generateDirectoryHTML(items, level = 0, rootId = null) {
        let html = '';
        items.forEach((item, index) => {
            const hasChildren = item.children && item.children.length > 0;
            const indent = 20 + (level * 20);
            // 有子目录时添加可点击的三角形图标，点击三角形才切换折叠/展开
            const toggleIcon = hasChildren 
                ? `<span class="toggle-icon" onclick="toggleDirectory('${item.id}', event)"></span>` 
                : `<span class="bullet-icon"></span>`;
            
            // 计算当前目录的根目录ID和底色
            const currentRootId = level === 0 ? item.id : rootId;
            const bgColor = level === 0 ? '#f9f9f9' : getRootColor(currentRootId);
            
            html += `<div class="mulu${hasChildren ? ' has-children expanded' : ''}" 
                         data-dir-id="${item.id}" 
                         data-level="${level}"
                         style="padding-left: ${indent}px; background-color: ${bgColor};"
                         onclick="selectDirectory('${item.id}', false)">
                        ${toggleIcon}<span class="mulu-text">${escapeHtml(item.name)}</span>
                    </div>`;
            if (hasChildren) {
                html += generateDirectoryHTML(item.children, level + 1, currentRootId);
            }
        });
        return html;
    }
    
    // 转义HTML特殊字符
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 生成内容映射
    function generateContentMap(muluData) {
        const contentMap = {};
        muluData.forEach(item => {
            if (item.length === 4) {
                contentMap[item[2]] = item[3];
            }
        });
        return contentMap;
    }
    
    const directoryTree = buildDirectoryTree(mulufile);
    const directoryHTML = generateDirectoryHTML(directoryTree);
    const contentMap = generateContentMap(mulufile);
    
    // 获取第一个目录的ID作为默认选中
    const firstDirId = mulufile.length > 0 && mulufile[0].length === 4 ? mulufile[0][2] : '';
    
    // 生成完整的HTML页面
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(baseName)} - SoraList</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            height: 100vh;
            overflow: hidden;
        }
        
        .sidebar {
            width: 280px;
            min-width: 200px;
            max-width: 400px;
            background-color: #f5f5f5;
            border-right: 1px solid #ddd;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .sidebar-header {
            padding: 15px;
            background-color: #fff;
            border-bottom: 1px solid #ddd;
            font-weight: bold;
            color: #333;
        }
        
        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            overflow-x: auto;
        }
        
        .sidebar-content-inner {
            min-width: max-content;
        }
        
        .mulu {
            min-height: 36px;
            line-height: 36px;
            border-bottom: 1px solid #eee;
            text-align: left;
            white-space: nowrap;
            position: relative;
            cursor: pointer;
            background-color: #f9f9f9;
            transition: background-color 0.2s;
            padding-right: 10px;
        }
        
        .mulu:hover {
            filter: brightness(0.95);
        }
        
        .mulu.selected {
            font-weight: bold;
        }
        
        .bullet-icon {
            position: absolute;
            left: 8px;
            top: 50%;
            transform: translateY(-50%);
            color: #999;
            font-size: 12px;
        }
        
        .bullet-icon::before {
            content: '•';
        }
        
        .toggle-icon {
            position: absolute;
            left: 3px;
            top: 50%;
            transform: translateY(-50%);
            width: 16px;
            height: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 3px;
        }
        
        .toggle-icon:hover {
            background-color: rgba(0, 0, 0, 0.1);
        }
        
        .toggle-icon::before {
            content: '';
            width: 0;
            height: 0;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            border-left: 5px solid #666;
            border-right: 0;
        }
        
        .mulu.has-children.expanded .toggle-icon::before {
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 5px solid #666;
            border-bottom: 0;
        }
        
        
        .mulu-text {
            margin-left: 2px;
        }
        
        .mulu.collapsed-child {
            display: none;
        }
        
        .content-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .content-header {
            padding: 15px 20px;
            background-color: #fff;
            border-bottom: 1px solid #ddd;
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }
        
        .content-body {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background-color: #fff;
            line-height: 1.6;
        }
        
        .content-body h1, .content-body h2, .content-body h3,
        .content-body h4, .content-body h5, .content-body h6 {
            margin-top: 1em;
            margin-bottom: 0.5em;
            font-weight: bold;
        }
        
        .content-body h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
        .content-body h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        .content-body h3 { font-size: 1.25em; }
        .content-body h4 { font-size: 1.1em; }
        .content-body h5 { font-size: 1em; }
        .content-body h6 { font-size: 0.9em; color: #777; }
        
        .content-body p { margin: 1em 0; }
        .content-body ul, .content-body ol { margin: 1em 0; padding-left: 2em; }
        .content-body li { margin: 0.5em 0; }
        
        .content-body blockquote {
            border-left: 4px solid #ddd;
            padding: 0.5em 1em;
            margin: 1em 0;
            background-color: #f5f5f5;
            color: #666;
        }
        
        .content-body code {
            background-color: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            color: #e83e8c;
        }
        
        .content-body pre {
            background-color: #f6f8fa;
            padding: 1em;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
            border: 1px solid #d0d7de;
        }
        
        .content-body pre code {
            background-color: transparent;
            padding: 0;
            color: #24292f;
            display: block;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .content-body img {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
            display: block;
            margin: 1em auto;
        }
        
        .content-body table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }
        
        .content-body table th,
        .content-body table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        
        .content-body table th {
            background-color: #f4f4f4;
            font-weight: bold;
        }
        
        .content-body a {
            color: #0066cc;
            text-decoration: none;
        }
        
        .content-body a:hover {
            text-decoration: underline;
        }
        
        .content-body mark {
            background-color: #ffeb3b;
            padding: 2px 4px;
            border-radius: 2px;
        }
        
        .content-body hr {
            margin: 2em 0;
            border: none;
            border-top: 2px solid #ddd;
        }
        
        .content-body figure {
            margin: 1em 0;
            text-align: center;
        }
        
        .content-body figcaption {
            margin-top: 0.5em;
            font-size: 0.9em;
            color: #666;
            font-style: italic;
        }
        
        .content-body spoiler {
            background-color: #333;
            color: transparent;
            padding: 2px 4px;
            border-radius: 3px;
            transition: all 0.3s ease;
            user-select: none;
        }
        
        .content-body spoiler:hover {
            background-color: #f0f0f0;
            color: inherit;
            user-select: text;
        }
        
        .content-body .contains-task-list {
            list-style: none;
            padding-left: 0;
        }
        
        .content-body .task-list-item {
            list-style: none;
            padding-left: 0;
        }
        
        .content-body .task-list-item-checkbox {
            margin-right: 8px;
        }
        
        .empty-state {
            text-align: center;
            color: #999;
            padding: 50px 20px;
        }
        
        @media (max-width: 768px) {
            body {
                flex-direction: column;
            }
            
            .sidebar {
                width: 100%;
                max-width: none;
                height: 40vh;
                border-right: none;
                border-bottom: 1px solid #ddd;
            }
            
            .content-area {
                height: 60vh;
            }
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">${escapeHtml(baseName)}</div>
        <div class="sidebar-content">
            <div class="sidebar-content-inner">
                ${directoryHTML}
            </div>
        </div>
    </div>
    <div class="content-area">
        <div class="content-header" id="contentTitle">选择一个目录查看内容</div>
        <div class="content-body" id="contentBody">
            <div class="empty-state">点击左侧目录查看内容</div>
        </div>
    </div>
    
    <script>
        const contentMap = ${JSON.stringify(contentMap)};
        
        const nameMap = {};
        document.querySelectorAll('.mulu').forEach(el => {
            nameMap[el.dataset.dirId] = el.textContent.trim();
        });
        
        let currentSelected = null;
        
        function selectDirectory(dirId, toggleExpand = false) {
            if (currentSelected) {
                currentSelected.classList.remove('selected');
            }
            
            const element = document.querySelector('[data-dir-id="' + dirId + '"]');
            if (element) {
                element.classList.add('selected');
                currentSelected = element;
                
                if (toggleExpand && element.classList.contains('has-children')) {
                    element.classList.toggle('expanded');
                    updateChildrenVisibility(dirId, element.classList.contains('expanded'));
                }
            }
            
            const content = contentMap[dirId] || '';
            const title = nameMap[dirId] || '未命名';
            
            document.getElementById('contentTitle').textContent = title;
            document.getElementById('contentBody').innerHTML = content || '<div class="empty-state">此目录暂无内容</div>';
        }
        
        function toggleDirectory(dirId, event) {
            if (event) {
                event.stopPropagation();
            }
            const element = document.querySelector('[data-dir-id="' + dirId + '"]');
            if (element && element.classList.contains('has-children')) {
                element.classList.toggle('expanded');
                updateChildrenVisibility(dirId, element.classList.contains('expanded'));
            }
        }
        
        function updateChildrenVisibility(parentId, show) {
            const allMulu = Array.from(document.querySelectorAll('.mulu'));
            const parentEl = document.querySelector('[data-dir-id="' + parentId + '"]');
            if (!parentEl) return;
            
            const parentIndex = allMulu.indexOf(parentEl);
            const parentLevel = parseInt(parentEl.dataset.level) || 0;
            
            for (let i = parentIndex + 1; i < allMulu.length; i++) {
                const child = allMulu[i];
                const childLevel = parseInt(child.dataset.level) || 0;
                
                if (childLevel <= parentLevel) {
                    break;
                }
                
                if (show) {
                    if (childLevel === parentLevel + 1) {
                        child.style.display = '';
                    } else {
                        const directParent = findDirectParent(child, allMulu, i);
                        if (directParent && directParent.classList.contains('expanded')) {
                            child.style.display = '';
                        }
                    }
                } else {
                    child.style.display = 'none';
                }
            }
        }
        
        function findDirectParent(element, allMulu, currentIndex) {
            const currentLevel = parseInt(element.dataset.level) || 0;
            for (let i = currentIndex - 1; i >= 0; i--) {
                const prevLevel = parseInt(allMulu[i].dataset.level) || 0;
                if (prevLevel === currentLevel - 1) {
                    return allMulu[i];
                }
            }
            return null;
        }
        
        ${firstDirId ? `selectDirectory('${firstDirId}', false);` : ''}
    </script>
</body>
</html>`;
    
    // 创建并下载文件
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const objectURL = URL.createObjectURL(blob);
    
    const aTag = document.createElement('a');
    aTag.href = objectURL;
    aTag.download = filename;
    aTag.click();
    
    URL.revokeObjectURL(objectURL);
    showToast(`已导出网页：${filename}`, 'success', 2500);
}