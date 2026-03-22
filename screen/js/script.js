// 移除所有活动的标签页和内容
function removeAllActiveTabs() {
    document.querySelectorAll(".tab-title.active, .tab-content.active").forEach((el) => el.classList.remove("active"));
}

function switchToPlayerTab() {
    removeAllActiveTabs();
    document.getElementById("tab-player")?.classList.add("active");
    document.getElementById("content-player")?.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
    // Tab switching
    const tabs = document.querySelectorAll(".tab-title");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            removeAllActiveTabs();
            tab.classList.add("active");
            const tabName = tab.id.replace("tab-", "");
            document.getElementById(`content-${tabName}`)?.classList.add("active");
        });
    });
});
