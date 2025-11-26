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
    
    // 准备数据（从 IndexedDB 恢复视频数据）
    let dataToSave = await prepareDataForExport(mulufile);
    
    let mimeType = getMimeType(filename);
    let stringData = (format === 'json')
        ? JSON.stringify(dataToSave, null, 2)
        : formatDataByExtension(dataToSave, filename);
    
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
 * 准备导出数据（从 IndexedDB 恢复视频数据）
 * @param {Array} muluData - 原始目录数据
 * @returns {Promise<Array>} - 包含完整视频数据的目录数据副本
 */
async function prepareDataForExport(muluData) {
    // 创建数据副本
    const exportData = JSON.parse(JSON.stringify(muluData));
    
    // 遍历并恢复视频数据
    for (let i = 0; i < exportData.length; i++) {
        if (exportData[i].length === 4) {
            let content = exportData[i][3];
            // 如果内容包含 IndexedDB 视频引用，恢复视频数据
            if (content && content.includes('data-video-storage-id') && typeof VideoStorage !== 'undefined') {
                exportData[i][3] = await VideoStorage.processHtmlForExport(content);
            }
        }
    }
    
    return exportData;
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
    
    // 准备数据（从 IndexedDB 恢复视频数据）
    let dataToSave = await prepareDataForExport(mulufile);
    
    let stringData = (format === 'json')
        ? JSON.stringify(dataToSave, null, 2)
        : formatDataByExtension(dataToSave, filename);
    
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
    
    // 生成内容映射（异步，支持从 IndexedDB 恢复视频数据）
    async function generateContentMap(muluData) {
        const contentMap = {};
        for (const item of muluData) {
            if (item.length === 4) {
                let content = item[3];
                // 如果内容包含 IndexedDB 视频引用，恢复视频数据
                if (content && content.includes('data-video-storage-id') && typeof VideoStorage !== 'undefined') {
                    content = await VideoStorage.processHtmlForExport(content);
                }
                contentMap[item[2]] = content;
            }
        }
        return contentMap;
    }
    
    const directoryTree = buildDirectoryTree(mulufile);
    const directoryHTML = generateDirectoryHTML(directoryTree);
    const contentMap = await generateContentMap(mulufile);
    
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
            display: block;
            width: 100%;
            box-sizing: border-box;
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
            position: relative;
            background-color: #f6f8fa;
            padding: 1em;
            padding-top: 2.5em;
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
        
        .content-body pre .code-lang-label {
            position: absolute;
            top: 6px;
            right: 8px;
            padding: 3px 10px;
            background-color: #e1e4e8;
            border: none;
            border-radius: 4px;
            font-size: 11px;
            color: #57606a;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.2s;
            z-index: 10;
        }
        
        .content-body pre .code-lang-label:hover {
            background-color: #0066cc;
            color: #fff;
        }
        
        .content-body pre .code-lang-label.copied {
            background-color: #2da44e;
            color: #fff;
        }
        
        .content-body img {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
            display: block;
            margin: 1em auto;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .content-body img:hover {
            transform: scale(1.02);
        }
        
        .content-body video {
            display: block;
            margin: 1em auto;
            max-width: 640px;
            max-height: 360px;
            width: auto;
            height: auto;
            border-radius: 5px;
        }
        
        .content-body .video-container {
            display: block;
            text-align: center;
            margin: 1em 0;
        }
        
        .content-body .video-container video {
            margin: 0 auto;
        }
        
        .content-body .video-container figcaption {
            margin-top: 0.5em;
            font-size: 0.9em;
            color: #666;
            font-style: italic;
            text-align: center;
        }
        
        .image-viewer-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            z-index: 9999;
            cursor: pointer;
            justify-content: center;
            align-items: center;
        }
        
        .image-viewer-overlay.active {
            display: flex;
        }
        
        .image-viewer-overlay img {
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 4px;
            cursor: default;
        }
        
        .image-viewer-close {
            position: absolute;
            top: 20px;
            right: 30px;
            color: #fff;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            z-index: 10000;
            line-height: 1;
        }
        
        .image-viewer-close:hover {
            color: #ccc;
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
            display: flex;
            align-items: flex-start;
            margin: 0.5em 0;
        }
        
        .content-body .task-list-item-checkbox {
            margin-right: 8px;
            margin-top: 4px;
            pointer-events: none;
            width: 16px;
            height: 16px;
            flex-shrink: 0;
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
    
    <div class="image-viewer-overlay" id="imageViewer">
        <span class="image-viewer-close" id="imageViewerClose">&times;</span>
        <img id="imageViewerImg" src="" alt="放大查看">
    </div>
    
    <script>
        const contentMap = ${JSON.stringify(contentMap)};
        
        const nameMap = {};
        document.querySelectorAll('.mulu').forEach(el => {
            nameMap[el.dataset.dirId] = el.textContent.trim();
        });
        
        let currentSelected = null;
        
        function initCodeBlocks() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            
            const codeBlocks = contentBody.querySelectorAll('pre');
            codeBlocks.forEach(pre => {
                if (pre.dataset.initialized) return;
                pre.dataset.initialized = 'true';
                
                const lang = pre.getAttribute('data-lang') || 'code';
                
                const existingLabel = pre.querySelector('.code-lang-label');
                if (existingLabel) {
                    existingLabel.remove();
                }
                
                const langLabel = document.createElement('button');
                langLabel.className = 'code-lang-label';
                langLabel.textContent = lang.toUpperCase();
                langLabel.type = 'button';
                langLabel.dataset.lang = lang.toUpperCase();
                
                pre.addEventListener('mouseenter', () => {
                    if (!langLabel.classList.contains('copied')) {
                        langLabel.textContent = '点击复制';
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
                    const code = codeElement ? codeElement.textContent : pre.textContent;
                    
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
            });
        }
        
        const imageViewer = document.getElementById('imageViewer');
        const imageViewerImg = document.getElementById('imageViewerImg');
        const imageViewerClose = document.getElementById('imageViewerClose');
        
        function initImageViewer() {
            const contentBody = document.getElementById('contentBody');
            if (!contentBody) return;
            
            const images = contentBody.querySelectorAll('img');
            images.forEach(img => {
                if (img.dataset.viewerInit) return;
                img.dataset.viewerInit = 'true';
                
                img.addEventListener('click', () => {
                    imageViewerImg.src = img.src;
                    imageViewer.classList.add('active');
                });
            });
        }
        
        imageViewerClose.addEventListener('click', () => {
            imageViewer.classList.remove('active');
        });
        
        imageViewer.addEventListener('click', (e) => {
            if (e.target === imageViewer) {
                imageViewer.classList.remove('active');
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && imageViewer.classList.contains('active')) {
                imageViewer.classList.remove('active');
            }
        });
        
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
            
            initCodeBlocks();
            initImageViewer();
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

/**
 * 导出为 Word 文档
 * 目录放在最前面，然后是内容
 */
async function handleExportToWord() {
    // 检查 docx 库是否可用
    if (typeof docx === 'undefined') {
        showToast('Word 导出功能加载失败，请检查网络连接', 'error', 3000);
        return;
    }
    
    // 从输入框获取文件名
    let baseName = (fileNameInput && fileNameInput.value.trim()) || "soralist";
    baseName = baseName.replace(/\.(json|txt|xml|csv|html|docx)$/i, '');
    let filename = `${baseName}.docx`;
    
    // 解构 docx 库的组件
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, TableOfContents, 
            Table, TableRow, TableCell, WidthType, BorderStyle, 
            AlignmentType, convertInchesToTwip, PageBreak, ExternalHyperlink,
            ImageRun, HorizontalRule, Bookmark } = docx;
    
    // 构建目录树结构
    function buildDirectoryTree(muluData) {
        const tree = [];
        const idMap = {};
        
        // 创建ID到数据的映射
        muluData.forEach((item, index) => {
            if (item.length === 4) {
                idMap[item[2]] = {
                    parentId: item[0],
                    name: item[1],
                    id: item[2],
                    content: item[3],
                    children: [],
                    order: index
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
    
    // 获取所有目录的扁平列表（按树形顺序）
    function flattenTree(tree, level = 0) {
        const result = [];
        tree.forEach(item => {
            result.push({ ...item, level });
            if (item.children && item.children.length > 0) {
                result.push(...flattenTree(item.children, level + 1));
            }
        });
        return result;
    }
    
    // 将 base64 图片数据转换为 Uint8Array
    function base64ToUint8Array(base64) {
        // 移除 data URL 前缀
        const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    
    // 从 URL 获取图片数据
    async function fetchImageAsUint8Array(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        } catch (error) {
            console.error('获取图片失败:', url, error);
            return null;
        }
    }
    
    // 收集所有图片并预加载
    async function collectAndLoadImages(html) {
        const imageMap = new Map();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const images = tempDiv.querySelectorAll('img');
        const loadPromises = [];
        
        for (const img of images) {
            const src = img.getAttribute('src');
            if (!src || imageMap.has(src)) continue;
            
            if (src.startsWith('data:image/')) {
                // base64 图片
                try {
                    const imageData = base64ToUint8Array(src);
                    imageMap.set(src, { data: imageData, width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
                } catch (e) {
                    console.error('解析 base64 图片失败:', e);
                }
            } else {
                // URL 图片
                loadPromises.push(
                    fetchImageAsUint8Array(src).then(data => {
                        if (data) {
                            imageMap.set(src, { data: data, width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
                        }
                    })
                );
            }
        }
        
        await Promise.all(loadPromises);
        return imageMap;
    }
    
    // 将 HTML 内容转换为 Word 段落
    async function htmlToWordParagraphs(html, imageMap, baseLevel = 0) {
        const paragraphs = [];
        
        if (!html || html.trim() === '') {
            paragraphs.push(new Paragraph({ text: '' }));
            return paragraphs;
        }
        
        // 创建临时 DOM 解析 HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // 解析 CSS 颜色值为十六进制
        function parseColor(color) {
            if (!color) return null;
            // 已经是十六进制
            if (color.startsWith('#')) {
                return color.replace('#', '').toUpperCase();
            }
            // rgb/rgba 格式
            const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
                const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
                const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
                return (r + g + b).toUpperCase();
            }
            // 命名颜色映射
            const colorMap = {
                'red': 'FF0000', 'blue': '0000FF', 'green': '008000', 'yellow': 'FFFF00',
                'orange': 'FFA500', 'purple': '800080', 'pink': 'FFC0CB', 'black': '000000',
                'white': 'FFFFFF', 'gray': '808080', 'grey': '808080', 'cyan': '00FFFF',
                'magenta': 'FF00FF', 'brown': 'A52A2A', 'navy': '000080', 'teal': '008080'
            };
            return colorMap[color.toLowerCase()] || null;
        }
        
        // 递归处理 DOM 节点
        function processNode(node, currentStyles = {}) {
            const textRuns = [];
            
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (text.trim() || text.includes(' ')) {
                    const runOptions = {
                        text: text,
                        bold: currentStyles.bold || false,
                        italics: currentStyles.italic || false,
                        underline: currentStyles.underline ? {} : undefined,
                        strike: currentStyles.strikethrough || false,
                        highlight: currentStyles.highlight ? 'yellow' : undefined,
                        superScript: currentStyles.superscript || false,
                        subScript: currentStyles.subscript || false
                    };
                    // 添加字体颜色
                    if (currentStyles.color) {
                        runOptions.color = currentStyles.color;
                    }
                    // 添加字体大小
                    if (currentStyles.fontSize) {
                        runOptions.size = currentStyles.fontSize;
                    }
                    // 行内代码样式
                    if (currentStyles.code) {
                        runOptions.font = { name: 'Consolas' };
                        runOptions.shading = { fill: 'F0F0F0' };
                    }
                    textRuns.push(new TextRun(runOptions));
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                const newStyles = { ...currentStyles };
                
                // 从 style 属性解析样式
                const style = node.style;
                if (style) {
                    if (style.color) {
                        const parsedColor = parseColor(style.color);
                        if (parsedColor) newStyles.color = parsedColor;
                    }
                    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
                        newStyles.highlight = true;
                    }
                    if (style.fontSize) {
                        // 转换 px 到 half-points (1pt = 2 half-points)
                        const pxMatch = style.fontSize.match(/(\d+)px/);
                        if (pxMatch) {
                            newStyles.fontSize = parseInt(pxMatch[1]) * 1.5; // 近似转换
                        }
                    }
                }
                
                // 更新样式
                switch (tagName) {
                    case 'strong':
                    case 'b':
                        newStyles.bold = true;
                        break;
                    case 'em':
                    case 'i':
                        newStyles.italic = true;
                        break;
                    case 'u':
                        newStyles.underline = true;
                        break;
                    case 's':
                    case 'del':
                    case 'strike':
                        newStyles.strikethrough = true;
                        break;
                    case 'mark':
                        newStyles.highlight = true;
                        break;
                    case 'sup':
                        newStyles.superscript = true;
                        break;
                    case 'sub':
                        newStyles.subscript = true;
                        break;
                    case 'code':
                        // 行内代码（不在 pre 内）
                        newStyles.code = true;
                        break;
                    case 'spoiler':
                        // spoiler 标签显示为灰色背景
                        newStyles.highlight = true;
                        break;
                    case 'a':
                        // 链接样式：蓝色下划线
                        newStyles.color = '0066CC';
                        newStyles.underline = true;
                        break;
                    case 'span':
                        // span 的样式已在上面通过 style 属性处理
                        break;
                    case 'br':
                        // 换行
                        textRuns.push(new TextRun({ break: 1 }));
                        return textRuns;
                }
                
                // 处理子节点
                for (const child of node.childNodes) {
                    textRuns.push(...processNode(child, newStyles));
                }
            }
            
            return textRuns;
        }
        
        // 处理块级元素
        function processBlockElement(element) {
            const tagName = element.tagName ? element.tagName.toLowerCase() : '';
            
            switch (tagName) {
                case 'h1':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }));
                    break;
                case 'h2':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 350, after: 150 }
                    }));
                    break;
                case 'h3':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 300, after: 100 }
                    }));
                    break;
                case 'h4':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_4,
                        spacing: { before: 250, after: 100 }
                    }));
                    break;
                case 'h5':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_5,
                        spacing: { before: 200, after: 100 }
                    }));
                    break;
                case 'h6':
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        heading: HeadingLevel.HEADING_6,
                        spacing: { before: 200, after: 100 }
                    }));
                    break;
                case 'p':
                    // 检查段落中是否包含图片
                    const pImages = element.querySelectorAll('img');
                    if (pImages.length > 0) {
                        // 如果包含图片，需要分开处理文本和图片
                        // 先处理图片之前的文本
                        let currentNode = element.firstChild;
                        let textRuns = [];
                        
                        while (currentNode) {
                            if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.tagName.toLowerCase() === 'img') {
                                // 先添加之前积累的文本
                                if (textRuns.length > 0) {
                                    paragraphs.push(new Paragraph({
                                        children: textRuns,
                                        spacing: { before: 100, after: 100 }
                                    }));
                                    textRuns = [];
                                }
                                
                                // 处理图片
                                const pImgSrc = currentNode.getAttribute('src');
                                if (pImgSrc && imageMap.has(pImgSrc)) {
                                    const pImgInfo = imageMap.get(pImgSrc);
                                    try {
                                        let pImgWidth = pImgInfo.width || 400;
                                        let pImgHeight = pImgInfo.height || 300;
                                        const pMaxWidth = 500;
                                        
                                        if (pImgWidth > pMaxWidth) {
                                            const ratio = pMaxWidth / pImgWidth;
                                            pImgWidth = pMaxWidth;
                                            pImgHeight = Math.round(pImgHeight * ratio);
                                        }
                                        
                                        paragraphs.push(new Paragraph({
                                            children: [new ImageRun({
                                                data: pImgInfo.data,
                                                transformation: {
                                                    width: pImgWidth,
                                                    height: pImgHeight
                                                }
                                            })],
                                            alignment: AlignmentType.CENTER,
                                            spacing: { before: 100, after: 100 }
                                        }));
                                    } catch (pImgError) {
                                        console.error('添加段落内图片到 Word 失败:', pImgError);
                                    }
                                }
                            } else {
                                // 处理文本或其他元素
                                textRuns.push(...processNode(currentNode));
                            }
                            currentNode = currentNode.nextSibling;
                        }
                        
                        // 添加剩余的文本
                        if (textRuns.length > 0) {
                            paragraphs.push(new Paragraph({
                                children: textRuns,
                                spacing: { before: 100, after: 100 }
                            }));
                        }
                    } else {
                        const pChildren = processNode(element);
                        if (pChildren.length > 0) {
                            paragraphs.push(new Paragraph({
                                children: pChildren,
                                spacing: { before: 100, after: 100 }
                            }));
                        }
                    }
                    break;
                case 'ul':
                case 'ol':
                    // 处理列表（支持嵌套和任务列表）
                    function processListItems(listElement, listType, level = 0) {
                        const items = listElement.querySelectorAll(':scope > li');
                        items.forEach((li, index) => {
                            // 检查是否是任务列表项
                            const checkbox = li.querySelector(':scope > input[type="checkbox"]');
                            const isTaskItem = checkbox !== null;
                            const isChecked = checkbox ? checkbox.checked : false;
                            
                            let bullet;
                            if (isTaskItem) {
                                bullet = isChecked ? '☑ ' : '☐ ';
                            } else {
                                bullet = listType === 'ul' ? '• ' : `${index + 1}. `;
                            }
                            
                            // 处理列表项内容（排除嵌套列表）
                            const liContentRuns = [];
                            for (const child of li.childNodes) {
                                if (child.nodeType === Node.ELEMENT_NODE) {
                                    const childTag = child.tagName.toLowerCase();
                                    if (childTag === 'ul' || childTag === 'ol') {
                                        continue; // 嵌套列表单独处理
                                    }
                                    if (childTag === 'input' && child.type === 'checkbox') {
                                        continue; // 跳过 checkbox
                                    }
                                }
                                liContentRuns.push(...processNode(child));
                            }
                            
                            paragraphs.push(new Paragraph({
                                children: [
                                    new TextRun({ text: '  '.repeat(level) + bullet }),
                                    ...liContentRuns
                                ],
                                indent: { left: convertInchesToTwip(0.3 * (level + 1)) },
                                spacing: { before: 50, after: 50 }
                            }));
                            
                            // 处理嵌套列表
                            const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
                            nestedLists.forEach(nestedList => {
                                const nestedType = nestedList.tagName.toLowerCase();
                                processListItems(nestedList, nestedType, level + 1);
                            });
                        });
                    }
                    processListItems(element, tagName, 0);
                    break;
                case 'blockquote':
                    const quoteChildren = processNode(element);
                    paragraphs.push(new Paragraph({
                        children: quoteChildren,
                        indent: { left: convertInchesToTwip(0.5) },
                        spacing: { before: 100, after: 100 },
                        shading: { fill: 'F5F5F5' },
                        border: {
                            left: { style: BorderStyle.SINGLE, size: 24, color: 'CCCCCC' }
                        }
                    }));
                    break;
                case 'pre':
                    const codeElement = element.querySelector('code') || element;
                    const codeText = codeElement.textContent || '';
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({
                            text: codeText,
                            font: { name: 'Consolas' },
                            size: 20
                        })],
                        shading: { fill: 'F6F8FA' },
                        border: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: 'D0D7DE' },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D0D7DE' },
                            left: { style: BorderStyle.SINGLE, size: 1, color: 'D0D7DE' },
                            right: { style: BorderStyle.SINGLE, size: 1, color: 'D0D7DE' }
                        },
                        spacing: { before: 100, after: 100 }
                    }));
                    break;
                case 'hr':
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: '─'.repeat(50) })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200, after: 200 }
                    }));
                    break;
                case 'img':
                    // 处理图片
                    const imgSrc = element.getAttribute('src');
                    if (imgSrc && imageMap.has(imgSrc)) {
                        const imgInfo = imageMap.get(imgSrc);
                        try {
                            // 计算适当的尺寸，最大宽度 500 像素
                            let imgWidth = imgInfo.width || 400;
                            let imgHeight = imgInfo.height || 300;
                            const maxWidth = 500;
                            
                            if (imgWidth > maxWidth) {
                                const ratio = maxWidth / imgWidth;
                                imgWidth = maxWidth;
                                imgHeight = Math.round(imgHeight * ratio);
                            }
                            
                            paragraphs.push(new Paragraph({
                                children: [new ImageRun({
                                    data: imgInfo.data,
                                    transformation: {
                                        width: imgWidth,
                                        height: imgHeight
                                    }
                                })],
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 200, after: 200 }
                            }));
                        } catch (imgError) {
                            console.error('添加图片到 Word 失败:', imgError);
                            paragraphs.push(new Paragraph({
                                children: [new TextRun({ text: '[图片]', italics: true, color: '999999' })],
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 100, after: 100 }
                            }));
                        }
                    } else {
                        // 图片加载失败，显示占位符
                        paragraphs.push(new Paragraph({
                            children: [new TextRun({ text: '[图片]', italics: true, color: '999999' })],
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 100, after: 100 }
                        }));
                    }
                    break;
                case 'figure':
                    // 处理 figure 元素（包含图片和说明）
                    const figImg = element.querySelector('img');
                    const figCaption = element.querySelector('figcaption');
                    
                    if (figImg) {
                        const figImgSrc = figImg.getAttribute('src');
                        if (figImgSrc && imageMap.has(figImgSrc)) {
                            const figImgInfo = imageMap.get(figImgSrc);
                            try {
                                let figImgWidth = figImgInfo.width || 400;
                                let figImgHeight = figImgInfo.height || 300;
                                const figMaxWidth = 500;
                                
                                if (figImgWidth > figMaxWidth) {
                                    const ratio = figMaxWidth / figImgWidth;
                                    figImgWidth = figMaxWidth;
                                    figImgHeight = Math.round(figImgHeight * ratio);
                                }
                                
                                paragraphs.push(new Paragraph({
                                    children: [new ImageRun({
                                        data: figImgInfo.data,
                                        transformation: {
                                            width: figImgWidth,
                                            height: figImgHeight
                                        }
                                    })],
                                    alignment: AlignmentType.CENTER,
                                    spacing: { before: 200, after: 100 }
                                }));
                            } catch (figImgError) {
                                console.error('添加 figure 图片到 Word 失败:', figImgError);
                                paragraphs.push(new Paragraph({
                                    children: [new TextRun({ text: '[图片]', italics: true, color: '999999' })],
                                    alignment: AlignmentType.CENTER,
                                    spacing: { before: 100, after: 100 }
                                }));
                            }
                        }
                    }
                    
                    if (figCaption) {
                        paragraphs.push(new Paragraph({
                            children: processNode(figCaption),
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 50, after: 200 }
                        }));
                    }
                    break;
                case 'table':
                    // 处理表格
                    const rows = element.querySelectorAll('tr');
                    if (rows.length > 0) {
                        const tableRows = [];
                        let maxCols = 0;
                        
                        // 首先确定最大列数
                        rows.forEach(row => {
                            const cells = row.querySelectorAll('th, td');
                            if (cells.length > maxCols) maxCols = cells.length;
                        });
                        
                        rows.forEach((row, rowIndex) => {
                            const cells = row.querySelectorAll('th, td');
                            const tableCells = [];
                            const isHeader = row.parentElement && row.parentElement.tagName.toLowerCase() === 'thead';
                            
                            cells.forEach((cell, cellIndex) => {
                                const isHeaderCell = cell.tagName.toLowerCase() === 'th' || isHeader;
                                const cellContent = processNode(cell);
                                
                                tableCells.push(new TableCell({
                                    children: [new Paragraph({
                                        children: cellContent.length > 0 ? cellContent : [new TextRun({ text: '' })],
                                        alignment: AlignmentType.LEFT
                                    })],
                                    width: { size: Math.floor(100 / maxCols), type: WidthType.PERCENTAGE },
                                    shading: isHeaderCell ? { fill: 'E8E8E8' } : undefined,
                                    margins: {
                                        top: convertInchesToTwip(0.05),
                                        bottom: convertInchesToTwip(0.05),
                                        left: convertInchesToTwip(0.1),
                                        right: convertInchesToTwip(0.1)
                                    }
                                }));
                            });
                            
                            // 填充空单元格
                            while (tableCells.length < maxCols) {
                                tableCells.push(new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
                                    width: { size: Math.floor(100 / maxCols), type: WidthType.PERCENTAGE }
                                }));
                            }
                            
                            if (tableCells.length > 0) {
                                tableRows.push(new TableRow({ children: tableCells }));
                            }
                        });
                        
                        if (tableRows.length > 0) {
                            // 创建表格对象
                            const table = new Table({
                                rows: tableRows,
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                borders: {
                                    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
                                }
                            });
                            // 表格前后添加空段落作为间距
                            paragraphs.push(new Paragraph({ text: '', spacing: { before: 100 } }));
                            paragraphs.push(table);
                            paragraphs.push(new Paragraph({ text: '', spacing: { after: 100 } }));
                        }
                    }
                    break;
                case 'br':
                    // 换行
                    paragraphs.push(new Paragraph({ text: '' }));
                    break;
                case 'div':
                case 'section':
                case 'article':
                case 'main':
                case 'header':
                case 'footer':
                case 'aside':
                case 'nav':
                    // 容器元素，递归处理子元素
                    for (const child of element.childNodes) {
                        if (child.nodeType === Node.TEXT_NODE) {
                            const text = child.textContent.trim();
                            if (text) {
                                paragraphs.push(new Paragraph({
                                    children: [new TextRun({ text })],
                                    spacing: { before: 50, after: 50 }
                                }));
                            }
                        } else if (child.nodeType === Node.ELEMENT_NODE) {
                            processBlockElement(child);
                        }
                    }
                    break;
                case 'span':
                case 'a':
                case 'strong':
                case 'b':
                case 'em':
                case 'i':
                case 'u':
                case 's':
                case 'del':
                case 'code':
                case 'mark':
                case 'sup':
                case 'sub':
                    // 内联元素作为块级处理时，包装成段落
                    const inlineChildren = processNode(element);
                    if (inlineChildren.length > 0) {
                        paragraphs.push(new Paragraph({
                            children: inlineChildren,
                            spacing: { before: 50, after: 50 }
                        }));
                    }
                    break;
                case 'video':
                case 'audio':
                case 'iframe':
                case 'embed':
                case 'object':
                    // 媒体元素，显示占位符
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: '[媒体内容]', italics: true, color: '999999' })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100, after: 100 }
                    }));
                    break;
                case 'details':
                    // 处理 details 元素
                    const summary = element.querySelector('summary');
                    if (summary) {
                        paragraphs.push(new Paragraph({
                            children: [
                                new TextRun({ text: '▶ ', bold: true }),
                                ...processNode(summary)
                            ],
                            spacing: { before: 100, after: 50 }
                        }));
                    }
                    // 处理 details 内的其他内容
                    for (const child of element.childNodes) {
                        if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() !== 'summary') {
                            processBlockElement(child);
                        }
                    }
                    break;
                case 'summary':
                    // summary 已在 details 中处理
                    break;
                case 'dl':
                    // 定义列表
                    const dlItems = element.querySelectorAll(':scope > dt, :scope > dd');
                    dlItems.forEach(item => {
                        const isDt = item.tagName.toLowerCase() === 'dt';
                        paragraphs.push(new Paragraph({
                            children: processNode(item),
                            indent: isDt ? undefined : { left: convertInchesToTwip(0.5) },
                            spacing: { before: isDt ? 100 : 50, after: 50 }
                        }));
                    });
                    break;
                case 'dt':
                case 'dd':
                    // 单独出现时的处理
                    paragraphs.push(new Paragraph({
                        children: processNode(element),
                        indent: tagName === 'dd' ? { left: convertInchesToTwip(0.5) } : undefined,
                        spacing: { before: 50, after: 50 }
                    }));
                    break;
                default:
                    // 处理其他元素或文本节点
                    if (element.childNodes && element.childNodes.length > 0) {
                        for (const child of element.childNodes) {
                            if (child.nodeType === Node.TEXT_NODE) {
                                const text = child.textContent.trim();
                                if (text) {
                                    paragraphs.push(new Paragraph({
                                        children: [new TextRun({ text })],
                                        spacing: { before: 50, after: 50 }
                                    }));
                                }
                            } else if (child.nodeType === Node.ELEMENT_NODE) {
                                processBlockElement(child);
                            }
                        }
                    } else if (element.textContent && element.textContent.trim()) {
                        paragraphs.push(new Paragraph({
                            children: processNode(element),
                            spacing: { before: 50, after: 50 }
                        }));
                    }
            }
        }
        
        // 处理顶层元素
        for (const child of tempDiv.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) {
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text })],
                        spacing: { before: 50, after: 50 }
                    }));
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                processBlockElement(child);
            }
        }
        
        return paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: '' })];
    }
    
    // 构建目录树
    const directoryTree = buildDirectoryTree(mulufile);
    const flatList = flattenTree(directoryTree);
    
    // 预加载所有图片
    showToast('正在处理图片...', 'info', 2000);
    const allHtmlContent = flatList.map(item => item.content || '').join('');
    const imageMap = await collectAndLoadImages(allHtmlContent);
    
    // 创建文档内容
    const children = [];
    
    // 添加文档标题
    children.push(new Paragraph({
        children: [new TextRun({
            text: baseName,
            bold: true,
            size: 56  // 28pt
        })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));
    
    // 添加目录标题
    children.push(new Paragraph({
        children: [new TextRun({
            text: '目 录',
            bold: true,
            size: 36  // 18pt
        })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 300 }
    }));
    
    // 生成目录列表（常见目录样式：序号 + 名称 + 点线 + 页码）
    // 计算各级序号
    const levelCounters = [0, 0, 0, 0, 0, 0]; // 最多6级
    let lastLevel = -1;
    
    flatList.forEach((item, index) => {
        const level = item.level;
        
        // 更新序号
        if (level > lastLevel) {
            // 进入子级，重置当前级别计数
            levelCounters[level] = 1;
        } else if (level === lastLevel) {
            // 同级，递增
            levelCounters[level]++;
        } else {
            // 返回上级，重置下级计数，递增当前级别
            for (let i = level + 1; i < 6; i++) {
                levelCounters[i] = 0;
            }
            levelCounters[level]++;
        }
        lastLevel = level;
        
        // 生成序号字符串（如：1、1.1、1.1.1）
        let numberStr = '';
        for (let i = 0; i <= level; i++) {
            if (i === 0) {
                numberStr = String(levelCounters[i]);
            } else {
                numberStr += '.' + levelCounters[i];
            }
        }
        
        // 根据层级调整样式
        const indent = level * 0.4;  // 每级缩进 0.4 英寸
        const fontSize = level === 0 ? 26 : 24;  // 一级目录稍大
        const isBold = level === 0;  // 一级目录加粗
        
        // 创建目录项：序号 + 名称 + 点线填充 + 页码占位
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: numberStr + '  ',
                    bold: isBold,
                    size: fontSize
                }),
                new TextRun({
                    text: item.name,
                    bold: isBold,
                    size: fontSize
                }),
                new TextRun({
                    text: ' ',
                    size: fontSize
                }),
                // 使用制表符和点线
                new TextRun({
                    text: '·'.repeat(Math.max(3, 40 - item.name.length - numberStr.length - level * 4)),
                    size: fontSize,
                    color: 'AAAAAA'
                }),
                new TextRun({
                    text: ' ' + (index + 1),  // 使用序号作为伪页码
                    bold: isBold,
                    size: fontSize
                })
            ],
            indent: { left: convertInchesToTwip(indent) },
            spacing: { before: level === 0 ? 120 : 60, after: level === 0 ? 80 : 60 },
            tabStops: [{
                type: 'right',
                position: convertInchesToTwip(6),
                leader: 'dot'
            }]
        }));
    });
    
    // 添加分页符
    children.push(new Paragraph({
        children: [new PageBreak()]
    }));
    
    // 添加内容标题
    children.push(new Paragraph({
        children: [new TextRun({
            text: '正 文',
            bold: true,
            size: 36  // 18pt
        })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 }
    }));
    
    // 添加各目录的内容
    for (const item of flatList) {
        // 根据层级确定标题级别
        const headingLevel = Math.min(item.level + 1, 6);
        const headingLevels = [
            HeadingLevel.HEADING_1,
            HeadingLevel.HEADING_2,
            HeadingLevel.HEADING_3,
            HeadingLevel.HEADING_4,
            HeadingLevel.HEADING_5,
            HeadingLevel.HEADING_6
        ];
        
        // 添加章节标题（居中放大显示）
        children.push(new Paragraph({
            children: [new TextRun({
                text: item.name,
                bold: true,
                size: 36 - (item.level * 4)  // 根据层级调整字号，一级36pt，二级32pt...
            })],
            heading: headingLevels[headingLevel - 1] || HeadingLevel.HEADING_6,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 300 }
        }));
        
        // 添加章节内容
        if (item.content && item.content.trim()) {
            const contentParagraphs = await htmlToWordParagraphs(item.content, imageMap);
            children.push(...contentParagraphs);
        } else {
            children.push(new Paragraph({
                children: [new TextRun({
                    text: '（暂无内容）',
                    italics: true,
                    color: '999999'
                })],
                spacing: { before: 100, after: 100 }
            }));
        }
        
        // 在各章节之间添加一些间距
        children.push(new Paragraph({
            text: '',
            spacing: { before: 200, after: 200 }
        }));
    }
    
    // 创建 Word 文档
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1),
                        right: convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left: convertInchesToTwip(1)
                    }
                }
            },
            children: children
        }]
    });
    
    // 生成并下载文件
    try {
        const blob = await Packer.toBlob(doc);
        const objectURL = URL.createObjectURL(blob);
        
        const aTag = document.createElement('a');
        aTag.href = objectURL;
        aTag.download = filename;
        aTag.click();
        
        URL.revokeObjectURL(objectURL);
        showToast(`已导出 Word 文档：${filename}`, 'success', 2500);
    } catch (error) {
        console.error('Word 导出失败:', error);
        showToast('Word 导出失败：' + error.message, 'error', 3000);
    }
}