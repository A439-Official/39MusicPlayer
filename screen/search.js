

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
        return fetch(`https://ncm.zhenxin.me/cloudsearch?&limit=${limit}&offset=${page * limit}&keywords=${encodeURIComponent(query)}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                if (data.code !== 200) {
                    console.error("API error:", data);
                    return [];
                }
                const total = data.result?.songCount || 0;
                const currentResults = page * limit + (data.result?.songs?.length || 0);
                hasMore = currentResults < total;
                const results = [];
                for (const item of data.result?.songs || []) {
                    const song = {
                        id: item.id.toString(),
                        name: item.name,
                        artist: item.ar ? item.ar.map((artist) => artist.name) : [],
                        album: item.al?.name || "",
                        pic: item.al?.picUrl || "",
                        privilege: item.privilege
                            ? {
                                  pl: item.privilege.pl,
                                  dl: item.privilege.dl,
                                  st: item.privilege.st,
                              }
                            : {},
                        status: "",
                    };
                    results.push(song);
                }
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

    // 搜索结果
    function renderResults(results, clear = true) {
        if (clear) {
            searchResultsBody.innerHTML = "";
        }

        if (results.length === 0 && clear) {
            return;
        }

        results.forEach((song) => {
            const row = document.createElement("tr");
            const titleCell = document.createElement("td");
            titleCell.textContent = song.name;
            row.appendChild(titleCell);
            const artistCell = document.createElement("td");
            artistCell.textContent = song.artist.join(" & ");
            row.appendChild(artistCell);
            // Action cell with play button
            const actionCell = document.createElement("td");
            const playButton = document.createElement("button");
            playButton.textContent = "播放";
            playButton.addEventListener("click", () => {
                // Update song info in footer
                const titleEl = document.getElementById('song-title');
                const artistEl = document.getElementById('song-artist');
                if (titleEl) titleEl.textContent = song.name;
                if (artistEl) artistEl.textContent = song.artist.join(" & ");
                // Play the song
                playSong(song.id);
            });
            actionCell.appendChild(playButton);
            row.appendChild(actionCell);
            searchResultsBody.appendChild(row);
        });
        const oldLoader = document.getElementById("loading-indicator");
        if (oldLoader) {
            oldLoader.remove();
        }
        if (!hasMore && currentPage > 0) {
            const noMoreRow = document.createElement("tr");
            noMoreRow.id = "no-more-results";
            const noMoreCell = document.createElement("td");
            noMoreCell.colSpan = 3;
            noMoreCell.textContent = "没有更多结果了";
            noMoreCell.style.textAlign = "center";
            noMoreCell.style.padding = "10px";
            noMoreCell.style.color = "#666";
            noMoreRow.appendChild(noMoreCell);
            searchResultsBody.appendChild(noMoreRow);
        }
    }

    // 添加加载指示器
    function addLoadingIndicator() {
        const oldLoader = document.getElementById("loading-indicator");
        if (oldLoader) {
            oldLoader.remove();
        }

        const loadingRow = document.createElement("tr");
        loadingRow.id = "loading-indicator";
        const loadingCell = document.createElement("td");
        loadingCell.colSpan = 3;
        loadingCell.textContent = "加载中...";
        loadingCell.style.textAlign = "center";
        loadingCell.style.padding = "10px";
        loadingCell.style.color = "#666";
        loadingRow.appendChild(loadingCell);
        searchResultsBody.appendChild(loadingRow);
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
