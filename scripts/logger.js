import util from "util";

export default class Logger {
    static #format(arg) {
        if (arg === null) return "null";
        if (arg === undefined) return "undefined";
        if (typeof arg === "object") {
            return util.inspect(arg, {
                compact: false,
            });
        }
        return String(arg);
    }

    static #print(level, color, ...args) {
        console.log(`${color}[${level.toUpperCase()}]\x1b[0m ${args.map((a) => this.#format(a)).join(" ")}`);
    }

    static info(...args) {
        this.#print("info", "\x1b[32m", ...args);
    }

    static warn(...args) {
        this.#print("warn", "\x1b[33m", ...args);
    }

    static error(...args) {
        this.#print("error", "\x1b[31m", ...args);
    }
}
