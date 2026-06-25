function setupOptions() {
    const checkUpdateBtn = document.getElementById("check-update-btn");

    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener("click", () => {
            checkUpdateBtn.disabled = true;
            checkUpdateBtn.textContent = "Checking...";
            window.electronAPI.checkForUpdates();
        });

        window.electronAPI.onUpdateStatus((msg) => {
            checkUpdateBtn.disabled = false;
            checkUpdateBtn.textContent = msg.message || msg;
        });

        window.electronAPI.onUpdateError((msg) => {
            checkUpdateBtn.disabled = false;
            checkUpdateBtn.textContent = `Error: ${msg.message || msg}`;
            setTimeout(() => {
                checkUpdateBtn.textContent = "Check";
            }, 3000);
        });
    }

    // 添加可视化开关
    const visualizerToggleContainer = document.getElementById("visualizer-toggle-container");
    if (visualizerToggleContainer) {
        window.electronAPI.getConfig("visualizer.enabled", true).then((enabled) => {
            enableVisualizer = enabled;
            new ToggleSwitch(visualizerToggleContainer, enabled, (enabled) => {
                window.electronAPI.setConfig("visualizer.enabled", enabled);
                enableVisualizer = enabled;
            });
        });
    }
}
