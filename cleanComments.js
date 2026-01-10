const fs = require('fs');
const path = require('path');

/**
 * 清理JavaScript文件的注释，仅保留函数声明前的注释
 * @param {string} content - 文件内容
 * @returns {string} 清理后的文件内容
 */
function cleanJSComments(content) {
    // 1. 匹配并保留函数声明前的注释
    // 支持的函数声明形式：
    // - function 函数名(...)
    // - const/let/var 函数名 = function(...)
    // - const/let/var 函数名 = (...)
    // - 箭头函数
    
    // 先处理块注释
    let cleanedContent = content;
    
    // 匹配函数声明前的块注释
    const blockCommentBeforeFunctionPattern = /(\/\*[\s\S]*?\*\/)\s*(function\s+\w+\s*\(|const\s+\w+\s*=\s*function\s*\(|let\s+\w+\s*=\s*function\s*\(|var\s+\w+\s*=\s*function\s*\(|const\s+\w+\s*=\s*\(|let\s+\w+\s*=\s*\(|var\s+\w+\s*=\s*\()/g;
    
    // 匹配函数声明前的单行注释
    const lineCommentBeforeFunctionPattern = /((?:\/\/.*?\n\s*)+)(function\s+\w+\s*\(|const\s+\w+\s*=\s*function\s*\(|let\s+\w+\s*=\s*function\s*\(|var\s+\w+\s*=\s*function\s*\(|const\s+\w+\s*=\s*\(|let\s+\w+\s*=\s*\(|var\s+\w+\s*=\s*\()/g;
    
    // 替换标记
    let tempMarkerIndex = 0;
    const preservedComments = [];
    
    // 处理块注释
    cleanedContent = cleanedContent.replace(blockCommentBeforeFunctionPattern, (match, comment, funcDecl) => {
        const marker = `__COMMENT_MARKER_${tempMarkerIndex++}__`;
        preservedComments.push({ marker, content: comment });
        return marker + funcDecl;
    });
    
    // 处理单行注释
    cleanedContent = cleanedContent.replace(lineCommentBeforeFunctionPattern, (match, comment, funcDecl) => {
        const marker = `__COMMENT_MARKER_${tempMarkerIndex++}__`;
        preservedComments.push({ marker, content: comment });
        return marker + funcDecl;
    });
    
    // 2. 移除所有剩余的块注释 /* */
    cleanedContent = cleanedContent.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 3. 移除所有剩余的单行注释 //
    cleanedContent = cleanedContent.replace(/\/\/.*$/gm, '');
    
    // 4. 恢复保留的注释
    for (const { marker, content } of preservedComments) {
        cleanedContent = cleanedContent.replace(marker, content + '\n');
    }
    
    // 5. 清理多余的空行
    cleanedContent = cleanedContent.replace(/\n\s*\n/g, '\n');
    cleanedContent = cleanedContent.replace(/^\s+|\s+$/g, '');
    
    return cleanedContent;
}

/**
 * 清理HTML文件的注释
 * @param {string} content - 文件内容
 * @returns {string} 清理后的文件内容
 */
function cleanHTMLComments(content) {
    // 清理HTML注释，保留条件注释
    return content.replace(/<!--(?!\[)([\s\S]*?)-->/g, '');
}

/**
 * 处理单个文件
 * @param {string} filePath - 文件路径
 */
function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let cleanedContent;
    
    if (filePath.endsWith('.js')) {
        cleanedContent = cleanJSComments(content);
    } else if (filePath.endsWith('.html')) {
        cleanedContent = cleanHTMLComments(content);
    } else {
        console.log(`Skipping non-supported file: ${filePath}`);
        return;
    }
    
    fs.writeFileSync(filePath, cleanedContent, 'utf8');
    console.log(`Cleaned comments in: ${filePath}`);
}

/**
 * 递归处理目录中的所有文件
 * @param {string} dirPath - 目录路径
 */
function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
            processDirectory(filePath);
        } else if (file.endsWith('.js') || file.endsWith('.html')) {
            processFile(filePath);
        }
    }
}

// 主函数
function main() {
    const projectRoot = process.cwd();
    
    // 处理HTML文件
    const htmlFiles = [
        path.join(projectRoot, 'SoraDirectory.html')
    ];
    
    for (const htmlFile of htmlFiles) {
        if (fs.existsSync(htmlFile)) {
            processFile(htmlFile);
        }
    }
    
    // 处理JavaScript文件
    const jsDir = path.join(projectRoot, 'js');
    if (fs.existsSync(jsDir)) {
        processDirectory(jsDir);
    }
    
    console.log('\n注释清理完成！');
}

// 执行主函数
main();