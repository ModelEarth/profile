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
    material: { label: "Material Use", noun: "metals and minerals", unit: "t", epa: false,
        un: { factors: { 909: 1000 }, note: "metals and minerals (factor_id 909)" } }, // kt to t
    health: { label: "Health: Toxicity", noun: "human toxicity", indicator: "HTOX", matrix: "N", unit: "CTUh" },
    air: { label: "Health: Respiratory", noun: "respiratory effects", indicator: "HRSP", matrix: "N", unit: "kg PM2.5 eq" },
    emp: { label: "Jobs Supported", noun: "jobs supported", indicator: "JOBS", matrix: "N", unit: "jobs",
        un: { factors: { 906: 1000 }, note: "employment (factor_id 906, in thousands of people)" } },
    va: { label: "Value Added", noun: "value added", indicator: "VADD", matrix: "D", usd: true, domesticOnly: true }
};
const SUPPORTING_INDUSTRIES_DEFAULT_FACTOR = "amt";
// The EPA and UN toggle left of the factor dropdown, keyed by the "source" hash value
const SUPPORTING_INDUSTRIES_SOURCES = {
    epa: { label: "EPA", title: "US EPA USEEIO 2020 state models" },
    un: { label: "UN", title: "Exiobase 2019 trade tables, split among states by BEA GDP by state" }
};
const SUPPORTING_INDUSTRIES_DEFAULT_SOURCE = "epa";

// A factor's settings for a source: the UN settings replace the EPA ones they share
function supportingIndustriesFactor(factorKey, source) {
    const factor = SUPPORTING_INDUSTRIES_FACTORS[factorKey];
    return source === "un" ? Object.assign({}, factor, factor.un) : factor;
}
function factorHasSource(factorKey, source) {
    const factor = SUPPORTING_INDUSTRIES_FACTORS[factorKey];
    return source === "un" ? !!factor.un : factor.epa !== false;
}

// UN option: the Exiobase trade tables in ModelEarth/trade-data, as each industry's national
// purchases (from US producers and imports) in US/domestic/trade-us.csv, placed in states with
// the BEA weights in US/domestic/category_state.csv and the categories in
// US/domestic/industry_category.csv. exiobase/tradeflow/bea/category_state.py writes all three.
// 2019 matches the interstate map.
const EXIOBASE_STATE_YEAR = "2019";
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

// The Top 10 panel: a heading, the EPA / UN toggle, the factor dropdown, the ranking and a note.
// options: element (a div to fill, otherwise a new one), manufacturer (on a product label: the
// note then says the ranking is the broader industry's, not that manufacturer's suppliers),
// ownLabel (the star's label for the sector's own industry), ownRankBox (false to leave out the
// box below the list giving the own industry's rank when it's outside the top rows) and
// footprintLink (false on the footprint page itself). Returns the element, setSector(sectorCode, exiobaseIndustries),
// show(state, key, onUnavailable), hide() and shownKey(). show() ranks the sector in that
// state, and calls onUnavailable when the state model fails to load (the panel then hides).
function createSupportingIndustriesPanel(options) {
    const opts = Object.assign({ ownLabel: "Product's manufacturing industry", ownRankBox: true, footprintLink: true }, options);
    const manufacturer = opts.manufacturer;
    let sectorCode = null;
    let exiobaseIndustries = [];
    const hash = (typeof getHash === "function") ? getHash() : {};
    let source = hash.source === "un" ? "un" : SUPPORTING_INDUSTRIES_DEFAULT_SOURCE;
    let factorKey = Object.prototype.hasOwnProperty.call(SUPPORTING_INDUSTRIES_FACTORS, hash.factor) ? hash.factor : SUPPORTING_INDUSTRIES_DEFAULT_FACTOR;
    const factorOptions = () => Object.keys(SUPPORTING_INDUSTRIES_FACTORS)
        .filter(key => factorHasSource(key, source))
        .map(key => `<option value="${key}"${key === factorKey ? " selected" : ""}>${SUPPORTING_INDUSTRIES_FACTORS[key].label}</option>`)
        .join("");
    const product = manufacturer ? ", not only this product" : "";
    const noteText = () => (source === "un"
        ? `Ranks the purchases made by the state's broader industry (all producers in ${exiobaseIndustries.join(", ")}${product})
            in the Exiobase ${EXIOBASE_STATE_YEAR} trade tables. They are split among states
            by each state's share of US GDP in the supplying and buying industries' categories (BEA), as the
            interstate tables are, so in-state supply is an estimate, not a survey of shipments.`
        : `Ranks the estimated direct materials and services supplied to the state's broader industry (all
            producers in the sector${product}), from the 2020 USEEIO state model.`) +
        (manufacturer ? ` These are not the actual suppliers of ${manufacturer}${manufacturer.endsWith(".") ? "" : "."}` : "");
    const div = opts.element || document.createElement("div");
    div.classList.add("supporting-industries");
    div.style.display = "none";
    div.innerHTML = `
        <div class="section-header">
            <h4>Top ${SUPPORTING_INDUSTRIES_COUNT} Industries Supplying Production</h4>
        </div>
        <div class="si-controls">
            <div class="si-source" role="group" aria-label="Data source">
                ${Object.keys(SUPPORTING_INDUSTRIES_SOURCES).map(key => `<button type="button" class="si-source-btn"
                    data-source="${key}" title="${SUPPORTING_INDUSTRIES_SOURCES[key].title}">${SUPPORTING_INDUSTRIES_SOURCES[key].label}</button>`).join("")}
            </div>
            <label class="si-factor">Factor:
                <select class="si-factor-select" aria-label="Factor used to rank the supplying industries"></select>
            </label>
        </div>
        <div class="supporting-industries-state"></div>
        <p class="supporting-industries-note"></p>
    `;
    const stateDiv = div.querySelector(".supporting-industries-state");
    const factorSelect = div.querySelector(".si-factor-select");
    const noteP = div.querySelector(".supporting-industries-note");
    const sourceButtons = div.querySelectorAll(".si-source-btn");
    let shownKey = null;
    let shownState = null;

    // The toggle, dropdown and note for the current source and sector
    function updateControls() {
        sourceButtons.forEach(button => {
            button.setAttribute("aria-pressed", String(button.dataset.source === source));
            button.disabled = button.dataset.source === "un" && !exiobaseIndustries.length;
        });
        factorSelect.innerHTML = factorOptions();
        noteP.innerHTML = noteText();
    }

    // Ranks the shown state by the selected source and factor. A newer state, source or
    // factor choice made while this one loads leaves its result unused.
    function showRanking(state, key) {
        const factor = factorKey;
        const from = source;
        const loading = from === "un" ? "Exiobase " + EXIOBASE_STATE_YEAR + " trade data for " + state
            : SUPPORTING_INDUSTRIES_FACTORS[factor].national ? "national energy data" : state + " state model";
        stateDiv.innerHTML = `<div class="supporting-industries-status">Loading ${loading}...</div>`;
        const ranking = from === "un"
            ? rankExiobaseInputs(state, exiobaseIndustries, factor)
            : loadSupportingIndustries(state, sectorCode).then(result => rankSupportingIndustries(result, factor));
        return ranking.then(result => {
            if (shownKey === key && factorKey === factor && source === from) stateDiv.innerHTML = supportingIndustriesHTML(result, opts);
        });
    }

    // The quiet hash update keeps the page from reloading
    function updateHashQuietly() {
        if (typeof goHashQuiet !== "function") return;
        const add = {};
        const remove = [];
        if (source === SUPPORTING_INDUSTRIES_DEFAULT_SOURCE) remove.push("source"); else add.source = source;
        if (factorKey === SUPPORTING_INDUSTRIES_DEFAULT_FACTOR) remove.push("factor"); else add.factor = factorKey;
        goHashQuiet(add, remove.join(","));
    }

    function rerank() {
        updateHashQuietly();
        if (!shownKey) return;
        const key = shownKey;
        showRanking(shownState, key).catch(error => rankingFailed(shownState, key, error));
    }

    factorSelect.addEventListener("change", () => {
        factorKey = factorSelect.value;
        rerank();
    });

    // EPA or UN. A factor the other source lacks goes back to Amount Spent.
    sourceButtons.forEach(button => button.addEventListener("click", () => {
        if (button.dataset.source === source) return;
        source = button.dataset.source;
        if (!factorHasSource(factorKey, source)) factorKey = SUPPORTING_INDUSTRIES_DEFAULT_FACTOR;
        updateControls();
        rerank();
    }));

    // The panel stays open: the EPA state model loaded but the factor's data (e.g. the national
    // model) did not, or the UN tables have no file for the state
    function rankingFailed(state, key, error) {
        console.warn("Top industries: could not rank " + state + " by " + factorKey + " (" + source + ")", error);
        if (shownKey !== key) return;
        stateDiv.innerHTML = source === "un"
            ? `<div class="supporting-industries-status">The Exiobase ${EXIOBASE_STATE_YEAR} trade tables could not be
                loaded. Choose EPA for this state.</div>`
            : `<div class="supporting-industries-status">${SUPPORTING_INDUSTRIES_FACTORS[factorKey].label}
                could not be loaded for ${state}. Choose another factor.</div>`;
    }

    // The sector to rank, with its Exiobase industries (none disables UN, which then goes back to EPA)
    function setSector(code, industries) {
        sectorCode = code;
        exiobaseIndustries = industries || [];
        if (source === "un" && !exiobaseIndustries.length) source = SUPPORTING_INDUSTRIES_DEFAULT_SOURCE;
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
// EXIOBASE_INDUSTRIES_BY_NAICS. Summary sectors with no industry (e.g. 42, 562) return none.
let exiobaseBySummaryRequest = null;
function exiobaseIndustriesForSummary(sectorCode) {
    if (!exiobaseBySummaryRequest) {
        exiobaseBySummaryRequest = Promise.all([
            fetchTradeDataText("year/" + EXIOBASE_STATE_YEAR + "/industry.csv"),
            fetchTradeDataText("concordance/exio_to_useeio2_commodity_concordance.csv"),
            fetch(USEEIO_STATE_MODEL_ENDPOINT + "/sectorcrosswalk.csv").then(response => {
                if (!response.ok) throw new Error(response.status + " for sectorcrosswalk.csv");
                return response.text();
            })
        ]).then(([industryText, concordanceText, crosswalkText]) => {
            const ids = new Map(parseCsvRows(industryText).map(row => [row.name, row.industry_id]));
            const summaryOf = new Map();
            parseCsvRows(crosswalkText).forEach(row => ["BEA_Detail", "BEA_Detail_Waste_Disagg"].forEach(col => {
                if (row[col] && !summaryOf.has(row[col])) summaryOf.set(row[col], row.BEA_Summary);
            }));
            const counts = new Map(); // industry_id -> summary -> detail sectors
            parseCsvRows(concordanceText).forEach(row => {
                const id = ids.get(row.Exiobase_Sector);
                const summary = summaryOf.get(row.USEEIO_Detail_2012);
                if (!id || !summary || /for treatment/.test(row.Exiobase_Sector)) return;
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
            return bySummary;
        });
        exiobaseBySummaryRequest.catch(() => { exiobaseBySummaryRequest = null; }); // allow a retry
    }
    return exiobaseBySummaryRequest.then(bySummary => bySummary.get(sectorCode) || []);
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
// loaded once
let exiobaseSharedRequest = null;
function loadExiobaseShared() {
    if (!exiobaseSharedRequest) {
        exiobaseSharedRequest = Promise.all([
            fetchTradeDataText("year/" + EXIOBASE_STATE_YEAR + "/industry.csv"),
            fetchTradeDataText("year/" + EXIOBASE_STATE_YEAR + "/US/domestic/industry_category.csv"),
            fetchTradeDataText("year/" + EXIOBASE_STATE_YEAR + "/US/domestic/category_state.csv"),
            fetchTradeDataText("concordance/eur_annual_rates.csv")
        ]).then(([industryText, categoryText, weightsText, ratesText]) => {
            const names = new Map(parseCsvRows(industryText)
                .map(row => [row.industry_id, String(row.name || row.industry_id).replace(/\s*\(\d+\)$/, "")]));
            const categories = new Map(parseCsvRows(categoryText).map(row => [row.industry_id, row.state_industry_code]));
            const weights = new Map(parseCsvRows(weightsText)
                .map(row => [row.state_industry_code + "|" + row.weight_type + "|" + row.state, parseFloat(row.weight) || 0]));
            const rates = parseCsvRows(ratesText).find(row => row.Year === EXIOBASE_STATE_YEAR);
            const usdPerEur = rates ? parseFloat(rates.USD) : NaN;
            if (!(usdPerEur > 0)) throw new Error("No " + EXIOBASE_STATE_YEAR + " USD rate in eur_annual_rates.csv");
            return { names, categories, weights, usdPerEur };
        });
        exiobaseSharedRequest.catch(() => { exiobaseSharedRequest = null; }); // allow a retry
    }
    return exiobaseSharedRequest;
}

// Every industry's national purchases (trade-us.csv), grouped by buying industry, loaded once
let exiobaseInputsRequest = null;
function loadExiobaseInputs() {
    if (!exiobaseInputsRequest) {
        exiobaseInputsRequest = fetchTradeDataText(`year/${EXIOBASE_STATE_YEAR}/US/domestic/trade-us.csv`).then(text => {
            const byIndustry = new Map();
            parseCsvRows(text).forEach(row => {
                if (!byIndustry.has(row.industry2)) byIndustry.set(row.industry2, []);
                byIndustry.get(row.industry2).push(row);
            });
            return byIndustry;
        });
        exiobaseInputsRequest.catch(() => { exiobaseInputsRequest = null; }); // allow a retry
    }
    return exiobaseInputsRequest;
}

// Ranks the industries supplying the product's Exiobase industries in the state. As in the
// interstate tables, a state pair's share of a national flow is the supplier's state weight
// (its share of US GDP in the supplying industry's category) times the buyer's (in the buying
// industry's category), here for all states. A US purchase splits into in-state (origin weight
// o of the state, times destination weight d) and other states ((1 - o) times d). Imports of
// the same industry pair place d of them in the state, shown as foreign. Amounts are millions
// of euros, shown in US dollars at the year's rate; factors sum their factor_id columns.
async function rankExiobaseInputs(state, targets, factorKey) {
    const factor = supportingIndustriesFactor(factorKey, "un");
    const [shared, inputs] = await Promise.all([loadExiobaseShared(), loadExiobaseInputs()]);
    const weight = (code, type) => shared.weights.get((shared.categories.get(code) || "services") + "|" + type + "|" + state) || 0;
    const usd = row => (parseFloat(row.amount) || 0) * 1e6 * shared.usdPerEur;
    const measure = factor.amount ? usd : row => Object.keys(factor.factors)
        .reduce((sum, id) => sum + (parseFloat(row[id]) || 0) * factor.factors[id], 0);
    const industries = new Map();
    let totalSpent = 0;
    targets.forEach(target => {
        const buyerShare = weight(target, "destination");
        if (!(buyerShare > 0)) return;
        (inputs.get(target) || []).forEach(row => {
            if (!industries.has(row.industry1)) {
                industries.set(row.industry1, { code: row.industry1, name: shared.names.get(row.industry1) || row.industry1, state: 0, restOfUS: 0, foreign: 0 });
            }
            const industry = industries.get(row.industry1);
            const value = measure(row) * buyerShare;
            if (row.origin === "foreign") {
                industry.foreign += value;
            } else {
                const inState = weight(row.industry1, "origin");
                industry.state += value * inState;
                industry.restOfUS += value * (1 - inState);
            }
            totalSpent += usd(row) * buyerShare;
        });
    });
    return Object.assign(rankIndustryRows(industries, new Set(targets)), {
        source: "un", state, sectorCode: targets.join(", "),
        sectorName: targets.map(code => shared.names.get(code) || code).join(", "),
        factorKey, totalSpent
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
function supportingIndustriesFactorNote(factor, source) {
    if (factor.amount) {
        return source === "un" ? `Amounts are millions of euros in the Exiobase ${EXIOBASE_STATE_YEAR} tables,
            shown in US dollars at the ${EXIOBASE_STATE_YEAR} exchange rate. Foreign imports are the national
            imports of each industry pair, placed in the state by its share of US GDP in the buying industry's
            category.` : "";
    }
    if (source === "un") {
        return `${factor.label} totals the ${factor.note} that the Exiobase ${EXIOBASE_STATE_YEAR} trade_factor
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
    const factor = supportingIndustriesFactor(factorKey, source);
    const format = value => formatFactorShort(value, factor);
    const factorName = factor.noun || "purchases";
    // getState (localsite.js) is a fixed list, unlike getStateNameFromID, which reads #state_select once it loads
    const stateName = (typeof getState === "function" && getState(state)) || state;
    if (isUN && top.length === 0) {
        return `<div class="supporting-industries-status">The Exiobase ${EXIOBASE_STATE_YEAR} trade tables place no
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
                ? `Its purchases from industries in ${stateName}, other states and abroad in the Exiobase ${EXIOBASE_STATE_YEAR}
                    tables total ${formatUsdShort(totalSpent)}${topText}`
                : `${formatUsdShort(output)} annual output, the estimated value of everything this industry
                    produced in ${stateName} in 2020. Its direct purchases of materials and services total
                    ${formatUsdShort(totalSpent)}${topText}`}
        </div>`;
    const split = row => `${stateName} ${format(row.state)} · Rest of US ${format(row.restOfUS)} · Foreign ${format(row.foreign)}`;
    const factorNote = supportingIndustriesFactorNote(factor, source);

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
                    : `${ownLabel}: not ranked (no direct purchases from it in the ${isUN ? "Exiobase " + EXIOBASE_STATE_YEAR + " tables" : "2020 model"})`}</div>
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
