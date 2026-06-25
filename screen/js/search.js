function initSearch() {
    const searchInput = document.getElementById("search-input");
    const resultsContainer = document.getElementById("search-results-container");
    const contentSearch = document.getElementById("content-search");
    const limit = 30;
    let page = 0,
        query = "",
        loading = false,
        hasMore = true;

    const indicator = (id, text) => {
        const el = document.createElement("div");
        el.id = id;
        el.className = "playlist-indicator";
        el.textContent = text;
        return el;
    };
    const removeIndicator = (id) => document.getElementById(id)?.remove();

    const search = async (q, p) => {
        loading = true;
        try {
            const res = await window.musicApi.search(q, limit, p);
            hasMore = res.length === limit;
            return res;
        } catch (e) {
            console.error("Search error:", e);
            return [];
        } finally {
            loading = false;
        }
    };

    const render = (songs, clear = true) => {
        if (clear) resultsContainer.innerHTML = "";
        if (!songs.length && clear) return;
        songs.forEach((song) => {
            resultsContainer.appendChild(createSongItem(song.id, [{ label: i18n("Play"), callback: (id) => playSongl(id) }]));
        });
        removeIndicator("loading-indicator");
        if (!hasMore && page > 0) {
            resultsContainer.appendChild(indicator("no-more-results", i18n("No more results")));
        }
    };

    const loadMore = async () => {
        if (loading || !hasMore || !query) return;
        removeIndicator("loading-indicator");
        resultsContainer.appendChild(indicator("loading-indicator", i18n("Loading")));
        page++;
        try {
            const res = await search(query, page);
            render(res, false);
        } catch {
            removeIndicator("loading-indicator");
        }
    };

    const execute = async () => {
        const q = searchInput.value.trim();
        if (!q) return;
        query = q;
        page = 0;
        hasMore = true;
        resultsContainer.innerHTML = "";
        resultsContainer.appendChild(indicator("loading-indicator", i18n("Loading")));
        try {
            const res = await search(query, 0);
            render(res, true);
        } catch {
            removeIndicator("loading-indicator");
        }
    };

    const debounce = (fn, delay) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    };

    const checkScroll = () => {
        if (!contentSearch || !query || loading || !hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = contentSearch;
        if (scrollHeight - scrollTop - clientHeight < 512) loadMore();
    };

    searchInput.addEventListener("keypress", (e) => e.key === "Enter" && execute());
    contentSearch?.addEventListener("scroll", debounce(checkScroll, 150));
}
