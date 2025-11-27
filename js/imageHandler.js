// ============================================
// 图片/视频处理模块 (imageHandler.js)
// 功能：图片/视频上传、查看、拖拽处理、编辑、删除
// 依赖：globals.js, preview.js, dialog.js
// 注意：图片大小限制配置和 limitImageSize 函数在 globals.js 中定义
// ============================================

// -------------------- 图片压缩配置 --------------------

/** 图片压缩配置 */
const IMAGE_COMPRESS_CONFIG = {
    enabled: true,              // 是否启用压缩
    quality: 0.85,              // 压缩质量 (0-1)，0.85 通常是质量和大小的良好平衡
    maxWidth: 1920,             // 最大宽度，超过则等比缩放
    maxHeight: 1080,            // 最大高度，超过则等比缩放
    preferWebP: true,           // 优先使用 WebP 格式（更小）
    minSizeToCompress: 100 * 1024  // 小于 100KB 的图片不压缩
};

/**
 * 压缩图片（不影响视觉质量）
 * @param {string} base64Data - 原始 base64 图片数据
 * @param {Object} options - 压缩选项
 * @returns {Promise<string>} - 压缩后的 base64 数据
 */
async function compressImage(base64Data, options = {}) {
    const config = { ...IMAGE_COMPRESS_CONFIG, ...options };
    
    // 如果禁用压缩，直接返回
    if (!config.enabled) {
        return base64Data;
    }
    
    // 计算原始大小
    const originalSize = base64Data.length * 0.75; // base64 大约是原始大小的 4/3
    
    // 小图片不压缩
    if (originalSize < config.minSizeToCompress) {
        return base64Data;
    }
    
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            // 计算缩放后的尺寸
            let { width, height } = img;
            
            if (width > config.maxWidth || height > config.maxHeight) {
                const ratio = Math.min(config.maxWidth / width, config.maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            // 创建 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // 尝试多种格式，选择最小的
            let bestResult = base64Data;
            let bestSize = base64Data.length;
            
            // 尝试 WebP（如果支持且启用）
            if (config.preferWebP) {
                const webpData = canvas.toDataURL('image/webp', config.quality);
                if (webpData.startsWith('data:image/webp') && webpData.length < bestSize) {
                    bestResult = webpData;
                    bestSize = webpData.length;
                }
            }
            
            // 尝试 JPEG（适合照片）
            if (base64Data.includes('image/jpeg') || base64Data.includes('image/jpg')) {
                const jpegData = canvas.toDataURL('image/jpeg', config.quality);
                if (jpegData.length < bestSize) {
                    bestResult = jpegData;
                    bestSize = jpegData.length;
                }
            }
            
            // 如果是 PNG 且有透明度，保持 PNG 格式
            if (base64Data.includes('image/png')) {
                // 检测是否有透明像素
                const imageData = ctx.getImageData(0, 0, width, height);
                let hasTransparency = false;
                for (let i = 3; i < imageData.data.length; i += 4) {
                    if (imageData.data[i] < 255) {
                        hasTransparency = true;
                        break;
                    }
                }
                
                if (hasTransparency) {
                    // 有透明度，用 PNG
                    const pngData = canvas.toDataURL('image/png');
                    if (pngData.length < bestSize) {
                        bestResult = pngData;
                        bestSize = pngData.length;
                    }
                }
            }
            
            // 计算压缩率
            const compressionRatio = ((base64Data.length - bestSize) / base64Data.length * 100).toFixed(1);
            if (bestSize < base64Data.length) {
                console.log(`图片压缩: ${(base64Data.length/1024).toFixed(1)}KB → ${(bestSize/1024).toFixed(1)}KB (节省 ${compressionRatio}%)`);
            }
            
            resolve(bestResult);
        };
        
        img.onerror = function() {
            // 压缩失败，返回原始数据
            resolve(base64Data);
        };
        
        img.src = base64Data;
    });
}

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
            const rawImageData = e.target.result;
            const imageName = file.name || 'image';
            
            const caption = await customPrompt('输入图片图注（可选，直接按确定跳过，取消则不上传）:', '');
            
            // 用户点击取消，中止上传
            if (caption === null) {
                imageFileInput.value = '';
                return;
            }
            
            // 压缩图片（不影响质量）
            const imageData = await compressImage(rawImageData);
            
            // 保存压缩后的图片到 IndexedDB
            const imageStorageId = await MediaStorage.saveImage(imageData);
            
            const img = document.createElement('img');
            img.src = imageData; // 显示时使用压缩后的数据
            img.setAttribute('data-media-storage-id', imageStorageId); // 存储引用 ID
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

// -------------------- 视频压缩配置 --------------------

/** 视频压缩配置 */
const VIDEO_COMPRESS_CONFIG = {
    enabled: true,                    // 是否启用压缩
    minSizeToCompress: 2 * 1024 * 1024,  // 小于 2MB 不压缩
    targetBitrate: '1M',              // 目标比特率
    crf: 28,                          // 恒定质量因子 (18-28 推荐，越大压缩率越高)
    preset: 'ultrafast',              // 编码速度预设 (ultrafast 最快，质量稍低)
    maxWidth: 1280,                   // 最大宽度
    maxHeight: 720,                   // 最大高度
    threads: 0,                       // 线程数 (0=自动检测最佳线程数)
};

/** FFmpeg 是否可用（首次加载失败后禁用） */
let ffmpegAvailable = true;

/** FFmpeg 实例 */
let ffmpegInstance = null;
let ffmpegLoading = false;
let ffmpegLoaded = false;

/**
 * 检查本地 FFmpeg 文件是否存在
 * @returns {Promise<boolean>}
 */
async function checkLocalFFmpeg() {
    try {
        const response = await fetch('lib/ffmpeg/ffmpeg/index.js', { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * 获取页面基础 URL
 * @returns {string}
 */
function getBaseURL() {
    const url = new URL(window.location.href);
    return url.origin + url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
}

/**
 * 加载 FFmpeg
 * @returns {Promise<Object>} FFmpeg 实例
 */
async function loadFFmpeg() {
    if (ffmpegLoaded && ffmpegInstance) {
        return ffmpegInstance;
    }
    
    if (ffmpegLoading) {
        // 等待加载完成
        while (ffmpegLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return ffmpegInstance;
    }
    
    ffmpegLoading = true;
    
    try {
        // 检查是否有本地 FFmpeg 文件
        const hasLocal = await checkLocalFFmpeg();
        const baseURL = getBaseURL();
        
        let FFmpeg, toBlobURL, fetchFile;
        let coreBaseURL;
        let workerURL;
        
        if (hasLocal) {
            // 使用本地文件
            console.log('使用本地 FFmpeg 文件...');
            const ffmpegModule = await import(`${baseURL}lib/ffmpeg/ffmpeg/index.js`);
            const utilModule = await import(`${baseURL}lib/ffmpeg/util/index.js`);
            FFmpeg = ffmpegModule.FFmpeg;
            toBlobURL = utilModule.toBlobURL;
            fetchFile = utilModule.fetchFile;
            coreBaseURL = `${baseURL}lib/ffmpeg/core`;
            workerURL = `${baseURL}lib/ffmpeg/ffmpeg/worker.js`;
        } else {
            // 使用 CDN
            console.log('使用 CDN 加载 FFmpeg...');
            const ffmpegModule = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
            const utilModule = await import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js');
            FFmpeg = ffmpegModule.FFmpeg;
            toBlobURL = utilModule.toBlobURL;
            fetchFile = utilModule.fetchFile;
            coreBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
            workerURL = null;
        }
        
        ffmpegInstance = new FFmpeg();
        
        // 构建加载配置
        const loadConfig = {
            coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        };
        
        // 本地模式需要指定 Worker URL（直接使用文件 URL，同源不需要转 Blob）
        if (workerURL) {
            loadConfig.classWorkerURL = workerURL;
        }
        
        // 加载 FFmpeg 核心
        await ffmpegInstance.load(loadConfig);
        
        // 保存 fetchFile 供后续使用
        ffmpegInstance._fetchFile = fetchFile;
        
        ffmpegLoaded = true;
        console.log('FFmpeg 加载完成' + (hasLocal ? ' (本地)' : ' (CDN)'));
        return ffmpegInstance;
    } catch (error) {
        console.error('FFmpeg 加载失败:', error);
        ffmpegAvailable = false;  // 标记 FFmpeg 不可用
        throw error;
    } finally {
        ffmpegLoading = false;
    }
}

/** 压缩预设选项（用于用户选择） */
const COMPRESS_PRESET_OPTIONS = [
    { value: 'ultrafast', label: '极速 - 最快速度，文件较大' },
    { value: 'superfast', label: '超快 - 速度很快，文件稍大' },
    { value: 'veryfast', label: '很快 - 速度较快，均衡选择' },
    { value: 'faster', label: '较快 - 速度适中，压缩较好' },
    { value: 'fast', label: '快速 - 速度稍慢，压缩更好' },
    { value: 'medium', label: '标准 - 默认速度，压缩效果好' },
];
/**
 * 压缩视频
 * @param {File} file - 视频文件
 * @param {Function} onProgress - 进度回调
 * @param {string} preset - 压缩预设 (ultrafast/superfast/veryfast/faster/fast/medium)
 * @returns {Promise<{data: string, compressed: boolean}>} 压缩后的 base64 数据
 */
async function compressVideo(file, onProgress = null, preset = null) {
    const config = { ...VIDEO_COMPRESS_CONFIG };
    // 如果传入了preset参数，覆盖默认配置
    if (preset) {
        config.preset = preset;
    }
    
    // 如果禁用压缩或文件较小，直接返回原始数据
    if (!config.enabled || file.size < config.minSizeToCompress) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ data: e.target.result, compressed: false });
            reader.readAsDataURL(file);
        });
    }
    
    try {
        // 显示加载提示
        if (onProgress) onProgress('正在加载视频压缩工具...');
        
        const ffmpeg = await loadFFmpeg();
        const fetchFile = ffmpeg._fetchFile;
        
        // 设置进度回调
        if (onProgress) {
            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.round(progress * 100);
                onProgress(`正在压缩视频... ${percent}%`);
            });
        }
        
        // 确定输入输出文件名
        const inputName = 'input' + getFileExtension(file.name);
        const outputName = 'output.mp4';
        
        // 写入输入文件
        if (onProgress) onProgress('正在读取视频文件...');
        await ffmpeg.writeFile(inputName, await fetchFile(file));
        
        // 构建 FFmpeg 命令
        // 使用 libx264 编码，恒定质量因子，极速预设
        const args = [
            '-i', inputName,
            '-threads', String(config.threads || 0),  // 多线程加速
            '-c:v', 'libx264',
            '-crf', String(config.crf),
            '-preset', config.preset,
            '-tune', 'fastdecode',       // 优化解码速度
            '-c:a', 'aac',
            '-b:a', '128k',
            // 限制分辨率
            '-vf', `scale='min(${config.maxWidth},iw)':'min(${config.maxHeight},ih)':force_original_aspect_ratio=decrease`,
            '-movflags', '+faststart',  // 优化网络播放
            outputName
        ];
        
        if (onProgress) onProgress('正在压缩视频...');
        await ffmpeg.exec(args);
        
        // 读取输出文件
        const data = await ffmpeg.readFile(outputName);
        
        // 转换为 base64
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const base64 = await blobToBase64(blob);
        
        // 清理临时文件
        try {
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);
        } catch (e) {
            // 忽略清理错误
        }
        
        // 计算压缩率
        const originalSize = file.size;
        const compressedSize = blob.size;
        const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
        
        console.log(`视频压缩: ${(originalSize/1024/1024).toFixed(1)}MB → ${(compressedSize/1024/1024).toFixed(1)}MB (节省 ${ratio}%)`);
        
        // 如果压缩后更大，返回原始数据
        if (compressedSize >= originalSize) {
            console.log('压缩后更大，使用原始视频');
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve({ data: e.target.result, compressed: false });
                reader.readAsDataURL(file);
            });
        }
        
        return { data: base64, compressed: true };
        
    } catch (error) {
        console.error('视频压缩失败:', error);
        // 压缩失败，返回原始数据
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ data: e.target.result, compressed: false });
            reader.readAsDataURL(file);
        });
    }
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（包含点号）
 */
function getFileExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return '.' + (ext || 'mp4');
}

/**
 * Blob 转 base64
 * @param {Blob} blob - Blob 对象
 * @returns {Promise<string>} base64 字符串
 */
function blobToBase64(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

/** 压缩进度对话框元素 */
let compressProgressDialog = null;
let compressProgressText = null;

/**
 * 显示压缩进度对话框
 * @param {string} message - 进度消息
 */
function showCompressProgress(message) {
    if (!compressProgressDialog) {
        // 创建进度对话框
        compressProgressDialog = document.createElement('div');
        compressProgressDialog.className = 'compress-progress-overlay';
        compressProgressDialog.innerHTML = `
            <div class="compress-progress-dialog">
                <div class="compress-progress-spinner"></div>
                <div class="compress-progress-text"></div>
                <div class="compress-progress-hint">首次加载压缩工具可能需要较长时间</div>
            </div>
        `;
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .compress-progress-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .compress-progress-dialog {
                background: var(--bg-color, #fff);
                border-radius: 12px;
                padding: 30px 40px;
                text-align: center;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                min-width: 300px;
            }
            .compress-progress-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid #e0e0e0;
                border-top-color: var(--primary-color, #4a90d9);
                border-radius: 50%;
                animation: compress-spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            @keyframes compress-spin {
                to { transform: rotate(360deg); }
            }
            .compress-progress-text {
                font-size: 16px;
                color: var(--text-color, #333);
                margin-bottom: 10px;
            }
            .compress-progress-hint {
                font-size: 12px;
                color: var(--text-color-secondary, #888);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(compressProgressDialog);
        compressProgressText = compressProgressDialog.querySelector('.compress-progress-text');
    }
    
    compressProgressText.textContent = message;
    compressProgressDialog.style.display = 'flex';
}

/**
 * 隐藏压缩进度对话框
 */
function hideCompressProgress() {
    if (compressProgressDialog) {
        compressProgressDialog.style.display = 'none';
    }
}

// -------------------- 视频文件选择处理 --------------------

if (videoFileInput) {
    videoFileInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('video/')) {
            customAlert('请选择视频文件');
            return;
        }
        
        // 在弹出对话框之前保存光标位置
        const selection = window.getSelection();
        let savedRange = null;
        if (selection.rangeCount > 0 && markdownPreview.contains(selection.anchorNode)) {
            savedRange = selection.getRangeAt(0).cloneRange();
        }
        
        const videoName = file.name || 'video';
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        
        // 询问是否压缩视频（仅当 FFmpeg 可用时）
        let shouldCompress = false;
        let selectedPreset = null;
        if (VIDEO_COMPRESS_CONFIG.enabled && ffmpegAvailable) {
            shouldCompress = await customConfirm(
                `视频大小: ${sizeMB}MB\n\n是否压缩视频？\n\n• 压缩可减小文件体积（通常节省 50-80%）\n• 首次压缩需要下载压缩工具（约 25MB）\n• 压缩过程可能需要几秒到几十秒\n\n<span style="color: #e74c3c; font-weight: bold;">⚠️ 不建议压缩：浏览器压缩速度较慢</span>`,
                '压缩',
                '不压缩',
                '确认',
                true  // 允许 HTML
            );
            
            // 如果选择压缩，让用户选择压缩速度
            if (shouldCompress) {
                selectedPreset = await customSelect(
                    '选择压缩速度（速度越快，文件越大）：',
                    COMPRESS_PRESET_OPTIONS,
                    'veryfast',  // 默认选择"很快"作为均衡选项
                    '压缩设置'
                );
                
                // 如果用户取消选择，不压缩
                if (selectedPreset === null) {
                    shouldCompress = false;
                }
            }
        }
        
        const caption = await customPrompt('输入视频标题（可选，直接按确定跳过，取消则不上传）:', '');
        
        // 用户点击取消，中止上传
        if (caption === null) {
            videoFileInput.value = '';
            return;
        }
        
        // 处理视频
        let videoData;
        
        if (shouldCompress) {
            try {
                showCompressProgress('正在准备压缩...');
                const result = await compressVideo(file, showCompressProgress, selectedPreset);
                videoData = result.data;
                hideCompressProgress();
                
                if (result.compressed) {
                    const newSizeMB = (videoData.length * 0.75 / 1024 / 1024).toFixed(1);
                    showToast(`视频压缩完成！${sizeMB}MB → ${newSizeMB}MB`, 'success', 3000);
                }
            } catch (err) {
                hideCompressProgress();
                console.error('视频压缩失败:', err);
                showToast('压缩失败，使用原始视频', 'warning', 2000);
                // 压缩失败，读取原始数据
                videoData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            }
        } else {
            // 不压缩，直接读取
            videoData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        }
        
        // 将视频保存到 IndexedDB
        let videoStorageId = null;
        if (typeof MediaStorage !== 'undefined') {
            try {
                videoStorageId = await MediaStorage.saveVideo(videoData);
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
            video.setAttribute('data-media-storage-id', videoStorageId);
        }
        
        // 与图片一致：有标题用 figure，无标题直接使用 video 元素
        let videoContainer;
        if (caption) {
            videoContainer = document.createElement('figure');
            videoContainer.appendChild(video);
            const figcaption = document.createElement('figcaption');
            figcaption.textContent = caption;
            videoContainer.appendChild(figcaption);
        } else {
            videoContainer = video;
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


// -------------------- 通用媒体编辑功能 --------------------

/** 当前右键点击的媒体元素（图片或视频） */
let currentContextMedia = null;
/** 当前右键点击的媒体类型 */
let currentContextMediaType = null; // 'image' | 'video'

/**
 * 为媒体元素添加或编辑图注/注释
 * @param {HTMLImageElement|HTMLVideoElement} media - 媒体元素
 * @param {string} type - 媒体类型 ('image' | 'video')
 */
async function editMediaCaption(media, type = 'image') {
    if (!media) return;
    
    const isVideo = type === 'video';
    const promptText = isVideo ? '编辑视频注释（留空可删除注释）:' : '编辑图片图注（留空可删除图注）:';
    
    const figure = media.closest('figure');
    let currentCaption = '';
    
    if (figure) {
        const figcaption = figure.querySelector('figcaption');
        if (figcaption) {
            currentCaption = figcaption.textContent || '';
        }
    }
    
    const newCaption = await customPrompt(promptText, currentCaption);
    
    if (newCaption === null) return;
    
    if (figure) {
        // 已有 figure 包装
        let figcaption = figure.querySelector('figcaption');
        if (newCaption) {
            // 添加或更新注释
            if (!figcaption) {
                figcaption = document.createElement('figcaption');
                figure.appendChild(figcaption);
            }
            figcaption.textContent = newCaption;
            media.title = newCaption;
        } else {
            // 移除注释，把媒体移出 figure
            if (figcaption) {
                figcaption.remove();
            }
            if (figure.parentNode) {
                figure.parentNode.insertBefore(media, figure);
                figure.remove();
            }
            media.title = '';
        }
    } else {
        // 没有 figure 容器
        if (newCaption && media.parentNode) {
            const newFigure = document.createElement('figure');
            media.parentNode.insertBefore(newFigure, media);
            newFigure.appendChild(media);
            const figcaption = document.createElement('figcaption');
            figcaption.textContent = newCaption;
            newFigure.appendChild(figcaption);
            media.title = newCaption;
        }
    }
    
    syncPreviewToTextarea();
}

/**
 * 删除媒体元素（连同 figure 一起删除）
 * @param {HTMLImageElement|HTMLVideoElement} media - 媒体元素
 */
function deleteMediaElement(media) {
    if (!media) return;
    
    const figure = media.closest('figure');
    if (figure) {
        figure.remove();
    } else {
        media.remove();
    }
    
    syncPreviewToTextarea();
}


// -------------------- 通用媒体右键菜单 --------------------

/**
 * 创建通用媒体右键菜单
 */
function createMediaContextMenu() {
    if (document.getElementById('mediaContextMenu')) {
        return document.getElementById('mediaContextMenu');
    }
    
    const menu = document.createElement('div');
    menu.id = 'mediaContextMenu';
    menu.className = 'media-context-menu';
    menu.innerHTML = `
        <div class="media-menu-item" data-action="caption">编辑图注</div>
        <div class="media-menu-item" data-action="delete">删除</div>
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
    
    menu.querySelectorAll('.media-menu-item').forEach(item => {
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
            hideMediaContextMenu();
            
            if (action === 'caption' && currentContextMedia) {
                await editMediaCaption(currentContextMedia, currentContextMediaType);
            } else if (action === 'delete' && currentContextMedia) {
                const confirmText = currentContextMediaType === 'video' ? '确定要删除这个视频吗？' : '确定要删除这张图片吗？';
                const confirmed = await customConfirm(confirmText);
                if (confirmed) {
                    deleteMediaElement(currentContextMedia);
                }
            }
            currentContextMedia = null;
            currentContextMediaType = null;
        });
    });
    
    document.body.appendChild(menu);
    
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) {
            hideMediaContextMenu();
        }
    });
    
    return menu;
}

/**
 * 显示媒体右键菜单
 * @param {MouseEvent} e - 鼠标事件
 * @param {HTMLImageElement|HTMLVideoElement} media - 媒体元素
 * @param {string} type - 媒体类型 ('image' | 'video')
 */
function showMediaContextMenu(e, media, type) {
    const menu = createMediaContextMenu();
    currentContextMedia = media;
    currentContextMediaType = type;
    
    // 更新菜单文本
    const captionItem = menu.querySelector('[data-action="caption"]');
    const deleteItem = menu.querySelector('[data-action="delete"]');
    if (type === 'video') {
        captionItem.textContent = '编辑注释';
        deleteItem.textContent = '删除视频';
    } else {
        captionItem.textContent = '编辑图注';
        deleteItem.textContent = '删除图片';
    }
    
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
 * 隐藏媒体右键菜单
 */
function hideMediaContextMenu() {
    const menu = document.getElementById('mediaContextMenu');
    if (menu) {
        menu.style.display = 'none';
    }
}


/**
 * 检查选中范围是否包含媒体元素（图片或视频）
 * @param {Range} range - 选中范围
 * @param {string} key - 按下的键 ('Backspace' 或 'Delete')
 * @returns {{element: HTMLElement|null, type: string|null}} - 选中的媒体元素和类型
 */
function getSelectedMedia(range, key) {
    if (!range) return { element: null, type: null };
    
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    
    // 检查选中内容是否包含图片或视频
    const contents = range.cloneContents();
    const img = contents.querySelector('img');
    const video = contents.querySelector('video');
    
    if (img || video) {
        const ancestor = range.commonAncestorContainer;
        const container = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode : ancestor;
        
        // 检查图片
        if (img) {
            const originalImg = container.querySelector ? container.querySelector('img') : null;
            if (originalImg && range.intersectsNode(originalImg)) {
                return { element: originalImg, type: 'image' };
            }
            const allImgs = markdownPreview.querySelectorAll('img');
            for (const image of allImgs) {
                if (range.intersectsNode(image)) {
                    return { element: image, type: 'image' };
                }
            }
        }
        
        // 检查视频
        if (video) {
            const originalVideo = container.querySelector ? container.querySelector('video') : null;
            if (originalVideo && range.intersectsNode(originalVideo)) {
                return { element: originalVideo, type: 'video' };
            }
            const allVideos = markdownPreview.querySelectorAll('video');
            for (const vid of allVideos) {
                if (range.intersectsNode(vid)) {
                    return { element: vid, type: 'video' };
                }
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
        const figureVideo = figure.querySelector('video');
        const media = figureImg || figureVideo;
        const mediaType = figureImg ? 'image' : 'video';
        
        if (media) {
            const figureRange = document.createRange();
            figureRange.selectNode(figure);
            
            if (range.compareBoundaryPoints(Range.START_TO_START, figureRange) <= 0 &&
                range.compareBoundaryPoints(Range.END_TO_END, figureRange) >= 0) {
                return { element: media, type: mediaType };
            }
            
            if (range.intersectsNode(media)) {
                return { element: media, type: mediaType };
            }
        }
    }
    
    // 检查选中范围的起点或终点是否直接在媒体元素上
    if (startContainer.nodeType === Node.ELEMENT_NODE) {
        const childAtOffset = startContainer.childNodes[startOffset];
        if (childAtOffset) {
            if (childAtOffset.tagName === 'IMG') {
                return { element: childAtOffset, type: 'image' };
            }
            if (childAtOffset.tagName === 'VIDEO') {
                return { element: childAtOffset, type: 'video' };
            }
            if (childAtOffset.tagName === 'FIGURE') {
                const figImg = childAtOffset.querySelector('img');
                if (figImg) return { element: figImg, type: 'image' };
                const figVideo = childAtOffset.querySelector('video');
                if (figVideo) return { element: figVideo, type: 'video' };
            }
        }
        
        if (key === 'Backspace' && startOffset > 0) {
            const prevChild = startContainer.childNodes[startOffset - 1];
            if (prevChild) {
                if (prevChild.tagName === 'IMG') return { element: prevChild, type: 'image' };
                if (prevChild.tagName === 'VIDEO') return { element: prevChild, type: 'video' };
                if (prevChild.tagName === 'FIGURE') {
                    const figImg = prevChild.querySelector('img');
                    if (figImg) return { element: figImg, type: 'image' };
                    const figVideo = prevChild.querySelector('video');
                    if (figVideo) return { element: figVideo, type: 'video' };
                }
                if (prevChild.nodeType === Node.ELEMENT_NODE && prevChild.querySelector) {
                    const innerImg = prevChild.querySelector('img');
                    if (innerImg) return { element: innerImg, type: 'image' };
                    const innerVideo = prevChild.querySelector('video');
                    if (innerVideo) return { element: innerVideo, type: 'video' };
                }
            }
        }
        
        if (key === 'Delete' && startOffset < startContainer.childNodes.length) {
            const nextChild = startContainer.childNodes[startOffset];
            if (nextChild) {
                if (nextChild.tagName === 'IMG') return { element: nextChild, type: 'image' };
                if (nextChild.tagName === 'VIDEO') return { element: nextChild, type: 'video' };
                if (nextChild.tagName === 'FIGURE') {
                    const figImg = nextChild.querySelector('img');
                    if (figImg) return { element: figImg, type: 'image' };
                    const figVideo = nextChild.querySelector('video');
                    if (figVideo) return { element: figVideo, type: 'video' };
                }
            }
        }
    }
    
    // 检查文本节点情况下，光标前后是否有媒体元素
    if (startContainer.nodeType === Node.TEXT_NODE) {
        if (key === 'Backspace' && startOffset === 0) {
            let prevSibling = startContainer.previousSibling;
            while (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && !prevSibling.textContent.trim()) {
                prevSibling = prevSibling.previousSibling;
            }
            if (prevSibling) {
                if (prevSibling.tagName === 'IMG') return { element: prevSibling, type: 'image' };
                if (prevSibling.tagName === 'VIDEO') return { element: prevSibling, type: 'video' };
                if (prevSibling.tagName === 'FIGURE') {
                    const figImg = prevSibling.querySelector('img');
                    if (figImg) return { element: figImg, type: 'image' };
                    const figVideo = prevSibling.querySelector('video');
                    if (figVideo) return { element: figVideo, type: 'video' };
                }
            }
        }
        
        if (key === 'Delete' && startOffset === startContainer.textContent.length) {
            let nextSibling = startContainer.nextSibling;
            while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.trim()) {
                nextSibling = nextSibling.nextSibling;
            }
            if (nextSibling) {
                if (nextSibling.tagName === 'IMG') return { element: nextSibling, type: 'image' };
                if (nextSibling.tagName === 'VIDEO') return { element: nextSibling, type: 'video' };
                if (nextSibling.tagName === 'FIGURE') {
                    const figImg = nextSibling.querySelector('img');
                    if (figImg) return { element: figImg, type: 'image' };
                    const figVideo = nextSibling.querySelector('video');
                    if (figVideo) return { element: figVideo, type: 'video' };
                }
            }
        }
    }
    
    return { element: null, type: null };
}


/**
 * 清理孤立的 figcaption 和空的 figure 元素
 * 检查图片和视频
 */
function cleanupOrphanedFigcaptions() {
    if (!markdownPreview) return;
    
    const figures = markdownPreview.querySelectorAll('figure');
    figures.forEach(figure => {
        // 检查 figure 中是否包含图片或视频
        const img = figure.querySelector('img');
        const video = figure.querySelector('video');
        if (!img && !video) {
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
    
    // 统一的媒体右键菜单（图片和视频）
    markdownPreview.addEventListener('contextmenu', (e) => {
        const img = e.target.closest('img');
        if (img) {
            e.preventDefault();
            e.stopPropagation();
            showMediaContextMenu(e, img, 'image');
            return;
        }
        
        const video = e.target.closest('video');
        if (video) {
            e.preventDefault();
            e.stopPropagation();
            showMediaContextMenu(e, video, 'video');
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
                        const rawImageData = e.target.result;
                        const imageName = file.name || '图片';
                        
                        const caption = await customPrompt('输入图片图注（可选，直接按确定跳过，取消则不上传）:', '');
                        
                        // 用户点击取消，中止上传
                        if (caption === null) {
                            return;
                        }
                        
                        // 压缩图片（不影响质量）
                        const imageData = await compressImage(rawImageData);
                        
                        // 保存压缩后的图片到 IndexedDB
                        const imageStorageId = await MediaStorage.saveImage(imageData);
                        
                        const img = document.createElement('img');
                        img.src = imageData; // 显示时使用压缩后的数据
                        img.setAttribute('data-media-storage-id', imageStorageId); // 存储引用 ID
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
                    const videoName = file.name || '视频';
                    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
                    
                    // 询问是否压缩视频（仅当 FFmpeg 可用时）
                    let shouldCompress = false;
                    let selectedPreset = null;
                    if (VIDEO_COMPRESS_CONFIG.enabled && ffmpegAvailable) {
                        shouldCompress = await customConfirm(
                            `视频大小: ${sizeMB}MB\n\n是否压缩视频？\n\n• 压缩可减小文件体积（通常节省 50-80%）\n• 首次压缩需要下载压缩工具（约 25MB）\n• 压缩过程可能需要几秒到几十秒\n\n<span style="color: #e74c3c; font-weight: bold;">⚠️ 不建议压缩：浏览器压缩速度较慢</span>`,
                            '压缩',
                            '不压缩',
                            '确认',
                            true  // 允许 HTML
                        );
                        
                        // 如果选择压缩，让用户选择压缩速度
                        if (shouldCompress) {
                            selectedPreset = await customSelect(
                                '选择压缩速度（速度越快，文件越大）：',
                                COMPRESS_PRESET_OPTIONS,
                                'veryfast',  // 默认选择"很快"作为均衡选项
                                '压缩设置'
                            );
                            
                            // 如果用户取消选择，不压缩
                            if (selectedPreset === null) {
                                shouldCompress = false;
                            }
                        }
                    }
                    
                    const caption = await customPrompt('输入视频标题（可选，直接按确定跳过，取消则不上传）:', '');
                    
                    // 用户点击取消，中止上传
                    if (caption === null) {
                        continue;
                    }
                    
                    // 处理视频
                    let videoData;
                    
                    if (shouldCompress) {
                        try {
                            showCompressProgress('正在准备压缩...');
                            const result = await compressVideo(file, showCompressProgress, selectedPreset);
                            videoData = result.data;
                            hideCompressProgress();
                            
                            if (result.compressed) {
                                const newSizeMB = (videoData.length * 0.75 / 1024 / 1024).toFixed(1);
                                showToast(`视频压缩完成！${sizeMB}MB → ${newSizeMB}MB`, 'success', 3000);
                            }
                        } catch (err) {
                            hideCompressProgress();
                            console.error('视频压缩失败:', err);
                            showToast('压缩失败，使用原始视频', 'warning', 2000);
                            // 压缩失败，读取原始数据
                            videoData = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onload = (ev) => resolve(ev.target.result);
                                reader.readAsDataURL(file);
                            });
                        }
                    } else {
                        // 不压缩，直接读取
                        videoData = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (ev) => resolve(ev.target.result);
                            reader.readAsDataURL(file);
                        });
                    }
                    
                    // 将视频保存到 IndexedDB
                    let videoStorageId = null;
                    if (typeof MediaStorage !== 'undefined') {
                        try {
                            videoStorageId = await MediaStorage.saveVideo(videoData);
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
                        video.setAttribute('data-media-storage-id', videoStorageId);
                    }
                    
                    // 与图片一致：有标题用 figure，无标题直接使用 video 元素
                    let videoContainer;
                    if (caption) {
                        videoContainer = document.createElement('figure');
                        videoContainer.appendChild(video);
                        const figcaption = document.createElement('figcaption');
                        figcaption.textContent = caption;
                        videoContainer.appendChild(figcaption);
                    } else {
                        videoContainer = video;
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
                }
            }
        }
    });
}
