let currentLanguage = "English";
let languages = null;
let languageSelectCustom = null;

async function loadLanguages() {
    try {
        const response = await fetch("res://languages.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        languages = await response.json();
    } catch (error) {
        console.error("Failed to load languages:", error);
        languages = {};
    }
}

function i18n(key) {
    if (currentLanguage === "English") {
        return key;
    }
    if (languages && languages[currentLanguage]) {
        return languages[currentLanguage][key] || key;
    }
    return key;
}

function translations(root = document) {
    const elements = root.querySelectorAll("[data-i18n]");

    elements.forEach((element) => {
        if (!element.dataset.i18nKey) {
            element.dataset.i18nKey = element.getAttribute("data-i18n");
        }

        const key = element.dataset.i18nKey;
        const translated = i18n(key);

        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
            element.placeholder = translated;
        } else {
            element.textContent = translated;
        }
    });
}

function observeI18nChanges() {
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;
                if (node.matches?.("[data-i18n]") || node.querySelector?.("[data-i18n]")) {
                    translations(node);
                }
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
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

    translations();
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
    await loadLanguages();

    try {
        const savedLanguage = await window.electronAPI.getConfig("language", "English");
        await loadLanguage(savedLanguage);
    } catch (e) {
        console.warn("Failed to load saved language:", e);
        await loadLanguage("English");
    }
}
