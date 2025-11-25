// ============================================
// 自动化测试脚本 - 目录内容保存测试
// 使用方法：在浏览器控制台中运行此脚本
// ============================================

(function() {
    console.log('开始自动化测试...');
    
    // 测试结果
    const testResults = {
        passed: 0,
        failed: 0,
        tests: []
    };
    
    // 辅助函数：记录测试结果
    function recordTest(name, passed, message) {
        testResults.tests.push({ name, passed, message });
        if (passed) {
            testResults.passed++;
            console.log(`✅ ${name}: ${message}`);
        } else {
            testResults.failed++;
            console.error(`❌ ${name}: ${message}`);
        }
    }
    
    // 辅助函数：等待
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 辅助函数：模拟点击
    function simulateClick(element) {
        if (element) {
            element.click();
            return true;
        }
        return false;
    }
    
    // 辅助函数：模拟输入
    function simulateInput(element, text) {
        if (element) {
            element.value = text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }
        return false;
    }
    
    // 辅助函数：获取目录元素
    function getMuluElement(name) {
        const allMulus = document.querySelectorAll('.mulu');
        for (let i = 0; i < allMulus.length; i++) {
            if (allMulus[i].innerHTML === name) {
                return allMulus[i];
            }
        }
        return null;
    }
    
    // 辅助函数：获取所有目录名
    function getAllDirectoryNames() {
        const allMulus = document.querySelectorAll('.mulu');
        const names = [];
        for (let i = 0; i < allMulus.length; i++) {
            names.push(allMulus[i].innerHTML);
        }
        return names;
    }
    
    // 辅助函数：查找或使用现有目录
    function findOrUseDirectory(preferredNames, fallbackIndex = 0) {
        const allNames = getAllDirectoryNames();
        if (allNames.length === 0) {
            return null;
        }
        
        // 优先使用首选名称
        for (let preferred of preferredNames) {
            if (allNames.includes(preferred)) {
                return preferred;
            }
        }
        
        // 使用备用索引
        const index = Math.min(fallbackIndex, allNames.length - 1);
        return allNames[index];
    }
    
    // 辅助函数：获取当前目录内容
    function getCurrentContent() {
        if (jiedianwords) {
            return jiedianwords.value;
        }
        return null;
    }
    
    // 辅助函数：切换目录
    async function switchToDirectory(name) {
        const mulu = getMuluElement(name);
        if (mulu) {
            // 先保存当前目录内容
            if (currentMuluName) {
                syncPreviewToTextarea();
                await wait(100);
            }
            // 点击目录
            simulateClick(mulu);
            await wait(400); // 等待切换完成
            return true;
        }
        return false;
    }
    
    // 辅助函数：设置目录内容
    async function setDirectoryContent(name, content) {
        // 切换到目录
        if (!await switchToDirectory(name)) {
            return false;
        }
        // 设置内容
        if (jiedianwords) {
            jiedianwords.value = content;
            isUpdating = true;
            updateMarkdownPreview();
            isUpdating = false;
            // 保存内容
            syncPreviewToTextarea();
            await wait(100);
            return true;
        }
        return false;
    }
    
    // 辅助函数：验证目录内容
    async function verifyDirectoryContent(name, expectedContent) {
        if (!await switchToDirectory(name)) {
            return { passed: false, message: `找不到目录: ${name}` };
        }
        const actualContent = getCurrentContent();
        if (actualContent === expectedContent) {
            return { passed: true, message: '内容匹配' };
        } else {
            return { 
                passed: false, 
                message: `内容不匹配\n期望: ${expectedContent}\n实际: ${actualContent}` 
            };
        }
    }
    
    // 辅助函数：从mulufile验证
    function verifyInMulufile(name, expectedContent) {
        const mulu = getMuluElement(name);
        if (!mulu) {
            return { passed: false, message: `找不到目录元素: ${name}` };
        }
        const dirId = mulu.getAttribute('data-dir-id');
        const dirName = mulu.innerHTML;
        
        // 在mulufile中查找
        for (let i = 0; i < mulufile.length; i++) {
            const item = mulufile[i];
            if (item.length === 4 && item[2] === dirId && item[1] === dirName) {
                if (item[3] === expectedContent) {
                    return { passed: true, message: 'mulufile中的内容匹配' };
                } else {
                    return { 
                        passed: false, 
                        message: `mulufile中的内容不匹配\n期望: ${expectedContent}\n实际: ${item[3]}` 
                    };
                }
            }
        }
        return { passed: false, message: `在mulufile中找不到目录: ${name}` };
    }
    
    // 测试1：简单文本内容
    async function test1_SimpleText() {
        console.log('\n--- 测试1: 简单文本内容 ---');
        const content = '这是简单的测试内容';
        const dirName = findOrUseDirectory(['根目录', '简单文本目录', '测试目录1'], 0);
        
        if (!dirName) {
            recordTest('测试1: 简单文本', false, '没有可用的目录');
            return;
        }
        
        console.log(`使用目录: ${dirName}`);
        
        if (getMuluElement(dirName)) {
            await setDirectoryContent(dirName, content);
            await wait(200);
            
            // 验证
            const result1 = await verifyDirectoryContent(dirName, content);
            recordTest('测试1-1: 切换后内容正确', result1.passed, result1.message);
            
            // 切换到其他目录再切换回来
            const otherDir = findOrUseDirectory(['根目录', '特殊字符目录', 'Markdown目录'], 1);
            if (otherDir && otherDir !== dirName) {
                await switchToDirectory(otherDir);
                await wait(200);
                await switchToDirectory(dirName);
                await wait(200);
                const result2 = await verifyDirectoryContent(dirName, content);
                recordTest('测试1-2: 切换回来内容正确', result2.passed, result2.message);
            }
            
            // 验证mulufile
            const result3 = verifyInMulufile(dirName, content);
            recordTest('测试1-3: mulufile中内容正确', result3.passed, result3.message);
        } else {
            recordTest('测试1: 简单文本', false, '目录不存在，跳过测试');
        }
    }
    
    // 测试2：多行文本
    async function test2_MultilineText() {
        console.log('\n--- 测试2: 多行文本 ---');
        const content = '第一行\n第二行\n\n第三行（有空行）';
        const dirName = findOrUseDirectory(['多行文本目录', '嵌套子目录', '测试目录2'], 1);
        
        if (!dirName) {
            recordTest('测试2: 多行文本', false, '没有可用的目录');
            return;
        }
        
        console.log(`使用目录: ${dirName}`);
        
        if (getMuluElement(dirName)) {
            await setDirectoryContent(dirName, content);
            await wait(200);
            
            const result1 = await verifyDirectoryContent(dirName, content);
            recordTest('测试2-1: 多行文本保存正确', result1.passed, result1.message);
            
            // 切换测试
            const otherDir = findOrUseDirectory(['根目录', '特殊字符目录'], 0);
            if (otherDir && otherDir !== dirName) {
                await switchToDirectory(otherDir);
                await wait(200);
                await switchToDirectory(dirName);
                await wait(200);
                const result2 = await verifyDirectoryContent(dirName, content);
                recordTest('测试2-2: 切换后多行文本正确', result2.passed, result2.message);
            }
        } else {
            recordTest('测试2: 多行文本', false, '目录不存在，跳过测试');
        }
    }
    
    // 测试3：特殊字符
    async function test3_SpecialCharacters() {
        console.log('\n--- 测试3: 特殊字符 ---');
        const content = '特殊字符：\'单引号\' "双引号" `反引号` ~ @ # $ % ^ & * ( ) [ ] { } | \\ / < > ? : ; , . !';
        const dirName = findOrUseDirectory(['特殊字符目录', '根目录', '测试目录3'], 0);
        
        if (!dirName) {
            recordTest('测试3: 特殊字符', false, '没有可用的目录');
            return;
        }
        
        console.log(`使用目录: ${dirName}`);
        
        if (getMuluElement(dirName)) {
            await setDirectoryContent(dirName, content);
            await wait(200);
            
            const result1 = await verifyDirectoryContent(dirName, content);
            recordTest('测试3-1: 特殊字符保存正确', result1.passed, result1.message);
            
            // 验证mulufile
            const result2 = verifyInMulufile(dirName, content);
            recordTest('测试3-2: mulufile中特殊字符正确', result2.passed, result2.message);
        } else {
            recordTest('测试3: 特殊字符', false, '目录不存在，跳过测试');
        }
    }
    
    // 测试4：Markdown内容
    async function test4_MarkdownContent() {
        console.log('\n--- 测试4: Markdown内容 ---');
        const content = '# 标题\n\n**粗体** *斜体*\n\n1. 列表项1\n2. 列表项2\n\n```javascript\nconsole.log("test");\n```';
        const dirName = findOrUseDirectory(['Markdown目录', '代码块目录', '测试目录4'], 1);
        
        if (!dirName) {
            recordTest('测试4: Markdown内容', false, '没有可用的目录');
            return;
        }
        
        console.log(`使用目录: ${dirName}`);
        
        if (getMuluElement(dirName)) {
            await setDirectoryContent(dirName, content);
            await wait(200);
            
            const result1 = await verifyDirectoryContent(dirName, content);
            recordTest('测试4-1: Markdown内容保存正确', result1.passed, result1.message);
            
            // 切换测试
            const otherDir = findOrUseDirectory(['根目录', '特殊字符目录'], 0);
            if (otherDir && otherDir !== dirName) {
                await switchToDirectory(otherDir);
                await wait(200);
                await switchToDirectory(dirName);
                await wait(200);
                const result2 = await verifyDirectoryContent(dirName, content);
                recordTest('测试4-2: 切换后Markdown内容正确', result2.passed, result2.message);
            }
        } else {
            recordTest('测试4: Markdown内容', false, '目录不存在，跳过测试');
        }
    }
    
    // 测试5：快速切换
    async function test5_QuickSwitch() {
        console.log('\n--- 测试5: 快速切换 ---');
        const allNames = getAllDirectoryNames();
        if (allNames.length < 2) {
            recordTest('测试5: 快速切换', false, '需要至少2个目录');
            return;
        }
        
        const dir1 = allNames[0];
        const dir2 = allNames[1];
        const content1 = '目录1的内容';
        const content2 = '目录2的内容';
        
        console.log(`使用目录: ${dir1} 和 ${dir2}`);
        
        if (getMuluElement(dir1) && getMuluElement(dir2)) {
            // 设置两个目录的内容
            await setDirectoryContent(dir1, content1);
            await wait(100);
            await setDirectoryContent(dir2, content2);
            await wait(100);
            
            // 快速切换
            for (let i = 0; i < 5; i++) {
                await switchToDirectory(dir1);
                await wait(50);
                await switchToDirectory(dir2);
                await wait(50);
            }
            
            // 验证内容
            const result1 = await verifyDirectoryContent(dir1, content1);
            recordTest('测试5-1: 快速切换后目录1内容正确', result1.passed, result1.message);
            
            const result2 = await verifyDirectoryContent(dir2, content2);
            recordTest('测试5-2: 快速切换后目录2内容正确', result2.passed, result2.message);
        } else {
            recordTest('测试5: 快速切换', false, '目录不存在，跳过测试');
        }
    }
    
    // 测试6：空内容
    async function test6_EmptyContent() {
        console.log('\n--- 测试6: 空内容 ---');
        const dirName = findOrUseDirectory(['空内容目录', '根目录', '测试目录6'], 0);
        const content = '';
        
        if (!dirName) {
            recordTest('测试6: 空内容', false, '没有可用的目录');
            return;
        }
        
        console.log(`使用目录: ${dirName}`);
        
        if (getMuluElement(dirName)) {
            await setDirectoryContent(dirName, content);
            await wait(200);
            
            const result1 = await verifyDirectoryContent(dirName, content);
            recordTest('测试6-1: 空内容保存正确', result1.passed, result1.message);
            
            // 验证mulufile
            const result2 = verifyInMulufile(dirName, content);
            recordTest('测试6-2: mulufile中空内容正确', result2.passed, result2.message);
        } else {
            recordTest('测试6: 空内容', false, '目录不存在，跳过测试');
        }
    }
    
    // 测试7：长文本
    async function test7_LongText() {
        console.log('\n--- 测试7: 长文本 ---');
        const longText = '这是一个很长的文本内容。'.repeat(100);
        const dirName = findOrUseDirectory(['长文本目录', '根目录', '测试目录7'], 0);
        
        if (!dirName) {
            recordTest('测试7: 长文本', false, '没有可用的目录');
            return;
        }
        
        console.log(`使用目录: ${dirName}`);
        
        if (getMuluElement(dirName)) {
            await setDirectoryContent(dirName, longText);
            await wait(200);
            
            const result1 = await verifyDirectoryContent(dirName, longText);
            recordTest('测试7-1: 长文本保存正确', result1.passed, result1.message);
            
            // 验证mulufile
            const result2 = verifyInMulufile(dirName, longText);
            recordTest('测试7-2: mulufile中长文本正确', result2.passed, result2.message);
        } else {
            recordTest('测试7: 长文本', false, '目录不存在，跳过测试');
        }
    }
    
    // 测试8：编辑后立即切换
    async function test8_EditAndSwitch() {
        console.log('\n--- 测试8: 编辑后立即切换 ---');
        const allNames = getAllDirectoryNames();
        if (allNames.length < 2) {
            recordTest('测试8: 编辑后立即切换', false, '需要至少2个目录');
            return;
        }
        
        const dir1 = allNames[0];
        const dir2 = allNames[1];
        const content1 = '原始内容';
        const content2 = '修改后的内容';
        
        console.log(`使用目录: ${dir1} 和 ${dir2}`);
        
        if (getMuluElement(dir1) && getMuluElement(dir2)) {
            // 设置初始内容
            await setDirectoryContent(dir1, content1);
            await wait(100);
            
            // 切换到目录2
            await switchToDirectory(dir2);
            await wait(100);
            
            // 切换回目录1并立即修改
            await switchToDirectory(dir1);
            await wait(50);
            if (jiedianwords) {
                jiedianwords.value = content2;
                syncPreviewToTextarea();
            }
            await wait(50);
            
            // 立即切换到目录2
            await switchToDirectory(dir2);
            await wait(100);
            
            // 切换回目录1验证
            const result = await verifyDirectoryContent(dir1, content2);
            recordTest('测试8: 编辑后立即切换内容正确', result.passed, result.message);
        } else {
            recordTest('测试8: 编辑后立即切换', false, '目录不存在，跳过测试');
        }
    }
    
    // 运行所有测试
    async function runAllTests() {
        console.log('========================================');
        console.log('开始运行自动化测试');
        console.log('========================================\n');
        
        // 等待页面加载完成
        await wait(1000);
        
        // 检查必要的全局变量
        if (typeof mulufile === 'undefined') {
            console.error('错误: mulufile 未定义，请确保页面已加载');
            return;
        }
        
        if (typeof jiedianwords === 'undefined') {
            console.error('错误: jiedianwords 未定义，请确保页面已加载');
            return;
        }
        
        // 运行测试
        await test1_SimpleText();
        await wait(500);
        
        await test2_MultilineText();
        await wait(500);
        
        await test3_SpecialCharacters();
        await wait(500);
        
        await test4_MarkdownContent();
        await wait(500);
        
        await test5_QuickSwitch();
        await wait(500);
        
        await test6_EmptyContent();
        await wait(500);
        
        await test7_LongText();
        await wait(500);
        
        await test8_EditAndSwitch();
        await wait(500);
        
        // 输出测试结果
        console.log('\n========================================');
        console.log('测试完成');
        console.log('========================================');
        console.log(`通过: ${testResults.passed}`);
        console.log(`失败: ${testResults.failed}`);
        console.log(`总计: ${testResults.passed + testResults.failed}`);
        console.log('\n详细结果:');
        testResults.tests.forEach(test => {
            const icon = test.passed ? '✅' : '❌';
            console.log(`${icon} ${test.name}: ${test.message}`);
        });
        
        return testResults;
    }
    
    // 导出测试函数
    window.autoTestDirectoryContent = {
        runAll: runAllTests,
        test1: test1_SimpleText,
        test2: test2_MultilineText,
        test3: test3_SpecialCharacters,
        test4: test4_MarkdownContent,
        test5: test5_QuickSwitch,
        test6: test6_EmptyContent,
        test7: test7_LongText,
        test8: test8_EditAndSwitch,
        results: testResults
    };
    
    console.log('自动化测试脚本已加载！');
    console.log('使用方法:');
    console.log('  1. 加载测试数据（使用 test-directory-content.html 生成的数据）');
    console.log('  2. 在控制台运行: autoTestDirectoryContent.runAll()');
    console.log('  3. 或者运行单个测试: autoTestDirectoryContent.test1()');
    
})();

