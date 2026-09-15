(function() {
    'use strict';

    const BUDGETS = Object.freeze({ referenceIndexMs: 120, preflightMs: 1500, exportPrepareMs: 5000, inputSyncMs: 50 });
    const measurements = [];
    let worker = null;
    let requestId = 0;
    const pending = new Map();
    let cachedFingerprint = '';
    let cachedAnalysis = null;

    function createWorker() {
        if (worker || typeof Worker === 'undefined') return worker;
        const source = `self.onmessage=function(event){var payload=event.data||{};var rows=Array.isArray(payload.rows)?payload.rows:[];var ids=new Set();var duplicates=[];var missingParents=[];var bytes=0;var methods=0;var anchors=0;rows.forEach(function(row){if(!Array.isArray(row)||row.length!==4)return;var id=String(row[2]||'');if(ids.has(id))duplicates.push(id);ids.add(id);var html=String(row[3]||'');bytes+=html.length*2;methods+=(html.match(/data-sora-methods=/g)||[]).length;anchors+=(html.match(/data-anchor-name=|\\sid=["']/g)||[]).length;});rows.forEach(function(row){if(!Array.isArray(row)||row.length!==4)return;var parent=String(row[0]||'');if(parent&&parent!=='mulu'&&!ids.has(parent))missingParents.push(String(row[1]||row[2])+' → '+parent);});self.postMessage({id:payload.id,result:{rows:rows.length,bytes:bytes,methods:methods,anchors:anchors,duplicateDirectoryIds:duplicates,missingParents:missingParents}});}`;
        const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        worker = new Worker(url);
        URL.revokeObjectURL(url);
        worker.onmessage = event => {
            const entry = pending.get(event.data.id);
            if (!entry) return;
            pending.delete(event.data.id);
            entry.resolve(event.data.result);
        };
        worker.onerror = error => {
            pending.forEach(entry => entry.reject(error));
            pending.clear();
            worker.terminate();
            worker = null;
        };
        return worker;
    }

    function fingerprint(rows) {
        return (Array.isArray(rows) ? rows : []).map(row => Array.isArray(row) ? `${row[0]}:${row[2]}:${String(row[3] || '').length}` : '').join('|');
    }

    function analyzeSync(rows) {
        const ids = new Set();
        const duplicateDirectoryIds = [];
        let bytes = 0;
        let methods = 0;
        let anchors = 0;
        rows.forEach(row => {
            if (!Array.isArray(row) || row.length !== 4) return;
            const id = String(row[2] || '');
            if (ids.has(id)) duplicateDirectoryIds.push(id);
            ids.add(id);
            const html = String(row[3] || '');
            bytes += html.length * 2;
            methods += (html.match(/data-sora-methods=/g) || []).length;
            anchors += (html.match(/data-anchor-name=|\sid=["']/g) || []).length;
        });
        const missingParents = rows.filter(row => Array.isArray(row) && row.length === 4 && row[0] && row[0] !== 'mulu' && !ids.has(String(row[0])))
            .map(row => `${row[1] || row[2]} → ${row[0]}`);
        return { rows: rows.length, bytes, methods, anchors, duplicateDirectoryIds, missingParents };
    }

    async function analyze(data, options = {}) {
        const rows = (Array.isArray(data) ? data : []).filter(row => Array.isArray(row) && row.length === 4);
        const key = fingerprint(rows);
        if (!options.force && key === cachedFingerprint && cachedAnalysis) return cachedAnalysis;
        const startedAt = performance.now();
        let result;
        const instance = createWorker();
        if (instance) {
            result = await new Promise((resolve, reject) => {
                const id = ++requestId;
                pending.set(id, { resolve, reject });
                instance.postMessage({ id, rows });
            }).catch(() => analyzeSync(rows));
        } else {
            result = analyzeSync(rows);
        }
        result.durationMs = performance.now() - startedAt;
        result.worker = !!instance;
        cachedFingerprint = key;
        cachedAnalysis = result;
        record('preflightInventory', result.durationMs, BUDGETS.preflightMs);
        return result;
    }

    function record(name, durationMs, budgetMs) {
        const entry = { name, durationMs: Math.max(0, Number(durationMs) || 0), budgetMs: Number(budgetMs) || 0, time: Date.now() };
        entry.withinBudget = !entry.budgetMs || entry.durationMs <= entry.budgetMs;
        measurements.unshift(entry);
        if (measurements.length > 50) measurements.length = 50;
        return entry;
    }

    async function measure(name, task, budgetMs) {
        const startedAt = performance.now();
        try { return await task(); }
        finally { record(name, performance.now() - startedAt, budgetMs); }
    }

    async function benchmark() {
        const body = '<h2 id="section">性能样本</h2><p>' + '内容'.repeat(2600) + '</p>';
        const rows = Array.from({ length: 1000 }, (_, index) => [index ? `bench_${Math.floor((index - 1) / 4)}` : 'mulu', `目录 ${index + 1}`, `bench_${index}`, body]);
        const result = await analyze(rows, { force: true });
        return { ...result, targetRows: 1000, targetTextBytes: rows.reduce((sum, row) => sum + row[3].length * 2, 0) };
    }

    async function open() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<p>正在运行 1,000 目录 / 约 10 MB 正文的索引基准…</p>';
        FeatureDialog.open('性能预算', wrapper);
        const result = await benchmark();
        const latest = measurements.slice(0, 8);
        wrapper.innerHTML = `<div class="method-form-grid"><section class="issue-section"><h3>基准结果</h3><div style="padding:10px"><strong>${result.durationMs.toFixed(1)} ms</strong><br><small>${result.worker ? 'Worker 后台计算' : '同步回退'} · ${result.rows} 个目录 · ${(result.targetTextBytes / 1024 / 1024).toFixed(1)} MB</small></div></section><section class="issue-section"><h3>预算</h3><div style="padding:10px">引用索引 ≤ ${BUDGETS.referenceIndexMs} ms<br>预检清单 ≤ ${BUDGETS.preflightMs} ms<br>导出准备 ≤ ${BUDGETS.exportPrepareMs} ms</div></section></div><h3>最近测量</h3><ul>${latest.map(item => `<li>${item.name}：${item.durationMs.toFixed(1)} ms${item.budgetMs ? ` / ${item.budgetMs} ms ${item.withinBudget ? '✓' : '超出'}` : ''}</li>`).join('')}</ul><p class="media-summary">此基准只验证索引计算；真实输入流畅度仍需浏览器端到端场景验收。</p>`;
    }

    window.SoraPerformance = { BUDGETS, analyze, measure, record, benchmark, open, getMeasurements: () => measurements.slice() };
    window.SoraFeatureCommands = window.SoraFeatureCommands || [];
    window.SoraFeatureCommands.push({ key: 'performance-budget', title: '性能预算', icon: '◴', meta: '1,000 目录基准、Worker 状态和最近耗时', keywords: '性能 大项目 基准 worker 索引', run: open });
})();
