// 等待DOM加载完成
document.addEventListener("DOMContentLoaded", function () {
    // 确保currentAudio存在（你的音频元素）
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

    // 创建音频上下文和分析器
    let audioCtx;
    let analyser;
    let dataArray;
    let source;

    function initAudioContext() {
        // 创建音频上下文
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024; // 频率分辨率

        // 连接音频源
        source = audioCtx.createMediaElementSource(currentAudio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        // 创建用于存储频率数据的数组
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }

    // 动画循环
    function draw() {
        if (!analyser) return;

        requestAnimationFrame(draw);

        // 获取频率数据
        analyser.getByteFrequencyData(dataArray);

        // 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制波纹效果
        const barWidth = (canvas.width / dataArray.length) * 1.5;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = dataArray[i] / 2;

            // 绘制矩形条
            ctx.fillStyle = `rgb(0,${barHeight + 100}, 255)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            // 添加渐变效果
            const gradient = ctx.createLinearGradient(x, canvas.height - barHeight, x, canvas.height);
            gradient.addColorStop(0, "rgba(0, 255, 255, 0.3)");
            gradient.addColorStop(1, "rgba(0, 255, 255, 0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }

    // 初始化音频上下文并开始动画
    function startVisualizer() {
        if (!audioCtx) {
            initAudioContext();
        }
        draw();
    }

    // 当音频开始播放时启动可视化效果
    currentAudio.addEventListener("play", startVisualizer);

    // 如果音频已经在播放（例如从暂停恢复），也启动可视化
    if (!currentAudio.paused) {
        startVisualizer();
    }

    // 处理音频暂停/停止
    currentAudio.addEventListener("pause", function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    currentAudio.addEventListener("ended", function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
});
