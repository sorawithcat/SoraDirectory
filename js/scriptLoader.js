// ============================================
// 脚本加载器模块 (scriptLoader.js)
// 功能：动态加载脚本，实现分块加载
// ============================================

const ScriptLoader = (function() {
    const loadedScripts = new Set();
    const loadingPromises = new Map();
    
    /**
     * 动态加载单个脚本
     * @param {string} src - 脚本路径
     * @returns {Promise<void>}
     */
    function loadScript(src) {
        // 如果已经加载，直接返回
        if (loadedScripts.has(src)) {
            return Promise.resolve();
        }
        
        // 如果正在加载，返回现有的Promise
        if (loadingPromises.has(src)) {
            return loadingPromises.get(src);
        }
        
        // 创建新的加载Promise
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = false; // 保持执行顺序
            
            script.onload = () => {
                loadedScripts.add(src);
                loadingPromises.delete(src);
                resolve();
            };
            
            script.onerror = () => {
                loadingPromises.delete(src);
                reject(new Error(`Failed to load script: ${src}`));
            };
            
            document.head.appendChild(script);
        });
        
        loadingPromises.set(src, promise);
        return promise;
    }
    
    /**
     * 批量加载脚本（按顺序）
     * @param {string[]} scripts - 脚本路径数组
     * @returns {Promise<void>}
     */
    async function loadScripts(scripts) {
        for (const src of scripts) {
            await loadScript(src);
        }
    }
    
    /**
     * 并行加载脚本（不保证执行顺序）
     * @param {string[]} scripts - 脚本路径数组
     * @returns {Promise<void>}
     */
    async function loadScriptsParallel(scripts) {
        await Promise.all(scripts.map(src => loadScript(src)));
    }
    
    return {
        loadScript,
        loadScripts,
        loadScriptsParallel,
        isLoaded: (src) => loadedScripts.has(src)
    };
})();

// 导出到全局
window.ScriptLoader = ScriptLoader;

