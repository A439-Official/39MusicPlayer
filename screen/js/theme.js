let theme = "Default";
let themes = null;
let themeSelectCustom = null;

async function loadThemes() {
    try {
        const response = await fetch("res://themes.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        themes = await response.json();
        if (!themes[theme]) {
            theme = "Default";
        }
    } catch (error) {
        console.error("加载主题文件失败:", error);
        themes = {};
    }
}

function applyTheme(themeName) {
    if (!themes || !themes[themeName]) {
        console.warn(`未找到主题 "${themeName}"`);
        return false;
    }
    const themeData = themes[themeName];
    const root = document.documentElement;
    Object.entries(themeData).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });
    return true;
}

async function loadTheme(themeName) {
    if (!themes) {
        await loadThemes();
    }
    if (applyTheme(themeName)) {
        theme = themeName;
        try {
            await window.electronAPI.setConfig("theme", themeName);
        } catch (e) {
            console.warn("保存主题设置到配置失败:", e);
        }
        updateThemeSelector();
        return true;
    }
    return false;
}

function updateThemeSelector() {
    const container = document.getElementById("theme-select-custom");
    if (!container || !themes) return;
    const themeNames = Object.keys(themes);
    const currentIndex = themeNames.indexOf(theme);
    if (themeSelectCustom) {
        // 如果已有实例，只更新选中索引，避免重新创建导致下拉列表关闭
        themeSelectCustom.setValue(currentIndex >= 0 ? currentIndex : 0);
    } else {
        // 首次创建实例
        themeSelectCustom = new CustomSelect(container, themeNames, currentIndex >= 0 ? currentIndex : 0, (selectedIndex) => {
            const selectedTheme = themeNames[selectedIndex];
            if (selectedTheme && selectedTheme !== theme) {
                loadTheme(selectedTheme);
            }
        });
    }
}

function initTheme() {
    return new Promise(async (resolve) => {
        await loadThemes();

        try {
            const savedTheme = await window.electronAPI.getConfig("theme", "Default");
            if (savedTheme && savedTheme !== theme) {
                await loadTheme(savedTheme);
            } else {
                applyTheme(theme);
            }
        } catch (e) {
            console.warn("加载已保存的主题设置失败:", e);
            applyTheme(theme);
        }

        updateThemeSelector();
        resolve();
    });
}
