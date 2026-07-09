function createSongItem(songId, menuItems) {
    const item = document.createElement("div");
    item.className = "song-item";
    item.dataset.songId = songId;

    item.addEventListener("click", (e) => {
        if (e.target.closest?.(".dropdown-menu")) return;
        playSongl(songId);
    });

    const infoDiv = document.createElement("div");
    infoDiv.className = "song-item-info";
    const title = document.createElement("div");
    title.className = "song-title";
    title.textContent = songId; // 占位
    const artist = document.createElement("div");
    artist.className = "song-artist";
    artist.textContent = "";
    infoDiv.append(title, artist);

    window.musicApi.getSongInfo(songId).then((songInfo) => {
        if (!songInfo) return;
        title.textContent = songInfo.name || songId;
        artist.textContent = Array.isArray(songInfo.artist) ? songInfo.artist.join(" & ") : songInfo.artist || "";
    });

    const menuWrapper = document.createElement("div");
    menuWrapper.className = "menu-wrapper";

    const dropdownItems = menuItems.map((item, index) => ({
        label: item.label,
        value: index,
    }));
    const dropdown = new DropdownMenu(menuWrapper, dropdownItems, "⋮", (selectedItem, index) => {
        const originalItem = menuItems[selectedItem.value];
        if (originalItem && typeof originalItem.callback === "function") {
            originalItem.callback(songId);
        }
    });
    const trigger = dropdown.trigger;
    if (trigger) {
        const label = trigger.querySelector(".label");
        const arrow = trigger.querySelector(".arrow");
        if (label) label.textContent = "⋮";
        if (arrow) arrow.style.display = "none";
    }
    item.append(infoDiv, menuWrapper);
    return item;
}

function showModal(...uis) {
    const modalOverlay = document.querySelector(".modal-overlay");
    modalOverlay.style.display = "flex";
    const modalContent = document.querySelector(".modal-content");
    modalContent.innerHTML = "";
    modalContent.append(...uis);
    translations(modalContent);
}

function closeModal() {
    const modalOverlay = document.querySelector(".modal-overlay");
    modalOverlay.style.display = "none";
    const modalContent = document.querySelector(".modal-content");
    modalContent.innerHTML = "";
}

function initModal() {
    const modalOverlay = document.querySelector(".modal-overlay");
    modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}

function isConfirm(msg) {
    return new Promise((resolve) => {
        const message = document.createElement("div");
        message.className = "confirm-message";
        message.textContent = i18n(msg);

        const confirmBtn = document.createElement("button");
        confirmBtn.className = "confirm-btn";
        confirmBtn.textContent = i18n("Confirm");
        confirmBtn.addEventListener("click", () => {
            closeModal();
            resolve(true);
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "cancel-btn";
        cancelBtn.textContent = i18n("Cancel");
        cancelBtn.addEventListener("click", () => {
            closeModal();
            resolve(false);
        });

        showModal(message, confirmBtn, cancelBtn);
    });
}
