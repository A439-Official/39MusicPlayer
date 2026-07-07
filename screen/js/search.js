function initSearch() {
    const searchInput = document.getElementById("search-input");
    const resultsContainer = document.getElementById("search-results-container");

    const indicator = (id, text) => {
        const el = document.createElement("div");
        el.id = id;
        el.className = "playlist-indicator";
        el.textContent = text;
        return el;
    };
    const removeIndicator = (id) => document.getElementById(id)?.remove();

    const search = async (q) => {
        try {
            return await window.musicApi.search(q);
        } catch (e) {
            console.error("Search error:", e);
            return [];
        }
    };

    const render = (songs) => {
        resultsContainer.innerHTML = "";
        if (!songs.length) {
            resultsContainer.appendChild(indicator("no-results", i18n("No results")));
            return;
        }
        songs.forEach((song) => {
            resultsContainer.appendChild(createSongItem(song, [{ label: i18n("Play"), callback: (id) => playSongl(id) }]));
        });
        removeIndicator("loading-indicator");
    };

    const execute = async () => {
        const q = searchInput.value.trim();
        if (!q) return;

        resultsContainer.innerHTML = "";
        resultsContainer.appendChild(indicator("loading-indicator", i18n("Loading")));

        try {
            const res = await search(q);
            render(res);
        } catch {
            removeIndicator("loading-indicator");
        }
    };

    searchInput.addEventListener("keypress", (e) => e.key === "Enter" && execute());
}
