const { ipcRenderer } = require("electron");

let theme = "Default";
let themes = null;

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

// 更新下拉菜单选项
function updateThemeSelector(selectElement) {
    if (!selectElement) {
        selectElement = document.getElementById("theme-select");
    }
    if (!selectElement) return;

    // 清空现有选项
    selectElement.innerHTML = "";

    if (themes) {
        Object.keys(themes).forEach((themeName) => {
            const option = document.createElement("option");
            option.value = themeName;
            option.textContent = themeName;
            if (themeName === theme) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }
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

    // 为主题选择器添加事件监听
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) {
        themeSelect.addEventListener("change", async (e) => {
            const newTheme = e.target.value;
            await loadTheme(newTheme);
        });
    }
});
