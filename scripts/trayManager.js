import { Tray, Menu } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export { createTray };
