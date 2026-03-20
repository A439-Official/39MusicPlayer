const { ipcMain } = require("electron");
const CacheManager = require("./cacheManager");

function registerIPC(app, configManager) {
    const cacheManager = new CacheManager(configManager);

    ipcMain.handle("quit", (event) => {
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
}

module.exports = {
    registerIPC,
};
