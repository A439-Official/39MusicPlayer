const { Tray, Menu } = require("electron");
const path = require("node:path");

/**
 * 创建系统托盘图标
 * @param {Object} app - Electron app实例
 * @param {Object} mainWindow - 主窗口实例
 * @returns {Object} tray实例
 */
function createTray(app, mainWindow) {
    const iconPath = path.join(__dirname, "..", "resources/icon.png");
    const tray = new Tray(iconPath);
    
    tray.setToolTip("39MusicPlayer");
    
    // 左键点击：显示窗口
    tray.on("click", () => {
        if (mainWindow && !mainWindow.isVisible()) {
            mainWindow.show();
        }
    });
    
    // 右键菜单：只包含退出按钮
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "退出",
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    return tray;
}

module.exports = {
    createTray,
};