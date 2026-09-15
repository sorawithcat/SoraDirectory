const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

const context = vm.createContext({ window: {}, console });
vm.runInContext(readFileSync('js/methodRegistry.js', 'utf8'), context);
vm.runInContext(readFileSync('js/methodRuntimeCore.js', 'utf8'), context);

const registry = context.window.SoraMethodRegistry;
const core = context.window.SoraMethodRuntimeCore;

assert.equal(core.compareValue(3, 'greater', 2), true);
assert.equal(core.compareValue('alpha', 'contains', 'ph'), true);
assert.equal(core.compareValue(false, 'falsy', ''), true);

const config = {
    methodType: '显示',
    conditions: [
        { type: 'variable', key: 'a', operator: 'equals', value: '1' },
        { type: 'variable', key: 'b', operator: 'greater', value: '2', join: 'AND' },
        { type: 'variable', key: 'c', operator: 'truthy', join: 'OR' }
    ]
};
assert.equal(core.evaluateConditions(config, condition => ({ a: '1', b: 3, c: false })[condition.key]), true);
assert.equal(core.evaluateConditions(config, condition => ({ a: '0', b: 3, c: false })[condition.key]), false);

const handlers = registry.getRuntimeHandlerMap();
registry.getActions().forEach(action => {
    const result = core.dispatchAction({ methodType: action.value }, handlers, handler => handler === action.runtimeHandler);
    assert.equal(result.ok, true, `shared dispatch failed for ${action.value}`);
});
assert.equal(core.dispatchAction({ methodType: '未知方法' }, handlers, () => true).reason, 'unsupported');

const flow = core.flattenFlow({
    methodType: '交互确认',
    confirmMethods: [{ methodType: '显示' }],
    cancelMethods: [{ methodType: '隐藏' }],
    elseMethods: [{ methodType: '显示提示' }]
});
assert.deepEqual(Array.from(flow, item => item.branch), ['main', 'fallback', 'confirm', 'cancel']);

const inlineContext = vm.createContext({});
vm.runInContext(core.toInlineScript('EmbeddedRuntime'), inlineContext);
assert.equal(vm.runInContext('EmbeddedRuntime.VERSION', inlineContext), core.VERSION);
assert.equal(vm.runInContext("EmbeddedRuntime.compareValue('x', 'equals', 'x')", inlineContext), true);

console.log('Shared method runtime core tests passed.');
