const fs = require("fs");
const path = require("path");

/**
 * 缓存管理器
 */
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
            console.error("Failed to load cache metadata:", error);
            this.metadata = {};
        }
    }

    saveMetadata() {
        try {
            fs.writeFileSync(this.metadataFile, JSON.stringify(this.metadata, null, 2));
        } catch (error) {
            console.error("Failed to save cache metadata:", error);
        }
    }

    updateAccessTime(cachePath) {
        const now = Date.now();
        this.metadata[cachePath] = this.metadata[cachePath] || { created: now };
        this.metadata[cachePath].lastAccessed = now;
        this.saveMetadata();
    }

    async getCache(cachePath) {
        const filePath = path.join(this.cacheDir, cachePath);
        try {
            if (fs.existsSync(filePath)) {
                this.updateAccessTime(cachePath);
                return fs.readFileSync(filePath);
            }
            return null;
        } catch (error) {
            console.error("Failed to read cache file:", error);
            return null;
        }
    }

    async saveCache(cachePath, data) {
        if (!Buffer.isBuffer(data) && !(data instanceof Uint8Array)) {
            console.error("Cache data must be Buffer or Uint8Array");
            return false;
        }

        try {
            this.ensureCacheDirExists();
            fs.writeFileSync(path.join(this.cacheDir, cachePath), data);

            const now = Date.now();
            this.metadata[cachePath] = { created: now, lastAccessed: now };
            this.saveMetadata();
            return true;
        } catch (error) {
            console.error("Failed to save cache file:", error);
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
                        console.error(`Failed to delete ${file}:`, err);
                    }
                }
            }

            if (cleaned) this.saveMetadata();
            cleaned && console.log(`Cleaned ${cleaned} expired cache files.`);
            return true;
        } catch (error) {
            console.error("Failed to cleanup expired cache:", error);
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
            console.error("Failed to clear cache:", error);
            return false;
        }
    }
}

module.exports = CacheManager;
