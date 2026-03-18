const { ipcMain, dialog } = require("electron");
const CacheManager = require("./cacheManager");

function registerIPC(app, configManager) {
    const cacheManager = new CacheManager(configManager);

    ipcMain.handle("quit", (event) => {
        app.quit();
    });

    ipcMain.handle("open-dialog", async (event, options) => {
        const browserWindow = event.sender.getOwnerBrowserWindow ? event.sender.getOwnerBrowserWindow() : null;
        const result = await dialog.showOpenDialog(browserWindow, options);
        return result;
    });

    ipcMain.handle("save-dialog", async (event, options) => {
        const browserWindow = event.sender.getOwnerBrowserWindow ? event.sender.getOwnerBrowserWindow() : null;
        const result = await dialog.showSaveDialog(browserWindow, options);
        return result;
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
}

module.exports = {
    registerIPC,
};
