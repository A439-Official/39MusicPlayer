import fs from "fs";
import path from "path";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

/**
 * 缓存过期阈值
 * 超过30天需重新请求, 超过60天直接删除文件
 */
const DAY_MS = 1000 * 60 * 60 * 24;
const STALE_AFTER_MS = DAY_MS * 30;
const DELETE_AFTER_MS = DAY_MS * 60;

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

    getTimestamp(safePath, filePath) {
        const cacheInfo = this.metadata[safePath];
        if (cacheInfo) {
            return cacheInfo.lastAccessed || cacheInfo.created || 0;
        }
        try {
            return fs.statSync(filePath).mtimeMs;
        } catch {
            return 0;
        }
    }

    removeEntry(safePath) {
        let removed = false;
        try {
            fs.unlinkSync(path.join(this.cacheDir, safePath));
            removed = true;
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error(`删除缓存文件失败 ${safePath}:`, error);
            }
        }
        if (this.metadata[safePath]) {
            delete this.metadata[safePath];
            removed = true;
        }
        return removed;
    }

    async getCache(cachePath) {
        const safePath = sanitizeCachePath(cachePath);
        const filePath = path.join(this.cacheDir, safePath);
        try {
            if (fs.existsSync(filePath)) {
                const now = Date.now();
                const timestamp = this.getTimestamp(safePath, filePath);

                if (timestamp < now - DELETE_AFTER_MS) {
                    this.removeEntry(safePath);
                    this.saveMetadata();
                    return { data: null, expired: true, deleted: true };
                }

                if (timestamp < now - STALE_AFTER_MS) {
                    this.metadata[safePath] = this.metadata[safePath] || { created: timestamp };
                    this.metadata[safePath].needsRefresh = true;
                    this.saveMetadata();
                    return { data: null, expired: true, deleted: false };
                }

                this.updateAccessTime(safePath);
                return { data: fs.readFileSync(filePath), expired: false };
            }
            return { data: null, expired: false };
        } catch (error) {
            console.error("读取缓存文件失败:", error);
            return { data: null, expired: false };
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

            const now = Date.now();
            let cleaned = 0;

            for (const file of fs.readdirSync(this.cacheDir)) {
                if (file === "cache_metadata.json") continue;

                const filePath = path.join(this.cacheDir, file);
                const timestamp = this.getTimestamp(file, filePath);

                if (timestamp < now - DELETE_AFTER_MS) {
                    if (this.removeEntry(file)) cleaned++;
                } else if (timestamp < now - STALE_AFTER_MS) {
                    this.metadata[file] = this.metadata[file] || { created: timestamp };
                    this.metadata[file].needsRefresh = true;
                } else if (this.metadata[file]) {
                    delete this.metadata[file].needsRefresh;
                }
            }

            this.saveMetadata();
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
            }
            // 目录被删掉了，写元数据前得先把它建回来，否则 ENOENT
            this.ensureCacheDirExists();
            this.metadata = {};
            this.saveMetadata();
            return true;
        } catch (error) {
            console.error("清空缓存失败:", error);
            return false;
        }
    }
}

export default CacheManager;
