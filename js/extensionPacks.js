(function() {
    'use strict';

    const STORAGE_KEY = 'sora_extension_packs_v1';
    const ALLOWED_CAPABILITIES = new Set(['method-presets', 'component-presets', 'style-tokens']);
    const ALLOWED_COMPONENTS = new Set(['collapse', 'tabs', 'steps', 'progress', 'radio', 'checkbox', 'input', 'faq', 'gallery']);
    const ALLOWED_STYLES = new Set(['accent', 'muted', 'success', 'warning', 'danger', 'compact', 'hidden']);
    let packs = load();

    function load() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    }

    function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
    }

    function validate(pack) {
        const errors = [];
        if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return { errors: ['扩展包必须是 JSON 对象'], normalized: null };
        if (pack.type !== 'SoraExtensionPack') errors.push('type 必须为 SoraExtensionPack');
        if (Number(pack.version) !== 1) errors.push('只支持扩展包版本 1');
        const name = String(pack.name || '').trim().slice(0, 80);
        if (!name) errors.push('缺少扩展包名称');
        const capabilities = Array.isArray(pack.capabilities) ? pack.capabilities.map(String) : [];
        capabilities.forEach(capability => { if (!ALLOWED_CAPABILITIES.has(capability)) errors.push(`未知能力：${capability}`); });
        ['script', 'scripts', 'javascript', 'css', 'remote', 'url'].forEach(key => {
            if (pack[key] !== undefined) errors.push(`不允许的字段：${key}`);
        });
        const methodPresets = Array.isArray(pack.methodPresets) ? pack.methodPresets.slice(0, 100) : [];
        methodPresets.forEach((preset, index) => {
            const config = preset && preset.config;
            const basic = window.SoraMethodRegistry ? window.SoraMethodRegistry.validateBasic(config) : [{ message: '方法注册表不可用' }];
            basic.forEach(error => errors.push(`方法预设 ${index + 1}：${error.message}`));
        });
        const componentPresets = Array.isArray(pack.componentPresets) ? pack.componentPresets.slice(0, 100) : [];
        componentPresets.forEach((preset, index) => {
            if (!preset || !ALLOWED_COMPONENTS.has(String(preset.type || ''))) errors.push(`组件预设 ${index + 1}：类型不受支持`);
        });
        const styleTokens = Array.isArray(pack.styleTokens) ? pack.styleTokens.slice(0, 20).map(String) : [];
        styleTokens.forEach(token => { if (!ALLOWED_STYLES.has(token)) errors.push(`样式令牌不受支持：${token}`); });
        const normalized = {
            type: 'SoraExtensionPack',
            version: 1,
            id: String(pack.id || name).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80),
            name,
            description: String(pack.description || '').trim().slice(0, 300),
            capabilities: Array.from(new Set(capabilities)),
            methodPresets: methodPresets.map(preset => ({ name: String(preset.name || '未命名预设').slice(0, 80), config: window.SoraMethodRegistry.normalize(preset.config, { clone: true, assignId: false }) })),
            componentPresets: componentPresets.map(preset => ({ name: String(preset.name || preset.type).slice(0, 80), type: String(preset.type), label: String(preset.label || '').slice(0, 120) })),
            styleTokens: Array.from(new Set(styleTokens))
        };
        return { errors: Array.from(new Set(errors)), normalized };
    }

    function install(pack) {
        const result = validate(pack);
        if (result.errors.length) return result;
        packs = [result.normalized, ...packs.filter(item => item.id !== result.normalized.id)].slice(0, 30);
        persist();
        result.normalized.methodPresets.forEach(preset => window.SoraMethodWorkbench?.savePreset(preset.config, preset.name));
        return result;
    }

    function example() {
        return {
            type: 'SoraExtensionPack',
            version: 1,
            id: 'reading-tools',
            name: '阅读交互预设',
            description: '只包含受控方法与组件声明，不包含脚本或 CSS。',
            capabilities: ['method-presets', 'component-presets'],
            methodPresets: [{ name: '点击显示提示', config: { trigger: 'click', methodType: '显示提示', message: '提示内容', tone: 'info' } }],
            componentPresets: [{ name: '常见问题', type: 'faq', label: '常见问题' }],
            styleTokens: []
        };
    }

    function describe(result) {
        if (result.errors.length) return `拒绝导入：\n${result.errors.map(error => `• ${error}`).join('\n')}`;
        const pack = result.normalized;
        return `兼容版本 1\n声明能力：${pack.capabilities.join('、') || '无'}\n方法预设：${pack.methodPresets.length}\n组件预设：${pack.componentPresets.length}\n受控样式：${pack.styleTokens.join('、') || '无'}\n不会执行脚本、事件属性、远程资源或任意 CSS。`;
    }

    function open() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<p>粘贴扩展包 JSON 后先检查权限与兼容性；只有受控方法预设、组件预设和样式令牌可以导入。</p><textarea class="form-control" rows="12" aria-label="扩展包 JSON"></textarea><pre class="method-test-panel" data-result>尚未检查。</pre><div class="method-workbench-actions"><button type="button" data-example>填入示例</button><button type="button" data-copy-installed>复制已安装清单</button><button type="button" data-inspect>检查</button><button type="button" data-install disabled>导入兼容项</button></div><h3>已安装扩展包</h3><div data-installed></div>`;
        const textarea = wrapper.querySelector('textarea');
        const resultBox = wrapper.querySelector('[data-result]');
        const installButton = wrapper.querySelector('[data-install]');
        let inspected = null;
        const renderInstalled = () => {
            const container = wrapper.querySelector('[data-installed]');
            container.innerHTML = packs.length ? packs.map(pack => `<div class="method-preset-row"><span><strong>${escapeHtml(pack.name)}</strong><br><small>${escapeHtml(pack.capabilities.join('、') || '无额外能力')}</small></span><button type="button" data-remove-pack="${escapeHtml(pack.id)}">移除</button></div>`).join('') : '<p class="command-empty">尚未安装扩展包。</p>';
        };
        wrapper.querySelector('[data-example]').addEventListener('click', () => { textarea.value = JSON.stringify(example(), null, 2); });
        wrapper.querySelector('[data-inspect]').addEventListener('click', () => {
            try { inspected = validate(JSON.parse(textarea.value)); }
            catch (error) { inspected = { errors: [`JSON 无法解析：${error.message}`], normalized: null }; }
            resultBox.textContent = describe(inspected);
            installButton.disabled = inspected.errors.length > 0;
        });
        installButton.addEventListener('click', () => {
            if (!inspected || inspected.errors.length) return;
            const result = install(inspected.normalized);
            if (!result.errors.length) {
                resultBox.textContent = `已导入“${result.normalized.name}”。${describe(result)}`;
                installButton.disabled = true;
                renderInstalled();
            }
        });
        wrapper.querySelector('[data-copy-installed]').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(JSON.stringify(packs, null, 2));
                resultBox.textContent = '已复制已安装扩展包清单。';
            } catch (_) { resultBox.textContent = '当前环境不能写入剪贴板。'; }
        });
        wrapper.querySelector('[data-installed]').addEventListener('click', async event => {
            const button = event.target.closest('[data-remove-pack]');
            if (!button) return;
            const pack = packs.find(item => item.id === button.dataset.removePack);
            if (!pack || !await customConfirm(`移除扩展包“${pack.name}”？已写入正文的方法不会被删除。`, '移除', '取消', '移除扩展包')) return;
            packs = packs.filter(item => item.id !== pack.id);
            persist();
            renderInstalled();
        });
        renderInstalled();
        FeatureDialog.open('声明式扩展包', wrapper);
    }

    window.SoraExtensionPacks = { validate, install, list: () => packs.slice(), example, open };
    window.SoraFeatureCommands = window.SoraFeatureCommands || [];
    window.SoraFeatureCommands.push({ key: 'extension-packs', title: '声明式扩展包', icon: '⬡', meta: '检查权限并导入受控方法和组件预设', keywords: '扩展 包 权限 兼容 方法 组件', run: open });
})();
