const { ipcRenderer } = require("electron");

// 歌曲时间
let updateTime = Date.now();
let songTime = 0;
let screen = document.getElementById("screen");
let pause = true;

// 歌词
let lyrics;

function getLyricEndTime(lyrics, index) {
    if (index < lyrics.length - 1) {
        return lyrics[index + 1].time;
    } else {
        return lyrics[index].time + 4.39;
    }
}

function bezier(x, a, b, c, d, e = 32) {
    for (t = m = 0.5, f = (t, y) => ((o = 1 - t), y[0] == "x" ? 3 * o * o * t * a + 3 * o * t * t * c + t ** 3 : 3 * o * o * t * b + 3 * o * t * t * d + t ** 3); e--; ) ((m *= 0.5), (t += f(t, "x") < x ? m : -m));
    return f(t, "y");
}

function random(seed) {
    const seedStr = seed === undefined ? Date.now().toString() : seed.toString();
    let hash = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
        hash ^= seedStr.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
        hash >>>= 0;
    }
    let state = hash;
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
}

function segment(text) {
    if (typeof text !== "string") {
        return [];
    }
    const regex = /(\b[a-zA-Z0-9]+(?:[-\u2019'][a-zA-Z0-9]+)*\b)|([\u4e00-\u9fa5])|([^\s])/g;
    const tokens = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const token = match[1] || match[2] || match[3];
        if (token) {
            tokens.push(token);
        }
    }
    return tokens;
}

function getAnimProgress(time, startTime, duration) {
    const maxAnimTime = 1;
    const elapsed = time - startTime;
    if (elapsed <= 0) return -1;
    if (elapsed >= duration) return 1;
    const halfDuration = duration / 2;
    const downDuration = Math.min(halfDuration, maxAnimTime);
    const upDuration = Math.min(halfDuration, maxAnimTime);
    const midDuration = duration - downDuration - upDuration;
    if (elapsed <= downDuration) {
        const localT = elapsed / downDuration;
        const y = bezier(localT, 0, 0, 0, 1);
        return y - 1;
    } else if (elapsed <= downDuration + midDuration) {
        return 0;
    } else {
        const upElapsed = elapsed - (downDuration + midDuration);
        const localT = upElapsed / upDuration;
        const x = 1 - localT;
        const y = bezier(x, 0, 0, 0, 1);
        return 1 - y;
    }
}

ipcRenderer.on("lyrics", (event, data) => {
    // lyrics = data.wlyrics.length > 0 ? data.wlyrics : data.lyrics;
    lyrics = data.lyrics;
});

ipcRenderer.on("time", (event, receivedSongTime, sendTime) => {
    if (sendTime) {
        updateTime = sendTime;
        songTime = receivedSongTime;
        pause = false;
    } else {
        songTime = receivedSongTime;
        pause = true;
    }
});

function update() {
    requestAnimationFrame(update);

    screen.width = window.innerWidth;
    screen.height = window.innerHeight;

    const ctx = screen.getContext("2d");
    ctx.clearRect(0, 0, screen.width, screen.height);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const time = pause ? songTime : songTime + (Date.now() - updateTime) / 1000;
    ctx.font = `${screen.height / 24}px "HarmonyOS Sans"`;
    ctx.fillStyle = "rgb(255, 255, 255)";

    const centerX = screen.width * 0.5;
    const centerY = screen.height * 0.9;

    if (lyrics) {
        let currentLyricIndex = -1;
        for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].time > time) {
                break;
            }
            currentLyricIndex = i;
        }

        if (currentLyricIndex !== -1) {
            const currentLyric = lyrics[currentLyricIndex];

            // if (currentLyric.words) {
            if (false) {
                let currentWordIndex = -1;
                for (let i = 0; i < currentLyric.words.length; i++) {
                    if (currentLyric.words[i].start > time) {
                        break;
                    }
                    currentWordIndex = i;
                }

                if (currentWordIndex !== -1) {
                    ctx.fillText(currentLyric.words[currentWordIndex].text, centerX, centerY);
                }
            } else {
                const lyricText = currentLyric.text;
                if (!lyricText) return;

                const chars = Array.from(lyricText);
                const words = segment(lyricText);

                const startTime = currentLyric.time;
                const endTime = getLyricEndTime(lyrics, currentLyricIndex);
                const duration = endTime - startTime;

                if (time > endTime) {
                    return;
                }

                // 绘制
                const progress = getAnimProgress(time, startTime, duration);

                const spacing = (screen.width / 256) * Math.abs(progress);

                if (chars.length === 0) return;

                const charWidths = [];
                for (const ch of chars) charWidths.push(ctx.measureText(ch).width);
                let sumWidth = 0;
                for (const w of charWidths) sumWidth += w;
                const totalWidth = sumWidth + spacing * (chars.length - 1);
                let startX = centerX - totalWidth / 2;

                let currentX = startX;
                for (let i = 0; i < chars.length; i++) {
                    const offsetX = screen.height * 0.02 * (random(i + 1 + chars[i] + chars.length + (currentLyricIndex + (progress > 0)) * 0.618) * 2 - 1) * Math.abs(progress);
                    const offsetY = screen.height * 0.02 * (random(i - 1 + chars[i] + chars.length + (currentLyricIndex + (progress > 0)) * 0.618) * 2 - 1) * Math.abs(progress);
                    ctx.fillText(chars[i], currentX + charWidths[i] / 2 + offsetX, centerY + offsetY);
                    currentX += charWidths[i] + spacing;
                }
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    update();
});
