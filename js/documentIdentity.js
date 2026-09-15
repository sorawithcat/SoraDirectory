(function() {
    'use strict';

    const STORAGE_KEY = 'sora_current_document_identity_v1';
    let current = readStored() || createId();

    function readStored() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return value && typeof value.id === 'string' ? value : null;
        } catch (_) {
            return null;
        }
    }

    function createId() {
        const random = window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID().replace(/-/g, '')
            : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        return { id: `doc_${random.slice(0, 24)}`, label: '未命名文档', source: 'new' };
    }

    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch (_) {}
    }

    function hashText(text) {
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function signatureForFile(file) {
        if (!file) return '';
        return `file_${hashText([file.name, file.size, file.lastModified, file.type].join('|'))}`;
    }

    function get() {
        return { ...current };
    }

    function adopt(id, label, source = 'file') {
        const safeId = String(id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
        current = {
            id: safeId || createId().id,
            label: String(label || '未命名文档').trim().slice(0, 200) || '未命名文档',
            source: String(source || 'file').slice(0, 30)
        };
        persist();
        return get();
    }

    function adoptFile(file, embeddedId) {
        return adopt(embeddedId || signatureForFile(file), file && file.name, embeddedId ? 'sora' : 'legacy');
    }

    function newDocument(label = '未命名文档') {
        const next = createId();
        return adopt(next.id, label, 'new');
    }

    persist();
    window.SoraDocumentIdentity = { get, adopt, adoptFile, newDocument, signatureForFile };
})();
