function initializeCombinedAnalysis() {
    const button = document.getElementById("run-combination-button");
    const status = document.getElementById("combine-status");
    if (!button) return;
    button.addEventListener("click", runCombination);
    document.getElementById("download-combined-svg")?.addEventListener("click", () => downloadChartSVG("combined-chart", "finland-combined-indicator.svg"));

    function runCombination() {
        const aName = document.getElementById("combine-indicator-a").value;
        const bName = document.getElementById("combine-indicator-b").value;
        const operation = document.getElementById("combine-operation").value;
        const aData = getIndicatorData(aName);
        const bData = getIndicatorData(bName);
        const labels = INDICATOR_LABELS;
        const resultData = {};
        const codes = new Set([...Object.keys(aData), ...Object.keys(bData)]);

        for (const code of codes) {
            const a = Number(aData[code]);
            const b = Number(bData[code]);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            let value;
            if (operation === "add") value = a + b;
            else if (operation === "subtract") value = a - b;
            else if (operation === "multiply") value = a * b;
            else {
                if (b === 0) continue;
                value = a / b;
            }
            if (Number.isFinite(value)) resultData[code] = value;
        }

        const names = getMunicipalityNames();
        const top = getTopMunicipalities(resultData, 10);
        const operatorLabels = { add: "+", subtract: "−", multiply: "×", divide: "÷" };
        const operationLabel = operatorLabels[operation];
        const titleText = `${labels[aName]} ${operationLabel} ${labels[bName]} · Top 10 municipalities`;
        document.getElementById("combined-chart-title").textContent = titleText;
        const container = document.getElementById("combined-chart");
        container.innerHTML = "";

        if (!top.length) {
            container.textContent = "No municipalities have valid values for both selected indicators.";
            if (status) status.textContent = "No combined results were available. Try another pair of indicators.";
            return;
        }
        if (typeof frappe === "undefined" || !frappe.Chart) {
            container.textContent = "The chart library could not be loaded.";
            return;
        }
        new frappe.Chart("#combined-chart", {
            data: {
                labels: top.map(([code]) => names[code] || code),
                datasets: [{ name: titleText, values: top.map(([, value]) => Number(value)) }]
            },
            type: "bar", height: 300, colors: ["#7c3aed"],
            axisOptions: { xAxisMode: "tick", yAxisMode: "span", xIsSeries: true },
            barOptions: { spaceRatio: 0.3 },
            tooltipOptions: { formatTooltipY: value => Number(value).toLocaleString("en-US", { maximumFractionDigits: 4 }) }
        });
        container.dataset.resultCount = String(Object.keys(resultData).length);
        if (status) status.textContent = `Combined ${Object.keys(resultData).length} municipalities. Operation: ${labels[aName]} ${operationLabel} ${labels[bName]}.`;
    }
}

document.addEventListener("DOMContentLoaded", initializeCombinedAnalysis);
