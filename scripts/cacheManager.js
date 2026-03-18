const fs = require("fs");
const path = require("path");

/**
 * 缓存管理器（后端）
 * 提供磁盘缓存读写功能，缓存文件存储在配置目录下的 cache 文件夹中
 */
class CacheManager {
    /**
     * @param {ConfigManager} configManager 配置管理器实例，用于获取配置目录
     */
    constructor(configManager) {
        this.configManager = configManager;
        this.cacheDir = path.join(this.configManager.getConfigDir(), "cache");
        this.ensureCacheDirExists();
    }

    /**
     * 确保缓存目录存在
     */
    ensureCacheDirExists() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    /**
     * 从磁盘读取缓存
     * @param {string} cachePath 缓存文件路径
     * @returns {Promise<Buffer|null>} 缓存数据Buffer，如果文件不存在或读取失败则返回 null
     */
    async getCache(cachePath) {
        const filePath = path.join(this.cacheDir, cachePath);
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath);
            }
            return null;
        } catch (error) {
            console.error("Failed to read cache file:", error);
            return null;
        }
    }

    /**
     * 保存缓存到磁盘
     * @param {string} cachePath 缓存文件路径
     * @param {Buffer|Uint8Array} data 要保存的二进制数据
     * @returns {Promise<boolean>} 是否保存成功
     */
    async saveCache(cachePath, data) {
        if (!Buffer.isBuffer(data) && !(data instanceof Uint8Array)) {
            console.error("Cache data must be Buffer or Uint8Array");
            return false;
        }

        try {
            this.ensureCacheDirExists();
            const filePath = path.join(this.cacheDir, cachePath);
            fs.writeFileSync(filePath, data);
            return true;
        } catch (error) {
            console.error("Failed to save cache file:", error);
            return false;
        }
    }

    /**
     * 清空缓存文件夹
     * @returns {Promise<boolean>} 是否清空成功
     */
    async clearCache() {
        try {
            if (fs.existsSync(this.cacheDir)) {
                fs.rmSync(this.cacheDir, { recursive: true, force: true });
            }
            return true;
        } catch (error) {
            console.error("Failed to clear cache:", error);
            return false;
        }
    }
}

module.exports = CacheManager;
