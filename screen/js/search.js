document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-input");
    const searchResultsBody = document.getElementById("search-results-body");
    let currentPage = 0;
    let currentQuery = "";
    let isLoading = false;
    let hasMore = true;
    const limit = 30;

    // 进行搜索
    function performSearch(query, page = 0) {
        isLoading = true;
        return window.musicApi
            .search(query, limit, page)
            .then((results) => {
                hasMore = results.length === limit;
                return results;
            })
            .catch((error) => {
                console.error("Search error:", error);
                return [];
            })
            .finally(() => {
                isLoading = false;
            });
    }

    // 创建表格行
    function createSongRow(song) {
        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = song.name;
        row.appendChild(titleCell);

        const artistCell = document.createElement("td");
        artistCell.textContent = song.artist.join(" & ");
        row.appendChild(artistCell);

        const actionCell = document.createElement("td");

        // 播放按钮
        const playButton = document.createElement("button");
        playButton.textContent = "播放";
        playButton.addEventListener("click", () => handlePlaySong(song));
        actionCell.appendChild(playButton);

        // 添加到播放列表按钮
        const addToPlaylistButton = document.createElement("button");
        addToPlaylistButton.textContent = "添加到播放列表";
        addToPlaylistButton.style.marginLeft = "8px";
        addToPlaylistButton.addEventListener("click", async () => {
            try {
                await addToCurrentPlaylist(song);
                alert("已添加到播放列表");
            } catch (error) {
                console.error("Failed to add song to playlist", error);
                alert("添加失败");
            }
        });
        actionCell.appendChild(addToPlaylistButton);
        row.appendChild(actionCell);
        return row;
    }

    async function handlePlaySong(song) {
        try {
            const playlists = await getPlaylists();
            const historyIdx = playlists.findIndex((p) => p.name === "播放历史");
            if (historyIdx !== -1 && currentPlaylistIndex !== historyIdx) {
                await switchPlaylist(historyIdx);
            }
        } catch (error) {
            console.error("Failed to switch to history playlist", error);
        }
        playSong(song.id);
    }

    // 创建指示器行
    function createIndicatorRow(id, text) {
        const row = document.createElement("tr");
        row.id = id;
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.textContent = text;
        cell.style.textAlign = "center";
        cell.style.padding = "10px";
        cell.style.color = "#666";
        row.appendChild(cell);
        return row;
    }

    // 移除指示器
    function removeIndicator(id) {
        const indicator = document.getElementById(id);
        if (indicator) indicator.remove();
    }

    // 搜索结果
    function renderResults(results, clear = true) {
        if (clear) {
            searchResultsBody.innerHTML = "";
        }

        if (results.length === 0 && clear) {
            return;
        }

        results.forEach((song) => {
            searchResultsBody.appendChild(createSongRow(song));
        });

        removeIndicator("loading-indicator");

        if (!hasMore && currentPage > 0) {
            searchResultsBody.appendChild(createIndicatorRow("no-more-results", "没有更多结果了"));
        }
    }

    // 添加加载指示器
    function addLoadingIndicator() {
        removeIndicator("loading-indicator");
        searchResultsBody.appendChild(createIndicatorRow("loading-indicator", "加载中..."));
    }

    // 更多
    function loadMore() {
        if (isLoading || !hasMore || !currentQuery) {
            return;
        }
        addLoadingIndicator();
        currentPage++;
        performSearch(currentQuery, currentPage)
            .then((results) => {
                renderResults(results, false);
            })
            .catch((error) => {
                console.error("Load more error:", error);
                const loader = document.getElementById("loading-indicator");
                if (loader) {
                    loader.remove();
                }
            });
    }

    // 搜索
    function executeSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            return;
        }
        currentQuery = query;
        currentPage = 0;
        hasMore = true;
        isLoading = false;
        searchResultsBody.innerHTML = "";
        addLoadingIndicator();
        performSearch(query, 0)
            .then((results) => {
                renderResults(results, true);
            })
            .catch((error) => {
                console.error("Search error:", error);
                const loader = document.getElementById("loading-indicator");
                if (loader) {
                    loader.remove();
                }
            });
    }

    // 检查是否滚动到底部
    function checkScroll() {
        if (!contentSearch) {
            return;
        }

        if (!currentQuery || isLoading || !hasMore) {
            return;
        }

        const scrollTop = contentSearch.scrollTop;
        const scrollHeight = contentSearch.scrollHeight;
        const clientHeight = contentSearch.clientHeight;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;

        if (distanceToBottom < 512) {
            loadMore();
        }
    }

    // 防抖
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    searchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            executeSearch();
        }
    });

    const contentSearch = document.getElementById("content-search");
    if (contentSearch) {
        const debouncedCheckScroll = debounce(checkScroll, 150);
        contentSearch.addEventListener("scroll", debouncedCheckScroll);
    }
});
