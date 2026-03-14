let currentAudio = new Audio();
let currentSongId = null;
let updateInterval = null;
let seekBar = null;
let currentTimeEl = null;
let totalTimeEl = null;

async function playSong(songId) {
    currentSongId = songId;

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

    currentAudio.src = songData.url;
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
