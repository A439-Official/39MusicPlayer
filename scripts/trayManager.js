const { Tray, Menu } = require("electron");
const path = require("node:path");

function createTray(app, mainWindow) {
    const iconPath = path.join(__dirname, "..", "resources/icon.png");
    const tray = new Tray(iconPath);

    tray.setToolTip("39MusicPlayer");

    tray.on("click", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            if (mainWindow.isVisible()) {
                mainWindow.focus();
            } else {
                mainWindow.show();
            }
        }
    });

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "退出",
            click: () => {
                app.isQuitting = true;
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(contextMenu);
    return tray;
}

module.exports = {
    createTray,
};
