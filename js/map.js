let finlandMap;
let municipalityLayer;
let populationData = {};
let employmentData = {};
let unemploymentData = {};
let employmentYear = "2024";
let currentMapLayer = "population";

const municipalityGeoJSONUrl =
    "https://geo.stat.fi/geoserver/tilastointialueet/wfs" +
    "?service=WFS&version=2.0.0&request=GetFeature" +
    "&typeName=tilastointialueet%3Akunta4500k" +
    "&outputFormat=application%2Fjson&srsName=EPSG%3A4326";

const INDICATOR_LABELS = {
    population: "Population",
    employment: "Employed people",
    unemployment: "Unemployed people",
    "employment-rate": "Employment / population (%)",
    "unemployment-rate": "Unemployment / (employment + unemployment) (%)"
};

function getMunicipalityCode(feature) {
    const code = feature?.properties?.kunta;
    return code === undefined || code === null ? null : "KU" + String(code).padStart(3, "0");
}

function getMunicipalityName(feature) {
    const properties = feature?.properties || {};
    return properties.nimi || properties.namn || properties.name || "Municipality";
}

// Return one indicator dataset. Rates are derived by merging datasets from the two StatFin tables.
function getIndicatorData(indicator) {
    if (indicator === "population") return populationData;
    if (indicator === "employment") return employmentData;
    if (indicator === "unemployment") return unemploymentData;

    const derived = {};
    const codes = new Set([
        ...Object.keys(populationData),
        ...Object.keys(employmentData),
        ...Object.keys(unemploymentData)
    ]);

    for (const code of codes) {
        const population = Number(populationData[code]);
        const employed = Number(employmentData[code]);
        const unemployed = Number(unemploymentData[code]);

        if (indicator === "employment-rate" && population > 0 && Number.isFinite(employed)) {
            derived[code] = (employed / population) * 100;
        } else if (
            indicator === "unemployment-rate" &&
            Number.isFinite(employed) && Number.isFinite(unemployed) &&
            employed + unemployed > 0
        ) {
            derived[code] = (unemployed / (employed + unemployed)) * 100;
        }
    }
    return derived;
}

function getSelectedValue(feature) {
    const code = getMunicipalityCode(feature);
    if (!code) return null;
    const value = getIndicatorData(currentMapLayer)[code];
    return Number.isFinite(value) ? value : null;
}

function getSelectedYear() {
    return currentMapLayer === "population" ? "2025" : employmentYear;
}

function getSelectedLabel() {
    return INDICATOR_LABELS[currentMapLayer] || "Statistical value";
}

function getColourThresholds() {
    const values = Object.values(getIndicatorData(currentMapLayer))
        .filter(Number.isFinite).sort((a, b) => a - b);
    if (!values.length) return [];
    return [0.2, 0.4, 0.6, 0.8].map(p => values[Math.min(values.length - 1, Math.floor(p * values.length))]);
}

function getMapColour(value, thresholds) {
    if (!Number.isFinite(value) || !thresholds.length) return "#d1d5db";
    if (value <= thresholds[0]) return "#eff6ff";
    if (value <= thresholds[1]) return "#bfdbfe";
    if (value <= thresholds[2]) return "#60a5fa";
    if (value <= thresholds[3]) return "#2563eb";
    return "#1e3a8a";
}

function getMunicipalityStyle(feature) {
    return {
        color: "#ffffff",
        weight: 1,
        opacity: 1,
        fillColor: getMapColour(getSelectedValue(feature), getColourThresholds()),
        fillOpacity: 0.9
    };
}

function formatMapValue(value, indicator = currentMapLayer) {
    if (!Number.isFinite(value)) return "Data unavailable";
    const formatted = Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
    return indicator.includes("rate") ? `${formatted}%` : formatted;
}

function showMunicipalityInfo(feature, layer) {
    const name = getMunicipalityName(feature);
    const value = getSelectedValue(feature);
    const code = getMunicipalityCode(feature);
    layer.bindTooltip(name);
    layer.bindPopup(
        `<div class="map-popup"><strong>${escapeHTML(name)}</strong>` +
        `<br>${escapeHTML(getSelectedLabel())} (${getSelectedYear()}): ${formatMapValue(value)}` +
        `<br><button type="button" class="popup-details-button" onclick="openMunicipalityDetails('${code}')">View municipality profile</button></div>`
    );
    layer.off("click");
    layer.on("click", () => openMunicipalityDetails(code));
}

function updateMapLayer(indicator) {
    if (indicator) currentMapLayer = indicator;
    const selector = document.getElementById("map-layer-select");
    if (selector && !indicator) currentMapLayer = selector.value;
    if (selector && indicator) selector.value = indicator;

    if (municipalityLayer) {
        municipalityLayer.setStyle(getMunicipalityStyle);
        municipalityLayer.eachLayer(layer => showMunicipalityInfo(layer.feature, layer));
    }
    const legendText = document.getElementById("map-legend-text");
    if (legendText) legendText.textContent = `${getSelectedLabel()} (${getSelectedYear()})`;
    console.log("Selected map layer:", currentMapLayer);
}

async function initializeMap() {
    const mapElement = document.getElementById("finland-map");
    if (!mapElement || typeof L === "undefined") {
        console.error("Map container or Leaflet library is missing.");
        return;
    }

    finlandMap = L.map("finland-map").setView([64.5, 26], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(finlandMap);

    try {
        populationData = await loadPopulationData();
        const employmentResult = await loadEmploymentData();
        employmentYear = employmentResult.year;
        employmentData = employmentResult.employed;
        unemploymentData = employmentResult.unemployed;
        updateSummaryCards();
        console.log("Data loaded", {
            population: Object.keys(populationData).length,
            employment: Object.keys(employmentData).length,
            unemployment: Object.keys(unemploymentData).length
        });
    } catch (error) {
        console.error("Some statistical data could not be loaded:", error);
        showAppStatus(`Statistics could not be loaded: ${error.message}`);
    }

    try {
        const response = await fetch(municipalityGeoJSONUrl);
        if (!response.ok) throw new Error(`Map request failed: ${response.status}`);
        const geojson = await response.json();
        municipalityLayer = L.geoJSON(geojson, {
            style: getMunicipalityStyle,
            onEachFeature: showMunicipalityInfo
        }).addTo(finlandMap);

        if (municipalityLayer.getLayers().length) {
            const bounds = municipalityLayer.getBounds();
            if (bounds.isValid()) finlandMap.fitBounds(bounds, { padding: [10, 10] });
            setTimeout(() => finlandMap.invalidateSize(), 200);
        }
        console.log("Municipality boundaries loaded:", municipalityLayer.getLayers().length);
        updateMapLayer();
        if (typeof updateStatisticsChart === "function") updateStatisticsChart();
    } catch (error) {
        console.error("Could not load municipality boundaries:", error);
        mapElement.insertAdjacentHTML("beforeend", '<p class="map-error">Could not load the map. Check the browser console and internet connection.</p>');
    }

    const selector = document.getElementById("map-layer-select");
    if (selector) selector.addEventListener("change", () => updateMapLayer());
}

function updateSummaryCards() {
    const populationTotal = sumValues(populationData);
    const employmentTotal = sumValues(employmentData);
    const unemploymentTotal = sumValues(unemploymentData);
    setText("population-summary", populationTotal ? populationTotal.toLocaleString("en-US") : "Unavailable");
    setText("employment-summary", employmentTotal ? employmentTotal.toLocaleString("en-US") : "Unavailable");
    setText("unemployment-summary", unemploymentTotal ? unemploymentTotal.toLocaleString("en-US") : "Unavailable");
}

function sumValues(data) {
    return Object.values(data || {}).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
}
function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}
function showAppStatus(message) {
    const status = document.getElementById("drag-drop-status");
    if (status) status.textContent = message;
}
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Called by the popup and the map click handler. It opens a municipality profile with its own chart.
function openMunicipalityDetails(code) {
    if (!code) return;
    const details = document.getElementById("municipality-details");
    const title = document.getElementById("municipality-details-title");
    const summary = document.getElementById("municipality-detail-summary");
    const chartContainer = document.getElementById("municipality-detail-chart");
    if (!details || !summary || !chartContainer) return;

    const nameMap = getMunicipalityNameMap();
    const name = nameMap[code] || code;
    const indicators = ["population", "employment", "unemployment", "employment-rate", "unemployment-rate"];
    title.textContent = `${name} — statistical profile`;
    summary.innerHTML = indicators.map(indicator => {
        const value = getIndicatorData(indicator)[code];
        return `<article class="detail-stat-card"><span>${escapeHTML(INDICATOR_LABELS[indicator])}</span><strong>${formatMapValue(value, indicator)}</strong><small>${indicator === "population" ? "2025" : employmentYear}</small></article>`;
    }).join("");
    details.hidden = false;

    if (typeof frappe !== "undefined" && frappe.Chart) {
        chartContainer.innerHTML = "";
        const labels = ["Population", "Employment", "Unemployment"];
        const values = [populationData[code], employmentData[code], unemploymentData[code]].map(value => Number.isFinite(value) ? value : 0);
        new frappe.Chart("#municipality-detail-chart", {
            data: { labels, datasets: [{ name, values }] },
            type: "bar", height: 260, colors: ["#2365d8"],
            tooltipOptions: { formatTooltipY: value => Number(value).toLocaleString("en-US") }
        });
    } else {
        chartContainer.textContent = "The chart library is unavailable.";
    }
    details.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getMunicipalityNameMap() {
    const names = {};
    if (municipalityLayer) municipalityLayer.eachLayer(layer => {
        const code = getMunicipalityCode(layer.feature);
        if (code) names[code] = getMunicipalityName(layer.feature);
    });
    return names;
}

document.addEventListener("DOMContentLoaded", () => {
    initializeMap();
    const closeButton = document.getElementById("close-municipality-details");
    if (closeButton) closeButton.addEventListener("click", () => {
        document.getElementById("municipality-details").hidden = true;
    });
});
