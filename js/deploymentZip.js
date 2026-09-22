(function() {
    'use strict';

    // ZIP headers follow PKWARE APPNOTE; text compression uses the browser's raw DEFLATE stream.
    const UINT32_MAX = 0xffffffff;
    const encoder = new TextEncoder();
    const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
        for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
        return value >>> 0;
    });

    async function checksum(blob) {
        let crc = UINT32_MAX;
        for (let offset = 0; offset < blob.size; offset += 4 * 1024 * 1024) {
            const bytes = new Uint8Array(await blob.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer());
            for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        return (crc ^ UINT32_MAX) >>> 0;
    }

    function record(size, signature) {
        const bytes = new Uint8Array(size);
        const view = new DataView(bytes.buffer);
        view.setUint32(0, signature, true);
        return { bytes, view };
    }

    function zip64Extra(values) {
        if (!values.length) return new Uint8Array();
        const extra = new Uint8Array(4 + values.length * 8);
        const view = new DataView(extra.buffer);
        view.setUint16(0, 1, true);
        view.setUint16(2, values.length * 8, true);
        values.forEach((value, index) => view.setBigUint64(4 + index * 8, BigInt(value), true));
        return extra;
    }

    function safePath(value) {
        const path = String(value || '').replace(/\\/g, '/');
        if (!path || path.startsWith('/') || /[:\x00-\x1f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
            throw new Error('部署包包含无效文件路径');
        }
        return path;
    }

    async function write(entries, writePart, onProgress = () => {}) {
        const files = Array.from(entries, ([path, blob]) => ({ path: safePath(path), blob }));
        const names = new Set();
        for (const file of files) {
            if (!(file.blob instanceof Blob) || names.has(file.path)) throw new Error('部署包文件无效或路径重复');
            names.add(file.path);
        }
        const central = [];
        let offset = 0;
        const append = async part => {
            const size = part instanceof Blob ? part.size : part.byteLength;
            if (!Number.isSafeInteger(offset + size)) throw new Error('部署包超出可处理大小');
            await writePart(part);
            offset += size;
        };
        const now = new Date();
        const year = Math.min(2107, Math.max(1980, now.getFullYear()));
        const date = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);

        for (let index = 0; index < files.length; index++) {
            const { path, blob } = files[index];
            onProgress(index, files.length, path);
            const name = encoder.encode(path);
            if (name.length > 0xffff) throw new Error('部署包文件路径过长');
            const crc = await checksum(blob);
            let payload = blob;
            let method = 0;
            if (/\.(?:html|js|css|json|txt|md|xml|svg)$/i.test(path) && blob.size <= 32 * 1024 * 1024 && typeof CompressionStream === 'function') {
                let compressor;
                try { compressor = new CompressionStream('deflate-raw'); } catch (_) {}
                if (compressor) {
                    const compressed = await new Response(blob.stream().pipeThrough(compressor)).blob();
                    if (compressed.size < blob.size) { payload = compressed; method = 8; }
                }
            }
            const localOffset = offset;
            const large = blob.size >= UINT32_MAX || payload.size >= UINT32_MAX;
            const extra = zip64Extra(large ? [blob.size, payload.size] : []);
            const header = record(30, 0x04034b50);
            header.view.setUint16(4, large ? 45 : 20, true);
            header.view.setUint16(6, 0x0800, true);
            header.view.setUint16(8, method, true);
            header.view.setUint16(10, time, true);
            header.view.setUint16(12, date, true);
            header.view.setUint32(14, crc, true);
            header.view.setUint32(18, large ? UINT32_MAX : payload.size, true);
            header.view.setUint32(22, large ? UINT32_MAX : blob.size, true);
            header.view.setUint16(26, name.length, true);
            header.view.setUint16(28, extra.length, true);
            await append(header.bytes);
            await append(name);
            await append(extra);
            await append(payload);

            const largeOffset = localOffset >= UINT32_MAX;
            const centralExtra = zip64Extra([...(large ? [blob.size, payload.size] : []), ...(largeOffset ? [localOffset] : [])]);
            const directory = record(46, 0x02014b50);
            directory.view.setUint16(4, 45, true);
            directory.view.setUint16(6, large || largeOffset ? 45 : 20, true);
            directory.view.setUint16(8, 0x0800, true);
            directory.view.setUint16(10, method, true);
            directory.view.setUint16(12, time, true);
            directory.view.setUint16(14, date, true);
            directory.view.setUint32(16, crc, true);
            directory.view.setUint32(20, large ? UINT32_MAX : payload.size, true);
            directory.view.setUint32(24, large ? UINT32_MAX : blob.size, true);
            directory.view.setUint16(28, name.length, true);
            directory.view.setUint16(30, centralExtra.length, true);
            directory.view.setUint32(42, largeOffset ? UINT32_MAX : localOffset, true);
            central.push(directory.bytes, name, centralExtra);
        }
        const centralOffset = offset;
        for (const part of central) await append(part);
        const centralSize = offset - centralOffset;
        if (files.length >= 0xffff || centralOffset >= UINT32_MAX || centralSize >= UINT32_MAX) {
            const zip64Offset = offset;
            const end64 = record(56, 0x06064b50);
            end64.view.setBigUint64(4, 44n, true);
            end64.view.setUint16(12, 45, true);
            end64.view.setUint16(14, 45, true);
            end64.view.setBigUint64(24, BigInt(files.length), true);
            end64.view.setBigUint64(32, BigInt(files.length), true);
            end64.view.setBigUint64(40, BigInt(centralSize), true);
            end64.view.setBigUint64(48, BigInt(centralOffset), true);
            await append(end64.bytes);
            const locator = record(20, 0x07064b50);
            locator.view.setBigUint64(8, BigInt(zip64Offset), true);
            locator.view.setUint32(16, 1, true);
            await append(locator.bytes);
        }
        const end = record(22, 0x06054b50);
        end.view.setUint16(8, Math.min(files.length, 0xffff), true);
        end.view.setUint16(10, Math.min(files.length, 0xffff), true);
        end.view.setUint32(12, Math.min(centralSize, UINT32_MAX), true);
        end.view.setUint32(16, Math.min(centralOffset, UINT32_MAX), true);
        await append(end.bytes);
        onProgress(files.length, files.length, '打包完成');
    }

    window.SoraDeploymentZip = { write };
})();
