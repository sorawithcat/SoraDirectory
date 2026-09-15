const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const read = path => readFileSync(path, 'utf8');
const index = read('index.html');
const toolbar = read('js/toolbar.js');
const workspace = read('js/workspaceFeatures.js');
const methods = read('js/methodConfigDialog.js');
const runtime = read('js/fileOperations.js');
const media = read('js/imageHandler.js');
const directoryUtils = read('js/directoryUtils.js');
const preview = read('js/preview.js');
const dialog = read('js/dialog.js');
const referencePicker = read('js/referencePicker.js');
const publication = read('js/publicationSettings.js');
const referenceGraph = read('js/referenceGraph.js');
const directoryMetadata = read('js/directoryMetadata.js');
const methodRuntimeCore = read('js/methodRuntimeCore.js');
const documentIdentity = read('js/documentIdentity.js');
const diagnostics = read('js/diagnostics.js');
const performanceBudget = read('js/performanceBudget.js');
const reusableBlocks = read('js/reusableBlocks.js');
const extensionPacks = read('js/extensionPacks.js');
const componentLibrary = read('js/componentLibrary.js');
const knowledgeBaseInterop = read('js/knowledgeBaseInterop.js');
const designSystem = read('css/design-system.css');
const browserHarness = read('tests/browser-e2e.html');
const browserRunner = read('scripts/run-browser-e2e.mjs');

[
    'globalCommandBtn', 'methodManagerBtn', 'issueCenterBtn', 'draftManagerBtn',
    'directoryFilterInput', 'workspaceModeSelect', 'publicationSettingsBtn', 'referenceGraphBtn', 'directoryMetadataBtn'
].forEach(id => assert.ok(index.includes(`id="${id}"`), `missing UI entry: ${id}`));

assert.ok(workspace.includes("event.key.toLowerCase() === 'k'"), 'Ctrl+K command palette contract missing');
assert.ok(workspace.includes('data-command-secondary-index'), 'command context action contract missing');
assert.ok(workspace.includes('requestIdleCallback'), 'idle live-preflight scheduling contract missing');
assert.ok(workspace.includes('并补齐 ${ancestorCount} 个父目录'), 'selective draft restore must include ancestors');
assert.ok(workspace.includes('替换媒体并保留引用'), 'reference-preserving media replacement contract missing');
assert.ok(workspace.includes('aria-labelledby="soraFeatureDialogTitle"'), 'feature dialog title relation missing');
assert.ok(workspace.includes("if (event.key !== 'Tab') return"), 'feature dialog focus trap missing');
assert.ok(dialog.includes('function activateCustomDialog()'), 'custom dialog focus lifecycle missing');
assert.ok(dialog.includes("usage === 'text'"), 'text color contrast context missing');
assert.ok(dialog.includes('在白色正文背景上的对比度'), 'text color guidance must describe its background');
assert.ok(dialog.includes('推荐搭配${best}文字'), 'background color foreground guidance missing');
assert.ok(referencePicker.includes('wrapper.contains(document.activeElement)'), 'reference picker scope focus must not close results');
assert.ok(index.includes('aria-labelledby="customDialogTitle"'), 'custom dialog title relation missing');
assert.ok(media.includes('mediaDropIndicator'), 'drop insertion indicator contract missing');
assert.equal(
    (directoryUtils.match(/viewMode:\s*currentMuluName\s*===\s*muluElement\.id\s*\?\s*'preserve'\s*:\s*'restore'/g) || []).length,
    2,
    'directory clicks must preserve the current view and restore previously visited views'
);
assert.ok(preview.includes('const DirectoryViewState'), 'per-directory view state contract missing');
assert.ok(preview.includes('DirectoryViewState.capture(previousDirId)'), 'outgoing directory view must be captured');
assert.ok(preview.includes("DirectoryViewState.restore(targetDirId, { mode: viewMode })"), 'target directory view must be restored');
assert.ok(index.includes('id="openDirectoryAtTopBtn"'), 'explicit open-at-top action missing');
assert.ok(index.includes('class="mulubox" role="tree"'), 'editor directory tree semantics missing');
assert.ok(directoryUtils.includes('function handleDirectoryTreeKeydown(event)'), 'editor directory keyboard navigation missing');
assert.ok(directoryUtils.includes("setAttribute('aria-expanded', 'true')"), 'editor directory expansion state missing');

assert.ok(methods.includes('methodApplyPresetBtn'), 'method preset apply contract missing');
assert.ok(methods.includes('confirmMethods'), 'confirm branch editor contract missing');
assert.ok(methods.includes('cancelMethods'), 'cancel branch editor contract missing');
assert.ok(runtime.includes('soraMethodExecutionLog'), 'export method debugger contract missing');
assert.ok(runtime.includes('const soraDirectoryViewStates = new Map()'), 'export directory view state contract missing');
assert.ok(runtime.includes('function readExportRoute()'), 'export deep-link route reader missing');
assert.ok(runtime.includes("window.addEventListener('popstate'"), 'export browser history contract missing');
assert.ok(runtime.includes("history.pushState({ soraDirId: dirId"), 'export route push contract missing');
assert.ok(runtime.includes('role="tree" aria-label="文档目录"'), 'export semantic directory tree missing');
assert.equal(
    (runtime.match(/function generateDirectoryHTML\(items, level = 0\)/g) || []).length,
    1,
    'export directory generator must not be shadowed by a duplicate implementation'
);
assert.ok(runtime.includes("container.addEventListener('keydown'"), 'export tree keyboard navigation missing');
assert.ok(runtime.includes("function setExportSidebarOpen(open"), 'export mobile directory drawer missing');
assert.ok(runtime.includes('max-width: 100%;'), 'export responsive media constraint missing');
assert.ok(runtime.includes('function scheduleExportSearchIndexBuild()'), 'export incremental search index missing');
assert.ok(runtime.includes("event.key.toLowerCase() === 'k'"), 'export search keyboard shortcut missing');
assert.ok(runtime.includes('aria-labelledby="soraMethodDialogTitle"'), 'export dialog title relation missing');
assert.ok(runtime.includes("if (event.key !== 'Tab') return"), 'export dialog focus trap missing');
assert.ok(runtime.includes('if (SORA_METHOD_DEBUG) initMethodDebugButton()'), 'export debugger must be hidden by default');
assert.ok(runtime.includes('const SORA_PUBLICATION = ${publicationSettingsJson};'), 'publication settings must be embedded in the export');
assert.ok(runtime.includes("SORA_PUBLICATION.capabilityLevel === 'full'"), 'export debugger must require the full capability level');
assert.ok(runtime.includes("SORA_PUBLICATION.mediaPolicy === 'blocked'"), 'export media policy contract missing');
assert.ok(runtime.includes('publicationSettings.searchEnabled ? `<div class="export-search"'), 'export search must follow publication settings');
assert.ok(runtime.includes('function collectUnsafeExportContent(root)'), 'unsafe export preflight inspection missing');
assert.ok(runtime.includes('function sanitizeExportContent(root)'), 'final export sanitizer missing');
assert.ok(runtime.includes("element.setAttribute('rel', 'noopener noreferrer')"), 'external link isolation missing');
assert.ok(runtime.includes("['不安全的发布内容', issues.unsafeContent]"), 'unsafe content must block export preflight');
assert.ok(runtime.includes('headingJumps: []'), 'heading hierarchy quality check missing');
assert.ok(runtime.includes('missingAltText: []'), 'image alt text quality check missing');
assert.ok(runtime.includes('longParagraphs: []'), 'long paragraph quality check missing');
assert.ok(runtime.includes('IntersectionObserver'), 'visible trigger contract missing');
assert.ok(runtime.includes('entry.intersectionRatio >= threshold'), 'configured visible threshold contract missing');
assert.ok(runtime.includes("executionMode === 'parallel'"), 'parallel flow contract missing');
assert.ok(runtime.includes('function initReadingTools()'), 'export reading tools missing');
assert.ok(runtime.includes('function buildContentOutline()'), 'export content outline missing');
assert.ok(runtime.includes('class="reading-tools"'), 'export reading tools must use one collapsed entry');
assert.ok(runtime.includes('id="sidebarCollapseBtn"'), 'export sidebar collapse action missing');
assert.equal(runtime.includes('id="readingModeBtn"'), false, 'export must not restore centered reading mode');
assert.equal(runtime.includes('id="printPageBtn"'), false, 'export must not expose browser print action');
assert.equal(runtime.includes('body.reading-mode'), false, 'export must not apply reading-mode layout overrides');
assert.equal(runtime.includes('html[data-theme="dark"]'), false, 'export dark theme variant should not return');
assert.equal(runtime.includes('@media (prefers-color-scheme: dark)'), false, 'export appearance must not change with system theme');
assert.ok(runtime.includes("navigator.serviceWorker.register('./sora-service-worker.js')"), 'PWA service worker registration missing');
assert.ok(runtime.includes("publicationSettings.deploymentMode = 'static-folder'"), 'encrypted PWA downgrade missing');
assert.ok(runtime.includes('SORA_OPTIONAL_METHOD_RUNTIME_START'), 'optional method runtime boundary missing');
assert.ok(runtime.includes('if (!hasMethodRuntime)'), 'unused method runtime pruning missing');
assert.ok(runtime.includes("writePartsToDirectoryHandle(deploymentDirectoryHandle, 'manifest.webmanifest'"), 'PWA manifest output missing');

const nativeDialogPattern = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/;
for (const [name, source] of [['runtime', runtime], ['workspace', workspace], ['media', media], ['publication', publication], ['referenceGraph', referenceGraph], ['diagnostics', diagnostics], ['extensionPacks', extensionPacks], ['knowledgeBaseInterop', knowledgeBaseInterop]]) {
    assert.equal(nativeDialogPattern.test(source), false, `${name} uses a native browser dialog`);
}
for (const file of ['js/preview.js', 'js/formatToolbar.js', 'js/contextMenu.js', 'js/fileOperations.js']) {
    assert.equal(/document\.execCommand\s*\(/.test(read(file)), false, `${file} still uses document.execCommand`);
}

const helpStart = toolbar.indexOf('function buildHelpPageContents');
const helpEnd = toolbar.indexOf('function buildHelpManualMulufile');
const helpSource = toolbar.slice(helpStart, helpEnd > helpStart ? helpEnd : undefined);
assert.equal(/解谜.{0,12}模板|谜题.{0,12}模板/.test(helpSource), false, 'puzzle template remains in built-in help');
assert.ok(helpSource.includes('方法管理'), 'method management is missing from built-in help');
assert.ok(helpSource.includes('草稿'), 'draft snapshots are missing from built-in help');
assert.ok(helpSource.includes('每个目录会记住正文滚动位置和最后选区'), 'directory context restore is missing from built-in help');
assert.ok(helpSource.includes('按 <strong>Ctrl+K</strong> 或 <strong>/</strong> 可直接聚焦搜索'), 'export search guidance is missing from built-in help');
assert.ok(helpSource.includes('浏览器前进/后退会保留阅读位置'), 'export route guidance is missing from built-in help');
assert.ok(helpSource.includes('发布配置与正文分开保存'), 'publication settings guidance is missing from built-in help');
assert.ok(helpSource.includes('导出时会强制移除脚本、内联事件和危险协议'), 'export sanitization guidance is missing from built-in help');
assert.ok(helpSource.includes('标题层级跳跃、重复标题'), 'content quality guidance is missing from built-in help');
assert.ok(helpSource.includes('可复用内容块'), 'reusable block guidance is missing from built-in help');
assert.ok(helpSource.includes('声明式扩展包'), 'extension pack guidance is missing from built-in help');
assert.ok(helpSource.includes('Markdown / Obsidian 互操作'), 'knowledge base interoperability guidance is missing from built-in help');
assert.ok(helpSource.includes('加密网页不能可靠注册 PWA'), 'encrypted PWA limitation is missing from built-in help');
assert.ok(helpSource.includes('没有方法的文档会从产物中移除方法运行适配代码'), 'export pruning guidance is missing from built-in help');
assert.ok(helpSource.includes('草稿按文档身份隔离'), 'document-scoped draft guidance is missing from built-in help');
assert.ok(helpSource.includes('诊断摘要会脱敏'), 'diagnostic privacy guidance is missing from built-in help');
assert.ok(publication.includes("const STORAGE_KEY = 'sora_publication_settings_v1'"), 'publication settings persistence missing');
assert.ok(publication.includes("next.theme = 'light'"), 'publication settings must migrate old themes to the fixed light appearance');
assert.equal(publication.includes("controls.theme = addField"), false, 'publication settings should not expose theme variants');
assert.ok(workspace.includes('.feature-dialog, .feature-dialog * { box-sizing: border-box; }'), 'feature dialog box-sizing overflow guard missing');
assert.ok(directoryMetadata.includes('.directory-metadata-field-wide { grid-column:1 / -1; }'), 'wide metadata field layout missing');
assert.ok(publication.includes('function describeDifferences'), 'publication preset comparison missing');
assert.ok(publication.includes('state.history'), 'publication settings rollback history missing');
assert.ok(publication.includes('function resolve(muluData, currentDirId, fallbackTitle)'), 'publication resolution contract missing');
assert.ok(referenceGraph.includes('function rewriteDirectoryReferences(targetDirId, newName, data)'), 'stable reference rewrite missing');
assert.ok(referenceGraph.includes('function getDeleteImpact(targetDirId, data)'), 'directory delete impact contract missing');
assert.ok(referenceGraph.includes('function findCycles(graph)'), 'reference cycle detection missing');
assert.ok(directoryUtils.includes('SoraReferenceGraph.rewriteDirectoryReferences'), 'directory rename must rewrite stable references');
assert.ok(read('js/contextMenu.js').includes('SoraReferenceGraph.getDeleteImpact'), 'directory delete must disclose inbound references');
assert.ok(helpSource.includes('顶部 <strong>关系</strong> 可查看当前目录的入链'), 'reference graph guidance is missing from built-in help');
assert.ok(helpSource.includes('顶部 <strong>字段</strong> 可为当前目录设置标签'), 'directory metadata guidance is missing from built-in help');
assert.ok(index.includes("'js/directoryMetadata.js'"), 'directory metadata module is not loaded');
assert.ok(directoryMetadata.includes('function openCollections()'), 'smart collections UI missing');
assert.ok(directoryMetadata.includes('此视图不会改动或删除正文'), 'smart collection safety disclosure missing');
assert.ok(directoryMetadata.includes('function serialize(allowedIds)'), 'directory metadata serialization missing');
assert.ok(runtime.includes('directoryMetadata: window.DirectoryMetadata'), 'Sora package metadata export missing');
assert.ok(runtime.includes('window.DirectoryMetadata.load(manifest.directoryMetadata, { merge: true })'), 'Sora package metadata merge missing');
assert.ok(runtime.includes('window.DirectoryMetadata.load(manifest.directoryMetadata);'), 'Sora package metadata replacement missing');
assert.ok(toolbar.includes('window.DirectoryMetadata.reset()'), 'new document must reset directory metadata');
assert.ok(read('js/contextMenu.js').includes('window.DirectoryMetadata.remove'), 'directory deletion must remove directory metadata');
assert.ok(index.includes("'js/methodRuntimeCore.js'"), 'shared method runtime core is not loaded');
assert.ok(runtime.includes("toInlineScript('SoraMethodRuntimeCore')"), 'shared method runtime core is not embedded in exports');
assert.ok(runtime.includes('SoraMethodRuntimeCore.dispatchAction'), 'export action routing does not use the shared core');
assert.ok(read('js/methodWorkbench.js').includes('core.dispatchAction'), 'editor sandbox action routing does not use the shared core');
assert.ok(methodRuntimeCore.includes('function evaluateConditions'), 'shared condition semantics missing');
assert.ok(index.includes("'js/documentIdentity.js'"), 'document identity module is not loaded');
assert.ok(documentIdentity.includes('function signatureForFile(file)'), 'same-name file isolation signature missing');
assert.ok(workspace.includes('latest:${documentIdentity().id}'), 'drafts are not scoped by document identity');
assert.ok(workspace.includes('function createNamedSnapshot'), 'named snapshot support missing');
assert.ok(workspace.includes('function snapshotTextPreview'), 'snapshot text-level preview missing');
assert.ok(workspace.includes('查看文本变化片段'), 'snapshot diff disclosure UI missing');
assert.ok(index.includes("'js/diagnostics.js'"), 'diagnostics module is not loaded');
assert.ok(diagnostics.includes("localStorage.getItem(SETTINGS_KEY) || 'warning'"), 'diagnostics must default to warnings');
assert.ok(diagnostics.includes('crypto.subtle.digest'), 'duplicate media detection must use a full content hash');
assert.ok(diagnostics.includes('预计可释放'), 'duplicate media recovery estimate missing');
assert.ok(diagnostics.includes('data-refresh-diagnostics'), 'diagnostic retry action missing');
assert.ok(diagnostics.includes('missingReferenceCount'), 'redacted diagnostic summary is missing reference counts');
assert.equal(/\b(?:body|password|attachmentContent|soraPageVariables)\s*:/.test(diagnostics.match(/function buildSummary[\s\S]*?\n    }/)?.[0] || ''), false, 'diagnostic summary contains sensitive payload fields');
assert.ok(index.includes("'js/performanceBudget.js'"), 'performance budget module is not loaded');
assert.ok(performanceBudget.includes("'内容'.repeat(2600)"), '10 MB performance fixture drifted');
assert.ok(performanceBudget.includes('new Worker(url)'), 'heavy inventory calculation is not moved to a worker');
assert.ok(performanceBudget.includes('targetRows: 1000'), '1,000-directory benchmark missing');
assert.ok(index.includes("'js/reusableBlocks.js'"), 'reusable block module is not loaded');
assert.ok(reusableBlocks.includes('function wouldCreateCycle'), 'reusable block cycle prevention missing');
assert.ok(reusableBlocks.includes('function cleanForStorage'), 'reusable blocks must not duplicate expanded content in storage');
assert.ok(reusableBlocks.includes('编辑源块'), 'reusable block source editing action missing');
assert.ok(index.includes("'js/extensionPacks.js'"), 'extension pack module is not loaded');
assert.ok(extensionPacks.includes("'javascript'"), 'extension pack script capability rejection missing');
assert.ok(extensionPacks.includes('未知能力'), 'extension pack unknown capability rejection missing');
assert.equal(/\beval\s*\(|new Function\s*\(/.test(extensionPacks), false, 'extension packs can execute arbitrary code');
assert.ok(index.includes("'js/componentLibrary.js'"), 'controlled component library is not loaded');
assert.ok(componentLibrary.includes('SoraReferencePicker?.attach(front') && componentLibrary.includes('SoraReferencePicker?.attach(back'), 'component library target picker is not searchable');
assert.ok(runtime.includes('function buildFaqComponent'), 'FAQ export component missing');
assert.ok(runtime.includes('function buildGalleryComponent'), 'gallery export component missing');
assert.ok(index.includes("'js/knowledgeBaseInterop.js'"), 'knowledge base interoperability module is not loaded');
assert.ok(knowledgeBaseInterop.includes('function parseFrontMatter'), 'Front Matter parser missing');
assert.ok(knowledgeBaseInterop.includes('function findCycles'), 'knowledge base cycle preflight missing');
assert.ok(knowledgeBaseInterop.includes('目标中存在同名文件，已避让'), 'Markdown export conflict avoidance missing');
assert.ok(knowledgeBaseInterop.includes('方法链接在 Markdown 中导出为普通文字'), 'Markdown method downgrade disclosure missing');
assert.ok(index.includes('css/design-system.css'), 'stable design-system layer is not linked');
assert.ok(designSystem.includes('@media (forced-colors: active)'), 'Windows high contrast support missing');
assert.ok(designSystem.includes('@media (prefers-reduced-motion: reduce)'), 'reduced motion support missing');
assert.ok(browserHarness.includes("document.body.dataset.testStatus = failures.length ? 'failed' : 'passed'"), 'browser E2E result contract missing');
assert.ok(browserHarness.includes("for (const viewport") === false, 'viewport orchestration belongs in the browser runner');
assert.ok(browserRunner.includes("for (const viewport of ['desktop', 'mobile'])"), 'desktop/mobile browser coverage missing');
assert.ok(browserRunner.includes("Page.captureScreenshot"), 'browser failure screenshot capture missing');
assert.ok(browserRunner.includes("Runtime.consoleAPICalled"), 'browser console capture missing');

console.log('Feature contract tests passed.');
