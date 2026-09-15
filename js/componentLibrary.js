(function() {
    'use strict';

    function insertMethod(config, label) {
        if (!window.markdownPreview || !window.DirectoryNavigation?.getCurrentDirId()) return false;
        const method = window.SoraMethodRegistry.normalize(config, { clone: true, assignId: true });
        const link = document.createElement('a');
        link.href = '#';
        link.dataset.soraLink = 'method';
        link.dataset.soraMethods = JSON.stringify([method]);
        link.textContent = label || '组件';
        const selection = window.getSelection();
        let range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        const container = range && (range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer);
        if (!container || !markdownPreview.contains(container)) {
            range = document.createRange();
            range.selectNodeContents(markdownPreview);
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
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<p>组件只使用受控结构和样式；需先用前、后锚点圈定内容范围。标签页、步骤条、问答和图库会在导出页中转换为可访问组件。</p><div class="method-form-grid"><label>组件类型<select class="form-control" data-type>${definitions.componentType.options.map(option => `<option value="${escapeHtml(option[0])}">${escapeHtml(option[1])}</option>`).join('')}</select></label><label>组件标题<input class="form-control" data-label maxlength="100" value="内容"></label><label>目录或前锚点<input class="form-control" data-front placeholder="搜索目录或锚点"></label><label>后锚点<input class="form-control" data-back placeholder="搜索同目录锚点"></label></div><div class="method-workbench-actions"><button type="button" data-insert>插入组件方法</button></div>`;
        const front = wrapper.querySelector('[data-front]');
        const back = wrapper.querySelector('[data-back]');
        window.SoraReferencePicker?.attach(front, { currentDirId: currentId, showScopes: true, allowDirectory: false });
        window.SoraReferencePicker?.attach(back, { currentDirId: currentId, showScopes: false, allowDirectory: false, filterDirectoryId: () => {
            const resolved = window.SoraReferencePicker.resolve(front.value, window.SoraReferencePicker.buildIndex(), currentId);
            return resolved.directory?.id || currentId;
        } });
        wrapper.querySelector('[data-insert]').addEventListener('click', () => {
            const config = { trigger: 'click', methodType: '插入组件', componentType: wrapper.querySelector('[data-type]').value, componentLabel: wrapper.querySelector('[data-label]').value.trim(), frontAnchor: front.value.trim(), backAnchor: back.value.trim() };
            const errors = window.SoraMethodRegistry.validateBasic(config);
            if (errors.length) {
                showToast(errors[0].message, 'warning', 2400);
                return;
            }
            if (insertMethod(config, config.componentLabel || '组件')) {
                FeatureDialog.close();
                showToast('已插入受控组件方法', 'success', 1800);
            }
        });
        FeatureDialog.open('受控组件库', wrapper);
    }

    window.SoraComponentLibrary = { insertMethod, open };
    window.SoraFeatureCommands = window.SoraFeatureCommands || [];
    window.SoraFeatureCommands.push({ key: 'component-library', title: '受控组件库', icon: '▦', meta: '折叠区、标签页、步骤条、问答、图库与表单组件', keywords: '组件 折叠 标签 步骤 问答 图库', disabledReason: () => window.DirectoryNavigation?.getCurrentDirId() ? '' : '请先选择目录', run: open });
})();
