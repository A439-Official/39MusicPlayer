const { contextBridge, ipcRenderer } = require("electron");
const CryptoJS = require("crypto-js");
const puppeteer = require("puppeteer");
const marked = require("marked");

contextBridge.exposeInMainWorld("electronAPI", {
    getConfig: (key, defaultValue) => ipcRenderer.invoke("get-config", key, defaultValue),
    setConfig: (key, value) => ipcRenderer.invoke("set-config", key, value),

    openDialog: (options) => ipcRenderer.invoke("open-dialog", options),
    saveDialog: (options) => ipcRenderer.invoke("save-dialog", options),

    openExternal: (url) => ipcRenderer.send("open-external", url),

    quit: () => ipcRenderer.send("quit"),

    checkForUpdates: () => ipcRenderer.send("check-for-updates"),
    onUpdateStatus: (callback) => ipcRenderer.on("update-status", callback),
    onUpdateError: (callback) => ipcRenderer.on("update-error", callback),

    getCache: (cachePath) => ipcRenderer.invoke("get-cache", cachePath),
    saveCache: (cachePath, data) => ipcRenderer.invoke("save-cache", cachePath, data),
    clearCache: () => ipcRenderer.send("clear-cache"),
});

contextBridge.exposeInMainWorld("hash", {
    md5: (str) => CryptoJS.enc.Hex.stringify(CryptoJS.MD5(str)),
});
contextBridge.exposeInMainWorld("netease", {
    getUrl: async (id, maxRetries = 3) => {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let browser;

            try {
                console.log(`第 ${attempt} 次尝试获取歌曲链接`);

                browser = await puppeteer.launch({
                    headless: "new",
                    args: ["--no-sandbox", "--disable-setuid-sandbox"],
                });

                const page = await browser.newPage();

                await page.setViewport({
                    width: 1920,
                    height: 1080,
                });

                await page.goto(
                    "5e|68|68|64|67|34|2b|2b|6b|6d|57|64|5f|2a|68|63|69|58|5f|5b|59|2a|59|62"
                        .split("|")
                        .map((h) => String.fromCharCode(parseInt(h, 18)))
                        .join(""),
                    {
                        waitUntil: "networkidle2",
                        timeout: 30000, // 30秒超时
                    },
                );

                await page.evaluate((id) => {
                    const input = document.querySelector('input[placeholder*="输入"]');

                    input.focus();
                    input.select();

                    function setValue(input, value) {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;

                        nativeInputValueSetter.call(input, value);

                        input.dispatchEvent(new Event("input", { bubbles: true }));
                        input.dispatchEvent(new Event("change", { bubbles: true }));
                    }

                    setValue(input, id.toString());

                    const select = document.querySelector(".search-header-select");

                    const suffix = select.querySelector(".ant-select-suffix");

                    suffix.dispatchEvent(
                        new MouseEvent("mousedown", {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                        }),
                    );

                    suffix.dispatchEvent(
                        new MouseEvent("mouseup", {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                        }),
                    );

                    setTimeout(() => {
                        const options = document.querySelectorAll(".ant-select-item-option-content");

                        const target = [...options].find((el) => el.textContent.trim() === "无损音质");

                        if (target) {
                            target.click();

                            setTimeout(() => {
                                select.dispatchEvent(
                                    new Event("change", {
                                        bubbles: true,
                                    }),
                                );
                            }, 10);
                        }
                    }, 10);
                }, id);

                await page.evaluate(() => {
                    const button = document.evaluate('//button[span[text()="开始解析"]]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                    button.click();
                });

                await page.waitForSelector('input[readonly][value*="music.126.net"]', {
                    timeout: 30000,
                });

                const result = await page.evaluate(() => {
                    return document.querySelector('input[readonly][value*="music.126.net"]')?.value;
                });

                if (!result?.trim()) {
                    throw new Error("解析结果为空");
                }

                await browser.close();

                return result.trim();
            } catch (err) {
                lastError = err;

                console.error(`第 ${attempt} 次尝试失败:`, err.message);

                if (browser) {
                    try {
                        await browser.close();
                    } catch {}
                }

                // 还有机会重试
                if (attempt < maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
        }

        throw new Error(`获取歌曲链接失败，已重试 ${maxRetries} 次：${lastError.message}`);
    },
});

contextBridge.exposeInMainWorld("marked", {
    parse: (markdown) => marked.parse(markdown),
});
