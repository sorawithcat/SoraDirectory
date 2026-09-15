(function() {
    'use strict';

    const CONFIG_VERSION = 2;

    const triggers = [
        { value: 'open', label: '打开网页时', category: '页面' },
        { value: 'enter_dir', label: '选中目录后', category: '目录' },
        { value: 'leave_dir', label: '离开目录前', category: '目录' },
        { value: 'click', label: '点击时', category: '指针' },
        { value: 'dblclick', label: '双击时', category: '指针' },
        { value: 'longpress', label: '长按时', category: '指针', fields: ['longPressMs'], requiredFields: ['longPressMs'] },
        { value: 'hover', label: '悬浮时', category: '指针' },
        { value: 'visible', label: '进入可视区域时', category: '页面', fields: ['visibleThreshold'] },
        { value: 'change', label: '输入或选项变化时', category: '表单' },
        { value: 'media_end', label: '音视频播放结束时', category: '媒体' },
        { value: 'keyboard', label: '按下快捷键时', category: '键盘', fields: ['shortcut'], requiredFields: ['shortcut'] },
        { value: 'delay', label: '延时后', category: '时间', fields: ['triggerDelayMs'], requiredFields: ['triggerDelayMs'] },
        { value: 'interval', label: '定时重复时', category: '时间', fields: ['intervalMs'], requiredFields: ['intervalMs'] }
    ];

    const actions = [
        { value: '隐藏', label: '隐藏', category: '可见性', targetMode: 'directoryOrRange', runtimeHandler: 'visibility_hide' },
        { value: '隐藏（初始不隐藏）', label: '隐藏（初始不隐藏）', category: '可见性', targetMode: 'directoryOrRange', runtimeHandler: 'visibility_hide_initially_visible' },
        { value: '显示', label: '显示', category: '可见性', targetMode: 'directoryOrRange', runtimeHandler: 'visibility_show' },
        { value: '切换', label: '切换显示状态', category: '可见性', targetMode: 'directoryOrRange', runtimeHandler: 'visibility_toggle' },
        { value: '更换内容', label: '更换内容或目录名', category: '内容', targetMode: 'directoryOrRange', runtimeHandler: 'change_content' },
        { value: '添加格式', label: '添加格式', category: '样式', targetMode: 'range', runtimeHandler: 'add_format' },
        { value: '目录右键动作', label: '执行目录动作', category: '目录', targetMode: 'directory', runtimeHandler: 'directory_action' },

        { value: '跳转', label: '跳转到目录或锚点', category: '导航', targetMode: 'reference', runtimeHandler: 'navigate' },
        { value: '返回上一位置', label: '返回上一浏览位置', category: '导航', targetMode: 'none', runtimeHandler: 'navigate_back' },
        { value: '相邻目录', label: '跳转到相邻目录', category: '导航', targetMode: 'none', runtimeHandler: 'navigate_sibling', fields: ['siblingDirection'], requiredFields: ['siblingDirection'] },
        { value: '展开并跳转', label: '展开目录并跳转', category: '导航', targetMode: 'reference', runtimeHandler: 'expand_navigate' },

        { value: '插入内容', label: '插入内容', category: '内容', targetMode: 'directoryOrRange', runtimeHandler: 'insert_content', fields: ['insertPosition', 'contentSourceType', 'contentText', 'contentFrontAnchor', 'contentBackAnchor'], requiredFields: ['insertPosition', 'contentSourceType'] },
        { value: '清空范围', label: '清空锚点范围', category: '内容', targetMode: 'range', runtimeHandler: 'clear_range' },
        { value: '删除范围', label: '删除锚点及范围', category: '内容', targetMode: 'range', runtimeHandler: 'delete_range' },
        { value: '传送范围', label: '复制、移动或交换范围', category: '内容', targetMode: 'range', runtimeHandler: 'transfer_range', fields: ['transferMode', 'destinationFrontAnchor', 'destinationBackAnchor'], requiredFields: ['transferMode', 'destinationFrontAnchor', 'destinationBackAnchor'] },
        { value: '模板内容', label: '生成模板内容', category: '内容', targetMode: 'directoryOrRange', runtimeHandler: 'template_content', fields: ['templateText'], requiredFields: ['templateText'] },

        { value: '设置变量', label: '设置变量', category: '状态', targetMode: 'none', runtimeHandler: 'variable_set', fields: ['variableName', 'variableType', 'variableValue', 'variableScope'], requiredFields: ['variableName', 'variableType', 'variableScope'] },
        { value: '调整变量', label: '增加或减少变量', category: '状态', targetMode: 'none', runtimeHandler: 'variable_adjust', fields: ['variableName', 'variableDelta', 'variableScope'], requiredFields: ['variableName', 'variableDelta', 'variableScope'] },
        { value: '切换变量', label: '切换布尔变量', category: '状态', targetMode: 'none', runtimeHandler: 'variable_toggle', fields: ['variableName', 'variableScope'], requiredFields: ['variableName', 'variableScope'] },
        { value: '显示状态', label: '显示变量、计数或进度', category: '状态', targetMode: 'optional', runtimeHandler: 'state_display', fields: ['stateDisplayType', 'variableName'], requiredFields: ['stateDisplayType', 'variableName'] },

        { value: '显示提示', label: '显示自定义提示', category: '交互', targetMode: 'none', runtimeHandler: 'toast', fields: ['message', 'tone'], requiredFields: ['message', 'tone'] },
        { value: '交互确认', label: '请求用户确认', category: '交互', targetMode: 'none', runtimeHandler: 'confirm', fields: ['message', 'confirmTimeoutMs', 'confirmDefault'], requiredFields: ['message'] },
        { value: '显示面板', label: '打开弹层、抽屉或侧栏', category: '交互', targetMode: 'none', runtimeHandler: 'panel', fields: ['panelMode', 'message'], requiredFields: ['panelMode', 'message'] },
        { value: '插入组件', label: '插入交互组件', category: '交互', targetMode: 'range', runtimeHandler: 'component', fields: ['componentType', 'componentLabel'], requiredFields: ['componentType'] },
        { value: '受控样式', label: '添加、移除或切换样式', category: '样式', targetMode: 'range', runtimeHandler: 'class_control', fields: ['classOperation', 'classToken'], requiredFields: ['classOperation', 'classToken'] },
        { value: '播放动画', label: '播放动画预设', category: '样式', targetMode: 'range', runtimeHandler: 'animation', fields: ['animationName'], requiredFields: ['animationName'] }
    ];

    const fieldDefinitions = {
        longPressMs: { label: '长按时长', type: 'number', defaultValue: 600, min: 300, max: 3000, suffix: '毫秒' },
        visibleThreshold: { label: '可视比例', type: 'number', defaultValue: 0.35, min: 0, max: 1, step: 0.05 },
        shortcut: { label: '快捷键', type: 'text', defaultValue: 'Ctrl+Enter', placeholder: '例如 Ctrl+Enter' },
        triggerDelayMs: { label: '触发延时', type: 'number', defaultValue: 1000, min: 0, max: 86400000, suffix: '毫秒' },
        intervalMs: { label: '定时间隔', type: 'number', defaultValue: 5000, min: 250, max: 86400000, suffix: '毫秒' },
        siblingDirection: { label: '目录方向', type: 'select', defaultValue: 'next', options: [['next', '下一个同级目录'], ['previous', '上一个同级目录']] },
        insertPosition: { label: '插入位置', type: 'select', defaultValue: 'after', options: [['before', '范围之前'], ['after', '范围之后'], ['start', '范围开头'], ['end', '范围末尾']] },
        contentSourceType: { label: '内容来源', type: 'select', defaultValue: 'text', options: [['text', '直接文本'], ['reference', '目录或锚点范围'], ['template', '模板文本']] },
        contentText: { label: '插入内容', type: 'textarea', placeholder: '输入文本或模板内容' },
        contentFrontAnchor: { label: '来源目录或前锚点', type: 'reference' },
        contentBackAnchor: { label: '来源后锚点', type: 'reference' },
        transferMode: { label: '传送方式', type: 'select', defaultValue: 'copy', options: [['copy', '复制'], ['move', '移动'], ['swap', '交换']] },
        destinationFrontAnchor: { label: '目标前锚点', type: 'reference' },
        destinationBackAnchor: { label: '目标后锚点', type: 'reference' },
        templateText: { label: '模板内容', type: 'textarea', placeholder: '支持 {{目录名}}、{{日期}} 和 {{变量名}}' },
        variableName: { label: '变量名', type: 'text', placeholder: '例如 progress' },
        variableType: { label: '变量类型', type: 'select', defaultValue: 'text', options: [['text', '文本'], ['number', '数字'], ['boolean', '布尔值']] },
        variableValue: { label: '变量值', type: 'text' },
        variableDelta: { label: '增减数值', type: 'number', defaultValue: 1 },
        variableScope: { label: '状态范围', type: 'select', defaultValue: 'session', options: [['page', '当前页面'], ['session', '当前会话'], ['local', '本地持久化']] },
        stateDisplayType: { label: '展示类型', type: 'select', defaultValue: 'value', options: [['value', '变量值'], ['counter', '计数器'], ['progress', '进度条'], ['complete', '完成状态']] },
        message: { label: '显示内容', type: 'textarea' },
        tone: { label: '提示样式', type: 'select', defaultValue: 'info', options: [['info', '信息'], ['success', '成功'], ['warning', '警告'], ['error', '错误']] },
        confirmTimeoutMs: { label: '自动选择等待', type: 'number', defaultValue: 0, min: 0, max: 600000, suffix: '毫秒，0 表示一直等待' },
        confirmDefault: { label: '超时默认结果', type: 'select', defaultValue: 'cancel', options: [['cancel', '取消'], ['confirm', '确认']] },
        panelMode: { label: '面板形式', type: 'select', defaultValue: 'modal', options: [['modal', '弹层'], ['drawer', '抽屉'], ['sidebar', '侧栏']] },
        componentType: { label: '组件类型', type: 'select', defaultValue: 'collapse', options: [['collapse', '折叠区'], ['tabs', '标签页'], ['steps', '步骤内容'], ['progress', '进度条'], ['radio', '单选'], ['checkbox', '多选'], ['input', '文本输入']] },
        componentLabel: { label: '组件标题', type: 'text' },
        classOperation: { label: '样式操作', type: 'select', defaultValue: 'toggle', options: [['add', '添加'], ['remove', '移除'], ['toggle', '切换']] },
        classToken: { label: '受控样式', type: 'select', defaultValue: 'accent', options: [['accent', '强调'], ['muted', '弱化'], ['success', '成功'], ['warning', '警告'], ['danger', '危险'], ['compact', '紧凑'], ['hidden', '隐藏']] },
        animationName: { label: '动画预设', type: 'select', defaultValue: 'fade', options: [['fade', '淡入'], ['expand', '展开'], ['slide', '滑入'], ['emphasis', '强调']] }
    };

    const conditionTypes = [
        { value: 'variable', label: '变量比较' },
        { value: 'execution_count', label: '执行次数' },
        { value: 'visible', label: '元素是否可见' },
        { value: 'checkbox', label: '复选框状态' },
        { value: 'input_value', label: '输入值' },
        { value: 'current_dir', label: '当前目录' }
    ];

    const comparisonOperators = [
        ['equals', '等于'], ['not_equals', '不等于'], ['greater', '大于'], ['less', '小于'],
        ['contains', '包含'], ['truthy', '为真'], ['falsy', '为假']
    ].map(([value, label]) => ({ value, label }));

    const formatCommands = [
        ['bold', '粗体'], ['italic', '斜体'], ['underline', '下划线'], ['strikethrough', '删除线'],
        ['highlight', '高亮'], ['spoiler', '防剧透'], ['superscript', '上标'], ['subscript', '下标'],
        ['code', '行内代码'], ['color', '文字颜色'], ['background-color', '背景颜色'], ['link', '链接'],
        ['method', '方法（嵌套）']
    ].map(([value, label]) => ({ value, label }));

    const directoryActions = [
        '复制目录ID', '删除目录', '复制目录（含子目录）', '复制目录（不含子目录）', '粘贴目录',
        '快速复制目录（含子目录）', '快速复制目录（不含子目录）', '展开此目录', '收起此目录'
    ].map(value => ({ value, label: value }));

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createMethodId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return 'm_' + window.crypto.randomUUID().replace(/-/g, '').slice(0, 18);
        }
        return 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function getTrigger(value) {
        return triggers.find(item => item.value === value) || null;
    }

    function getAction(value) {
        return actions.find(item => item.value === value) || null;
    }

    function applyFieldDefaults(cfg) {
        const trigger = getTrigger(cfg.trigger);
        const action = getAction(cfg.methodType);
        const keys = [
            ...(trigger && trigger.fields ? trigger.fields : []),
            ...(action && action.fields ? action.fields : [])
        ];
        keys.forEach(key => {
            const definition = fieldDefinitions[key];
            if (definition && cfg[key] === undefined && definition.defaultValue !== undefined) {
                cfg[key] = definition.defaultValue;
            }
        });
    }

    function normalizeCondition(condition) {
        if (!condition || typeof condition !== 'object') return null;
        const result = { ...condition };
        result.type = result.type || 'variable';
        result.operator = result.operator || 'equals';
        result.join = result.join === 'OR' ? 'OR' : 'AND';
        return result;
    }

    function normalize(config, options = {}) {
        if (!config || typeof config !== 'object') return null;
        const cfg = options.clone ? clone(config) : config;
        cfg.configVersion = CONFIG_VERSION;
        if (!cfg.trigger) cfg.trigger = 'click';
        if (cfg.enabled === undefined) cfg.enabled = true;
        if (!cfg.formatCommand && cfg.formatType) {
            cfg.formatCommand = cfg.formatType;
            delete cfg.formatType;
        }
        cfg.delayMs = Math.max(0, Number(cfg.delayMs) || 0);
        cfg.debounceMs = Math.max(0, Number(cfg.debounceMs) || 0);
        cfg.throttleMs = Math.max(0, Number(cfg.throttleMs) || 0);
        cfg.maxExecutions = Math.max(1, Math.min(1000, Number(cfg.maxExecutions) || (cfg.once ? 1 : 20)));
        cfg.failureMode = ['stop', 'skip', 'fallback'].includes(cfg.failureMode) ? cfg.failureMode : 'stop';
        cfg.conditions = Array.isArray(cfg.conditions) ? cfg.conditions.map(normalizeCondition).filter(Boolean) : [];
        ['formatMethods', 'elseMethods', 'confirmMethods', 'cancelMethods'].forEach(key => {
            if (!Array.isArray(cfg[key])) return;
            cfg[key] = cfg[key].map(item => normalize(item, options)).filter(Boolean);
        });
        if (options.assignId !== false && !cfg.methodId) {
            cfg.methodId = typeof options.idFactory === 'function' ? options.idFactory() : createMethodId();
        }
        applyFieldDefaults(cfg);
        return cfg;
    }

    function targetText(cfg, action) {
        if (action && action.targetMode === 'none') return '当前页面状态';
        if (!cfg.frontAnchor) return '未设置目标';
        return cfg.backAnchor ? `${cfg.frontAnchor} 至 ${cfg.backAnchor}` : cfg.frontAnchor;
    }

    function actionDetail(cfg) {
        if (cfg.methodType === '相邻目录') return cfg.siblingDirection === 'previous' ? '上一个同级目录' : '下一个同级目录';
        if (['设置变量', '调整变量', '切换变量'].includes(cfg.methodType)) return cfg.variableName ? `“${cfg.variableName}”` : '未命名变量';
        if (cfg.methodType === '显示提示') return cfg.message ? `“${String(cfg.message).slice(0, 30)}”` : '空提示';
        if (cfg.methodType === '插入组件') return fieldDefinitions.componentType.options.find(item => item[0] === cfg.componentType)?.[1] || '';
        if (cfg.methodType === '播放动画') return fieldDefinitions.animationName.options.find(item => item[0] === cfg.animationName)?.[1] || '';
        return '';
    }

    function summarize(config) {
        const cfg = normalize(config, { assignId: false, clone: true });
        if (!cfg) return '方法尚未配置';
        const trigger = getTrigger(cfg.trigger);
        const action = getAction(cfg.methodType);
        const detail = actionDetail(cfg);
        const parts = [
            cfg.enabled === false ? '已禁用：' : '',
            `当${trigger ? trigger.label : (cfg.trigger || '未知触发')}，`,
            `对${targetText(cfg, action)}执行${action ? action.label : (cfg.methodType || '未知动作')}`,
            detail ? `（${detail}）` : ''
        ];
        if (cfg.conditions.length) parts.push(`，满足 ${cfg.conditions.length} 个条件时`);
        if (cfg.delayMs) parts.push(`，延迟 ${cfg.delayMs} 毫秒`);
        if (cfg.once) parts.push('，仅执行一次');
        return parts.join('');
    }

    function validateBasic(config) {
        const cfg = normalize(config, { assignId: false, clone: true });
        const errors = [];
        if (!cfg) return [{ field: 'method', message: '方法配置无效' }];
        const trigger = getTrigger(cfg.trigger);
        const action = getAction(cfg.methodType);
        if (!trigger) errors.push({ field: 'trigger', message: `不支持的触发方式：${cfg.trigger || '未设置'}` });
        if (!action) errors.push({ field: 'methodType', message: `不支持的方法类型：${cfg.methodType || '未设置'}` });
        if (action && !['none', 'optional'].includes(action.targetMode) && !String(cfg.frontAnchor || '').trim()) {
            errors.push({ field: 'frontAnchor', message: '请选择目标目录或前锚点' });
        }
        if (action && action.targetMode === 'range' && !String(cfg.backAnchor || '').trim()) {
            errors.push({ field: 'backAnchor', message: `${action.label}需要完整的前后锚点范围` });
        }
        if (action && action.targetMode === 'directory' && String(cfg.backAnchor || '').trim()) {
            errors.push({ field: 'backAnchor', message: `${action.label}只能作用于目录` });
        }
        const requiredFields = [
            ...(trigger && trigger.requiredFields ? trigger.requiredFields : []),
            ...(action && action.requiredFields ? action.requiredFields : [])
        ];
        requiredFields.forEach(key => {
            if (cfg[key] === undefined || cfg[key] === null || String(cfg[key]).trim() === '') {
                errors.push({ field: key, message: `请填写${fieldDefinitions[key]?.label || key}` });
            }
        });
        cfg.conditions.forEach((condition, index) => {
            if (!conditionTypes.some(item => item.value === condition.type)) {
                errors.push({ field: 'conditions', message: `条件 ${index + 1} 的类型无效` });
            }
            if (condition.type === 'variable' && !String(condition.key || '').trim()) {
                errors.push({ field: 'conditions', message: `条件 ${index + 1} 缺少变量名` });
            }
        });
        return errors;
    }

    function getRuntimeHandlerMap() {
        return actions.reduce((result, action) => {
            result[action.value] = action.runtimeHandler;
            return result;
        }, {});
    }

    window.SoraMethodRegistry = Object.freeze({
        CONFIG_VERSION,
        getTriggers: () => triggers.map(item => ({ ...item })),
        getActions: () => actions.map(item => ({ ...item })),
        getFieldDefinitions: () => clone(fieldDefinitions),
        getConditionTypes: () => conditionTypes.map(item => ({ ...item })),
        getComparisonOperators: () => comparisonOperators.map(item => ({ ...item })),
        getFormatCommands: () => formatCommands.map(item => ({ ...item })),
        getDirectoryActions: () => directoryActions.map(item => ({ ...item })),
        getTrigger,
        getAction,
        normalize,
        summarize,
        validateBasic,
        getRuntimeHandlerMap
    });
})();
