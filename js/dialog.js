// ============================================
// 对话框模块 (dialog.js)
// 功能：自定义对话框系统（alert, confirm, prompt）
// ============================================

const customDialogOverlay = document.getElementById('customDialogOverlay');
const customDialog = document.getElementById('customDialog');
const customDialogTitle = document.getElementById('customDialogTitle');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogInput = document.getElementById('customDialogInput');
const customDialogFooter = document.getElementById('customDialogFooter');
const customDialogClose = document.getElementById('customDialogClose');

// 自定义 alert
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

// 自定义 confirm
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

// 自定义 prompt
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
        customDialogInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog(null);
            }
        };
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog(null);
        };
        
        customDialogOverlay.classList.add('active');
        setTimeout(() => customDialogInput.focus(), 100);
    });
}

