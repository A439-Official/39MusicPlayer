const playlistState = {
    playlists: [],
    curName: null,
    curSongIdx: 0,
};

const getCurrentPlaylist = () => {
    if (!playlistState.curName) return { songs: [] };
    const playlist = playlistState.playlists.find((p) => p.name === playlistState.curName);
    return playlist || { songs: [] };
};

const isValidIndex = (idx) => idx >= 0 && idx < getCurrentPlaylist().songs.length;

async function playSongl(songId) {
    const index = getCurrentPlaylist().songs.indexOf(songId);
    if (!isValidIndex(index)) {
        await loadPlaylist("History");
        playSong(songId);
        return;
    }
    playlistState.curSongIdx = index;
    playSong(songId);
}

async function playNext() {
    const songs = getCurrentPlaylist().songs;
    if (!songs.length) return;
    const next = songs[(playlistState.curSongIdx + 1) % songs.length];
    await playSongl(next);
}

async function playPrev() {
    const songs = getCurrentPlaylist().songs;
    if (!songs.length) return;
    const prev = songs[(playlistState.curSongIdx - 1 + songs.length) % songs.length];
    await playSongl(prev);
}

async function getPlaylists() {
    const list = await window.electronAPI.getConfig("playlists", []);
    playlistState.playlists = Array.isArray(list)
        ? list.map((p) => ({
              ...p,
              songs: Array.isArray(p.songs) ? [...new Set(p.songs)] : [],
          }))
        : [];
}

async function savePlaylists() {
    await window.electronAPI.setConfig("playlists", playlistState.playlists);
}

function loadPlaylist(name) {
    const exists = playlistState.playlists.some((p) => p.name === name);
    if (!exists) return;
    playlistState.curName = name;
    playlistState.curSongIdx = 0;
    updatePlaylistUI();
}

async function addSongToPlaylist(songId, playlistName) {
    const playlist = playlistState.playlists.find((p) => p.name === playlistName);
    if (!playlist) return;
    if (!playlist.songs.includes(songId)) {
        playlist.songs.push(songId);
        await savePlaylists();
        updatePlaylistUI();
    }
}

async function updatePlaylistUI() {
    const container = document.getElementById("playlist-list-container");
    const emptyMsg = document.getElementById("playlist-empty-msg");
    const selector = document.getElementById("playlist-selector-custom");
    if (!container || !selector) return;

    const { playlists, curName } = playlistState;

    const curPlaylistSongs = getCurrentPlaylist().songs;

    if (curPlaylistSongs.length) {
        emptyMsg.style.display = "none";
    } else {
        emptyMsg.style.display = "block";
    }

    selector.innerHTML = "";
    new CustomSelect(
        selector,
        playlists.map((p) => p.name),
        playlists.findIndex((p) => p.name === curName),
        (idx) => {
            loadPlaylist(playlists[idx].name);
        },
    );

    container.innerHTML = "";
    if (curPlaylistSongs.length) {
        for (let i = 0; i < curPlaylistSongs.length; i++) {
            const songId = curPlaylistSongs[i];

            const item = createSongItem(songId, [
                {
                    label: i18n("Delete"),
                    callback: async (id) => {
                        const confirmed = await isConfirm(i18n("Delete Song?"));
                        if (!confirmed) return;
                        const playlist = getCurrentPlaylist();
                        const idx = playlist.songs.indexOf(id);
                        if (idx !== -1) {
                            playlist.songs.splice(idx, 1);
                            savePlaylists().then(() => updatePlaylistUI());
                        }
                    },
                },
            ]);

            container.appendChild(item);
        }
    }
}

async function createPlaylist(name) {
    if (playlistState.playlists.some((p) => p.name === name)) {
        loadPlaylist(name);
        return;
    }
    const playlist = {
        name,
        songs: [],
    };
    playlistState.playlists.push(playlist);
    await savePlaylists();
    loadPlaylist(name);
}

async function handleCreatePlaylist() {
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.placeholder = i18n("Please enter new playlist name");
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const playlistName = inputEl.value.trim();
            const allowedPattern = /^[a-zA-Z0-9\s\-_]+$/;
            if (playlistName && allowedPattern.test(playlistName)) {
                createPlaylist(playlistName);
                inputEl.value = "";
                closeModal();
            } else {
                alert(i18n("Invalid playlist name"));
            }
        }
    });
    showModal(inputEl);
}

async function initPlaylist() {
    await getPlaylists();

    await createPlaylist("History");

    document.getElementById("prev-btn")?.addEventListener("click", playPrev);
    document.getElementById("next-btn")?.addEventListener("click", playNext);
    if (typeof currentAudio !== "undefined") {
        currentAudio.addEventListener("ended", playNext);
    }

    document.getElementById("create-playlist-btn")?.addEventListener("click", handleCreatePlaylist);
}

async function addToPlaylist(songId) {
    const title = document.createElement("h1");
    title.textContent = i18n("Select playlist");

    const btns = [];
    playlistState.playlists.forEach((p) => {
        const btn = document.createElement("button");
        btn.textContent = p.name;
        btn.style.cursor = "pointer";
        btn.addEventListener("click", async () => {
            await addSongToPlaylist(songId, p.name);
            closeModal();
        });
        btns.push(btn);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = i18n("Cancel");
    cancelBtn.style.cursor = "pointer";
    cancelBtn.addEventListener("click", closeModal);

    showModal(title, ...btns, cancelBtn);
}
