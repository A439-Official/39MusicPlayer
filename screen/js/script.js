const volumeSlider = document.getElementById("volumeSlider");

// 移除所有活动的标签页和内容
function removeAllActiveTabs() {
    document.querySelectorAll(".tab-title.active, .tab-content.active").forEach((el) => el.classList.remove("active"));
}

function switchToPlayerTab() {
    removeAllActiveTabs();
    document.getElementById("tab-player")?.classList.add("active");
    document.getElementById("content-player")?.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
    // Tab switching
    const tabs = document.querySelectorAll(".tab-title");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            removeAllActiveTabs();
            tab.classList.add("active");
            const tabName = tab.id.replace("tab-", "");
            document.getElementById(`content-${tabName}`)?.classList.add("active");
        });
    });
});

if (typeof currentAudio !== "undefined" && volumeSlider) {
    const savedVolume = localStorage.getItem("playerVolume");
    const initialVolume = savedVolume !== null ? parseFloat(savedVolume) : 1;

    currentAudio.volume = initialVolume;
    volumeSlider.value = initialVolume;

    volumeSlider.addEventListener("input", function () {
        const volume = parseFloat(this.value);
        currentAudio.volume = volume;
        localStorage.setItem("playerVolume", volume);
    });

    volumeSlider.addEventListener("dblclick", function () {
        if (currentAudio.volume > 0) {
            // 静音
            localStorage.setItem("playerVolumeBeforeMute", currentAudio.volume);
            currentAudio.volume = 0;
            this.value = 0;
        } else {
            // 取消静音
            const savedVolume = localStorage.getItem("playerVolumeBeforeMute") || localStorage.getItem("playerVolume");
            const volumeToSet = parseFloat(savedVolume) || 1;
            currentAudio.volume = volumeToSet;
            this.value = volumeToSet;
            localStorage.setItem("playerVolume", volumeToSet);
        }
    });
}
