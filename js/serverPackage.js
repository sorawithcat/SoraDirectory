const SoraServerPackage = (function() {
    'use strict';

    const FORMAT = 'sora-server-site-v1';
    const encoder = new TextEncoder();

    async function fingerprint(blob) {
        if (!window.crypto?.subtle) throw new Error('请通过 HTTPS 或 localhost 打开编辑器后生成服务器部署包');
        const hashes = [];
        for (let offset = 0; offset < blob.size; offset += 8 * 1024 * 1024) {
            hashes.push(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.slice(offset, offset + 8 * 1024 * 1024).arrayBuffer())));
        }
        const root = new Uint8Array(await new Blob([encoder.encode(`sora-file-v1:${blob.size}:`), ...hashes]).arrayBuffer());
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', root));
        return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function memoryDirectory() {
        const children = new Map();
        return {
            kind: 'directory',
            async getDirectoryHandle(name) {
                if (!children.has(name)) children.set(name, memoryDirectory());
                return children.get(name);
            },
            async getFileHandle(name) {
                if (!children.has(name)) {
                    let file = new Blob();
                    children.set(name, {
                        kind: 'file',
                        async getFile() { return file; },
                        async createWritable() {
                            let parts = [];
                            return {
                                async write(part) { parts.push(new Blob([part])); },
                                async close() { file = new Blob(parts); parts = []; },
                                async abort() { parts = []; }
                            };
                        }
                    });
                }
                return children.get(name);
            },
            async removeEntry(name) { children.delete(name); },
            async *entries() { yield* children.entries(); }
        };
    }

    async function stagingDirectory() {
        if (isOpfsSupported()) {
            try {
                const root = await navigator.storage.getDirectory();
                const parent = await root.getDirectoryHandle('sora-exports', { create: true });
                const name = `server-${crypto.randomUUID()}`;
                const directory = await parent.getDirectoryHandle(name, { create: true });
                return { directory, cleanup: () => parent.removeEntry(name, { recursive: true }) };
            } catch (error) {
                console.warn('服务器部署包使用内存暂存:', error);
            }
        }
        return { directory: memoryDirectory(), cleanup: async () => {} };
    }

    async function collectFiles(directory, prefix = '', result = new Map()) {
        for await (const [name, handle] of directory.entries()) {
            const path = prefix + name;
            if (handle.kind === 'directory') await collectFiles(handle, path + '/', result);
            else result.set(path, await handle.getFile());
        }
        return result;
    }

    async function prepareReader(files) {
        const page = new DOMParser().parseFromString(await files.get('index.html').text(), 'text/html');
        const config = JSON.parse(page.getElementById('soraReaderConfig').textContent);
        const mediaData = JSON.parse(page.getElementById('mediaData').textContent);
        const originalAssets = JSON.parse(page.getElementById('mediaAssets').textContent);
        const mediaAssets = {};
        const packed = new Map();
        const paths = new Map();
        const mediaFiles = Array.from(files).filter(([path]) => path.startsWith('media/'));
        for (let index = 0; index < mediaFiles.length; index++) {
            const [path, blob] = mediaFiles[index];
            updateSoraLoadProgress('正在整理部署媒体', index, mediaFiles.length, path);
            const extension = path.slice(path.lastIndexOf('.'));
            const stablePath = `media/${await fingerprint(blob)}${extension}`;
            paths.set('./' + path, './' + stablePath);
            packed.set(stablePath, blob);
        }
        const assetIds = new Map();
        for (const [id, asset] of Object.entries(originalAssets)) {
            if (asset.url && paths.has(asset.url)) asset.url = paths.get(asset.url);
            const stableId = 'asset_' + await fingerprint(new Blob([JSON.stringify(asset)]));
            assetIds.set(id, stableId);
            mediaAssets[stableId] = asset;
        }
        for (const reference of Object.values(mediaData)) {
            if (assetIds.has(reference.assetId)) reference.assetId = assetIds.get(reference.assetId);
        }
        config.publication.splitMediaBasePath = './media/';
        const content = new Map();
        page.querySelectorAll('script[type="application/json"][id^="content_"]').forEach(script => {
            content.set(script.id.slice('content_'.length), JSON.parse(script.textContent));
            script.remove();
        });
        page.querySelectorAll('script[type="application/json"]').forEach(script => script.remove());
        const styles = Array.from(page.querySelectorAll('style'));
        const css = new Blob(styles.map(style => style.textContent + '\n'), { type: 'text/css' });
        const cssPath = `assets/reader-${await fingerprint(css)}.css`;
        packed.set(cssPath, css);
        styles.forEach(style => style.remove());
        const styleLink = page.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = './' + cssPath;
        page.head.appendChild(styleLink);
        const scripts = Array.from(page.querySelectorAll('script:not([type]), script[type="text/javascript"]'));
        const runtime = new Blob(scripts.map(script => script.textContent + '\n'), { type: 'text/javascript' });
        const runtimePath = `assets/reader-${await fingerprint(runtime)}.js`;
        packed.set(runtimePath, runtime);
        scripts.forEach(script => script.remove());
        return { page, config, mediaData, mediaAssets, content, packed, runtimePath };
    }

    async function download(files, filename) {
        const progress = (current, total, path) => updateSoraLoadProgress('正在生成服务器部署包', current, total, path);
        const writeArchive = async handle => {
            const writable = await handle.createWritable();
            try {
                await SoraDeploymentZip.write(files, part => writable.write(part), progress);
                await writable.close();
            } catch (error) {
                try { await writable.abort(); } catch (_) {}
                throw error;
            }
        };
        let prepared = null;
        try {
            prepared = await createTemporaryExport(`server-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`, writeArchive);
            let file = prepared?.file;
            if (!file) {
                const parts = [];
                await SoraDeploymentZip.write(files, async part => { parts.push(part); }, progress);
                file = new File(parts, filename, { type: 'application/zip' });
            }
            hideSoraLoadProgress();
            const action = await showPreparedFileActions(new File([file], filename, { type: 'application/zip' }), filename, prepared?.cleanup);
            prepared = null;
            return action;
        } finally {
            hideSoraLoadProgress();
            await prepared?.cleanup();
        }
    }

    function appendJson(page, id, value) {
        const script = page.createElement('script');
        script.type = 'application/json';
        script.id = id;
        script.textContent = JSON.stringify(value).replace(/</g, '\\u003c');
        page.body.appendChild(script);
    }

    function appendScript(page, path) {
        const script = page.createElement('script');
        script.src = './' + path;
        page.body.appendChild(script);
    }

    function serializePage(page) {
        return new Blob(['<!DOCTYPE html>\n', page.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
    }

    async function buildStatic(reader) {
        const { page, config, mediaData, mediaAssets, content, packed, runtimePath } = reader;
        appendJson(page, 'soraReaderConfig', config);
        appendJson(page, 'mediaData', mediaData);
        appendJson(page, 'mediaAssets', mediaAssets);
        for (const [id, html] of content) {
            appendJson(page, 'content_' + id, '');
            const source = `document.getElementById(${JSON.stringify('content_' + id)}).textContent=${JSON.stringify(JSON.stringify(html))};\n`;
            const blob = new Blob([source], { type: 'text/javascript' });
            const path = `content/${await fingerprint(blob)}.js`;
            packed.set(path, blob);
            appendScript(page, path);
        }
        appendScript(page, runtimePath);
        packed.set('index.html', serializePage(page));
        return packed;
    }

    function startAppendSite() {
        const target = document.getElementById('contentBody');
        const notice = message => {
            target.replaceChildren();
            const text = document.createElement('p');
            text.textContent = message;
            target.appendChild(text);
        };
        const json = (id, value) => {
            document.getElementById(id)?.remove();
            const script = document.createElement('script');
            script.type = 'application/json';
            script.id = id;
            script.textContent = JSON.stringify(value);
            document.body.appendChild(script);
        };
        async function load() {
            notice('正在读取站点目录…');
            try {
                const response = await fetch('./catalog.php', { cache: 'no-store', credentials: 'same-origin' });
                if (!response.ok) throw new Error('目录读取失败，请检查站点文件是否上传完整。');
                let site;
                try { site = await response.json(); }
                catch (_) { throw new Error('该部署包需要 PHP。请在服务器启用 PHP，或改用通用静态包。'); }
                if (!site || site.format !== 'sora-server-site-v1' || !Array.isArray(site.directories)) throw new Error('站点目录数据无效，请重新上传部署包。');
                const config = site.config;
                const rows = site.directories;
                const byId = new Map(rows.map(row => [row.id, row]));
                const children = new Map();
                rows.forEach(row => {
                    const parent = byId.has(row.parentId) && row.parentId !== row.id ? row.parentId : '';
                    if (!children.has(parent)) children.set(parent, []);
                    children.get(parent).push(row);
                });
                const tree = document.querySelector('.sidebar-content-inner');
                tree.replaceChildren();
                const visited = new Set();
                const mediaData = {};
                const mediaAssets = {};
                const add = (row, level) => {
                    if (visited.has(row.id)) return;
                    visited.add(row.id);
                    const descendants = children.get(row.id) || [];
                    const item = document.createElement('div');
                    item.className = 'mulu' + (descendants.length ? ' has-children expanded' : '');
                    item.dataset.dirId = row.id;
                    item.dataset.level = String(level);
                    item.setAttribute('role', 'treeitem');
                    item.tabIndex = -1;
                    item.setAttribute('aria-level', String(level + 1));
                    item.setAttribute('aria-selected', 'false');
                    if (descendants.length) item.setAttribute('aria-expanded', 'true');
                    item.style.paddingLeft = (20 + level * 20) + 'px';
                    const palette = row.palette || {};
                    for (const [key, value] of Object.entries(palette)) {
                        if (['bg', 'hover', 'selected', 'text'].includes(key)) item.style.setProperty('--dir-' + (key === 'bg' || key === 'text' ? key : key + '-bg'), value);
                    }
                    const icon = document.createElement('span');
                    icon.className = descendants.length ? 'toggle-icon' : 'bullet-icon';
                    icon.setAttribute('aria-hidden', 'true');
                    const name = document.createElement('span');
                    name.className = 'mulu-text';
                    name.textContent = row.name;
                    item.append(icon, name);
                    tree.appendChild(item);
                    json('content_' + row.id, row.html);
                    Object.assign(mediaData, row.mediaData);
                    Object.assign(mediaAssets, row.mediaAssets);
                    descendants.forEach(child => add(child, level + 1));
                };
                (children.get('') || []).forEach(row => add(row, 0));
                rows.forEach(row => add(row, 0));
                document.querySelector('.sidebar-header').textContent = config.publication.title;
                document.title = config.publication.title + ' - SoraDirectory';
                if (!byId.has(config.defaultDirId)) config.defaultDirId = rows[0]?.id || '';
                json('soraReaderConfig', config);
                json('mediaData', mediaData);
                json('mediaAssets', mediaAssets);
                const runtime = document.createElement('script');
                runtime.src = './' + site.runtime;
                runtime.onerror = () => notice('阅读程序未加载，请确认 assets 目录已完整上传。');
                document.body.appendChild(runtime);
                if (!rows.length) notice('当前站点暂无目录，请上传包含目录的追加包。');
            } catch (error) {
                notice(error.message || '站点加载失败');
                const retry = document.createElement('button');
                retry.textContent = '重试';
                retry.onclick = load;
                target.appendChild(retry);
            }
        }
        load();
    }

    function catalogSource() {
        return `<?php
// PHP 7.4+; read-only catalog, no database or installation step.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
function read_site_json($path) {
    $text = @file_get_contents($path);
    return $text === false ? null : json_decode($text, true);
}
$site = read_site_json(__DIR__ . '/site.json');
if (!is_array($site) || ($site['format'] ?? '') !== 'sora-server-site-v1') {
    http_response_code(503);
    echo json_encode(['error' => 'Site configuration unavailable']);
    exit;
}
$directories = [];
foreach (glob(__DIR__ . '/content/*.json') ?: [] as $path) {
    $row = read_site_json($path);
    if (!is_array($row) || ($row['format'] ?? '') !== $site['format'] || ($row['documentId'] ?? '') !== $site['documentId']) continue;
    if (!isset($row['id'], $row['name'], $row['html']) || !is_string($row['id']) || !is_string($row['html'])) continue;
    $directories[] = $row;
}
usort($directories, function($left, $right) {
    $order = ($left['order'] ?? 0) <=> ($right['order'] ?? 0);
    return $order ?: strcmp($left['id'], $right['id']);
});
echo json_encode(['format' => $site['format'], 'config' => $site['config'], 'runtime' => $site['runtime'], 'directories' => $directories], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
`;
    }

    async function buildAppend(reader, data, scope) {
        const { page, config, mediaData, mediaAssets, content, packed, runtimePath } = reader;
        const identity = scope.documentState.identity.id;
        const metadata = scope.serverDirectoryMetadata || {};
        for (const row of data) {
            if (!Array.isArray(row) || row.length !== 4) continue;
            const id = String(row[2]);
            const template = document.createElement('template');
            template.innerHTML = content.get(id) || '';
            const references = {};
            const assets = {};
            template.content.querySelectorAll('[data-placeholder-id]').forEach(element => {
                const key = element.getAttribute('data-placeholder-id');
                const reference = mediaData[key];
                if (!reference) return;
                references[key] = reference;
                if (mediaAssets[reference.assetId]) assets[reference.assetId] = mediaAssets[reference.assetId];
            });
            const source = metadata[id] || {};
            const entry = { format: FORMAT, documentId: identity, id, name: String(row[1]), parentId: String(source.parentId || row[0]), order: source.order || 0,
                palette: source.palette || {}, html: content.get(id) || '', mediaData: references, mediaAssets: assets };
            const key = await fingerprint(new Blob([identity, '\n', id]));
            packed.set(`content/${key}.json`, new Blob([JSON.stringify(entry)], { type: 'application/json' }));
        }
        page.querySelector('.sidebar-content-inner').replaceChildren();
        page.querySelector('.sidebar-header').textContent = '正在读取目录…';
        const bootstrap = new Blob(['(', startAppendSite.toString(), ')();\n'], { type: 'text/javascript' });
        const bootstrapPath = `assets/site-${await fingerprint(bootstrap)}.js`;
        packed.set(bootstrapPath, bootstrap);
        appendScript(page, bootstrapPath);
        packed.set('index.html', serializePage(page));
        packed.set('catalog.php', new Blob([catalogSource()], { type: 'text/plain' }));
        packed.set('site.json', new Blob([JSON.stringify({ format: FORMAT, documentId: identity, config, runtime: runtimePath })], { type: 'application/json' }));
        return packed;
    }

    function deploymentInstructions(mode, encrypted) {
        return `SoraDirectory 服务器部署包\n\n${mode === 'php-append' ? `模式：PHP 追加包（需要 PHP 7.4 或更高版本）
1. 首次部署：将包内全部文件解压到同一个网站目录，以 index.html 为入口。
2. 后续追加：在同一份源文档中只选择新增或修改的目录，导出 PHP 追加包，解压覆盖到原网站目录即可。
3. 新目录 ID 自动加入；同一目录 ID 更新原内容；未导出的旧目录保留。父目录已在服务器时会自动挂回原层级，未部署父目录时暂列为顶层。
4. 保持 content、media、assets 目录及其已有文件；不要清空后再解压。每个包都包含运行文件，不需要先安装 SoraDirectory。
5. 每份独立文档使用不同的网站子目录。同一源文档请保留其 .sora 文件和文档身份，避免重新创建成另一份文档。
6. 包只新增和覆盖文件，不删除旧内容。需要删除已发布目录时，按该目录 JSON 内的 name/id 找到 content 中对应文件，备份后移除。
7. 宝塔中为该站点选择 PHP 7.4+，目录需对 PHP 可读，不需要写权限、数据库或 Composer。
8. 原站点若是旧版单 HTML、静态包或 PWA，首次切换到本模式时请导出全部已有目录建立内容文件；之后才能只导出新增目录。旧 HTML 内的内容不能自动拆分迁移。
9. 若原站点启用了 PWA 缓存，请停用旧 Service Worker 或部署到新子目录，避免旧缓存继续显示旧页面。` : `模式：通用静态包（普通 Nginx、Apache 或静态托管即可）
1. 将包内全部文件解压到网站根目录或一个子目录，以 index.html 为入口。
2. 不需要 PHP、Node.js、数据库、npm 或 SoraDirectory 安装文件。
3. 更新时导出包含旧内容与新增内容的完整文档，备份原站点后覆盖包内同名文件。
4. 静态包不自动发现服务器上额外放入的目录文件。只选择几个目录追加的需求请使用 PHP 追加包。
5. 内容与运行资源采用相对路径，可部署在任意子目录；覆盖更新不会删除旧资源文件。`}

部署前应已配置好域名/站点目录及对应 Web 服务；本包不修改服务器配置。
上传前可备份旧 index.html、site.json（若存在）和需要覆盖的 content 文件；回滚时恢复这些文件及配套资源。
${encrypted ? '正文与媒体沿用网页密码加密；ZIP 本身不是密码压缩包。\n' : ''}编辑器中使用的远程图片、外链、远程图标和外部服务仍依赖原地址。
本包为阅读站点，不包含在线编辑器和上传管理后台。
`;
    }

    async function exportSite(encrypt, password, data, scope, mode = 'static') {
        if (mode === 'php-append' && encrypt) throw new Error('PHP 追加包暂不支持密码加密，请选择不加密，或改用通用静态包');
        const staging = await stagingDirectory();
        try {
            updateSoraLoadProgress('正在准备服务器部署包', 0, data.length, '整理所选目录与媒体…');
            const context = { directory: staging.directory, sourceData: scope.serverSourceData, assetKey: value => fingerprint(new Blob([value])) };
            if (!await handleSaveAsWebpage(encrypt, password, data, { ...scope, serverPackage: context })) return false;
            const sourceFiles = await collectFiles(staging.directory);
            const files = encrypt ? sourceFiles : mode === 'php-append'
                ? await buildAppend(await prepareReader(sourceFiles), data, scope)
                : await buildStatic(await prepareReader(sourceFiles));
            files.set('DEPLOY.txt', new Blob([deploymentInstructions(mode, encrypt)], { type: 'text/plain;charset=utf-8' }));
            const name = getSoraBaseName(fileNameInput.value || currentFileName || 'soralist').replace(/[\\/:*?"<>|]/g, '_');
            const filename = `${name}_${mode === 'php-append' ? 'append-php' : 'deploy'}.zip`;
            const action = await download(files, filename);
            if (action === 'cancel') return false;
            showToast(action === 'share' ? '服务器部署包已交给分享应用' : '已发起服务器部署包下载', 'success');
            return true;
        } finally {
            hideSoraLoadProgress();
            try { await staging.cleanup(); }
            catch (error) { console.warn('清理服务器导出暂存目录失败:', error); }
        }
    }

    return { exportSite };
})();
window.SoraServerPackage = SoraServerPackage;
