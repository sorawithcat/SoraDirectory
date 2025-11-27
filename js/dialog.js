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
        // 支持换行：将 \n 转换为 <br>，同时转义 HTML 特殊字符
        const safeMessage = message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
        customDialogMessage.innerHTML = safeMessage;
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
 * @param {string} okText - 确定按钮文本，默认为"确定"
 * @param {string} cancelText - 取消按钮文本，默认为"取消"
 * @param {string} title - 对话框标题，默认为"确认"
 * @param {boolean} allowHtml - 是否允许 HTML 内容，默认为 false
 * @returns {Promise<boolean>} - 用户点击确定返回 true，取消返回 false
 */
function customConfirm(message, okText = '确定', cancelText = '取消', title = '确认', allowHtml = false) {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        let displayMessage;
        if (allowHtml) {
            // 允许 HTML，仅转换换行
            displayMessage = message.replace(/\n/g, '<br>');
        } else {
            // 转义 HTML 特殊字符
            displayMessage = message
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }
        customDialogMessage.innerHTML = displayMessage;
        customDialogInput.style.display = 'none';
        customDialogFooter.innerHTML = 
            `<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">${cancelText}</button>` +
            `<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">${okText}</button>`;
        
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

/**
 * 自定义下拉选择对话框
 * @param {string} message - 显示的提示消息
 * @param {Array} options - 选项数组，格式 [{value: '', label: ''}, ...]
 * @param {string} defaultValue - 默认选中的值
 * @param {string} title - 对话框标题，默认为"选择"
 * @returns {Promise<string|null>} - 用户点击确定返回选中值，取消返回 null
 */
function customSelect(message, options, defaultValue = '', title = '选择') {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogMessage.textContent = message;
        customDialogInput.style.display = 'none';
        
        // 创建下拉选择框
        let selectHtml = '<select class="custom-dialog-select" id="customDialogSelect">';
        options.forEach(opt => {
            const selected = opt.value === defaultValue ? ' selected' : '';
            selectHtml += `<option value="${opt.value}"${selected}>${opt.label}</option>`;
        });
        selectHtml += '</select>';
        
        customDialogMessage.innerHTML = message + '<br><br>' + selectHtml;
        
        customDialogFooter.innerHTML = 
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        
        const selectEl = document.getElementById('customDialogSelect');
        const okBtn = document.getElementById('customDialogOk');
        const cancelBtn = document.getElementById('customDialogCancel');
        const closeBtn = customDialogClose;
        
        const closeDialog = (result) => {
            customDialogOverlay.classList.remove('active');
            customDialogMessage.innerHTML = '';
            resolve(result);
        };
        
        const handleOk = () => {
            closeDialog(selectEl.value);
        };
        
        okBtn.onclick = handleOk;
        cancelBtn.onclick = () => closeDialog(null);
        closeBtn.onclick = () => closeDialog(null);
        
        // 键盘事件
        selectEl.onkeydown = (e) => {
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
        setTimeout(() => selectEl.focus(), 100);
    });
}

/**
 * 代码编辑对话框
 * @param {string} code - 初始代码内容
 * @param {string} language - 当前语言
 * @param {Array} langOptions - 语言选项数组
 * @param {string} title - 对话框标题
 * @returns {Promise<{code: string, language: string}|null>} - 返回代码和语言，取消返回 null
 */
function codeEditDialog(code = '', language = 'javascript', langOptions = [], title = '编辑代码') {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogInput.style.display = 'none';
        
        // 创建代码编辑界面
        let selectHtml = '<select class="custom-dialog-select" id="codeDialogLang" style="margin-bottom: 10px;">';
        langOptions.forEach(opt => {
            const selected = opt.value === language ? ' selected' : '';
            selectHtml += `<option value="${opt.value}"${selected}>${opt.label}</option>`;
        });
        selectHtml += '</select>';
        
        customDialogMessage.innerHTML = 
            '<label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px;">编程语言</label>' +
            selectHtml +
            '<label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px; margin-top: 12px;">代码内容</label>' +
            '<textarea id="codeDialogTextarea" class="code-dialog-textarea" spellcheck="false">' + 
            code.replace(/</g, '&lt;').replace(/>/g, '&gt;') + 
            '</textarea>';
        
        customDialogFooter.innerHTML = 
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-danger" id="customDialogDelete" style="margin-right: auto;">删除代码块</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        
        const textarea = document.getElementById('codeDialogTextarea');
        const langSelect = document.getElementById('codeDialogLang');
        const okBtn = document.getElementById('customDialogOk');
        const cancelBtn = document.getElementById('customDialogCancel');
        const deleteBtn = document.getElementById('customDialogDelete');
        const closeBtn = customDialogClose;
        
        // 如果是新建，隐藏删除按钮
        if (!code) {
            deleteBtn.style.display = 'none';
        }
        
        const closeDialog = (result) => {
            customDialogOverlay.classList.remove('active');
            customDialogMessage.innerHTML = '';
            resolve(result);
        };
        
        const handleOk = () => {
            closeDialog({
                code: textarea.value,
                language: langSelect.value
            });
        };
        
        okBtn.onclick = handleOk;
        cancelBtn.onclick = () => closeDialog(null);
        closeBtn.onclick = () => closeDialog(null);
        deleteBtn.onclick = () => closeDialog({ delete: true });
        
        // Tab 键在 textarea 中插入制表符
        textarea.onkeydown = (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog(null);
            }
        };
        
        // 点击遮罩层关闭
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog(null);
        };
        
        // 调整对话框宽度
        customDialog.style.maxWidth = '700px';
        customDialog.style.width = '90%';
        
        customDialogOverlay.classList.add('active');
        setTimeout(() => textarea.focus(), 100);
    });
}
