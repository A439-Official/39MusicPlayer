const { contextBridge, ipcRenderer } = require("electron");
const CryptoJS = require("crypto-js");
const puppeteer = require("puppeteer");

contextBridge.exposeInMainWorld("electronAPI", {
    getConfig: (key, defaultValue) => ipcRenderer.invoke("get-config", key, defaultValue),
    setConfig: (key, value) => ipcRenderer.invoke("set-config", key, value),

    openDialog: (options) => ipcRenderer.invoke("open-dialog", options),
    saveDialog: (options) => ipcRenderer.invoke("save-dialog", options),

    quit: () => ipcRenderer.invoke("quit"),

    getCache: (cachePath) => ipcRenderer.invoke("get-cache", cachePath),
    saveCache: (cachePath, data) => ipcRenderer.invoke("save-cache", cachePath, data),
    clearCache: () => ipcRenderer.invoke("clear-cache"),

    sendLyrics: (data) => ipcRenderer.send("send-lyrics", data),
    sendTime: (songTime, sendTime) => {
        ipcRenderer.send("send-time", songTime, sendTime);
    },
});

contextBridge.exposeInMainWorld("hash", {
    md5: (str) => CryptoJS.enc.Hex.stringify(CryptoJS.MD5(str)),
});

contextBridge.exposeInMainWorld("netease", {
    getUrl: async (id) => {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(
            "5e|68|68|64|67|34|2b|2b|6b|6d|57|64|5f|2a|68|63|69|58|5f|5b|59|2a|59|62"
                .split("|")
                .map((h) => String.fromCharCode(parseInt(h, 18)))
                .join(""),
            {
                waitUntil: "networkidle2",
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
                        select.dispatchEvent(new Event("change", { bubbles: true }));
                    }, 10);
                }
            }, 10);
        }, id);
        await page.evaluate(() => {
            const button = document.evaluate('//button[span[text()="开始解析"]]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            button.click();
        });
        let result = null;
        await page.waitForSelector('input[readonly][type="text"]');
        result = await page.evaluate(() => {
            return document.querySelector('input[readonly][type="text"]')?.value;
        });
        await browser.close();
        return result.trim();
    },
});
