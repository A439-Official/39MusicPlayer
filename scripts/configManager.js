const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class ConfigManager {
    constructor(appName) {
        this.appName = appName;
        this.author = "A439";
        this.configDir = path.join(app.getPath("appData"), this.author, this.appName);
        this.configFile = path.join(this.configDir, "config.json");
        this.defaultConfig = {};

        this.ensureConfigDirExists();
        this.config = this.loadConfig();
    }

    /**
     * 确保配置目录存在
     */
    ensureConfigDirExists() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }

    /**
     * 加载配置文件，如果不存在则创建默认配置
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const configData = fs.readFileSync(this.configFile, "utf8");
                return JSON.parse(configData);
            } else {
                this.saveConfig(this.defaultConfig);
                return { ...this.defaultConfig };
            }
        } catch (error) {
            console.error("加载配置文件失败:", error);
            return { ...this.defaultConfig };
        }
    }

    /**
     * 保存配置到文件
     */
    saveConfig(config = null) {
        try {
            const configToSave = config || this.config;
            fs.writeFileSync(this.configFile, JSON.stringify(configToSave, null, 2), "utf8");
            if (!config) {
                this.config = configToSave;
            }
            return true;
        } catch (error) {
            console.error("保存配置文件失败:", error);
            return false;
        }
    }

    /**
     * 获取配置值
     */
    get(key = null, defaultValue = null) {
        if (key === null) {
            return { ...this.config };
        }

        const keys = key.split(".");
        let value = this.config;

        for (const k of keys) {
            if (value && typeof value === "object" && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * 设置配置值
     */
    set(key, value) {
        const keys = key.split(".");
        let current = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== "object") {
                current[k] = {};
            }
            current = current[k];
        }

        current[keys[keys.length - 1]] = value;
        return this.saveConfig();
    }

    /**
     * 获取配置目录路径
     */
    getConfigDir() {
        return this.configDir;
    }

    /**
     * 获取配置文件路径
     */
    getConfigFile() {
        return this.configFile;
    }
}

module.exports = ConfigManager;
