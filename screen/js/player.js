let currentAudio = new Audio();
let currentSongId = null;
let currentBlobUrl = null;
let updateInterval = null;
let seekBar = null;
let currentTimeEl = null;
let totalTimeEl = null;
let loadedMetadataHandler = null;
let errorHandler = null;
let endedHandler = null;
let playbackErrorHandler = null;
let currentLyrics = [];
let currentLyricIndex = -1;
let lyricsContainer = null;
let lyricsLines = null;
let currentAudioDuration = 0;

function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
        window.togglePause(document.getElementById("pause-btn"));
    });

    navigator.mediaSession.setActionHandler("pause", () => {
        window.togglePause(document.getElementById("pause-btn"));
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
        if (window.playPrev) {
            window.playPrev();
        }
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (window.playNext) {
            window.playNext();
        }
    });

    navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) {
            currentAudio.currentTime = details.seekTime;
        }
    });
}

function cleanupCurrentBlobUrl() {
    if (currentBlobUrl && currentBlobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(currentBlobUrl);
        if (window.musicApi && window.musicApi.revokeBlobUrl && currentSongId) {
            window.musicApi.revokeBlobUrl(currentSongId);
        }
        currentBlobUrl = null;
    }
}

async function playSong(songId, play = true) {
    console.log("播放歌曲", songId);
    cleanupCurrentBlobUrl();
    currentSongId = songId;

    if (loadedMetadataHandler) {
        currentAudio.removeEventListener("loadedmetadata", loadedMetadataHandler);
        loadedMetadataHandler = null;
    }
    if (errorHandler) {
        currentAudio.removeEventListener("error", errorHandler);
        errorHandler = null;
    }
    currentAudio.removeEventListener("timeupdate", updateSeekBar);
    if (endedHandler) {
        currentAudio.removeEventListener("ended", endedHandler);
        endedHandler = null;
    }
    if (playbackErrorHandler) {
        currentAudio.removeEventListener("error", playbackErrorHandler);
        playbackErrorHandler = null;
    }

    currentAudio.pause();
    currentAudio.src = "";
    currentAudio.load();
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }

    let songData = null;
    for (let retry = 0; retry < 3; retry++) {
        songData = await window.musicApi.getUrl(songId);
        if (songData?.url) break;
        if (retry < 2) {
            console.warn(`获取歌曲 URL 失败，正在重试 (${retry + 1}/3):`, songId);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    if (currentSongId !== songId || !songData?.url) {
        if (!songData?.url) {
            console.error("获取歌曲 URL 失败:", songData);
        }
        return;
    }

    const songInfo = await window.musicApi.getInfo(songId);
    if (currentSongId === songId) {
        const titleEl = document.getElementsByClassName("data-title");
        for (const el of titleEl) {
            el.textContent = songInfo?.name || songId;
        }
        const artistText = songInfo?.artist ? (Array.isArray(songInfo.artist) ? songInfo.artist.join(" & ") : songInfo.artist) : "";
        const artistEl = document.getElementsByClassName("data-artist");
        for (const el of artistEl) {
            el.textContent = artistText;
        }
        const coverEl = document.getElementsByClassName("data-cover");
        for (const el of coverEl) {
            el.style.backgroundImage = songInfo?.pic ? `url("${songInfo.pic}")` : "";
        }

        if ("mediaSession" in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: songInfo?.name || "",
                artist: Array.isArray(songInfo?.artist) ? songInfo.artist.join(" & ") : songInfo?.artist || "",
                album: songInfo?.album || "",
                artwork: [
                    {
                        src: songInfo?.pic || "",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            });
        }
    }

    try {
        await addSongToPlaylist(songId, "History");
    } catch (error) {
        console.error("添加歌曲到播放历史失败:", error);
    }

    currentAudio.src = songData.url;
    if (songData.url && songData.url.startsWith("blob:")) {
        currentBlobUrl = songData.url;
    }

    currentAudio.load();
    setupSeekBar();

    let metadataLoaded = false;
    for (let retry = 0; retry < 3; retry++) {
        if (retry > 0) {
            console.warn(`音频元数据加载失败，正在重试 (${retry + 1}/3):`, songId);
            currentAudio.pause();
            currentAudio.src = "";
            currentAudio.load();
            await new Promise(r => setTimeout(r, 1000));
            currentAudio.src = songData.url;
            currentAudio.load();
        }
        try {
            await new Promise((resolve, reject) => {
                loadedMetadataHandler = function onLoadedMetadata() {
                    currentAudio.removeEventListener("loadedmetadata", loadedMetadataHandler);
                    currentAudio.removeEventListener("error", errorHandler);
                    const fixedDuration = Math.floor(currentAudio.duration);
                    if (totalTimeEl) {
                        totalTimeEl.textContent = formatTime(fixedDuration);
                    }
                    currentAudioDuration = fixedDuration;
                    if (seekBar) {
                        seekBar.setValue(0, true);
                    }
                    if (currentTimeEl) {
                        currentTimeEl.textContent = formatTime(0);
                    }
                    loadedMetadataHandler = null;
                    errorHandler = null;
                    resolve();
                };
                errorHandler = function onError(e) {
                    currentAudio.removeEventListener("loadedmetadata", loadedMetadataHandler);
                    currentAudio.removeEventListener("error", errorHandler);
                    loadedMetadataHandler = null;
                    errorHandler = null;
                    console.error("音频元数据加载失败:", e);
                    reject(new Error("加载音频元数据失败"));
                };
                currentAudio.addEventListener("loadedmetadata", loadedMetadataHandler);
                currentAudio.addEventListener("error", errorHandler);
            });
            metadataLoaded = true;
            break;
        } catch (error) {
            console.error("音频元数据加载失败:", error);
            if (currentSongId !== songId) {
                return;
            }
        }
    }
    if (!metadataLoaded) {
        console.error("音频元数据加载失败，已重试 3 次:", songId);
        return;
    }

    loadLyrics(songId);

    if (play) {
        try {
            await currentAudio.play();
            const pauseBtn = document.getElementById("pause-btn");
            if (pauseBtn) {
                pauseBtn.innerHTML = `
                    <rect x="14" y="3" width="5" height="18" rx="1"/>
                    <rect x="5" y="3" width="5" height="18" rx="1"/>
                `;
                pauseBtn.onclick = function () {
                    togglePause(this);
                };
            }
        } catch (error) {
            console.error("播放音频失败:", error);
        }
    }

    try {
        if (window.electronAPI && window.electronAPI.setConfig) {
            await window.electronAPI.setConfig("lastPlayedSongId", songId);
        }
    } catch (error) {
        console.error("保存上次播放歌曲 ID 失败:", error);
    }

    currentAudio.removeEventListener("timeupdate", updateSeekBar);
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    updateInterval = setInterval(updateSeekBar, 10);
    endedHandler = function () {
        console.log("播放下一首");
        clearInterval(updateInterval);
        updateInterval = null;
        if (window.playNext && typeof window.playNext === "function") {
            try {
                window.playNext();
            } catch (err) {
                console.error("播放结束后调用 playNext 出错:", err);
            }
        }
    };
    currentAudio.addEventListener("ended", endedHandler);

    playbackErrorHandler = function onPlaybackError() {
        const audioError = currentAudio.error;
        const errorMsg = audioError ? audioError.message || `MEDIA_ERR_${audioError.code}` : "unknown";
        console.error("音频播放错误:", errorMsg);

        clearInterval(updateInterval);
        updateInterval = null;

        const pauseBtn = document.getElementById("pause-btn");
        if (pauseBtn) {
            pauseBtn.innerHTML = `
                <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
            `;
        }

        if (errorMsg.includes("DECODE") || errorMsg.includes("decode") || audioError?.code === MediaError.MEDIA_ERR_DECODE) {
            console.warn("检测到解码错误，音频缓存可能已损坏，将清除缓存并重新加载:", currentSongId);
            if (currentSongId && window.musicApi && window.musicApi.deleteAudioCache) {
                window.musicApi
                    .deleteAudioCache(currentSongId)
                    .then(() => {
                        if (currentSongId) {
                            playSong(currentSongId, true);
                        }
                    })
                    .catch((err) => {
                        console.error("清除缓存失败:", err);
                    });
            }
        }
    };
    currentAudio.addEventListener("error", playbackErrorHandler);
}

async function loadLastPlayedSong() {
    try {
        if (window.electronAPI && window.electronAPI.getConfig) {
            const lastSongId = await window.electronAPI.getConfig("lastPlayedSongId", null);
            if (lastSongId) {
                await playSong(lastSongId, false);
            } else {
                console.log("没有上次播放的歌曲记录");
            }
        }
    } catch (error) {
        console.error("加载上次播放歌曲失败:", error);
    }
}

function setupSeekBar() {
    if (!seekBar) {
        const seekBarContainer = document.getElementById("seek-bar");
        if (seekBarContainer) {
            seekBar = new CustomProgressBar(seekBarContainer, 0, function (value) {
                if (currentAudio) {
                    const duration = currentAudio.duration || currentAudioDuration;
                    if (duration > 0) {
                        const seekTime = value * duration;
                        currentAudio.currentTime = seekTime;
                        if (currentTimeEl) {
                            currentTimeEl.textContent = formatTime(seekTime);
                        }
                        updateLyricHighlight(seekTime);
                        if (value >= 0.999 && window.playNext && typeof window.playNext === "function") {
                            try {
                                window.playNext();
                            } catch (err) {
                                console.error("调用 playNext 出错:", err);
                            }
                        }
                    }
                }
            });
        }
    }
    if (!currentTimeEl) {
        currentTimeEl = document.getElementById("current-time");
    }
    if (!totalTimeEl) {
        totalTimeEl = document.getElementById("total-time");
    }
}

function updateSeekBar() {
    if (!currentAudio || !seekBar || !currentTimeEl || !totalTimeEl) return;

    const currentTime = currentAudio.currentTime;
    const duration = currentAudio.duration;

    if (isNaN(duration) || duration <= 0) return;

    const progress = currentTime / duration;
    seekBar.setValue(progress, true);

    const displayTime = Math.floor(currentTime);
    currentTimeEl.textContent = formatTime(displayTime);

    if (totalTimeEl.textContent === "00:00") {
        totalTimeEl.textContent = formatTime(Math.floor(duration));
    }

    updateLyricHighlight(currentTime);
}

// MM:SS
function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "00:00";

    const roundedSecs = Math.round(seconds);
    const mins = Math.floor(roundedSecs / 60);
    const secs = roundedSecs % 60;

    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function togglePause(buttonElement) {
    if (!buttonElement) {
        buttonElement = document.getElementById("pause-btn");
        if (!buttonElement) {
            console.error("未找到按钮元素!");
            return;
        }
    }

    if (!currentAudio) {
        console.log("没有音频元素");
        return;
    }

    if (currentAudio.error) {
        console.warn("音频处于错误状态，正在尝试重新加载当前歌曲:", currentAudio.error.message || currentAudio.error.code);
        if (currentSongId) {
            playSong(currentSongId, true);
        }
        return;
    }

    if (!currentAudio.src) {
        console.log("没有音频源可播放/暂停");
        return;
    }

    try {
        if (currentAudio.paused) {
            console.log("播放");
            const playPromise = currentAudio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {})
                    .catch((error) => {
                        console.error("播放音频出错:", error);
                        if (error.name === "NotSupportedError" || error.message.includes("no supported sources") || error.name === "AbortError") {
                            console.warn("音频源可能无效，正在尝试重新加载当前歌曲");
                            if (currentSongId) {
                                playSong(currentSongId, true);
                            }
                        }
                    });
            }
            buttonElement.innerHTML = `
                <rect x="14" y="3" width="5" height="18" rx="1"/>
                <rect x="5" y="3" width="5" height="18" rx="1"/>
            `;
        } else {
            console.log("暂停");
            currentAudio.pause();
            buttonElement.innerHTML = `
                <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
            `;
        }
    } catch (error) {
        console.error("切换暂停状态出错:", error);
    }
}

// 初始化歌词元素引用
function initLyricsElements() {
    if (!lyricsContainer) {
        lyricsContainer = document.getElementById("lyrics-container");
    }
    if (!lyricsLines) {
        lyricsLines = document.getElementById("lyrics-lines");
    }
}

// 加载歌词
async function loadLyrics(songId) {
    initLyricsElements();

    currentLyrics = [];
    currentLyricIndex = -1;
    if (lyricsLines) {
        lyricsLines.innerHTML = "";
    }

    try {
        const lyricData = await window.musicApi.getLyric(songId);
        if (!lyricData) {
            console.log("歌曲没有歌词数据");
            return;
        }
        currentLyrics = lyricData.lyrics;

        // 渲染歌词
        renderLyrics(lyricData.lyrics);
    } catch (error) {
        console.error("加载歌词失败:", error);
    }
}

// 渲染歌词
function renderLyrics(lyrics) {
    if (!lyricsLines) {
        console.warn("歌词容器未找到");
        return;
    }

    lyricsLines.innerHTML = "";

    if (lyrics.length === 0) {
        const emptyLine = document.createElement("div");
        emptyLine.className = "lyric-line";
        emptyLine.textContent = "暂无歌词";
        lyricsLines.appendChild(emptyLine);
        return;
    }

    lyrics.forEach((lyric, index) => {
        const lineEl = document.createElement("div");
        lineEl.className = "lyric-line";
        lineEl.dataset.index = index;
        lineEl.textContent = lyric.text || "";
        lyricsLines.appendChild(lineEl);
    });
}

function updateLyricHighlight(currentTime) {
    if (currentLyrics.length === 0 || !lyricsLines) return;
    let newIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentLyrics[i].time === null) continue;
        if (currentTime >= currentLyrics[i].time) {
            newIndex = i;
        } else {
            break;
        }
    }
    if (newIndex === -1) return;
    if (newIndex === currentLyricIndex) return;
    const oldLine = lyricsLines.querySelector(".lyric-line.active");
    if (oldLine) {
        oldLine.classList.remove("active");
    }
    currentLyricIndex = newIndex;
    if (currentLyricIndex >= 0) {
        const newLine = lyricsLines.querySelector(`.lyric-line[data-index="${currentLyricIndex}"]`);
        if (newLine) {
            newLine.classList.add("active");
            const containerHeight = lyricsLines.clientHeight;
            const lineHeight = newLine.offsetHeight;
            const lineTop = newLine.offsetTop;

            lyricsLines.scrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
        }
    }
}
