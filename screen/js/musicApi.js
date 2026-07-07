window.musicApi = window.musicApi || {};

const servers = {
    invidious: "https://yt.omada.cafe",
    youtube: "https://www.youtube.com",
    ytmusic: "https://music.youtube.com",
    wsrv: "https://wsrv.nl",
    lyrics: "https://lyrics.lewdhutao.my.eu.org",
};

const retries = 8;
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
    lyrics: {},
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

function fetchData(url, data) {
    return enqueueRequest(async () => {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const options = {
                    method: data ? "POST" : "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                };
                if (data) {
                    options.body = JSON.stringify(data);
                }
                const response = await fetch(url, options);
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
    const videoId = data.thumbnail_url.match(/\/vi\/([^/]+)\//)[1];
    return {
        id: videoId,
        name: data.title,
        artist: data.author_name.replace(" - Topic", ""),
        // pic: `${servers.ytimage}/vi/${videoId}/maxresdefault.jpg`,
        pic: `${servers.wsrv}/?url=i.ytimg.com/vi/${videoId}/maxresdefault.jpg&w=720&h=720&fit=cover`,
    };
}

// 解析歌词
function parseLyrics(lyricData) {
    return lyricData.split("\n").map((line) => {
        return {
            text: line,
            time: null,
        };
    });
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
            // const data = await fetchData(`${servers.virome}/api/songs/${id}`);
            // if (!data.success) return null;
            // const song_info = parseSong({ ...data.song, ...data });
            const data = await fetchData(`${servers.youtube}/oembed?url=https://music.youtube.com/watch?v=${id}`);
            const song_info = parseSong(data);
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
    // const data = await fetchData(`${servers.pipied}/search?q=${encodeURIComponent(text)}&filter=music_songs`);
    // const data = await fetchData(`${servers.virome}/api/search?filter=songs&q=${encodeURIComponent(text)}`);
    const data = await fetchData(`${servers.ytmusic}/youtubei/v1/search`, {
        context: {
            client: {
                hl: "en",
                gl: "US",
                clientName: "WEB_REMIX",
                clientVersion: "1.20260630.02.00",
                platform: "DESKTOP",
                utcOffsetMinutes: 0,
            },
        },
        query: text,
        params: "EgWKAQIIAWoSEAQQAxAJEAUQEBAKEBUQERAO",
    });
    return data.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicShelfRenderer.contents.map((song) => song.musicResponsiveListItemRenderer.playlistItemData.videoId);
};

function isValidAudio(data, mimeType) {
    if (!mimeType || !mimeType.startsWith("audio/")) {
        console.warn("Invalid MIME type:", mimeType);
        return false;
    }
    const view = new Uint8Array(data);
    if ((view.length >= 3 && view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) || (view[0] === 0xff && (view[1] & 0xe0) === 0xe0)) {
        return true;
    }
    if (view.length >= 8 && view[4] === 0x66 && view[5] === 0x74 && view[6] === 0x79 && view[7] === 0x70) {
        return true;
    }
    if (view.length >= 4 && view[0] === 0x1a && view[1] === 0x45 && view[2] === 0xdf && view[3] === 0xa3) {
        return true;
    }
    if (view.length >= 4 && view[0] === 0x4f && view[1] === 0x67 && view[2] === 0x67 && view[3] === 0x53) {
        return true;
    }
    console.warn("Unknown audio format, but MIME type is audio/*, accepting.");
    return true;
}

// 下载音频文件
async function fetchAudio(url) {
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
                const data = new Uint8Array(arrayBuffer);
                if (!isValidAudio(data, contentType)) {
                    throw new Error("Invalid audio data");
                }
                return {
                    data: data,
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
            const data = await fetchData(`${servers.lyrics}/v2/youtube/lyrics?trackId=${id}`);
            let lyricData;
            if (data.data.lyrics) {
                lyricData = {
                    id,
                    lyrics: parseLyrics(data.data.lyrics),
                };
            } else {
                lyricData = {
                    id,
                    lyrics: [],
                };
            }
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
