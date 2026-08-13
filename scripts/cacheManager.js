import fs from "fs";
import path from "path";

/**
 * 缓存管理器
 */
/**
 * Windows 文件名非法字符正则：< > : " \ / | ? *
 */
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

/**
 * 将缓存路径中的非法字符替换为安全字符
 * @param {string} cachePath
 * @returns {string}
 */
function sanitizeCachePath(cachePath) {
    return cachePath.replace(INVALID_FILENAME_CHARS, "_");
}

class CacheManager {
    constructor(configManager) {
        this.cacheDir = path.join(configManager.getConfigDir(), "cache");
        this.metadataFile = path.join(this.cacheDir, "cache_metadata.json");
        this.metadata = {};

        this.ensureCacheDirExists();
        this.loadMetadata();

        this.cleanupExpiredCache().catch(console.error);
    }

    ensureCacheDirExists() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    loadMetadata() {
        try {
            if (fs.existsSync(this.metadataFile)) {
                this.metadata = JSON.parse(fs.readFileSync(this.metadataFile, "utf8"));
            } else {
                this.metadata = {};
                this.saveMetadata();
            }
        } catch (error) {
            console.error("加载缓存元数据失败:", error);
            this.metadata = {};
        }
    }

    saveMetadata() {
        try {
            fs.writeFileSync(this.metadataFile, JSON.stringify(this.metadata, null, 2));
        } catch (error) {
            console.error("保存缓存元数据失败:", error);
        }
    }

    updateAccessTime(cachePath) {
        const now = Date.now();
        this.metadata[cachePath] = this.metadata[cachePath] || { created: now };
        this.metadata[cachePath].lastAccessed = now;
        this.saveMetadata();
    }

    async getCache(cachePath) {
        const safePath = sanitizeCachePath(cachePath);
        const filePath = path.join(this.cacheDir, safePath);
        try {
            if (fs.existsSync(filePath)) {
                this.updateAccessTime(safePath);
                return fs.readFileSync(filePath);
            }
            return null;
        } catch (error) {
            console.error("读取缓存文件失败:", error);
            return null;
        }
    }

    async saveCache(cachePath, data) {
        if (!Buffer.isBuffer(data) && !(data instanceof Uint8Array)) {
            console.error("缓存数据必须是 Buffer 或 Uint8Array 类型");
            return false;
        }

        try {
            this.ensureCacheDirExists();
            const safePath = sanitizeCachePath(cachePath);
            fs.writeFileSync(path.join(this.cacheDir, safePath), data);

            const now = Date.now();
            this.metadata[safePath] = { created: now, lastAccessed: now };
            this.saveMetadata();
            return true;
        } catch (error) {
            console.error("保存缓存文件失败:", error);
            return false;
        }
    }

    async cleanupExpiredCache() {
        try {
            if (!fs.existsSync(this.cacheDir)) return true;

            const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7; // 7 days
            let cleaned = 0;

            for (const file of fs.readdirSync(this.cacheDir)) {
                if (file === "cache_metadata.json") continue;

                const cacheInfo = this.metadata[file];
                if (!cacheInfo || cacheInfo.lastAccessed < sevenDaysAgo) {
                    try {
                        fs.unlinkSync(path.join(this.cacheDir, file));
                        delete this.metadata[file];
                        cleaned++;
                    } catch (err) {
                        console.error(`删除缓存文件失败 ${file}:`, err);
                    }
                }
            }

            if (cleaned) this.saveMetadata();
            cleaned && console.log(`已清理 ${cleaned} 个过期缓存文件。`);
            return true;
        } catch (error) {
            console.error("清理过期缓存失败:", error);
            return false;
        }
    }

    async deleteCache(cachePath) {
        const safePath = sanitizeCachePath(cachePath);
        const filePath = path.join(this.cacheDir, safePath);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                delete this.metadata[safePath];
                this.saveMetadata();
                return true;
            }
            return false;
        } catch (error) {
            console.error("删除缓存文件失败:", error);
            return false;
        }
    }

    async clearCache() {
        try {
            if (fs.existsSync(this.cacheDir)) {
                fs.rmSync(this.cacheDir, { recursive: true, force: true });
                this.metadata = {};
                this.saveMetadata();
            }
            return true;
        } catch (error) {
            console.error("清空缓存失败:", error);
            return false;
        }
    }
}

export default CacheManager;
