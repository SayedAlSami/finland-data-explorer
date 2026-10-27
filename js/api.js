const STATISTICS_API =
    "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/11ra.px";

const EMPLOYMENT_API =
    "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/tyokay/115b.px";

// Load population data for 2025.
async function loadPopulationData() {
    try {
        const metadataResponse = await fetch(STATISTICS_API);

        if (!metadataResponse.ok) {
            throw new Error(
                `Population metadata request failed: ${metadataResponse.status}`
            );
        }

        const metadata = await metadataResponse.json();

        const areaVariable = metadata.variables.find(
            variable => variable.text === "Area"
        );

        const contentVariable = metadata.variables.find(
            variable => variable.text === "Information"
        );

        const yearVariable = metadata.variables.find(
            variable => variable.text === "Year"
        );

        if (!areaVariable || !contentVariable || !yearVariable) {
            throw new Error("Could not identify population table variables.");
        }

        const municipalityCodes = areaVariable.values.filter(
            code => /^KU\d{3}$/.test(code)
        );

        const populationCode = contentVariable.values.find(
            (code, index) =>
                contentVariable.valueTexts[index] === "Population 31 Dec"
        );

        if (!populationCode || !yearVariable.values.includes("2025")) {
            throw new Error("Population data for 2025 is unavailable.");
        }

        const query = {
            query: [
                {
                    code: areaVariable.code,
                    selection: {
                        filter: "item",
                        values: municipalityCodes
                    }
                },
                {
                    code: contentVariable.code,
                    selection: {
                        filter: "item",
                        values: [populationCode]
                    }
                },
                {
                    code: yearVariable.code,
                    selection: {
                        filter: "item",
                        values: ["2025"]
                    }
                }
            ],
            response: {
                format: "json-stat2"
            }
        };

        const dataResponse = await fetch(STATISTICS_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(query)
        });

        if (!dataResponse.ok) {
            throw new Error(
                `Population request failed: ${dataResponse.status}`
            );
        }

        const dataset = await dataResponse.json();

        const values = extractMunicipalityValues(
            dataset,
            areaVariable.code,
            municipalityCodes
        );

        console.log("Population data loaded:", Object.keys(values).length);
        console.log("Example population data:", values.KU005);

        return values;

    } catch (error) {
        console.error("Could not load population data:", error);
        throw error;
    }
}

// Load employment or unemployment data for the latest year in table 115b.
async function loadEmploymentData() {
    try {
        const metadataResponse = await fetch(EMPLOYMENT_API);

        if (!metadataResponse.ok) {
            throw new Error(
                `Employment metadata request failed: ${metadataResponse.status}`
            );
        }

        const metadata = await metadataResponse.json();

        const findVariable = name =>
            metadata.variables.find(variable => variable.text === name);

        const areaVariable = findVariable("Area");
        const activityVariable = findVariable("Main type of activity");
        const sexVariable = findVariable("Sex");
        const ageVariable = findVariable("Age");
        const yearVariable = findVariable("Year");
        const informationVariable = findVariable("Information");

        if (
            !areaVariable ||
            !activityVariable ||
            !sexVariable ||
            !ageVariable ||
            !yearVariable ||
            !informationVariable
        ) {
            throw new Error(
                "Could not identify all employment table variables."
            );
        }

        const municipalityCodes = areaVariable.values.filter(
            code => /^KU\d{3}$/.test(code)
        );

        const findCodeByText = (variable, text) =>
            variable.values.find(
                (code, index) => variable.valueTexts[index] === text
            );

        const employedCode = findCodeByText(
            activityVariable,
            "Employed"
        );

        const unemployedCode = findCodeByText(
            activityVariable,
            "Unemployed"
        );

        const totalSexCode = findCodeByText(sexVariable, "Total");
        const totalAgeCode = findCodeByText(ageVariable, "Total");

        const informationCode = findCodeByText(
            informationVariable,
            "Population 31 Dec"
        );

        if (
            !employedCode ||
            !unemployedCode ||
            !totalSexCode ||
            !totalAgeCode ||
            !informationCode
        ) {
            throw new Error(
                "Could not identify employment categories in the API metadata."
            );
        }

        // Use the latest year actually listed in the API metadata.
        const availableYears = yearVariable.values
            .filter(year => /^\d{4}$/.test(year))
            .sort();

        const year = availableYears[availableYears.length - 1];

        if (!year) {
            throw new Error("No employment reporting year is available.");
        }

        const commonSelections = [
            {
                code: areaVariable.code,
                selection: {
                    filter: "item",
                    values: municipalityCodes
                }
            },
            {
                code: sexVariable.code,
                selection: {
                    filter: "item",
                    values: [totalSexCode]
                }
            },
            {
                code: ageVariable.code,
                selection: {
                    filter: "item",
                    values: [totalAgeCode]
                }
            },
            {
                code: yearVariable.code,
                selection: {
                    filter: "item",
                    values: [year]
                }
            },
            {
                code: informationVariable.code,
                selection: {
                    filter: "item",
                    values: [informationCode]
                }
            }
        ];

        async function requestActivity(activityCode) {
            const query = {
                query: [
                    ...commonSelections,
                    {
                        code: activityVariable.code,
                        selection: {
                            filter: "item",
                            values: [activityCode]
                        }
                    }
                ],
                response: {
                    format: "json-stat2"
                }
            };

            const response = await fetch(EMPLOYMENT_API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(query)
            });

            if (!response.ok) {
                throw new Error(
                    `Employment data request failed: ${response.status}`
                );
            }

            const dataset = await response.json();

            return extractMunicipalityValues(
                dataset,
                areaVariable.code,
                municipalityCodes
            );
        }

        const [employed, unemployed] = await Promise.all([
            requestActivity(employedCode),
            requestActivity(unemployedCode)
        ]);

        console.log("Employment reporting year:", year);
        console.log("Employed municipalities:", Object.keys(employed).length);
        console.log("Unemployed municipalities:", Object.keys(unemployed).length);
        console.log("Example employed value:", employed.KU005);
        console.log("Example unemployed value:", unemployed.KU005);

        return {
            year,
            employed,
            unemployed
        };

    } catch (error) {
        console.error("Could not load employment data:", error);
        throw error;
    }
}

// Read JSON-stat2 values using the dimension order returned by the API.
function extractMunicipalityValues(dataset, areaCode, municipalityCodes) {
    const areaDimension = dataset.dimension[areaCode];

    if (!areaDimension || !dataset.id || !dataset.size) {
        throw new Error("The API returned an unexpected JSON-stat2 dataset.");
    }

    const areaIndex = areaDimension.category.index;
    const values = {};

    for (const code of municipalityCodes) {
        const municipalityIndex = areaIndex[code];

        if (municipalityIndex === undefined) {
            continue;
        }

        let flatIndex = 0;
        let validIndex = true;

        for (let dimensionPosition = 0;
            dimensionPosition < dataset.id.length;
            dimensionPosition++) {

            const dimensionCode = dataset.id[dimensionPosition];
            const dimension = dataset.dimension[dimensionCode];

            let categoryIndex;

            if (dimensionCode === areaCode) {
                categoryIndex = municipalityIndex;
            } else {
                const categories = Object.keys(dimension.category.index);
                categoryIndex = dimension.category.index[categories[0]];
            }

            if (categoryIndex === undefined) {
                validIndex = false;
                break;
            }

            flatIndex =
                flatIndex * dataset.size[dimensionPosition] + categoryIndex;
        }

        if (!validIndex) {
            continue;
        }

        const value = dataset.value[flatIndex];

        if (value !== null && value !== undefined) {
            values[code] = Number(value);
        }
    }

    return values;
}
