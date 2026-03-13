let currentAudio = new Audio();
let currentSongId = null;
let updateInterval = null;
let seekBar = null;
let currentTimeEl = null;
let totalTimeEl = null;

async function playSong(songId) {
    const controller = new AbortController();
    currentSongId = songId;

    const url = `https://ncm.zhenxin.me/song/url?level=lossless&id=${songId}`;
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio.load();
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();
    if (currentSongId !== songId) {
        return;
    }
    if (data.code === 200 && data.data[0].url) {
        const audioUrl = data.data[0].url;
        currentAudio.src = audioUrl;
        currentAudio.load();
        setupSeekBar();

        currentAudio.addEventListener("loadedmetadata", () => {
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
        });

        await currentAudio.play();

        currentAudio.addEventListener("timeupdate", updateSeekBar);
    } else {
        console.error("Failed to get song URL:", data);
    }
}

function pauseAudio() {
    if (!currentAudio || !currentAudio.src) {
        console.log("No audio to pause");
        return;
    }
    try {
        if (!currentAudio.paused) {
            currentAudio.pause();
            console.log("Audio paused");
        }
    } catch (error) {
        console.error("Error pausing audio:", error);
    }
}

function resumeAudio() {
    if (!currentAudio || !currentAudio.src) {
        console.log("No audio to resume");
        return;
    }
    try {
        if (currentAudio.paused) {
            currentAudio.play();
            console.log("Audio resumed");
        }
    } catch (error) {
        console.error("Error resuming audio:", error);
    }
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
    if (!currentAudio || !seekBar || !currentTimeEl || !totalTimeEl) {
        return;
    }
    const currentTime = currentAudio.currentTime;
    const duration = currentAudio.duration;

    const displayTime = Math.min(Math.floor(currentTime), duration);

    if (!isNaN(duration) && duration > 0) {
        const progressPercent = (displayTime / duration) * 100;
        seekBar.value = displayTime;

        currentTimeEl.textContent = formatTime(displayTime);

        if (totalTimeEl.textContent === "00:00" && duration > 0) {
            totalTimeEl.textContent = formatTime(Math.floor(duration));
        }
    }
}

function handleSeek() {
    if (!currentAudio || !seekBar) {
        return;
    }
    const seekTime = parseFloat(seekBar.value);
    if (!isNaN(seekTime)) {
        currentAudio.currentTime = seekTime;
        if (currentTimeEl) {
            currentTimeEl.textContent = formatTime(seekTime);
        }
    }
}

// Format seconds to MM:SS
function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "00:00";

    const roundedSecs = Math.round(seconds);
    const mins = Math.floor(roundedSecs / 60);
    const secs = roundedSecs % 60;

    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Toggle play/pause for the currently loaded audio
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
