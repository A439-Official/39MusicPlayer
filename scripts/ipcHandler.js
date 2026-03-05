const { ipcMain, dialog } = require("electron");

function registerIPC(app, configManager) {
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
}

module.exports = {
    registerIPC,
};
