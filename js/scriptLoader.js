const ScriptLoader = (function() {
    const SCRIPT_TIMEOUT = 20000;
    const loadedScripts = new Set();
    const loadingPromises = new Map();
    const preloadedScripts = new Set();

    function emitProgress(src, state) {
        document.dispatchEvent(new CustomEvent('sora-script-loader', {
            detail: { src, state, loaded: loadedScripts.size }
        }));
    }

    function preloadScript(src) {
        if (!src || preloadedScripts.has(src) || loadedScripts.has(src)) return;
        preloadedScripts.add(src);
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = src;
        document.head.appendChild(link);
    }

    function preloadScripts(scripts) {
        (scripts || []).forEach(preloadScript);
    }

    function loadScript(src) {
        if (loadedScripts.has(src)) {
            return Promise.resolve();
        }
        if (loadingPromises.has(src)) {
            return loadingPromises.get(src);
        }

        const existing = document.querySelector('script[data-sora-script="' + src.replace(/"/g, '\\"') + '"]');
        if (existing && existing.dataset.loaded === 'true') {
            loadedScripts.add(src);
            return Promise.resolve();
        }

        const promise = new Promise((resolve, reject) => {
            const script = existing || document.createElement('script');
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                loadingPromises.delete(src);
                emitProgress(src, 'timeout');
                reject(new Error(`加载脚本超时: ${src}`));
            }, SCRIPT_TIMEOUT);

            const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                loadedScripts.add(src);
                loadingPromises.delete(src);
                script.dataset.loaded = 'true';
                emitProgress(src, 'loaded');
                resolve();
            };

            const fail = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                loadingPromises.delete(src);
                emitProgress(src, 'error');
                reject(new Error(`加载脚本失败: ${src}`));
            };

            script.src = src;
            script.type = 'text/javascript';
            script.async = false;
            script.dataset.soraScript = src;
            script.onload = finish;
            script.onerror = fail;

            if (!existing) {
                document.head.appendChild(script);
            }
            emitProgress(src, 'loading');
        });

        loadingPromises.set(src, promise);
        return promise;
    }

    async function loadScripts(scripts) {
        preloadScripts(scripts);
        for (const src of scripts) {
            await loadScript(src);
        }
    }

    async function loadScriptsParallel(scripts) {
        preloadScripts(scripts);
        await Promise.all(scripts.map(src => loadScript(src)));
    }

    return {
        loadScript,
        loadScripts,
        loadScriptsParallel,
        preloadScript,
        preloadScripts,
        isLoaded: (src) => loadedScripts.has(src)
    };
})();
window.ScriptLoader = ScriptLoader;
