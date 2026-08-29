import { protocol, net } from "electron";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import Logger from "./logger.js";

function registerProtocolHandler(app) {
    protocol.handle("res", async (request) => {
        try {
            let filePath = decodeURIComponent(request.url.slice("res://".length));
            filePath = filePath.replace(/\//g, path.sep);

            const absolutePath = path.join(app.getAppPath(), "resources", filePath);

            if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
                return new Response("Not Found", { status: 404 });
            }

            try {
                const resolvedPath = path.resolve(absolutePath);
                return net.fetch(url.pathToFileURL(resolvedPath).toString());
            } catch (error) {
                Logger.error(`获取文件失败: ${absolutePath}`, error);
                return new Response("File not found", { status: 404 });
            }
        } catch (error) {
            Logger.error("协议处理器错误:", error);
            return new Response("Internal Server Error", { status: 500 });
        }
    });
}

export { registerProtocolHandler };
