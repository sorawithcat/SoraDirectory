// ============================================
// 图片处理模块 (imageHandler.js)
// 功能：图片上传、查看、拖拽处理
// 依赖：globals.js, preview.js
// 注意：图片大小限制配置和 limitImageSize 函数在 globals.js 中定义
// ============================================

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
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            const imageData = e.target.result;
            const imageName = file.name || 'image';
            
            // 提示用户输入图注
            const caption = await customPrompt('输入图片图注（可选，直接按确定跳过）:', '');
            
            const img = document.createElement('img');
            img.src = imageData;
            img.alt = imageName;
            if (caption) img.title = caption;
            
            // 限制图片大小
            limitImageSize(img);
            
            // 添加点击展开功能
            img.addEventListener('click', function() {
                showImageViewer(imageData);
            });
            
            // 创建图片容器（带图注时使用 figure）
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
            
            // 插入到预览区域
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
            imageFileInput.value = '';
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

// -------------------- 图片点击事件绑定 --------------------

/**
 * 为预览区域中的所有图片添加点击展开事件
 */
function attachImageClickEvents() {
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

// MutationObserver：为新插入的图片添加点击事件
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
    attachImageClickEvents();
}

// -------------------- 拖拽图片支持 --------------------

if (markdownPreview) {
    // 允许拖拽
    markdownPreview.addEventListener("dragover", function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 处理拖放
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
