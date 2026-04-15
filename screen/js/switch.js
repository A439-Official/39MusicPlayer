document.addEventListener("DOMContentLoaded", function () {
    const FullscrTogg = document.getElementById("FullscrTogg");

    const savedFullscrState = localStorage.getItem("FullscrState") === "true";

    if (savedFullscrState !== undefined) {
        FullscrTogg.checked = savedFullscrState;
    }
    updateStatus();

    // 添加事件监听器
    FullscrTogg.addEventListener("change", function () {
        localStorage.setItem("FullscrState", this.checked);
        updateStatus();
    });
});

// 更新状态显示
function updateStatus() {
    const FullscrTogg = document.getElementById("FullscrTogg");
    const contentPlayer = document.getElementById("content-player");
    if (!FullscrTogg) return;

    // 输出 FullscrTogg 的状态
    if (FullscrTogg.checked) {
        console.log("FullscrTogg 开关已开启");

        // 检查是否已存在 closeBtn，避免重复添加
        let closeBtn = document.getElementById("closeBtn");
        if (!closeBtn) {
            closeBtn = document.createElement("button");
            closeBtn.classList.add("close-btn");
            closeBtn.id = "closeBtn";
            closeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M19 12H6M12 5l-7 7 7 7"/>
                </svg>
            `;
            contentPlayer.appendChild(closeBtn); // 添加到目标容器
        }
    } else {
        console.log("FullscrTogg 开关已关闭");

        // 移除 closeBtn（如果存在）
        const closeBtn = document.getElementById("closeBtn");
        if (closeBtn) {
            closeBtn.remove();
        }
    }
}
