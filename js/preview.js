/**
 * 从 HTML 内容中移除搜索高亮标签
 * @param {string} html - HTML 内容
 * @returns {string} - 清理后的内容
 */
function removeSearchHighlights(html) {
    if (!html) return html;
    let result = html;
    result = result.replace(/<span\s+class=["']search-highlight(?:-current)?["'][^>]*>([\s\S]*?)<\/span>/gi, '$1');
    return result;
}
/**
 * 同步预览区域内容到隐藏的 textarea，并更新数据
 */
function syncPreviewToTextarea() {
    if (markdownPreview && jiedianwords) {
        const checkboxes = markdownPreview.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                checkbox.setAttribute('checked', 'checked');
            } else {
                checkbox.removeAttribute('checked');
            }
        });
        ensureAnchorElements(markdownPreview);
        let html = removeSearchHighlights(markdownPreview.innerHTML);
        const archiveElements = markdownPreview.querySelectorAll('.archive-attachment');
        archiveElements.forEach(archiveElement => {
            const storageId = archiveElement.getAttribute('data-media-storage-id');
            const exportUrl = archiveElement.getAttribute('data-export-url');
            const archiveName = archiveElement.getAttribute('data-archive-name');
            if (archiveName) {
                const archiveNameEscaped = archiveName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(
                    `(<div[^>]*class=["']archive-attachment["'][^>]*data-archive-name=["']${archiveNameEscaped}["'][^>]*)>`,
                    'gi'
                );
                html = html.replace(regex, (match) => {
                    let updated = match;
                    if (storageId && !updated.includes('data-media-storage-id')) {
                        updated = updated.replace('>', ` data-media-storage-id="${storageId}">`);
                    }
                    if (exportUrl && !updated.includes('data-export-url')) {
                        updated = updated.replace('>', ` data-export-url="${exportUrl}">`);
                    }
                    return updated;
                });
            }
        });
        if (html.includes('data-media-storage-id')) {
            html = html.replace(
                /(<video[^>]*data-media-storage-id=["'][^"']+["'][^>]*)\ssrc=["'](blob:[^"']+)["']([^>]*>)/gi,
                '$1 src="about:blank"$3'
            );
            html = html.replace(
                /(<video[^>]*)\ssrc=["'](blob:[^"']+)["']([^>]*data-media-storage-id=["'][^"']+["'][^>]*>)/gi,
                '$1 src="about:blank"$3'
            );
            html = html.replace(
                /(<img[^>]*data-media-storage-id=["'][^"']+["'][^>]*)\ssrc=["'](blob:[^"']+)["']([^>]*>)/gi,
                '$1 src="about:blank"$3'
            );
            html = html.replace(
                /(<img[^>]*)\ssrc=["'](blob:[^"']+)["']([^>]*data-media-storage-id=["'][^"']+["'][^>]*>)/gi,
                '$1 src="about:blank"$3'
            );
        }
        html = normalizeEditorHtmlForStorage(html);
        isUpdating = true;
        jiedianwords.value = html;
        isUpdating = false;
        if (currentMuluName) {
            let changedmulu = document.getElementById(currentMuluName);
            if (changedmulu) {
                updateMulufileData(changedmulu, html, { normalized: true });
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
        if (checkbox.hasAttribute('disabled')) {
            checkbox.removeAttribute('disabled');
        }
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

function escapeCssSelectorValue(value) {
    if (value === null || value === undefined) return '';
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(String(value));
    }
    return String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function(ch) {
        const hex = ch.charCodeAt(0).toString(16);
        return '\\' + hex + ' ';
    });
}

function normalizeAnchorId(raw) {
    if (!raw) return '';
    let id = String(raw).trim();
    id = id.replace(/^#/, '');
    id = id.replace(/\s+/g, '-');
    return id;
}

function generateShortRandomId(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

function generateUniqueAnchorDomId(anchorName, root) {
    const name = normalizeAnchorId(anchorName) || '锚点';
    const base = 'sora-anchor-' + name;
    const container = root || document;
    for (let i = 0; i < 50; i++) {
        const id = base + '-' + generateShortRandomId(6);
        if (!container.getElementById || !container.getElementById(id)) {
            if (!document.getElementById(id)) return id;
        }
    }
    return base + '-' + Date.now();
}

function ensureAnchorElements(root) {
    if (!root || !root.querySelectorAll) return;
    const anchors = root.querySelectorAll('.sora-anchor[data-sora-anchor="true"]');
    anchors.forEach(el => {
        const existingName = el.getAttribute('data-anchor-name') || '';
        let name = normalizeAnchorId(existingName);
        if (!name) {
            name = normalizeAnchorId(el.id || '') || '锚点';
            el.setAttribute('data-anchor-name', name);
        }
        const id = el.id || '';
        if (!String(id).startsWith('sora-anchor-')) {
            el.id = generateUniqueAnchorDomId(name, document);
            el.setAttribute('data-auto-anchor-id', 'true');
        } else {
            el.removeAttribute('data-auto-anchor-id');
        }
    });
}

function assignHeadingAutoIds(root) {
    if (!root) return;
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const used = new Set();
    headings.forEach(h => {
        if (h.id) {
            used.add(h.id);
            return;
        }
        const base = normalizeAnchorId(h.textContent || '') || '标题';
        let candidate = base;
        let i = 2;
        while (candidate && (used.has(candidate) || root.querySelector('#' + escapeCssSelectorValue(candidate)))) {
            candidate = base + '-' + i;
            i++;
        }
        if (!candidate) return;
        h.id = candidate;
        h.setAttribute('data-auto-heading-id', 'true');
        used.add(candidate);
    });
}

function normalizeEditorHtmlForStorage(html) {
    if (!html) return '';
    const template = document.createElement('template');
    const source = String(html);
    template.innerHTML = source;
    if (typeof sanitizeEditorFragment === 'function' &&
        (typeof needsEditorHtmlSanitizing !== 'function' || needsEditorHtmlSanitizing(source))) {
        sanitizeEditorFragment(template.content);
    }

    template.content.querySelectorAll('[data-auto-heading-id="true"]').forEach(el => {
        el.removeAttribute('id');
        el.removeAttribute('data-auto-heading-id');
    });
    template.content.querySelectorAll('[data-auto-anchor-id="true"]').forEach(el => {
        el.removeAttribute('id');
        el.removeAttribute('data-auto-anchor-id');
    });
    template.content.querySelectorAll('[data-task-attached]').forEach(el => {
        el.removeAttribute('data-task-attached');
    });
    template.content.querySelectorAll('[data-click-attached]').forEach(el => {
        el.removeAttribute('data-click-attached');
    });
    template.content.querySelectorAll('[data-video-index]').forEach(el => {
        el.removeAttribute('data-video-index');
    });
    template.content.querySelectorAll('[data-original-src]').forEach(el => {
        el.removeAttribute('data-original-src');
    });
    template.content.querySelectorAll('[data-loading-media]').forEach(el => {
        el.removeAttribute('data-loading-media');
    });
    template.content.querySelectorAll('.archive-download-btn[data-initialized]').forEach(el => {
        el.removeAttribute('data-initialized');
    });
    template.content.querySelectorAll('[data-sora-methods-executed]').forEach(el => {
        el.removeAttribute('data-sora-methods-executed');
    });

    return template.innerHTML;
}

function scrollToAnchorInPreview(anchorId) {
    if (!markdownPreview) return;
    const id = normalizeAnchorId(anchorId);
    if (!id) return;
    const selector = '#' + escapeCssSelectorValue(id);
    let el = markdownPreview.querySelector(selector);
    if (!el) {
        el = markdownPreview.querySelector('.sora-anchor[data-sora-anchor="true"][data-anchor-name="' + escapeCssSelectorValue(id) + '"]');
    }
    if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function navigateToDirectoryInternalLink(dirId, anchorId) {
    if (!dirId) return;
    const target = document.querySelector('.mulu[data-dir-id="' + escapeCssSelectorValue(dirId) + '"]');
    if (!target) {
        if (typeof showToast === 'function') {
            showToast('未找到目标目录：' + dirId, 'warning', 2500);
        }
        return;
    }

    let parentId = target.getAttribute('data-parent-id');
    while (parentId && parentId !== 'mulu') {
        const parentEl = document.querySelector('.mulu[data-dir-id="' + escapeCssSelectorValue(parentId) + '"]');
        if (parentEl) {
            if (!parentEl.classList.contains('expanded')) {
                parentEl.classList.add('expanded');
            }
            if (typeof toggleChildDirectories === 'function') {
                toggleChildDirectories(parentId, true);
            }
            parentId = parentEl.getAttribute('data-parent-id');
        } else {
            break;
        }
    }

    if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'center' });
    }

    await switchToDirectoryElement(target, { syncCurrent: true, scrollPreviewTop: true, forceRender: true });

    if (anchorId) {
        requestAnimationFrame(() => {
            scrollToAnchorInPreview(anchorId);
        });
    }
}

async function switchToDirectoryElement(target, options = {}) {
    if (!target) return false;
    const syncCurrent = options.syncCurrent !== false;
    const scrollPreviewTop = options.scrollPreviewTop !== false;
    const forceRender = options.forceRender === true;

    if (syncCurrent && currentMuluName) {
        const current = document.getElementById(currentMuluName);
        if (current) {
            syncPreviewToTextarea();
        }
    }

    currentMuluName = target.id;
    if (typeof RemoveOtherSelect === 'function') {
        RemoveOtherSelect();
    }
    target.classList.add('select');

    if (jiedianwords) {
        jiedianwords.value = findMulufileData(target);
    }
    if (markdownPreview && scrollPreviewTop) {
        markdownPreview.scrollTop = 0;
    }

    isUpdating = true;
    try {
        await updateMarkdownPreview({ force: forceRender });
    } finally {
        isUpdating = false;
    }
    if (typeof DirectoryNavigation !== 'undefined') {
        const dirId = target.getAttribute('data-dir-id');
        if (dirId) DirectoryNavigation.track(dirId);
    }
    return true;
}

/**
 * 从 textarea 同步内容到预览区域
 * 性能优化：内容未变化时跳过更新，使用 requestAnimationFrame 优化DOM操作
 */
async function updateMarkdownPreview(options = {}) {
    if (markdownPreview && jiedianwords) {
        const forceRender = !!(options && options.force);
        let content = jiedianwords.value || '';
        if (typeof sanitizeEditorHtml === 'function') {
            const sanitizedContent = sanitizeEditorHtml(content);
            if (sanitizedContent !== content) {
                content = sanitizedContent;
                jiedianwords.value = content;
                const current = currentMuluName ? document.getElementById(currentMuluName) : null;
                if (current) updateMulufileData(current, content);
            }
        }
        // 性能优化：如果内容没有变化，跳过更新
        if (!forceRender && content === lastPreviewContent && markdownPreview.innerHTML) {
            return;
        }
        // 不在这里自动加载媒体数据
        // 视频/图片会保持data-media-storage-id属性，只在用户真正需要时才加载
        // 这样可以避免切换目录时的卡顿和进度提示
        // 性能优化：如果处理后的内容仍然相同，跳过更新
        if (!forceRender && content === lastPreviewContent && markdownPreview.innerHTML === content) {
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
        // 优化：不在字符串层面处理，而是在 DOM 更新后直接操作 DOM 元素，避免处理大字符串
        const archiveExportUrlMap = new Map();
        const originalContent = jiedianwords.value || '';
        const hasExportUrl = originalContent.includes('data-export-url');
        // 只在确实有 data-export-url 时才处理，且使用更高效的方法
        // 使用字符串索引查找，避免正则表达式遍历整个大字符串
        if (hasExportUrl) {
            // 使用字符串查找和切片，避免正则表达式处理大字符串
            let searchIndex = 0;
            let archiveIndex = 0;
            // 查找所有压缩包元素的开始位置
            while (true) {
                const archiveStart = originalContent.indexOf('<div', searchIndex);
                if (archiveStart === -1) break;
                // 检查是否是 archive-attachment 元素
                const classIndex = originalContent.indexOf('class=', archiveStart);
                if (classIndex === -1 || classIndex > archiveStart + 100) {
                    searchIndex = archiveStart + 4;
                    continue;
                }
                // 检查是否包含 archive-attachment
                const classEnd = originalContent.indexOf('>', classIndex);
                if (classEnd === -1) {
                    searchIndex = archiveStart + 4;
                    continue;
                }
                const classAttr = originalContent.substring(classIndex, classEnd);
                if (!classAttr.includes('archive-attachment')) {
                    searchIndex = archiveStart + 4;
                    continue;
                }
                // 找到压缩包元素，提取 data-export-url
                const elementEnd = originalContent.indexOf('>', archiveStart);
                if (elementEnd === -1) {
                    searchIndex = archiveStart + 4;
                    continue;
                }
                const elementStr = originalContent.substring(archiveStart, elementEnd + 1);
                const exportUrlMatch = elementStr.match(/data-export-url=["']([^"']+)["']/);
                if (exportUrlMatch && exportUrlMatch[1] && exportUrlMatch[1].startsWith('data:')) {
                    const exportUrl = exportUrlMatch[1];
                    // 提取 storage-id 或 archive-name 作为 key
                    const storageIdMatch = elementStr.match(/\sdata-media-storage-id=["']([^"']+)["']/);
                    const archiveNameMatch = elementStr.match(/\sdata-archive-name=["']([^"']+)["']/);
                    const key = storageIdMatch ? storageIdMatch[1] : (archiveNameMatch ? archiveNameMatch[1] : `archive_${archiveIndex}`);
                    archiveExportUrlMap.set(key, exportUrl);
                    archiveIndex++;
                }
                searchIndex = elementEnd + 1;
            }
            // 快速移除 content 中的 data-export-url 属性（避免浏览器解析大的 base64 数据）
            // 对于小内容使用正则表达式（更快），对于大内容在 DOM 更新后立即移除
            if (archiveExportUrlMap.size > 0) {
                // 如果内容不是太大，直接使用正则表达式替换（更快）
                // 对于大内容，在 DOM 更新后立即移除属性，避免阻塞
                if (content.length < 500000) {
                    // 内容较小，直接使用正则表达式替换
                    content = content.replace(/<div([^>]*)class=["']archive-attachment["']([^>]*)data-export-url=["'][^"']*["']([^>]*)>/gi, 
                        '<div$1class="archive-attachment"$2$3>');
                    content = content.replace(/<div([^>]*)data-export-url=["'][^"']*["']([^>]*)class=["']archive-attachment["']([^>]*)>/gi, 
                        '<div$1$2class="archive-attachment"$3>');
                }
                // 对于大内容，不在字符串层面处理，而是在 DOM 更新后立即移除
            }
        }

        // 更新DOM（使用 requestAnimationFrame 优化）
        const processAfterDOMUpdate = () => {
            assignHeadingAutoIds(markdownPreview);
            // 为每个视频设置 data-video-index 属性，用于后续恢复
            const videos = markdownPreview.querySelectorAll('video');
            videos.forEach((video, index) => {
                video.setAttribute('data-video-index', index);
                if (videoOriginalSrcMap.has(index)) {
                    video.setAttribute('data-original-src', videoOriginalSrcMap.get(index));
                }
            });

            // 处理压缩包元素：移除 DOM 中的 data-export-url 属性（避免解析），但保留在 Map 中供下载使用
            // 这样下载时可以使用，但不会在显示时解析大的 base64 数据
            // 对于大内容，这是关键的性能优化：立即移除属性，避免浏览器解析大的 base64 数据
            if (archiveExportUrlMap.size > 0) {
                const archiveElements = markdownPreview.querySelectorAll('.archive-attachment');
                // 立即移除所有 data-export-url 属性（如果存在），避免浏览器解析大的 base64 数据
                archiveElements.forEach(element => {
                    if (element.hasAttribute('data-export-url')) {
                        const exportUrl = element.getAttribute('data-export-url');
                        element.removeAttribute('data-export-url');
                        // 保存到 Map 中，供下载时使用
                        const storageId = element.getAttribute('data-media-storage-id');
                        const archiveName = element.getAttribute('data-archive-name');
                        const key = storageId || archiveName;
                        if (key && exportUrl && exportUrl.startsWith('data:')) {
                            archiveExportUrlMap.set(key, exportUrl);
                        }
                    }
                });
                // 从 Map 中恢复 data-export-url 到 DOM 元素上（但不显示在 HTML 中）
                // 这样下载时可以使用，但不会在显示时解析
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
            attachTaskListEvents();
            // 不自动加载媒体数据，保持延迟加载
            // 图片和视频保持只有data-media-storage-id属性，不设置src
            // 只在用户真正需要时（滚动到可见区域、点击播放等）才从IndexedDB加载
            // 使用 requestIdleCallback 或 setTimeout 分批处理后续操作，避免阻塞主线程
            const processDeferred = () => {
                initializeStoredImages();
                // 初始化视频元素，确保视频正确显示和播放
                initializeVideos();
                // 初始化压缩文件下载按钮
                initializeArchiveDownloadButtons();
            };
            // 优先使用 requestIdleCallback，降级到 setTimeout
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(processDeferred, { timeout: 100 });
            } else {
                setTimeout(processDeferred, 0);
            }
        };

        await new Promise(resolve => {
            const commitPreviewDom = () => {
                isUpdating = true;
                markdownPreview.innerHTML = content;
                lastPreviewContent = content; // 更新缓存
                isUpdating = false;
                // DOM更新后立即执行的后续操作
                processAfterDOMUpdate();
                resolve();
            };

            if (typeof batchDOMUpdate === 'function') {
                batchDOMUpdate(commitPreviewDom);
            } else if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(commitPreviewDom);
            } else {
                setTimeout(commitPreviewDom, 16);
            }
        });
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
        element.setAttribute('contenteditable', 'false');
        const storageId = element.getAttribute('data-media-storage-id');
        const exportUrl = element.getAttribute('data-export-url');
        if (!storageId && !exportUrl) {
            console.warn('压缩包元素缺少 data-media-storage-id 或 data-export-url 属性，可能无法下载');
            return;
        }
        const downloadBtn = element.querySelector('.archive-download-btn');
        if (downloadBtn) {
            const newDownloadBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
            const archiveElement = newDownloadBtn.closest('.archive-attachment');
            newDownloadBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                const storageId = archiveElement.getAttribute('data-media-storage-id');
                const exportUrl = archiveElement.getAttribute('data-export-url');
                const fileName = archiveElement.getAttribute('data-archive-name');
                console.log('下载按钮点击:', { fileName, storageId: storageId ? '存在' : '不存在', exportUrl: exportUrl ? '存在' : '不存在' });
                if (!storageId && !exportUrl) {
                    console.error('压缩包元素缺少 data-media-storage-id 和 data-export-url');
                    showToast('文件数据不存在，无法下载', 'error', 2000);
                    return;
                }
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

function initializeStoredImages() {
    if (!markdownPreview || typeof MediaStorage === 'undefined') return;
    markdownPreview.querySelectorAll('img[data-media-storage-id]').forEach(img => {
        const src = img.getAttribute('src');
        const hasValidSrc = src && src !== 'about:blank' && !/^\s*$/.test(src);
        if (hasValidSrc || img.hasAttribute('data-loading-media')) return;
        const mediaId = img.getAttribute('data-media-storage-id');
        if (!mediaId) return;
        img.setAttribute('data-loading-media', 'true');
        MediaStorage.getMediaAsUrl(mediaId).then(url => {
            if (url) {
                img.setAttribute('src', url);
                if (typeof limitImageSize === 'function') limitImageSize(img);
            }
        }).catch(err => {
            console.warn('加载图片失败:', mediaId, err);
        }).finally(() => {
            img.removeAttribute('data-loading-media');
        });
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
        const originalSrcFromMap = (!isNaN(videoIndex) && videoOriginalSrcMap.has(videoIndex)) 
            ? videoOriginalSrcMap.get(videoIndex) 
            : null;
        const originalSrcFromAttr = video.getAttribute('data-original-src');
        const currentSrc = video.getAttribute('src');
        const originalSrc = originalSrcFromMap || originalSrcFromAttr;
        if (originalSrc && currentSrc && originalSrc.length > currentSrc.length) {
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
        const mediaStorageId = video.getAttribute('data-media-storage-id');
        if (mediaStorageId && typeof MediaStorage !== 'undefined') {
            const src = video.getAttribute('src');
            const hasValidSrc = src && src !== 'about:blank' && !src.trim().match(/^\s*$/);
            if (!hasValidSrc) {
                video.removeAttribute('src');
                video.setAttribute('data-media-pending', 'true');
                const loadStoredVideo = async (playAfterLoad = false) => {
                    try {
                        if (video.hasAttribute('data-loading-media')) {
                            return;
                        }
                        video.setAttribute('data-loading-media', 'true');
                        const mediaUrl = await MediaStorage.getMediaAsUrl(mediaStorageId);
                        if (mediaUrl) {
                            video.setAttribute('src', mediaUrl);
                            video.setAttribute('data-original-src', mediaUrl);
                            video.removeAttribute('data-media-pending');
                            video.removeAttribute('data-loading-media');
                            if (video.offsetParent !== null) {
                                video.load();
                            }
                            if (playAfterLoad) {
                                video.play().catch(() => {});
                            }
                        } else {
                            console.warn('无法从 IndexedDB 加载视频:', mediaStorageId);
                            video.removeAttribute('data-loading-media');
                        }
                    } catch (err) {
                        console.error('加载视频失败:', mediaStorageId, err);
                        video.removeAttribute('data-loading-media');
                    }
                };
                video.addEventListener('click', () => loadStoredVideo(false), { once: true });
                video.addEventListener('play', (event) => {
                    if (video.getAttribute('data-media-pending') === 'true') {
                        event.preventDefault();
                        video.pause();
                        loadStoredVideo(true);
                    }
                }, { once: true });
                if (typeof MediaStorage.getMediaInfo === 'function') {
                    MediaStorage.getMediaInfo(mediaStorageId).then(info => {
                        if (!info || info.storage !== 'opfs' || !video.isConnected) return;
                        video.setAttribute('preload', 'metadata');
                        loadStoredVideo(false);
                    }).catch(err => {
                        console.warn('读取视频存储信息失败:', mediaStorageId, err);
                    });
                }
            }
        }
        if (!video.hasAttribute('controls')) {
            video.setAttribute('controls', 'true');
        }
        if (!video.hasAttribute('preload')) {
            video.setAttribute('preload', 'none');
        }
        if (!video.style.maxWidth) {
            video.style.maxWidth = '640px';
        }
        if (!video.style.maxHeight) {
            video.style.maxHeight = '360px';
        }
    });
}
if (markdownPreview) {
    markdownPreview.setAttribute('contenteditable', 'true');
    markdownPreview.setAttribute('spellcheck', 'true');
    markdownPreview.addEventListener("keydown", function(e) {
        if (e.key === 'Enter') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let container = range.commonAncestorContainer;
                if (container.nodeType === Node.TEXT_NODE) {
                    container = container.parentNode;
                }
                const codeBlock = container.closest('pre, code');
                if (codeBlock) {
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
                if (e.shiftKey) return;
                let currentBlock = container;
                while (currentBlock && currentBlock !== markdownPreview) {
                    const tagName = currentBlock.tagName;
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
                    if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE'].includes(tagName)) {
                        break;
                    }
                    currentBlock = currentBlock.parentNode;
                }
            }
        }
    });
    const debouncedSync = debounce(syncPreviewToTextarea, 150);
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
    markdownPreview.addEventListener("input", function (e) {
        if (isUpdating) return;
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const formatTags = ['EM', 'I', 'STRONG', 'B', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'MARK', 'SUP', 'SUB'];
            let container = range.startContainer;
            let node = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
            while (node && node !== markdownPreview) {
                if (node.nodeType === Node.ELEMENT_NODE && formatTags.includes(node.tagName)) {
                    const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'UL', 'OL', 'PRE'];
                    let blockParent = node.parentNode;
                    while (blockParent && blockParent !== markdownPreview) {
                        if (blockParent.nodeType === Node.ELEMENT_NODE && blockTags.includes(blockParent.tagName)) {
                            break;
                        }
                        blockParent = blockParent.parentNode;
                    }
                    if (!blockParent) blockParent = markdownPreview;
                    const textNode = document.createTextNode('');
                    if (node.nextSibling) {
                        node.parentNode.insertBefore(textNode, node.nextSibling);
                    } else {
                        node.parentNode.appendChild(textNode);
                    }
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
        debouncedDivToP();
        debouncedSync();
    });
    markdownPreview.addEventListener("change", function(e) {
        if (e.target.classList.contains('task-list-item-checkbox')) {
            syncPreviewToTextarea();
        }
    });
    attachTaskListEvents();
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
if (markdownPreview) {
    markdownPreview.addEventListener("copy", function(e) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!markdownPreview.contains(range.commonAncestorContainer) && 
            !range.commonAncestorContainer.contains(markdownPreview)) {
            return;
        }
        const contents = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(contents);
        e.clipboardData.setData('text/html', tempDiv.innerHTML);
        e.clipboardData.setData('text/plain', range.toString());
        e.preventDefault();
    });
}
if (markdownPreview) {
    markdownPreview.addEventListener("paste", function(e) {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
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
                    if (caption === null) {
                        return;
                    }
                    const imageData = typeof compressImage === 'function' 
                        ? await compressImage(rawImageData) 
                        : rawImageData;
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
        if (!hasImage) {
            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            let html = clipboardData.getData('text/html');
            const text = clipboardData.getData('text/plain');
            if (html && html.trim()) {
                if (typeof sanitizeEditorHtml === 'function') {
                    html = sanitizeEditorHtml(html);
                }
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
jiedianwords.addEventListener("input", function () {
    if (!isUpdating) {
        updateMarkdownPreview();
    }
});
