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

// 确保历史播放列表存在
async function ensurePlayHistoryPlaylist() {
    const list = await getPlaylists();
    if (!list.find((p) => p.name === "History")) {
        list.push({ name: "History", songs: [] });
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
        if (playlistName === "History" && playlist.songs.length > 100) {
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

// 添加到历史播放列表
async function addToPlayHistory(song) {
    await addSongToPlaylist(song, "History");
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
    if (index < 0 || index >= currentPlaylistSongs.length) return;
    const songId = currentPlaylistSongs[index];
    currentPlaylistIndex = index;
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

// 获取播放列表
function getSortedPlaylists() {
    const historyIdx = playlists.findIndex((p) => p.name === "History");
    return playlists.map((pl, idx) => ({ idx, pl, isHistory: idx === historyIdx })).sort((a, b) => (a.isHistory ? -1 : b.isHistory ? 1 : 0));
}

// 查找选中索引
function findSelectedIndex(sortedPlaylists) {
    for (let i = 0; i < sortedPlaylists.length; i++) {
        if (sortedPlaylists[i].idx === currentPlaylistIndex) {
            return i;
        }
    }
    return 0;
}

// 创建播放列表选择器
function createPlaylistSelector(container) {
    const sortedPlaylists = getSortedPlaylists();
    const playlistOptions = sortedPlaylists.map(({ pl }) => pl.name);
    const selectedIndex = findSelectedIndex(sortedPlaylists);

    // 选择器容器
    let selectContainer = document.getElementById("playlist-select-container");
    if (!selectContainer) {
        selectContainer = el("div", {
            id: "playlist-select-container",
            className: "custom-select-container",
        });
        selectContainer.appendChild(
            el("label", {
                textContent: "选择歌单: ",
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

// 创建歌曲列表项
function createSongListItem(songId, index) {
    const listItem = el("div", {
        className: "song-list-item",
        "data-song-id": songId,
    });

    // 歌曲信息容器
    const infoContainer = el("div");
    const titleEl = el("div", { className: "song-title", textContent: songId });
    const artistEl = el("div", { className: "song-artist", textContent: "加载中..." });

    // 异步加载歌曲信息
    window.musicApi
        .getSongInfo(songId)
        .then((songInfo) => {
            if (songInfo) {
                titleEl.textContent = songInfo.name || songId;
                const artistText = songInfo.artist ? (Array.isArray(songInfo.artist) ? songInfo.artist.join(" & ") : songInfo.artist) : "";
                artistEl.textContent = artistText || "未知艺术家";
            }
        })
        .catch((err) => console.error("Failed to get song info for", songId, err));

    infoContainer.appendChild(titleEl);
    infoContainer.appendChild(artistEl);

    // 操作按钮容器
    const actionContainer = el("div");
    const playButton = el("button", {
        className: "play-button",
        textContent: "播放",
        onclick: () => playPlaylistSong(index),
    });
    const deleteButton = el("button", {
        className: "delete-button",
        textContent: "删除",
        onclick: () => removeFromCurrentPlaylist(index),
    });

    actionContainer.appendChild(playButton);
    actionContainer.appendChild(deleteButton);

    listItem.appendChild(infoContainer);
    listItem.appendChild(actionContainer);

    return listItem;
}

// 更新播放列表UI
function updatePlaylistUI() {
    const container = document.getElementById("content-playlist");
    if (!container) return;

    // 1. 确保标题存在
    let titleEl = document.getElementById("playlist-title");
    if (!titleEl) {
        titleEl = el("h2", {
            id: "playlist-title",
            textContent: "播放列表",
            "data-i18n": "Playlist",
        });
        container.appendChild(titleEl);
    }

    // 2. 确保选择器存在并更新选中索引
    let selectContainer = document.getElementById("playlist-select-container");
    if (playlists.length > 0) {
        if (!selectContainer) {
            createPlaylistSelector(container);
        } else {
            selectContainer.style.display = "block";
            const sortedPlaylists = getSortedPlaylists();
            const selectedIndex = findSelectedIndex(sortedPlaylists);
            if (playlistSelectCustom) {
                playlistSelectCustom.setValue(selectedIndex);
            } else {
                createPlaylistSelector(container);
            }
        }
    } else if (selectContainer) {
        selectContainer.style.display = "none";
    }

    // 3. 确保空提示元素存在
    let emptyMsgEl = document.getElementById("playlist-empty-msg");
    if (!emptyMsgEl) {
        emptyMsgEl = el("div", {
            id: "playlist-empty-msg",
            className: "empty-message",
            textContent: "播放列表为空，请添加歌曲",
            "data-i18n": "Playlist is empty",
        });
        container.appendChild(emptyMsgEl);
    }

    // 4. 确保列表容器存在
    let listContainer = document.getElementById("playlist-list-container");
    if (currentPlaylistSongs.length === 0) {
        if (listContainer) listContainer.style.display = "none";
        emptyMsgEl.style.display = "block";
        return;
    }

    emptyMsgEl.style.display = "none";
    if (!listContainer) {
        listContainer = el("div", { id: "playlist-list-container" });
        container.appendChild(listContainer);
    } else {
        listContainer.style.display = "flex";
    }

    // 清空现有列表项
    while (listContainer.firstChild) {
        listContainer.removeChild(listContainer.firstChild);
    }

    // 添加新列表项
    currentPlaylistSongs
        .slice()
        .reverse()
        .forEach((songId, idx) => {
            const originalIndex = currentPlaylistSongs.length - 1 - idx;
            listContainer.appendChild(createSongListItem(songId, originalIndex));
        });

    // 移除最后一个列表项的分隔线
    const items = listContainer.querySelectorAll(".song-list-item");
    if (items.length > 0) {
        items[items.length - 1].style.borderBottom = "none";
    }
}

// 保存播放状态
async function savePlaybackState() {
    try {
        const playbackState = {
            songId: currentSongId,
            currentTime: currentAudio ? currentAudio.currentTime : 0,
            playlistIndex: currentPlaylistIndex,
            paused: currentAudio ? currentAudio.paused : true,
            timestamp: Date.now()
        };
        
        await safeAsync(() => window.electronAPI.setConfig("playbackState", playbackState), "保存播放状态失败");
        console.log("播放状态已保存:", playbackState);
    } catch (error) {
        console.error("保存播放状态时出错:", error);
    }
}

// 加载播放状态
async function loadPlaybackState() {
    try {
        const playbackState = await safeAsync(() => window.electronAPI.getConfig("playbackState", null), "加载播放状态失败");
        
        if (!playbackState || !playbackState.songId) {
            console.log("无保存的播放状态");
            return false;
        }
        
        console.log("加载播放状态:", playbackState);
        
        // 恢复播放列表索引
        if (playbackState.playlistIndex !== undefined && playbackState.playlistIndex >= 0) {
            currentPlaylistIndex = playbackState.playlistIndex;
            if (currentPlaylistIndex < playlists.length) {
                currentPlaylistSongs = playlists[currentPlaylistIndex].songs;
                await setCurrentPlaylistIndex(currentPlaylistIndex);
            }
        }
        
        // 恢复播放歌曲
        if (playbackState.songId && currentPlaylistSongs.includes(playbackState.songId)) {
            const songIndex = currentPlaylistSongs.indexOf(playbackState.songId);
            if (songIndex !== -1) {
                currentPlaylistIndex = songIndex;

                await loadSongWithoutPlay(playbackState.songId, playbackState.currentTime);
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error("加载播放状态时出错:", error);
        return false;
    }
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
    
    // 加载上次播放状态
    await loadPlaybackState();
});

// 加载歌曲但不播放（用于恢复播放状态）
async function loadSongWithoutPlay(songId, seekTime = 0) {
    try {
        // 清理之前的blob URL
        if (currentBlobUrl && currentBlobUrl.startsWith("blob:")) {
            URL.revokeObjectURL(currentBlobUrl);
            if (window.musicApi && window.musicApi.revokeBlobUrl && currentSongId) {
                window.musicApi.revokeBlobUrl(currentSongId);
            }
            currentBlobUrl = null;
        }
        
        currentSongId = songId;
        
        // 获取歌曲URL
        const songData = await window.musicApi.getSongUrl(songId);
        if (currentSongId !== songId || !songData?.url) {
            if (!songData?.url) {
                console.error("Failed to get song URL:", songData);
            }
            return;
        }
        
        // 获取歌曲信息
        const songInfo = await window.musicApi.getSongInfo(songId);
        if (currentSongId === songId) {
            const titleEl = document.getElementsByClassName("data-title");
            for (const el of titleEl) {
                el.textContent = songInfo?.name || songId;
            }
            const artistText = songInfo?.artist ? (Array.isArray(songInfo.artist) ? songInfo.artist.join(" & ") : songInfo.artist) : "";
            const artistEl = document.getElementsByClassName("data-artist");
            for (const el of artistEl) {
                el.textContent = artistText;
            }
            const coverEl = document.getElementsByClassName("data-cover");
            for (const el of coverEl) {
                el.src = songInfo?.pic || "";
            }
        }
        
        // 设置音频源
        currentAudio.src = songData.url;
        if (songData.url && songData.url.startsWith("blob:")) {
            currentBlobUrl = songData.url;
        }
        
        currentAudio.load();
        setupSeekBar();
        
        // 等待音频加载完成
        await new Promise((resolve, reject) => {
            const loadedHandler = function onLoadedMetadata() {
                currentAudio.removeEventListener("loadedmetadata", loadedHandler);
                currentAudio.removeEventListener("error", errorHandler);
                
                const fixedDuration = Math.floor(currentAudio.duration);
                if (totalTimeEl) {
                    totalTimeEl.textContent = formatTime(fixedDuration);
                }
                if (seekBar) {
                    seekBar.max = fixedDuration;
                    seekBar.value = seekTime;
                }
                if (currentTimeEl) {
                    currentTimeEl.textContent = formatTime(seekTime);
                }
                
                // 设置播放位置
                if (seekTime > 0 && currentAudio.duration > 0) {
                    const safeSeekTime = Math.min(seekTime, currentAudio.duration - 1);
                    currentAudio.currentTime = safeSeekTime;
                }
                
                // 确保暂停状态
                if (!currentAudio.paused) {
                    currentAudio.pause();
                }
                
                // 更新暂停按钮状态
                const pauseBtn = document.getElementById("pause-btn");
                if (pauseBtn) {
                    pauseBtn.innerHTML = `
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    `;
                }
                
                resolve();
            };
            
            const errorHandler = function onError(e) {
                currentAudio.removeEventListener("loadedmetadata", loadedHandler);
                currentAudio.removeEventListener("error", errorHandler);
                reject(new Error("Failed to load audio metadata"));
            };
            
            currentAudio.addEventListener("loadedmetadata", loadedHandler);
            currentAudio.addEventListener("error", errorHandler);
        });
        
        // 加载歌词
        loadLyrics(songId);
        
        // 添加时间更新监听器
        currentAudio.addEventListener("timeupdate", updateSeekBar);
        
        console.log("歌曲加载完成（不播放）:", songId, "位置:", seekTime);
    } catch (error) {
        console.error("加载歌曲失败:", error);
    }
}

// 在窗口关闭前保存播放状态
if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
        savePlaybackState();
    });
    
    window.addEventListener("pagehide", () => {
        savePlaybackState();
    });
}
