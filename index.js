const { app, BrowserWindow, Menu, MenuItem, session } = require("electron");
const path = require("node:path");
const ConfigManager = require("./scripts/configManager");
const { registerProtocolHandler } = require("./scripts/protocolHandler");
const { registerIPC } = require("./scripts/ipcHandler");
const { createTray } = require("./scripts/trayManager");

const APP_NAME = "39MusicPlayer";

let mainWindow = null;
let configManager = null;
const appLock = app.requestSingleInstanceLock();

function focus() {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        if (!mainWindow.isVisible()) {
            mainWindow.show();
        }
        mainWindow.focus();
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 640,
        minHeight: 360,
        title: APP_NAME,
        icon: path.join(__dirname, "resources/icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            backgroundThrottling: false,
        },
        autoHideMenuBar: true,
    });

    mainWindow.setFullScreen(configManager.get("fullscreen", false));

    initShortcuts();

    mainWindow.loadFile(path.join(__dirname, "screen/index.html")).catch((err) => {
        console.error("Failed to load index.html:", err);
    });

    mainWindow.on("close", (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
        return true;
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    return mainWindow;
}

function initShortcuts() {
    const menu = new Menu();

    // 添加应用菜单(macOS)
    if (process.platform === "darwin") {
        menu.append(new MenuItem({ role: "appMenu" }));
    }

    // 菜单项配置
    const menuItems = [
        {
            label: "Full screen",
            click: () => {
                mainWindow.setFullScreen(!mainWindow.isFullScreen());
                configManager.set("fullscreen", mainWindow.isFullScreen());
            },
            accelerator: "F11",
        },
    ];

    // 开发者工具
    if (process.env.NODE_ENV === "development" || !app.isPackaged) {
        menuItems.push({
            label: "Open DevTools",
            click: () => mainWindow.webContents.openDevTools(),
            accelerator: "f12",
        });
        menuItems.push({
            label: "Reload window",
            click: () => mainWindow.reload(),
            accelerator: "CommandOrControl+R",
        });
    }

    const submenu = Menu.buildFromTemplate(menuItems);
    menu.append(new MenuItem({ label: "Custom Menu", submenu }));
    Menu.setApplicationMenu(menu);
}

function initializeApp() {
    session.defaultSession.setCertificateVerifyProc((request, callback) => {
        console.log("skip SSL verification for", request.hostname);
        callback(0);
    });

    configManager = new ConfigManager(APP_NAME);

    registerProtocolHandler(app);
    registerIPC(app, configManager);

    createWindow();
    tray = createTray(app, focus);
}

if (!appLock) {
    app.quit();
} else {
    app.on("second-instance", focus);

    app.whenReady().then(() => {
        app.isQuitting = false;
        initializeApp();
        app.on("activate", () => {
            if (mainWindow === null) {
                initializeApp();
            }
        });
    });

    app.on("window-all-closed", () => {});

    app.on("before-quit", () => {
        console.log("Application is quitting...");
        app.isQuitting = true;
    });

    process.on("uncaughtException", (error) => {
        console.error("Uncaught Exception:", error);
    });

    process.on("unhandledRejection", (reason, promise) => {
        console.error("Unhandled Rejection at:", promise, "reason:", reason);
    });
}
