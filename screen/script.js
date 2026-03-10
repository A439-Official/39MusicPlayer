function switchToPlayerTab() {
    document.querySelectorAll(".tab-title.active, .tab-content.active").forEach((el) => el.classList.remove("active"));
    const playerTab = document.getElementById("tab-player");
    const playerContent = document.getElementById("content-player");
    if (playerTab) playerTab.classList.add("active");
    if (playerContent) playerContent.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
    // Tab switching
    const tabs = document.querySelectorAll(".tab-title");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab-title.active, .tab-content.active").forEach((el) => el.classList.remove("active"));
            tab.classList.add("active");
            const tabName = tab.id.replace("tab-", "");
            document.getElementById(`content-${tabName}`)?.classList.add("active");
        });
    });
});
