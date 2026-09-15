(function() {
    'use strict';

    function insertMethod(config, label) {
        const editorRoot = document.querySelector('.markdown-preview');
        if (!editorRoot || !window.DirectoryNavigation?.getCurrentDirId()) return false;
        const method = window.SoraMethodRegistry.normalize(config, { clone: true, assignId: true });
        const link = document.createElement('a');
        link.href = '#';
        link.dataset.soraLink = 'method';
        link.dataset.soraMethods = JSON.stringify([method]);
        link.textContent = label || '组件';
        const selection = window.getSelection();
        let range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        const container = range && (range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer);
        if (!container || !editorRoot.contains(container)) {
            range = document.createRange();
            range.selectNodeContents(editorRoot);
            range.collapse(false);
        }
        range.deleteContents();
        range.insertNode(link);
        link.after(document.createTextNode(' '));
        syncPreviewToTextarea();
        return true;
    }

    function open() {
        const currentId = window.DirectoryNavigation?.getCurrentDirId();
        if (!currentId) {
            showToast('请先选择目录', 'warning', 1800);
            return;
        }
        const definitions = window.SoraMethodRegistry.getFieldDefinitions();
        const componentPresets = window.SoraExtensionPacks?.getComponentPresets?.() || [];
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<p><strong>用途：</strong>把两个锚点之间的现有内容转换为受控交互组件，不允许任意脚本或样式。</p><ol><li>先在正文中插入前、后两个锚点。</li><li>选择组件类型和同一目录内的两个锚点。</li><li>插入后编辑器会出现一个“ƒ 方法”链接；导出网页中点击该链接才会转换内容。</li></ol><div class="method-form-grid">${componentPresets.length ? `<label>扩展包组件预设<select class="form-control" data-preset><option value="">自定义</option>${componentPresets.map((preset, index) => `<option value="${index}">${escapeHtml(preset.packName)} · ${escapeHtml(preset.name)}</option>`).join('')}</select></label>` : ''}<label>组件类型<select class="form-control" data-type>${definitions.componentType.options.map(option => `<option value="${escapeHtml(option[0])}">${escapeHtml(option[1])}</option>`).join('')}</select></label><label>组件标题<input class="form-control" data-label maxlength="100" value="内容"></label><label>目录或前锚点<input class="form-control" data-front placeholder="搜索目录或锚点"></label><label>后锚点<input class="form-control" data-back placeholder="搜索同目录锚点"></label></div><small data-component-hint></small><small class="method-field-error" data-component-error role="alert"></small><div class="method-workbench-actions"><button type="button" data-insert>插入组件方法</button></div>`;
        const front = wrapper.querySelector('[data-front]');
        const back = wrapper.querySelector('[data-back]');
        const type = wrapper.querySelector('[data-type]');
        const label = wrapper.querySelector('[data-label]');
        const preset = wrapper.querySelector('[data-preset]');
        const hint = wrapper.querySelector('[data-component-hint]');
        const error = wrapper.querySelector('[data-component-error]');
        const componentHints = {
            collapse: '折叠区会把范围内全部内容放进可展开区域。',
            tabs: '标签页会按范围内的标题分组；每个标题成为一个标签。',
            steps: '步骤条会按范围内的标题分组；每个标题成为一个步骤。',
            faq: '问答列表会按范围内的标题分组；标题成为问题，后续内容成为答案。',
            gallery: '图库会收集范围内的图片或 figure；没有图片时组件为空。',
            progress: '进度条会替换锚点范围，初始值为 0%。',
            radio: '单选组件会替换锚点范围。',
            checkbox: '多选组件会替换锚点范围。',
            input: '文本输入组件会替换锚点范围。'
        };
        const setError = message => {
            error.textContent = message || '';
        };
        const updateHint = () => {
            hint.textContent = componentHints[type.value] || '';
        };
        updateHint();
        type.addEventListener('change', updateHint);
        preset?.addEventListener('change', () => {
            const selected = componentPresets[Number(preset.value)];
            if (!selected || preset.value === '') return;
            type.value = selected.type;
            label.value = selected.label || selected.name;
            updateHint();
        });
        [front, back].forEach(input => {
            input.addEventListener('input', () => setError(''));
            input.addEventListener('change', () => setError(''));
        });
        window.SoraReferencePicker?.attach(front, { currentDirId: currentId, showScopes: true, allowDirectory: false });
        window.SoraReferencePicker?.attach(back, { currentDirId: currentId, showScopes: false, allowDirectory: false, filterDirectoryId: () => {
            const resolved = window.SoraReferencePicker.resolve(front.value, window.SoraReferencePicker.buildIndex(), currentId);
            return resolved.directory?.id || currentId;
        } });
        wrapper.querySelector('[data-insert]').addEventListener('click', () => {
            const config = { trigger: 'click', methodType: '插入组件', componentType: type.value, componentLabel: label.value.trim(), frontAnchor: front.value.trim(), backAnchor: back.value.trim() };
            const errors = window.SoraMethodRegistry.validateBasic(config);
            if (errors.length) {
                setError(errors[0].message);
                return;
            }
            const referencePicker = window.SoraReferencePicker;
            const index = referencePicker?.buildIndex();
            const frontTarget = referencePicker?.resolve(front.value, index, currentId);
            const backTarget = referencePicker?.resolve(back.value, index, currentId);
            if (!frontTarget?.exists || frontTarget.type !== 'anchor') {
                setError(frontTarget?.error || '请选择有效的前锚点');
                return;
            }
            if (!backTarget?.exists || backTarget.type !== 'anchor') {
                setError(backTarget?.error || '请选择有效的后锚点');
                return;
            }
            if (frontTarget.directory.id !== backTarget.directory.id) {
                setError('前、后锚点必须位于同一目录');
                return;
            }
            if (frontTarget.anchor.order >= backTarget.anchor.order) {
                setError('后锚点必须位于前锚点之后');
                return;
            }
            if (insertMethod(config, config.componentLabel || '组件')) {
                FeatureDialog.close();
                showToast('已插入受控组件方法', 'success', 1800);
                return;
            }
            setError('未能写入当前编辑区，请重新选择目录后再试');
        });
        FeatureDialog.open('受控组件库', wrapper);
    }

    window.SoraComponentLibrary = { insertMethod, open };
    window.SoraFeatureCommands = window.SoraFeatureCommands || [];
    window.SoraFeatureCommands.push({ key: 'component-library', title: '受控组件库', icon: '▦', meta: '折叠区、标签页、步骤条、问答、图库与表单组件', keywords: '组件 折叠 标签 步骤 问答 图库', disabledReason: () => window.DirectoryNavigation?.getCurrentDirId() ? '' : '请先选择目录', run: open });
})();
