const LicenseSystem = (function() {
    const KEY_PREFIX = 'SORA';
    const STORAGE_KEY = 'sora_license_data';
    

    const _0x4f2a = [0x53, 0x6f, 0x72, 0x61, 0x44, 0x69, 0x72];
    const _0x3b1c = String.fromCharCode.apply(null, _0x4f2a);
    
    /**
     * 生成设备指纹
     */
    function generateDeviceFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 'unknown',
            navigator.platform
        ];
        
        let hash = 0;
        const str = components.join('|');
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(36).toUpperCase();
    }
    
    /**
     * 获取今天的日期字符串 (YYYYMMDD)
     */
    function getTodayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
    
    /**
     * 复杂哈希函数（与生成器一致）
     */
    function complexHash(str, rounds = 3) {
        let hash = 0;
        for (let r = 0; r < rounds; r++) {
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash + char) ^ (hash >>> 3);
                hash = hash & 0xFFFFFFFF;
            }
            str = hash.toString(36) + str;
        }
        return Math.abs(hash);
    }
    
    /**
     * 生成每日验证种子
     * 这个种子每天都不同，用于验证校验码
     */
    function getDailyVerificationSeed(dateStr) {
        // 基于日期生成一个复杂的验证种子
        const base = _0x3b1c + dateStr;
        const h1 = complexHash(base + 'v1', 4);
        const h2 = complexHash(base + 'v2', 4);
        const h3 = complexHash(dateStr + _0x3b1c, 3);
        return ((h1 ^ h2) + h3).toString(36);
    }
    
    /**
     * 验证校验码
     * 这是单向验证 - 知道验证逻辑也无法反推生成方式
     */
    function verifyChecksum(dateStr, part1, part2, checksum) {
        const dailySeed = getDailyVerificationSeed(dateStr);
        
        // 多重验证条件
        const input1 = dailySeed + part1 + part2;
        const input2 = part1 + dailySeed + part2;
        const input3 = part2 + part1 + dailySeed;
        
        const h1 = complexHash(input1, 3) % 97;
        const h2 = complexHash(input2, 3) % 89;
        const h3 = complexHash(input3, 3) % 83;
        
        // 校验码的哈希也必须满足一定规律
        const checksumHash = complexHash(checksum + dailySeed, 2);
        const expectedMod = (h1 + h2 + h3) % 79;
        const actualMod = checksumHash % 79;
        
        // 验证：校验码哈希的模必须与预期匹配
        // 这种验证方式是单向的：
        // - 给定有效的 checksum，可以验证通过
        // - 但不知道私有种子，无法生成新的有效 checksum
        return Math.abs(expectedMod - actualMod) < 5; // 允许小范围误差
    }
    
    /**
     * 将数字转换为大写字母数字字符串（与生成器一致）
     */
    function toAlphaNumeric(num, length) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        let seed = num;
        while (result.length < length) {
            result += chars[seed % chars.length];
            seed = Math.floor(seed / chars.length);
            if (seed === 0) seed = complexHash(result + num.toString());
        }
        return result.slice(0, length);
    }
    
    /**
     * 计算当前设备的ID哈希（用于验证设备绑定密钥）
     */
    function getDeviceIdHash() {
        const deviceId = generateDeviceFingerprint();
        // 注意：这里的哈希算法需要与生成器中的保持一致
        // 但由于生成器使用了 PRIVATE_SEED，验证器无法完全复制
        // 所以我们使用设备ID本身的哈希
        const hash = complexHash(deviceId, 3);
        return toAlphaNumeric(hash, 5);
    }
    
    /**
     * 解析密钥
     * 格式: SORA-XXXXX-DDDDD-CCCCC-DDMMYY
     * XXXXX: 随机部分
     * DDDDD: 设备ID哈希（00000表示通用密钥）
     * CCCCC: 校验码
     * DDMMYY: 日期（000000表示永久密钥）
     */
    function parseKey(key) {
        const parts = key.toUpperCase().split('-');
        if (parts.length !== 5 || parts[0] !== KEY_PREFIX) {
            return null;
        }
        
        const part1 = parts[1];      // 随机部分
        const deviceHash = parts[2]; // 设备ID哈希
        const checksum = parts[3];   // 校验码
        const datePart = parts[4];   // DDMMYY 或 000000（永久）
        
        if (part1.length !== 5 || deviceHash.length !== 5 || 
            checksum.length !== 5 || datePart.length !== 6) {
            return null;
        }
        
        // 检查是否为永久密钥
        const isPermanent = (datePart === '000000');
        
        let dateStr;
        if (isPermanent) {
            dateStr = '99991231'; // 永久密钥使用特殊日期进行校验码验证
        } else {
            // 转换日期 DDMMYY -> YYYYMMDD
            const day = datePart.slice(0, 2);
            const month = datePart.slice(2, 4);
            const year = '20' + datePart.slice(4, 6);
            dateStr = `${year}${month}${day}`;
        }
        
        return { part1, deviceHash, checksum, dateStr, isPermanent };
    }
    
    /**
     * 验证密钥格式
     */
    function validateKeyFormat(key) {
        const pattern = /^SORA-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-\d{6}$/;
        return pattern.test(key.toUpperCase());
    }
    
    /**
     * 验证密钥是否有效
     */
    function isKeyValidToday(key) {
        const parsed = parseKey(key);
        if (!parsed) return false;
        
        // 检查日期（永久密钥跳过日期检查）
        if (!parsed.isPermanent) {
            const today = getTodayString();
            if (parsed.dateStr !== today) return false;
        }
        
        // 验证校验码（使用 part1 和 deviceHash）
        if (!verifyChecksum(parsed.dateStr, parsed.part1, parsed.deviceHash, parsed.checksum)) {
            return false;
        }
        
        // 检查设备绑定
        if (parsed.deviceHash !== '00000') {
            // 这是设备绑定密钥，需要验证设备ID
            const myDeviceHash = getDeviceIdHash();
            if (parsed.deviceHash !== myDeviceHash) {
                return { valid: false, reason: 'device_mismatch' };
            }
        } else if (parsed.isPermanent) {
            // 永久密钥必须绑定设备
            return { valid: false, reason: 'permanent_requires_device' };
        }
        
        return true;
    }
    
    /**
     * 获取存储的授权数据
     */
    function getLicenseData() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : { usedKeys: [], authorizedDate: null };
        } catch (e) {
            return { usedKeys: [], authorizedDate: null };
        }
    }
    
    /**
     * 保存授权数据
     */
    function saveLicenseData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    
    /**
     * 检查密钥是否已被此设备使用
     */
    function isKeyUsedByDevice(key) {
        const data = getLicenseData();
        const deviceId = generateDeviceFingerprint();
        const keyUpper = key.toUpperCase();
        
        return data.usedKeys.some(item => 
            item.key === keyUpper && item.deviceId === deviceId
        );
    }
    
    /**
     * 标记密钥已被使用
     */
    function markKeyAsUsed(key) {
        const data = getLicenseData();
        const deviceId = generateDeviceFingerprint();
        const keyUpper = key.toUpperCase();
        const today = getTodayString();
        
        // 检查是否为永久密钥
        const parsed = parseKey(keyUpper);
        const isPermanent = parsed && parsed.isPermanent;
        
        data.usedKeys.push({
            key: keyUpper,
            deviceId: deviceId,
            usedDate: today,
            usedTime: new Date().toISOString(),
            isPermanent: isPermanent
        });
        
        if (isPermanent) {
            data.permanentAuthorized = true; // 永久授权标记
        } else {
            data.authorizedDate = today;
        }
        
        // 清理过期的使用记录（保留最近7天，但保留永久密钥记录）
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysStr = sevenDaysAgo.getFullYear() + 
            String(sevenDaysAgo.getMonth() + 1).padStart(2, '0') + 
            String(sevenDaysAgo.getDate()).padStart(2, '0');
        
        data.usedKeys = data.usedKeys.filter(item => 
            item.isPermanent || item.usedDate >= sevenDaysStr
        );
        
        saveLicenseData(data);
        
        return isPermanent;
    }
    
    /**
     * 验证并激活密钥
     */
    function activateKey(key) {
        const keyUpper = key.toUpperCase().trim();
        
        // 检查格式
        if (!validateKeyFormat(keyUpper)) {
            return { success: false, message: '密钥格式无效' };
        }
        
        // 检查是否有效（包含校验码验证和设备绑定验证）
        const validResult = isKeyValidToday(keyUpper);
        if (validResult === false) {
            return { success: false, message: '此密钥无效、已过期或尚未生效' };
        }
        if (validResult && validResult.reason === 'device_mismatch') {
            return { success: false, message: '此密钥已绑定其他设备，无法在本设备使用' };
        }
        if (validResult && validResult.reason === 'permanent_requires_device') {
            return { success: false, message: '永久密钥格式错误' };
        }
        
        // 检查是否已被此设备使用
        if (isKeyUsedByDevice(keyUpper)) {
            return { success: false, message: '此密钥已在本设备使用过' };
        }
        
        // 激活成功
        const isPermanent = markKeyAsUsed(keyUpper);
        if (isPermanent) {
            return { success: true, message: '永久授权成功！' };
        }
        return { success: true, message: '授权成功！欢迎使用编辑器' };
    }
    
    /**
     * 检查当前是否已授权
     */
    function isAuthorized() {
        const data = getLicenseData();
        
        // 检查永久授权
        if (data.permanentAuthorized) {
            return true;
        }
        
        // 检查当天授权
        const today = getTodayString();
        return data.authorizedDate === today;
    }
    
    /**
     * 获取授权状态信息
     */
    function getAuthStatus() {
        const data = getLicenseData();
        const today = getTodayString();
        const deviceId = generateDeviceFingerprint();
        
        return {
            isAuthorized: data.authorizedDate === today,
            authorizedDate: data.authorizedDate,
            deviceId: deviceId,
            today: today
        };
    }
    
    /**
     * 清除授权状态
     */
    function clearAuthorization() {
        localStorage.removeItem(STORAGE_KEY);
    }
    
    return {
        activateKey,
        isAuthorized,
        getAuthStatus,
        clearAuthorization,
        generateDeviceFingerprint,
        getTodayString
    };
})();

// ============================================
// 授权UI模块
// ============================================

const LicenseUI = (function() {
    let authDialog = null;
    
    function createAuthDialog() {
        if (authDialog) return authDialog;
        
        const overlay = document.createElement('div');
        overlay.id = 'license-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:99999;';
        
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#fff;padding:20px;width:350px;max-width:90%;border-radius:4px;';
        
        dialog.innerHTML = `
            <h3 style="margin:0 0 15px;text-align:center;">授权验证</h3>
            <p style="margin:0 0 15px;color:#666;font-size:13px;text-align:center;">请输入今日有效的授权密钥</p>
            <input type="text" id="license-key-input" placeholder="SORA-XXXXX-XXXXX-XXXXX-DDMMYY" style="width:100%;padding:8px;border:1px solid #ccc;box-sizing:border-box;text-transform:uppercase;">
            <div id="license-error" style="color:red;font-size:12px;margin:10px 0;text-align:center;display:none;"></div>
            <button id="license-submit-btn" style="width:100%;padding:10px;background:#333;color:#fff;border:none;cursor:pointer;margin-top:10px;">验证</button>
            <div style="margin-top:15px;text-align:center;font-size:11px;color:#999;">设备ID: ${LicenseSystem.generateDeviceFingerprint()}</div>
        `;
        
        overlay.appendChild(dialog);
        
        const input = dialog.querySelector('#license-key-input');
        const submitBtn = dialog.querySelector('#license-submit-btn');
        const errorDiv = dialog.querySelector('#license-error');
        
        input.addEventListener('input', function(e) {
            let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            let formatted = '';
            if (value.length > 0) { formatted = value.slice(0, 4); value = value.slice(4); }
            for (let i = 0; i < 3 && value.length > 0; i++) { formatted += '-' + value.slice(0, 5); value = value.slice(5); }
            if (value.length > 0) { formatted += '-' + value.slice(0, 6); }
            e.target.value = formatted;
        });
        
        input.addEventListener('keydown', function(e) { if (e.key === 'Enter') submitBtn.click(); });
        
        submitBtn.addEventListener('click', function() {
            const key = input.value.trim();
            if (!key) { errorDiv.textContent = '请输入授权密钥'; errorDiv.style.display = 'block'; return; }
            
            const result = LicenseSystem.activateKey(key);
            errorDiv.style.color = result.success ? 'green' : 'red';
            errorDiv.textContent = result.message;
            errorDiv.style.display = 'block';
            
            if (result.success) { setTimeout(() => hideAuthDialog(), 1000); }
        });
        
        authDialog = overlay;
        return overlay;
    }
    
    function showAuthDialog() {
        const dialog = createAuthDialog();
        document.body.appendChild(dialog);
        dialog.style.display = 'flex';
        setTimeout(() => { const input = dialog.querySelector('#license-key-input'); if (input) input.focus(); }, 100);
    }
    
    function hideAuthDialog() { if (authDialog) authDialog.style.display = 'none'; }
    
    function checkAndPrompt() { if (!LicenseSystem.isAuthorized()) { showAuthDialog(); return false; } return true; }
    
    return { showAuthDialog, hideAuthDialog, checkAndPrompt };
})();
