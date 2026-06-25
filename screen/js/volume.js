function initVolumeControl() {
    const container = document.querySelector(".volume-progress-bar");
    if (typeof currentAudio === "undefined" || !container) return;

    document.getElementById("volumeSlider")?.remove();

    const getVolume = () => window.electronAPI.getConfig("volume", 1);
    const setVolume = (vol) => {
        window.electronAPI.setConfig("volume", vol);
        if (window.volumeGainNode) {
            window.volumeGainNode.gain.value = vol;
        }
    };

    (async () => {
        const initialVol = await getVolume();
        const progressBar = new CustomProgressBar(container, initialVol, setVolume, true);
        if (window.volumeGainNode) {
            window.volumeGainNode.gain.value = initialVol;
        }

        const muteBtn = document.getElementById("volume-button");
        if (!muteBtn) return;

        let isMuted = false;
        let volumeBeforeMute = initialVol;

        muteBtn.addEventListener("click", () => {
            if (!window.volumeGainNode) return;

            if (isMuted) {
                const vol = volumeBeforeMute || 1;
                setVolume(vol);
                progressBar.setValue(vol);
            } else {
                volumeBeforeMute = window.volumeGainNode.gain.value;
                setVolume(0);
                progressBar.setValue(0);
            }
            isMuted = !isMuted;
        });
    })();
}
