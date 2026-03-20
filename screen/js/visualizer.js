// 等待DOM加载完成
document.addEventListener("DOMContentLoaded", function () {
    // 确保currentAudio存在
    if (typeof currentAudio === "undefined") {
        console.warn("Audio element not found");
        return;
    }

    // 获取Canvas元素和上下文
    const canvas = document.getElementById("visualizer");
    const ctx = canvas.getContext("2d");

    // 设置Canvas尺寸
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    let audioCtx;
    let analyser;
    let dataArray;
    let source;
    const fftSize = 2 ** 11;

    function initAudioContext() {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = 0.5;
        source = audioCtx.createMediaElementSource(currentAudio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }

    function drawSpectrogram() {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const frame = dataArray;

        ctx.imageSmoothingEnabled = true;
        const color = getComputedStyle(document.documentElement).getPropertyValue("--text-1").trim();
        ctx.strokeStyle = color || "#000000";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for (let f = 0; f < frame.length; f += 1) {
            const x = (1 - (1 - f / frame.length) ** 3) * canvas.width;
            const y = canvas.height - (frame[f] / 255) ** 5 * canvas.height * 0.95;
            if (f === 0) {
                ctx.lineTo(x, y);
            } else {
                const prevX = (1 - (1 - (f - 1) / frame.length) ** 3) * canvas.width;
                const prevY = canvas.height - (frame[f - 1] / 255) ** 5 * canvas.height;
                const cpX = (prevX + x) / 2;
                const cpY = (prevY + y) / 2;
                ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
            }
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.stroke();
    }

    // 动画循环
    function draw() {
        if (!analyser) return;

        requestAnimationFrame(draw);
        drawSpectrogram();
    }

    function startVisualizer() {
        if (!audioCtx) {
            initAudioContext();
        }
        draw();
    }

    currentAudio.addEventListener("play", startVisualizer);

    if (!currentAudio.paused) {
        startVisualizer();
    }

    currentAudio.addEventListener("pause", function () {});

    currentAudio.addEventListener("ended", function () {});

    window.resetSpectrogram = function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
});
