window.musicApi = window.musicApi || {};

const servers = {
    virome: "https://verome-api.deno.dev",
    invidious: "https://yt.omada.cafe",
    pipied: "https://api.piped.private.coffee",
};

const MAX = 5;
let active = 0;
const queue = [];

const runNext = () => {
    if (active >= MAX || !queue.length) return;

    const { fn, resolve, reject } = queue.shift();
    active++;

    Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
            active--;
            runNext();
        });
};

const pendingPromises = {
    songs: {},
    audio: {},
};

function enqueueRequest(fn) {
    return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        runNext();
    });
}

async function rfUrl(url) {
    const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
    });
    return res.url;
}

function fetchData(url, retries = 3) {
    return enqueueRequest(async () => {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const result = await response.json();
                return result;
            } catch (error) {
                lastError = error;
                console.warn(`Fetch attempt ${i + 1} failed. Retrying...`);
                if (i === retries - 1) {
                    console.error("All fetch retries failed. Last error:", error);
                    return null;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        console.error("Unexpected error in fetch retry logic", lastError);
        return null;
    });
}

// 解析歌曲信息
function parseSong(data) {
    return {
        id: data.videoId || data.url.split("=")[1],
        name: data.title,
        artist: data.artist?.name || data.artists?.map((artist) => artist.name).join(" & ") || data.uploaderName,
        pic: data.thumbnail.split("=")[0] || data.thumbnails[0].url.split("?")[0],
    };
}

// 解析歌词
function parseLyrics(lyricData) {
    return (
        lyricData?.lyric
            ?.split("\n")
            .filter(function (line) {
                return line.trim();
            })
            .map(function (line) {
                const match = line.match(/^\[(\d+):(\d+\.\d+)\](.*)/);
                return match
                    ? {
                          time: parseInt(match[1], 10) * 60 + parseFloat(match[2]),
                          text: match[3].trim(),
                      }
                    : null;
            })
            .filter(Boolean) || []
    );
}

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

// 歌曲信息
window.musicApi.getSongInfo = async (id) => {
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
            const data = await fetchData(`${servers.virome}/api/songs/${id}`);
            if (!data.success) return null;
            const song_info = parseSong({ ...data.song, ...data });
            const buffer = jsonToBuffer(song_info);
            if (buffer) {
                await electronAPI.saveCache(`${id}_info`, buffer);
            }
            return song_info;
        } finally {
            delete pendingPromises.songs[id];
        }
    })();
    pendingPromises.songs[id] = promise;
    return promise;
};

// 搜索歌曲
window.musicApi.search = async (text) => {
    const data = await fetchData(`${servers.pipied}/search?q=${encodeURIComponent(text)}&filter=music_songs`);
    // const data = await fetchData(`${servers.virome}/api/search?filter=songs&q=${encodeURIComponent(text)}`);
    const songs = data.items;
    return songs.map((song) => parseSong(song));
};

// 下载音频文件
async function fetchAudio(url, retries = 3) {
    return enqueueRequest(async () => {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const contentType = response.headers.get("content-type") || "audio/mpeg";
                const arrayBuffer = await response.arrayBuffer();
                return {
                    data: new Uint8Array(arrayBuffer),
                    mimeType: contentType,
                };
            } catch (error) {
                lastError = error;
                console.warn(`Audio download attempt ${i + 1} failed. Retrying...`);
                if (i === retries - 1) {
                    console.error("All audio download retries failed. Last error:", error);
                    return null;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        console.error("Unexpected error in audio download retry logic", lastError);
        return null;
    });
}

// blobURL管理
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

// 获取歌曲URL
window.musicApi.getSongUrl = async (id) => {
    const cacheKey = `${id}_audio`;

    // 检查缓存
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

    // 获取歌曲信息
    const buffer = await electronAPI.getCache(`${id}_info`);
    let song_info = buffer ? bufferToJson(buffer) : null;
    const info = song_info || (await window.musicApi.getSongInfo(id));
    if (!info) return null;

    // // 获取音频URL
    // const mainData = await fetchData(`${servers.virome}/api/stream?id=${id}`);
    // const audioUrl = mainData.streamingUrls[mainData.streamingUrls.length - 1].directUrl;

    let audioUrl = await rfUrl(`${servers.invidious}/companion/latest_version?id=${id}&itag=140`);

    if (!audioUrl) {
        return null;
    }

    const audioUrlData = new URL(audioUrl);

    audioUrlData.searchParams.set("host", encodeURIComponent(audioUrlData.host));

    audioUrl = `${servers.invidious}/companion/videoplayback${audioUrlData.search}`;

    downloadAndCacheAudio(id, audioUrl);
    return { id, url: audioUrl, fromCache: false };
};

// 清理blobURL
window.musicApi.revokeBlobUrl = (id) => {
    if (blobUrlCache.has(id)) {
        revokeBlobUrl(blobUrlCache.get(id));
        blobUrlCache.delete(id);
    }
};

// 清理所有blobURL
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

// 获取歌词
window.musicApi.getLyric = async (id) => {
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
            const data = await fetchData(`${servers.virome}/lyric?id=${id}`);
            if (!data) return null;
            const lyricData = {
                id,
                lyrics: parseLyrics(data.lrc),
                tlyrics: parseLyrics(data.tlyric),
            };
            const buffer = jsonToBuffer(lyricData);
            if (buffer) {
                await electronAPI.saveCache(`${id}_lyric`, buffer);
            }
            return lyricData;
        } finally {
            delete pendingPromises.lyrics[id];
        }
    })();
    pendingPromises.lyrics[id] = promise;
    return promise;
};
