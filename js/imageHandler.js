// ============================================
// imageHandler 模块 (imageHandler.js)
// ============================================

// 图片大小限制配置（如果 preview.js 已定义，则使用已存在的值）
if (typeof MAX_IMAGE_WIDTH === 'undefined') {
    var MAX_IMAGE_WIDTH = 800;  // 最大宽度（像素）
    var MAX_IMAGE_HEIGHT = 600;  // 最大高度（像素）
}

// 辅助函数：限制图片大小但保持比例（如果 preview.js 已定义，则使用已存在的函数）
if (typeof limitImageSize === 'undefined') {
    function limitImageSize(img, maxWidth = MAX_IMAGE_WIDTH, maxHeight = MAX_IMAGE_HEIGHT) {
        return new Promise((resolve) => {
            const applySizeLimit = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            
            if (width === 0 || height === 0) {
                resolve();
                return;
            }
            
            // 计算缩放比例
            const widthRatio = maxWidth / width;
            const heightRatio = maxHeight / height;
            const ratio = Math.min(widthRatio, heightRatio, 1); // 不超过1，即不放大
            
            // 如果图片超过限制，设置尺寸
            if (ratio < 1) {
                img.style.width = (width * ratio) + 'px';
                img.style.height = 'auto'; // 保持比例
            } else {
                // 如果图片在限制内，只设置最大宽度为100%
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            }
            
            resolve();
        };
        
            // 如果图片已经加载完成
            if (img.complete && img.naturalWidth > 0) {
                applySizeLimit();
            } else {
                // 等待图片加载完成
                img.onload = applySizeLimit;
                
                // 如果图片加载失败，也resolve
                img.onerror = function() {
                    resolve();
                };
            }
        });
    }
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
            
            // 限制图片大小但保持比例
            limitImageSize(img);
            
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
                        
                        // 限制图片大小但保持比例
                        limitImageSize(img);
                        
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
