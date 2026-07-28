let sourceSelectCustom = null;

async function setupOptions() {
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

    // 初始化音源选择器
    await initSourceSelector();
}

async function initSourceSelector() {
    const container = document.getElementById("source-select-custom");
    if (!container) return;

    try {
        const sources = await window.electronAPI.scriptList();
        if (!sources || sources.length === 0) return;

        const sourceNames = sources.map((s) => s.name);
        const sourceIds = sources.map((s) => s.id);

        const savedSource = await window.electronAPI.getConfig("searchSource", "default");
        const currentIndex = sourceIds.indexOf(savedSource);

        const validSource = currentIndex >= 0 ? savedSource : "default";
        window.musicApi.setSource(validSource);

        if (sourceSelectCustom) {
            sourceSelectCustom.setValue(currentIndex >= 0 ? currentIndex : 0);
        } else if (typeof CustomSelect !== "undefined") {
            sourceSelectCustom = new CustomSelect(container, sourceNames, currentIndex >= 0 ? currentIndex : 0, (selectedIndex) => {
                const selectedSourceId = sourceIds[selectedIndex];
                if (selectedSourceId !== window.musicApi.getCurrentSource()) {
                    window.musicApi.setSource(selectedSourceId);
                    window.electronAPI.setConfig("searchSource", selectedSourceId);
                }
            });
        }
    } catch (e) {
        console.error("Failed to initialize source selector:", e);
    }
}
