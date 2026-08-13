let sourceSelectCustom = null;

async function setupOptions() {
    const checkUpdateBtn = document.getElementById("check-update-btn");

    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener("click", () => {
            checkUpdateBtn.disabled = true;
            checkUpdateBtn.textContent = "Checking...";
            window.electronAPI.checkForUpdates();
        });

        window.electronAPI.onUpdateStatus((_event, data) => {
            checkUpdateBtn.disabled = false;
            checkUpdateBtn.textContent = data?.message || data || "Check";
        });

        window.electronAPI.onUpdateNotAvailable((_event, data) => {
            checkUpdateBtn.disabled = false;
            checkUpdateBtn.textContent = data?.message || data || "Check";
            setTimeout(() => {
                checkUpdateBtn.textContent = "Check";
            }, 3000);
        });

        window.electronAPI.onUpdateAvailable((_event, data) => {
            checkUpdateBtn.disabled = false;
            checkUpdateBtn.textContent = data?.message || data || "Check";
            setTimeout(() => {
                checkUpdateBtn.textContent = "Check";
            }, 3000);
        });

        window.electronAPI.onUpdateError((_event, data) => {
            checkUpdateBtn.disabled = false;
            checkUpdateBtn.textContent = `Error: ${data?.message || data || "Unknown error"}`;
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

    // 添加允许预览版开关
    const prereleaseToggleContainer = document.getElementById("prerelease-toggle-container");
    if (prereleaseToggleContainer) {
        window.electronAPI.getConfig("update.allowPrerelease", false).then((allowPrerelease) => {
            new ToggleSwitch(prereleaseToggleContainer, allowPrerelease, (enabled) => {
                window.electronAPI.setConfig("update.allowPrerelease", enabled);
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

        let savedSource = await window.electronAPI.getConfig("searchSource", sourceIds[0]);
        let currentIndex = sourceIds.indexOf(savedSource);

        // 如果保存的源无效，回退到第一个可用源
        if (currentIndex < 0) {
            savedSource = sourceIds[0];
            currentIndex = 0;
            // 更新配置为有效的源ID
            window.electronAPI.setConfig("searchSource", savedSource);
        }

        const validSource = savedSource;
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
        console.error("初始化音源选择器失败:", e);
    }
}
