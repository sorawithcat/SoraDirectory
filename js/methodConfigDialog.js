function showMethodConfigDialog(existing, parentStack) {
    return new Promise((resolve) => {
        const registry = window.SoraMethodRegistry;
        const pickerApi = window.SoraReferencePicker;
        const cfg = existing && typeof existing === 'object'
            ? JSON.parse(JSON.stringify(existing))
            : {};
        if (registry) {
            registry.normalize(cfg, { assignId: true });
        } else {
            ensureMethodId(cfg);
        }
        const currentParentStack = parentStack || [];
        const currentDirId = pickerApi ? pickerApi.getCurrentDirectoryId() : null;
        const referenceIndex = pickerApi ? pickerApi.buildIndex() : null;
        const pickerInstances = [];

        const escapeMethodHtml = value => {
            const div = document.createElement('div');
            div.textContent = String(value || '');
            return div.innerHTML;
        };
        const escapeMethodAttr = value => escapeMethodHtml(value).replace(/"/g, '&quot;');
        const renderOptions = (items, selectedValue) => {
            const values = Array.isArray(items) ? items.slice() : [];
            if (selectedValue && !values.some(item => item.value === selectedValue)) {
                values.push({ value: selectedValue, label: `${selectedValue}（旧配置）` });
            }
            return values.map(item =>
                `<option value="${escapeMethodAttr(item.value)}"${item.value === selectedValue ? ' selected' : ''}>${escapeMethodHtml(item.label)}</option>`
            ).join('');
        };

        const triggerOptions = registry
            ? registry.getTriggers()
            : [
                { value: 'open', label: '打开网页时' },
                { value: 'enter_dir', label: '选中目录时' },
                { value: 'click', label: '点击时' },
                { value: 'hover', label: '悬浮时' }
            ];
        const actionOptions = registry
            ? registry.getActions()
            : ['隐藏', '隐藏（初始不隐藏）', '显示', '切换', '更换内容', '添加格式', '目录右键动作']
                .map(value => ({ value, label: value }));
        const formatOptions = registry
            ? registry.getFormatCommands()
            : ['bold', 'italic', 'underline', 'strikethrough', 'highlight', 'spoiler', 'superscript', 'subscript', 'code', 'color', 'background-color', 'link', 'method']
                .map(value => ({ value, label: value }));
        const directoryActionOptions = registry
            ? registry.getDirectoryActions()
            : ['复制目录ID', '删除目录', '复制目录（含子目录）', '复制目录（不含子目录）', '粘贴目录', '快速复制目录（含子目录）', '快速复制目录（不含子目录）', '展开此目录', '收起此目录']
                .map(value => ({ value, label: value }));

        const initialTrigger = cfg.trigger || 'click';
        const initialAction = cfg.methodType || '隐藏';
        const initialFormat = cfg.formatCommand || cfg.formatType || 'bold';
        const initialDirAction = cfg.dirAction || '复制目录ID';

        customDialogTitle.textContent = currentParentStack.length
            ? `配置嵌套方法（第 ${currentParentStack.length + 1} 层）`
            : '配置方法';
        customDialogInput.style.display = 'none';
        customDialogMessage.innerHTML = `
            <div class="method-form" novalidate>
                <section class="method-summary" aria-live="polite">
                    <span>当前方法</span>
                    <strong id="methodSummaryText">正在检查配置…</strong>
                    <small id="methodTargetStatus">选择目标后将在这里显示检查结果。</small>
                    <small class="method-field-error" data-error-for="method" role="alert"></small>
                </section>

                <div class="method-form-grid">
                    <div class="form-group" data-method-field="trigger">
                        <label for="methodTrigger">触发方式</label>
                        <select id="methodTrigger" class="form-control">
                            ${renderOptions(triggerOptions, initialTrigger)}
                        </select>
                        <small class="method-field-error" data-error-for="trigger" role="alert"></small>
                    </div>
                    <div class="form-group" data-method-field="methodType">
                        <label for="methodType">执行动作</label>
                        <select id="methodType" class="form-control">
                            ${renderOptions(actionOptions, initialAction)}
                        </select>
                        <small class="method-field-error" data-error-for="methodType" role="alert"></small>
                    </div>
                </div>

                <section id="triggerFields" class="method-conditional-section" hidden>
                    <h4>触发参数</h4>
                    <div id="triggerDynamicFields" class="method-form-grid"></div>
                </section>

                <fieldset class="method-fieldset" id="methodTargetFieldset">
                    <legend>目标范围</legend>
                    <div class="form-group" data-method-field="frontAnchor">
                        <label for="methodFrontAnchor">目录或前锚点</label>
                        <input type="text" id="methodFrontAnchor" class="form-control" value="${escapeMethodAttr(cfg.frontAnchor || '')}" placeholder="输入目录名、ID 或锚点进行搜索" />
                        <small>选择整个目录时不填写后锚点；也支持手工输入引用格式。</small>
                        <small class="method-field-error" data-error-for="frontAnchor" role="alert"></small>
                    </div>
                    <div class="form-group" data-method-field="backAnchor">
                        <label for="methodBackAnchor">后锚点（可选）</label>
                        <input type="text" id="methodBackAnchor" class="form-control" value="${escapeMethodAttr(cfg.backAnchor || '')}" placeholder="输入锚点名或选择同目录锚点" />
                        <small>填写后锚点后，动作只影响两个锚点之间的内容。</small>
                        <small class="method-field-error" data-error-for="backAnchor" role="alert"></small>
                    </div>
                </fieldset>

                <label class="method-checkbox-row">
                    <input type="checkbox" id="methodOnce"${cfg.once ? ' checked' : ''} />
                    <span><strong>只执行一次</strong><small>同一次导出网页会话中，成功执行后不再重复。</small></span>
                </label>

                <section id="replaceFields" class="method-conditional-section" hidden>
                    <h4>更换内容设置</h4>
                    <div class="form-group" id="renameField" data-method-field="renameTo" hidden>
                        <label for="methodRenameTo">新目录名</label>
                        <input type="text" id="methodRenameTo" class="form-control" value="${escapeMethodAttr(cfg.renameTo || '')}" maxlength="200" />
                        <small class="method-field-error" data-error-for="renameTo" role="alert"></small>
                    </div>
                    <div id="replaceContentFields" hidden>
                        <div class="form-group">
                            <label for="methodReplaceSourceType">替换来源</label>
                            <select id="methodReplaceSourceType" class="form-control">
                                <option value="anchor"${(cfg.replaceSourceType || 'anchor') === 'anchor' ? ' selected' : ''}>目录内容或锚点范围</option>
                                <option value="text"${cfg.replaceSourceType === 'text' ? ' selected' : ''}>直接输入文本</option>
                            </select>
                        </div>
                        <div id="replaceAnchorFields">
                            <div class="form-group" data-method-field="replaceFromFrontAnchor">
                                <label for="methodReplaceFromFrontAnchor">来源目录或前锚点</label>
                                <input type="text" id="methodReplaceFromFrontAnchor" class="form-control" value="${escapeMethodAttr(cfg.replaceFromFrontAnchor || '')}" placeholder="搜索替换来源" />
                                <small class="method-field-error" data-error-for="replaceFromFrontAnchor" role="alert"></small>
                            </div>
                            <div class="form-group" data-method-field="replaceFromBackAnchor">
                                <label for="methodReplaceFromBackAnchor">来源后锚点（可选）</label>
                                <input type="text" id="methodReplaceFromBackAnchor" class="form-control" value="${escapeMethodAttr(cfg.replaceFromBackAnchor || '')}" placeholder="选择同目录锚点" />
                                <small class="method-field-error" data-error-for="replaceFromBackAnchor" role="alert"></small>
                            </div>
                        </div>
                        <div id="replaceTextField" hidden>
                            <div class="form-group">
                                <label for="methodReplaceText">替换文本</label>
                                <textarea id="methodReplaceText" class="form-control" rows="3">${escapeMethodHtml(cfg.replaceText || '')}</textarea>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="formatFields" class="method-conditional-section" hidden>
                    <h4>格式设置</h4>
                    <div class="form-group">
                        <label for="methodFormatCommand">格式类型</label>
                        <select id="methodFormatCommand" class="form-control">
                            ${renderOptions(formatOptions, initialFormat)}
                        </select>
                    </div>
                    <div class="form-group" id="formatValueField" data-method-field="formatValue" hidden>
                        <label id="formatValueLabel" for="methodFormatValue">参数值</label>
                        <input type="text" id="methodFormatValue" class="form-control" value="${escapeMethodAttr(cfg.formatValue || '')}" />
                        <small class="method-field-error" data-error-for="formatValue" role="alert"></small>
                    </div>
                    <div id="formatMethodField" hidden>
                        <div class="form-group">
                            <label>嵌套方法</label>
                            <div id="nestedMethodsList" class="nested-method-list"></div>
                            <button type="button" id="addNestedMethodBtn" class="custom-dialog-btn custom-dialog-btn-secondary method-full-button">添加嵌套方法</button>
                        </div>
                        <div class="form-group">
                            <label for="methodFormatFallbackText">方法显示文本</label>
                            <input type="text" id="methodFormatFallbackText" class="form-control" value="${escapeMethodAttr(cfg.formatFallbackText || '方法')}" placeholder="方法" />
                        </div>
                    </div>
                </section>

                <section id="dirActionFields" class="method-conditional-section" hidden>
                    <h4>目录动作设置</h4>
                    <div class="form-group">
                        <label for="methodDirAction">目录动作</label>
                        <select id="methodDirAction" class="form-control">
                            ${renderOptions(directoryActionOptions, initialDirAction)}
                        </select>
                    </div>
                </section>

                <section id="actionAdvancedFields" class="method-conditional-section" hidden>
                    <h4>动作参数</h4>
                    <div id="actionDynamicFields" class="method-form-grid"></div>
                </section>

                <section class="method-conditional-section">
                    <h4>条件与流程</h4>
                    <label class="method-checkbox-row">
                        <input type="checkbox" id="methodEnabled"${cfg.enabled === false ? '' : ' checked'} />
                        <span><strong>启用此方法</strong><small>禁用后配置仍保留，但编辑器测试和导出网页都不会执行。</small></span>
                    </label>
                    <div id="methodConditionsList" class="method-condition-list"></div>
                    <button type="button" id="addMethodConditionBtn" class="custom-dialog-btn custom-dialog-btn-secondary method-full-button">添加条件</button>
                    <small class="method-field-error" data-error-for="conditions" role="alert"></small>
                    <div class="method-form-grid method-flow-grid">
                        <div class="form-group">
                            <label for="methodExecutionMode">步骤方式</label>
                            <select id="methodExecutionMode" class="form-control">
                                <option value="sequential"${cfg.executionMode === 'parallel' ? '' : ' selected'}>顺序执行</option>
                                <option value="parallel"${cfg.executionMode === 'parallel' ? ' selected' : ''}>并行调度</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="methodFailureMode">失败后</label>
                            <select id="methodFailureMode" class="form-control">
                                <option value="stop"${cfg.failureMode === 'skip' || cfg.failureMode === 'fallback' ? '' : ' selected'}>停止后续步骤</option>
                                <option value="skip"${cfg.failureMode === 'skip' ? ' selected' : ''}>跳过并继续</option>
                                <option value="fallback"${cfg.failureMode === 'fallback' ? ' selected' : ''}>执行备用动作</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="methodDelayMs">执行延迟（毫秒）</label>
                            <input type="number" id="methodDelayMs" class="form-control" min="0" max="86400000" value="${escapeMethodAttr(cfg.delayMs || 0)}" />
                        </div>
                        <div class="form-group">
                            <label for="methodMaxExecutions">最大执行次数</label>
                            <input type="number" id="methodMaxExecutions" class="form-control" min="1" max="1000" value="${escapeMethodAttr(cfg.maxExecutions || (cfg.once ? 1 : 20))}" />
                        </div>
                        <div class="form-group">
                            <label for="methodDebounceMs">防抖（毫秒）</label>
                            <input type="number" id="methodDebounceMs" class="form-control" min="0" max="60000" value="${escapeMethodAttr(cfg.debounceMs || 0)}" />
                        </div>
                        <div class="form-group">
                            <label for="methodThrottleMs">节流（毫秒）</label>
                            <input type="number" id="methodThrottleMs" class="form-control" min="0" max="60000" value="${escapeMethodAttr(cfg.throttleMs || 0)}" />
                        </div>
                    </div>
                    <div id="methodFallbackSection" hidden>
                        <label>备用动作</label>
                        <div id="fallbackMethodsList" class="nested-method-list"></div>
                        <button type="button" id="addFallbackMethodBtn" class="custom-dialog-btn custom-dialog-btn-secondary method-full-button">添加备用动作</button>
                    </div>
                </section>
                <section id="methodConfirmBranches" class="method-conditional-section" hidden>
                    <h4>确认分支</h4>
                    <div class="method-form-grid">
                        <div>
                            <label>点击确认后</label>
                            <div id="confirmMethodsList" class="nested-method-list"></div>
                            <button type="button" id="addConfirmMethodBtn" class="custom-dialog-btn custom-dialog-btn-secondary method-full-button">添加确认动作</button>
                        </div>
                        <div>
                            <label>点击取消后</label>
                            <div id="cancelMethodsList" class="nested-method-list"></div>
                            <button type="button" id="addCancelMethodBtn" class="custom-dialog-btn custom-dialog-btn-secondary method-full-button">添加取消动作</button>
                        </div>
                    </div>
                </section>
            </div>
        `;
        customDialogFooter.innerHTML =
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="methodTestBtn">测试</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="methodApplyPresetBtn">套用预设</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="methodPresetBtn">存为预设</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="methodRelationsBtn">关系</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-secondary" id="customDialogCancel">取消</button>' +
            '<button class="custom-dialog-btn custom-dialog-btn-primary" id="customDialogOk">保存方法</button>';

        const byId = id => document.getElementById(id);
        const triggerSelect = byId('methodTrigger');
        const triggerFields = byId('triggerFields');
        const triggerDynamicFields = byId('triggerDynamicFields');
        const frontAnchorInput = byId('methodFrontAnchor');
        const backAnchorInput = byId('methodBackAnchor');
        const targetFieldset = byId('methodTargetFieldset');
        const methodTypeSelect = byId('methodType');
        const onceCheckbox = byId('methodOnce');
        const replaceFields = byId('replaceFields');
        const renameField = byId('renameField');
        const replaceContentFields = byId('replaceContentFields');
        const renameToInput = byId('methodRenameTo');
        const replaceSourceTypeSelect = byId('methodReplaceSourceType');
        const replaceAnchorFields = byId('replaceAnchorFields');
        const replaceTextField = byId('replaceTextField');
        const replaceFromFrontAnchorInput = byId('methodReplaceFromFrontAnchor');
        const replaceFromBackAnchorInput = byId('methodReplaceFromBackAnchor');
        const replaceTextTextarea = byId('methodReplaceText');
        const formatFields = byId('formatFields');
        const formatCommandSelect = byId('methodFormatCommand');
        const formatValueField = byId('formatValueField');
        const formatValueLabel = byId('formatValueLabel');
        const formatValueInput = byId('methodFormatValue');
        const formatMethodField = byId('formatMethodField');
        const formatFallbackTextInput = byId('methodFormatFallbackText');
        const dirActionFields = byId('dirActionFields');
        const dirActionSelect = byId('methodDirAction');
        const actionAdvancedFields = byId('actionAdvancedFields');
        const actionDynamicFields = byId('actionDynamicFields');
        const summaryText = byId('methodSummaryText');
        const targetStatus = byId('methodTargetStatus');
        const nestedMethodsList = byId('nestedMethodsList');
        const addNestedMethodBtn = byId('addNestedMethodBtn');
        const enabledCheckbox = byId('methodEnabled');
        const executionModeSelect = byId('methodExecutionMode');
        const failureModeSelect = byId('methodFailureMode');
        const delayMsInput = byId('methodDelayMs');
        const maxExecutionsInput = byId('methodMaxExecutions');
        const debounceMsInput = byId('methodDebounceMs');
        const throttleMsInput = byId('methodThrottleMs');
        const conditionsList = byId('methodConditionsList');
        const addConditionBtn = byId('addMethodConditionBtn');
        const fallbackSection = byId('methodFallbackSection');
        const fallbackMethodsList = byId('fallbackMethodsList');
        const addFallbackMethodBtn = byId('addFallbackMethodBtn');
        const confirmBranches = byId('methodConfirmBranches');
        const confirmMethodsList = byId('confirmMethodsList');
        const cancelMethodsList = byId('cancelMethodsList');
        const addConfirmMethodBtn = byId('addConfirmMethodBtn');
        const addCancelMethodBtn = byId('addCancelMethodBtn');
        const fieldDefinitions = registry ? registry.getFieldDefinitions() : {};
        let nestedMethods = Array.isArray(cfg.formatMethods)
            ? cfg.formatMethods.map(method => JSON.parse(JSON.stringify(method)))
            : [];
        let fallbackMethods = Array.isArray(cfg.elseMethods)
            ? cfg.elseMethods.map(method => JSON.parse(JSON.stringify(method)))
            : [];
        let conditions = Array.isArray(cfg.conditions)
            ? cfg.conditions.map(condition => ({ ...condition }))
            : [];
        let confirmMethods = Array.isArray(cfg.confirmMethods) ? cfg.confirmMethods.map(method => JSON.parse(JSON.stringify(method))) : [];
        let cancelMethods = Array.isArray(cfg.cancelMethods) ? cfg.cancelMethods.map(method => JSON.parse(JSON.stringify(method))) : [];
        let dynamicPickerInstances = [];
        const dynamicFieldValues = Object.fromEntries(
            Object.keys(fieldDefinitions).map(key => [key, cfg[key]])
        );

        function getReferenceIndex() {
            return referenceIndex;
        }

        function resolveReference(value, index) {
            if (!pickerApi) return null;
            return pickerApi.resolve(value, index || getReferenceIndex(), currentDirId);
        }

        function getDirectoryIdForReference(value) {
            const resolved = resolveReference(value);
            return resolved && resolved.exists && resolved.directory ? resolved.directory.id : null;
        }

        function attachReferencePickers() {
            if (!pickerApi) return;
            pickerInstances.push(pickerApi.attach(frontAnchorInput, {
                allowDirectory: true,
                currentDirId,
                index: referenceIndex,
                openOnFocus: false,
                buttonLabel: '选择目标目录或前锚点'
            }));
            pickerInstances.push(pickerApi.attach(backAnchorInput, {
                allowDirectory: false,
                currentDirId,
                index: referenceIndex,
                openOnFocus: false,
                filterDirectoryId: () => getDirectoryIdForReference(frontAnchorInput.value),
                buttonLabel: '选择同目录后锚点'
            }));
            pickerInstances.push(pickerApi.attach(replaceFromFrontAnchorInput, {
                allowDirectory: true,
                currentDirId,
                index: referenceIndex,
                openOnFocus: false,
                buttonLabel: '选择替换来源'
            }));
            pickerInstances.push(pickerApi.attach(replaceFromBackAnchorInput, {
                allowDirectory: false,
                currentDirId,
                index: referenceIndex,
                openOnFocus: false,
                filterDirectoryId: () => getDirectoryIdForReference(replaceFromFrontAnchorInput.value),
                buttonLabel: '选择来源后锚点'
            }));
        }

        function renderRegistryField(key) {
            const definition = fieldDefinitions[key] || { label: key, type: 'text' };
            const value = dynamicFieldValues[key] !== undefined
                ? dynamicFieldValues[key]
                : (definition.defaultValue !== undefined ? definition.defaultValue : '');
            const common = `id="methodExtra_${escapeMethodAttr(key)}" data-method-extra-key="${escapeMethodAttr(key)}" class="form-control"`;
            let control = '';
            if (definition.type === 'select') {
                control = `<select ${common}>${(definition.options || []).map(option => {
                    const optionValue = Array.isArray(option) ? option[0] : option.value;
                    const optionLabel = Array.isArray(option) ? option[1] : option.label;
                    return `<option value="${escapeMethodAttr(optionValue)}"${String(optionValue) === String(value) ? ' selected' : ''}>${escapeMethodHtml(optionLabel)}</option>`;
                }).join('')}</select>`;
            } else if (definition.type === 'textarea') {
                control = `<textarea ${common} rows="3" placeholder="${escapeMethodAttr(definition.placeholder || '')}">${escapeMethodHtml(value)}</textarea>`;
            } else {
                const type = definition.type === 'number' ? 'number' : 'text';
                const limits = type === 'number'
                    ? `${definition.min !== undefined ? ` min="${definition.min}"` : ''}${definition.max !== undefined ? ` max="${definition.max}"` : ''}${definition.step !== undefined ? ` step="${definition.step}"` : ''}`
                    : '';
                control = `<input type="${type}" ${common}${limits} value="${escapeMethodAttr(value)}" placeholder="${escapeMethodAttr(definition.placeholder || '')}" />`;
            }
            return `<div class="form-group${definition.type === 'textarea' ? ' method-grid-full' : ''}" data-method-field="${escapeMethodAttr(key)}">
                <label for="methodExtra_${escapeMethodAttr(key)}">${escapeMethodHtml(definition.label || key)}</label>
                ${control}
                ${definition.suffix ? `<small>${escapeMethodHtml(definition.suffix)}</small>` : ''}
                <small class="method-field-error" data-error-for="${escapeMethodAttr(key)}" role="alert"></small>
            </div>`;
        }

        function destroyDynamicPickers() {
            dynamicPickerInstances.forEach(instance => instance && instance.destroy());
            dynamicPickerInstances = [];
        }

        function attachDynamicPickers(container) {
            if (!pickerApi || !container) return;
            container.querySelectorAll('[data-method-extra-key]').forEach(input => {
                const key = input.getAttribute('data-method-extra-key');
                if (fieldDefinitions[key]?.type !== 'reference') return;
                let filterDirectoryId = null;
                if (key === 'destinationBackAnchor') {
                    filterDirectoryId = () => getDirectoryIdForReference(byId('methodExtra_destinationFrontAnchor')?.value || '');
                } else if (key === 'contentBackAnchor') {
                    filterDirectoryId = () => getDirectoryIdForReference(byId('methodExtra_contentFrontAnchor')?.value || '');
                }
                dynamicPickerInstances.push(pickerApi.attach(input, {
                    allowDirectory: !key.toLowerCase().includes('backanchor'),
                    currentDirId,
                    index: referenceIndex,
                    openOnFocus: false,
                    filterDirectoryId,
                    buttonLabel: `选择${fieldDefinitions[key]?.label || '目录或锚点'}`
                }));
            });
        }

        function renderRegistryFields() {
            destroyDynamicPickers();
            const trigger = registry ? registry.getTrigger(triggerSelect.value) : null;
            const action = registry ? registry.getAction(methodTypeSelect.value) : null;
            const triggerKeys = trigger && trigger.fields ? trigger.fields : [];
            const actionKeys = action && action.fields ? action.fields : [];
            triggerDynamicFields.innerHTML = triggerKeys.map(renderRegistryField).join('');
            actionDynamicFields.innerHTML = actionKeys.map(renderRegistryField).join('');
            triggerFields.hidden = triggerKeys.length === 0;
            actionAdvancedFields.hidden = actionKeys.length === 0;
            attachDynamicPickers(triggerDynamicFields);
            attachDynamicPickers(actionDynamicFields);
            [triggerDynamicFields, actionDynamicFields].forEach(container => {
                container.querySelectorAll('[data-method-extra-key]').forEach(control => {
                    const cacheValue = () => {
                        const key = control.getAttribute('data-method-extra-key');
                        dynamicFieldValues[key] = control.type === 'number' ? Number(control.value) : control.value;
                        updateAll();
                    };
                    control.addEventListener('input', cacheValue);
                    control.addEventListener('change', cacheValue);
                });
            });
        }

        function collectRegistryFields(result) {
            Object.keys(fieldDefinitions).forEach(key => delete result[key]);
            customDialogMessage.querySelectorAll('[data-method-extra-key]').forEach(control => {
                const key = control.getAttribute('data-method-extra-key');
                dynamicFieldValues[key] = control.type === 'number' ? Number(control.value) : control.value;
            });
            Object.entries(dynamicFieldValues).forEach(([key, value]) => {
                if (value !== undefined) result[key] = value;
            });
        }

        function collectCurrentFormData() {
            const result = { ...cfg };
            [
                'renameTo', 'replaceSourceType', 'replaceFromFrontAnchor', 'replaceFromBackAnchor', 'replaceText',
                'formatCommand', 'formatValue', 'formatFallbackText', 'dirAction', 'formatMethods'
            ].forEach(key => delete result[key]);
            Object.assign(result, {
                configVersion: registry ? registry.CONFIG_VERSION : (cfg.configVersion || 1),
                methodId: cfg.methodId,
                trigger: triggerSelect.value,
                frontAnchor: frontAnchorInput.value.trim(),
                backAnchor: backAnchorInput.value.trim(),
                methodType: methodTypeSelect.value,
                once: onceCheckbox.checked,
                enabled: enabledCheckbox.checked,
                executionMode: executionModeSelect.value,
                failureMode: failureModeSelect.value,
                delayMs: Number(delayMsInput.value) || 0,
                maxExecutions: Number(maxExecutionsInput.value) || (onceCheckbox.checked ? 1 : 20),
                debounceMs: Number(debounceMsInput.value) || 0,
                throttleMs: Number(throttleMsInput.value) || 0,
                conditions: conditions.map(condition => ({ ...condition })),
                elseMethods: fallbackMethods.map(method => JSON.parse(JSON.stringify(method))),
                confirmMethods: confirmMethods.map(method => JSON.parse(JSON.stringify(method))),
                cancelMethods: cancelMethods.map(method => JSON.parse(JSON.stringify(method))),
                renameTo: renameToInput.value.trim(),
                replaceSourceType: replaceSourceTypeSelect.value,
                replaceFromFrontAnchor: replaceFromFrontAnchorInput.value.trim(),
                replaceFromBackAnchor: replaceFromBackAnchorInput.value.trim(),
                replaceText: replaceTextTextarea.value,
                formatCommand: formatCommandSelect.value,
                formatValue: formatValueInput.value.trim(),
                formatFallbackText: formatFallbackTextInput.value.trim(),
                dirAction: dirActionSelect.value,
                formatMethods: nestedMethods.slice()
            });
            collectRegistryFields(result);
            return registry ? registry.normalize(result, { assignId: true }) : result;
        }

        function renderNestedMethods() {
            if (!nestedMethods.length) {
                nestedMethodsList.innerHTML = '<p class="nested-method-empty">尚未添加嵌套方法。</p>';
                return;
            }
            nestedMethodsList.innerHTML = nestedMethods.map((method, index) => {
                const label = registry ? registry.summarize(method) : (window.buildMethodLabel ? window.buildMethodLabel(method) : `方法 ${index + 1}`);
                return `
                    <div class="nested-method-item${method.enabled === false ? ' is-disabled' : ''}">
                        <span>${escapeMethodHtml(label)}</span>
                        <div class="nested-method-actions">
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-move-nested="up" data-nested-index="${index}"${index === 0 ? ' disabled' : ''}>上移</button>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-move-nested="down" data-nested-index="${index}"${index === nestedMethods.length - 1 ? ' disabled' : ''}>下移</button>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-toggle-nested="${index}">${method.enabled === false ? '启用' : '禁用'}</button>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-copy-nested="${index}">复制</button>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-edit-nested="${index}">编辑</button>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-danger" data-delete-nested="${index}">删除</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderFallbackMethods() {
            fallbackSection.hidden = failureModeSelect.value !== 'fallback';
            if (!fallbackMethods.length) {
                fallbackMethodsList.innerHTML = '<p class="nested-method-empty">尚未添加备用动作。</p>';
                return;
            }
            fallbackMethodsList.innerHTML = fallbackMethods.map((method, index) => `
                <div class="nested-method-item${method.enabled === false ? ' is-disabled' : ''}">
                    <span>${escapeMethodHtml(registry ? registry.summarize(method) : `备用动作 ${index + 1}`)}</span>
                    <div class="nested-method-actions">
                        <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-edit-fallback="${index}">编辑</button>
                        <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-copy-fallback="${index}">复制</button>
                        <button type="button" class="custom-dialog-btn custom-dialog-btn-danger" data-delete-fallback="${index}">删除</button>
                    </div>
                </div>
            `).join('');
        }

        function renderConfirmBranches() {
            const renderList = (container, methods, branch) => {
                if (!methods.length) {
                    container.innerHTML = '<p class="nested-method-empty">尚未添加动作。</p>';
                    return;
                }
                container.innerHTML = methods.map((method, index) => `
                    <div class="nested-method-item${method.enabled === false ? ' is-disabled' : ''}">
                        <span>${escapeMethodHtml(registry ? registry.summarize(method) : `动作 ${index + 1}`)}</span>
                        <div class="nested-method-actions">
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-branch-edit="${branch}" data-branch-index="${index}">编辑</button>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-secondary" data-branch-copy="${branch}" data-branch-index="${index}">复制</button>
                            <button type="button" class="custom-dialog-btn custom-dialog-btn-danger" data-branch-delete="${branch}" data-branch-index="${index}">删除</button>
                        </div>
                    </div>`).join('');
            };
            renderList(confirmMethodsList, confirmMethods, 'confirm');
            renderList(cancelMethodsList, cancelMethods, 'cancel');
        }

        function renderConditions() {
            const conditionTypes = registry ? registry.getConditionTypes() : [];
            const operators = registry ? registry.getComparisonOperators() : [];
            if (!conditions.length) {
                conditionsList.innerHTML = '<p class="nested-method-empty">无条件，触发后直接执行。</p>';
                return;
            }
            conditionsList.innerHTML = conditions.map((condition, index) => `
                <div class="method-condition-row" data-condition-index="${index}">
                    <select class="form-control" data-condition-field="join" aria-label="条件连接方式"${index === 0 ? ' disabled' : ''}>
                        <option value="AND"${condition.join === 'OR' ? '' : ' selected'}>并且</option>
                        <option value="OR"${condition.join === 'OR' ? ' selected' : ''}>或者</option>
                    </select>
                    <select class="form-control" data-condition-field="type" aria-label="条件类型">
                        ${renderOptions(conditionTypes, condition.type || 'variable')}
                    </select>
                    <input class="form-control" data-condition-field="key" value="${escapeMethodAttr(condition.key || '')}" placeholder="变量名、引用或次数" aria-label="条件对象" />
                    <select class="form-control" data-condition-field="operator" aria-label="比较方式">
                        ${renderOptions(operators, condition.operator || 'equals')}
                    </select>
                    <input class="form-control" data-condition-field="value" value="${escapeMethodAttr(condition.value ?? '')}" placeholder="比较值" aria-label="条件比较值" />
                    <button type="button" class="custom-dialog-btn custom-dialog-btn-danger" data-delete-condition="${index}">删除</button>
                </div>
            `).join('');
            conditionsList.querySelectorAll('[data-condition-field]').forEach(control => {
                control.addEventListener('input', updateConditionFromDom);
                control.addEventListener('change', updateConditionFromDom);
            });
        }

        function updateConditionFromDom(event) {
            const row = event.target.closest('[data-condition-index]');
            if (!row) return;
            const index = Number(row.getAttribute('data-condition-index'));
            if (!conditions[index]) return;
            row.querySelectorAll('[data-condition-field]').forEach(control => {
                const key = control.getAttribute('data-condition-field');
                conditions[index][key] = control.value;
            });
            updateAll();
        }

        function setFieldError(field, message) {
            const error = customDialogMessage.querySelector(`[data-error-for="${field}"]`);
            const group = customDialogMessage.querySelector(`[data-method-field="${field}"]`);
            if (error) error.textContent = message || '';
            if (group) group.classList.toggle('has-error', !!message);
        }

        function clearErrors() {
            customDialogMessage.querySelectorAll('.method-field-error').forEach(error => {
                error.textContent = '';
            });
            customDialogMessage.querySelectorAll('.has-error').forEach(group => group.classList.remove('has-error'));
        }

        function validateReferencePair(frontValue, backValue, frontField, backField, options = {}) {
            const errors = [];
            const index = getReferenceIndex();
            const front = resolveReference(frontValue, index);
            if (!frontValue) {
                errors.push({ field: frontField, message: options.frontRequiredMessage || '请选择目录或前锚点' });
                return { errors, front: null, back: null };
            }
            if (!front || !front.exists) {
                errors.push({ field: frontField, message: front && front.error ? front.error : '目标引用无效' });
                return { errors, front, back: null };
            }
            if (!backValue) {
                if (options.requireRange) {
                    errors.push({ field: backField, message: '该动作需要选择后锚点' });
                } else if (options.requireDirectory && front.type !== 'directory') {
                    errors.push({ field: frontField, message: '目录级动作必须选择整个目录' });
                }
                return { errors, front, back: null };
            }
            const back = resolveReference(backValue, index);
            if (!back || !back.exists) {
                errors.push({ field: backField, message: back && back.error ? back.error : '后锚点引用无效' });
                return { errors, front, back };
            }
            if (front.type !== 'anchor') {
                errors.push({ field: frontField, message: '范围操作的起点必须是锚点' });
            }
            if (back.type !== 'anchor') {
                errors.push({ field: backField, message: '范围操作的终点必须是锚点' });
            }
            if (front.directory && back.directory && front.directory.id !== back.directory.id) {
                errors.push({ field: backField, message: '前后锚点必须位于同一目录' });
            } else if (front.anchor && back.anchor && front.anchor.order >= back.anchor.order) {
                errors.push({ field: backField, message: '后锚点必须位于前锚点之后' });
            }
            return { errors, front, back };
        }

        function validateForm(showRequired) {
            clearErrors();
            const data = collectCurrentFormData();
            const errors = [];
            const action = registry ? registry.getAction(data.methodType) : null;

            if (registry) {
                registry.validateBasic(data).forEach(error => {
                    if (!['frontAnchor', 'backAnchor'].includes(error.field)) errors.push(error);
                });
            }

            if ((!action || !['none', 'optional'].includes(action.targetMode)) && (showRequired || data.frontAnchor)) {
                const pair = validateReferencePair(
                    data.frontAnchor,
                    data.backAnchor,
                    'frontAnchor',
                    'backAnchor',
                    {
                        requireRange: !!(action && action.targetMode === 'range'),
                        requireDirectory: !!(action && action.targetMode === 'directory') || (!!(action && action.targetMode === 'directoryOrRange') && !data.backAnchor)
                    }
                );
                errors.push(...pair.errors);
            }
            if (action && action.targetMode === 'directory' && data.backAnchor) {
                errors.push({ field: 'backAnchor', message: `${action.label}只能作用于整个目录，请清空后锚点` });
            }

            if (data.methodType === '更换内容') {
                if (!data.backAnchor) {
                    if (showRequired || data.renameTo) {
                        if (!data.renameTo) errors.push({ field: 'renameTo', message: '请输入新目录名' });
                    }
                } else if (data.replaceSourceType === 'anchor' && (showRequired || data.replaceFromFrontAnchor)) {
                    const sourcePair = validateReferencePair(
                        data.replaceFromFrontAnchor,
                        data.replaceFromBackAnchor,
                        'replaceFromFrontAnchor',
                        'replaceFromBackAnchor'
                    );
                    errors.push(...sourcePair.errors);
                }
            }

            if (data.methodType === '添加格式' && ['color', 'background-color'].includes(data.formatCommand)) {
                if (!/^#[0-9a-fA-F]{6}$/.test(data.formatValue)) {
                    errors.push({ field: 'formatValue', message: '请输入六位十六进制颜色，例如 #2563EB' });
                }
            }
            if (data.methodType === '添加格式' && data.formatCommand === 'link') {
                const linkValue = String(data.formatValue || '').trim();
                if (!linkValue) {
                    errors.push({ field: 'formatValue', message: '请输入链接地址或选择内部引用' });
                } else if (!/^(https?:\/\/|mailto:|tel:|#|dir:|name:|sora-dir:)/i.test(linkValue)) {
                    errors.push({ field: 'formatValue', message: '仅支持 http(s)、mailto、tel 或内部目录/锚点引用' });
                }
            }
            if (data.methodType === '插入内容') {
                if (data.contentSourceType === 'reference') {
                    const contentPair = validateReferencePair(
                        data.contentFrontAnchor,
                        data.contentBackAnchor,
                        'contentFrontAnchor',
                        'contentBackAnchor'
                    );
                    errors.push(...contentPair.errors);
                } else if (!String(data.contentText || '').trim()) {
                    errors.push({ field: 'contentText', message: '请输入要插入的内容' });
                }
            }
            if (data.methodType === '传送范围') {
                const destinationPair = validateReferencePair(
                    data.destinationFrontAnchor,
                    data.destinationBackAnchor,
                    'destinationFrontAnchor',
                    'destinationBackAnchor',
                    { requireRange: true }
                );
                errors.push(...destinationPair.errors);
            }
            const parentIds = new Set(currentParentStack.map(item => item && item.methodId).filter(Boolean));
            const nestedIds = [...nestedMethods, ...fallbackMethods, ...confirmMethods, ...cancelMethods].map(item => item && item.methodId).filter(Boolean);
            if (data.methodId && (parentIds.has(data.methodId) || nestedIds.includes(data.methodId))) {
                errors.push({ field: 'method', message: '检测到方法循环引用，请复制为新方法后再嵌套' });
            }

            const uniqueErrors = [];
            const seen = new Set();
            errors.forEach(error => {
                const key = `${error.field}:${error.message}`;
                if (seen.has(key)) return;
                seen.add(key);
                uniqueErrors.push(error);
                setFieldError(error.field, error.message);
            });
            return { data, errors: uniqueErrors };
        }

        function updateTargetStatus() {
            const action = registry ? registry.getAction(methodTypeSelect.value) : null;
            if (action && action.targetMode === 'none') {
                targetStatus.textContent = '此动作使用当前页面状态，不需要目录或锚点目标。';
                targetStatus.className = 'is-valid';
                return;
            }
            const frontValue = frontAnchorInput.value.trim();
            const backValue = backAnchorInput.value.trim();
            if (!frontValue) {
                targetStatus.textContent = action && action.targetMode === 'optional'
                    ? '未选择目标时将以浮动提示显示；也可选择目录或锚点范围。'
                    : '选择目标后将在这里显示检查结果。';
                targetStatus.className = '';
                return;
            }
            const index = getReferenceIndex();
            const front = resolveReference(frontValue, index);
            const back = backValue ? resolveReference(backValue, index) : null;
            if (!front || !front.exists) {
                targetStatus.textContent = front && front.error ? front.error : '目标引用无效。';
                targetStatus.className = 'is-error';
                return;
            }
            if (backValue && (!back || !back.exists)) {
                targetStatus.textContent = back && back.error ? back.error : '后锚点引用无效。';
                targetStatus.className = 'is-error';
                return;
            }
            const dirPath = front.directory.path;
            if (front.anchor && back && back.anchor) {
                targetStatus.textContent = `${dirPath} · #${front.anchor.id} 至 #${back.anchor.id}`;
            } else if (front.anchor) {
                targetStatus.textContent = `${dirPath} · 从 #${front.anchor.id} 开始`;
            } else {
                targetStatus.textContent = `${dirPath} · 整个目录`;
            }
            targetStatus.className = 'is-valid';
        }

        function updateFieldsVisibility() {
            const methodType = methodTypeSelect.value;
            const action = registry ? registry.getAction(methodType) : null;
            const isDirectoryLevel = !backAnchorInput.value.trim();
            targetFieldset.hidden = !!(action && action.targetMode === 'none');
            const backGroup = backAnchorInput.closest('.form-group');
            if (backGroup) backGroup.hidden = !!(action && ['none', 'reference', 'directory'].includes(action.targetMode));
            replaceFields.hidden = methodType !== '更换内容';
            renameField.hidden = !(methodType === '更换内容' && isDirectoryLevel);
            replaceContentFields.hidden = !(methodType === '更换内容' && !isDirectoryLevel);
            formatFields.hidden = methodType !== '添加格式';
            dirActionFields.hidden = methodType !== '目录右键动作';
            fallbackSection.hidden = failureModeSelect.value !== 'fallback';
            confirmBranches.hidden = methodType !== '交互确认';
            updateReplaceSourceVisibility();
            updateFormatFields();
        }

        function updateReplaceSourceVisibility() {
            const useAnchors = replaceSourceTypeSelect.value === 'anchor';
            replaceAnchorFields.hidden = !useAnchors;
            replaceTextField.hidden = useAnchors;
        }

        function updateFormatFields() {
            const command = formatCommandSelect.value;
            const needsValue = ['color', 'background-color', 'link'].includes(command);
            formatValueField.hidden = !needsValue;
            formatMethodField.hidden = command !== 'method';
            if (command === 'color') {
                formatValueLabel.textContent = '文字颜色';
                formatValueInput.placeholder = '#2563EB';
            } else if (command === 'background-color') {
                formatValueLabel.textContent = '背景颜色';
                formatValueInput.placeholder = '#FFF3BF';
            } else if (command === 'link') {
                formatValueLabel.textContent = '链接地址';
                formatValueInput.placeholder = 'https://、#锚点或 dir:目录ID#锚点';
            }
        }

        function updateAll() {
            updateFieldsVisibility();
            const data = collectCurrentFormData();
            summaryText.textContent = registry ? registry.summarize(data) : window.buildMethodLabel(data);
            updateTargetStatus();
            validateForm(false);
        }

        attachReferencePickers();
        renderRegistryFields();
        renderNestedMethods();
        renderConditions();
        renderFallbackMethods();
        renderConfirmBranches();
        updateAll();

        [triggerSelect, methodTypeSelect].forEach(element => element.addEventListener('change', () => {
            renderRegistryFields();
            updateAll();
        }));
        [onceCheckbox, enabledCheckbox, executionModeSelect, failureModeSelect, replaceSourceTypeSelect, formatCommandSelect, dirActionSelect]
            .forEach(element => element.addEventListener('change', updateAll));
        [frontAnchorInput, backAnchorInput, renameToInput, replaceFromFrontAnchorInput, replaceFromBackAnchorInput, replaceTextTextarea, formatValueInput, formatFallbackTextInput, delayMsInput, maxExecutionsInput, debounceMsInput, throttleMsInput]
            .forEach(element => {
                element.addEventListener('input', updateAll);
                element.addEventListener('change', updateAll);
            });

        addConditionBtn.addEventListener('click', () => {
            conditions.push({ type: 'variable', key: '', operator: 'equals', value: '', join: conditions.length ? 'AND' : 'AND' });
            renderConditions();
            updateAll();
        });
        conditionsList.addEventListener('click', event => {
            const button = event.target.closest('[data-delete-condition]');
            if (!button) return;
            const index = Number(button.getAttribute('data-delete-condition'));
            if (!Number.isInteger(index) || index < 0 || index >= conditions.length) return;
            conditions.splice(index, 1);
            renderConditions();
            updateAll();
        });

        addNestedMethodBtn.addEventListener('click', async () => {
            const currentFormData = collectCurrentFormData();
            const newParentStack = [...currentParentStack, currentFormData];
            customDialogOverlay.classList.remove('active');
            const nestedMethod = await showMethodConfigDialog(null, newParentStack);
            if (nestedMethod) currentFormData.formatMethods.push(nestedMethod);
            const result = await showMethodConfigDialog(currentFormData, currentParentStack);
            resolve(result);
        });

        addFallbackMethodBtn.addEventListener('click', async () => {
            const currentFormData = collectCurrentFormData();
            const newParentStack = [...currentParentStack, currentFormData];
            customDialogOverlay.classList.remove('active');
            const fallbackMethod = await showMethodConfigDialog(null, newParentStack);
            if (fallbackMethod) currentFormData.elseMethods.push(fallbackMethod);
            const result = await showMethodConfigDialog(currentFormData, currentParentStack);
            resolve(result);
        });

        fallbackMethodsList.addEventListener('click', async event => {
            const editButton = event.target.closest('[data-edit-fallback]');
            const copyButton = event.target.closest('[data-copy-fallback]');
            const deleteButton = event.target.closest('[data-delete-fallback]');
            const sourceButton = editButton || copyButton || deleteButton;
            if (!sourceButton) return;
            const index = Number(sourceButton.getAttribute(editButton ? 'data-edit-fallback' : copyButton ? 'data-copy-fallback' : 'data-delete-fallback'));
            if (!Number.isInteger(index) || index < 0 || index >= fallbackMethods.length) return;
            if (copyButton) {
                const copy = JSON.parse(JSON.stringify(fallbackMethods[index]));
                delete copy.methodId;
                fallbackMethods.splice(index + 1, 0, registry ? registry.normalize(copy, { assignId: true }) : copy);
                renderFallbackMethods();
                updateAll();
                return;
            }
            if (deleteButton) {
                fallbackMethods.splice(index, 1);
                renderFallbackMethods();
                updateAll();
                return;
            }
            const currentFormData = collectCurrentFormData();
            const newParentStack = [...currentParentStack, currentFormData];
            customDialogOverlay.classList.remove('active');
            const updated = await showMethodConfigDialog(fallbackMethods[index], newParentStack);
            if (updated) currentFormData.elseMethods[index] = updated;
            const result = await showMethodConfigDialog(currentFormData, currentParentStack);
            resolve(result);
        });

        const addBranchMethod = async branch => {
            const currentFormData = collectCurrentFormData();
            const newParentStack = [...currentParentStack, currentFormData];
            customDialogOverlay.classList.remove('active');
            const method = await showMethodConfigDialog(null, newParentStack);
            if (method) currentFormData[branch === 'confirm' ? 'confirmMethods' : 'cancelMethods'].push(method);
            const result = await showMethodConfigDialog(currentFormData, currentParentStack);
            resolve(result);
        };
        addConfirmMethodBtn.addEventListener('click', () => addBranchMethod('confirm'));
        addCancelMethodBtn.addEventListener('click', () => addBranchMethod('cancel'));

        const handleBranchListClick = async event => {
            const button = event.target.closest('[data-branch-edit], [data-branch-copy], [data-branch-delete]');
            if (!button) return;
            const branch = button.dataset.branchEdit || button.dataset.branchCopy || button.dataset.branchDelete;
            const methods = branch === 'confirm' ? confirmMethods : cancelMethods;
            const index = Number(button.dataset.branchIndex);
            if (!Number.isInteger(index) || !methods[index]) return;
            if (button.hasAttribute('data-branch-copy')) {
                const copy = JSON.parse(JSON.stringify(methods[index]));
                delete copy.methodId;
                methods.splice(index + 1, 0, registry ? registry.normalize(copy, { assignId: true }) : copy);
                renderConfirmBranches();
                updateAll();
                return;
            }
            if (button.hasAttribute('data-branch-delete')) {
                methods.splice(index, 1);
                renderConfirmBranches();
                updateAll();
                return;
            }
            const currentFormData = collectCurrentFormData();
            const newParentStack = [...currentParentStack, currentFormData];
            customDialogOverlay.classList.remove('active');
            const updated = await showMethodConfigDialog(methods[index], newParentStack);
            if (updated) currentFormData[branch === 'confirm' ? 'confirmMethods' : 'cancelMethods'][index] = updated;
            const result = await showMethodConfigDialog(currentFormData, currentParentStack);
            resolve(result);
        };
        confirmMethodsList.addEventListener('click', handleBranchListClick);
        cancelMethodsList.addEventListener('click', handleBranchListClick);

        nestedMethodsList.addEventListener('click', async event => {
            const moveButton = event.target.closest('[data-move-nested]');
            if (moveButton) {
                const index = Number(moveButton.getAttribute('data-nested-index'));
                const direction = moveButton.getAttribute('data-move-nested');
                const targetIndex = direction === 'up' ? index - 1 : index + 1;
                if (targetIndex >= 0 && targetIndex < nestedMethods.length) {
                    [nestedMethods[index], nestedMethods[targetIndex]] = [nestedMethods[targetIndex], nestedMethods[index]];
                    renderNestedMethods();
                    updateAll();
                }
                return;
            }
            const toggleButton = event.target.closest('[data-toggle-nested]');
            if (toggleButton) {
                const index = Number(toggleButton.getAttribute('data-toggle-nested'));
                if (!nestedMethods[index]) return;
                nestedMethods[index].enabled = nestedMethods[index].enabled === false;
                renderNestedMethods();
                updateAll();
                return;
            }
            const copyButton = event.target.closest('[data-copy-nested]');
            if (copyButton) {
                const index = Number(copyButton.getAttribute('data-copy-nested'));
                if (!nestedMethods[index]) return;
                const copy = JSON.parse(JSON.stringify(nestedMethods[index]));
                delete copy.methodId;
                nestedMethods.splice(index + 1, 0, registry ? registry.normalize(copy, { assignId: true }) : copy);
                renderNestedMethods();
                updateAll();
                return;
            }
            const editButton = event.target.closest('[data-edit-nested]');
            const deleteButton = event.target.closest('[data-delete-nested]');
            if (editButton) {
                const index = Number(editButton.getAttribute('data-edit-nested'));
                if (!Number.isInteger(index) || index < 0 || index >= nestedMethods.length) return;
                const currentFormData = collectCurrentFormData();
                const newParentStack = [...currentParentStack, currentFormData];
                customDialogOverlay.classList.remove('active');
                const updated = await showMethodConfigDialog(nestedMethods[index], newParentStack);
                if (updated) currentFormData.formatMethods[index] = updated;
                const result = await showMethodConfigDialog(currentFormData, currentParentStack);
                resolve(result);
            } else if (deleteButton) {
                const index = Number(deleteButton.getAttribute('data-delete-nested'));
                if (!Number.isInteger(index) || index < 0 || index >= nestedMethods.length) return;
                nestedMethods.splice(index, 1);
                renderNestedMethods();
                updateAll();
            }
        });

        const closeDialog = result => {
            pickerInstances.forEach(picker => picker && picker.destroy());
            destroyDynamicPickers();
            customDialogOverlay.classList.remove('active');
            customDialogMessage.innerHTML = '';
            customDialog.style.maxWidth = '';
            customDialog.style.width = '';
            resolve(result);
        };
        const handleOk = () => {
            const validation = validateForm(true);
            if (validation.errors.length) {
                const firstError = customDialogMessage.querySelector('.has-error');
                if (firstError) firstError.scrollIntoView({ block: 'center', behavior: 'smooth' });
                return;
            }
            const data = validation.data;
            const result = { ...data };
            const action = registry ? registry.getAction(data.methodType) : null;
            if (action && action.targetMode === 'none') {
                delete result.frontAnchor;
                delete result.backAnchor;
            } else if (action && ['reference', 'directory'].includes(action.targetMode)) {
                delete result.backAnchor;
            }
            if (data.methodType === '更换内容') {
                if (!data.backAnchor) {
                    delete result.replaceSourceType;
                    delete result.replaceFromFrontAnchor;
                    delete result.replaceFromBackAnchor;
                    delete result.replaceText;
                } else if (data.replaceSourceType === 'anchor') {
                    delete result.renameTo;
                    delete result.replaceText;
                } else {
                    delete result.renameTo;
                    delete result.replaceFromFrontAnchor;
                    delete result.replaceFromBackAnchor;
                }
            } else if (data.methodType === '添加格式') {
                if (!['color', 'background-color', 'link'].includes(data.formatCommand)) delete result.formatValue;
                if (data.formatCommand !== 'method') {
                    delete result.formatMethods;
                    delete result.formatFallbackText;
                }
            }
            closeDialog(registry ? registry.normalize(result, { assignId: true }) : result);
        };

        const workbench = () => window.SoraMethodWorkbench;
        byId('methodTestBtn').onclick = () => {
            const validation = validateForm(true);
            if (!validation.errors.length && workbench()) workbench().test(validation.data);
        };
        byId('methodApplyPresetBtn').onclick = async () => {
            if (!workbench()) return;
            const currentData = collectCurrentFormData();
            pickerInstances.forEach(picker => picker && picker.destroy());
            destroyDynamicPickers();
            customDialogOverlay.classList.remove('active');
            customDialogMessage.innerHTML = '';
            customDialog.style.maxWidth = '';
            customDialog.style.width = '';
            const preset = await workbench().choosePreset();
            const nextConfig = preset
                ? { ...preset, methodId: currentData.methodId }
                : currentData;
            resolve(await showMethodConfigDialog(nextConfig, currentParentStack));
        };
        byId('methodPresetBtn').onclick = () => {
            const validation = validateForm(true);
            if (!validation.errors.length && workbench()) workbench().savePreset(validation.data);
        };
        byId('methodRelationsBtn').onclick = () => {
            const validation = validateForm(false);
            if (workbench()) workbench().showRelations(validation.data.methodId);
        };
        byId('customDialogOk').onclick = handleOk;
        byId('customDialogCancel').onclick = () => closeDialog(null);
        customDialogClose.onclick = () => closeDialog(null);
        customDialogOverlay.onclick = event => {
            if (event.target === customDialogOverlay) closeDialog(null);
        };
        customDialog.style.maxWidth = '760px';
        customDialog.style.width = 'min(94vw, 760px)';
        const dialogBody = document.getElementById('customDialogBody');
        if (dialogBody) dialogBody.scrollTop = 0;
        customDialogOverlay.classList.add('active');
        setTimeout(() => frontAnchorInput.focus(), 100);
    });
}
