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

// 更新主题选择器（自定义下拉列表）
function updateThemeSelector() {
    const container = document.getElementById("theme-select-custom");
    if (!container || !themes) return;

    const themeNames = Object.keys(themes);
    const currentIndex = themeNames.indexOf(theme);
    
    if (themeSelectCustom) {
        // 如果已经存在实例，更新选项和选中状态
        // 注意：CustomSelect类不支持动态更新选项，所以我们需要重新创建
        themeSelectCustom = null;
        container.innerHTML = "";
    }
    
    // 创建自定义下拉列表
    themeSelectCustom = new CustomSelect(
        container,
        themeNames,
        currentIndex >= 0 ? currentIndex : 0,
        (selectedIndex) => {
            const selectedTheme = themeNames[selectedIndex];
            if (selectedTheme && selectedTheme !== theme) {
                loadTheme(selectedTheme);
            }
        }
    );
}

// 初始化
document.addEventListener("DOMContentLoaded", async () => {
    // 标签页切换逻辑
    const tabs = document.querySelectorAll(".tab-title");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab-title.active, .tab-content.active").forEach((el) => el.classList.remove("active"));
            tab.classList.add("active");
            const tabName = tab.id.replace("tab-", "");
            document.getElementById(`content-${tabName}`)?.classList.add("active");
        });
    });

    // 加载主题
    await loadThemes();

    // 尝试从配置加载保存的主题
    try {
        const savedTheme = await ipcRenderer.invoke("get-config", "theme", "Default");
        if (savedTheme && savedTheme !== theme) {
            await loadTheme(savedTheme);
        } else {
            // 应用默认主题
            applyTheme(theme);
        }
    } catch (e) {
        console.warn("Failed to load saved theme:", e);
        applyTheme(theme);
    }

    // 填充主题选择器选项
    updateThemeSelector();
});
