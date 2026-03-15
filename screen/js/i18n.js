let currentLanguage = "English";
let languages = null;
let languageSelectCustom = null;

async function loadLanguages() {
    try {
        const response = await fetch("../resources/languages.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        languages = await response.json();
    } catch (error) {
        console.error("Failed to load languages:", error);
        languages = {};
    }
}

function translate(text) {
    if (currentLanguage === "English") {
        return text;
    }
    if (languages && languages[currentLanguage]) {
        return languages[currentLanguage][text] || text;
    }
    return text;
}

function applyTranslations() {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
        const key = element.getAttribute("data-i18n");
        const translated = translate(key);

        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
            element.placeholder = translated;
        } else if (element.hasAttribute("data-i18n-title")) {
            element.title = translated;
        } else {
            element.textContent = translated;
        }
    });
    if (currentLanguage === "English") {
        document.documentElement.lang = "en";
    } else {
        document.documentElement.lang = "zh-CN";
    }
}

async function loadLanguage(langCode) {
    if (!languages) {
        await loadLanguages();
    }

    const languageKeys = ["English", ...Object.keys(languages)];
    if (!languageKeys.includes(langCode)) {
        langCode = "English";
    }

    currentLanguage = langCode;

    try {
        await window.electronAPI.setConfig("language", langCode);
    } catch (e) {
        console.warn("Failed to save language to config:", e);
    }

    applyTranslations();
    updateLanguageSelector();
    return true;
}

function updateLanguageSelector() {
    const container = document.getElementById("language-select-custom");
    if (!container || !languages) return;

    const languageKeys = ["English", ...Object.keys(languages)];
    const languageNames = ["English", ...Object.keys(languages)];
    const currentIndex = languageKeys.indexOf(currentLanguage);

    if (languageSelectCustom) {
        // 如果已有实例，只更新选中索引，避免重新创建导致下拉列表关闭
        languageSelectCustom.setValue(currentIndex >= 0 ? currentIndex : 0);
    } else if (typeof CustomSelect !== "undefined") {
        // 首次创建实例
        languageSelectCustom = new CustomSelect(container, languageNames, currentIndex >= 0 ? currentIndex : 0, (selectedIndex) => {
            // 将选中的索引转换为语言代码字符串
            if (selectedIndex >= 0 && selectedIndex < languageKeys.length) {
                const selectedLangCode = languageKeys[selectedIndex];
                if (selectedLangCode !== currentLanguage) {
                    loadLanguage(selectedLangCode);
                }
            }
        });
    }
}

async function initI18n() {
    return new Promise(async (resolve) => {
        await loadLanguages();

        try {
            const savedLanguage = await window.electronAPI.getConfig("language", "English");
            await loadLanguage(savedLanguage);
        } catch (e) {
            console.warn("Failed to load saved language:", e);
            await loadLanguage("English");
        }

        resolve();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await initI18n();
});
