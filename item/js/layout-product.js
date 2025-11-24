// // Product Profile
// function createProfileObject(sourceData) {
//     return {
//     "itemName": sourceData.itemName,
//     "sections": [
//         { "name": "Global Warming Potential", "value": sourceData.valueGlobalWarmingPotential },
//         { "name": "ghgunits", "value": sourceData.ghgunits },
//         {
//             "name": "Total Something",
//             "value": sourceData.valueTotalFat,
//             "dailyValue": calculateDailyValue(sourceData.valueTotalFat, 'fat'),
//             "subsections": [
//                 { "name": "Something", "value": sourceData.valueSatFat, "dailyValue": calculateDailyValue(sourceData.valueSatFat, 'satFat') },
//                 { "name": "Something 2", "value": sourceData.valueTransFat }
//             ]
//         },
//     ]
//     }
// }

// Product Profile

function toNumber(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const m = value.match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : null;
    }
    return null;
}

function createProfileObject(sourceData) {
    // Use the best available name from the YAML
    const itemName =
        sourceData.name ||
        (sourceData.product_specific && sourceData.product_specific.product_name) ||
        "Product";

    // Main GWP values from the YAML
    const gwp = toNumber(sourceData.gwp);
    const gwpAdj = toNumber(sourceData.uncertainty_adjusted_gwp);

    // Declared unit for the product
    const declaredUnit =
        sourceData.declared_unit ||
        sourceData.category_declared_unit ||
        (sourceData.category && sourceData.category.declared_unit) ||
        "";

    const sections = [];

    // Primary GWP line
    if (gwp !== null) {
        let label = "Global Warming Potential";
        if (declaredUnit) {
            label += " (kgCO2e / " + declaredUnit + ")";
        } else {
            label += " (kgCO2e)";
        }
        sections.push({
            name: label,
            value: gwp
        });
    }

    // Optional uncertainty-adjusted GWP
    if (gwpAdj !== null && gwpAdj !== gwp) {
        let label = "Uncertainty-adjusted GWP";
        if (declaredUnit) {
            label += " (kgCO2e / " + declaredUnit + ")";
        } else {
            label += " (kgCO2e)";
        }
        sections.push({
            name: label,
            value: gwpAdj
        });
    }

    // Return in the exact shape renderNutritionLabel expects
    return {
        itemName,
        sections
    };
}
