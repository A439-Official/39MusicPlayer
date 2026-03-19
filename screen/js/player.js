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
    } catch (error) {
        console.error("Failed to play audio:", error);
    }

    currentAudio.addEventListener("timeupdate", updateSeekBar);
}

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

function togglePause() {
    if (!currentAudio || !currentAudio.src) {
        console.log("No audio to play/pause");
        return;
    }
    try {
        if (currentAudio.paused) {
            currentAudio.play();
            console.log("Audio resumed");
        } else {
            currentAudio.pause();
            console.log("Audio paused");
        }
    } catch (error) {
        console.error("Error toggling pause:", error);
    }
}
