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
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}
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
            displayMessage = message.replace(/\n/g, '<br>');
        } else {
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
        selectEl.onkeydown = (e) => {
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
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog(null);
        };
        customDialog.style.maxWidth = '700px';
        customDialog.style.width = '90%';
        customDialogOverlay.classList.add('active');
        setTimeout(() => textarea.focus(), 100);
    });
}
/**
 * 颜色选择对话框
 * @param {string} defaultValue - 默认颜色值（十六进制，如 #000000）
 * @param {string} title - 对话框标题，默认为"选择颜色"
 * @returns {Promise<string|null>} - 用户点击确定返回颜色值（十六进制），取消返回 null
 */
function colorPickerDialog(defaultValue = '#000000', title = '选择颜色') {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogInput.style.display = 'none';
        customDialogMessage.innerHTML = 
            '<div style="text-align: center; padding: 20px 0;">' +
            '<input type="color" id="colorPickerInput" value="' + escapeHtml(defaultValue) + '" style="width: 200px; height: 200px; border: 2px solid #ddd; border-radius: 4px; cursor: pointer;">' +
            '<br><br>' +
            '<label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px;">颜色值（十六进制）</label>' +
            '<input type="text" id="colorTextInput" value="' + escapeHtml(defaultValue) + '" style="width: 150px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-family: monospace; font-size: 14px;" placeholder="#000000" maxlength="7">' +
            '</div>';
        customDialogFooter.innerHTML = 
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        const colorPicker = document.getElementById('colorPickerInput');
        const colorText = document.getElementById('colorTextInput');
        const okBtn = document.getElementById('customDialogOk');
        const cancelBtn = document.getElementById('customDialogCancel');
        const closeBtn = customDialogClose;
        colorPicker.addEventListener('input', () => {
            colorText.value = colorPicker.value.toUpperCase();
        });
        colorText.addEventListener('input', () => {
            let value = colorText.value.trim();
            if (value && !value.startsWith('#')) {
                value = '#' + value;
            }
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                colorPicker.value = value;
            }
        });
        function validateColor(value) {
            if (!value) return false;
            if (!value.startsWith('#')) {
                value = '#' + value;
            }
            return /^#[0-9A-Fa-f]{6}$/.test(value);
        }
        const closeDialog = (result) => {
            customDialogOverlay.classList.remove('active');
            customDialogMessage.innerHTML = '';
            customDialog.style.maxWidth = '';
            customDialog.style.width = '';
            resolve(result);
        };
        const handleOk = () => {
            let color = colorPicker.value.toUpperCase();
            if (validateColor(color)) {
                closeDialog(color);
            } else {
                showToast('请输入有效的颜色值（如 #FF0000）', 'error', 2000);
            }
        };
        okBtn.onclick = handleOk;
        cancelBtn.onclick = () => closeDialog(null);
        closeBtn.onclick = () => closeDialog(null);
        colorText.onkeydown = (e) => {
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
        customDialog.style.maxWidth = '400px';
        customDialog.style.width = '90%';
        customDialogOverlay.classList.add('active');
        setTimeout(() => colorText.focus(), 100);
    });
}