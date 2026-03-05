const { BrowserWindow, Menu, MenuItem } = require("electron");
const path = require("node:path");

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.pageData = null;
    }

    createWindow(appName, configManager) {
        this.mainWindow = new BrowserWindow({
            width: 1280,
            height: 720,
            minWidth: 640,
            minHeight: 360,

            title: appName,
            icon: path.join(__dirname, "../resources/textures/icon.png"),
            webPreferences: {
                preload: path.join(__dirname, "../scripts/preload.js"),
            },
            autoHideMenuBar: true,
        });
        this.mainWindow.setFullScreen(configManager.get("fullscreen", false));
        this._initShortcuts(configManager);
        return this.mainWindow;
    }

    getMainWindow() {
        return this.mainWindow;
    }

    _initShortcuts(configManager) {
        const menu = new Menu();

        // 添加应用菜单(macOS)
        if (process.platform === "darwin") {
            menu.append(new MenuItem({ role: "appMenu" }));
        }

        // 菜单项配置
        const menuItems = [
            {
                label: "Reload window",
                click: () => this.mainWindow.reload(),
                accelerator: "CommandOrControl+R",
            },
            {
                label: "Full screen",
                click: () => {
                    this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
                    configManager.set("fullscreen", this.mainWindow.isFullScreen());
                },
                accelerator: "F11",
            },
        ];

        // 开发模式下添加开发者工具菜单项
        if (process.env.NODE_ENV === "development" || !require("electron").app.isPackaged) {
            menuItems.push({
                label: "Open DevTools",
                click: () => this.mainWindow.webContents.openDevTools(),
                accelerator: "f12",
            });
        }

        // 构建子菜单并添加到主菜单
        const submenu = Menu.buildFromTemplate(menuItems);
        menu.append(new MenuItem({ label: "Custom Menu", submenu }));

        // 设置应用菜单
        Menu.setApplicationMenu(menu);
    }

    /**
     * 加载单页应用（忽略参数，保持兼容性）
     */
    loadPage(pageId, data) {
        if (!this.mainWindow) {
            throw new Error("Window not created yet");
        }

        // 加载一个简单的HTML页面，preload脚本将负责初始化
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>39MusicPlayer</title>
</head>
<body>
    <div id="app">Loading...</div>
</body>
</html>`;
        this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch((err) => {
            console.error("Failed to load page:", err);
            throw err;
        });

        console.log("Single page loaded");
    }
}

module.exports = WindowManager;
