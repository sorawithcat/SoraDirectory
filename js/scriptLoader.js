const ScriptLoader = (function() {
    const loadedScripts = new Set();
    const loadingPromises = new Map();
    /**
     * 动态加载单个脚本
     * @param {string} src - 脚本路径
     * @returns {Promise<void>}
     */
function loadScript(src) {
        if (loadedScripts.has(src)) {
            return Promise.resolve();
        }
        if (loadingPromises.has(src)) {
            return loadingPromises.get(src);
        }
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = false; 
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
    async function loadScripts(scripts) {
        for (const src of scripts) {
            await loadScript(src);
        }
    }
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
window.ScriptLoader = ScriptLoader;