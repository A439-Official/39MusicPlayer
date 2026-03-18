window.musicApi = window.musicApi || {};

const rootUrl = "https://ncm.zhenxin.me";
const backupApi = "https://api.cenguigui.cn/api/netease/music_v1.php";

const pendingPromises = {
    songs: {},
    lyrics: {},
    mvs: {},
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
const parseLyrics = (lyricData) =>
    lyricData?.lyric
        ?.split("\n")
        .filter((line) => line.trim())
        .map((line) => {
            const match = line.match(/^\[(\d+):(\d+\.\d+)\](.*)/);
            return match ? { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() } : null;
        })
        .filter(Boolean) || [];

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

// 获取歌曲URL
window.musicApi.getSongUrl = async (id) => {
    const buffer = await electronAPI.getCache(`${id}_info`);
    let song_info = buffer ? bufferToJson(buffer) : null;
    const info = song_info || (await window.musicApi.getSongInfo(id));
    if (!info) return null;
    if (info.url) return { id, url: info.url };
    const mainData = await fetchJson(`${rootUrl}/song/url?level=lossless&id=${id}`);
    const urlData = mainData?.data?.[0];
    if (info.fee > 0) {
        const backupData = await fetchJson(`${backupApi}?id=${id}&type=json&level=lossless`);
        if (backupData?.data?.url) {
            info.url = backupData.data.url;
            return { id, url: info.url, fromBackup: true };
        }
    }
    if (!urlData?.url) return null;
    info.url = urlData.url;
    return { id, url: info.url };
};

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
            const data = await fetchJson(`${rootUrl}/lyric?id=${id}`);
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
