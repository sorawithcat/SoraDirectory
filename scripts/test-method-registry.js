const assert = require('node:assert/strict');

global.window = {
    crypto: {
        randomUUID: () => '12345678-1234-1234-1234-123456789012'
    }
};

require('../js/methodRegistry.js');

const registry = window.SoraMethodRegistry;
assert.equal(registry.CONFIG_VERSION, 2);
assert.ok(registry.getTriggers().some(item => item.value === 'keyboard'));
assert.ok(registry.getActions().some(item => item.value === '设置变量'));
assert.ok(registry.getActions().some(item => item.value === '插入组件'));

const oldConfig = {
    trigger: 'click',
    frontAnchor: 'dir:demo',
    methodType: '隐藏',
    formatType: 'bold',
    futureField: { keep: true }
};
const normalized = registry.normalize(oldConfig, { assignId: false, clone: true });
assert.equal(normalized.configVersion, 2);
assert.equal(normalized.formatCommand, 'bold');
assert.equal(normalized.formatType, undefined);
assert.deepEqual(normalized.futureField, { keep: true });
assert.equal(oldConfig.formatType, 'bold');
assert.equal(oldConfig.configVersion, undefined);

const variableConfig = registry.normalize({
    trigger: 'keyboard',
    methodType: '设置变量',
    variableName: 'progress',
    variableValue: '1'
}, { assignId: true, clone: true });
assert.equal(variableConfig.shortcut, 'Ctrl+Enter');
assert.equal(variableConfig.variableType, 'text');
assert.equal(variableConfig.variableScope, 'session');
assert.match(variableConfig.methodId, /^m_/);
assert.deepEqual(registry.validateBasic(variableConfig), []);

const invalidRange = registry.normalize({
    trigger: 'click',
    methodType: '清空范围',
    frontAnchor: '#start'
}, { assignId: false, clone: true });
assert.ok(registry.validateBasic(invalidRange).some(error => error.field === 'backAnchor'));

const handlers = registry.getRuntimeHandlerMap();
assert.equal(handlers['隐藏'], 'visibility_hide');
assert.equal(handlers['跳转'], 'navigate');
assert.equal(handlers['播放动画'], 'animation');

console.log('Method registry contract tests passed.');
