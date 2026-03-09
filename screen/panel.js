const openBtn = document.getElementById("openBtn");
const closeBtn = document.getElementById("closeBtn");
const panel = document.getElementById("panel");

openBtn.addEventListener("click", () => {
    panel.classList.add("active");
});

closeBtn.addEventListener("click", () => {
    panel.classList.remove("active");
});
