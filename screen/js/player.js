let currentAudio = new Audio();
let currentSongId = null;
let currentBlobUrl = null;
let updateInterval = null;
let seekBar = null;
let currentTimeEl = null;
let totalTimeEl = null;
let loadedMetadataHandler = null;
let errorHandler = null;

function cleanupCurrentBlobUrl() {
    if (currentBlobUrl && currentBlobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(currentBlobUrl);
        if (window.musicApi && window.musicApi.revokeBlobUrl && currentSongId) {
            window.musicApi.revokeBlobUrl(currentSongId);
        }
        currentBlobUrl = null;
    }
}

async function playSong(songId) {
    cleanupCurrentBlobUrl();
    currentSongId = songId;

    // 移除之前的事件监听器
    if (loadedMetadataHandler) {
        currentAudio.removeEventListener("loadedmetadata", loadedMetadataHandler);
        loadedMetadataHandler = null;
    }
    if (errorHandler) {
        currentAudio.removeEventListener("error", errorHandler);
        errorHandler = null;
    }
    currentAudio.removeEventListener("timeupdate", updateSeekBar);

    currentAudio.pause();
    currentAudio.src = "";
    currentAudio.load();
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }

    const songData = await window.musicApi.getSongUrl(songId);
    if (currentSongId !== songId || !songData?.url) {
        if (!songData?.url) {
            console.error("Failed to get song URL:", songData);
        }
        return;
    }

    const songInfo = await window.musicApi.getSongInfo(songId);
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
    }

    try {
        await addToPlayHistory(songId);
    } catch (error) {
        console.error("Failed to add song to play history:", error);
    }

    currentAudio.src = songData.url;
    if (songData.url && songData.url.startsWith("blob:")) {
        currentBlobUrl = songData.url;
    }

    currentAudio.load();
    setupSeekBar();

    await new Promise((resolve, reject) => {
        loadedMetadataHandler = function onLoadedMetadata() {
            currentAudio.removeEventListener("loadedmetadata", loadedMetadataHandler);
            currentAudio.removeEventListener("error", errorHandler);
            const fixedDuration = Math.floor(currentAudio.duration);
            if (totalTimeEl) {
                totalTimeEl.textContent = formatTime(fixedDuration);
            }
            if (seekBar) {
                seekBar.max = fixedDuration;
                seekBar.value = 0;
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
            reject(new Error("Failed to load audio metadata"));
        };
        currentAudio.addEventListener("loadedmetadata", loadedMetadataHandler);
        currentAudio.addEventListener("error", errorHandler);
    });

    // 开始播放
    try {
        await currentAudio.play();
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = `
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            `;
            // 添加新的点击事件（使用togglePause函数）
            pauseBtn.onclick = function() {
                togglePause(this);
            };
        }
    } catch (error) {
        console.error("Failed to play audio:", error);
    }

    currentAudio.addEventListener("timeupdate", updateSeekBar);
}

// 在页面加载时初始化播放器
document.addEventListener('DOMContentLoaded', initializePlayer);

function setupSeekBar() {
    if (!seekBar) {
        seekBar = document.getElementById("seek-bar");
        if (seekBar) {
            seekBar.addEventListener("input", handleSeek);
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
    const displayTime = Math.min(Math.floor(currentTime), duration);

    if (isNaN(duration) || duration <= 0) return;

    seekBar.value = displayTime;
    currentTimeEl.textContent = formatTime(displayTime);

    if (totalTimeEl.textContent === "00:00") {
        totalTimeEl.textContent = formatTime(Math.floor(duration));
    }
}

function handleSeek() {
    if (!currentAudio || !seekBar) return;

    const seekTime = parseFloat(seekBar.value);
    if (isNaN(seekTime)) return;

    currentAudio.currentTime = seekTime;
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(seekTime);
    }
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
        console.error("Button element not found!");
        return;
    }

    if (!currentAudio || !currentAudio.src) {
        console.log("No audio to play/pause");
        return;
    }
    try {
        if (currentAudio.paused) {
            currentAudio.play();
            console.log("Audio resumed");
            buttonElement.innerHTML = `
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            `;
        } else {
            currentAudio.pause();
            console.log("Audio paused");
            buttonElement.innerHTML = `
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            `;
        }
    } catch (error) {
        console.error("Error toggling pause:", error);
    }
}
