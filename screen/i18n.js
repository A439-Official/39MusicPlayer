let currentLanguage = "en";
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
    if (currentLanguage === "en") {
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
    if (currentLanguage === "en") {
        document.documentElement.lang = "en";
    } else {
        document.documentElement.lang = "zh-CN";
    }
}

async function loadLanguage(langIndex) {
    if (!languages) {
        await loadLanguages();
    }

    const languageKeys = ["en", ...Object.keys(languages)];
    if (langIndex < 0 || langIndex >= languageKeys.length) {
        langIndex = 0;
    }

    const langKey = languageKeys[langIndex];
    currentLanguage = langKey;

    try {
        await window.electronAPI.setConfig("language", langIndex);
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

    const languageKeys = ["en", ...Object.keys(languages)];
    const languageNames = ["English", ...Object.keys(languages)];
    const currentIndex = languageKeys.indexOf(currentLanguage);

    if (languageSelectCustom) {
        languageSelectCustom = null;
        container.innerHTML = "";
    }

    if (typeof CustomSelect !== "undefined") {
        languageSelectCustom = new CustomSelect(container, languageNames, currentIndex >= 0 ? currentIndex : 0, (selectedIndex) => {
            const selectedLangIndex = selectedIndex;
            if (selectedLangIndex !== currentIndex) {
                loadLanguage(selectedLangIndex);
            }
        });
    }
}

async function initI18n() {
    return new Promise(async (resolve) => {
        await loadLanguages();

        try {
            const savedLanguageIndex = await window.electronAPI.getConfig("language", 0);
            await loadLanguage(savedLanguageIndex);
        } catch (e) {
            console.warn("Failed to load saved language:", e);
            await loadLanguage(0);
        }

        resolve();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await initI18n();
});
