function initializeDragAndDrop() {
    const items = document.querySelectorAll(".data-item");
    const mapTarget = document.getElementById("finland-map");
    const chartTarget = document.getElementById("statistics-chart");
    const status = document.getElementById("drag-drop-status");

    items.forEach(item => {
        item.addEventListener("dragstart", event => {
            event.dataTransfer.setData("text/plain", item.dataset.indicator);
            event.dataTransfer.effectAllowed = "copy";
            item.classList.add("dragging");
        });
        item.addEventListener("dragend", () => item.classList.remove("dragging"));
        item.addEventListener("click", event => {
            const action = event.target.closest("[data-target]");
            if (!action) return;
            event.preventDefault();
            applyIndicator(item.dataset.indicator, action.dataset.target);
        });
    });

    [mapTarget, chartTarget].forEach(target => {
        if (!target) return;
        target.classList.add("drag-drop-target");
        target.addEventListener("dragover", event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            target.classList.add("drag-over");
        });
        target.addEventListener("dragleave", event => {
            if (!target.contains(event.relatedTarget)) target.classList.remove("drag-over");
        });
        target.addEventListener("drop", event => {
            event.preventDefault();
            target.classList.remove("drag-over");
            const indicator = event.dataTransfer.getData("text/plain");
            if (indicator) applyIndicator(indicator, target.id === "finland-map" ? "map" : "chart");
        });
    });

    function applyIndicator(indicator, target) {
        const labels = typeof INDICATOR_LABELS !== "undefined" ? INDICATOR_LABELS : {};
        if (target === "map") {
            if (typeof updateMapLayer === "function") updateMapLayer(indicator);
            if (status) status.textContent = `${labels[indicator] || indicator} is now displayed on the map.`;
        } else if (target === "chart") {
            if (typeof updateStatisticsChart === "function") updateStatisticsChart(indicator);
            if (status) status.textContent = `${labels[indicator] || indicator} is now displayed on the chart.`;
        }
    }
}

document.addEventListener("DOMContentLoaded", initializeDragAndDrop);
