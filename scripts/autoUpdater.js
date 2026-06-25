const { autoUpdater } = require("electron-updater");

function send(win, channel, data) {
    const msg = `[autoUpdater:${channel}]`;
    console.log(msg, data);
    if (!win || win.isDestroyed?.()) return;
    win.webContents?.send(channel, data);
}

const UPDATE_EVENT_MAP = {
    "checking-for-update": "update-status",
    "update-available": "update-available",
    "update-not-available": "update-not-available",
    "download-progress": "update-progress",
    "update-downloaded": "update-downloaded",
};

function registerUpdaterEvents(win) {
    Object.entries(UPDATE_EVENT_MAP).forEach(([event, channel]) => {
        autoUpdater.on(event, (payload) => {
            send(win, channel, payload);
        });
    });

    autoUpdater.on("error", (error) => {
        console.error("[autoUpdater] error:", error);
        send(win, "update-error", {
            message: error?.message || String(error),
            stack: error?.stack,
        });
    });
}

function setupAutoUpdater(win, configManager) {
    const autoUpdate = Boolean(configManager.get("update.autoUpdate", true));

    autoUpdater.autoDownload = autoUpdate;
    autoUpdater.autoInstallOnAppQuit = autoUpdate;
    autoUpdater.allowPrerelease = Boolean(configManager.get("update.allowPrerelease", false));

    registerUpdaterEvents(win);
}

async function checkForUpdates() {
    try {
        return await autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
        console.error("[autoUpdater] check failed:", err);
        throw err;
    }
}

module.exports = {
    autoUpdater,
    setupAutoUpdater,
    checkForUpdates,
};
