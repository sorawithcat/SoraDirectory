// ============================================
// 对话框模块 (dialog.js)
// 功能：自定义对话框系统，替代原生 alert/confirm/prompt
// 依赖：无
// ============================================

// Toast 容器引用
const toastContainer = document.getElementById('toastContainer');

/**
 * 显示 Toast 悬浮提示（自动消失）
 * @param {string} message - 提示消息
 * @param {string} type - 提示类型：'info'|'success'|'warning'|'error'，默认 'info'
 * @param {number} duration - 显示时长（毫秒），默认 3000
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // 触发动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // 自动消失
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        // 动画结束后移除元素
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// DOM 元素引用
const customDialogOverlay = document.getElementById('customDialogOverlay');
const customDialog = document.getElementById('customDialog');
const customDialogTitle = document.getElementById('customDialogTitle');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogInput = document.getElementById('customDialogInput');
const customDialogFooter = document.getElementById('customDialogFooter');
const customDialogClose = document.getElementById('customDialogClose');

/**
 * 自定义 alert 对话框
 * @param {string} message - 显示的消息内容
 * @param {string} title - 对话框标题，默认为"提示"
 * @returns {Promise<void>} - 用户点击确定后 resolve
 */
function customAlert(message, title = '提示') {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogMessage.textContent = message;
        customDialogInput.style.display = 'none';
        customDialogFooter.innerHTML = '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        
        const okBtn = document.getElementById('customDialogOk');
        const closeBtn = customDialogClose;
        
        const closeDialog = () => {
            customDialogOverlay.classList.remove('active');
            resolve();
        };
        
        okBtn.onclick = closeDialog;
        closeBtn.onclick = closeDialog;
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog();
        };
        
        customDialogOverlay.classList.add('active');
        okBtn.focus();
    });
}

/**
 * 自定义 confirm 对话框
 * @param {string} message - 显示的确认消息
 * @param {string} title - 对话框标题，默认为"确认"
 * @returns {Promise<boolean>} - 用户点击确定返回 true，取消返回 false
 */
function customConfirm(message, title = '确认') {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogMessage.textContent = message;
        customDialogInput.style.display = 'none';
        customDialogFooter.innerHTML = 
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        
        const okBtn = document.getElementById('customDialogOk');
        const cancelBtn = document.getElementById('customDialogCancel');
        const closeBtn = customDialogClose;
        
        const closeDialog = (result) => {
            customDialogOverlay.classList.remove('active');
            resolve(result);
        };
        
        okBtn.onclick = () => closeDialog(true);
        cancelBtn.onclick = () => closeDialog(false);
        closeBtn.onclick = () => closeDialog(false);
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog(false);
        };
        
        customDialogOverlay.classList.add('active');
        okBtn.focus();
    });
}

/**
 * 自定义 prompt 输入对话框
 * @param {string} message - 显示的提示消息
 * @param {string} defaultValue - 输入框的默认值
 * @param {string} title - 对话框标题，默认为"输入"
 * @returns {Promise<string|null>} - 用户点击确定返回输入值，取消返回 null
 */
function customPrompt(message, defaultValue = '', title = '输入') {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogMessage.textContent = message;
        customDialogInput.style.display = 'block';
        customDialogInput.value = defaultValue;
        customDialogInput.placeholder = defaultValue;
        customDialogFooter.innerHTML = 
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        
        const okBtn = document.getElementById('customDialogOk');
        const cancelBtn = document.getElementById('customDialogCancel');
        const closeBtn = customDialogClose;
        
        const closeDialog = (result) => {
            customDialogOverlay.classList.remove('active');
            resolve(result);
        };
        
        const handleOk = () => {
            closeDialog(customDialogInput.value);
        };
        
        okBtn.onclick = handleOk;
        cancelBtn.onclick = () => closeDialog(null);
        closeBtn.onclick = () => closeDialog(null);
        
        // 键盘事件：回车确认，ESC取消
        customDialogInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog(null);
            }
        };
        
        // 点击遮罩层关闭
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog(null);
        };
        
        customDialogOverlay.classList.add('active');
        setTimeout(() => customDialogInput.focus(), 100);
    });
}
