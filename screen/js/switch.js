//ck是一个没有用的选项，这是为了给我做参考
document.addEventListener("DOMContentLoaded", function () {
    const FullscrTogg = document.getElementById("FullscrTogg");
    const ck = document.getElementById("ck");

    // 检查元素是否存在
    if (!FullscrTogg || !ck) {
        console.error("未找到 FullscrTogg 或 ck 元素");
        return;
    }

    // 页面加载时从本地存储恢复状态
    const savedFullscrState = localStorage.getItem("FullscrState") === "true";
    const savedckState = localStorage.getItem("ckState") === "true";

    if (savedFullscrState !== undefined) {
        FullscrTogg.checked = savedFullscrState;
    }
    if (savedckState !== undefined) {
        ck.checked = savedckState;
    }
    updateStatus();

    // 添加事件监听器
    FullscrTogg.addEventListener("change", function () {
        localStorage.setItem("FullscrState", this.checked);
        updateStatus();
    });

    ck.addEventListener("change", function () {
        localStorage.setItem("ckState", this.checked);
        updateStatus();
    });
});

// 更新状态显示
function updateStatus() {
    const FullscrTogg = document.getElementById("FullscrTogg");
    const contentPlayer = document.getElementById("content-player");
    const ck = document.getElementById("ck");
    if (!FullscrTogg || !ck) return;

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

    // 输出 ck 的状态
    if (ck.checked) {
        console.log("ck 开关已开启");
    } else {
        console.log("ck 开关已关闭");
    }
}

// 可选：添加点击外部区域关闭开关的功能（如果需要）
document.addEventListener("click", function (event) {
    const toggleContainer = document.querySelector(".toggle-container");
    if (toggleContainer && !toggleContainer.contains(event.target)) {
        // 这里可以添加逻辑来控制外部点击行为
        // 例如：FullscrTogg.checked = false;
        // 但通常开关应该保持用户选择的状态，所以这里注释掉
    }
});
