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

contextBridge.exposeInMainWorld("marked", {
    parse: (markdown) => marked.parse(markdown),
});
