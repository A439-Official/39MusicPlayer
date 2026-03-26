const volumeSlider = document.getElementById("volumeSlider");

if (typeof currentAudio !== "undefined" && volumeSlider) {
    const savedVolume = localStorage.getItem("playerVolume");
    const initialVolume = savedVolume !== null ? parseFloat(savedVolume) : 1;
    volumeSlider.value = initialVolume;
    function setVolume(volume) {
        localStorage.setItem("playerVolume", volume);
        if (window.volumeGainNode) {
            window.volumeGainNode.gain.value = volume;
        }
    }

    if (window.volumeGainNode) {
        window.volumeGainNode.gain.value = initialVolume;
    }

    volumeSlider.addEventListener("input", function () {
        const volume = parseFloat(this.value);
        setVolume(volume);
    });

    volumeSlider.addEventListener("dblclick", function () {
        if (window.volumeGainNode && window.volumeGainNode.gain.value > 0) {
            localStorage.setItem("playerVolumeBeforeMute", window.volumeGainNode.gain.value);
            window.volumeGainNode.gain.value = 0;
            this.value = 0;
            localStorage.setItem("playerVolume", 0);
        } else {
            const savedVolume = localStorage.getItem("playerVolumeBeforeMute") || localStorage.getItem("playerVolume");
            const volumeToSet = parseFloat(savedVolume) || 1;
            if (window.volumeGainNode) {
                window.volumeGainNode.gain.value = volumeToSet;
            }
            this.value = volumeToSet;
            localStorage.setItem("playerVolume", volumeToSet);
        }
    });
}
