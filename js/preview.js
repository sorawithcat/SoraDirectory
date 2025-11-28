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
    
    // 使用正则表达式直接移除高亮标签，避免通过 innerHTML 解析
    // 这对包含视频等大型 base64 数据的 HTML 更安全
    // 匹配 <span class="search-highlight">...</span> 和 <span class="search-highlight-current">...</span>
    let result = html;
    
    // 移除 search-highlight 和 search-highlight-current 类的 span 标签，保留内容
    result = result.replace(/<span\s+class=["']search-highlight(?:-current)?["'][^>]*>([\s\S]*?)<\/span>/gi, '$1');
    
    return result;
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
        let html = removeSearchHighlights(markdownPreview.innerHTML);
        
        // 确保压缩包元素的 data-media-storage-id 和 data-export-url 属性被正确保存
        // 从DOM中验证并修复压缩包元素的属性
        const archiveElements = markdownPreview.querySelectorAll('.archive-attachment');
        archiveElements.forEach(archiveElement => {
            const storageId = archiveElement.getAttribute('data-media-storage-id');
            const exportUrl = archiveElement.getAttribute('data-export-url');
            const archiveName = archiveElement.getAttribute('data-archive-name');
            if (archiveName) {
                // 检查HTML字符串中是否包含该压缩包的属性
                // 使用archiveName查找对应的压缩包元素
                const archiveNameEscaped = archiveName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // 查找包含archiveName的压缩包元素
                const regex = new RegExp(
                    `(<div[^>]*class=["']archive-attachment["'][^>]*data-archive-name=["']${archiveNameEscaped}["'][^>]*)>`,
                    'gi'
                );
                html = html.replace(regex, (match) => {
                    let updated = match;
                    // 如果这个匹配中不包含data-media-storage-id，添加它
                    if (storageId && !updated.includes('data-media-storage-id')) {
                        updated = updated.replace('>', ` data-media-storage-id="${storageId}">`);
                    }
                    // 如果这个匹配中不包含data-export-url，添加它（如果存在）
                    if (exportUrl && !updated.includes('data-export-url')) {
                        updated = updated.replace('>', ` data-export-url="${exportUrl}">`);
                    }
                    return updated;
                });
            }
        });
        
        // 使用 IndexedDB 方案：对于有 data-media-storage-id 的媒体（视频/图片/压缩文件），
        // 将 Blob URL 替换为占位符（媒体数据已保存在 IndexedDB 中）
        // 但保留 base64 data URL，以确保如果 IndexedDB 中没有数据，视频仍然可以播放
        if (html.includes('data-media-storage-id')) {
            // 处理视频：只替换 Blob URL (blob: 开头)，保留 base64 data URL
            // 这样可以确保如果 IndexedDB 中没有数据，原始的 base64 data URL 会被保留
            html = html.replace(
                /(<video[^>]*data-media-storage-id=["'][^"']+["'][^>]*)\ssrc=["'](blob:[^"']+)["']([^>]*>)/gi,
                '$1 src="about:blank"$3'
            );
            html = html.replace(
                /(<video[^>]*)\ssrc=["'](blob:[^"']+)["']([^>]*data-media-storage-id=["'][^"']+["'][^>]*>)/gi,
                '$1 src="about:blank"$3'
            );
            // 处理图片：只替换 Blob URL，保留 base64 data URL
            html = html.replace(
                /(<img[^>]*data-media-storage-id=["'][^"']+["'][^>]*)\ssrc=["'](blob:[^"']+)["']([^>]*>)/gi,
                '$1 src="about:blank"$3'
            );
            html = html.replace(
                /(<img[^>]*)\ssrc=["'](blob:[^"']+)["']([^>]*data-media-storage-id=["'][^"']+["'][^>]*>)/gi,
                '$1 src="about:blank"$3'
            );
        }
        
        isUpdating = true;
        jiedianwords.value = html;
        isUpdating = false;
        
        // 同步更新 mulufile 数据
        if (currentMuluName) {
            let changedmulu = document.getElementById(currentMuluName);
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

/** 存储视频原始 src 的映射（防止浏览器截断 base64 数据） */
const videoOriginalSrcMap = new Map();

/** 缓存上次的内容，用于比较是否真的需要更新 */
let lastPreviewContent = '';

/**
 * 从 textarea 同步内容到预览区域
 * 性能优化：内容未变化时跳过更新，使用 requestAnimationFrame 优化DOM操作
 */
async function updateMarkdownPreview() {
    if (markdownPreview && jiedianwords) {
        let content = jiedianwords.value || '';
        
        // 性能优化：如果内容没有变化，跳过更新
        if (content === lastPreviewContent && markdownPreview.innerHTML) {
            return;
        }
        
        // 不在这里自动加载媒体数据
        // 视频/图片会保持data-media-storage-id属性，只在用户真正需要时才加载
        // 这样可以避免切换目录时的卡顿和进度提示
        
        // 性能优化：如果处理后的内容仍然相同，跳过更新
        if (content === lastPreviewContent && markdownPreview.innerHTML === content) {
            return;
        }
        
        // 在设置 innerHTML 之前，提取并保存视频的原始 src
        // 这是为了防止浏览器在处理 innerHTML 时截断 base64 数据
        videoOriginalSrcMap.clear();
        const videoSrcRegex = /<video[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
        let match;
        let videoIndex = 0;
        while ((match = videoSrcRegex.exec(content)) !== null) {
            const src = match[1];
            if (src && src.startsWith('data:')) {
                videoOriginalSrcMap.set(videoIndex, src);
            }
            videoIndex++;
        }
        
        // 性能优化：移除压缩包的 data-export-url 属性（避免在显示时解析大的 base64 数据）
        // 但保留在原始 content 中，以便下载时使用
        // 这样可以避免切换目录时的卡顿
        // 重要：从原始内容（jiedianwords.value）中提取 data-export-url，而不是从处理后的 content 中
        // 因为 content 可能已经被处理过，移除了 data-export-url
        const archiveExportUrlMap = new Map();
        const originalContent = jiedianwords.value || '';
        const hasExportUrl = originalContent.includes('data-export-url');
        
        if (hasExportUrl) {
            // 使用更高效的方法：只匹配压缩包元素，避免匹配整个大字符串
            // 使用非贪婪匹配和更精确的正则表达式
            const archivePattern = /<div[^>]*class=["']archive-attachment["'][^>]*>/gi;
            let archiveMatch;
            let archiveIndex = 0;
            
            // 只处理压缩包元素，避免处理整个大字符串
            // 从原始内容中提取，确保能获取到 data-export-url
            while ((archiveMatch = archivePattern.exec(originalContent)) !== null) {
                const fullMatch = archiveMatch[0];
                // 只在压缩包元素中查找 data-export-url
                const exportUrlMatch = fullMatch.match(/data-export-url=["']([^"']+)["']/);
                if (exportUrlMatch && exportUrlMatch[1] && exportUrlMatch[1].startsWith('data:')) {
                    const exportUrl = exportUrlMatch[1];
                    // 提取 storage-id 或 archive-name 作为 key
                    const storageIdMatch = fullMatch.match(/\sdata-media-storage-id=["']([^"']+)["']/);
                    const archiveNameMatch = fullMatch.match(/\sdata-archive-name=["']([^"']+)["']/);
                    const key = storageIdMatch ? storageIdMatch[1] : (archiveNameMatch ? archiveNameMatch[1] : `archive_${archiveIndex}`);
                    archiveExportUrlMap.set(key, exportUrl);
                    archiveIndex++;
                }
            }
            
            // 从显示内容中移除 data-export-url（避免解析），但保留在原始 content 中
            if (archiveExportUrlMap.size > 0) {
                // 使用更高效的替换方法：只替换压缩包元素中的 data-export-url
                // 避免对整个大字符串进行全局替换
                content = content.replace(/<div([^>]*)class=["']archive-attachment["']([^>]*)data-export-url=["'][^"']*["']([^>]*)>/gi, 
                    '<div$1class="archive-attachment"$2$3>');
                content = content.replace(/<div([^>]*)data-export-url=["'][^"']*["']([^>]*)class=["']archive-attachment["']([^>]*)>/gi, 
                    '<div$1$2class="archive-attachment"$3>');
            }
        }
        
        // 更新DOM（使用 requestAnimationFrame 优化）
        const processAfterDOMUpdate = () => {
            // 为每个视频设置 data-video-index 属性，用于后续恢复
            const videos = markdownPreview.querySelectorAll('video');
            videos.forEach((video, index) => {
                video.setAttribute('data-video-index', index);
                if (videoOriginalSrcMap.has(index)) {
                    video.setAttribute('data-original-src', videoOriginalSrcMap.get(index));
                }
            });
            
            // 恢复压缩包的 data-export-url 到 DOM 元素上（但不显示，避免解析）
            // 这样下载时可以使用，但不会在显示时解析
            if (archiveExportUrlMap.size > 0) {
                const archiveElements = markdownPreview.querySelectorAll('.archive-attachment');
                archiveElements.forEach(element => {
                    const storageId = element.getAttribute('data-media-storage-id');
                    const archiveName = element.getAttribute('data-archive-name');
                    const key = storageId || archiveName;
                    if (key && archiveExportUrlMap.has(key)) {
                        // 将 data-export-url 存储到元素上，但不显示在 HTML 中
                        element.setAttribute('data-export-url', archiveExportUrlMap.get(key));
                    }
                });
            }
            
            // 不自动加载媒体数据，保持延迟加载
            // 图片和视频保持只有data-media-storage-id属性，不设置src
            // 只在用户真正需要时（滚动到可见区域、点击播放等）才从IndexedDB加载
            
            // 绑定任务列表复选框事件
            attachTaskListEvents();
            
            // 初始化视频元素，确保视频正确显示和播放
            initializeVideos();
            
            // 初始化压缩文件下载按钮
            initializeArchiveDownloadButtons();
        };
        
        if (typeof batchDOMUpdate === 'function') {
            batchDOMUpdate(() => {
                isUpdating = true;
                markdownPreview.innerHTML = content;
                lastPreviewContent = content; // 更新缓存
                isUpdating = false;
                
                // DOM更新后立即执行的后续操作
                processAfterDOMUpdate();
            });
        } else {
            // 降级方案：直接更新
            isUpdating = true;
            markdownPreview.innerHTML = content;
            lastPreviewContent = content;
            isUpdating = false;
            
            // 使用 requestAnimationFrame 延迟后续操作
            requestAnimationFrame(processAfterDOMUpdate);
        }
    }
}

/**
 * 初始化预览区域中的压缩文件下载按钮
 * 为动态加载的压缩文件附件添加事件监听
 */
function initializeArchiveDownloadButtons() {
    if (!markdownPreview) return;
    
    const archiveElements = markdownPreview.querySelectorAll('.archive-attachment');
    archiveElements.forEach(element => {
        // 确保压缩包元素不可编辑
        element.setAttribute('contenteditable', 'false');
        
        // 验证压缩包元素是否有 data-media-storage-id 或 data-export-url 属性
        const storageId = element.getAttribute('data-media-storage-id');
        const exportUrl = element.getAttribute('data-export-url');
        
        if (!storageId && !exportUrl) {
            // 如果缺少 storage-id 和 export-url，尝试从HTML内容中恢复
            // 这种情况不应该发生，但如果发生了，记录警告
            console.warn('压缩包元素缺少 data-media-storage-id 或 data-export-url 属性，可能无法下载');
            
            // 尝试从父元素或附近查找（作为后备方案）
            // 但由于数据已经丢失，无法恢复，只能跳过
            return;
        }
        
        const downloadBtn = element.querySelector('.archive-download-btn');
        if (downloadBtn) {
            // 移除旧的监听器（如果存在）并重新绑定，确保切换目录后也能正常工作
            const newDownloadBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
            
            // 更新 element 引用，指向新的下载按钮的父元素（压缩包元素）
            const archiveElement = newDownloadBtn.closest('.archive-attachment');
            
            newDownloadBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // 验证元素是否有必要的属性
                const storageId = archiveElement.getAttribute('data-media-storage-id');
                const exportUrl = archiveElement.getAttribute('data-export-url');
                const fileName = archiveElement.getAttribute('data-archive-name');
                
                console.log('下载按钮点击:', { fileName, storageId: storageId ? '存在' : '不存在', exportUrl: exportUrl ? '存在' : '不存在' });
                
                if (!storageId && !exportUrl) {
                    console.error('压缩包元素缺少 data-media-storage-id 和 data-export-url');
                    showToast('文件数据不存在，无法下载', 'error', 2000);
                    return;
                }
                
                // 调用 imageHandler.js 中定义的下载函数
                if (typeof downloadArchive === 'function') {
                    await downloadArchive(archiveElement);
                } else {
                    console.error('downloadArchive 函数未定义');
                    showToast('下载功能未初始化', 'error', 2000);
                }
            });
        }
    });
}

/**
 * 初始化预览区域中的所有视频元素
 * 确保视频有正确的属性和样式
 * 如果视频有 data-media-storage-id 但没有有效的 src，从 IndexedDB 加载
 */
function initializeVideos() {
    if (!markdownPreview) return;
    
    const videos = markdownPreview.querySelectorAll('video');
    
    videos.forEach((video, index) => {
        const videoIndex = parseInt(video.getAttribute('data-video-index'), 10);
        // 优先从 Map 中获取原始数据
        const originalSrcFromMap = (!isNaN(videoIndex) && videoOriginalSrcMap.has(videoIndex)) 
            ? videoOriginalSrcMap.get(videoIndex) 
            : null;
        const originalSrcFromAttr = video.getAttribute('data-original-src');
        const currentSrc = video.getAttribute('src');
        
        // 使用 Map 中的数据（优先）或属性中的数据
        const originalSrc = originalSrcFromMap || originalSrcFromAttr;
        
        // 如果有原始数据但当前 src 被截断，则恢复
        if (originalSrc && currentSrc && originalSrc.length > currentSrc.length) {
            // 如果是 base64 data URL，转换为 Blob URL 以提高性能
            if (originalSrc.startsWith('data:')) {
                (async () => {
                    try {
                        const response = await fetch(originalSrc);
                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        video.setAttribute('src', blobUrl);
                        video.setAttribute('data-original-src', blobUrl);
                    } catch (err) {
                        video.setAttribute('src', originalSrc);
                        video.setAttribute('data-original-src', originalSrc);
                    }
                })();
            } else {
                video.setAttribute('src', originalSrc);
                video.setAttribute('data-original-src', originalSrc);
            }
        }
        
        // 检查是否有 data-media-storage-id 但没有有效的 src
        // 这种情况发生在切换目录时，视频元素只有 storage-id 但没有加载数据
        const mediaStorageId = video.getAttribute('data-media-storage-id');
        if (mediaStorageId && typeof MediaStorage !== 'undefined') {
            // 检查当前 src 是否有效（不是 about:blank 且不为空）
            const src = video.getAttribute('src');
            const hasValidSrc = src && src !== 'about:blank' && !src.trim().match(/^\s*$/);
            
            if (!hasValidSrc) {
                // 延迟加载：从 IndexedDB 加载视频数据
                // 使用 IntersectionObserver 或点击事件来触发加载，避免一次性加载所有视频
                (async () => {
                    try {
                        // 检查是否已经加载过（避免重复加载）
                        if (video.hasAttribute('data-loading-media')) {
                            return;
                        }
                        video.setAttribute('data-loading-media', 'true');
                        
                        // 从 IndexedDB 获取视频 URL
                        const mediaUrl = await MediaStorage.getMediaAsUrl(mediaStorageId);
                        
                        if (mediaUrl) {
                            video.setAttribute('src', mediaUrl);
                            video.setAttribute('data-original-src', mediaUrl);
                            video.removeAttribute('data-loading-media');
                            
                            // 如果视频已经在视口中，尝试加载
                            if (video.offsetParent !== null) {
                                video.load();
                            }
                        } else {
                            console.warn('无法从 IndexedDB 加载视频:', mediaStorageId);
                            video.removeAttribute('data-loading-media');
                        }
                    } catch (err) {
                        console.error('加载视频失败:', mediaStorageId, err);
                        video.removeAttribute('data-loading-media');
                    }
                })();
            }
        }
        
        // 确保视频有 controls 属性
        if (!video.hasAttribute('controls')) {
            video.setAttribute('controls', 'true');
        }
        
        // 添加 preload="none" 延迟加载，提高性能
        if (!video.hasAttribute('preload')) {
            video.setAttribute('preload', 'none');
        }
        
        // 确保视频有合适的尺寸限制
        if (!video.style.maxWidth) {
            video.style.maxWidth = '640px';
        }
        if (!video.style.maxHeight) {
            video.style.maxHeight = '360px';
        }
    });
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
                    const rawImageData = e.target.result;
                    const caption = await customPrompt('输入图片图注（可选，直接按确定跳过，取消则不上传）:', '');
                    
                    // 用户点击取消，中止上传
                    if (caption === null) {
                        return;
                    }
                    
                    // 压缩图片（不影响质量）
                    const imageData = typeof compressImage === 'function' 
                        ? await compressImage(rawImageData) 
                        : rawImageData;
                    
                    // 保存压缩后的图片到 IndexedDB
                    const imageStorageId = typeof MediaStorage !== 'undefined'
                        ? await MediaStorage.saveImage(imageData)
                        : null;
                    
                    const img = document.createElement('img');
                    img.src = imageData;
                    img.alt = '粘贴的图片';
                    if (caption) img.title = caption;
                    if (imageStorageId) {
                        img.setAttribute('data-media-storage-id', imageStorageId);
                    }
                    
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
