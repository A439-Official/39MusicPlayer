document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("FullscrTogg");
    if (!container) return;

    const savedFullscrState = localStorage.getItem("FullscrState") === "true";

    // 创建开关组件
    const toggleSwitch = new ToggleSwitch(container, savedFullscrState, function (checked) {
        localStorage.setItem("FullscrState", checked);
        updateStatus();
    });

    // 初始状态更新
    updateStatus();
});

// 更新状态显示
function updateStatus() {
    const FullscrTogg = document.getElementById("FullscrTogg");
    const contentPlayer = document.getElementById("content-player");
    if (!FullscrTogg) return;

    const toggleSwitchElement = FullscrTogg.querySelector(".toggle-switch");
    if (!toggleSwitchElement) return;

    if (toggleSwitchElement.classList.contains("active")) {
        let closeSvg = document.getElementById("btn-close");
        if (!closeSvg) {
            closeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            closeSvg.id = "btn-close";
            closeSvg.classList.add("btn-close", "btn");
            closeSvg.setAttribute("viewBox", "0 0 24 24");

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M19 12H6M12 5l-7 7 7 7");
            closeSvg.appendChild(path);
            contentPlayer.appendChild(closeSvg);
        }
        const tabList = document.querySelector(".tab-list");

        closeSvg.addEventListener("click", () => {
            contentPlayer.classList.toggle("act");
            tabList.classList.toggle("hidden");
            closeSvg.classList.toggle("rotated");
        });
    } else {
        const closeSvg = document.getElementById("btn-close");
        if (closeSvg) {
            closeSvg.remove();
        }
    }
}
