const { Tray, Menu } = require("electron");
const path = require("node:path");

function createTray(app, focus) {
    const iconPath = path.join(__dirname, "..", "resources/icon.png");
    const tray = new Tray(iconPath);

    tray.setToolTip("39MusicPlayer");

    tray.on("click", focus);

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
