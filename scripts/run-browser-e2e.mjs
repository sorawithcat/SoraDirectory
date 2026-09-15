import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const artifactRoot = path.join(projectRoot, '.artifacts', 'browser-e2e');
const edgeCandidates = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
];

async function existingPath(candidates) {
    const { access } = await import('node:fs/promises');
    for (const candidate of candidates) {
        if (!candidate) continue;
        try { await access(candidate); return candidate; } catch {}
    }
    return '';
}

async function freePort() {
    const server = net.createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    server.close();
    await once(server, 'close');
    return port;
}

async function poll(task, timeoutMs = 30000, intervalMs = 100) {
    const startedAt = Date.now();
    let lastError;
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const value = await task();
            if (value) return value;
        } catch (error) { lastError = error; }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw lastError || new Error('Timed out waiting for browser state.');
}

function safeArtifactPath(target) {
    const resolved = path.resolve(target);
    const allowed = path.resolve(artifactRoot) + path.sep;
    if (!resolved.startsWith(allowed)) throw new Error(`Refusing to delete outside browser artifacts: ${resolved}`);
    return resolved;
}

function createCdpClient(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    const listeners = new Set();
    let sequence = 0;
    const ready = new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', () => reject(new Error('Unable to connect to Edge DevTools.')), { once: true });
    });
    socket.addEventListener('message', event => {
        const message = JSON.parse(String(event.data));
        if (message.id && pending.has(message.id)) {
            const { resolve, reject } = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) reject(new Error(message.error.message));
            else resolve(message.result);
            return;
        }
        listeners.forEach(listener => listener(message));
    });
    return {
        ready,
        onEvent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        async send(method, params = {}) {
            await ready;
            const id = ++sequence;
            const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
            socket.send(JSON.stringify({ id, method, params }));
            return result;
        },
        close() { socket.close(); }
    };
}

async function runCase(edge, serverPort, viewport) {
    const caseDir = safeArtifactPath(path.join(artifactRoot, viewport));
    await rm(caseDir, { recursive: true, force: true });
    await mkdir(caseDir, { recursive: true });
    const profile = safeArtifactPath(path.join(caseDir, 'profile'));
    const debugPort = await freePort();
    const size = viewport === 'mobile' ? '430,900' : '1440,1000';
    const url = `http://127.0.0.1:${serverPort}/tests/browser-e2e.html?viewport=${viewport}`;
    const edgeLog = [];
    const browser = spawn(edge, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--remote-allow-origins=*',
        `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, `--window-size=${size}`, url
    ], { cwd: projectRoot, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    browser.stderr.setEncoding('utf8');
    browser.stderr.on('data', chunk => edgeLog.push(chunk));
    let client;
    const consoleLog = [];
    let result = 'failed';
    try {
        const target = await poll(async () => {
            const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
            const pages = await response.json();
            return pages.find(page => page.type === 'page' && page.url.includes('/tests/browser-e2e.html'));
        });
        client = createCdpClient(target.webSocketDebuggerUrl);
        await client.ready;
        client.onEvent(message => {
            if (message.method === 'Runtime.consoleAPICalled') {
                consoleLog.push(`${message.params.type}: ${(message.params.args || []).map(arg => arg.value ?? arg.description ?? '').join(' ')}`);
            }
            if (message.method === 'Runtime.exceptionThrown') {
                const details = message.params.exceptionDetails || {};
                const location = details.url ? `${details.url}:${Number(details.lineNumber || 0) + 1}:${Number(details.columnNumber || 0) + 1}` : '';
                consoleLog.push(`exception: ${details.exception?.description || details.text || 'Unknown exception'}${location ? `\n${location}` : ''}`);
            }
        });
        await client.send('Runtime.enable');
        await client.send('Page.enable');
        result = await poll(async () => {
            const response = await client.send('Runtime.evaluate', { expression: 'document.body && document.body.dataset.testStatus', returnByValue: true });
            const value = response.result?.value;
            return value === 'passed' || value === 'failed' ? value : '';
        }, 45000, 150);
        if (result !== 'passed') {
            const dom = await client.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
            const screenshot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
            await writeFile(path.join(caseDir, 'dom.html'), dom.result?.value || '', 'utf8');
            await writeFile(path.join(caseDir, 'screenshot.png'), Buffer.from(screenshot.data, 'base64'));
            await writeFile(path.join(caseDir, 'console.log'), [...consoleLog, ...edgeLog].join('\n'), 'utf8');
        }
    } catch (error) {
        consoleLog.push(error.stack || error.message || String(error));
        if (client) {
            try {
                const dom = await client.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
                await writeFile(path.join(caseDir, 'dom.html'), dom.result?.value || '', 'utf8');
                const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
                await writeFile(path.join(caseDir, 'screenshot.png'), Buffer.from(screenshot.data, 'base64'));
            } catch {}
        }
        await writeFile(path.join(caseDir, 'console.log'), [...consoleLog, ...edgeLog].join('\n'), 'utf8');
        result = 'failed';
    } finally {
        client?.close();
        browser.kill();
        await poll(() => browser.exitCode !== null, 5000, 50).catch(() => {});
        await rm(profile, { recursive: true, force: true });
    }
    if (result === 'passed') {
        await rm(caseDir, { recursive: true, force: true });
        process.stdout.write(`PASS browser-e2e ${viewport}\n`);
        return true;
    }
    process.stderr.write(`FAIL browser-e2e ${viewport} - artifacts: ${caseDir}\n`);
    return false;
}

const edge = await existingPath(edgeCandidates);
if (!edge) throw new Error('Microsoft Edge was not found.');
await mkdir(artifactRoot, { recursive: true });
const serverPort = await freePort();
const server = spawn('python', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], { cwd: projectRoot, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
try {
    await poll(async () => (await fetch(`http://127.0.0.1:${serverPort}/index.html`)).ok, 10000);
    const results = [];
    for (const viewport of ['desktop', 'mobile']) results.push(await runCase(edge, serverPort, viewport));
    if (results.some(value => !value)) process.exitCode = 1;
    else await rm(artifactRoot, { recursive: true, force: true });
} finally {
    server.kill();
}
