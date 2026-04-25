window.musicApi = window.musicApi || {};

const rootUrl = "https://ncm.zhenxin.me";
const backupApi = "https://103.36.90.170/api/netease/music_v1.php";

const pendingPromises = {
    songs: {},
    lyrics: {},
    mvs: {},
    audio: {},
};

// 并发控制
const MAX_CONCURRENT_REQUESTS = 5;
let activeRequests = 0;
const requestQueue = [];

function processQueue() {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
        return;
    }

    const { requestFn, resolve, reject } = requestQueue.shift();
    activeRequests++;

    requestFn()
        .then((result) => {
            activeRequests--;
            resolve(result);
            setTimeout(processQueue, 0);
        })
        .catch((error) => {
            activeRequests--;
            reject(error);
            setTimeout(processQueue, 0);
        });
}

// 将请求加入队列
function enqueueRequest(requestFn) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ requestFn, resolve, reject });
        setTimeout(processQueue, 0);
    });
}

const fetchJson = async (url, retries = 5) => {
    return enqueueRequest(async () => {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.code !== 200) {
                    throw new Error(`API error: ${data.code}`);
                }
                return data;
            } catch (error) {
                lastError = error;
                // console.warn(`Attempt ${i + 1} failed. Retrying...`);
                if (i === retries - 1) {
                    // console.error("All retries failed. Last error:", error);
                    return null;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        console.error("Unexpected error in retry logic", lastError);
        return null;
    });
};

// 解析歌曲信息
const parseSong = (song, privilege) => ({
    id: song.id.toString(),
    name: song.name,
    artist: song.ar?.map((a) => a.name) || [],
    album: song.al?.name || "",
    pic: song.al?.picUrl || "",
    mv: song.mv,
    fee: song.fee || 0,
});

// 解析歌词
const parseLyrics = (lyricData) => {
    const lyric = lyricData?.lyric;
    if (!lyric) return [];
    return lyric
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
            line = line.trim();
            // lrc
            const lrcMatch = line.match(/^\[(\d+):(\d+\.\d+)\](.*)/);
            if (lrcMatch) {
                return {
                    time: parseInt(lrcMatch[1]) * 60 + parseFloat(lrcMatch[2]),
                    text: lrcMatch[3].trim(),
                };
            }
            // yrc
            const yrcLineMatch = line.match(/^\[(\d+),(\d+)\]/);
            if (yrcLineMatch) {
                const lineStart = parseInt(yrcLineMatch[1]);
                const lineDuration = parseInt(yrcLineMatch[2]);
                const rest = line.slice(yrcLineMatch[0].length);
                const wordRegex = /\((\d+),(\d+),\d+\)([^\(\)]+)/g;
                const words = [];
                let fullText = "";
                let match;
                while ((match = wordRegex.exec(rest)) !== null) {
                    const start = parseInt(match[1]);
                    const duration = parseInt(match[2]);
                    const text = match[3];
                    words.push({ text, start, duration });
                    fullText += text;
                }
                if (words.length === 0) {
                    return null;
                }
                return {
                    time: lineStart / 1000,
                    text: fullText,
                    words: words.map((w) => ({ text: w.text, start: w.start / 1000, duration: w.duration / 1000 })),
                };
            }
            if (line.startsWith("{")) {
                return null;
            }
            return null;
        })
        .filter(Boolean);
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
            const data = await fetchJson(`${rootUrl}/song/detail?ids=${id}`);
            if (!data?.songs[0]) return null;
            const song_info = parseSong(data.songs[0]);
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
window.musicApi.search = async (text, limit = 30, page = 0) => {
    const data = await fetchJson(`${rootUrl}/cloudsearch?limit=${limit}&offset=${page * limit}&keywords=${encodeURIComponent(text)}`);
    const songs = data?.result?.songs || [];
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

    // 获取音频URL
    let audioUrl = info.url;
    if (!audioUrl) {
        const mainData = await fetchJson(`${rootUrl}/song/url?level=lossless&id=${id}`);
        const urlData = mainData?.data?.[0];
        if (info.fee > 0) {
            const backupData = await fetchJson(`${backupApi}?id=${id}&type=json&level=lossless`);
            if (backupData?.data?.url) {
                audioUrl = backupData.data.url;
            }
        }
        audioUrl = audioUrl || urlData?.url;
        if (!audioUrl) return null;
        info.url = audioUrl;
        const infoBuffer = jsonToBuffer(info);
        if (infoBuffer) {
            await electronAPI.saveCache(`${id}_info`, infoBuffer);
        }
    }
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
            const data = await fetchJson(`${rootUrl}/lyric/new?id=${id}`);
            if (!data) return null;
            const lyricData = {
                id,
                lyrics: parseLyrics(data.lrc),
                tlyrics: parseLyrics(data.tlyric),
                wlyrics: parseLyrics(data.yrc),
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

// 获取MV
window.musicApi.getMv = async (id) => {
    const buffer = await electronAPI.getCache(`${id}_mv`);
    if (buffer) {
        const mvData = bufferToJson(buffer);
        if (mvData) return mvData;
    }
    if (pendingPromises.mvs[id]) {
        return pendingPromises.mvs[id];
    }
    const promise = (async () => {
        try {
            const data = await fetchJson(`${rootUrl}/mv/url?id=${id}`);
            if (!data?.data?.url) return null;
            const [minutes, seconds] = data.data.duration.split(":").map(Number);
            const mvData = {
                id,
                url: data.data.url,
                size: data.data.size,
                duration: (minutes * 60 + seconds) * 1000,
            };
            const buffer = jsonToBuffer(mvData);
            if (buffer) {
                await electronAPI.saveCache(`${id}_mv`, buffer);
            }
            return mvData;
        } finally {
            delete pendingPromises.mvs[id];
        }
    })();
    pendingPromises.mvs[id] = promise;
    return promise;
};
