// ============================================
// fileOperations 模块 (fileOperations.js)
// ============================================

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
    
    let filename, format, mimeType;
    let baseName = "soralist";
    
    // 判断用户输入
    if (formatChoice.match(/^\d+$/)) {
        // 数字选择
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
                // 自定义文件名
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
        // 直接输入文件名
        filename = formatChoice;
        let nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        let ext = filename.substring(filename.lastIndexOf('.'));
        if (!nameWithoutExt || !ext) {
            customAlert("文件名格式错误，请包含扩展名（如：data.json）");
            return;
        }
        format = ext.substring(1).toLowerCase();
    }
    
    // 获取MIME类型
    mimeType = getMimeType(filename);
    
    // 根据格式准备数据
    let stringData;
    if (format === 'json') {
        // JSON格式：使用格式化版本
        stringData = JSON.stringify(mulufile, null, 2);
    } else {
        // 其他格式：使用格式化版本
        stringData = formatDataByExtension(mulufile, filename);
    }
    
    // 创建Blob对象，使用正确的MIME类型
    const blob = new Blob([stringData], {
        type: `${mimeType};charset=utf-8`
    });
    
    // 创建下载链接
    const objectURL = URL.createObjectURL(blob);

    // 创建下载链接元素
    const aTag = document.createElement('a');
    
    // 设置下载属性
    aTag.href = objectURL;
    aTag.download = filename;
    
    // 触发下载
    aTag.click();
    
    // 清理URL对象
    URL.revokeObjectURL(objectURL);
    
    customAlert(`文件保存成功！\n已保存：${filename}`);
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
    
    let format = ext.substring(1).toLowerCase();
    let mimeType = getMimeType(filename);
    
    // 根据格式准备数据
    let stringData;
    if (format === 'json') {
        stringData = JSON.stringify(mulufile, null, 2);
    } else {
        stringData = formatDataByExtension(mulufile, filename);
    }
    
    // 创建Blob对象
    const blob = new Blob([stringData], {
        type: `${mimeType};charset=utf-8`
    });
    
    // 创建下载链接
    const objectURL = URL.createObjectURL(blob);
    
    // 创建下载链接元素
    const aTag = document.createElement('a');
    
    // 设置下载属性
    aTag.href = objectURL;
    aTag.download = filename;
    
    // 触发下载
    aTag.click();
    
    // 清理URL对象
    URL.revokeObjectURL(objectURL);
    
    customAlert(`文件另存为成功！\n已保存：${filename}`);
}
