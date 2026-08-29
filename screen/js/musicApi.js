window.musicApi = window.musicApi || {};

let currentSource = "";
const pending = {};
const pendingAudioCache = {};
const blobUrls = new Map();
const resolvedIds = new Map();

function parseId(data) {
    const [source = "", id] = data.includes("|") ? data.split("|") : ["", data];

    return { source, id };
}

function makeId(source, id) {
    return `${source}|${id}`;
}

function jsonBuffer(data) {
    try {
        return new TextEncoder().encode(JSON.stringify(data));
    } catch {
        return null;
    }
}

function bufferJson(buffer) {
    try {
        return buffer && JSON.parse(new TextDecoder().decode(buffer));
    } catch {
        return null;
    }
}

async function run(source, action, params) {
    if (!source) return null;
    return window.electronAPI.scriptRun(source, {
        action,
        params,
    });
}

async function cacheGet(key) {
    return bufferJson(await electronAPI.getCache(key));
}

async function cacheSet(key, data) {
    const buffer = jsonBuffer(data);
    if (buffer) await electronAPI.saveCache(key, buffer);
}

async function resolveId(id) {
    const { source } = parseId(id);
    if (source) return id;

    if (resolvedIds.has(id)) return resolvedIds.get(id);

    const sources = await window.musicApi.getSources();
    for (const s of sources) {
        try {
            const result = await run(s.id, "getInfo", { id });
            if (result && result.name) {
                const resolved = makeId(s.id, id);
                resolvedIds.set(id, resolved);
                return resolved;
            }
        } catch {}
    }

    resolvedIds.set(id, id);
    return id;
}

async function cachedRequest(type, id, action) {
    const resolvedId = await resolveId(id);
    const key = `${resolvedId}_${type}.json`;

    const cache = await cacheGet(key);
    if (cache) return cache;

    if (pending[key]) return pending[key];

    pending[key] = (async () => {
        try {
            const { source, id: realId } = parseId(resolvedId);

            const result = await run(source, action, {
                id: realId,
            });

            await cacheSet(key, result);

            return result;
        } finally {
            delete pending[key];
        }
    })();

    return pending[key];
}

window.musicApi.setSource = (source) => {
    currentSource = source;
};

window.musicApi.getCurrentSource = () => currentSource;

window.musicApi.getSources = async () => {
    try {
        return (await window.electronAPI.scriptList()) || [];
    } catch {
        return [];
    }
};

window.musicApi.search = async (text) => {
    const sources = await window.musicApi.getSources();

    const ids = sources.map((x) => x.id);

    const order = [currentSource, ...ids.filter((x) => x !== currentSource)];

    for (const source of order) {
        try {
            const result = await run(source, "search", { text });

            if (result?.length) {
                return result.map((id) => makeId(source, id));
            }
        } catch {}
    }

    return [];
};

window.musicApi.getInfo = async (id) => {
    const info = await cachedRequest("info", id, "getInfo");
    if (!info || !info.pic) return info;

    const resolvedId = await resolveId(id);
    const coverKey = `${resolvedId}_cover.png`;

    const cache = await electronAPI.getCache(coverKey);
    if (cache) {
        const url = URL.createObjectURL(new Blob([cache], { type: "image/png" }));
        blobUrls.set(`${resolvedId}_cover`, url);
        info.pic = url;
        return info;
    }

    // 后台缓存封面
    const picUrl = info.pic;
    (async () => {
        const data = await fetchImage(picUrl);
        if (data) {
            await electronAPI.saveCache(coverKey, data);
        }
    })();

    return info;
};

window.musicApi.getLyric = (id) => cachedRequest("lyric", id, "getLyric");

async function fetchAudio(url) {
    for (let i = 0; i < 8; i++) {
        try {
            const res = await fetch(url, {
                headers: {
                    Range: "bytes=0-",
                },
            });
            if (!res.ok) throw Error(res.status);

            const contentType = res.headers.get("content-type");
            if (!contentType?.startsWith("audio/")) {
                throw new Error("非音频 MIME");
            }

            const arrayBuffer = await res.arrayBuffer();

            return {
                data: new Uint8Array(arrayBuffer),
                mime: contentType,
            };
        } catch (e) {
            console.error("音频下载失败:", e);
            if (i === 7) return null;
            await new Promise((r) => setTimeout(r, (i + 1) * 1000));
        }
    }
}

async function fetchImage(url) {
    for (let i = 0; i < 8; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw Error(res.status);

            const arrayBuffer = await res.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        } catch (e) {
            console.error("图片下载失败:", e);
            if (i === 7) return null;
            await new Promise((r) => setTimeout(r, (i + 1) * 1000));
        }
    }
}

window.musicApi.getUrl = async (id) => {
    const resolvedId = await resolveId(id);
    const audioKey = `${resolvedId}.mp3`;

    const cache = await electronAPI.getCache(audioKey);

    if (cache) {
        const url = URL.createObjectURL(new Blob([cache], { type: "audio/mpeg" }));

        blobUrls.set(resolvedId, url);

        return {
            id: resolvedId,
            url,
            fromCache: true,
        };
    }

    const { source, id: realId } = parseId(resolvedId);

    const url = await run(source, "getUrl", { id: realId });

    if (!url) return null;

    // 后台缓存
    if (pendingAudioCache[audioKey]) {
        return {
            id: resolvedId,
            url,
            fromCache: false,
        };
    }
    pendingAudioCache[audioKey] = (async () => {
        console.log("开始缓存:", id);
        const audio = await fetchAudio(url);
        console.log("缓存完成:", id);

        if (audio) {
            await electronAPI.saveCache(audioKey, audio.data);
        } else {
            console.log("缓存失败:", id);
        }
        delete pendingAudioCache[audioKey];
    })();

    return {
        id: resolvedId,
        url,
        fromCache: false,
    };
};

window.musicApi.deleteAudioCache = async (id) => {
    const resolvedId = await resolveId(id);
    const audioKey = `${resolvedId}.mp3`;
    const coverKey = `${resolvedId}_cover.png`;

    window.musicApi.revokeBlobUrl(resolvedId);
    window.musicApi.revokeBlobUrl(`${resolvedId}_cover`);

    await electronAPI.deleteCache(audioKey);
    await electronAPI.deleteCache(coverKey);
};

window.musicApi.revokeBlobUrl = (id) => {
    const url = blobUrls.get(id);

    if (url) {
        URL.revokeObjectURL(url);
        blobUrls.delete(id);
    }
};

window.musicApi.revokeAllBlobUrls = () => {
    for (const url of blobUrls.values()) URL.revokeObjectURL(url);

    blobUrls.clear();
};

window.addEventListener("beforeunload", () => window.musicApi.revokeAllBlobUrls());
