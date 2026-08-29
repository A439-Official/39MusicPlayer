import fs from "fs";
import path from "path";
import { pathToFileURL } from "node:url";
import { net } from "electron";
import Logger from "./logger.js";

class ScriptLoader {
    constructor(utils = {}) {
        this.utils = {
            fetchJson: async (url) => {
                Logger.info(`访问 ${url}`);
                const response = await net.fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            },
            fetchRedirect: async (url) => {
                Logger.info(`访问 ${url}`);
                return new Promise((resolve, reject) => {
                    let finalUrl = url;
                    const request = net.request(url);
                    request.on("redirect", (statusCode, method, redirectUrl) => {
                        finalUrl = redirectUrl;
                        request.followRedirect();
                    });
                    request.on("response", (response) => {
                        response.on("data", () => {});
                        response.on("end", () => {
                            resolve(finalUrl);
                        });
                    });
                    request.on("error", reject);
                    request.end();
                });
            },
            ...utils,
        };

        this.plugins = new Map();
    }

    async load(file) {
        const module = await import(pathToFileURL(path.resolve(file)));

        const plugin = module.default;

        if (!plugin.meta) {
            throw new Error("Plugin meta missing");
        }

        const id = plugin.meta.id;

        if (this.plugins.has(id)) {
            throw new Error(`Plugin ${id} already loaded`);
        }

        this.plugins.set(id, plugin);

        Logger.info(`已加载插件 ${id}`);

        return plugin.meta;
    }

    async run(id, functionName, params = {}) {
        const plugin = this.plugins.get(id);

        if (!plugin) {
            throw new Error(`Plugin ${id} not found`);
        }

        const fn = plugin.functions?.[functionName];

        if (typeof fn !== "function") {
            throw new Error(`Function ${functionName} not found`);
        }

        const result = await fn(params, this.utils);

        JSON.stringify(result);

        return result;
    }

    getMeta(id) {
        const plugin = this.plugins.get(id);
        if (!plugin) {
            throw new Error(`Plugin ${id} not found`);
        }
        return plugin.meta;
    }

    unload(id) {
        return this.plugins.delete(id);
    }

    list() {
        return [...this.plugins.values()].map((p) => p.meta);
    }

    async loadFromDir(dir) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            if (file.endsWith(".js")) {
                await this.load(path.join(dir, file));
            }
        }
    }
}

export default ScriptLoader;
