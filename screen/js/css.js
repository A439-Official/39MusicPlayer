document.addEventListener("DOMContentLoaded", function () {
    const titleElement = document.querySelector(".song-title");
    
    // 初始化溢出检测
    function checkOverflow() {
        const container = titleElement.parentElement;
        if (titleElement.scrollWidth > container.clientWidth) {
            titleElement.classList.add("coroll");
        } else {
            titleElement.classList.remove("coroll");
        }
    }

    // 首次加载时检测
    checkOverflow();

    // 监听文本内容变化
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === "characterData" || mutation.type === "childList") {
                checkOverflow(); // 内容变化时重新检测
            }
        });
    });

    // 配置观察选项（监听文本变化和子节点变化）
    observer.observe(titleElement, {
        characterData: true, // 监听文本变化
        childList: true,     // 监听子节点变化（如 innerHTML 修改）
        subtree: true        // 监听所有后代节点
    });

    // 窗口大小变化时也重新检测（可选）
    let resizeTimeout;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(checkOverflow, 100);
    });
});
