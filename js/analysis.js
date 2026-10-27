function initializeAnalysis() {
    const indicatorSelect = document.getElementById("analysis-indicator-select");
    const operationSelect = document.getElementById("analysis-operation-select");
    const runButton = document.getElementById("run-analysis-button");
    const resultsContainer = document.getElementById("analysis-results");
    if (!indicatorSelect || !operationSelect || !runButton || !resultsContainer) return;

    const cards = [...document.querySelectorAll(".toolbox-item")];
    const cardOperations = ["total", "average", "top10"];
    runButton.addEventListener("click", runAnalysis);

    cards.forEach((card, index) => {
        const operation = cardOperations[index];
        if (!operation) return;
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-pressed", "false");
        const select = () => {
            operationSelect.value = operation;
            cards.forEach(item => {
                item.classList.remove("selected");
                item.setAttribute("aria-pressed", "false");
            });
            card.classList.add("selected");
            card.setAttribute("aria-pressed", "true");
            resultsContainer.innerHTML = "<p>Operation selected. Choose an indicator and click Run Analysis.</p>";
        };
        card.addEventListener("click", select);
        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); }
        });
    });
    operationSelect.addEventListener("change", () => cards.forEach((card, index) => {
        const selected = cardOperations[index] === operationSelect.value;
        card.classList.toggle("selected", selected);
        card.setAttribute("aria-pressed", String(selected));
    }));

    function runAnalysis() {
        const indicator = indicatorSelect.value;
        const operation = operationSelect.value;
        const data = typeof getIndicatorData === "function" ? getIndicatorData(indicator) : {};
        const labels = typeof INDICATOR_LABELS !== "undefined" ? INDICATOR_LABELS : {};
        const indicatorName = labels[indicator] || indicator;
        if (!data || !Object.keys(data).length) {
            resultsContainer.textContent = "Statistical data is not available yet. Please wait and try again.";
            return;
        }
        const names = getAnalysisMunicipalityNames();
        const entries = Object.entries(data).filter(([, value]) => value !== null && value !== "" && Number.isFinite(Number(value)))
            .map(([code, value]) => ({ code, name: names[code] || code, value: Number(value) }));
        if (!entries.length) { resultsContainer.textContent = "No valid statistical values were found."; return; }

        if (operation === "top10") {
            const topTen = [...entries].sort((a, b) => b.value - a.value).slice(0, 10);
            resultsContainer.innerHTML = `<div class="analysis-result-card"><h3>Top 10 Municipalities by ${escapeAnalysisHTML(indicatorName)}</h3><p>Ranking based on ${entries.length} municipalities.</p><ol class="analysis-ranking-list">${topTen.map(item => `<li><span>${escapeAnalysisHTML(item.name)}</span><strong>${formatAnalysisNumber(item.value, indicator)}</strong></li>`).join("")}</ol></div>`;
            return;
        }
        const values = entries.map(item => item.value);
        let result, operationName;
        if (operation === "average") { result = values.reduce((sum, value) => sum + value, 0) / values.length; operationName = "Average"; }
        else if (operation === "total") { result = values.reduce((sum, value) => sum + value, 0); operationName = "Total"; }
        else if (operation === "minimum") { result = Math.min(...values); operationName = "Minimum"; }
        else if (operation === "maximum") { result = Math.max(...values); operationName = "Maximum"; }
        else { resultsContainer.textContent = "Please select a valid operation."; return; }
        const matching = entries.find(item => item.value === result);
        resultsContainer.innerHTML = `<div class="analysis-result-card"><h3>${operationName} ${escapeAnalysisHTML(indicatorName)}</h3><p class="analysis-result-value">${formatAnalysisNumber(result, indicator)}</p><p>Based on ${entries.length} municipalities.</p>${(operation === "minimum" || operation === "maximum") && matching ? `<p>Municipality: <strong>${escapeAnalysisHTML(matching.name)}</strong></p>` : ""}</div>`;
    }
}

function getAnalysisMunicipalityNames() {
    if (typeof getMunicipalityNameMap === "function") return getMunicipalityNameMap();
    const names = {};
    if (typeof municipalityLayer !== "undefined" && municipalityLayer) municipalityLayer.eachLayer(layer => {
        const p = layer.feature?.properties || {};
        if (p.kunta != null) names["KU" + String(p.kunta).padStart(3, "0")] = p.nimi || p.namn || p.name || "Unknown municipality";
    });
    return names;
}
function formatAnalysisNumber(value, indicator = "") {
    const formatted = Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
    return String(indicator).includes("rate") ? `${formatted}%` : formatted;
}
function escapeAnalysisHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
document.addEventListener("DOMContentLoaded", initializeAnalysis);
