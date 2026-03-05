const { protocol, net } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const url = require("node:url");

function registerProtocolHandler(app) {
    protocol.handle("res", async (request) => {
        try {
            let filePath = decodeURIComponent(request.url.slice("res:///".length));
            filePath = filePath.replace(/\//g, path.sep);

            const absolutePath = path.join("./resources", filePath);

            if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
                return new Response("Not Found", { status: 404 });
            }

            try {
                const resolvedPath = path.resolve(absolutePath);
                return net.fetch(url.pathToFileURL(resolvedPath).toString());
            } catch (error) {
                console.error(`Failed to fetch file: ${absolutePath}`, error);
                return new Response("File not found", { status: 404 });
            }
        } catch (error) {
            console.error("Protocol handler error:", error);
            return new Response("Internal Server Error", { status: 500 });
        }
    });
}

module.exports = {
    registerProtocolHandler,
};
