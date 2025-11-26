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
    // 显示格式选择对话框
    let formatChoice = await customPrompt(
        "选择保存格式：\n" +
        "1. JSON (.json)\n" +
        "2. 文本 (.txt)\n" +
        "3. XML (.xml)\n" +
        "4. CSV (.csv)\n" +
        "5. 自定义文件名\n\n" +
        "请输入数字(1-5)或直接输入文件名（包含扩展名）",
        ""
    );
    
    if (!formatChoice) {
        customAlert("已取消保存");
        return;
    }
    
    let filename, format;
    let baseName = "soralist";
    
    // 解析用户选择
    if (formatChoice.match(/^\d+$/)) {
        let choice = parseInt(formatChoice);
        switch(choice) {
            case 1:
                filename = `${baseName}ForLoad.json`;
                format = 'json';
                break;
            case 2:
                filename = `${baseName}ForLoad.txt`;
                format = 'txt';
                break;
            case 3:
                filename = `${baseName}ForLoad.xml`;
                format = 'xml';
                break;
            case 4:
                filename = `${baseName}ForLoad.csv`;
                format = 'csv';
                break;
            case 5:
                let customName = await customPrompt("输入文件名（包含扩展名，如：mydata.json）", "");
                if (!customName) {
                    customAlert("已取消保存");
                    return;
                }
                filename = customName;
                format = customName.substring(customName.lastIndexOf('.') + 1).toLowerCase();
                break;
            default:
                customAlert("无效的选择");
                return;
        }
    } else {
        // 直接使用用户输入的文件名
        filename = formatChoice;
        let nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        let ext = filename.substring(filename.lastIndexOf('.'));
        
        if (!nameWithoutExt || !ext) {
            customAlert("文件名格式错误，请包含扩展名（如：data.json）");
            return;
        }
        format = ext.substring(1).toLowerCase();
    }
    
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
    customAlert(`文件保存成功！\n已保存：${filename}`);
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
