document.addEventListener("DOMContentLoaded", () => {
    // Tab switching
    const tabs = document.querySelectorAll(".tab-title");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab-title.active, .tab-content.active").forEach((el) => el.classList.remove("active"));
            tab.classList.add("active");
            const tabName = tab.id.replace("tab-", "");
            document.getElementById(`content-${tabName}`)?.classList.add("active");
        });
    });

    // Search functionality
    const searchInput = document.getElementById("search-input");
    const searchResultsBody = document.getElementById("search-results-body");

    // Mock search function (to be replaced with actual IPC call)
    function performSearch(query) {
        // Simulate API delay
        return new Promise((resolve) => {
            setTimeout(() => {
                // Mock data based on main.py's search results structure
                const mockResults = [
                    {
                        id: "12345",
                        name: "Song One",
                        artist: ["Artist A", "Artist B"],
                        status: "" // empty means not downloaded
                    },
                    {
                        id: "67890",
                        name: "Song Two",
                        artist: ["Artist C"],
                        status: "Downloaded" // already downloaded
                    },
                    {
                        id: "11121",
                        name: "Song Three",
                        artist: ["Artist D", "Artist E", "Artist F"],
                        status: "Error: Network issue" // error state
                    },
                    {
                        id: "31415",
                        name: "Song Four",
                        artist: ["Artist G"],
                        status: "" // not downloaded
                    }
                ];
                resolve(mockResults);
            }, 500);
        });
    }

    // Render search results table
    function renderResults(results) {
        searchResultsBody.innerHTML = "";
        
        // No results - display empty table (no message)
        if (results.length === 0) {
            return;
        }

        results.forEach(song => {
            const row = document.createElement("tr");
            
            // Title column
            const titleCell = document.createElement("td");
            titleCell.textContent = song.name;
            row.appendChild(titleCell);
            
            // Artist column
            const artistCell = document.createElement("td");
            artistCell.textContent = song.artist.join(" & ");
            row.appendChild(artistCell);
            
            // No Action column as per user request
            searchResultsBody.appendChild(row);
        });
    }

    // Execute search with current input value
    function executeSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            // No status display since search-status is removed
            return;
        }
        
        searchResultsBody.innerHTML = ""; // Clear previous results
        
        performSearch(query)
            .then(results => {
                renderResults(results);
            })
            .catch(error => {
                console.error("Search error:", error);
            });
    }

    // Allow pressing Enter to search
    searchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            executeSearch();
        }
    });
});
