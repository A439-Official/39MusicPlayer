// 播放列表变量
let playlists = [];
let currentPlaylistIndex = 0;
let currentPlaylistSongs = [];
let playlistSelectCustom = null;

// DOM辅助函数
function el(tag, props = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (key === "style" && typeof value === "object") {
            Object.assign(element.style, value);
        } else if (key.startsWith("on")) {
            element.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === "textContent" || key === "className" || key === "id" || key === "value" || key === "selected") {
            element[key] = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    children.forEach((child) => element.appendChild(child));
    return element;
}

// 提取歌曲ID
function extractSongId(song) {
    return typeof song === "object" ? song.id : song;
}

// 异步包装器
async function safeAsync(fn, errorMsg) {
    try {
        return await fn();
    } catch (error) {
        console.error(errorMsg, error);
        return null;
    }
}

// 获取播放列表
async function getPlaylists() {
    const list = await safeAsync(() => window.electronAPI.getConfig("playlists", []), "获取播放列表配置失败");
    if (!Array.isArray(list)) return [];
    return list.map((playlist) => {
        if (!playlist.songs) playlist.songs = [];
        playlist.songs = playlist.songs.map((entry) => {
            if (typeof entry === "string") return entry;
            if (entry && entry.id) return entry.id;
            return "unknown";
        });
        return playlist;
    });
}

// 保存播放列表
async function savePlaylists(list) {
    await safeAsync(() => window.electronAPI.setConfig("playlists", list), "保存播放列表配置失败");
}

// 获取当前播放列表索引
async function getCurrentPlaylistIndex() {
    const idx = await safeAsync(() => window.electronAPI.getConfig("playlist", 0), "获取当前播放列表索引失败");
    return typeof idx === "number" ? idx : 0;
}

// 设置当前播放列表索引
async function setCurrentPlaylistIndex(idx) {
    await safeAsync(() => window.electronAPI.setConfig("playlist", idx), "设置当前播放列表索引失败");
}

async function ensurePlayHistoryPlaylist() {
    const list = await getPlaylists();
    if (!list.find((p) => p.name === "播放历史")) {
        list.push({ name: "播放历史", songs: [] });
        await savePlaylists(list);
    }
}

// 加载当前播放列表
async function loadCurrentPlaylist() {
    playlists = await getPlaylists();
    currentPlaylistIndex = await getCurrentPlaylistIndex();
    currentPlaylistSongs = currentPlaylistIndex >= 0 && currentPlaylistIndex < playlists.length ? playlists[currentPlaylistIndex].songs : [];
    updatePlaylistUI();
}

// 保存当前播放列表
async function saveCurrentPlaylist() {
    if (currentPlaylistIndex >= 0 && currentPlaylistIndex < playlists.length) {
        playlists[currentPlaylistIndex].songs = currentPlaylistSongs;
        await savePlaylists(playlists);
    }
}

// 添加歌曲到播放列表
async function addSongToPlaylist(song, playlistName = null) {
    const songId = song;
    if (playlistName) {
        const list = await getPlaylists();
        let playlist = list.find((p) => p.name === playlistName);
        if (!playlist) {
            playlist = { name: playlistName, songs: [] };
            list.push(playlist);
        }
        if (playlist.songs.some((s) => s === songId)) return;
        playlist.songs.push(songId);
        if (playlistName === "播放历史" && playlist.songs.length > 100) {
            playlist.songs.shift();
        }
        await savePlaylists(list);
        playlists = list;
        const playlistIdx = list.findIndex((p) => p.name === playlistName);
        if (playlistIdx !== -1 && currentPlaylistIndex === playlistIdx) {
            currentPlaylistSongs = playlist.songs;
            updatePlaylistUI();
        }
    } else {
        if (currentPlaylistSongs.some((s) => s === songId)) {
            console.log("歌曲已在当前播放列表中");
            return;
        }
        currentPlaylistSongs.push(songId);
        await saveCurrentPlaylist();
        updatePlaylistUI();
    }
}

// 添加到当前播放列表
async function addToCurrentPlaylist(song) {
    await addSongToPlaylist(song);
}

// 添加到播放历史
async function addToPlayHistory(song) {
    await addSongToPlaylist(song, "播放历史");
}

// 从当前播放列表中删除歌曲
async function removeFromCurrentPlaylist(index) {
    if (index < 0 || index >= currentPlaylistSongs.length) return;
    const removed = currentPlaylistSongs.splice(index, 1)[0];
    if (currentPlaylistIndex === index) {
        currentPlaylistIndex = -1;
    } else if (currentPlaylistIndex > index) {
        currentPlaylistIndex--;
    }
    await saveCurrentPlaylist();
    updatePlaylistUI();
}

// 播放当前播放列表中的歌曲
async function playPlaylistSong(index) {
    if (index < 0 || index >= currentPlaylistSongs.length) {
        return;
    }
    const songId = currentPlaylistSongs[index];
    currentPlaylistIndex = index;
    const songInfo = await window.musicApi.getSongInfo(songId);
    const titleEl = document.getElementById("song-title");
    if (titleEl) {
        titleEl.textContent = songInfo?.name || songId;
    }
    const artistEl = document.getElementById("song-artist");
    if (artistEl) {
        const artistText = songInfo?.artist ? (Array.isArray(songInfo.artist) ? songInfo.artist.join(" & ") : songInfo.artist) : "";
        artistEl.textContent = artistText;
    }
    await addToPlayHistory(songId);
    playSong(songId);
}

// 播放下一首
async function playNext() {
    if (currentPlaylistSongs.length === 0) return;
    const nextIndex = (currentPlaylistIndex + 1) % currentPlaylistSongs.length;
    await playPlaylistSong(nextIndex);
}

// 播放上一首
async function playPrev() {
    if (currentPlaylistSongs.length === 0) return;
    const prevIndex = (currentPlaylistIndex - 1 + currentPlaylistSongs.length) % currentPlaylistSongs.length;
    await playPlaylistSong(prevIndex);
}

// 切换播放列表
async function switchPlaylist(index) {
    if (index >= 0 && index < playlists.length) {
        currentPlaylistIndex = index;
        currentPlaylistSongs = playlists[index].songs;
        await setCurrentPlaylistIndex(index);
        updatePlaylistUI();
    }
}

// 创建播放列表选择器
function createPlaylistSelector(container) {
    const historyIdx = playlists.findIndex((p) => p.name === "播放历史");
    const playlistOptions = playlists
        .map((pl, idx) => ({ idx, pl, isHistory: idx === historyIdx }))
        .sort((a, b) => (a.isHistory ? -1 : b.isHistory ? 1 : 0))
        .map(({ pl }) => pl.name);
    
    // 选择器容器
    let selectContainer = document.getElementById("playlist-select-container");
    if (!selectContainer) {
        selectContainer = el("div", {
            id: "playlist-select-container",
            className: "custom-select-container",
            style: { marginBottom: "16px" },
        });
        selectContainer.appendChild(
            el("label", {
                textContent: "选择歌单: ",
                style: { marginRight: "8px" },
            }),
        );
        const customSelectDiv = el("div", {
            id: "playlist-selector-custom",
            style: { display: "inline-block" },
        });
        selectContainer.appendChild(customSelectDiv);
        container.appendChild(selectContainer);
        container.appendChild(el("br"));
    }
    
    let selectedIndex = 0;
    const sortedPlaylists = playlists.map((pl, idx) => ({ idx, pl, isHistory: idx === historyIdx })).sort((a, b) => (a.isHistory ? -1 : b.isHistory ? 1 : 0));
    for (let i = 0; i < sortedPlaylists.length; i++) {
        if (sortedPlaylists[i].idx === currentPlaylistIndex) {
            selectedIndex = i;
            break;
        }
    }
    
    // 如果已有 CustomSelect 实例，则更新选中索引
    if (playlistSelectCustom) {
        playlistSelectCustom.setValue(selectedIndex);
    } else {
        // 创建新的 CustomSelect 实例
        const customSelectDiv = document.getElementById("playlist-selector-custom");
        if (customSelectDiv) {
            playlistSelectCustom = new CustomSelect(customSelectDiv, playlistOptions, selectedIndex, (index) => {
                const originalIndex = sortedPlaylists[index].idx;
                switchPlaylist(originalIndex);
            });
        }
    }
}

function createSongRow(songId, index) {
    const titleCell = el("td", { textContent: songId });
    const artistCell = el("td", { textContent: "" });
    window.musicApi
        .getSongInfo(songId)
        .then((songInfo) => {
            if (songInfo) {
                titleCell.textContent = songInfo.name || songId;
                const artistText = songInfo.artist ? (Array.isArray(songInfo.artist) ? songInfo.artist.join(" & ") : songInfo.artist) : "";
                artistCell.textContent = artistText;
            }
        })
        .catch((err) => console.error("Failed to get song info for", songId, err));
    const actionCell = el("td", {}, [
        el("button", {
            textContent: "Play",
            onclick: () => playPlaylistSong(index),
        }),
        el("button", {
            textContent: "Delete",
            style: { marginLeft: "8px" },
            onclick: () => removeFromCurrentPlaylist(index),
        }),
    ]);
    return el(
        "tr",
        {
            style: { borderBottom: "1px solid #ddd" },
        },
        [titleCell, artistCell, actionCell],
    );
}

// 创建播放列表表格
function createPlaylistTable(container) {
    const headers = ["Title", "Artist", "Actions"].map((text) =>
        el("th", {
            textContent: text,
            "data-i18n": text,
        }),
    );
    const headerRow = el("tr", {}, headers);
    const thead = el("thead", {}, [headerRow]);
    const tbody = el(
        "tbody",
        {},
        currentPlaylistSongs.map((songId, idx) => createSongRow(songId, idx)),
    );
    const table = el(
        "table",
        {
            style: {
                width: "100%",
                borderCollapse: "collapse",
            },
        },
        [thead, tbody],
    );
    container.appendChild(table);
}

// 更新UI
function updatePlaylistUI() {
    const container = document.getElementById("content-playlist");
    if (!container) return;
    
    // 获取现有的选择器容器
    const selectContainer = document.getElementById("playlist-select-container");
    
    // 清空容器，但保留选择器容器（先将其从容器中移除）
    if (selectContainer) {
        container.removeChild(selectContainer);
    }
    // 清空剩余的子元素
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    // 添加标题
    container.appendChild(
        el("h2", {
            textContent: "Playlist",
            "data-i18n": "Playlist",
        }),
    );
    
    // 添加选择器（如果存在播放列表）
    if (playlists.length > 0) {
        if (selectContainer) {
            container.appendChild(selectContainer);
        } else {
            createPlaylistSelector(container);
        }
    }
    
    // 如果当前播放列表为空，显示提示
    if (currentPlaylistSongs.length === 0) {
        container.appendChild(
            el("p", {
                textContent: "Playlist is empty",
                style: {
                    textAlign: "center",
                    color: "#666",
                },
            }),
        );
        return;
    }
    
    // 创建播放列表表格
    createPlaylistTable(container);
}

// 页面加载时初始化播放列表
document.addEventListener("DOMContentLoaded", async () => {
    await ensurePlayHistoryPlaylist();
    await loadCurrentPlaylist();

    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    if (prevBtn) prevBtn.addEventListener("click", playPrev);
    if (nextBtn) nextBtn.addEventListener("click", playNext);

    if (typeof currentAudio !== "undefined") {
        currentAudio.addEventListener("ended", playNext);
    }
});
