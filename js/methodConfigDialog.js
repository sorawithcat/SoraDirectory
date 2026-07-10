
function showMethodConfigDialog(existing, parentStack) {
    return new Promise((resolve) => {
        const cfg = existing && typeof existing === 'object' ? JSON.parse(JSON.stringify(existing)) : {};
        ensureMethodId(cfg);
        
        // 初始化父级栈
        const currentParentStack = parentStack || [];
        
        customDialogTitle.textContent = '配置方法';
        customDialogInput.style.display = 'none';
        
        const formHtml = `
            <div class="method-form">
                <div class="form-group">
                    <label>触发方式：</label>
                    <select id="methodTrigger" class="form-control">
                        <option value="open">打开网页时</option>
                        <option value="enter_dir">选中目录时</option>
                        <option value="click">点击时</option>
                        <option value="hover">悬浮时</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>前锚点（必填）：</label>
                    <input type="text" id="methodFrontAnchor" class="form-control" placeholder="例：#锚点名 或 dir:目录ID#锚点" />
                    <small>支持: #锚点、dir:目录ID#锚点、name:目录名#锚点</small>
                </div>
                <div class="form-group">
                    <label>后锚点（可为空）：</label>
                    <input type="text" id="methodBackAnchor" class="form-control" placeholder="空表示目录级操作" />
                    <small>为空时是目录级操作，不为空时是范围级操作</small>
                </div>
                <div class="form-group">
                    <label>方法类型：</label>
                    <select id="methodType" class="form-control">
                        <option value="隐藏">隐藏</option>
                        <option value="隐藏（初始不隐藏）">隐藏（初始不隐藏）</option>
                        <option value="显示">显示</option>
                        <option value="切换">切换</option>
                        <option value="更换内容">更换内容</option>
                        <option value="添加格式">添加格式</option>
                        <option value="目录右键动作">目录右键动作</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="methodOnce" />
                        只执行一次
                    </label>
                </div>
                
                <!-- 更换内容特定字段 -->
                <div id="replaceFields" style="display:none;">
                    <div class="form-group" id="renameField" style="display:none;">
                        <label>新目录名：</label>
                        <input type="text" id="methodRenameTo" class="form-control" />
                    </div>
                    <div id="replaceContentFields" style="display:none;">
                        <div class="form-group">
                            <label>替换来源：</label>
                            <select id="methodReplaceSourceType" class="form-control">
                                <option value="anchor">用锚点范围/目录内容替换</option>
                                <option value="text">直接输入替换文本</option>
                            </select>
                        </div>
                        <div id="replaceAnchorFields">
                            <div class="form-group">
                                <label>替换来源前锚点：</label>
                                <input type="text" id="methodReplaceFromFrontAnchor" class="form-control" placeholder="dir:目录ID#锚点" />
                            </div>
                            <div class="form-group">
                                <label>替换来源后锚点：</label>
                                <input type="text" id="methodReplaceFromBackAnchor" class="form-control" placeholder="可为空" />
                            </div>
                        </div>
                        <div id="replaceTextField" style="display:none;">
                            <div class="form-group">
                                <label>替换文本：</label>
                                <textarea id="methodReplaceText" class="form-control" rows="3"></textarea>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 添加格式特定字段 -->
                <div id="formatFields" style="display:none;">
                    <div class="form-group">
                        <label>格式类型：</label>
                        <select id="methodFormatCommand" class="form-control">
                            <option value="bold">粗体</option>
                            <option value="italic">斜体</option>
                            <option value="underline">下划线</option>
                            <option value="strikethrough">删除线</option>
                            <option value="highlight">高亮</option>
                            <option value="spoiler">防剧透</option>
                            <option value="superscript">上标</option>
                            <option value="subscript">下标</option>
                            <option value="code">行内代码</option>
                            <option value="color">文字颜色</option>
                            <option value="background-color">背景颜色</option>
                            <option value="link">链接</option>
                            <option value="method">方法（嵌套）</option>
                        </select>
                    </div>
                    <div class="form-group" id="formatValueField" style="display:none;">
                        <label id="formatValueLabel">参数值：</label>
                        <input type="text" id="methodFormatValue" class="form-control" />
                    </div>
                    <div id="formatMethodField" style="display:none;">
                        <div class="form-group">
                            <label>嵌套方法：</label>
                            <div id="nestedMethodsList" style="margin-bottom: 10px;">
                                <!-- 嵌套方法列表将显示在这里 -->
                            </div>
                            <button type="button" id="addNestedMethodBtn" class="custom-dialog-btn custom-dialog-btn-secondary" style="width: 100%;">添加嵌套方法</button>
                        </div>
                        <div class="form-group">
                            <label>方法显示文本：</label>
                            <input type="text" id="methodFormatFallbackText" class="form-control" placeholder="方法" />
                        </div>
                    </div>
                </div>
                
                <!-- 目录右键动作特定字段 -->
                <div id="dirActionFields" style="display:none;">
                    <div class="form-group">
                        <label>目录动作：</label>
                        <select id="methodDirAction" class="form-control">
                            <option value="复制目录ID">复制目录ID</option>
                            <option value="删除目录">删除目录</option>
                            <option value="复制目录（含子目录）">复制目录（含子目录）</option>
                            <option value="复制目录（不含子目录）">复制目录（不含子目录）</option>
                            <option value="粘贴目录">粘贴目录</option>
                            <option value="快速复制目录（含子目录）">快速复制目录（含子目录）</option>
                            <option value="快速复制目录（不含子目录）">快速复制目录（不含子目录）</option>
                            <option value="展开此目录">展开此目录</option>
                            <option value="收起此目录">收起此目录</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        
        customDialogMessage.innerHTML = formHtml;
        customDialogFooter.innerHTML = 
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">确定</button>';
        
        // 获取表单元素
        const triggerSelect = document.getElementById('methodTrigger');
        const frontAnchorInput = document.getElementById('methodFrontAnchor');
        const backAnchorInput = document.getElementById('methodBackAnchor');
        const methodTypeSelect = document.getElementById('methodType');
        const onceCheckbox = document.getElementById('methodOnce');
        
        const replaceFields = document.getElementById('replaceFields');
        const renameField = document.getElementById('renameField');
        const replaceContentFields = document.getElementById('replaceContentFields');
        const renameToInput = document.getElementById('methodRenameTo');
        const replaceSourceTypeSelect = document.getElementById('methodReplaceSourceType');
        const replaceAnchorFields = document.getElementById('replaceAnchorFields');
        const replaceTextField = document.getElementById('replaceTextField');
        const replaceFromFrontAnchorInput = document.getElementById('methodReplaceFromFrontAnchor');
        const replaceFromBackAnchorInput = document.getElementById('methodReplaceFromBackAnchor');
        const replaceTextTextarea = document.getElementById('methodReplaceText');
        
        const formatFields = document.getElementById('formatFields');
        const formatCommandSelect = document.getElementById('methodFormatCommand');
        const formatValueField = document.getElementById('formatValueField');
        const formatValueLabel = document.getElementById('formatValueLabel');
        const formatValueInput = document.getElementById('methodFormatValue');
        const formatMethodField = document.getElementById('formatMethodField');
        const formatFallbackTextInput = document.getElementById('methodFormatFallbackText');
        
        const dirActionFields = document.getElementById('dirActionFields');
        const dirActionSelect = document.getElementById('methodDirAction');
        
        // 填充现有值
        triggerSelect.value = cfg.trigger || 'click';
        frontAnchorInput.value = cfg.frontAnchor || '';
        backAnchorInput.value = cfg.backAnchor || '';
        methodTypeSelect.value = cfg.methodType || '隐藏';
        onceCheckbox.checked = !!cfg.once;
        renameToInput.value = cfg.renameTo || '';
        replaceSourceTypeSelect.value = cfg.replaceSourceType || 'anchor';
        replaceFromFrontAnchorInput.value = cfg.replaceFromFrontAnchor || '';
        replaceFromBackAnchorInput.value = cfg.replaceFromBackAnchor || '';
        replaceTextTextarea.value = cfg.replaceText || '';
        formatCommandSelect.value = cfg.formatCommand || cfg.formatType || 'bold';
        formatValueInput.value = cfg.formatValue || '';
        formatFallbackTextInput.value = cfg.formatFallbackText || '方法';
        dirActionSelect.value = cfg.dirAction || '复制目录ID';
        
        // 嵌套方法管理
        let nestedMethods = cfg.formatMethods && Array.isArray(cfg.formatMethods) ? [...cfg.formatMethods] : [];
        const nestedMethodsList = document.getElementById('nestedMethodsList');
        const addNestedMethodBtn = document.getElementById('addNestedMethodBtn');
        
        function renderNestedMethods() {
            if (nestedMethods.length === 0) {
                nestedMethodsList.innerHTML = '<p style="color: #999; font-size: 12px; margin: 0;">暂无嵌套方法</p>';
            } else {
                nestedMethodsList.innerHTML = nestedMethods.map((m, idx) => {
                    let label = `方法 ${idx + 1}`;
                    if (typeof window.buildMethodLabel === 'function') {
                        label = window.buildMethodLabel(m);
                    } else {
                        const type = m.methodType || '未设置';
                        const trigger = m.trigger || 'click';
                        label = `${type} / ${trigger}`;
                    }
                    return `
                        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px; padding: 5px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">
                            <span style="flex: 1; font-size: 12px;">${escapeHtml(label)}</span>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-edit-nested="${idx}" style="padding: 4px 8px; font-size: 12px;">编辑</button>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-danger" data-delete-nested="${idx}" style="padding: 4px 8px; font-size: 12px;">删除</button>
                        </div>
                    `;
                }).join('');
            }
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        renderNestedMethods();
        
        // 收集当前表单的所有值
        function collectCurrentFormData() {
            return {
                methodId: cfg.methodId,
                trigger: triggerSelect.value,
                frontAnchor: frontAnchorInput.value.trim(),
                backAnchor: backAnchorInput.value.trim(),
                methodType: methodTypeSelect.value,
                once: onceCheckbox.checked,
                renameTo: renameToInput.value.trim(),
                replaceSourceType: replaceSourceTypeSelect.value,
                replaceFromFrontAnchor: replaceFromFrontAnchorInput.value.trim(),
                replaceFromBackAnchor: replaceFromBackAnchorInput.value.trim(),
                replaceText: replaceTextTextarea.value,
                formatCommand: formatCommandSelect.value,
                formatValue: formatValueInput.value.trim(),
                formatFallbackText: formatFallbackTextInput.value.trim(),
                dirAction: dirActionSelect.value,
                formatMethods: [...nestedMethods]
            };
        }
        
        addNestedMethodBtn.addEventListener('click', async () => {
            // 收集当前表单数据
            const currentFormData = collectCurrentFormData();
            
            // 将当前表单数据压入父级栈，作为新弹窗的父级栈
            const newParentStack = [...currentParentStack, currentFormData];
            
            // 关闭当前弹窗，打开嵌套方法配置弹窗
            customDialogOverlay.classList.remove('active');
            const nestedMethod = await showMethodConfigDialog(null, newParentStack);
            
            // 嵌套弹窗关闭后，如果添加了嵌套方法，更新当前表单数据
            if (nestedMethod) {
                currentFormData.formatMethods.push(nestedMethod);
            }
            
            // 重新打开当前层级的弹窗，传入原来的父级栈
            const result = await showMethodConfigDialog(currentFormData, currentParentStack);
            resolve(result);
        });
        
        nestedMethodsList.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('[data-edit-nested]');
            const deleteBtn = e.target.closest('[data-delete-nested]');
            
            if (editBtn) {
                const idx = parseInt(editBtn.getAttribute('data-edit-nested'), 10);
                if (!isNaN(idx) && idx >= 0 && idx < nestedMethods.length) {
                    // 收集当前表单数据
                    const currentFormData = collectCurrentFormData();
                    
                    // 将当前表单数据压入父级栈
                    const newParentStack = [...currentParentStack, currentFormData];
                    
                    // 关闭当前弹窗，打开编辑嵌套方法弹窗
                    customDialogOverlay.classList.remove('active');
                    const updated = await showMethodConfigDialog(nestedMethods[idx], newParentStack);
                    
                    // 嵌套弹窗关闭后，如果更新了方法，更新当前表单数据
                    if (updated) {
                        currentFormData.formatMethods[idx] = updated;
                    }
                    
                    // 重新打开当前层级的弹窗
                    const result = await showMethodConfigDialog(currentFormData, currentParentStack);
                    resolve(result);
                }
            } else if (deleteBtn) {
                const idx = parseInt(deleteBtn.getAttribute('data-delete-nested'), 10);
                if (!isNaN(idx) && idx >= 0 && idx < nestedMethods.length) {
                    nestedMethods.splice(idx, 1);
                    renderNestedMethods();
                }
            }
        });
        
        // 根据方法类型显示/隐藏字段
        function updateFieldsVisibility() {
            const methodType = methodTypeSelect.value;
            const backAnchor = backAnchorInput.value.trim();
            const isDirLevel = !backAnchor;
            
            replaceFields.style.display = 'none';
            renameField.style.display = 'none';
            replaceContentFields.style.display = 'none';
            formatFields.style.display = 'none';
            dirActionFields.style.display = 'none';
            
            if (methodType === '更换内容') {
                replaceFields.style.display = 'block';
                if (isDirLevel) {
                    renameField.style.display = 'block';
                } else {
                    replaceContentFields.style.display = 'block';
                    updateReplaceSourceVisibility();
                }
            } else if (methodType === '添加格式') {
                if (!isDirLevel) {
                    formatFields.style.display = 'block';
                    updateFormatFields();
                }
            } else if (methodType === '目录右键动作') {
                dirActionFields.style.display = 'block';
            }
        }
        
        function updateReplaceSourceVisibility() {
            const sourceType = replaceSourceTypeSelect.value;
            if (sourceType === 'anchor') {
                replaceAnchorFields.style.display = 'block';
                replaceTextField.style.display = 'none';
            } else {
                replaceAnchorFields.style.display = 'none';
                replaceTextField.style.display = 'block';
            }
        }
        
        function updateFormatFields() {
            const cmd = formatCommandSelect.value;
            formatValueField.style.display = 'none';
            formatMethodField.style.display = 'none';
            
            if (cmd === 'color') {
                formatValueField.style.display = 'block';
                formatValueLabel.textContent = '颜色值：';
                formatValueInput.placeholder = '#ff0000';
            } else if (cmd === 'background-color') {
                formatValueField.style.display = 'block';
                formatValueLabel.textContent = '背景颜色：';
                formatValueInput.placeholder = '#ffff00';
            } else if (cmd === 'link') {
                formatValueField.style.display = 'block';
                formatValueLabel.textContent = '链接地址：';
                formatValueInput.placeholder = 'https:// 或 #锚点';
            } else if (cmd === 'method') {
                formatMethodField.style.display = 'block';
            }
        }
        
        methodTypeSelect.addEventListener('change', updateFieldsVisibility);
        backAnchorInput.addEventListener('input', updateFieldsVisibility);
        replaceSourceTypeSelect.addEventListener('change', updateReplaceSourceVisibility);
        formatCommandSelect.addEventListener('change', updateFormatFields);
        
        updateFieldsVisibility();
        
        const okBtn = document.getElementById('customDialogOk');
        const cancelBtn = document.getElementById('customDialogCancel');
        const closeBtn = customDialogClose;
        
        const closeDialog = (result) => {
            customDialogOverlay.classList.remove('active');
            customDialogMessage.innerHTML = '';
            customDialog.style.maxWidth = '';
            customDialog.style.width = '';
            resolve(result);
        };
        
        const handleOk = () => {
            const frontAnchor = frontAnchorInput.value.trim();
            if (!frontAnchor) {
                showToast('请输入前锚点', 'warning', 2000);
                return;
            }
            
            const backAnchor = backAnchorInput.value.trim();
            const methodType = methodTypeSelect.value;
            const isDirLevel = !backAnchor;
            
            // 验证目录级操作
            const frontRef = parseAnchorRef(frontAnchor);
            if (!frontRef) {
                showToast('前锚点格式错误', 'error', 2000);
                return;
            }
            
            if (isDirLevel) {
                const isDirRef = !!((frontRef.dirId || '').trim() || (frontRef.dirName || '').trim());
                if (!isDirRef || (frontRef.anchorId || '').trim()) {
                    showToast('仅有前锚点时，前锚点必须指向目录，例如 dir:目录ID 或 name:目录名', 'warning', 3000);
                    return;
                }
            } else {
                // 验证前后锁点是否在同一目录
                const backRef = parseAnchorRef(backAnchor);
                            
                const frontHasDir = !!(frontRef.dirId || frontRef.dirName);
                const backHasDir = backRef && !!(backRef.dirId || backRef.dirName);
                            
                if (!frontHasDir && !backHasDir) {
                } else if (frontHasDir && backHasDir) {
                    const frontDirId = resolveDirIdFromRef(frontRef);
                    const backDirId = resolveDirIdFromRef(backRef);
                    if (!frontDirId || !backDirId || frontDirId !== backDirId) {
                        showToast('前后锁点必须在同一目录内', 'warning', 2500);
                        return;
                    }
                } else {
                    showToast('前后锁点应保持一致：都指定目录或都不指定目录', 'warning', 3000);
                    return;
                }
            }
            
            // 验证添加格式不能用于目录级
            if (methodType === '添加格式' && isDirLevel) {
                showToast('仅有前锚点（目录级）不允许使用"添加格式"', 'warning', 2500);
                return;
            }
            
            // 构建配置对象
            const result = {
                methodId: cfg.methodId,
                trigger: triggerSelect.value,
                frontAnchor: frontAnchor,
                backAnchor: backAnchor,
                methodType: methodType,
                once: onceCheckbox.checked
            };
            
            // 根据方法类型添加特定字段
            if (methodType === '更换内容') {
                if (isDirLevel) {
                    const renameTo = renameToInput.value.trim();
                    if (!renameTo) {
                        showToast('请输入新目录名', 'warning', 2000);
                        return;
                    }
                    result.renameTo = renameTo;
                } else {
                    const sourceType = replaceSourceTypeSelect.value;
                    result.replaceSourceType = sourceType;
                    if (sourceType === 'anchor') {
                        const srcFront = replaceFromFrontAnchorInput.value.trim();
                        if (!srcFront) {
                            showToast('请输入替换来源前锚点', 'warning', 2000);
                            return;
                        }
                        result.replaceFromFrontAnchor = srcFront;
                        result.replaceFromBackAnchor = replaceFromBackAnchorInput.value.trim();
                    } else {
                        result.replaceText = replaceTextTextarea.value;
                    }
                }
            } else if (methodType === '添加格式') {
                const cmd = formatCommandSelect.value;
                result.formatCommand = cmd;
                if (cmd === 'color' || cmd === 'background-color' || cmd === 'link') {
                    result.formatValue = formatValueInput.value.trim();
                } else if (cmd === 'method') {
                    if (nestedMethods && nestedMethods.length > 0) {
                        result.formatMethods = nestedMethods;
                    } else {
                        result.formatMethods = [];
                    }
                    result.formatFallbackText = formatFallbackTextInput.value.trim() || '方法';
                }
            } else if (methodType === '目录右键动作') {
                result.dirAction = dirActionSelect.value;
            }
            
            closeDialog(result);
        };
        
        okBtn.onclick = handleOk;
        cancelBtn.onclick = () => closeDialog(null);
        closeBtn.onclick = () => closeDialog(null);
        customDialogOverlay.onclick = (e) => {
            if (e.target === customDialogOverlay) closeDialog(null);
        };
        
        customDialog.style.maxWidth = '600px';
        customDialog.style.width = '90%';
        customDialogOverlay.classList.add('active');
        setTimeout(() => frontAnchorInput.focus(), 100);
    });
}
