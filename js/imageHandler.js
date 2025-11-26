// ============================================
// 图片/视频处理模块 (imageHandler.js)
// 功能：图片/视频上传、查看、拖拽处理、编辑、删除
// 依赖：globals.js, preview.js, dialog.js
// 注意：图片大小限制配置和 limitImageSize 函数在 globals.js 中定义
// ============================================

// -------------------- 状态变量 --------------------

/** 当前右键点击的图片元素 */
let currentContextImage = null;

// -------------------- 图片上传按钮 --------------------

if (imageUploadBtn) {
    imageUploadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (imageFileInput) {
            imageFileInput.click();
        }
    });
}


// -------------------- 文件选择处理 --------------------

if (imageFileInput) {
    imageFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            customAlert('请选择图片文件');
            return;
        }
        
        // 在弹出对话框之前保存光标位置
        const selection = window.getSelection();
        let savedRange = null;
        if (selection.rangeCount > 0 && markdownPreview.contains(selection.anchorNode)) {
            savedRange = selection.getRangeAt(0).cloneRange();
        }
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            const imageData = e.target.result;
            const imageName = file.name || 'image';
            
            const caption = await customPrompt('输入图片图注（可选，直接按确定跳过）:', '');
            
            const img = document.createElement('img');
            img.src = imageData;
            img.alt = imageName;
            if (caption) img.title = caption;
            
            limitImageSize(img);
            
            img.addEventListener('click', function() {
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
            
            // 使用保存的光标位置插入
            if (savedRange) {
                savedRange.deleteContents();
                savedRange.insertNode(imageContainer);
                const br = document.createElement('br');
                savedRange.setStartAfter(imageContainer);
                savedRange.insertNode(br);
            } else {
                markdownPreview.appendChild(imageContainer);
                markdownPreview.appendChild(document.createElement('br'));
            }
            
            syncPreviewToTextarea();
            imageFileInput.value = '';
        };
        reader.readAsDataURL(file);
    });
}

// -------------------- 视频文件选择处理 --------------------

/** 视频文件大小限制（5MB） */
const MAX_VIDEO_SIZE = 5 * 1024 * 1024;

if (videoFileInput) {
    videoFileInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('video/')) {
            customAlert('请选择视频文件');
            return;
        }
        
        // 检查视频大小
        if (file.size > MAX_VIDEO_SIZE) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(1);
            const confirmed = await customConfirm(`视频文件较大（${sizeMB}MB）！\n\n超过 5MB 的视频可能导致：\n• 保存的文件很大\n• 加载速度变慢\n• 浏览器卡顿\n\n确定要继续上传吗？`);
            if (!confirmed) {
                videoFileInput.value = '';
                return;
            }
        }
        
        // 在弹出对话框之前保存光标位置
        const selection = window.getSelection();
        let savedRange = null;
        if (selection.rangeCount > 0 && markdownPreview.contains(selection.anchorNode)) {
            savedRange = selection.getRangeAt(0).cloneRange();
        }
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            const videoData = e.target.result;
            const videoName = file.name || 'video';
            
            const caption = await customPrompt('输入视频标题（可选，直接按确定跳过）:', '');
            
            // 将视频保存到 IndexedDB
            let videoStorageId = null;
            if (typeof VideoStorage !== 'undefined') {
                try {
                    videoStorageId = await VideoStorage.saveVideo(videoData);
                } catch (err) {
                    console.error('保存视频到 IndexedDB 失败:', err);
                }
            }
            
            const video = document.createElement('video');
            video.src = videoData;
            video.controls = true;
            video.style.maxWidth = '640px';
            video.style.maxHeight = '360px';
            video.title = videoName;
            
            // 添加 IndexedDB 存储 ID
            if (videoStorageId) {
                video.setAttribute('data-video-storage-id', videoStorageId);
            }
            
            let videoContainer;
            if (caption) {
                videoContainer = document.createElement('figure');
                videoContainer.className = 'video-container';
                videoContainer.appendChild(video);
                const figcaption = document.createElement('figcaption');
                figcaption.textContent = caption;
                videoContainer.appendChild(figcaption);
            } else {
                videoContainer = document.createElement('div');
                videoContainer.className = 'video-container';
                videoContainer.appendChild(video);
            }
            
            // 使用保存的光标位置插入
            if (savedRange) {
                savedRange.deleteContents();
                savedRange.insertNode(videoContainer);
                const br = document.createElement('br');
                savedRange.setStartAfter(videoContainer);
                savedRange.insertNode(br);
            } else {
                markdownPreview.appendChild(videoContainer);
                markdownPreview.appendChild(document.createElement('br'));
            }
            
            // 确保同步到数据
            syncPreviewToTextarea();
            
            // 检查是否有选中的目录
            if (!currentMuluName) {
                showToast('提示：请先选择一个目录，否则视频无法保存', 'warning', 3000);
            }
            
            videoFileInput.value = '';
        };
        reader.readAsDataURL(file);
    });
}

// -------------------- 图片查看器 --------------------

/** 图片查看器遮罩层 */
let imageViewerOverlay = null;

/**
 * 创建图片查看器（懒加载）
 * @returns {HTMLElement} - 查看器遮罩层元素
 */
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

/**
 * 显示图片查看器
 * @param {string} imageSrc - 图片 URL 或 Base64
 */
function showImageViewer(imageSrc) {
    const viewer = createImageViewer();
    const img = viewer.querySelector('img');
    img.src = imageSrc;
    viewer.classList.add('active');
}

/**
 * 隐藏图片查看器
 */
function hideImageViewer() {
    if (imageViewerOverlay) {
        imageViewerOverlay.classList.remove('active');
    }
}

// -------------------- 图片编辑功能 --------------------

/**
 * 为图片添加或编辑图注
 * @param {HTMLImageElement} img - 图片元素
 */
async function editImageCaption(img) {
    if (!img) return;
    
    const figure = img.closest('figure');
    let currentCaption = '';
    
    if (figure) {
        const figcaption = figure.querySelector('figcaption');
        if (figcaption) {
            currentCaption = figcaption.textContent || '';
        }
    }
    
    const newCaption = await customPrompt('编辑图片图注（留空可删除图注）:', currentCaption);
    
    if (newCaption === null) return;
    
    if (figure) {
        let figcaption = figure.querySelector('figcaption');
        if (newCaption) {
            if (!figcaption) {
                figcaption = document.createElement('figcaption');
                figure.appendChild(figcaption);
            }
            figcaption.textContent = newCaption;
            img.title = newCaption;
        } else {
            if (figcaption) {
                figcaption.remove();
            }
            figure.parentNode.insertBefore(img, figure);
            figure.remove();
            img.title = '';
        }
    } else {
        if (newCaption) {
            const newFigure = document.createElement('figure');
            img.parentNode.insertBefore(newFigure, img);
            newFigure.appendChild(img);
            const figcaption = document.createElement('figcaption');
            figcaption.textContent = newCaption;
            newFigure.appendChild(figcaption);
            img.title = newCaption;
        }
    }
    
    syncPreviewToTextarea();
}

/**
 * 删除图片（连同 figure 一起删除）
 * @param {HTMLImageElement} img - 图片元素
 */
function deleteImage(img) {
    if (!img) return;
    
    const figure = img.closest('figure');
    if (figure) {
        figure.remove();
    } else {
        img.remove();
    }
    
    syncPreviewToTextarea();
}

/**
 * 检查选中范围是否包含图片
 * @param {Range} range - 选中范围
 * @param {string} key - 按下的键 ('Backspace' 或 'Delete')
 * @returns {HTMLImageElement|null} - 选中的图片元素或 null
 */
function getSelectedImage(range, key) {
    if (!range) return null;
    
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    
    // 检查选中内容是否包含图片
    const contents = range.cloneContents();
    const img = contents.querySelector('img');
    if (img) {
        const ancestor = range.commonAncestorContainer;
        const container = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode : ancestor;
        const originalImg = container.querySelector ? container.querySelector('img') : null;
        if (originalImg && range.intersectsNode(originalImg)) {
            return originalImg;
        }
        const allImgs = markdownPreview.querySelectorAll('img');
        for (const image of allImgs) {
            if (range.intersectsNode(image)) {
                return image;
            }
        }
    }
    
    // 检查光标是否在 figure 内
    let figure = null;
    if (startContainer.nodeType === Node.TEXT_NODE) {
        figure = startContainer.parentNode.closest('figure');
    } else if (startContainer.closest) {
        figure = startContainer.closest('figure');
    }
    
    if (figure) {
        const figureImg = figure.querySelector('img');
        if (figureImg) {
            const figureRange = document.createRange();
            figureRange.selectNode(figure);
            
            if (range.compareBoundaryPoints(Range.START_TO_START, figureRange) <= 0 &&
                range.compareBoundaryPoints(Range.END_TO_END, figureRange) >= 0) {
                return figureImg;
            }
            
            if (range.intersectsNode(figureImg)) {
                return figureImg;
            }
        }
    }
    
    // 检查选中范围的起点或终点是否直接在图片元素上
    if (startContainer.nodeType === Node.ELEMENT_NODE) {
        const childAtOffset = startContainer.childNodes[startOffset];
        if (childAtOffset && childAtOffset.tagName === 'IMG') {
            return childAtOffset;
        }
        if (childAtOffset && childAtOffset.tagName === 'FIGURE') {
            return childAtOffset.querySelector('img');
        }
        
        if (key === 'Backspace' && startOffset > 0) {
            const prevChild = startContainer.childNodes[startOffset - 1];
            if (prevChild) {
                if (prevChild.tagName === 'IMG') return prevChild;
                if (prevChild.tagName === 'FIGURE') return prevChild.querySelector('img');
                if (prevChild.nodeType === Node.ELEMENT_NODE && prevChild.querySelector) {
                    const innerImg = prevChild.querySelector('img');
                    if (innerImg) return innerImg;
                }
            }
        }
        
        if (key === 'Delete' && startOffset < startContainer.childNodes.length) {
            const nextChild = startContainer.childNodes[startOffset];
            if (nextChild) {
                if (nextChild.tagName === 'IMG') return nextChild;
                if (nextChild.tagName === 'FIGURE') return nextChild.querySelector('img');
            }
        }
    }
    
    // 检查文本节点情况下，光标前后是否有图片
    if (startContainer.nodeType === Node.TEXT_NODE) {
        if (key === 'Backspace' && startOffset === 0) {
            let prevSibling = startContainer.previousSibling;
            while (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && !prevSibling.textContent.trim()) {
                prevSibling = prevSibling.previousSibling;
            }
            if (prevSibling) {
                if (prevSibling.tagName === 'IMG') return prevSibling;
                if (prevSibling.tagName === 'FIGURE') return prevSibling.querySelector('img');
            }
        }
        
        if (key === 'Delete' && startOffset === startContainer.textContent.length) {
            let nextSibling = startContainer.nextSibling;
            while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.trim()) {
                nextSibling = nextSibling.nextSibling;
            }
            if (nextSibling) {
                if (nextSibling.tagName === 'IMG') return nextSibling;
                if (nextSibling.tagName === 'FIGURE') return nextSibling.querySelector('img');
            }
        }
    }
    
    return null;
}

/**
 * 清理孤立的 figcaption 和空的 figure 元素
 */
function cleanupOrphanedFigcaptions() {
    if (!markdownPreview) return;
    
    const figures = markdownPreview.querySelectorAll('figure');
    figures.forEach(figure => {
        const img = figure.querySelector('img');
        if (!img) {
            figure.remove();
        }
    });
    
    const figcaptions = markdownPreview.querySelectorAll('figcaption');
    figcaptions.forEach(figcaption => {
        const figure = figcaption.closest('figure');
        if (!figure) {
            figcaption.remove();
        }
    });
}

// -------------------- 图片右键菜单 --------------------

/**
 * 创建图片右键菜单
 */
function createImageContextMenu() {
    if (document.getElementById('imageContextMenu')) {
        return document.getElementById('imageContextMenu');
    }
    
    const menu = document.createElement('div');
    menu.id = 'imageContextMenu';
    menu.className = 'image-context-menu';
    menu.innerHTML = `
        <div class="image-menu-item" data-action="caption">编辑图注</div>
        <div class="image-menu-item" data-action="delete">删除图片</div>
    `;
    menu.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10001;
        display: none;
        min-width: 100px;
    `;
    
    menu.querySelectorAll('.image-menu-item').forEach(item => {
        item.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
        `;
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = '#f0f0f0';
        });
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'white';
        });
        item.addEventListener('click', async () => {
            const action = item.dataset.action;
            hideImageContextMenu();
            
            if (action === 'caption' && currentContextImage) {
                await editImageCaption(currentContextImage);
            } else if (action === 'delete' && currentContextImage) {
                const confirmed = await customConfirm('确定要删除这张图片吗？');
                if (confirmed) {
                    deleteImage(currentContextImage);
                }
            }
            currentContextImage = null;
        });
    });
    
    document.body.appendChild(menu);
    
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) {
            hideImageContextMenu();
        }
    });
    
    return menu;
}

/**
 * 显示图片右键菜单
 * @param {MouseEvent} e - 鼠标事件
 * @param {HTMLImageElement} img - 图片元素
 */
function showImageContextMenu(e, img) {
    const menu = createImageContextMenu();
    currentContextImage = img;
    
    let x = e.clientX;
    let y = e.clientY;
    
    menu.style.display = 'block';
    
    const menuRect = menu.getBoundingClientRect();
    if (x + menuRect.width > window.innerWidth) {
        x = window.innerWidth - menuRect.width - 10;
    }
    if (y + menuRect.height > window.innerHeight) {
        y = window.innerHeight - menuRect.height - 10;
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

/**
 * 隐藏图片右键菜单
 */
function hideImageContextMenu() {
    const menu = document.getElementById('imageContextMenu');
    if (menu) {
        menu.style.display = 'none';
    }
}

// -------------------- 图片点击事件绑定 --------------------

/**
 * 为预览区域中的所有图片添加点击展开事件
 */
function attachImageClickEvents() {
    if (!markdownPreview) return;
    
    const images = markdownPreview.querySelectorAll('img');
    images.forEach(img => {
        if (!img.hasAttribute('data-click-attached')) {
            img.setAttribute('data-click-attached', 'true');
            img.addEventListener('click', function(e) {
                e.stopPropagation();
                showImageViewer(img.src);
            });
        }
    });
}

// -------------------- 事件绑定 --------------------

if (markdownPreview) {
    // MutationObserver：为新插入的图片添加点击事件
    const imageObserver = new MutationObserver(function(mutations) {
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
    
    imageObserver.observe(markdownPreview, {
        childList: true,
        subtree: true
    });
    
    attachImageClickEvents();
    
    // 图片右键菜单
    markdownPreview.addEventListener('contextmenu', (e) => {
        const img = e.target.closest('img');
        if (img) {
            e.preventDefault();
            e.stopPropagation();
            showImageContextMenu(e, img);
            return;
        }
    }, true);
    
    // 允许拖拽
    markdownPreview.addEventListener("dragover", function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 处理拖放
    markdownPreview.addEventListener("drop", async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 在拖放时保存光标位置（使用拖放位置创建范围）
        let savedRange = null;
        if (document.caretRangeFromPoint) {
            savedRange = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            if (pos) {
                savedRange = document.createRange();
                savedRange.setStart(pos.offsetNode, pos.offset);
                savedRange.collapse(true);
            }
        }
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        const imageData = e.target.result;
                        const imageName = file.name || '图片';
                        
                        const caption = await customPrompt('输入图片图注（可选，直接按确定跳过）:', '');
                        
                        const img = document.createElement('img');
                        img.src = imageData;
                        img.alt = imageName;
                        if (caption) img.title = caption;
                        
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
                        
                        // 使用保存的拖放位置插入
                        if (savedRange && markdownPreview.contains(savedRange.startContainer)) {
                            savedRange.insertNode(imageContainer);
                            const br = document.createElement('br');
                            savedRange.setStartAfter(imageContainer);
                            savedRange.insertNode(br);
                        } else {
                            markdownPreview.appendChild(imageContainer);
                            markdownPreview.appendChild(document.createElement('br'));
                        }
                        
                        syncPreviewToTextarea();
                    };
                    reader.readAsDataURL(file);
                } else if (file.type.startsWith('video/')) {
                    // 检查视频大小
                    if (file.size > MAX_VIDEO_SIZE) {
                        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
                        const confirmed = await customConfirm(`视频文件较大（${sizeMB}MB）！\n\n超过 5MB 的视频可能导致：\n• 保存的文件很大\n• 加载速度变慢\n• 浏览器卡顿\n\n确定要继续上传吗？`);
                        if (!confirmed) {
                            return;
                        }
                    }
                    
                    // 处理视频拖拽
                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        const videoData = e.target.result;
                        const videoName = file.name || '视频';
                        
                        const caption = await customPrompt('输入视频标题（可选，直接按确定跳过）:', '');
                        
                        // 将视频保存到 IndexedDB
                        let videoStorageId = null;
                        if (typeof VideoStorage !== 'undefined') {
                            try {
                                videoStorageId = await VideoStorage.saveVideo(videoData);
                            } catch (err) {
                                console.error('保存视频到 IndexedDB 失败:', err);
                            }
                        }
                        
                        const video = document.createElement('video');
                        video.src = videoData;
                        video.controls = true;
                        video.style.maxWidth = '640px';
                        video.style.maxHeight = '360px';
                        video.title = videoName;
                        
                        // 添加 IndexedDB 存储 ID
                        if (videoStorageId) {
                            video.setAttribute('data-video-storage-id', videoStorageId);
                        }
                        
                        let videoContainer;
                        if (caption) {
                            videoContainer = document.createElement('figure');
                            videoContainer.className = 'video-container';
                            videoContainer.appendChild(video);
                            const figcaption = document.createElement('figcaption');
                            figcaption.textContent = caption;
                            videoContainer.appendChild(figcaption);
                        } else {
                            videoContainer = document.createElement('div');
                            videoContainer.className = 'video-container';
                            videoContainer.appendChild(video);
                        }
                        
                        // 使用保存的拖放位置插入
                        if (savedRange && markdownPreview.contains(savedRange.startContainer)) {
                            savedRange.insertNode(videoContainer);
                            const br = document.createElement('br');
                            savedRange.setStartAfter(videoContainer);
                            savedRange.insertNode(br);
                        } else {
                            markdownPreview.appendChild(videoContainer);
                            markdownPreview.appendChild(document.createElement('br'));
                        }
                        
                        // 确保同步到数据
                        syncPreviewToTextarea();
                        
                        // 检查是否有选中的目录
                        if (!currentMuluName) {
                            showToast('提示：请先选择一个目录，否则视频无法保存', 'warning', 3000);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    });
}
