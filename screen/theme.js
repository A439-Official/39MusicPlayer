const { ipcRenderer } = require("electron");

let theme = "Default";
let themes = null;
let themeSelectCustom = null;

async function loadThemes() {
    try {
        const response = await fetch("../resources/themes.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        themes = await response.json();
        console.log("Themes loaded:", Object.keys(themes));
        if (!themes[theme]) {
            theme = "Default";
        }
    } catch (error) {
        console.error("Failed to load themes:", error);
        themes = {};
    }
}

function applyTheme(themeName) {
    if (!themes || !themes[themeName]) {
        console.warn(`Theme "${themeName}" not found`);
        return false;
    }
    const themeData = themes[themeName];
    const root = document.documentElement;
    Object.entries(themeData).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });
    console.log(`Theme "${themeName}" applied`);
    return true;
}

async function loadTheme(themeName) {
    if (!themes) {
        await loadThemes();
    }
    if (applyTheme(themeName)) {
        theme = themeName;
        try {
            await ipcRenderer.invoke("set-config", "theme", themeName);
        } catch (e) {
            console.warn("Failed to save theme to config:", e);
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
        themeSelectCustom = null;
        container.innerHTML = "";
    }
    themeSelectCustom = new CustomSelect(container, themeNames, currentIndex >= 0 ? currentIndex : 0, (selectedIndex) => {
        const selectedTheme = themeNames[selectedIndex];
        if (selectedTheme && selectedTheme !== theme) {
            loadTheme(selectedTheme);
        }
    });
}

function initTheme() {
    return new Promise(async (resolve) => {
        await loadThemes();

        try {
            const savedTheme = await ipcRenderer.invoke("get-config", "theme", "Default");
            if (savedTheme && savedTheme !== theme) {
                await loadTheme(savedTheme);
            } else {
                applyTheme(theme);
            }
        } catch (e) {
            console.warn("Failed to load saved theme:", e);
            applyTheme(theme);
        }

        updateThemeSelector();
        resolve();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await initTheme();
    console.log("Theme system initialized");
});
