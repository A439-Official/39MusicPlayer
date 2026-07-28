function parseIdData(data) {
    const parts = data.split("|");
    return {
        source: parts.length > 1 ? parts[0] : "default",
        id: parts.length > 1 ? parts[1] : parts[0],
    };
}

function buildIdData(sources, id) {
    return `${sources}|${id}`;
}

window.musicApi = window.musicApi || {};

const pendingPromises = {
    songs: {},
    audio: {},
    lyrics: {},
};

function bufferToJson(buffer) {
    if (!buffer) return null;
    try {
        const text = new TextDecoder().decode(buffer);
        return JSON.parse(text);
    } catch (error) {
        console.error("Failed to parse cache data:", error);
        return null;
    }
}

function jsonToBuffer(obj) {
    try {
        const text = JSON.stringify(obj);
        return new TextEncoder().encode(text);
    } catch (error) {
        console.error("Failed to serialize cache data:", error);
        return null;
    }
}

let currentSource = "default";
let sourceList = [];

async function callScriptWithSource(sourceId, action, params) {
    const result = await window.electronAPI.scriptRun(sourceId, { action, params });
    return result;
}

async function callScript(action, params) {
    return await callScriptWithSource(currentSource, action, params);
}

window.musicApi.setSource = (sourceId) => {
    currentSource = sourceId;
};

window.musicApi.getCurrentSource = () => {
    return currentSource;
};

window.musicApi.getSources = async () => {
    try {
        const sources = await window.electronAPI.scriptList();
        sourceList = sources || [];
        return sourceList;
    } catch (e) {
        console.error("Failed to get sources list:", e);
        return [];
    }
};

window.musicApi.search = async (text) => {
    const sources = await window.musicApi.getSources();
    if (!sources.length) {
        console.warn("No sources available");
        return [];
    }

    const sourceIds = sources.map((s) => s.id);
    const preferredIndex = sourceIds.indexOf(currentSource);
    const searchOrder = [];
    if (preferredIndex >= 0) {
        searchOrder.push(currentSource);
        sourceIds.forEach((id) => {
            if (id !== currentSource) searchOrder.push(id);
        });
    } else {
        searchOrder.push(...sourceIds);
    }

    let lastError = null;
    for (const sourceId of searchOrder) {
        try {
            console.log(`Searching with source: ${sourceId}`);
            const result = await callScriptWithSource(sourceId, "search", { text });
            if (result && result.length > 0) {
                console.log(`Found results with source: ${sourceId}`);
                return result.map(function (rawId) {
                    return buildIdData(sourceId, rawId);
                });
            }
            console.log(`No results from source: ${sourceId}`);
        } catch (e) {
            lastError = e;
            console.warn(`Search failed with source ${sourceId}:`, e);
        }
    }

    if (lastError) {
        console.error("All sources failed to search:", lastError);
    }
    return [];
};

window.musicApi.getInfo = async (id) => {
    const { source: sourceId, id: realId } = parseIdData(id);
    const buffer = await electronAPI.getCache(`${id}_info`);
    if (buffer) {
        const song_info = bufferToJson(buffer);
        if (song_info) return song_info;
    }
    if (pendingPromises.songs[id]) {
        return pendingPromises.songs[id];
    }
    const promise = (async () => {
        try {
            const song_info = await callScriptWithSource(sourceId, "getInfo", { id: realId });
            const cacheBuffer = jsonToBuffer(song_info);
            if (cacheBuffer) {
                await electronAPI.saveCache(`${id}_info`, cacheBuffer);
            }
            return song_info;
        } finally {
            delete pendingPromises.songs[id];
        }
    })();
    pendingPromises.songs[id] = promise;
    return promise;
};

async function fetchAudio(url) {
    let lastError;
    for (let i = 0; i < 8; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get("content-type") || "audio/mpeg";
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            return {
                data: data,
                mimeType: contentType,
            };
        } catch (error) {
            lastError = error;
            console.warn(`Audio download attempt ${i + 1} failed. Retrying...`);
            if (i === 7) {
                console.error("All audio download retries failed. Last error:", error);
                return null;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return null;
}

async function downloadAndCacheAudio(id, audioUrl) {
    const cacheKey = `${id}_audio`;
    if (pendingPromises.audio[id]) return;
    pendingPromises.audio[id] = true;

    try {
        const audioResult = await fetchAudio(audioUrl);
        if (audioResult?.data) {
            await electronAPI.saveCache(cacheKey, audioResult.data);
            const mimeTypeBuffer = new TextEncoder().encode(audioResult.mimeType);
            await electronAPI.saveCache(`${cacheKey}_mime`, mimeTypeBuffer);
        }
    } catch (error) {
    } finally {
        delete pendingPromises.audio[id];
    }
}

window.musicApi.getUrl = async (id) => {
    const { source: sourceId, id: realId } = parseIdData(id);
    const cacheKey = `${id}_audio`;

    const audioBuffer = await electronAPI.getCache(cacheKey);
    if (audioBuffer) {
        const mimeTypeBuffer = await electronAPI.getCache(`${cacheKey}_mime`);
        const mimeType = mimeTypeBuffer ? new TextDecoder().decode(mimeTypeBuffer) : "audio/mpeg";
        const blobUrl = createBlobUrl(audioBuffer, mimeType);
        if (blobUrlCache.has(id)) {
            revokeBlobUrl(blobUrlCache.get(id));
        }
        blobUrlCache.set(id, blobUrl);
        return { id, url: blobUrl, fromCache: true };
    }

    const result = await callScriptWithSource(sourceId, "getUrl", { id: realId });
    if (!result) return null;

    downloadAndCacheAudio(id, result);

    return { id, url: result, fromCache: false };
};

const blobUrlCache = new Map();

function createBlobUrl(audioData, mimeType) {
    const blob = new Blob([audioData], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    return blobUrl;
}

function revokeBlobUrl(blobUrl) {
    if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
    }
}

window.musicApi.revokeBlobUrl = (id) => {
    if (blobUrlCache.has(id)) {
        revokeBlobUrl(blobUrlCache.get(id));
        blobUrlCache.delete(id);
    }
};

window.musicApi.revokeAllBlobUrls = () => {
    for (const blobUrl of blobUrlCache.values()) {
        revokeBlobUrl(blobUrl);
    }
    blobUrlCache.clear();
};

if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
        if (window.musicApi && window.musicApi.revokeAllBlobUrls) {
            window.musicApi.revokeAllBlobUrls();
        }
    });
    window.addEventListener("pagehide", () => {
        if (window.musicApi && window.musicApi.revokeAllBlobUrls) {
            window.musicApi.revokeAllBlobUrls();
        }
    });
}

window.musicApi.getLyric = async (id) => {
    const { source: sourceId, id: realId } = parseIdData(id);
    const buffer = await electronAPI.getCache(`${id}_lyric`);
    if (buffer) {
        const lyricData = bufferToJson(buffer);
        if (lyricData) return lyricData;
    }
    if (pendingPromises.lyrics[id]) {
        return pendingPromises.lyrics[id];
    }
    const promise = (async () => {
        try {
            const lyricData = await callScriptWithSource(sourceId, "getLyric", { id: realId });
            const cacheBuffer = jsonToBuffer(lyricData);
            if (cacheBuffer) {
                await electronAPI.saveCache(`${id}_lyric`, cacheBuffer);
            }
            return lyricData;
        } finally {
            delete pendingPromises.lyrics[id];
        }
    })();
    pendingPromises.lyrics[id] = promise;
    return promise;
};
