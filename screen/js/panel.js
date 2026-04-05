document.addEventListener("DOMContentLoaded", function () {
    const contentPlayer = document.getElementById("content-player");
    const tabList = document.querySelector(".tab-list");
    
    // 检查元素是否存在
    if (contentPlayer && tabList) {
        // 使用事件委托，监听文档上的点击事件
        document.addEventListener("click", function (event) {
            // 检查点击的是否是关闭按钮或其子元素
            if (event.target.closest("#closeBtn")) {
                // 切换播放器面板的 act 类
                contentPlayer.classList.toggle("act");

                // 切换选项卡列表的显示/隐藏
                if (tabList.style.display === "none") {
                    tabList.style.display = ""; // 显示
                } else {
                    tabList.style.display = "none"; // 隐藏
                }
            }
        });
    } else {
        console.error('Error: Could not find elements with IDs "content-player" or ".tab-list"');
    }
});
