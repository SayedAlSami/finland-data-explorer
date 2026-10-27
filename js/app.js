// Small application-wide enhancements that do not own the map, charts or analysis logic.
document.addEventListener("DOMContentLoaded", () => {
    // Keep sidebar navigation's active state in sync with the clicked section.
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
            link.classList.add("active");
        });
    });

    // Mark external data-source links as safe new-tab links.
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
        link.rel = "noopener noreferrer";
    });
});
