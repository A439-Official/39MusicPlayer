const { ipcMain, shell } = require("electron");
const CacheManager = require("./cacheManager");
const { checkForUpdates, autoUpdater } = require("./autoUpdater");

function registerIPC(app, configManager) {
    const cacheManager = new CacheManager(configManager);

    ipcMain.on("quit", (event) => {
        app.quit();
    });

    // 获取配置值
    ipcMain.handle("get-config", (event, key, defaultValue) => {
        return configManager.get(key, defaultValue);
    });

    // 设置配置值
    ipcMain.handle("set-config", (event, key, value) => {
        return configManager.set(key, value);
    });

    // 获取缓存
    ipcMain.handle("get-cache", async (event, cachePath) => {
        return await cacheManager.getCache(cachePath);
    });

    // 保存缓存
    ipcMain.handle("save-cache", async (event, cachePath, data) => {
        return await cacheManager.saveCache(cachePath, data);
    });

    // 清空缓存
    ipcMain.handle("clear-cache", async (event) => {
        return await cacheManager.clearCache();
    });

    ipcMain.on("send-lyrics", (event, data) => {
        if (lyricsWindow) {
            lyricsWindow.webContents.send("lyrics", data);
        }
    });

    ipcMain.on("send-time", (event, songTime, sendTime) => {
        if (lyricsWindow) {
            lyricsWindow.webContents.send("time", songTime, sendTime);
        }
    });

    ipcMain.on("open-external", (event, url) => {
        shell.openExternal(url);
    });

    ipcMain.on("check-for-updates", async () => {
        return await checkForUpdates();
    });
}

module.exports = {
    registerIPC,
};
