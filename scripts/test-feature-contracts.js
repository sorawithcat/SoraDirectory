const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const read = path => readFileSync(path, 'utf8');
const index = read('index.html');
const toolbar = read('js/toolbar.js');
const workspace = read('js/workspaceFeatures.js');
const methods = read('js/methodConfigDialog.js');
const runtime = read('js/fileOperations.js');
const media = read('js/imageHandler.js');

[
    'globalCommandBtn', 'methodManagerBtn', 'issueCenterBtn', 'draftManagerBtn',
    'directoryFilterInput', 'workspaceModeSelect'
].forEach(id => assert.ok(index.includes(`id="${id}"`), `missing UI entry: ${id}`));

assert.ok(workspace.includes("event.key.toLowerCase() === 'k'"), 'Ctrl+K command palette contract missing');
assert.ok(workspace.includes('data-command-secondary-index'), 'command context action contract missing');
assert.ok(workspace.includes('requestIdleCallback'), 'idle live-preflight scheduling contract missing');
assert.ok(workspace.includes('并补齐 ${ancestorCount} 个父目录'), 'selective draft restore must include ancestors');
assert.ok(workspace.includes('替换媒体并保留引用'), 'reference-preserving media replacement contract missing');
assert.ok(media.includes('mediaDropIndicator'), 'drop insertion indicator contract missing');

assert.ok(methods.includes('methodApplyPresetBtn'), 'method preset apply contract missing');
assert.ok(methods.includes('confirmMethods'), 'confirm branch editor contract missing');
assert.ok(methods.includes('cancelMethods'), 'cancel branch editor contract missing');
assert.ok(runtime.includes('soraMethodExecutionLog'), 'export method debugger contract missing');
assert.ok(runtime.includes('IntersectionObserver'), 'visible trigger contract missing');
assert.ok(runtime.includes('entry.intersectionRatio >= threshold'), 'configured visible threshold contract missing');
assert.ok(runtime.includes("executionMode === 'parallel'"), 'parallel flow contract missing');

const nativeDialogPattern = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/;
for (const [name, source] of [['runtime', runtime], ['workspace', workspace], ['media', media]]) {
    assert.equal(nativeDialogPattern.test(source), false, `${name} uses a native browser dialog`);
}

const helpStart = toolbar.indexOf('function buildHelpPageContents');
const helpEnd = toolbar.indexOf('function buildHelpManualMulufile');
const helpSource = toolbar.slice(helpStart, helpEnd > helpStart ? helpEnd : undefined);
assert.equal(/解谜.{0,12}模板|谜题.{0,12}模板/.test(helpSource), false, 'puzzle template remains in built-in help');
assert.ok(helpSource.includes('方法管理'), 'method management is missing from built-in help');
assert.ok(helpSource.includes('草稿'), 'draft snapshots are missing from built-in help');

console.log('Feature contract tests passed.');
