(function(root) {
    'use strict';

    function createSoraMethodRuntimeCore() {
        const VERSION = 1;

        function compareValue(actual, operator, expected) {
            if (operator === 'truthy') return !!actual;
            if (operator === 'falsy') return !actual;
            if (operator === 'contains') return String(actual ?? '').includes(String(expected ?? ''));
            if (operator === 'greater') return Number(actual) > Number(expected);
            if (operator === 'less') return Number(actual) < Number(expected);
            if (operator === 'not_equals') return String(actual ?? '') !== String(expected ?? '');
            return String(actual ?? '') === String(expected ?? '');
        }

        function evaluateCondition(condition, config, resolveActual) {
            const item = condition && typeof condition === 'object' ? condition : {};
            const actual = typeof resolveActual === 'function' ? resolveActual(item, config) : undefined;
            return compareValue(actual, item.operator || 'equals', item.value);
        }

        function evaluateConditions(config, resolveActual) {
            const conditions = Array.isArray(config && config.conditions) ? config.conditions : [];
            if (!conditions.length) return true;
            let result = evaluateCondition(conditions[0], config, resolveActual);
            for (let index = 1; index < conditions.length; index++) {
                const value = evaluateCondition(conditions[index], config, resolveActual);
                result = conditions[index].join === 'OR' ? (result || value) : (result && value);
            }
            return result;
        }

        function dispatchAction(config, handlerMap, adapter) {
            const cfg = config && typeof config === 'object' ? config : {};
            const handler = handlerMap && handlerMap[cfg.methodType];
            if (!handler || typeof adapter !== 'function') return { ok: false, handler: handler || '', reason: 'unsupported' };
            try {
                return { ok: adapter(handler, cfg) !== false, handler, reason: '' };
            } catch (error) {
                return { ok: false, handler, reason: error && error.message ? error.message : 'failed' };
            }
        }

        function flattenFlow(methods, branch = 'main', depth = 0, output = [], seen = new Set()) {
            (Array.isArray(methods) ? methods : [methods]).forEach((method, index) => {
                if (!method || typeof method !== 'object' || seen.has(method)) return;
                seen.add(method);
                output.push({
                    method,
                    branch,
                    depth,
                    index,
                    methodId: String(method.methodId || ''),
                    type: String(method.methodType || '未知动作'),
                    trigger: String(method.trigger || 'click')
                });
                flattenFlow(method.formatMethods, 'nested', depth + 1, output, seen);
                flattenFlow(method.elseMethods, 'fallback', depth + 1, output, seen);
                flattenFlow(method.confirmMethods, 'confirm', depth + 1, output, seen);
                flattenFlow(method.cancelMethods, 'cancel', depth + 1, output, seen);
            });
            return output;
        }

        function redactTimelineEntry(entry) {
            const source = entry && typeof entry === 'object' ? entry : {};
            return {
                time: String(source.time || ''),
                methodId: String(source.methodId || '').slice(0, 96),
                type: String(source.type || '').slice(0, 80),
                trigger: String(source.trigger || '').slice(0, 40),
                status: String(source.status || '').slice(0, 30),
                durationMs: Math.max(0, Number(source.durationMs) || 0),
                detail: String(source.detail || '').replace(/[\r\n]+/g, ' ').slice(0, 240)
            };
        }

        return Object.freeze({ VERSION, compareValue, evaluateCondition, evaluateConditions, dispatchAction, flattenFlow, redactTimelineEntry });
    }

    const core = createSoraMethodRuntimeCore();
    root.SoraMethodRuntimeCore = Object.freeze({
        ...core,
        toInlineScript(name) {
            const safeName = String(name || 'SoraMethodRuntimeCore').replace(/[^a-zA-Z0-9_$]/g, '');
            return `const ${safeName} = (${createSoraMethodRuntimeCore.toString()})();`;
        }
    });
})(window);
