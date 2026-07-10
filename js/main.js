document.addEventListener('contextmenu', function (e) {
    if (e.target === markdownPreview || markdownPreview.contains(e.target)) {
        e.preventDefault();
        showTextFormatToolbar(e);
        return;
    }
    if (e.target.closest && e.target.closest('.mulu')) {
        e.preventDefault();
    }
});
window.addEventListener('beforeunload', function(e) {
    if (typeof hasUnsavedChanges !== 'undefined' && hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
        return e.returnValue;
    }
});
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (typeof handleSave === 'function') {
            handleSave();
        }
    }
});
function initOnDOMReady() {
    if (typeof LicenseUI !== 'undefined') {
        if (!LicenseSystem.isAuthorized()) {
            LicenseUI.showAuthDialog();
            const initAfterAuth = async () => {
                await initializeApp();
            };
            const checkAuthInterval = setInterval(() => {
                if (LicenseSystem.isAuthorized()) {
                    clearInterval(checkAuthInterval);
                    initAfterAuth();
                }
            }, 500);
            return; 
        }
    }
    initializeApp();
}
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initOnDOMReady);
} else {
    initOnDOMReady();
}
async function initializeApp() {
    if (navigator.storage && navigator.storage.persist) {
        const requestPersistentStorage = async () => {
            try {
                const alreadyPersisted = navigator.storage.persisted
                    ? await navigator.storage.persisted()
                    : false;
                if (!alreadyPersisted) {
                    await navigator.storage.persist();
                }
                if (typeof updateStorageInfo === 'function') {
                    await updateStorageInfo({ force: true });
                }
            } catch (err) {
                console.warn('请求持久化存储失败:', err);
            }
        };
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(requestPersistentStorage, { timeout: 1500 });
        } else {
            setTimeout(requestPersistentStorage, 200);
        }
    }
    for (let i = 0; i < allThins.length; i++) {
        if (!allThins[i].id) {
            allThins[i].id = getOneId(10, 0);
        }
    }
    if (typeof mulufile !== 'undefined' && Array.isArray(mulufile) && mulufile.length > 0) {
        LoadMulu();
    } else {
        if (typeof window.loadHelpManual === 'function') {
            await window.loadHelpManual({ silent: true, force: true });
        }
    }
    if (typeof calculateAllHashes === 'function') {
        const calculateHashes = () => {
            calculateAllHashes();
        };
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(calculateHashes, { timeout: 500 });
        } else {
            setTimeout(calculateHashes, 50);
        }
    }
    if (typeof isFileSystemAccessSupported === 'function') {
        setTimeout(() => {
            if (isFileSystemAccessSupported()) {
            } else {
                if (topLoadBtn) {
                    topLoadBtn.title = '加载文件（不支持直接保存）';
                }
            }
        }, 0);
    }
    if (typeof mulufile !== 'undefined' && Array.isArray(mulufile) && mulufile.length > 0) {
        requestAnimationFrame(() => {
            if (typeof expandAllDirectories === 'function') {
                expandAllDirectories();
            }
            let firstRootMulu = null;
            let allMulusForSelect = document.querySelectorAll(".mulu");
            for (let i = 0; i < allMulusForSelect.length; i++) {
                let mulu = allMulusForSelect[i];
                let parentId = mulu.getAttribute("data-parent-id");
                if (!parentId || parentId === "mulu") {
                    firstRootMulu = mulu;
                    break;
                }
            }
            if (firstRootMulu) {
                if (typeof switchToDirectoryElement === 'function') {
                    switchToDirectoryElement(firstRootMulu, { syncCurrent: false, scrollPreviewTop: true, forceRender: true });
                } else {
                    currentMuluName = firstRootMulu.id;
                    RemoveOtherSelect();
                    firstRootMulu.classList.add("select");
                    jiedianwords.value = findMulufileData(firstRootMulu);
                    isUpdating = true;
                    updateMarkdownPreview({ force: true });
                    isUpdating = false;
                }
            }
        });
    }
}
