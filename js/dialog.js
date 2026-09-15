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
let customDialogReturnFocus = null;

function activateCustomDialog() {
    customDialogReturnFocus = document.activeElement;
    customDialogOverlay.setAttribute('aria-hidden', 'false');
    customDialogOverlay.classList.add('active');
}

function deactivateCustomDialog() {
    customDialogOverlay.classList.remove('active');
    customDialogOverlay.setAttribute('aria-hidden', 'true');
    const target = customDialogReturnFocus;
    customDialogReturnFocus = null;
    if (target && target.isConnected && typeof target.focus === 'function') {
        target.focus();
    }
}

customDialogOverlay.addEventListener('keydown', event => {
    if (!customDialogOverlay.classList.contains('active')) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        const cancel = document.getElementById('customDialogCancel');
        (cancel || customDialogClose).click();
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(customDialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(element => !element.disabled && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});
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
            deactivateCustomDialog();
            resolve();
        };
        okBtn.onclick = closeDialog;
        closeBtn.onclick = closeDialog;
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog();
        };
        activateCustomDialog();
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
            deactivateCustomDialog();
            resolve(result);
        };
        okBtn.onclick = () => closeDialog(true);
        cancelBtn.onclick = () => closeDialog(false);
        closeBtn.onclick = () => closeDialog(false);
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog(false);
        };
        activateCustomDialog();
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
            deactivateCustomDialog();
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
        activateCustomDialog();
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
            deactivateCustomDialog();
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
        activateCustomDialog();
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
            deactivateCustomDialog();
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
        activateCustomDialog();
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
        const presetColors = ['#111827', '#475569', '#2563EB', '#0F766E', '#15803D', '#B45309', '#B91C1C', '#7E22CE', '#FDE68A', '#DBEAFE', '#DCFCE7', '#FCE7F3'];
        let recentColors = [];
        try {
            const saved = JSON.parse(localStorage.getItem('soraRecentColors') || '[]');
            if (Array.isArray(saved)) recentColors = saved.filter(value => /^#[0-9A-Fa-f]{6}$/.test(value)).slice(0, 8);
        } catch (_) {}
        customDialogTitle.textContent = title;
        customDialogInput.style.display = 'none';
        customDialogMessage.innerHTML = 
            '<div class="color-picker-layout">' +
            '<div class="color-picker-primary"><input type="color" id="colorPickerInput" value="' + escapeHtml(defaultValue) + '">' +
            '<div><label for="colorTextInput">颜色值</label><input type="text" id="colorTextInput" value="' + escapeHtml(defaultValue) + '" placeholder="#000000" maxlength="7"></div></div>' +
            '<div><strong>常用颜色</strong><div class="color-preset-grid">' + presetColors.map(color => '<button type="button" data-color="' + color + '" style="--swatch:' + color + '" aria-label="选择颜色 ' + color + '"></button>').join('') + '</div></div>' +
            (recentColors.length ? '<div><strong>最近使用</strong><div class="color-preset-grid">' + recentColors.map(color => '<button type="button" data-color="' + color + '" style="--swatch:' + color + '" aria-label="选择最近颜色 ' + color + '"></button>').join('') + '</div></div>' : '') +
            '<div id="colorContrastStatus" class="color-contrast-status" aria-live="polite"></div>' +
            '</div>';
        customDialogFooter.innerHTML = 
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        const colorPicker = document.getElementById('colorPickerInput');
        const colorText = document.getElementById('colorTextInput');
        const okBtn = document.getElementById('customDialogOk');
        const cancelBtn = document.getElementById('customDialogCancel');
        const closeBtn = customDialogClose;
        const contrastStatus = document.getElementById('colorContrastStatus');
        const luminance = color => {
            const parts = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
                .map(value => value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
            return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
        };
        const contrast = (first, second) => {
            const a = luminance(first);
            const b = luminance(second);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const updateContrast = color => {
            const white = contrast(color, '#FFFFFF');
            const black = contrast(color, '#000000');
            const best = white >= black ? '白色' : '黑色';
            const ratio = Math.max(white, black);
            contrastStatus.textContent = `推荐搭配${best}文字，对比度 ${ratio.toFixed(1)}:1${ratio >= 4.5 ? '，符合正文可读性要求' : '，仅建议用于大号文字或装饰'}`;
            contrastStatus.classList.toggle('is-warning', ratio < 4.5);
        };
        const setColor = color => {
            colorPicker.value = color;
            colorText.value = color.toUpperCase();
            updateContrast(color.toUpperCase());
        };
        colorPicker.addEventListener('input', () => {
            colorText.value = colorPicker.value.toUpperCase();
            updateContrast(colorPicker.value.toUpperCase());
        });
        colorText.addEventListener('input', () => {
            let value = colorText.value.trim();
            if (value && !value.startsWith('#')) {
                value = '#' + value;
            }
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                colorPicker.value = value;
                updateContrast(value.toUpperCase());
            }
        });
        customDialogMessage.querySelectorAll('[data-color]').forEach(button => {
            button.addEventListener('click', () => setColor(button.dataset.color));
        });
        function validateColor(value) {
            if (!value) return false;
            if (!value.startsWith('#')) {
                value = '#' + value;
            }
            return /^#[0-9A-Fa-f]{6}$/.test(value);
        }
        const closeDialog = (result) => {
            deactivateCustomDialog();
            customDialogMessage.innerHTML = '';
            customDialog.style.maxWidth = '';
            customDialog.style.width = '';
            resolve(result);
        };
        const handleOk = () => {
            let color = colorPicker.value.toUpperCase();
            if (validateColor(color)) {
                const nextRecent = [color, ...recentColors.filter(value => value !== color)].slice(0, 8);
                localStorage.setItem('soraRecentColors', JSON.stringify(nextRecent));
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
        activateCustomDialog();
        updateContrast(colorPicker.value.toUpperCase());
        setTimeout(() => colorText.focus(), 100);
    });
}
