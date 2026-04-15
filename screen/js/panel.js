document.addEventListener("DOMContentLoaded", () => {
    const contentPlayer = document.getElementById("content-player");
    const tabList = document.querySelector(".tab-list");
    const closeSvg = document.getElementById("btn-close");

    if (!contentPlayer || !tabList || !closeSvg) {
        console.error("Error: 缺少必要元素");
        return;
    }

    closeSvg.addEventListener("click", () => {
        // 切换播放器状态
        contentPlayer.classList.toggle("act");

        // 切换选项卡状态（通过CSS类管理动画）
        tabList.classList.toggle("hidden");

        // 切换SVG旋转状态
        closeSvg.classList.toggle("rotated");
    });
});
