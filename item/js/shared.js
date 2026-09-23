// shared.js - Common utilities for food and product labels
// Shared between label.js and label-product.js

// ============================================
// Parsing Utilities
// ============================================

function parseNumeric(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const m = value.match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : NaN;
    }
    return NaN;
}

function toNumber(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const m = value.match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : null;
    }
    return null;
}

// ============================================
// Formatting Utilities
// ============================================

function formatValue(value, name, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return "0";
    const n = name ? name.toLowerCase() : "";
    if (n.includes("calories") || n.includes("gwp") || n.includes("warming")) {
        return Math.round(value).toString();
    }
    return value.toFixed(decimals);
}

function formatKg(value) {
    if (value === null || value === undefined || isNaN(value)) return "0.0";
    return value.toFixed(1);
}

function formatPercent(value) {
    if (value === null || value === undefined || isNaN(value)) return "0";
    return Math.round(value).toString();
}

// ============================================
// Unit Utilities
// ============================================

function getUnit(nutrientName) {
    const name = (nutrientName || "").toLowerCase();
    if (name.includes("calories")) return "";
    if (name.includes("gwp") || name.includes("warming") || name.includes("co2")) return " kgCO2e";
    if (name.includes("energy")) return " MJ";
    if (name.includes("water")) return " L";
    if (name.includes("percent") || name.includes("%")) return "%";
    if (name.includes("sodium") || name.includes("potassium") ||
        name.includes("calcium") || name.includes("iron") ||
        name.includes("vitamin d") || name.includes("cholesterol") ||
        name.includes("caffeine")) return "mg";
    if (name.includes("mass") || name.includes("weight")) return " kg";
    if (name.includes("density")) return " kg/m\u00b3";
    return "g";
}

// ============================================
// Impact Rating System (Environmental Badge Style)
// ============================================

// Impact thresholds for different metrics (can be customized)
const IMPACT_THRESHOLDS = {
    gwp: { low: 2, medium: 5, high: 15 },           // kgCO2e/unit
    energy: { low: 20, medium: 50, high: 100 },     // MJ/unit
    water: { low: 10, medium: 50, high: 200 },      // L/unit
    percentile: { low: 25, medium: 50, high: 75 }   // percentile rank
};

function getImpactRating(value, metricType) {
    const thresholds = IMPACT_THRESHOLDS[metricType] || IMPACT_THRESHOLDS.gwp;
    if (value <= thresholds.low) return { level: "low", color: "#22c55e", label: "Low Impact" };
    if (value <= thresholds.medium) return { level: "medium", color: "#f59e0b", label: "Moderate Impact" };
    if (value <= thresholds.high) return { level: "high", color: "#f97316", label: "High Negative Impact" };
    return { level: "very-high", color: "#ef4444", label: "Very High Negative Impact" };
}

// 5-point Carbon Footprint scale, keyed by the same percentile rank
// (10/20/.../90/95) that getGWPPercentileRank/getPercentileRating use, so
// this label lines up with the category-relative rating shown elsewhere.
function getCarbonFootprintLabel(percentileRank) {
    const rank = Number(percentileRank);
    if (!isFinite(rank)) return "";
    if (rank <= 20) return "Best Carbon Footprint";
    if (rank <= 40) return "Low Carbon Footprint";
    if (rank <= 60) return "Medium Carbon Footprint";
    if (rank <= 80) return "High Carbon Footprint";
    return "Highest Carbon Footprint";
}

// Computes p10...p90 GWP thresholds (nearest-rank method) from a list of
// raw GWP values, e.g. every product's gwp column in a category CSV.
function computeGWPPercentiles(values) {
    const sorted = (values || [])
        .filter(v => v !== null && v !== undefined && isFinite(v))
        .sort((a, b) => a - b);
    if (sorted.length === 0) return {};

    const percentiles = {};
    [10, 20, 30, 40, 50, 60, 70, 80, 90].forEach(decile => {
        const index = Math.min(sorted.length, Math.ceil((decile / 100) * sorted.length)) - 1;
        percentiles[`p${decile}`] = sorted[Math.max(0, index)];
    });
    return percentiles;
}

// Finds which decile bucket a value falls into against a category's own
// pct10_gwp...pct90_gwp thresholds (category-relative, not a fixed scale).
function getGWPPercentileRank(value, percentiles) {
    percentiles = percentiles || {};
    for (const decile of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
        const threshold = percentiles[`p${decile}`];
        if (threshold !== null && threshold !== undefined && value <= threshold) {
            return decile;
        }
    }
    return 95;
}

// True when at least one category percentile threshold is available
function hasGWPPercentileData(percentiles) {
    if (!percentiles) return false;
    return [10, 20, 30, 40, 50, 60, 70, 80, 90].some(decile =>
        percentiles[`p${decile}`] !== null && percentiles[`p${decile}`] !== undefined
    );
}

function getPercentileRating(percentile) {
    if (percentile <= 20) return { level: "excellent", color: "#22c55e", label: "In top 20% best products" };
    if (percentile <= 40) return { level: "good", color: "#84cc16", label: "In top 40% best products" };
    if (percentile <= 60) return { level: "average", color: "#f59e0b", label: "Product is average in range" };
    if (percentile <= 80) return { level: "below-average", color: "#f97316", label: "Within 40% worse impacts" };
    return { level: "poor", color: "#ef4444", label: "Within 20% worse impacts" };
}

// ============================================
// Daily Value Calculations (for food labels)
// ============================================

const dailyValueReferences = {
    fat: 65,
    satFat: 20,
    cholesterol: 300,
    sodium: 2400,
    carb: 300,
    fiber: 25,
    addedSugars: 50,
    vitaminD: 20,
    calcium: 1300,
    iron: 18,
    potassium: 4700
};

function calculateDailyValue(value, type) {
    const base = dailyValueReferences[type];
    return base ? ((value / base) * 100).toFixed(0) : null;
}

// ============================================
// Average Impact Benchmarks (for product labels)
// ============================================

const averageImpactBenchmarks = {
    gwp: 10,          // kgCO2e per m2 (building materials average)
    energy: 50,       // MJ per m2
    water: 100,       // L per m2
    waste: 5          // kg per m2
};

function calculateImpactPercentOfAverage(value, type) {
    const base = averageImpactBenchmarks[type];
    return base ? ((value / base) * 100).toFixed(0) : null;
}

// ============================================
// Style Settings Management
// ============================================

const LABEL_STYLES = {
    FDA: "fda",
    BADGE: "badge"
};

const VERBOSITY_LEVELS = {
    SIMPLE: "simple",
    MEDIUM: "medium",
    DETAILED: "detailed"
};

const CALCULATOR_UNITS = {
    DECLARED: "declared",
    PER_KG: "per_kg",
    PER_1000: "per_1000"
};

// Default settings stored in localStorage
function getLabelSettings() {
    const defaults = {
        style: LABEL_STYLES.FDA,
        verbosity: VERBOSITY_LEVELS.MEDIUM,
        calculatorUnit: CALCULATOR_UNITS.DECLARED
    };

    try {
        const stored = localStorage.getItem("labelSettings");
        if (stored) {
            return { ...defaults, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn("Could not read label settings from localStorage:", e);
    }
    return defaults;
}

function saveLabelSettings(settings) {
    try {
        localStorage.setItem("labelSettings", JSON.stringify(settings));
    } catch (e) {
        console.warn("Could not save label settings to localStorage:", e);
    }
}

function updateLabelSetting(key, value) {
    const settings = getLabelSettings();
    settings[key] = value;
    saveLabelSettings(settings);
    return settings;
}

// ============================================
// Settings UI Components
// ============================================

function createSettingsToggle(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const verbosityToggle = createVerbosityToggle(onChange);
    container.appendChild(verbosityToggle);
    return verbosityToggle;
}

function createStyleToggle(onChange) {
    const settings = getLabelSettings();
    const styleToggle = document.createElement("div");
    styleToggle.className = "style-toggle";
    styleToggle.innerHTML = `
        <button class="style-btn sm-btn ${settings.style === 'fda' ? 'active' : ''}" data-style="fda">
            <span class="btn-icon">\u2630</span> Label
        </button>
        <button class="style-btn sm-btn ${settings.style === 'badge' ? 'active' : ''}" data-style="badge">
            <span class="btn-icon">\ud83c\udf3f</span> Badge
        </button>
    `;

    styleToggle.querySelectorAll(".style-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            styleToggle.querySelectorAll(".style-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const newSettings = updateLabelSetting("style", btn.dataset.style);
            if (onChange) onChange(newSettings);
        });
    });

    return styleToggle;
}

function createVerbosityToggle(onChange) {
    const settings = getLabelSettings();
    const verbosityToggle = document.createElement("div");
    verbosityToggle.className = "verbosity-toggle";
    verbosityToggle.innerHTML = `
        <button class="verbosity-btn sm-btn ${settings.verbosity === 'simple' ? 'active' : ''}" data-verbosity="simple">
            Simple
        </button>
        <button class="verbosity-btn sm-btn ${settings.verbosity === 'medium' ? 'active' : ''}" data-verbosity="medium">
            Medium
        </button>
        <button class="verbosity-btn sm-btn ${settings.verbosity === 'detailed' ? 'active' : ''}" data-verbosity="detailed">
            Detailed
        </button>
    `;

    verbosityToggle.querySelectorAll(".verbosity-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            verbosityToggle.querySelectorAll(".verbosity-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const newSettings = updateLabelSetting("verbosity", btn.dataset.verbosity);
            if (onChange) onChange(newSettings);
        });
    });

    return verbosityToggle;
}

function createCalculatorUnitDropdown(defaultUnit, onChange) {
    const settings = getLabelSettings();
    const currentUnit = settings.calculatorUnit || defaultUnit || CALCULATOR_UNITS.DECLARED;

    const wrapper = document.createElement("div");
    wrapper.className = "calculator-unit-dropdown";
    wrapper.innerHTML = `
        <label>Calculate per:</label>
        <select class="unit-select">
            <option value="declared" ${currentUnit === 'declared' ? 'selected' : ''}>Declared Unit</option>
            <option value="per_kg" ${currentUnit === 'per_kg' ? 'selected' : ''}>Per Kg</option>
            <option value="per_1000" ${currentUnit === 'per_1000' ? 'selected' : ''}>Per $1000</option>
        </select>
    `;

    const select = wrapper.querySelector(".unit-select");
    select.addEventListener("change", () => {
        const newSettings = updateLabelSetting("calculatorUnit", select.value);
        if (onChange) onChange(select.value, newSettings);
    });

    return wrapper;
}

// ============================================
// Info Icon Click Handler (Global Event Delegation)
// ============================================

function initInfoIconHandlers() {
    // Use event delegation for dynamically created info icons
    document.addEventListener('click', function(e) {
        const infoIcon = e.target.closest('.info-icon');

        if (infoIcon) {
            e.preventDefault();
            e.stopPropagation();

            // If this icon is already active, close it
            if (infoIcon.classList.contains('active')) {
                infoIcon.classList.remove('active');
            } else {
                // Close all other open tooltips
                document.querySelectorAll('.info-icon.active').forEach(icon => {
                    icon.classList.remove('active');
                });
                // Open this tooltip
                infoIcon.classList.add('active');
            }
        } else {
            // Click outside - close all tooltips
            document.querySelectorAll('.info-icon.active').forEach(icon => {
                icon.classList.remove('active');
            });
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInfoIconHandlers);
} else {
    initInfoIconHandlers();
}

// ============================================
// URL Hash Utilities
// ============================================

function getUrlHash() {
    return (function (pairs) {
        if (pairs === "") return {};
        var result = {};
        pairs.forEach(function(pair) {
            var keyValue = pair.split('=');
            var key = keyValue[0];
            var value = keyValue.slice(1).join('=');
            value = value.replace(/%26/g, '&');
            result[key] = value;
        });
        return result;
    })(window.location.hash.substr(1).split('&'));
}

// ============================================
// GitHub API Utilities
// ============================================

function getShortUrlName(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        const shortPath = pathParts.slice(0, 2).join('/');
        return `${urlObj.hostname}/${shortPath}${pathParts.length > 2 ? '/...' : ''}`;
    } catch (e) {
        // If URL parsing fails, just return the url as-is
        return url;
    }
}

async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) {
        const error = new Error(`HTTP error ${r.status}: ${r.statusText}`);
        error.status = r.status;
        error.statusText = r.statusText;
        error.url = url;
        throw error;
    }
    return r.json();
}

async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) {
        const error = new Error(`HTTP error ${r.status}: ${r.statusText}`);
        error.status = r.status;
        error.statusText = r.statusText;
        error.url = url;
        throw error;
    }
    return r.text();
}

// ============================================
// Export for module systems (optional)
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseNumeric,
        toNumber,
        formatValue,
        formatKg,
        formatPercent,
        getUnit,
        getImpactRating,
        getPercentileRating,
        calculateDailyValue,
        calculateImpactPercentOfAverage,
        LABEL_STYLES,
        VERBOSITY_LEVELS,
        CALCULATOR_UNITS,
        getLabelSettings,
        saveLabelSettings,
        updateLabelSetting,
        createSettingsToggle,
        createCalculatorUnitDropdown,
        getUrlHash,
        getShortUrlName,
        fetchJSON,
        fetchText,
        dailyValueReferences,
        averageImpactBenchmarks,
        IMPACT_THRESHOLDS
    };
}
