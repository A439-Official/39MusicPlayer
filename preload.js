const { contextBridge, ipcRenderer } = require("electron");

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
