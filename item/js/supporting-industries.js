// supporting-industries.js - Top 10 Industries Supplying Production
// The industries supplying a USEEIO summary sector in a state, ranked by a factor, from the
// 2020 USEEIO state models (EPA) or the Exiobase trade tables split among states (UN).
// Used by the product label (label-product.js, opened from a Geolocations state) and by
// profile/footprint (below the commodities report, for the selected commodity).
// Needs localsite.js (loadScript, getHash, goHashQuiet).

const SUPPORTING_INDUSTRIES_COUNT = 10;
// Same published 2020 state models that profile/footprint loads (js/config.js)
const USEEIO_STATE_MODEL_ENDPOINT = "https://raw.githubusercontent.com/ModelEarth/useeio-json/main/models/2020";
// States with a {ST}EEIOv1.0-s-20 model at that endpoint (all 50; DC has none)
const USEEIO_STATE_MODELS = new Set(("AK AL AR AZ CA CO CT DE FL GA HI IA ID IL IN KS KY LA MA MD " +
    "ME MI MN MO MS MT NC ND NE NH NJ NM NV NY OH OK OR PA RI SC SD TN TX UT VA VT WA WI WV WY").split(" "));
// The state models have no energy indicator, so Energy Use comes from the national model
// at that endpoint, averaged from its detail sectors up to the state models' summary sectors.
const USEEIO_NATIONAL_MODEL = "USEEIOv2.0.1-411";

// Factor dropdown above the Top 10 ranking, keyed by the "factor" hash value (amt, co2, water
// and emp match the trade map's factor keys). Amount Spent ranks the purchases in dollars.
// EPA (USEEIO): the others weight each purchase by its supplier's indicator per dollar: the
// N matrix (supply chain total) for impacts and jobs, and the D matrix (the supplier's own
// share) for value added, since N's value added is about $1 per $1 for every sector. Value
// added counts only US production, so foreign imports add none.
// UN (Exiobase): "un" lists the factor_id columns in factor.csv that a factor sums, each times
// its weight (unit conversions, and AR5 100-year warming potentials for greenhouse gases).
// A factor without "un" is EPA only; one with epa: false is UN only. Exiobase energy
// (factor_id 907) has no values in the trade_factor tables, so Energy Use is EPA only.
const SUPPORTING_INDUSTRIES_FACTORS = {
    amt: { label: "Amount Spent", amount: true, un: {} },
    co2: { label: "Greenhouse Gases", noun: "greenhouse gases", indicator: "GHG", matrix: "N", unit: "t CO₂ eq", scale: 0.001, // kg to t
        un: { factors: { 901: 0.001, 902: 0.028, 903: 0.265, 904: 23.5, 905: 0.001 },
            note: "carbon dioxide, methane (×28), nitrous oxide (×265), sulfur hexafluoride (×23,500) and HFCs and PFCs (factor_id 901 to 905)" } },
    energy: { label: "Energy Use", noun: "energy use", indicator: "ENRG", matrix: "N", unit: "MJ", national: true },
    land: { label: "Land Use", noun: "land use", indicator: "LAND", matrix: "N", unit: "m²·yr",
        un: { factors: { 908: 1 }, unit: "km²", note: "land (factor_id 908)" } },
    water: { label: "Water Use", noun: "water use", indicator: "WATR", matrix: "N", unit: "m³", scale: 0.001, // kg to m3
        un: { factors: { 910: 1e6 }, note: "blue water withdrawal (factor_id 910)" } }, // Mm3 to m3
    material: { label: "Material Use", noun: "metals and minerals", indicator: "MNRL", unit: "t", epa: false,
        un: { factors: { 909: 1000 }, note: "metals and minerals (factor_id 909)" } }, // kt to t
    health: { label: "Health: Toxicity", noun: "human toxicity", indicator: "HTOX", matrix: "N", unit: "CTUh" },
    air: { label: "Health: Respiratory", noun: "respiratory effects", indicator: "HRSP", matrix: "N", unit: "kg PM2.5 eq" },
    emp: { label: "Jobs Supported", noun: "jobs supported", indicator: "JOBS", matrix: "N", unit: "jobs",
        un: { factors: { 906: 1000 }, note: "employment (factor_id 906, in thousands of people)" } },
    va: { label: "Value Added", noun: "value added", indicator: "VADD", matrix: "D", usd: true, domesticOnly: true }
};
const SUPPORTING_INDUSTRIES_DEFAULT_FACTOR = "amt";
// The UN and EPA toggle left of the factor dropdown, keyed by the "source" hash value, in button order
const SUPPORTING_INDUSTRIES_SOURCES = {
    un: { label: "UN", title: "Exiobase 2018 to 2024 trade tables, split among states by BEA GDP by state" },
    epa: { label: "EPA", title: "US EPA USEEIO 2020 state models" }
};
const SUPPORTING_INDUSTRIES_DEFAULT_SOURCE = "epa";

// Year dropdown beside the factor, keyed by the "year" hash value (as on the trade map). EPA has
// state models for 2020 only. UN has Exiobase trade tables for 2018 to 2024, but the 2023 and 2024
// tables carry only amounts and metals and minerals (factor_id 909), so a UN factor with
// lastYear stops there.
const SUPPORTING_INDUSTRIES_YEARS = {
    epa: ["2020"],
    un: ["2018", "2019", "2020", "2021", "2022", "2023", "2024"]
};
const SUPPORTING_INDUSTRIES_DEFAULT_YEAR = "2020";
const SUPPORTING_INDUSTRIES_UN_FACTOR_LAST_YEAR = "2022";

// The years a source offers for a factor
function supportingIndustriesYears(source, factorKey) {
    const years = SUPPORTING_INDUSTRIES_YEARS[source] || [SUPPORTING_INDUSTRIES_DEFAULT_YEAR];
    const factor = SUPPORTING_INDUSTRIES_FACTORS[factorKey];
    const allYears = source !== "un" || !factor || factor.amount || factorKey === "material";
    return allYears ? years : years.filter(year => year <= SUPPORTING_INDUSTRIES_UN_FACTOR_LAST_YEAR);
}

// A factor's settings for a source: the UN settings replace the EPA ones they share
function supportingIndustriesFactor(factorKey, source) {
    const factor = SUPPORTING_INDUSTRIES_FACTORS[factorKey];
    return source === "un" ? Object.assign({}, factor, factor.un) : factor;
}
function factorHasSource(factorKey, source) {
    const factor = SUPPORTING_INDUSTRIES_FACTORS[factorKey];
    return source === "un" ? !!factor.un : factor.epa !== false;
}
// The UN factor key for a USEEIO indicator code (GHG -> co2), or null when Exiobase has none
function unFactorForIndicator(indicatorCode) {
    return Object.keys(SUPPORTING_INDUSTRIES_FACTORS).find(key =>
        SUPPORTING_INDUSTRIES_FACTORS[key].indicator === indicatorCode && factorHasSource(key, "un")) || null;
}

// The UN / EPA source, shared by every toggle on the page (the Top 10 panel and profile/footprint's
// matrix section) and kept in the hash as source=un. EPA is the default and leaves source out.
function getSupportingIndustriesSource() {
    const hash = (typeof getHash === "function") ? getHash() : {};
    return hash.source === "un" ? "un" : SUPPORTING_INDUSTRIES_DEFAULT_SOURCE;
}
// Sets the source quietly (no hashChangeEvent, so the page doesn't reload), then tells each toggle
// through a "supportingIndustriesSource" event on document, with the source in event.detail.source
function setSupportingIndustriesSource(source) {
    if (typeof goHashQuiet === "function") {
        if (source === SUPPORTING_INDUSTRIES_DEFAULT_SOURCE) goHashQuiet({}, "source"); else goHashQuiet({ source });
    }
    document.dispatchEvent(new CustomEvent("supportingIndustriesSource", { detail: { source } }));
}
// The UN / EPA toggle (.si-source in css/supporting-industries.css). Clicking a button calls
// setSupportingIndustriesSource(). Mark the buttons with markSourceButtons().
function sourceButtonsHTML() {
    return `<div class="si-source" role="group" aria-label="Data source">
        ${Object.keys(SUPPORTING_INDUSTRIES_SOURCES).map(key => `<button type="button" class="si-source-btn"
            data-source="${key}" title="${SUPPORTING_INDUSTRIES_SOURCES[key].title}">${SUPPORTING_INDUSTRIES_SOURCES[key].label}</button>`).join("")}
    </div>`;
}
function setupSourceButtons(container) {
    container.querySelectorAll(".si-source-btn").forEach(button => button.addEventListener("click", () => {
        if (button.getAttribute("aria-pressed") !== "true" && !button.disabled) setSupportingIndustriesSource(button.dataset.source);
    }));
}
// Presses the shown source's button. When UN can't show the sector, unNote adds the reason to its
// hover text and greys it out, unless unExplained: then UN stays clickable and choosing it shows
// why, with links to related UN sectors (exiobaseBarrierHTML for a sector with no Exiobase industry).
function markSourceButtons(container, source, unNote, unExplained) {
    container.querySelectorAll(".si-source-btn").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.source === source));
        const title = SUPPORTING_INDUSTRIES_SOURCES[button.dataset.source].title;
        const noted = button.dataset.source === "un" && !!unNote;
        button.disabled = noted && !unExplained;
        button.title = noted ? title + " | " + unNote : title;
    });
}

// UN option: the Exiobase trade tables in ModelEarth/trade-data, as each industry's national
// purchases (from US producers and imports) in US/domestic/trade-us.csv, placed in states with
// the BEA weights in US/domestic/category_state.csv and the categories in
// US/domestic/industry_category.csv. exiobase/tradeflow/bea/category_state.py writes all three.
// The Year dropdown picks the tables' year. This default year's industry.csv lists the
// Exiobase industries (the same 200 every year) for exiobaseIndustriesForSummary, and it is the
// year shown when the hash has none, matching the Top 10 panel's default.
const EXIOBASE_STATE_YEAR = SUPPORTING_INDUSTRIES_DEFAULT_YEAR;
// Years in trade-data/year with US trade tables, newest first. Their status is on exiobase/tradeflow/.
const EXIOBASE_YEARS = ["2024", "2023", "2022", "2021", "2020", "2019", "2018"];
// Years with the state tables (trade-us.csv, industry_category.csv and category_state.csv): every
// year in trade-data/year now has its own. A year missing from this list would use the nearest
// one's state weights, and the Top 10 and matrix would use its trade-us.csv.
const EXIOBASE_STATE_YEARS = ["2018", "2019", "2020", "2021", "2022", "2023", "2024"];
// Years whose trade_factor.csv lacks factors, shown in the year dropdown and notes
const EXIOBASE_YEAR_NOTES = {
    "2023": "trade amounts and material use only, no greenhouse gas or jobs factors",
    "2024": "trade amounts and material use only, no greenhouse gas or jobs factors"
};

// The Exiobase year from the hash (year=2022), otherwise 2020. The hash's year is shared with the
// USEEIO model year (profile/footprint/js/config.js), which only has 2020.
function getExiobaseYear() {
    const year = String(((typeof getHash === "function") ? getHash() : {}).year || "").trim();
    return EXIOBASE_YEARS.includes(year) ? year : EXIOBASE_STATE_YEAR;
}
// The year with state tables nearest a year (the earlier one on a tie): 2020 -> 2019, 2021 -> 2022
function exiobaseStateTablesYear(year) {
    year = String(year || getExiobaseYear());
    if (EXIOBASE_STATE_YEARS.includes(year)) return year;
    return EXIOBASE_STATE_YEARS.slice().sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b)[0];
}
// The year the Top 10 and matrix show: the hash's year when it has state tables, otherwise the nearest
function exiobaseTablesYear() {
    return exiobaseStateTablesYear(getExiobaseYear());
}
// The page listing each Exiobase year's files and processing status
function exiobaseStatusUrl() {
    return profileUrl("../exiobase/tradeflow/");
}
const TRADE_DATA_RAW = "https://raw.githubusercontent.com/ModelEarth/trade-data/main/";
// Exiobase industries for a product's NAICS codes, by the longest matching NAICS prefix.
// From trade-data/concordance/exio_to_useeio2_commodity_concordance.csv, leaving out its
// secondary-material and waste treatment industries (e.g. ASHFO, SECO5).
const EXIOBASE_INDUSTRIES_BY_NAICS = {
    "21231": ["STONE"], "212321": ["SANDC"], "3141": ["TEXTI"], "3212": ["WOODW"], "3241": ["BITU1"],
    "3255": ["CHEM1"], "326": ["RUBBE"], "32712": ["BRICK", "CERAM"], "3272": ["GLASS"], "32731": ["CEMEN"],
    "3273": ["NONME"], "32742": ["CEMEN"], "3279": ["NONME"], "3311": ["BASIC"], "3312": ["BASIC"],
    "3313": ["ALUM1"], "332": ["FABRI"], "3334": ["MACHI"], "3351": ["ELECT"]
};

// The Top 10 panel: a heading, the UN / EPA toggle, the factor dropdown, the ranking and a note.
// options: element (a div to fill, otherwise a new one), manufacturer (on a product label: the
// note then says the ranking is the broader industry's, not that manufacturer's suppliers),
// ownLabel (the star's label for the sector's own industry), ownRankBox (false to leave out the
// box below the list giving the own industry's rank when it's outside the top rows),
// footprintLink (false on the footprint page itself) and unLinkFor(summaryCode) (a link to another sector in UN,
// listed when UN has no industries for this one; default: profile/footprint). Returns the element, setSector(sectorCode, exiobaseIndustries),
// show(state, key, onUnavailable), hide() and shownKey(). show() ranks the sector in that
// state, and calls onUnavailable when the state model fails to load (the panel then hides).
function createSupportingIndustriesPanel(options) {
    const opts = Object.assign({ ownLabel: "Product's manufacturing industry", ownRankBox: true, footprintLink: true }, options);
    const manufacturer = opts.manufacturer;
    let sectorCode = null;
    let exiobaseIndustries = [];
    const hash = (typeof getHash === "function") ? getHash() : {};
    let source = getSupportingIndustriesSource();
    let factorKey = Object.prototype.hasOwnProperty.call(SUPPORTING_INDUSTRIES_FACTORS, hash.factor) ? hash.factor : SUPPORTING_INDUSTRIES_DEFAULT_FACTOR;
    let year = String(hash.year || SUPPORTING_INDUSTRIES_DEFAULT_YEAR);
    // A year the source and factor lack goes back to the default (2020, which both sources have)
    const fixYear = () => {
        if (!supportingIndustriesYears(source, factorKey).includes(year)) year = SUPPORTING_INDUSTRIES_DEFAULT_YEAR;
    };
    const yearOptions = () => supportingIndustriesYears(source, factorKey)
        .map(y => `<option value="${y}"${y === year ? " selected" : ""}>${y}</option>`)
        .join("");
    const factorOptions = () => Object.keys(SUPPORTING_INDUSTRIES_FACTORS)
        .filter(key => factorHasSource(key, source))
        .map(key => `<option value="${key}"${key === factorKey ? " selected" : ""}>${SUPPORTING_INDUSTRIES_FACTORS[key].label}</option>`)
        .join("");
    const product = manufacturer ? ", not only this product" : "";
    const noteText = () => (source === "un" && !exiobaseIndustries.length ? "" : source === "un"
        ? `Ranks the purchases made by the state's broader industry (all producers in ${exiobaseIndustries.join(", ")}${product})
            in the Exiobase ${year} trade tables. They are split among states
            by each state's share of US GDP in the supplying and buying industries' categories (BEA), as the
            interstate tables are, so in-state supply is an estimate, not a survey of shipments.`
        : `Ranks the estimated direct materials and services supplied to the state's broader industry (all
            producers in the sector${product}), from the 2020 USEEIO state model.`) +
        (manufacturer ? ` These are not the actual suppliers of ${manufacturer}${manufacturer.endsWith(".") ? "" : "."}` : "");
    // How each source is calculated: a card per source below the toggle. The selected source's
    // card is open with its steps and explanation; the other is collapsed and switches to it.
    const METHODS = {
        epa: { title: "EPA (USEEIO)", steps: ["State model", "Direct purchases"],
            text: () => `Uses the state's own 2020 USEEIO model, which adjusts national US economic tables using
                state-specific industry statistics, including output, value added, employment, and interstate
                trade. It estimates purchases from each supplier industry, distinguishing between in-state
                suppliers, suppliers from other US states, and foreign imports.` },
        un: { title: "UN (EXIOBASE)", steps: ["US purchases", "× State GDP share"],
            text: () => `Starts with national US purchases for each EXIOBASE ${year} industry and scales them
                by the state's share of US GDP in that industry's broader category (e.g., manufacturing). Each
                purchase is then split between in-state and out-of-state suppliers using the state's share of the
                supplier's category.` }
    };
    const methodHTML = () => Object.keys(METHODS).map(key => {
        const m = METHODS[key];
        const active = key === source;
        const disabled = key === "un" && !exiobaseIndustries.length;
        const steps = m.steps.map(step => `<span class="si-step">${step}</span>`).join('<span class="si-step-arrow" aria-hidden="true">&rarr;</span>') +
            `<span class="si-step-arrow" aria-hidden="true">&rarr;</span><span class="si-step si-step-split">
                <i class="si-swatch si-state"></i>In-state <i class="si-swatch si-rous"></i>Other states <i class="si-swatch si-foreign"></i>Imports</span>`;
        return `<div class="si-method-card${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}" data-source="${key}"
                ${active || disabled ? "" : `role="button" tabindex="0" aria-label="Show ${m.title}"`}>
            <div class="si-method-head">
                <span class="si-method-title">${m.title}</span>
                ${active ? '<span class="si-method-badge">Showing</span>' : disabled ? "" : '<span class="si-method-switch">Compare &rarr;</span>'}
            </div>
            <div class="si-steps">${steps}</div>
            ${active ? `<div class="si-method-label">How it is calculated</div><p class="si-method-text">${m.text()}</p>` : ""}
        </div>`;
    }).join("");
    const div = opts.element || document.createElement("div");
    div.classList.add("supporting-industries");
    div.style.display = "none";
    div.innerHTML = `
        <div class="section-header">
            <h4>Top ${SUPPORTING_INDUSTRIES_COUNT} Industries Supplying Production</h4>
        </div>
        <div class="si-controls">
            ${sourceButtonsHTML()}
            <label class="si-factor">Factor:
                <select class="si-factor-select" aria-label="Factor used to rank the supplying industries"></select>
            </label>
            <label class="si-factor si-year">Year:
                <select class="si-factor-select si-year-select" aria-label="Year of the data"></select>
            </label>
        </div>
        <div class="si-body">
            <div class="supporting-industries-state"></div>
            <div class="si-method"></div>
        </div>
        <p class="supporting-industries-note"></p>
    `;
    const stateDiv = div.querySelector(".supporting-industries-state");
    const factorSelect = div.querySelector(".si-factor-select:not(.si-year-select)");
    const yearSelect = div.querySelector(".si-year-select");
    const noteP = div.querySelector(".supporting-industries-note");
    const methodP = div.querySelector(".si-method");
    const sourceGroup = div.querySelector(".si-source");
    let shownKey = null;
    let shownState = null;

    // The toggle, dropdowns, note and method cards for the current source and sector
    function updateControls() {
        markSourceButtons(sourceGroup, source, exiobaseIndustries.length ? "" : "No Exiobase industry matches this sector", true);
        factorSelect.innerHTML = factorOptions();
        fixYear();
        yearSelect.innerHTML = yearOptions();
        yearSelect.title = source === "un"
            ? (supportingIndustriesYears(source, factorKey).length < SUPPORTING_INDUSTRIES_YEARS.un.length
                ? `Exiobase ${SUPPORTING_INDUSTRIES_YEARS.un[0]} to ${SUPPORTING_INDUSTRIES_UN_FACTOR_LAST_YEAR} for this factor (later tables have amounts and Material Use only)`
                : `Exiobase ${SUPPORTING_INDUSTRIES_YEARS.un[0]} to ${SUPPORTING_INDUSTRIES_YEARS.un.slice(-1)[0]}`)
            : "EPA USEEIO state models are available for 2020 only";
        noteP.innerHTML = noteText();
        methodP.innerHTML = methodHTML();
    }

    // Ranks the shown state by the selected source, factor and year. A newer state, source,
    // factor or year choice made while this one loads leaves its result unused.
    function showRanking(state, key) {
        const factor = factorKey;
        const from = source;
        const forYear = year;
        // UN without Exiobase industries for the sector: why, with related industries to see instead
        if (from === "un" && !exiobaseIndustries.length) {
            stateDiv.innerHTML = `<div class="supporting-industries-status">Loading the Exiobase ${forYear} industries...</div>`;
            return exiobaseBarrierHTML({ sectorCode, state, linkFor: opts.unLinkFor }).then(html => {
                if (shownKey === key && source === from) stateDiv.innerHTML = html;
            });
        }
        const loading = from === "un" ? "Exiobase " + forYear + " trade data for " + state
            : SUPPORTING_INDUSTRIES_FACTORS[factor].national ? "national energy data" : state + " state model";
        stateDiv.innerHTML = `<div class="supporting-industries-status">Loading ${loading}...</div>`;
        const ranking = from === "un"
            ? rankExiobaseInputs(state, exiobaseIndustries, factor, forYear)
            : loadSupportingIndustries(state, sectorCode).then(result => rankSupportingIndustries(result, factor));
        return ranking.then(result => {
            if (shownKey === key && factorKey === factor && source === from && year === forYear) stateDiv.innerHTML = supportingIndustriesHTML(result, opts);
        });
    }

    // The quiet hash update keeps the page from reloading
    function updateHashQuietly() {
        if (typeof goHashQuiet !== "function") return;
        const add = {};
        const remove = [];
        if (source === SUPPORTING_INDUSTRIES_DEFAULT_SOURCE) remove.push("source"); else add.source = source;
        if (factorKey === SUPPORTING_INDUSTRIES_DEFAULT_FACTOR) remove.push("factor"); else add.factor = factorKey;
        if (year === SUPPORTING_INDUSTRIES_DEFAULT_YEAR) remove.push("year"); else add.year = year;
        goHashQuiet(add, remove.join(","));
    }

    // A hash year the source or factor lacks (e.g. year=2024&factor=co2) was replaced by the
    // default, so the hash is corrected to match the dropdown. Run when the panel opens, since
    // the page rewrites the hash while it is still loading.
    function syncHashYear() {
        const hashYear = (typeof getHash === "function") ? getHash().year : undefined;
        if (hashYear !== undefined && String(hashYear) !== year) updateHashQuietly();
    }

    function rerank() {
        updateHashQuietly();
        if (!shownKey) return;
        const key = shownKey;
        showRanking(shownState, key).catch(error => rankingFailed(shownState, key, error));
    }

    // A factor change also narrows or widens the UN years (other factors stop at 2022)
    factorSelect.addEventListener("change", () => {
        factorKey = factorSelect.value;
        updateControls();
        rerank();
    });

    yearSelect.addEventListener("change", () => {
        year = yearSelect.value;
        updateControls();
        rerank();
    });

    // A collapsed method card switches to its source, as its toggle button does
    const switchFromCard = event => {
        const card = event.target.closest(".si-method-card[role=button]");
        if (!card || (event.type === "keydown" && event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        if (card.dataset.source !== source) setSupportingIndustriesSource(card.dataset.source);
    };
    methodP.addEventListener("click", switchFromCard);
    methodP.addEventListener("keydown", switchFromCard);

    // EPA or UN, from this toggle or another on the page (setSupportingIndustriesSource).
    // A factor the other source lacks goes back to Amount Spent.
    setupSourceButtons(sourceGroup);
    document.addEventListener("supportingIndustriesSource", event => {
        const next = event.detail && event.detail.source;
        if (!SUPPORTING_INDUSTRIES_SOURCES[next] || next === source) return;
        source = next;
        if (!factorHasSource(factorKey, source)) factorKey = SUPPORTING_INDUSTRIES_DEFAULT_FACTOR;
        updateControls();
        rerank();
    });

    // The panel stays open: the EPA state model loaded but the factor's data (e.g. the national
    // model) did not, or the UN tables have no file for the state
    function rankingFailed(state, key, error) {
        console.warn("Top industries: could not rank " + state + " by " + factorKey + " (" + source + ")", error);
        if (shownKey !== key) return;
        stateDiv.innerHTML = source === "un"
            ? `<div class="supporting-industries-status">The Exiobase ${year} trade tables could not be
                loaded. Choose EPA for this state.</div>`
            : `<div class="supporting-industries-status">${SUPPORTING_INDUSTRIES_FACTORS[factorKey].label}
                could not be loaded for ${state}. Choose another factor.</div>`;
    }

    // The sector to rank, with its Exiobase industries (with none, UN shows why instead of a ranking)
    function setSector(code, industries) {
        sectorCode = code;
        exiobaseIndustries = industries || [];
        source = getSupportingIndustriesSource(); // A link or typed hash may have changed source=
        if (!factorHasSource(factorKey, source)) factorKey = SUPPORTING_INDUSTRIES_DEFAULT_FACTOR;
        updateControls();
    }

    function hide() {
        shownKey = null;
        div.style.display = "none";
    }

    function show(state, key, onUnavailable) {
        shownKey = key;
        shownState = state;
        div.style.display = "";
        syncHashYear();
        if (source === "un") {
            showRanking(state, key).catch(error => rankingFailed(state, key, error));
            return;
        }
        stateDiv.innerHTML = `<div class="supporting-industries-status">Loading ${state} state model...</div>`;
        loadSupportingIndustries(state, sectorCode)
            .then(() => showRanking(state, key).catch(error => rankingFailed(state, key, error)))
            .catch(error => {
                console.warn("Top industries: could not load state model for " + state, error);
                if (shownKey === key) {
                    hide();
                    if (onUnavailable) onUnavailable();
                }
            });
    }

    return { element: div, setSector, show, hide, shownKey: () => shownKey };
}

// Resolves a path in profile/footprint relative to this script (profile/item/js/).
function footprintUrl(path) {
    return profileUrl("footprint/" + path);
}

// Resolves a path in profile/ relative to this script (profile/item/js/).
function profileUrl(path) {
    const thisScript = document.querySelector('script[src*="supporting-industries.js"]');
    return new URL("../../" + path, thisScript ? thisScript.src : window.location.href).href;
}

// Loads profile/js/egrid-data.js (EPA eGRID state electricity, also drawn in #stateEnergyMix on
// localsite/info/#set=energy) once, for the state grid shown with Energy Use.
let egridRequest = null;
function loadEgridData() {
    if (typeof egridData !== "undefined") return Promise.resolve(egridData);
    if (!egridRequest) {
        egridRequest = new Promise((resolve, reject) => {
            if (typeof loadScript !== "function") {
                reject(new Error("loadScript is not available"));
                return;
            }
            loadScript(profileUrl("js/egrid-data.js"), () => typeof egridData !== "undefined"
                ? resolve(egridData)
                : reject(new Error("egrid-data.js did not define egridData")));
        });
        egridRequest.catch(() => { egridRequest = null; }); // allow a retry
    }
    return egridRequest;
}

// Loads profile/footprint/js/useeio.js (the footprint pages' model loader) once.
function loadUseeioLibrary() {
    if (window.useeio && window.useeio.modelOf) return Promise.resolve(window.useeio);
    const url = footprintUrl("js/useeio.js");
    return new Promise((resolve, reject) => {
        if (typeof loadScript !== "function") {
            reject(new Error("loadScript is not available"));
            return;
        }
        loadScript(url, () => window.useeio && window.useeio.modelOf
            ? resolve(window.useeio)
            : reject(new Error("useeio.js did not load")));
    });
}

// One calculation per state and sector, reused when a state tag is clicked again.
const supportingIndustriesCache = new Map();
function loadSupportingIndustries(state, sectorCode) {
    const key = state + "/" + sectorCode;
    if (!supportingIndustriesCache.has(key)) {
        const request = calculateSupportingIndustries(state, sectorCode);
        request.catch(() => supportingIndustriesCache.delete(key)); // allow a retry after a failed load
        supportingIndustriesCache.set(key, request);
    }
    return supportingIndustriesCache.get(key);
}

// Totals the direct inputs into {sector}/US-{state} from the state model's
// commodity-by-commodity matrices. A[i][j] is the input of commodity i per $1 of
// output j, so the column times output q[j] gives annual purchases in dollars.
// Foreign imports (A - A_d) are carried on the state's own rows.
async function calculateSupportingIndustries(state, sectorCode) {
    const useeio = await loadUseeioLibrary();
    const model = useeio.modelOf({
        endpoint: USEEIO_STATE_MODEL_ENDPOINT,
        model: state + "EEIOv1.0-s-20",
        asJsonFiles: true
    });
    const [sectors, A, A_d, q] = await Promise.all([
        model.sectors(), model.matrix("A"), model.matrix("A_d"), model.matrix("q")
    ]);
    const stateLocation = "US-" + state;
    const target = sectors.find(s => s.code === sectorCode && s.location === stateLocation);
    if (!target) throw new Error("Sector " + sectorCode + "/" + stateLocation + " not in model");

    const j = target.index;
    const output = q.get(j, 0);
    const positive = value => Math.max(0, value || 0);
    // Dollar purchases per supplying industry, with the model index of its state row (which
    // also carries foreign imports) and its rest-of-US row for looking up indicators
    const purchases = new Map();
    sectors.forEach(s => {
        const i = s.index;
        if (!purchases.has(s.code)) {
            purchases.set(s.code, { code: s.code, name: s.name, state: 0, restOfUS: 0, foreign: 0, stateIndex: -1, rousIndex: -1 });
        }
        const row = purchases.get(s.code);
        if (s.location === stateLocation) {
            row.stateIndex = i;
            row.state += positive(A_d.get(i, j)) * output;
            row.foreign += positive(A.get(i, j) - A_d.get(i, j)) * output;
        } else {
            row.rousIndex = i;
            row.restOfUS += positive(A.get(i, j)) * output;
        }
    });

    return { state, sectorCode, sectorName: target.name, output, model, purchases };
}

// Energy Use (MJ per dollar) for each summary sector: the national model's detail sectors
// averaged by their output. Loaded once, the first time Energy Use is chosen.
let nationalEnergyRequest = null;
function loadNationalEnergy() {
    if (!nationalEnergyRequest) {
        nationalEnergyRequest = (async () => {
            const useeio = await loadUseeioLibrary();
            const model = useeio.modelOf({
                endpoint: USEEIO_STATE_MODEL_ENDPOINT,
                model: USEEIO_NATIONAL_MODEL,
                asJsonFiles: true
            });
            const [sectors, indicators, N, q, crosswalk] = await Promise.all([
                model.sectors(), model.indicators(), model.matrix("N"), model.matrix("q"), model.sectorCrosswalk()
            ]);
            const energy = indicators.find(indicator => indicator.code === "ENRG");
            if (!energy) throw new Error("ENRG not in " + USEEIO_NATIONAL_MODEL);
            const column = name => crosswalk.header.indexOf(name);
            const summaryCol = column("BEA_Summary");
            const detailCols = [column("BEA_Detail"), column("BEA_Detail_Waste_Disagg")].filter(col => col >= 0);
            const summaryOf = new Map();
            crosswalk.mappings.forEach(mapping => detailCols.forEach(col => {
                if (mapping[col] && !summaryOf.has(mapping[col])) summaryOf.set(mapping[col], mapping[summaryCol]);
            }));
            const sums = new Map();
            sectors.forEach(s => {
                const summary = summaryOf.get(s.code);
                if (!summary) return;
                const weight = q.get(s.index, 0);
                const sum = sums.get(summary) || { energy: 0, output: 0 };
                sum.energy += N.get(energy.index, s.index) * weight;
                sum.output += weight;
                sums.set(summary, sum);
            });
            const perDollar = new Map();
            sums.forEach((sum, summary) => perDollar.set(summary, sum.output > 0 ? sum.energy / sum.output : 0));
            return perDollar;
        })();
        nationalEnergyRequest.catch(() => { nationalEnergyRequest = null; }); // allow a retry
    }
    return nationalEnergyRequest;
}

// Ranks the purchases by the factor: dollars for Amount Spent, otherwise each part of a
// purchase times its supplier's indicator per dollar.
async function rankSupportingIndustries(result, factorKey) {
    const factor = SUPPORTING_INDUSTRIES_FACTORS[factorKey];
    const { purchases, sectorCode } = result;
    let perDollar = () => 1;
    let grid = null;
    if (factor.national) {
        // The state's electricity grid is extra context, so the ranking shows without it
        const [energy, egrid] = await Promise.all([loadNationalEnergy(), loadEgridData().catch(error => {
            console.warn("Top industries: eGRID data did not load", error);
            return null;
        })]);
        perDollar = (row) => energy.get(row.code) || 0;
        if (egrid && egrid.states[result.state]) {
            grid = { year: egrid.year, fuels: egrid.fuels, state: egrid.states[result.state], us: egrid.us };
        }
    } else if (factor.indicator) {
        const [indicators, matrix] = await Promise.all([result.model.indicators(), result.model.matrix(factor.matrix)]);
        const indicator = indicators.find(item => item.code === factor.indicator);
        if (!indicator) throw new Error(factor.indicator + " not in the " + result.state + " model");
        perDollar = (row, index) => index >= 0 ? matrix.get(indicator.index, index) : 0;
    }
    const scale = factor.scale || 1;
    const industries = new Map();
    purchases.forEach(row => {
        const item = {
            code: row.code,
            name: row.name,
            state: row.state * perDollar(row, row.stateIndex) * scale,
            restOfUS: row.restOfUS * perDollar(row, row.rousIndex) * scale,
            // Foreign imports use the state's coefficients, as the model's A matrix does
            foreign: factor.domesticOnly ? 0 : row.foreign * perDollar(row, row.stateIndex) * scale
        };
        industries.set(row.code, item);
    });
    // Rows are summary sectors, so a top row with the product's sector code already covers
    // its more detailed NAICS industry
    const ranking = rankIndustryRows(industries, new Set([sectorCode]));
    // Dollar purchases stay in the own-industry hover box, whatever the factor
    let totalSpent = 0;
    purchases.forEach(row => { totalSpent += row.state + row.restOfUS + row.foreign; });

    return Object.assign(ranking, {
        source: "epa", state: result.state, sectorCode, sectorName: result.sectorName, output: result.output,
        factorKey, totalSpent, grid
    });
}

// Ranks industry rows ({code, name, state, restOfUS, foreign}) by their total. Only rows with
// a positive total are ranked, so a zero-value industry never gets a rank. ownCodes are the
// product's own industries: the best ranked one is highlighted when in the top rows,
// otherwise shown below them with its actual rank (0 when it has no purchases).
function rankIndustryRows(industries, ownCodes) {
    let totalInputs = 0;
    industries.forEach(item => {
        item.total = item.state + item.restOfUS + item.foreign;
        totalInputs += item.total;
    });
    const ranked = Array.from(industries.values())
        .filter(row => row.total > 0)
        .sort((a, b) => b.total - a.total);
    const top = ranked.slice(0, SUPPORTING_INDUSTRIES_COUNT);
    const ownRank = ranked.findIndex(row => ownCodes.has(row.code)) + 1;
    const ownIndustry = ownRank > 0
        ? (ownRank <= top.length ? null : ranked[ownRank - 1])
        : Array.from(ownCodes).map(code => industries.get(code)).find(Boolean) || null;
    return { totalInputs, top, ranked: ranked.length, ownRank, ownIndustry, ownCodes };
}

// The product's Exiobase industries, from its NAICS codes
function exiobaseIndustriesFor(naicsCodes) {
    const industries = new Set();
    (naicsCodes || []).forEach(naics => {
        for (let length = naics.length; length >= 3; length--) {
            const match = EXIOBASE_INDUSTRIES_BY_NAICS[naics.slice(0, length)];
            if (match) {
                match.forEach(code => industries.add(code));
                break;
            }
        }
    });
    return Array.from(industries);
}

// A USEEIO summary sector's Exiobase industries, for a page without NAICS codes (profile/footprint).
// trade-data/concordance/exio_to_useeio2_commodity_concordance.csv lists each Exiobase industry's
// USEEIO detail sectors, and the model's sectorcrosswalk.csv gives their summary sectors. Each
// industry belongs to the summary sector holding most of its detail sectors (all of them on a tie),
// so a few stray detail codes don't add it elsewhere: 326 gets RUBBE but not MACHI. Industries
// "for treatment" (secondary materials and waste treatment) are left out, as in
// EXIOBASE_INDUSTRIES_BY_NAICS. Summary sectors with no industry (e.g. 42, 562) return none, and
// exiobaseBarrierHTML() explains why. Resolves with {bySummary, counts (industry_id -> summary ->
// detail sectors), treatment (summary -> "for treatment" industry_ids), names (industry_id -> name),
// details (industry_id -> USEEIO detail sectors)}.
let exiobaseBySummaryRequest = null;
function loadExiobaseBySummary() {
    if (!exiobaseBySummaryRequest) {
        exiobaseBySummaryRequest = Promise.all([
            fetchTradeDataText("year/" + EXIOBASE_STATE_YEAR + "/industry.csv"),
            fetchTradeDataText("concordance/exio_to_useeio2_commodity_concordance.csv"),
            fetch(USEEIO_STATE_MODEL_ENDPOINT + "/sectorcrosswalk.csv").then(response => {
                if (!response.ok) throw new Error(response.status + " for sectorcrosswalk.csv");
                return response.text();
            })
        ]).then(([industryText, concordanceText, crosswalkText]) => {
            const industryRows = parseCsvRows(industryText);
            const ids = new Map(industryRows.map(row => [row.name, row.industry_id]));
            const names = new Map(industryRows.map(row => [row.industry_id, String(row.name || row.industry_id).replace(/\s*\(\d+\)$/, "")]));
            const summaryOf = new Map();
            parseCsvRows(crosswalkText).forEach(row => ["BEA_Detail", "BEA_Detail_Waste_Disagg"].forEach(col => {
                if (row[col] && !summaryOf.has(row[col])) summaryOf.set(row[col], row.BEA_Summary);
            }));
            const counts = new Map(); // industry_id -> summary -> detail sectors
            const treatment = new Map(); // summary -> "for treatment" industry_ids
            const details = new Map(); // industry_id -> USEEIO detail sectors, in the concordance's order
            parseCsvRows(concordanceText).forEach(row => {
                const id = ids.get(row.Exiobase_Sector);
                if (id && row.USEEIO_Detail_2012) {
                    if (!details.has(id)) details.set(id, []);
                    if (!details.get(id).includes(row.USEEIO_Detail_2012)) details.get(id).push(row.USEEIO_Detail_2012);
                }
                const summary = summaryOf.get(row.USEEIO_Detail_2012);
                if (!id || !summary) return;
                if (/for treatment/.test(row.Exiobase_Sector)) {
                    if (!treatment.has(summary)) treatment.set(summary, new Set());
                    treatment.get(summary).add(id);
                    return;
                }
                if (!counts.has(id)) counts.set(id, new Map());
                counts.get(id).set(summary, (counts.get(id).get(summary) || 0) + 1);
            });
            const bySummary = new Map();
            counts.forEach((summaries, id) => {
                const most = Math.max(...summaries.values());
                summaries.forEach((count, summary) => {
                    if (count !== most) return;
                    if (!bySummary.has(summary)) bySummary.set(summary, []);
                    bySummary.get(summary).push(id);
                });
            });
            return { bySummary, counts, treatment, names, details };
        });
        exiobaseBySummaryRequest.catch(() => { exiobaseBySummaryRequest = null; }); // allow a retry
    }
    return exiobaseBySummaryRequest;
}
function exiobaseIndustriesForSummary(sectorCode) {
    return loadExiobaseBySummary().then(match => match.bySummary.get(sectorCode) || []);
}
// The USEEIO summary sector an Exiobase industry belongs to (the first when tied), or null
function exiobaseSummaryFor(industryId) {
    return loadExiobaseBySummary().then(match => summaryOfIndustry(match, industryId));
}
// An Exiobase industry's USEEIO detail sectors (for the national model), from the concordance
function exiobaseDetailsFor(industryId) {
    return loadExiobaseBySummary().then(match => match.details.get(industryId) || []);
}
// The Exiobase industries holding a USEEIO detail sector (none for "for treatment" industries)
function exiobaseIndustriesForDetail(detailCode) {
    return loadExiobaseBySummary().then(match => Array.from(match.details.keys())
        .filter(id => match.details.get(id).includes(detailCode) && summaryOfIndustry(match, id)));
}
function summaryOfIndustry(match, industryId) {
    for (const [summary, ids] of match.bySummary) if (ids.includes(industryId)) return summary;
    return null;
}

// Related Exiobase industries for a summary sector with none of its own, where the concordance
// doesn't give the sector a matching industry (by majority). Hand-picked for sectors no
// concordance row reaches. Each is an industry_id and why it's related.
const EXIOBASE_RELATED_BY_SUMMARY = {
    "42": [
        { id: "WHOLE", why: "Exiobase's wholesale industry (ISIC 51), which EPA's concordance maps to the retail detail sectors 445000 and 452000 instead of the wholesale detail sectors (4231 to 4250)" },
        { id: "SALEM", why: "includes the wholesale of motor vehicles and their parts (ISIC 50), which Exiobase groups with their sale and repair" }
    ]
};

// Summary sector names (from a state model's sectors.json, the same in every state), loaded once
let summaryNamesRequest = null;
function loadSummaryNames() {
    if (!summaryNamesRequest) {
        summaryNamesRequest = fetch(USEEIO_STATE_MODEL_ENDPOINT + "/GAEEIOv1.0-s-20/sectors.json")
            .then(response => {
                if (!response.ok) throw new Error(response.status + " for sectors.json");
                return response.json();
            })
            .then(sectors => new Map(sectors.filter(s => s.location === "US-GA").map(s => [s.code, s.name])));
        summaryNamesRequest.catch(() => { summaryNamesRequest = null; }); // allow a retry
    }
    return summaryNamesRequest;
}

// Why UN (Exiobase) can't show a summary sector, as HTML, with links to the sectors that show the
// related Exiobase industries in UN:
// - partial: industries with some of the sector's detail sectors, shown with the sector holding most of theirs
// - named: hand-picked (EXIOBASE_RELATED_BY_SUMMARY) or sharing a distinctive word with the sector's name
// - treatment: "for treatment" industries (waste treatment and recycling), which no sector shows
// options: sectorCode, state, noState (true when the page has no state: UN is split among states),
// linkFor(summaryCode) (the link to that sector in UN; default: profile/footprint for the state)
async function exiobaseBarrierHTML(options) {
    const year = exiobaseTablesYear();
    const status = html => `<div class="supporting-industries-status si-barrier">${html}</div>`;
    if (options.noState) {
        return status(`UN shows the Exiobase ${year} trade tables split among states by each state's share of US GDP
            (BEA), so it needs a state. Choose a state above to see this sector's UN suppliers and buyers.`);
    }
    const { sectorCode, state } = options;
    const [match, sectorNames] = await Promise.all([loadExiobaseBySummary(), loadSummaryNames().catch(() => new Map())]);
    const sectorName = sectorNames.get(sectorCode) || sectorCode;
    const escape = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const linkFor = options.linkFor || (code => footprintUrl(`#state=${state}&demand=${code}/US-${state}&source=un`));
    const shownIn = id => {
        const summary = summaryOfIndustry(match, id);
        return summary
            ? `shown in UN with <a href="${linkFor(summary)}">${escape(sectorNames.get(summary) || summary)} (${summary})</a>`
            : "not shown with any sector";
    };
    const item = (id, why) => `<li><b>${escape(match.names.get(id) || id)}</b> (${id})${why ? " - " + why : ""}, ${shownIn(id)}</li>`;

    // Industries with some of this sector's detail sectors, but more of another's
    const partial = [];
    match.counts.forEach((summaries, id) => {
        if (summaries.has(sectorCode)) {
            const total = Array.from(summaries.values()).reduce((sum, n) => sum + n, 0);
            partial.push({ id, here: summaries.get(sectorCode), total });
        }
    });
    // Hand-picked, then industries sharing a distinctive word with the sector name (e.g. "wholesale")
    const listed = new Set(partial.map(p => p.id));
    const named = (EXIOBASE_RELATED_BY_SUMMARY[sectorCode] || []).filter(r => !listed.has(r.id));
    named.forEach(r => listed.add(r.id));
    const common = new Set(["trade", "services", "service", "products", "product", "other", "manufacturing", "related",
        "activities", "except", "industries", "support", "goods", "based", "general", "government", "federal", "state", "local"]);
    const words = String(sectorName).toLowerCase().split(/[^a-z]+/).filter(word => word.length >= 5 && !common.has(word));
    match.names.forEach((name, id) => {
        if (listed.has(id) || !summaryOfIndustry(match, id)) return;
        const lower = name.toLowerCase();
        if (words.some(word => new RegExp("\\b" + word).test(lower))) {
            named.push({ id, why: "a similar name" });
            listed.add(id);
        }
    });
    const treatment = Array.from(match.treatment.get(sectorCode) || []);

    const concordance = "https://github.com/ModelEarth/trade-data/blob/main/concordance/exio_to_useeio2_commodity_concordance.csv";
    const related = partial.length || named.length;
    let html = `<p style="margin-top:0"><b>UN can't show ${escape(sectorName)} (${sectorCode}) on its own.</b>
        The Exiobase ${year} trade tables are by Exiobase industry, and
        <a href="${concordance}" target="_blank">EPA's Exiobase to USEEIO concordance</a> gives no industry that
        belongs mainly to this sector${partial.length ? ": the ones that touch it belong mainly to other sectors" : ""}.
        Choose EPA for this sector${related ? ", or see a related industry in UN" : ""}.</p>`;
    if (partial.length) {
        html += `<div>Industries that include part of this sector:</div><ul>`
            + partial.sort((a, b) => b.here / b.total - a.here / a.total)
                .map(p => item(p.id, `${p.here} of its ${p.total} USEEIO detail sectors ${p.here === 1 ? "is" : "are"} here`)).join("") + "</ul>";
    }
    if (named.length) {
        html += `<div>Similar industries:</div><ul>` + named.map(r => item(r.id, r.why)).join("") + "</ul>";
    }
    if (treatment.length) {
        html += `<div>Waste treatment industries, which the matching leaves out since they also treat secondary
            materials for other sectors:</div><ul>`
            + treatment.map(id => `<li>${escape(match.names.get(id) || id)} (${id})</li>`).join("") + "</ul>";
    }
    if (!partial.length && !named.length && !treatment.length) {
        html += `<p>No Exiobase industry is related to this sector.</p>`;
    }
    return status(html);
}

// A trade-data file from the trade-data clone beside profile/ (or its site), then from GitHub
function fetchTradeDataText(path) {
    return [profileUrl("../trade-data/" + path), TRADE_DATA_RAW + path].reduce((attempt, url) =>
        attempt.catch(() => fetch(url).then(response => {
            if (!response.ok) throw new Error(response.status + " for " + url);
            return response.text();
        })), Promise.reject(new Error("No URL")));
}

// Rows of a CSV with a header row, as objects. Quoted cells may hold commas.
function parseCsvRows(text) {
    const split = line => {
        const cells = [];
        let cell = "", quoted = false;
        for (const c of line) {
            if (c === '"') quoted = !quoted;
            else if (c === "," && !quoted) { cells.push(cell); cell = ""; }
            else cell += c;
        }
        cells.push(cell);
        return cells;
    };
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
    const header = split(lines[0] || "");
    return lines.slice(1).map(line => {
        const cells = split(line);
        const row = {};
        header.forEach((name, i) => { row[name] = cells[i]; });
        return row;
    });
}

// Exiobase industry names (without their ISIC numbers), each industry's broad category, each
// state's origin and destination weight for each category, and the year's US dollars per euro,
// loaded once per year. The categories and weights come from the nearest year with state tables
// (weightsYear).
const exiobaseSharedRequests = new Map();
function loadExiobaseShared(year) {
    year = String(year || exiobaseTablesYear());
    const weightsYear = exiobaseStateTablesYear(year);
    if (!exiobaseSharedRequests.has(year)) {
        const request = Promise.all([
            fetchTradeDataText("year/" + year + "/industry.csv"),
            fetchTradeDataText("year/" + weightsYear + "/US/domestic/industry_category.csv"),
            fetchTradeDataText("year/" + weightsYear + "/US/domestic/category_state.csv"),
            fetchTradeDataText("concordance/eur_annual_rates.csv")
        ]).then(([industryText, categoryText, weightsText, ratesText]) => {
            const names = new Map(parseCsvRows(industryText)
                .map(row => [row.industry_id, String(row.name || row.industry_id).replace(/\s*\(\d+\)$/, "")]));
            const categories = new Map(parseCsvRows(categoryText).map(row => [row.industry_id, row.state_industry_code]));
            const weights = new Map(parseCsvRows(weightsText)
                .map(row => [row.state_industry_code + "|" + row.weight_type + "|" + row.state, parseFloat(row.weight) || 0]));
            const rates = parseCsvRows(ratesText).find(row => row.Year === year);
            const usdPerEur = rates ? parseFloat(rates.USD) : NaN;
            if (!(usdPerEur > 0)) throw new Error("No " + year + " USD rate in eur_annual_rates.csv");
            return { names, categories, weights, usdPerEur, year, weightsYear };
        });
        request.catch(() => exiobaseSharedRequests.delete(year)); // allow a retry
        exiobaseSharedRequests.set(year, request);
    }
    return exiobaseSharedRequests.get(year);
}

// The factor_id columns in trade-us.csv (901 to 910, listed in the year's factor.csv)
const EXIOBASE_FACTOR_IDS = ["901", "902", "903", "904", "905", "906", "907", "908", "909", "910"];

// Every industry pair's national flow (trade-us.csv), grouped by buying industry (byBuyer) and by
// supplying industry (bySupplier), and each industry's own direct factors per million euros of US
// output (intensity). A flow's factor columns are its amount times the supplier's direct factor,
// so the intensity is the factor total over the amount of the supplier's US-made sales. Loaded once
// per year with state tables (EXIOBASE_STATE_YEARS).
const exiobaseFlowsRequests = new Map();
function loadExiobaseFlows(year) {
    year = exiobaseStateTablesYear(year || exiobaseTablesYear());
    if (!exiobaseFlowsRequests.has(year)) {
        const request = fetchTradeDataText(`year/${year}/US/domestic/trade-us.csv`).then(text => {
            const byBuyer = new Map();
            const bySupplier = new Map();
            const sums = new Map();
            const add = (map, key, row) => { if (!map.has(key)) map.set(key, []); map.get(key).push(row); };
            parseCsvRows(text).forEach(row => {
                add(byBuyer, row.industry2, row);
                add(bySupplier, row.industry1, row);
                if (row.origin === "foreign") return;
                if (!sums.has(row.industry1)) sums.set(row.industry1, { amount: 0, factors: {} });
                const sum = sums.get(row.industry1);
                sum.amount += parseFloat(row.amount) || 0;
                EXIOBASE_FACTOR_IDS.forEach(id => { sum.factors[id] = (sum.factors[id] || 0) + (parseFloat(row[id]) || 0); });
            });
            const intensity = new Map();
            sums.forEach((sum, code) => {
                const perAmount = {};
                EXIOBASE_FACTOR_IDS.forEach(id => { perAmount[id] = sum.amount ? sum.factors[id] / sum.amount : 0; });
                intensity.set(code, perAmount);
            });
            return { byBuyer, bySupplier, intensity };
        });
        request.catch(() => exiobaseFlowsRequests.delete(year)); // allow a retry
        exiobaseFlowsRequests.set(year, request);
    }
    return exiobaseFlowsRequests.get(year);
}

// Calls fn(cells) for each line of a CSV without quoted cells (the trade tables), after the header.
// Resolves the header's column names to indexes first: columns({trade_id: 0, ...}).
function eachPlainCsvLine(text, columns, fn) {
    const lines = text.split("\n");
    const header = (lines[0] || "").replace(/^\uFEFF/, "").trim().split(",");
    columns(Object.fromEntries(header.map((name, i) => [name, i])));
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) fn(line.split(","));
    }
}

// Each Exiobase industry's sales to industries in the same region in a year, with the factors on them,
// from {region}/domestic/trade.csv and trade_factor.csv (US-made sales to US industries for "US"). Every
// year in EXIOBASE_YEARS has them for the regions in EXIOBASE_PROCESSED_REGIONS, and 2018 for all 49.
// The trade tables hold industry-to-industry flows only, so sales to households, government and exports
// aren't in them. Resolves with {industries: Map of industry_id -> {amount (millions of euros), factors
// (factor_id -> level)}, factorIds (the factor_ids the year has)}. Loaded once per year and region.
const exiobaseSalesRequests = new Map();
function loadExiobaseSales(year, region) {
    year = String(year || getExiobaseYear());
    region = region || "US";
    const key = year + "/" + region;
    if (!exiobaseSalesRequests.has(key)) {
        const request = Promise.all([
            fetchTradeDataText(`year/${year}/${region}/domestic/trade.csv`),
            fetchTradeDataText(`year/${year}/${region}/domestic/trade_factor.csv`)
        ]).then(([tradeText, factorText]) => {
            const supplierOf = new Map();
            const industries = new Map();
            const entry = code => {
                if (!industries.has(code)) industries.set(code, { amount: 0, factors: {} });
                return industries.get(code);
            };
            let c = {};
            eachPlainCsvLine(tradeText, columns => { c = columns; }, cells => {
                if (cells[c.region1] !== region || cells[c.region2] !== region) return;
                const code = cells[c.industry1];
                supplierOf.set(cells[c.trade_id], code);
                entry(code).amount += parseFloat(cells[c.amount]) || 0;
            });
            const factorIds = new Set();
            eachPlainCsvLine(factorText, columns => { c = columns; }, cells => {
                const code = supplierOf.get(cells[c.trade_id]);
                if (!code) return;
                const id = cells[c.factor_id];
                const factors = entry(code).factors;
                factors[id] = (factors[id] || 0) + (parseFloat(cells[c.level]) || 0);
                factorIds.add(id);
            });
            return { industries, factorIds };
        });
        request.catch(() => exiobaseSalesRequests.delete(key)); // allow a retry
        exiobaseSalesRequests.set(key, request);
    }
    return exiobaseSalesRequests.get(key);
}

// Exiobase regions processed for every year (the default COUNTRY list in exiobase/tradeflow/config.yaml):
// 13 countries and Exiobase's Rest of World Middle East (WM). The World view adds these up. 2018's run
// also wrote the other 35 of Exiobase's 49 regions, so a country in one of those shows for 2018 only.
const EXIOBASE_PROCESSED_REGIONS = ["AU", "BR", "CA", "CN", "DE", "FR", "GB", "IN", "IT", "JP", "KR", "RU", "US", "WM"];
const EXIOBASE_ALL_REGIONS_YEARS = ["2018"];
// How much of the world the 14 hold, from 2018's files for all 49 regions: their shares of the
// within-country industry-to-industry sales, of the greenhouse gases on those sales and of the jobs.
// missing: the largest regions left out with their share of the sales, then the other 27 together.
const EXIOBASE_WORLD_COVERAGE = {
    year: "2018", regions: 49, sales: 0.789, ghg: 0.839, jobs: 0.684,
    missing: [["WA", 0.040], ["WL", 0.020], ["WF", 0.014], ["ES", 0.013], ["TW", 0.011], ["ID", 0.011], ["MX", 0.009], ["TR", 0.009]],
    otherMissing: 0.083, otherCount: 27
};
// Names for the processed regions, Exiobase's five Rest of World regions and the largest missing ones.
// Other countries' names come from concordance/exio_country_concordance.csv.
const EXIOBASE_REGION_NAMES = {
    WORLD: "World", AU: "Australia", BR: "Brazil", CA: "Canada", CN: "China", DE: "Germany", FR: "France",
    GB: "United Kingdom", IN: "India", IT: "Italy", JP: "Japan", KR: "South Korea", RU: "Russia", US: "United States",
    ES: "Spain", TW: "Taiwan", ID: "Indonesia", MX: "Mexico", TR: "Turkey",
    WA: "Rest of Asia and Pacific", WE: "Rest of Europe", WF: "Rest of Africa", WL: "Rest of Americas", WM: "Rest of Middle East"
};
function exiobaseRegionName(code) {
    return EXIOBASE_REGION_NAMES[code] || code;
}
// True when the year's files have the Exiobase region
function exiobaseYearHasRegion(year, region) {
    return EXIOBASE_PROCESSED_REGIONS.includes(region) || EXIOBASE_ALL_REGIONS_YEARS.includes(String(year));
}

// Each country's Exiobase region by ISO code, from concordance/exio_country_concordance.csv: the country
// itself for the 44 with their own region, otherwise one of the five Rest of World regions (WA, WE, WF,
// WL, WM). Resolves with a Map of ISO code -> {region, name}. Loaded once.
let exiobaseCountriesRequest = null;
function loadExiobaseCountries() {
    if (!exiobaseCountriesRequest) {
        exiobaseCountriesRequest = fetchTradeDataText("concordance/exio_country_concordance.csv").then(text => new Map(
            parseCsvRows(text).filter(row => /^[A-Z]{2}$/.test(row.ISO_Code || "") && /^[A-Z]{2}$/.test(row.CountryCode || ""))
                .map(row => [row.ISO_Code, { region: row.CountryCode, name: row.Country }])));
        exiobaseCountriesRequest.catch(() => { exiobaseCountriesRequest = null; }); // allow a retry
    }
    return exiobaseCountriesRequest;
}
// A place for the UN lists: "WORLD", an Exiobase region code (WM) or a country's ISO code (SA, in WM).
// Resolves with {location, name, regions (the Exiobase regions it adds up), partOf (the Rest of World
// region holding a country without its own)}.
async function exiobasePlace(location) {
    if (location === "WORLD") return { location, name: "World", regions: EXIOBASE_PROCESSED_REGIONS.slice(), partOf: null };
    if (/^W[AEFLM]$/.test(location)) return { location, name: exiobaseRegionName(location), regions: [location], partOf: null };
    const match = (await loadExiobaseCountries().catch(() => new Map())).get(location);
    const region = match ? match.region : (EXIOBASE_PROCESSED_REGIONS.includes(location) ? location : null);
    const name = EXIOBASE_REGION_NAMES[location] || (match && match.name) || location;
    return { location, name, regions: region ? [region] : [], partOf: region && region !== location ? region : null };
}

// The UN commodity list: one row per Exiobase industry and region, for the US and each state, in the
// row shape of profile/footprint/js/commodities-report.js ({code, location, name, output, jobs, ghg}),
// plus factors (factor_id -> level, for any UN indicator). output is US-made sales to US industries in
// US dollars at the year's rate. A state's rows are the national ones times the state's origin weight
// for the industry's category (its share of US GDP in that category, from the nearest year with state
// tables). jobs and ghg are null when the year has no employment or greenhouse gas factors.
// With countries (ISO codes, Exiobase regions or "WORLD"), lists those places instead: see
// exiobaseCountryRows(). Resolves with {rows, year, weightsYear, usdPerEur, missing}.
async function exiobaseCommodityRows(year, states, countries) {
    if (countries && countries.length) return exiobaseCountryRows(year, countries);
    year = String(year || getExiobaseYear());
    const [shared, sales] = await Promise.all([loadExiobaseShared(year), loadExiobaseSales(year)]);
    const co2 = supportingIndustriesFactor("co2", "un");
    const emp = supportingIndustriesFactor("emp", "un");
    const has = factor => Object.keys(factor.factors).some(id => sales.factorIds.has(id));
    const hasGhg = has(co2);
    const hasJobs = has(emp);
    const sum = (factors, factor) => Object.keys(factor.factors).reduce((total, id) => total + (factors[id] || 0) * factor.factors[id], 0);
    const regions = [{ location: "US", share: () => 1 }].concat((states || []).map(state => ({
        location: "US-" + state,
        share: code => shared.weights.get((shared.categories.get(code) || "services") + "|origin|" + state) || 0
    })));
    const rows = [];
    regions.forEach(region => {
        sales.industries.forEach((item, code) => {
            const share = region.share(code);
            if (!(item.amount > 0) || !(share > 0)) return;
            const factors = {};
            Object.keys(item.factors).forEach(id => { factors[id] = item.factors[id] * share; });
            rows.push({
                code, location: region.location,
                name: shared.names.get(code) || code,
                output: item.amount * 1e6 * shared.usdPerEur * share,
                jobs: hasJobs ? sum(item.factors, emp) * share : null,
                ghg: hasGhg ? sum(item.factors, co2) * share : null,
                factors
            });
        });
    });
    const missing = [!hasGhg && "greenhouse gases", !hasJobs && "jobs"].filter(Boolean);
    return { rows, year, weightsYear: shared.weightsYear, usdPerEur: shared.usdPerEur, missing, factorIds: sales.factorIds };
}

// The UN list for countries and the world, in exiobaseCommodityRows()' row shape: each place's
// industries' sales to industries in the same Exiobase region (its domestic files). A country without
// its own Exiobase region shows the Rest of World region holding it (place.partOf). "WORLD" adds up
// the processed regions (EXIOBASE_PROCESSED_REGIONS), which leave out flows between countries.
// Resolves with {rows, year, usdPerEur, missing, places, missingRegions (not in the year's files),
// factorIds}.
async function exiobaseCountryRows(year, locations) {
    year = String(year || getExiobaseYear());
    const [shared, places] = await Promise.all([loadExiobaseShared(year), Promise.all(locations.map(exiobasePlace))]);
    const needed = [...new Set(places.flatMap(place => place.regions))];
    const loaded = new Map();
    const missingRegions = [];
    await Promise.all(needed.map(region => {
        if (!exiobaseYearHasRegion(year, region)) { missingRegions.push(region); return null; }
        return loadExiobaseSales(year, region).then(sales => loaded.set(region, sales), error => {
            console.warn(`No Exiobase ${year} ${region} domestic files`, error);
            missingRegions.push(region);
        });
    }));
    const factorIds = new Set();
    loaded.forEach(sales => sales.factorIds.forEach(id => factorIds.add(id)));
    const co2 = supportingIndustriesFactor("co2", "un");
    const emp = supportingIndustriesFactor("emp", "un");
    const has = factor => Object.keys(factor.factors).some(id => factorIds.has(id));
    const hasGhg = has(co2);
    const hasJobs = has(emp);
    const sum = (factors, factor) => Object.keys(factor.factors).reduce((total, id) => total + (factors[id] || 0) * factor.factors[id], 0);
    const rows = [];
    places.forEach(place => {
        place.shownRegions = place.regions.filter(region => loaded.has(region));
        const industries = new Map();
        place.shownRegions.forEach(region => loaded.get(region).industries.forEach((item, code) => {
            if (!industries.has(code)) industries.set(code, { amount: 0, factors: {} });
            const total = industries.get(code);
            total.amount += item.amount;
            Object.keys(item.factors).forEach(id => { total.factors[id] = (total.factors[id] || 0) + item.factors[id]; });
        }));
        industries.forEach((item, code) => {
            if (!(item.amount > 0)) return;
            rows.push({
                code, location: place.location,
                name: shared.names.get(code) || code,
                output: item.amount * 1e6 * shared.usdPerEur,
                jobs: hasJobs ? sum(item.factors, emp) : null,
                ghg: hasGhg ? sum(item.factors, co2) : null,
                factors: item.factors
            });
        });
    });
    const missing = [!hasGhg && "greenhouse gases", !hasJobs && "jobs"].filter(Boolean);
    return { rows, year, usdPerEur: shared.usdPerEur, missing, places, missingRegions, factorIds };
}

// The state's flows for its Exiobase industries (targets), by trading industry and region, from the
// national flows in trade-us.csv. As in the interstate tables, a state pair's share of a national flow
// is the supplier's state weight (its share of US GDP in the supplying industry's category) times the
// buyer's (in the buying industry's category), here for all states.
// direction "sellers": what the state's targets buy. A US purchase splits into in-state (origin weight o
//   of the supplier, times the targets' destination weight d) and other states ((1 - o) times d).
//   Imports of the same industry pair place d of them in the state, shown as foreign. Factors are the
//   flow's own columns: the supplier's direct factors on the purchase.
// direction "buyers": what each industry buys from the state's targets. The targets' US-made sales
//   start in the state by their origin weight o, then go to buyers in the state (o times the buyer's d)
//   or other states (o times (1 - d)). Factors are the buyer's own direct factors on what it spends.
// Resolves with {industries: Map of code -> {code, name, regions: {state, restOfUS, foreign}}, names,
// usdPerEur}, where each region holds amount (millions of euros) and factors (factor_id -> value).
// year (optional): the Top 10 panel's Year dropdown; otherwise the hash's year (exiobaseTablesYear).
async function exiobaseStateFlows(state, targets, direction, year) {
    year = year ? exiobaseStateTablesYear(year) : exiobaseTablesYear();
    const [shared, flows] = await Promise.all([loadExiobaseShared(year), loadExiobaseFlows(year)]);
    const weight = (code, type) => shared.weights.get((shared.categories.get(code) || "services") + "|" + type + "|" + state) || 0;
    const industries = new Map();
    const entry = code => {
        if (!industries.has(code)) {
            const region = () => ({ amount: 0, factors: {} });
            industries.set(code, { code, name: shared.names.get(code) || code, regions: { state: region(), restOfUS: region(), foreign: region() } });
        }
        return industries.get(code);
    };
    const addTo = (region, amount, factorsOf, share) => {
        if (!(share > 0)) return;
        region.amount += amount * share;
        EXIOBASE_FACTOR_IDS.forEach(id => { region.factors[id] = (region.factors[id] || 0) + (factorsOf[id] || 0) * share; });
    };
    const rowFactors = row => {
        const factors = {};
        EXIOBASE_FACTOR_IDS.forEach(id => { factors[id] = parseFloat(row[id]) || 0; });
        return factors;
    };
    targets.forEach(target => {
        if (direction === "buyers") {
            const inState = weight(target, "origin");
            (flows.bySupplier.get(target) || []).forEach(row => {
                if (row.origin === "foreign") return; // Imports aren't the state's own sales
                const amount = parseFloat(row.amount) || 0;
                const buyerIntensity = flows.intensity.get(row.industry2) || {};
                const factors = {};
                EXIOBASE_FACTOR_IDS.forEach(id => { factors[id] = (buyerIntensity[id] || 0) * amount; });
                const buyer = entry(row.industry2);
                const buyerShare = weight(row.industry2, "destination");
                addTo(buyer.regions.state, amount, factors, inState * buyerShare);
                addTo(buyer.regions.restOfUS, amount, factors, inState * (1 - buyerShare));
            });
            return;
        }
        const buyerShare = weight(target, "destination");
        (flows.byBuyer.get(target) || []).forEach(row => {
            const amount = parseFloat(row.amount) || 0;
            const factors = rowFactors(row);
            const supplier = entry(row.industry1);
            if (row.origin === "foreign") {
                addTo(supplier.regions.foreign, amount, factors, buyerShare);
            } else {
                const inState = weight(row.industry1, "origin");
                addTo(supplier.regions.state, amount, factors, buyerShare * inState);
                addTo(supplier.regions.restOfUS, amount, factors, buyerShare * (1 - inState));
            }
        });
    });
    return { industries, names: shared.names, usdPerEur: shared.usdPerEur };
}

// A region's value for a UN factor: US dollars for Amount Spent, otherwise its factor_id values
// times the factor's weights
function exiobaseRegionValue(region, factor, usdPerEur) {
    if (factor.amount) return region.amount * 1e6 * usdPerEur;
    return Object.keys(factor.factors).reduce((sum, id) => sum + (region.factors[id] || 0) * factor.factors[id], 0);
}

// Ranks the industries supplying the product's Exiobase industries in the state (see
// exiobaseStateFlows). Amounts are millions of euros, shown in US dollars at the year's rate;
// factors sum their factor_id columns. year (optional): the Top 10 panel's Year dropdown.
async function rankExiobaseInputs(state, targets, factorKey, year) {
    const factor = supportingIndustriesFactor(factorKey, "un");
    year = year ? exiobaseStateTablesYear(year) : exiobaseTablesYear();
    const flows = await exiobaseStateFlows(state, targets, "sellers", year);
    const industries = new Map();
    let totalSpent = 0;
    flows.industries.forEach(item => {
        const value = region => exiobaseRegionValue(item.regions[region], factor, flows.usdPerEur);
        industries.set(item.code, { code: item.code, name: item.name, state: value("state"), restOfUS: value("restOfUS"), foreign: value("foreign") });
        ["state", "restOfUS", "foreign"].forEach(region => { totalSpent += item.regions[region].amount * 1e6 * flows.usdPerEur; });
    });
    return Object.assign(rankIndustryRows(industries, new Set(targets)), {
        source: "un", state, sectorCode: targets.join(", "),
        sectorName: targets.map(code => flows.names.get(code) || code).join(", "),
        factorKey, year, totalSpent
    });
}

function formatUsdShort(value) {
    if (value < 500) return "$0";
    if (value >= 1e9) return "$" + (value / 1e9).toFixed(1) + "B";
    if (value >= 1e6) return "$" + Math.round(value / 1e6).toLocaleString() + "M";
    return "$" + Math.round(value / 1e3).toLocaleString() + "K";
}

// A factor's value in its unit: dollars for Amount Spent and Value Added, otherwise a
// compact number, e.g. "1.2M t CO2 eq"
const siCompactNumber = new Intl.NumberFormat(undefined, { notation: "compact", maximumSignificantDigits: 3 });
function formatFactorShort(value, factor) {
    if (factor.amount || factor.usd) return formatUsdShort(value);
    const number = value === 0 || Math.abs(value) >= 0.01 ? siCompactNumber.format(value) : value.toPrecision(2);
    return number + " " + factor.unit;
}

// How the selected factor's values were found, shown below the legend
function supportingIndustriesFactorNote(factor, source, year) {
    year = year || exiobaseTablesYear();
    if (factor.amount) {
        return source === "un" ? `Amounts are millions of euros in the Exiobase ${year} tables,
            shown in US dollars at the ${year} exchange rate. Foreign imports are the national
            imports of each industry pair, placed in the state by its share of US GDP in the buying industry's
            category.` : "";
    }
    if (source === "un") {
        return `${factor.label} totals the ${factor.note} that the Exiobase ${year} trade_factor
            tables carry on each purchase, for US producers and for each importing country. The factor_id values
            are in that year's factor.csv in ModelEarth/trade-data.`;
    }
    if (factor.national) {
        return `${factor.label} is each purchase times the supplier's supply chain energy per dollar from the
            national ${USEEIO_NATIONAL_MODEL} model (2012 dollars), since the state models have no energy indicator.
            The in-state, rest-of-US and foreign parts share the national rate. The state's electricity grid
            from EPA eGRID is shown below the ranking.`;
    }
    if (factor.matrix === "D") {
        return `${factor.label} is the part of each purchase that is the supplying industry's own value added
            (wages, profits and taxes), from the state model. Foreign imports add no US value added.`;
    }
    return `${factor.label} is each purchase times the supplying industry's ${factor.noun} per dollar,
        including its own upstream supply chain, from the state model. Foreign imports use the state's rates.`;
}

// Fuel colors from profile/js/state-energy.js, so the grid bars match #stateEnergyMix
const EGRID_FUEL_COLORS = {
    coal: "#555555", oil: "#8c564b", gas: "#f2a541", nuclear: "#9467bd", hydro: "#1f77b4", biomass: "#6b8e23",
    wind: "#17becf", solar: "#f7d02c", geothermal: "#d62728", otherFossil: "#a3a3a3", other: "#cfcfcf"
};

// The state's electricity generation by fuel beside the US, from eGRID, shown with Energy Use.
// Negative net generation (e.g. pumped storage) is left out of the bars, as on the energy page.
function supportingIndustriesGridHTML(grid, state, stateName) {
    const percent = (fraction, digits) => (100 * fraction).toFixed(digits === undefined ? 1 : digits) + "%";
    const total = mix => mix.reduce((sum, mwh) => sum + Math.max(mwh, 0), 0) || 1;
    const bar = (label, mix) => `
        <div class="si-grid-row">
            <span class="si-grid-label">${label}</span>
            <div class="si-grid-bar" role="img" aria-label="${label} electricity generation by fuel">
                ${grid.fuels.map((fuel, i) => {
                    const share = Math.max(mix[i], 0) / total(mix);
                    return share > 0 ? `<span style="width:${100 * share}%;background:${EGRID_FUEL_COLORS[fuel.id]}"
                        title="${label} ${fuel.label}: ${percent(share)}"></span>` : "";
                }).join("")}
            </div>
        </div>`;
    const st = grid.state, us = grid.us;
    const legend = grid.fuels.map((fuel, i) => {
        if (st.mix[i] <= 0) return "";
        return `<span><i class="si-swatch" style="background:${EGRID_FUEL_COLORS[fuel.id]}"></i>${fuel.label} ${percent(st.mix[i] / total(st.mix), 0)}</span>`;
    }).join("");
    const energyUrl = profileUrl("../localsite/info/") + `#set=energy&state=${state}`;
    return `
        <div class="si-grid">
            <div class="si-grid-title">${stateName} electricity grid, ${grid.year}</div>
            ${bar(stateName, st.mix)}
            ${bar("US", us.mix)}
            <div class="supporting-industries-legend">${legend}</div>
            <div class="supporting-industries-context">
                Renewables ${percent(st.renewablePct)} (US ${percent(us.renewablePct)}) ·
                ${Math.round(st.co2eRate).toLocaleString()} kg CO<sub>2</sub>e per MWh (US ${Math.round(us.co2eRate).toLocaleString()}).
                The in-state purchases draw their electricity from this mix. Source: US EPA eGRID.
            </div>
            <a class="supporting-industries-link" href="${energyUrl}" target="_blank" rel="noopener">${stateName} electricity generation &rarr;</a>
        </div>`;
}

// options: ownLabel, the star's label for the sector's own industry, ownRankBox and footprintLink
function supportingIndustriesHTML(result, options) {
    const { ownLabel, ownRankBox, footprintLink } = options;
    const { source, state, sectorCode, sectorName, output, factorKey, totalInputs, totalSpent, top, ranked, ownRank, ownIndustry, ownCodes, grid } = result;
    const isUN = source === "un";
    const year = result.year || exiobaseTablesYear();
    const factor = supportingIndustriesFactor(factorKey, source);
    const format = value => formatFactorShort(value, factor);
    const factorName = factor.noun || "purchases";
    // getState (localsite.js) is a fixed list, unlike getStateNameFromID, which reads #state_select once it loads
    const stateName = (typeof getState === "function" && getState(state)) || state;
    if (isUN && top.length === 0) {
        return `<div class="supporting-industries-status">The Exiobase ${year} trade tables place no
            purchases by ${sectorName} in ${stateName}${factor.amount ? "" : " with " + factorName}.</div>`;
    }
    if (!isUN && (!(output > 0) || top.length === 0)) {
        return `<div class="supporting-industries-status">The 2020 model estimates no ${sectorName} (${sectorCode})
            output in ${stateName}, so there are no supplying industries to rank${factor.amount ? "" : " by " + factorName}.</div>`;
    }
    const topShare = totalInputs > 0 ? Math.round(100 * top.reduce((sum, row) => sum + row.total, 0) / totalInputs) : 0;
    const maxTotal = top.length ? top[0].total : 1;
    const pct = (part, whole) => (whole > 0 ? (100 * part / whole) : 0).toFixed(1);
    const isOwn = row => ownCodes.has(row.code);
    const reportLink = isUN
        ? `<a class="supporting-industries-link" href="${profileUrl("trade/map/state.html")}#state=${state}&direction=inbound"
            target="_blank" rel="noopener">Interstate trade map for ${stateName} &rarr;</a>`
        : !footprintLink ? "" : `<a class="supporting-industries-link" href="${footprintUrl("")}#demand=${encodeURIComponent(sectorCode)}/US-${state}&state=${state}"
            target="_blank" rel="noopener">${sectorName} footprint report for ${stateName} &rarr;</a>`;
    // Star and hover box that mark the sector's own industry
    const ownStar = `<span class="si-own-star" role="img" aria-label="${ownLabel}"
        title="${ownLabel}">&#9733;</span>`;
    const topText = factor.amount
        ? `; the top ${top.length} supplying industries account for ${topShare}% of them.`
        : `, with ${format(totalInputs)} of ${factorName}; the top ${top.length} supplying industries account for ${topShare}% of it.`;
    const ownTip = `
        <div class="si-row-tip" role="tooltip">
            <strong>${sectorName} (${sectorCode}) in ${stateName}</strong><br>
            ${isUN
                ? `Its purchases from industries in ${stateName}, other states and abroad in the Exiobase ${year}
                    tables total ${formatUsdShort(totalSpent)}${topText}`
                : `${formatUsdShort(output)} annual output, the estimated value of everything this industry
                    produced in ${stateName} in 2020. Its direct purchases of materials and services total
                    ${formatUsdShort(totalSpent)}${topText}`}
        </div>`;
    const split = row => `${stateName} ${format(row.state)} · Rest of US ${format(row.restOfUS)} · Foreign ${format(row.foreign)}`;
    const factorNote = supportingIndustriesFactorNote(factor, source, year);

    return `
        <div class="supporting-industries-legend">
            <span><i class="si-swatch si-state"></i>${stateName}</span>
            <span><i class="si-swatch si-rous"></i>Rest of US</span>
            <span><i class="si-swatch si-foreign"></i>Foreign imports</span>
        </div>
        <div class="supporting-industries-context si-legend-caption">
            Bar length compares each industry's ${factor.amount ? "total" : factorName}. Colors show where that supply comes from:
            produced within ${stateName}, shipped from other US states, or imported from abroad.
        </div>
        ${factorNote ? `<div class="supporting-industries-context si-factor-note">${factorNote}</div>` : ""}
        <ol class="supporting-industries-list">
            ${top.map(row => `
                <li${isOwn(row) ? ` class="si-own-row" tabindex="0"` : ""}>
                    ${isOwn(row) ? ownTip : ""}
                    <div class="si-row-head">
                        <span class="si-name" title="${row.code}">${row.name}${isOwn(row) ? ownStar : ""}</span>
                        <span class="si-value">${format(row.total)}</span>
                    </div>
                    <div class="si-bar" style="width:${pct(row.total, maxTotal)}%" title="${split(row)}">
                        <span class="si-state" style="width:${pct(row.state, row.total)}%"></span><span class="si-rous" style="width:${pct(row.restOfUS, row.total)}%"></span><span class="si-foreign" style="width:${pct(row.foreign, row.total)}%"></span>
                    </div>
                    <div class="si-split">${split(row)}</div>
                </li>
            `).join('')}
        </ol>
        ${ownIndustry && ownRankBox ? `
            <div class="si-own-industry si-own-row" tabindex="0">
                ${ownTip}
                <div class="si-own-label">${ownRank > 0
                    ? `${ownLabel}: ranked #${ownRank} of ${ranked} supplying industries`
                    : `${ownLabel}: not ranked (no direct purchases from it in the ${isUN ? "Exiobase " + year + " tables" : "2020 model"})`}</div>
                <div class="si-row-head">
                    <span class="si-name" title="${ownIndustry.code}">${ownRank > 0 ? `<span class="si-rank">#${ownRank}</span>` : ""}${ownIndustry.name} (${ownIndustry.code})${ownStar}</span>
                    ${ownRank > 0 ? `<span class="si-value">${format(ownIndustry.total)}</span>` : ""}
                </div>
                ${ownRank > 0 ? `<div class="si-split">${pct(ownIndustry.total, totalInputs)}% of direct ${factor.amount ? "inputs" : "inputs' " + factorName} · ${split(ownIndustry)}</div>` : ""}
            </div>
        ` : ''}
        ${grid ? supportingIndustriesGridHTML(grid, state, stateName) : ""}
        ${reportLink}
    `;
}
