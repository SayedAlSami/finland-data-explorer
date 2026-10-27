let statisticsChart = null;

function getTopMunicipalities(data, limit = 10) {
    return Object.entries(data || {})
        .filter(([, value]) => Number.isFinite(Number(value)))
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, limit);
}

function getMunicipalityNames() {
    if (typeof getMunicipalityNameMap === "function") return getMunicipalityNameMap();
    const names = {};
    if (typeof municipalityLayer !== "undefined" && municipalityLayer) {
        municipalityLayer.eachLayer(layer => {
            const properties = layer.feature?.properties || {};
            if (properties.kunta != null) names["KU" + String(properties.kunta).padStart(3, "0")] = properties.nimi || properties.namn || properties.name || "Unknown municipality";
        });
    }
    return names;
}

function getChartDataset(indicator) {
    const labels = typeof INDICATOR_LABELS !== "undefined" ? INDICATOR_LABELS : {};
    const data = typeof getIndicatorData === "function" ? getIndicatorData(indicator) : {};
    const colors = {
        population: "#2563eb", employment: "#16a34a", unemployment: "#dc2626",
        "employment-rate": "#7c3aed", "unemployment-rate": "#d97706"
    };
    return {
        data,
        title: `Top 10 Municipalities by ${labels[indicator] || indicator}`,
        year: indicator === "population" ? "2025" : employmentYear,
        color: colors[indicator] || "#2563eb",
        indicator
    };
}

function updateStatisticsChart(indicatorOverride) {
    const chartElement = document.getElementById("statistics-chart");
    if (!chartElement) return;
    if (typeof frappe === "undefined" || !frappe.Chart) {
        chartElement.textContent = "The chart library could not be loaded.";
        return;
    }

    const selector = document.getElementById("chart-indicator-select");
    const indicator = indicatorOverride || (selector ? selector.value : "population");
    if (selector && indicatorOverride) selector.value = indicatorOverride;
    const dataset = getChartDataset(indicator);
    const title = document.getElementById("chart-title");
    if (title) title.textContent = `${dataset.title} (${dataset.year})`;

    const names = getMunicipalityNames();
    const topMunicipalities = getTopMunicipalities(dataset.data);
    if (!topMunicipalities.length) {
        chartElement.innerHTML = '<div class="chart-placeholder">Waiting for statistical data to load.</div>';
        return;
    }
    const labels = topMunicipalities.map(([code]) => names[code] || code);
    const values = topMunicipalities.map(([, value]) => Number(value));
    chartElement.innerHTML = "";
    try {
        statisticsChart = new frappe.Chart("#statistics-chart", {
            data: { labels, datasets: [{ name: dataset.title, values }] },
            type: "bar", height: 320, colors: [dataset.color],
            axisOptions: { xAxisMode: "tick", yAxisMode: "span", xIsSeries: true },
            barOptions: { spaceRatio: 0.3 },
            tooltipOptions: { formatTooltipY: value => `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}${indicator.includes("rate") ? "%" : ""}` }
        });
        chartElement.dataset.indicator = indicator;
        chartElement.dataset.chartTitle = title ? title.textContent : dataset.title;
    } catch (error) {
        console.error("Could not create chart:", error);
        chartElement.textContent = "The chart could not be displayed.";
    }
}

function initializeCharts() {
    const selector = document.getElementById("chart-indicator-select");
    if (selector) selector.addEventListener("change", () => updateStatisticsChart());
    const waitForData = setInterval(() => {
        if (typeof populationData !== "undefined" && Object.keys(populationData).length && typeof municipalityLayer !== "undefined" && municipalityLayer) {
            clearInterval(waitForData);
            updateStatisticsChart();
        }
    }, 300);
    document.getElementById("download-chart-svg")?.addEventListener("click", () => downloadChartSVG("statistics-chart", "finland-data-explorer-chart.svg"));
    document.getElementById("download-chart-png")?.addEventListener("click", () => downloadChartPNG("statistics-chart", "finland-data-explorer-chart.png"));
}

function getChartSVG(containerId) {
    const container = document.getElementById(containerId);
    return container?.querySelector("svg") || null;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadChartSVG(containerId, filename) {
    const svg = getChartSVG(containerId);
    if (!svg) {
        alert("There is no chart to download yet. Wait for the data to load first.");
        return;
    }
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!clone.getAttribute("width")) clone.setAttribute("width", "1000");
    if (!clone.getAttribute("height")) clone.setAttribute("height", "600");
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = "text { font-family: Arial, sans-serif; }";
    clone.insertBefore(style, clone.firstChild);
    downloadBlob(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }), filename);
}

async function downloadChartPNG(containerId, filename) {
    const svg = getChartSVG(containerId);
    if (!svg) {
        alert("There is no chart to download yet. Wait for the data to load first.");
        return;
    }
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const box = svg.getBoundingClientRect();
    clone.setAttribute("width", Math.max(800, Math.ceil(box.width)));
    clone.setAttribute("height", Math.max(400, Math.ceil(box.height)));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.src = url;
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
        const canvas = document.createElement("canvas");
        canvas.width = Number(clone.getAttribute("width"));
        canvas.height = Number(clone.getAttribute("height"));
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(result => result ? downloadBlob(result, filename) : alert("Could not export PNG."), "image/png");
    } catch (error) {
        console.error("PNG export failed:", error);
        alert("PNG export failed. Try downloading the SVG instead.");
    } finally {
        URL.revokeObjectURL(url);
    }
}

document.addEventListener("DOMContentLoaded", initializeCharts);
