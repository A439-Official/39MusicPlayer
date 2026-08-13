import fs from "fs";
import { ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath } from "node:url";
import CacheManager from "./cacheManager.js";
import ScriptLoader from "./scriptLoader.js";
import { checkForUpdates, autoUpdater } from "./autoUpdater.js";
import Logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function registerIPC(app, configManager) {
    const cacheManager = new CacheManager(configManager);

    const scriptLoader = new ScriptLoader();

    const sourcesDir = path.join(configManager.getConfigDir(), "sources");
    fs.mkdirSync(sourcesDir, { recursive: true });
    const scriptsLoadedPromise = scriptLoader.loadFromDir(sourcesDir).catch(console.error);

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

    // 删除指定缓存
    ipcMain.handle("delete-cache", async (event, cachePath) => {
        return await cacheManager.deleteCache(cachePath);
    });

    // 清空缓存
    ipcMain.handle("clear-cache", async (event) => {
        return await cacheManager.clearCache();
    });

    // 执行脚本
    ipcMain.handle("script-run", async (event, id, params) => {
        await scriptsLoadedPromise;
        return await scriptLoader.run(id, "run", params);
    });

    // 获取脚本列表
    ipcMain.handle("script-list", async () => {
        return scriptLoader.list();
    });

    // 获取脚本元信息
    ipcMain.handle("script-get-meta", async (event, id) => {
        return scriptLoader.getMeta(id);
    });

    // 重新加载所有脚本
    ipcMain.handle("script-reload-all", async () => {
        for (const { id } of scriptLoader.list()) {
            scriptLoader.unload(id);
        }
        await scriptLoader.loadFromDir(sourcesDir);
        return scriptLoader.list();
    });

    ipcMain.on("open-external", (event, url) => {
        shell.openExternal(url);
    });

    ipcMain.on("check-for-updates", async (event) => {
        try {
            return await checkForUpdates();
        } catch (err) {
            Logger.error("[ipcHandler] 检查更新失败:", err);
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send("update-error", {
                    message: err?.message || String(err),
                    stack: err?.stack,
                });
            }
        }
    });

    ipcMain.on("log", (event, level, ...args) => {
        Logger[level](...args);
    });
}

export { registerIPC };
