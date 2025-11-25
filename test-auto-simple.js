// ============================================
// 简化版自动化测试 - 直接运行测试
// 在浏览器控制台中运行此脚本
// ============================================

(async function autoTest() {
    console.log('🚀 开始自动化测试目录内容保存...\n');
    
    const results = { passed: 0, failed: 0, tests: [] };
    
    function logTest(name, passed, msg) {
        results.tests.push({ name, passed, msg });
        console.log(passed ? `✅ ${name}` : `❌ ${name}: ${msg}`);
        if (passed) results.passed++; else results.failed++;
    }
    
    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    
    function getMulu(name) {
        const all = document.querySelectorAll('.mulu');
        for (let m of all) if (m.innerHTML === name) return m;
        return null;
    }
    
    async function switchTo(name) {
        const m = getMulu(name);
        if (!m) return false;
        if (currentMuluName) syncPreviewToTextarea();
        m.click();
        await wait(400);
        return true;
    }
    
    async function setContent(name, content) {
        if (!await switchTo(name)) return false;
        if (jiedianwords) {
            jiedianwords.value = content;
            isUpdating = true;
            updateMarkdownPreview();
            isUpdating = false;
            syncPreviewToTextarea();
            await wait(100);
        }
        return true;
    }
    
    async function verify(name, expected) {
        if (!await switchTo(name)) return { ok: false, msg: '找不到目录' };
        const actual = jiedianwords ? jiedianwords.value : '';
        return { ok: actual === expected, msg: actual === expected ? '匹配' : `不匹配: ${actual}` };
    }
    
    function verifyInFile(name, expected) {
        const m = getMulu(name);
        if (!m) return { ok: false, msg: '找不到元素' };
        const dirId = m.getAttribute('data-dir-id');
        const dirName = m.innerHTML;
        for (let item of mulufile) {
            if (item.length === 4 && item[2] === dirId && item[1] === dirName) {
                return { ok: item[3] === expected, msg: item[3] === expected ? '匹配' : '不匹配' };
            }
        }
        return { ok: false, msg: '在mulufile中找不到' };
    }
    
    await wait(1000);
    
    // 测试1: 简单文本
    console.log('\n--- 测试1: 简单文本 ---');
    const test1Content = '简单测试内容';
    const test1Dir = '根目录';
    if (getMulu(test1Dir)) {
        await setContent(test1Dir, test1Content);
        const r1 = await verify(test1Dir, test1Content);
        logTest('测试1-1: 简单文本保存', r1.ok, r1.msg);
        
        if (getMulu('特殊字符目录')) {
            await switchTo('特殊字符目录');
            await wait(200);
            await switchTo(test1Dir);
            const r2 = await verify(test1Dir, test1Content);
            logTest('测试1-2: 切换后内容正确', r2.ok, r2.msg);
        }
        
        const r3 = verifyInFile(test1Dir, test1Content);
        logTest('测试1-3: mulufile中正确', r3.ok, r3.msg);
    } else {
        logTest('测试1', false, '目录不存在');
    }
    
    // 测试2: 多行文本
    console.log('\n--- 测试2: 多行文本 ---');
    const test2Content = '第一行\n第二行\n\n第三行';
    const test2Dir = '特殊字符目录';
    if (getMulu(test2Dir)) {
        await setContent(test2Dir, test2Content);
        const r = await verify(test2Dir, test2Content);
        logTest('测试2: 多行文本', r.ok, r.msg);
    } else {
        logTest('测试2', false, '目录不存在');
    }
    
    // 测试3: 特殊字符
    console.log('\n--- 测试3: 特殊字符 ---');
    const test3Content = '特殊: \'"`~@#$%^&*()[]{}|\\/<>?:;,.!';
    const test3Dir = '特殊字符目录';
    if (getMulu(test3Dir)) {
        await setContent(test3Dir, test3Content);
        const r = await verify(test3Dir, test3Content);
        logTest('测试3: 特殊字符', r.ok, r.msg);
    } else {
        logTest('测试3', false, '目录不存在');
    }
    
    // 测试4: Markdown
    console.log('\n--- 测试4: Markdown ---');
    const test4Content = '# 标题\n\n**粗体** *斜体*\n\n1. 列表';
    const test4Dir = 'Markdown目录';
    if (getMulu(test4Dir)) {
        await setContent(test4Dir, test4Content);
        const r = await verify(test4Dir, test4Content);
        logTest('测试4: Markdown', r.ok, r.msg);
    } else {
        logTest('测试4', false, '目录不存在');
    }
    
    // 测试5: 快速切换
    console.log('\n--- 测试5: 快速切换 ---');
    const dir1 = '根目录';
    const dir2 = '特殊字符目录';
    const c1 = '目录1内容';
    const c2 = '目录2内容';
    if (getMulu(dir1) && getMulu(dir2)) {
        await setContent(dir1, c1);
        await setContent(dir2, c2);
        for (let i = 0; i < 3; i++) {
            await switchTo(dir1);
            await wait(50);
            await switchTo(dir2);
            await wait(50);
        }
        const r1 = await verify(dir1, c1);
        const r2 = await verify(dir2, c2);
        logTest('测试5-1: 快速切换目录1', r1.ok, r1.msg);
        logTest('测试5-2: 快速切换目录2', r2.ok, r2.msg);
    } else {
        logTest('测试5', false, '目录不存在');
    }
    
    // 测试6: 空内容
    console.log('\n--- 测试6: 空内容 ---');
    const test6Dir = '空内容目录';
    if (getMulu(test6Dir)) {
        await setContent(test6Dir, '');
        const r = await verify(test6Dir, '');
        logTest('测试6: 空内容', r.ok, r.msg);
    } else {
        logTest('测试6', false, '目录不存在');
    }
    
    // 测试7: 编辑后立即切换
    console.log('\n--- 测试7: 编辑后立即切换 ---');
    const test7Dir = '根目录';
    const original = '原始内容';
    const modified = '修改后内容';
    if (getMulu(test7Dir)) {
        await setContent(test7Dir, original);
        if (getMulu('特殊字符目录')) {
            await switchTo('特殊字符目录');
            await wait(100);
            await switchTo(test7Dir);
            await wait(50);
            if (jiedianwords) {
                jiedianwords.value = modified;
                syncPreviewToTextarea();
            }
            await wait(50);
            await switchTo('特殊字符目录');
            await wait(100);
            const r = await verify(test7Dir, modified);
            logTest('测试7: 编辑后立即切换', r.ok, r.msg);
        }
    } else {
        logTest('测试7', false, '目录不存在');
    }
    
    // 输出结果
    console.log('\n========================================');
    console.log('📊 测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${results.passed}`);
    console.log(`❌ 失败: ${results.failed}`);
    console.log(`📈 总计: ${results.passed + results.failed}`);
    console.log(`📊 通过率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    console.log('\n详细结果:');
    results.tests.forEach(t => {
        console.log(`${t.passed ? '✅' : '❌'} ${t.name}: ${t.msg}`);
    });
    
    return results;
})();

