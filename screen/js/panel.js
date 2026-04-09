// 点击播放器面板的关闭按钮，切换播放器面板的显示/隐藏，切换选项卡列表的显示/隐藏
document.addEventListener("DOMContentLoaded", function () {
    const contentPlayer = document.getElementById("content-player");
    const tabList = document.querySelector(".tab-list");

    // 检查元素是否存在
    if (!contentPlayer || !tabList) {
        console.error('Error: Could not find elements with IDs "content-player" or ".tab-list"');
        return;
    }

    document.addEventListener("click", function (event) {
        // 检查点击的是否是关闭按钮（假设关闭按钮有 #closeBtn ID）
        const closeBtn = event.target.closest("#closeBtn");
        if (closeBtn) {
            // 切换播放器面板的 act 类
            contentPlayer.classList.toggle("act");

            // 获取关闭按钮的 SVG 元素（现在从点击的元素中查找）
            const closeBtnSvg = closeBtn.querySelector("svg");
            if (!closeBtnSvg) {
                console.warn("Warning: Close button SVG not found");
                return;
            }

            const isHidden = tabList.style.display === "none" || (tabList.style.opacity === "0" && tabList.offsetParent === null);

            if (isHidden) {
                tabList.style.display = "";
                closeBtnSvg.style.transform = "";
                setTimeout(() => {
                    tabList.style.opacity = "";
                }, 10);
            } else {
                tabList.style.opacity = "0";
                closeBtnSvg.style.transform = "rotate(180deg)";
                setTimeout(() => {
                    tabList.style.display = "none";
                }, 300);
            }
        }
    });
});
