// Sector and place footprint: the commodity list, Top 10 supporting industries, impacts chart, treemap and data sources.
// Fills the markup in template-footprint.html, which js/footprint-layout.js loads into profile/footprint/ and engine/.
// Loaded by footprint-layout.js after the template and the scripts it uses (config.js, commodities-report.js,
// ../item/js/supporting-industries.js and localsite/js/impact-sets.js).

// The footprint folder (profile/footprint/), from this script's own address, for files beside this page
const FOOTPRINT_BASE = new URL('../', document.currentScript ? document.currentScript.src : window.location.href).href;

renderTradeVizLinks(document.getElementById("trade-viz-links"));
loadMarkdown(FOOTPRINT_BASE + "sector_profile_info.md", "infoDiv", "_parent");
document.addEventListener('hashChangeEvent', hashChangedUseeio, false);
function hashChangedUseeio() {
  console.log("URL hash changed");
  model = getModel();
  // Keep the demand when it belongs to the model now in the hash: US-GA or RoUS for state=GA, US for the national model
  const hash = getHash();
  const location = String(hash.demand || '').split('/')[1];
  // The model is the first state's when the hash lists several, e.g. state=TX,GA
  const locations = getModelState() ? [`US-${getModelState()}`, 'RoUS'] : ['US'];
  // Quiet (replaceState), so the cleared demand doesn't add a Back step
  if (!locations.includes(location)) goHashQuiet({}, ['demand']);
  main();
}

// Energy indicators are only in the national model: drop the state from the hash and show the
// national sector matching the current state sector (BEA Summary -> first BEA Detail in sectorcrosswalk.csv).
// Uses fetch rather than model.sectorCrosswalk(), whose request adds a Content-Type header: GitHub refuses
// that CORS preflight and the request never resolves.
async function showNationalModel(setId) {
  const hash = getHash();
  let demand = '';
  try {
    const code = String(hash.demand || '').split('/')[0];
    const response = await fetch(`${getUseeioJsonEndpoint()}/sectorcrosswalk.csv`);
    if (!response.ok) throw new Error(`sectorcrosswalk.csv ${response.status}`);
    const rows = (await response.text()).trim().split(/\r?\n/).map(line => line.split(',').map(v => v.replace(/^"|"$/g, '')));
    const header = rows.shift() || [];
    const summaryCol = header.indexOf('BEA_Summary');
    const detailCols = [header.indexOf('BEA_Detail'), header.indexOf('BEA_Detail_Waste_Disagg')].filter(i => i >= 0);
    const nationalCodes = new Set((await getModelByName('USEEIOv2.0.1-411').sectors()).map(s => s.code));
    for (const row of rows) {
      if (row[summaryCol] !== code) continue;
      const detail = detailCols.map(i => row[i]).find(c => nationalCodes.has(c));
      if (detail) { demand = `${detail}/US`; break; }
    }
  } catch (e) {
    console.warn('No national sector for this state sector', e);
  }
  // A blank demand shows the top national sector
  goHash({ set: setId, demand: demand }, ['state', 'indicators']);
}

function norm100(nums) {
  let max = 0;
  for (const num of nums) {
    max = Math.max(Math.abs(num), max);
  }
  if (max === 0) {
    return nums;
  }
  const norm = [];
  for (const num of nums) {
    norm.push(100 * num / max)
  }
  return norm;
}

// The model's own commodities, without Rest of US (or Rest of World) in state models
function isOwnRegion(sector) {
  return sector.location !== 'RoUS' && sector.location !== 'RoW';
}

// Top commodities by Output for the current model, with the State Total and Rest of US below.
// Clicking a row shows its profile; clicking the selected row again shows all of the place's industries.
let commoditiesReport = null;
function loadCommoditiesReport() {
  if (!commoditiesReport) {
    commoditiesReport = CommoditiesReport.create({
      table: 'commodityTable',
      rows: 5,
      filter: isOwnRegion,
      linkNames: false,
      onRender: showCommodityTitle,
      selected: () => getHash().demand || '',
      onRowClick: (row, selected) => {
        if (selected) goHash({}, ['demand']); // All of the place's industries
        else goHash({ demand: `${row.code}/${row.location}` });
      }
    });
  }
  commoditiesReport.load(); // Loads alongside the sector profile; reuses rows until the model changes
}

// ---- The place the page covers ----
// With no commodity in the hash (demand), the impacts chart, treemap and data sources cover all the
// industries of a place: a state (state=GA), the US (country=US), a country (country=CN) or the World (country=all).
// With no country, state or commodity in the hash, the page shows the World.
// EPA's USEEIO models cover the US and its states, so a country or the World always shows UN (Exiobase),
// with or without a commodity in the hash.

// The country codes in the hash, e.g. CN and IN for country=CN,IN, and ALL for the World
function footprintCountries() {
  return String(getHash().country || '').split(',').map(c => c.trim().toUpperCase())
    .filter(c => /^[A-Z]{2}$/.test(c) || c === 'ALL' || c === 'WORLD');
}
// {kind: 'world' | 'country' | 'state' | 'us', location, label}. country=all (or world) is the World.
// The hash's first country decides (country=IN,US is India). A country other than the US comes before a state.
// Without a country, a state or a commodity (demand, or the older index and industry) means the US.
function footprintRegion() {
  const country = footprintCountries()[0];
  const hash = getHash();
  const world = { kind: 'world', location: 'WORLD', label: 'World' };
  if (country === 'ALL' || country === 'WORLD') return world;
  if (!country && !getModelState() && !hash.demand && !hash.index && !hash.industry) return world;
  if (country && country !== 'US') return { kind: 'country', location: country, label: typeof exiobaseRegionName === 'function' ? exiobaseRegionName(country) : country };
  const state = getModelState();
  if (state) return { kind: 'state', location: `US-${state}`, state, label: (typeof getState === 'function' && getState(state)) || state };
  return { kind: 'us', location: 'US', label: 'United States' };
}
// True for a country outside the US or the World, which only UN covers
function footprintOutsideUS() {
  const kind = footprintRegion().kind;
  return kind === 'world' || kind === 'country';
}
// The countries with Exiobase data every year (not WM, Rest of Middle East), listed beside "Countries" in
// localsite's location menu (navigation.js) and first in the country dropdown
const FOOTPRINT_TOP_COUNTRIES = EXIOBASE_PROCESSED_REGIONS.filter(region => region !== 'WM');
window.geoviewCountries = FOOTPRINT_TOP_COUNTRIES;
if (typeof setGeoviewCountries === 'function') setGeoviewCountries(FOOTPRINT_TOP_COUNTRIES);

// The country dropdown in the matrix toolbar: "Country..." (the World), the countries with yearly Exiobase data, then all
// countries, from localsite's list (loadCountryNames in localsite.js). Choosing one sets country=, including country=US,
// since no country is the World.
function setupCountrySelect() {
  const select = document.getElementById('footprintCountry');
  if (!select || select.dataset.ready || typeof loadCountryNames !== 'function') return;
  select.dataset.ready = '1';
  loadCountryNames().then(names => {
    const option = (code, name) => new Option(name, code);
    select.add(option('all', 'Country...')); // The World
    const top = document.createElement('optgroup');
    top.label = 'Exiobase data every year';
    FOOTPRINT_TOP_COUNTRIES.map(code => [code, names.get(code) || code])
      .sort((a, b) => a[1].localeCompare(b[1])).forEach(([code, name]) => top.appendChild(option(code, name)));
    select.add(top);
    const all = document.createElement('optgroup');
    all.label = 'All countries';
    [...names].sort((a, b) => a[1].localeCompare(b[1])).forEach(([code, name]) => all.appendChild(option(code, name)));
    select.add(all);
    markCountrySelect();
  }).catch(error => {
    console.warn('Country dropdown: ' + error.message);
    select.style.display = 'none';
  });
  select.addEventListener('change', () => {
    const code = select.value;
    const hash = { country: code };
    // A country without yearly Exiobase data is only in the years with all regions (2018), so switch to the newest of them
    if (code !== 'all' && !FOOTPRINT_TOP_COUNTRIES.includes(code) && !EXIOBASE_ALL_REGIONS_YEARS.includes(getExiobaseYear())) {
      hash.year = EXIOBASE_ALL_REGIONS_YEARS.slice().sort().pop();
    }
    goHash(hash);
  });
}
// Selects the hash's first country (World for country=all or world and without a place, United States for a US state)
function markCountrySelect() {
  setupCountrySelect();
  const select = document.getElementById('footprintCountry');
  if (!select || !select.options.length) return;
  const region = footprintRegion();
  select.value = region.kind === 'world' ? 'all' : region.kind === 'country' ? region.location : 'US';
}

// Outside the US the EPA buttons are hidden: EPA's USEEIO models cover the US and its states
function markEpaAvailability(container) {
  const outside = footprintOutsideUS();
  container.querySelectorAll('.si-source-btn[data-source="epa"]').forEach(button => {
    button.hidden = outside;
  });
}

// UN commodity list: Exiobase industries' sales to industries in the same place, from exiobaseCommodityRows()
// in ../item/js/supporting-industries.js, through the same CommoditiesReport as the EPA commodities. Shown
// in their place when the UN / EPA toggle above them is on UN, and always for a country or the World.
// The region buttons offer the US and each state in the hash (US-made sales to US industries, states'
// shares by BEA GDP); or each country in the hash and the World; or for the World, each processed region.
// A button puts its place first in the hash (unRegionHash), and the page follows the hash.
let commoditiesReportUN = null;
let unCommodityInfo = null;        // The loaded year's {year, weightsYear, missing, places}
let unSelectedIds = new Set();     // Exiobase industries of the selected commodity, outlined in the list

function showsUnCommodities() {
  return typeof showsExiobase === 'function' && showsExiobase();
}
// The states in the hash, e.g. GA and TX for state=GA,TX
function unCommodityStates() {
  return String(getHash().state || '').split(',').map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{2}$/.test(s));
}
// The places the UN list offers, as row locations
function unCommodityLocations() {
  const region = footprintRegion();
  if (region.kind === 'world') return ['WORLD'].concat(EXIOBASE_PROCESSED_REGIONS);
  if (region.kind === 'country') return [...new Set(footprintCountries().filter(c => c !== 'ALL').concat('WORLD'))];
  return ['US'].concat(unCommodityStates().map(s => `US-${s}`));
}
function isUsLocation(location) {
  return location === 'US' || /^US-/.test(location || '');
}
// The listed place: the page's place, from the hash
function unCommodityRegion() {
  const locations = unCommodityLocations();
  const own = footprintRegion().location;
  return locations.includes(own) ? own : locations[0];
}
// The hash values that show a region button's place. The place goes first in its list and the rest stay,
// as with the other hash lists (country=DE,CN shows Germany): WORLD is country=all, CN is country=CN,
// US-TX is state=TX (state=TX,GA from state=GA,TX), and US is country=US without a state.
function unRegionHash(location) {
  const key = v => { const k = v.trim().toUpperCase(); return k === 'WORLD' ? 'ALL' : k; };
  const first = (value, list) => [value].concat(list.filter(v => v.trim() && key(v) !== key(value))).join(',');
  const countries = String(getHash().country || '').split(',');
  if (location === 'WORLD') return { country: first('all', countries) };
  if (/^US-/.test(location)) return { state: first(location.slice(3), unCommodityStates()) };
  if (location === 'US') {
    if (typeof hiddenhash === 'object') hiddenhash.state = ''; // So localsite doesn't bring the prior state back
    return { country: first('US', countries), state: '' };
  }
  return { country: first(location, countries) };
}
function unRegionName(location) {
  if (location === 'US') return 'US';
  if (/^US-/.test(location)) {
    const state = location.slice(3);
    return (typeof getState === 'function' && getState(state)) || state;
  }
  const place = unCommodityInfo && (unCommodityInfo.places || []).find(p => p.location === location);
  return place ? place.name : exiobaseRegionName(location);
}
// What Sales covers in a place
function unSalesPhrase(location) {
  if (isUsLocation(location)) return 'US-made sales to US industries';
  if (location === 'WORLD') return 'sales to industries in their own country or region, in each processed region';
  return 'sales to industries in the same country or region';
}

// Industry, Sales, Jobs and GHG. Jobs and GHG are left out for years without those factors (2023, 2024).
function unCommodityColumns(locale, formatType, narrow) {
  const missing = (unCommodityInfo && unCommodityInfo.missing) || [];
  const column = (title, field, maxWidth, minWidth, tip) => Object.assign(
    CommoditiesReport.numberColumn(title, field, maxWidth, locale, formatType, minWidth),
    { headerTooltip: tip });
  const sales = unSalesPhrase(unCommodityRegion());
  return [
    { title: 'Exiobase Industry', field: 'name', widthGrow: 4, minWidth: 200,
      formatter: cell => `${cell.getValue()} <span style="opacity:0.6">${cell.getRow().getData().code}</span>` },
    column('Sales', 'output', '115px', 100, `${sales.charAt(0).toUpperCase() + sales.slice(1)}, in US dollars at the year's exchange rate`),
    ...(missing.includes('jobs') ? [] : [column('Jobs', 'jobs', narrow ? '70px' : '100px', null, 'Jobs (Exiobase employment, factor_id 906) on those sales')]),
    ...(missing.includes('greenhouse gases') ? [] : [column('GHG', 'ghg', '120px', null, 'Metric tons of CO2 equivalent (factor_id 901 to 905) on those sales')])
  ];
}

function unCommodityTotalsLine(label, totals) {
  const missing = (unCommodityInfo && unCommodityInfo.missing) || [];
  return `<strong>${label}:</strong> $${formatCell(totals.output)} in sales to industries`
    + (missing.includes('jobs') ? '' : `, ${formatCell(totals.jobs)} jobs`)
    + (missing.includes('greenhouse gases') ? '' : `, <span style="white-space:nowrap">${formatCell(totals.ghg)} metric tons of CO2 equivalent</span>`) + '.';
}

// Totals for each offered place
function unCommodityRegionTotals(rows) {
  return unCommodityLocations().map(location => {
    const totals = { output: 0, jobs: 0, ghg: 0 };
    rows.filter(row => row.location === location).forEach(row => {
      totals.output += row.output || 0;
      totals.jobs += row.jobs || 0;
      totals.ghg += row.ghg || 0;
    });
    return { label: location === 'US' ? 'US Total' : unRegionName(location), totals };
  }).filter(region => region.totals.output > 0);
}

// Clicking an industry shows the EPA commodity it belongs to: its summary sector in a state model (the
// state of the listed region goes first in the hash), or its first detail sector in the national model.
// Industries outside the US have no EPA commodity.
async function selectUnIndustry(row, selected) {
  const status = document.getElementById('commodityUNStatus');
  if (footprintOutsideUS() || !isUsLocation(row.location)) {
    if (status) status.textContent = `EPA commodity profiles cover the US and its states, so the reports below show all of ${footprintRegion().label}'s industries rather than ${row.name}.`;
    return;
  }
  if (selected) {
    goHash({}, ['demand']);
    return;
  }
  const states = unCommodityStates();
  const state = row.location === 'US' ? states[0] : row.location.replace(/^US-/, '');
  let demand = null;
  if (state) {
    const summary = await exiobaseSummaryFor(row.code).catch(() => null);
    if (summary) demand = `${summary}/US-${state}`;
  } else {
    const codes = new Set((await model.sectors()).map(s => s.code));
    const detail = (await exiobaseDetailsFor(row.code).catch(() => [])).find(code => codes.has(code));
    if (detail) demand = `${detail}/US`;
  }
  if (!demand) {
    if (status) status.textContent = `No EPA commodity matches ${row.name} (${row.code}) in the concordance.`;
    return;
  }
  if (status) status.textContent = '';
  const add = { demand };
  if (state && states[0] !== state) add.state = [state].concat(states.filter(s => s !== state)).join(',');
  goHash(add);
}

// The Exiobase industries of the selected commodity, outlined in the UN list
async function updateUnSelection() {
  const [code, location] = String(getHash().demand || '').split('/');
  let ids = [];
  if (code && !footprintOutsideUS() && typeof exiobaseIndustriesForSummary === 'function') {
    ids = await (location === 'US' ? exiobaseIndustriesForDetail(code) : exiobaseIndustriesForSummary(code)).catch(() => []);
  }
  unSelectedIds = new Set(ids);
  if (commoditiesReportUN) commoditiesReportUN.markSelected();
}

function loadCommoditiesReportUN() {
  if (!commoditiesReportUN) {
    commoditiesReportUN = CommoditiesReport.create({
      table: 'commodityTableUN',
      loading: 'commodityUNLoading',
      rows: 5,
      noun: 'industries',
      rankLabel: 'Sales',
      cacheKey: () => `un/${getExiobaseYear()}/${unCommodityLocations().join(',')}`,
      loadRows: async () => {
        const locations = unCommodityLocations();
        const result = await exiobaseCommodityRows(getExiobaseYear(), unCommodityStates(), footprintOutsideUS() ? locations : null);
        unCommodityInfo = result;
        return result.rows.sort((a, b) => b.output - a.output).map(row => Object.assign(row, {
          outputEasy: '$' + formatCell(row.output),
          jobsEasy: row.jobs == null ? '' : formatCell(row.jobs),
          ghgEasy: row.ghg == null ? '' : formatCell(row.ghg)
        }));
      },
      regionTotals: unCommodityRegionTotals,
      filter: row => row.location === unCommodityRegion(),
      columns: unCommodityColumns,
      totalsLine: unCommodityTotalsLine,
      isSelected: row => unSelectedIds.has(row.code),
      onRowClick: selectUnIndustry,
      onRender: () => { showCommodityTitle(); showUnCommodityRegions(); showUnCommoditySources(); }
    });
  }
  showUnCommodityRegions();
  commoditiesReportUN.load();
  updateUnSelection();
}

// The title above the shown list, with the count chosen below the table ("All 163" when all show):
// "Top 5 Georgia Industries" for UN's Exiobase industries, "Top 5 Georgia Commodities" for EPA's model commodities
function showCommodityTitle() {
  const el = document.getElementById('commodityUNTitle');
  if (!el) return;
  const un = showsUnCommodities();
  const report = un ? commoditiesReportUN : commoditiesReport;
  const count = report ? report.listedCount() : 0;
  const limit = report ? report.shownLimit() : 0;
  el.textContent = count ? `${limit ? `Top ${limit}` : `All ${count}`} ${unRegionName(unCommodityRegion())} ${un ? 'Industries' : 'Commodities'}` : '';
}

// Buttons choosing the place the UN or EPA list shows. For EPA, a state's button shows its state model and US the national model.
function showUnCommodityRegions() {
  const el = document.getElementById('commodityUNRegions');
  if (!el) return;
  const locations = unCommodityLocations();
  el.style.display = locations.length > 1 ? '' : 'none';
  const shown = unCommodityRegion();
  const what = showsUnCommodities() ? 'Exiobase industries' : 'EPA commodities';
  el.innerHTML = locations.map(location =>
    `<button type="button" data-region="${location}" aria-pressed="${location === shown}"
      title="${what} in ${unRegionName(location)}">${location === 'WORLD' ? 'World' : location.replace(/^US-/, '')}</button>`).join('');
}

// Why a place has no rows: not in the year's files (only 2018 has all 49 Exiobase regions), or not a
// country in the concordance
function missingPlaceHTML(place, year) {
  if (!place.regions.length) return `${place.location} isn't a country code in Exiobase's country concordance.`;
  const name = place.name + (place.partOf ? ` (in Exiobase's ${exiobaseRegionName(place.partOf)})` : '');
  const other = EXIOBASE_ALL_REGIONS_YEARS.filter(y => y !== String(year));
  return `${name} isn't in the Exiobase ${year} files, which hold the ${EXIOBASE_PROCESSED_REGIONS.length} regions processed every year.`
    + (other.length ? ` ${other.join(' and ')} has all ${EXIOBASE_WORLD_COVERAGE.regions} Exiobase regions: `
      + other.map(y => `<a href="#" class="footprintYearLink" data-year="${y}">show ${y}</a>`).join(', ') + '.' : '');
}

// How much of the world the World view covers: the regions it adds up, what it leaves out, and their
// shares of the world in 2018, when all 49 Exiobase regions were processed (EXIOBASE_WORLD_COVERAGE)
function worldCoverageHTML(year, shownRegions) {
  const c = EXIOBASE_WORLD_COVERAGE;
  const pct = v => `${(v * 100).toFixed(1)}%`;
  const names = shownRegions.map(exiobaseRegionName);
  const absent = EXIOBASE_PROCESSED_REGIONS.filter(region => !shownRegions.includes(region));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
  return `<b>World</b> adds up the ${shownRegions.length} Exiobase regions in the ${year} files: ${list}`
    + (absent.length ? ` (${absent.map(exiobaseRegionName).join(', ')} missing for ${year})` : '')
    + `. It covers trade within each region, leaving out trade between them, which is in each region's exports and imports files. `
    + `In ${c.year}, when all ${c.regions} Exiobase regions were processed, these ${EXIOBASE_PROCESSED_REGIONS.length} held ${pct(c.sales)} of the world's within-country industry sales, `
    + `${pct(c.ghg)} of the greenhouse gases on those sales and ${pct(c.jobs)} of the jobs. The largest regions left out: `
    + c.missing.map(([region, share]) => `${exiobaseRegionName(region)} (${pct(share)} of sales)`).join(', ')
    + ` and ${c.otherCount} others (${pct(c.otherMissing)} together).`
    + (EXIOBASE_ALL_REGIONS_YEARS.includes(String(year)) ? ` The ${year} files have all ${c.regions} regions: choose a country (country=ES) to see one of the others.` : '');
}

// Below the UN list: what the numbers are, the source files (the Data Sources table's columns, from
// renderDataSourcesTable) and the Exiobase year status page
function showUnCommoditySources() {
  const note = document.getElementById('commodityUNNote');
  const status = document.getElementById('commodityUNStatus');
  const info = unCommodityInfo;
  if (!note || !info) return;
  const location = unCommodityRegion();
  const us = isUsLocation(location);
  const place = (info.places || []).find(p => p.location === location);
  const folders = us ? ['US'] : (place ? place.shownRegions : []);
  if (status && place && !place.shownRegions.length) status.innerHTML = missingPlaceHTML(place, info.year);
  else if (status && /isn't in the Exiobase|concordance\.$/.test(status.textContent)) status.textContent = '';
  const yearNote = typeof EXIOBASE_YEAR_NOTES !== 'undefined' && EXIOBASE_YEAR_NOTES[info.year];
  const states = unCommodityStates();
  const sourcePath = folders.length === 1 ? `year/${info.year}/${folders[0]}/domestic` : `year/${info.year}`;
  note.innerHTML = `Sales are each Exiobase industry's ${unSalesPhrase(location)} in the Exiobase ${info.year} trade tables, `
    + `in US dollars at the ${info.year} rate (${info.usdPerEur} per euro). The tables hold industry-to-industry flows only, `
    + `so sales to households, government and other countries aren't included${us ? ', and Sales is smaller than EPA\'s Output' : ''}.`
    + (us && states.length ? ` A state's rows are the US rows times the state's share of US GDP in the industry's category (BEA, from the ${info.weightsYear} state tables).` : '')
    + (place && place.partOf ? ` ${place.name} has no Exiobase region of its own, so its rows are for ${exiobaseRegionName(place.partOf)} (${place.partOf}), which includes it.` : '')
    + (location === 'WORLD' && place ? ' ' + worldCoverageHTML(info.year, place.shownRegions) : '')
    + (yearNote ? ` <b>${info.year} has ${yearNote}.</b>` : '')
    + `<br>Source: <a href="https://github.com/ModelEarth/trade-data/tree/main/${sourcePath}" target="_blank">trade-data/${sourcePath}</a>`
    + ` &middot; <a href="#" id="commodityUNSourcesToggle">Data sources</a>`
    + ` &middot; <a href="${exiobaseStatusUrl()}" target="_blank">Exiobase year file status (2018 to 2024)</a>`;
  const table = document.getElementById('commodityUNSources');
  if (table && table.style.display !== 'none') renderDataSourcesTable('#commodityUNSources', unCommoditySourceRows());
}

// Data source rows for the UN views: the domestic files of each Exiobase region folder used, the shared
// files, the state weights (options.states) or the country concordance (options.countries), and the
// year status page
function exiobaseSourceRows(year, weightsYear, folders, options) {
  const blob = path => `https://github.com/ModelEarth/trade-data/blob/main/${path}`;
  const tree = path => `https://github.com/ModelEarth/trade-data/tree/main/${path}`;
  const one = folders.length === 1;
  const where = one ? (folders[0] === 'US' ? 'the US' : exiobaseRegionName(folders[0])) : `each of ${folders.length} regions (${folders.join(', ')})`;
  const rows = [
    { dataset: 'Domestic trade flows', description: `Industry-to-industry flows within ${where} in ${year}, millions of euros`,
      usage: 'Sales: each industry\'s total as the supplier (industry1)', format: 'CSV',
      url: one ? blob(`year/${year}/${folders[0]}/domestic/trade.csv`) : tree(`year/${year}`), label: one ? null : `${folders.length} trade.csv files` },
    { dataset: 'Trade factors', description: 'Factor levels carried on each flow, by trade_id and factor_id',
      usage: 'GHG (factor_id 901 to 905, weighted by warming potential), Jobs (906), Land (908), Material (909) and Water (910)', format: 'CSV',
      url: one ? blob(`year/${year}/${folders[0]}/domestic/trade_factor.csv`) : tree(`year/${year}`), label: one ? null : `${folders.length} trade_factor.csv files` },
    { dataset: 'Factors', description: 'Names and units of each factor_id', usage: 'Units for each indicator', format: 'CSV', url: blob(`year/${year}/factor.csv`) },
    { dataset: 'Industries', description: 'Exiobase industry ids and names', usage: 'Industry names', format: 'CSV', url: blob(`year/${year}/industry.csv`) },
    { dataset: 'Exchange rates', description: 'Annual euro exchange rates', usage: 'Euros to US dollars', format: 'CSV', url: blob('concordance/eur_annual_rates.csv') }
  ];
  if (options && options.states) {
    rows.push(
      { dataset: 'Industry categories', description: `Each Exiobase industry's BEA category (${weightsYear})`,
        usage: 'Which state weight applies to an industry', format: 'CSV', url: blob(`year/${weightsYear}/US/domestic/industry_category.csv`) },
      { dataset: 'State weights', description: `Each state's share of US GDP by category, from BEA SAGDP2 (${weightsYear})`,
        usage: 'A state\'s share of each industry\'s US sales', format: 'CSV', url: blob(`year/${weightsYear}/US/domestic/category_state.csv`) });
  }
  if (options && options.countries) {
    rows.push({ dataset: 'Country regions', description: 'Each country\'s Exiobase region: its own, or one of five Rest of World regions',
      usage: 'Which region\'s files a country shows', format: 'CSV', url: blob('concordance/exio_country_concordance.csv') });
  }
  rows.push({ dataset: 'Year file status', description: 'Each Exiobase year\'s files and processing notes, 2018 to 2024',
    usage: 'Which years have greenhouse gas and jobs factors', format: 'Web page', url: exiobaseStatusUrl(), label: 'exiobase/tradeflow' });
  return rows;
}
function unCommoditySourceRows() {
  const info = unCommodityInfo || { year: getExiobaseYear(), weightsYear: exiobaseStateTablesYear(getExiobaseYear()) };
  const location = unCommodityRegion();
  const us = isUsLocation(location);
  const place = (info.places || []).find(p => p.location === location);
  return exiobaseSourceRows(info.year, info.weightsYear, us ? ['US'] : (place ? place.shownRegions : []),
    { states: us && unCommodityStates().length > 0, countries: !us });
}

// The UN / EPA toggle above the commodities: EPA's model commodities or the UN list
function showCommoditySource() {
  const un = showsUnCommodities();
  const sourceEl = document.getElementById('commoditySource');
  if (sourceEl && typeof sourceButtonsHTML === 'function') {
    if (!sourceEl.firstElementChild) {
      sourceEl.innerHTML = sourceButtonsHTML();
      setupSourceButtons(sourceEl);
    }
    markSourceButtons(sourceEl, un ? 'un' : 'epa');
    markEpaAvailability(sourceEl);
  }
  document.getElementById('commodityEPA').style.display = un ? 'none' : '';
  document.getElementById('commodityUN').style.display = un ? '' : 'none';
  // Each list loads while shown, so Tabulator sizes its columns
  showCommodityTitle(); // Until the list renders: the shown report's title, or none while it first loads
  if (un) {
    loadCommoditiesReportUN();
  } else {
    showUnCommodityRegions();
    loadCommoditiesReport();
  }
}

document.addEventListener('click', e => {
  const button = e.target.closest('#commodityUNRegions button[data-region]');
  if (button) {
    if (button.getAttribute('aria-pressed') !== 'true') goHash(unRegionHash(button.dataset.region));
    return;
  }
  const yearLink = e.target.closest('a.footprintYearLink[data-year]');
  if (yearLink) {
    e.preventDefault();
    goHash({ year: yearLink.dataset.year });
    return;
  }
  if (e.target.closest('#commodityUNSourcesToggle')) {
    e.preventDefault();
    const table = document.getElementById('commodityUNSources');
    const open = table.style.display === 'none';
    table.style.display = open ? '' : 'none';
    if (open) renderDataSourcesTable('#commodityUNSources', unCommoditySourceRows());
  }
});
document.addEventListener('supportingIndustriesSource', showCommoditySource);

// ---- All industries of a place ----
// regionView holds {region, source, outside, data} while the page shows all of a place's industries.
// EPA: Industries = D × q (each industry's own impacts per $1 times its output, over the place's
//   industries), Consumption = N × y (the supply chain footprint of the place's final consumption,
//   including what it buys from elsewhere), and the treemap sizes the industries by output (q) or by
//   one indicator's D × q.
// UN: the factors on the place's industries' sales to industries in the same place (domestic files),
//   with the largest regions (World) or industries, and the treemap sizes the industries by those sales
//   or one factor. The World splits each industry into its regions.
let regionView = null;
let matrixImpactClicked = false; // An impacts chart row was clicked to choose the treemap's indicator

// "Output" for EPA and "Sales" for UN while the page shows a place, otherwise "Total Spent"
function matrixAmountLabel() {
  if (!regionView) return 'Total Spent';
  return regionView.source === 'un' ? 'Sales' : 'Output';
}

// The sector view's parts that don't apply to a place: the Sellers / Buyers toggle, Per $1, and the
// Suppliers / Industry / Buyers parts of the impacts chart
function setRegionModeUI(on) {
  document.getElementById('matrixDirection').style.display = on ? 'none' : '';
  document.getElementById('indicatorParts').style.display = on ? 'none' : '';
  document.getElementById('indicatorRegionNote').style.display = on ? 'none' : '';
  const perDollar = document.querySelector('#matrixRank button[data-rank="coefficient"]');
  if (perDollar) perDollar.style.display = on ? 'none' : '';
}
function leaveRegionView() {
  if (!regionView) return;
  regionView = null;
  showIndicatorYearNote();
  setRegionModeUI(false);
  // Back to the hash's source (a country or the World forced UN), and EPA's button shows again
  matrixSource = typeof getSupportingIndustriesSource === 'function' ? getSupportingIndustriesSource() : 'epa';
  markMatrixSource();
}

async function showRegionView(region, run) {
  const info = document.getElementById('info');
  const outside = region.kind === 'world' || region.kind === 'country';
  const source = (outside || showsExiobase()) ? 'un' : 'epa';
  regionView = { region, source, outside };
  showIndicatorYearNote();
  showSupportingIndustries(null);
  setRegionModeUI(true);
  matrixSource = source;
  matrixEpa = null;
  matrixExiobase = null;
  info.innerHTML = `<h3 style="font-size:22px">${region.label}: All Industries</h3>`
    + (source === 'un' ? `Loading the Exiobase ${getExiobaseYear()} trade tables${region.kind === 'world' ? ` for ${EXIOBASE_PROCESSED_REGIONS.length} regions` : ''}...` : 'Loading...');
  try {
    const data = source === 'un' ? await unRegionData(region) : await epaRegionData(region);
    if (run !== mainRun) return;
    regionView.data = data;
    if (data.label) region.label = data.label;
    info.innerHTML = regionInfoHTML();
    showIndicatorYearNote();
    if (data.place && !data.place.shownRegions.length) { // Not in the year's files: only the note above
      ['indicatorToolbar', 'dataSourcesSection'].forEach(id => { document.getElementById(id).style.display = 'none'; });
      // The matrix keeps its toolbar's country dropdown, to choose another country
      const matrixSection = document.getElementById('matrixSection');
      matrixSection.classList.add('matrix-place-missing');
      matrixSection.style.display = 'block';
      if (mainTable) { mainTable.destroy(); mainTable = null; }
      document.getElementById('indicatorBarChart').innerHTML = '';
      document.getElementById('impactPointer').style.display = 'none';
      return;
    }
    fullTableData = data.indicators;
    // Indicator for the treemap's Impact view: the one clicked before, else GHG. An indicator picked only
    // because GHG was missing (2023 and 2024 UN) doesn't carry over to the next view.
    const impactRow = fullTableData.find(d => matrixImpact && matrixImpactClicked && d.code === matrixImpact.code)
      || fullTableData.find(d => d.code === 'GHG') || fullTableData[0];
    matrixImpact = impactRow ? { code: impactRow.code, index: impactRow.index, name: impactRow.name, unit: impactRow.unit } : null;
    if (impactSetControl) impactSetControl.setAvailable(fullTableData.map(d => d.code), ['energy']);
    document.getElementById('indicatorToolbar').style.display = '';
    filterTableData();
    displayTable();
    await showRegionMatrix(run);
    if (run === mainRun) showRegionDataSources();
  } catch (error) {
    console.error('All industries view failed', error);
    if (run === mainRun) info.innerHTML = `<h3 style="font-size:22px">${region.label}: All Industries</h3><em>Could not load: ${error.message}</em>`;
  }
}

// EPA totals for the state model's own industries, or every industry in the national model
async function epaRegionData(region) {
  const sectors = await model.sectors();
  const own = sectors.filter(s => region.kind === 'state' ? s.location === region.location : isOwnRegion(s));
  const [indicators, D, N, q, demandId] = await Promise.all([
    model.indicators(), model.matrix('D'), model.matrix('N'), model.matrix('q'),
    model.findDemand({ system: 'Complete', type: 'Consumption' })
  ]);
  const demand = demandId ? await model.demand(demandId) : [];
  const indexOf = new Map(sectors.map(s => [s.id, s.index]));
  const y = new Array(sectors.length).fill(0);
  (demand || []).forEach(entry => {
    const i = indexOf.get(entry.sector);
    if (i != null) y[i] = entry.amount || 0;
  });
  const qAt = j => (q.data[j] ? q.data[j][0] : 0) || 0;
  const rows = indicators.map(indicator => {
    const d = D.data[indicator.index] || [];
    const n = N.data[indicator.index] || [];
    return {
      indicator: `${indicator.name} (${indicator.code})`, code: indicator.code, index: indicator.index,
      name: indicator.name, unit: indicator.unit,
      produced: own.reduce((t, s) => t + (d[s.index] || 0) * qAt(s.index), 0),
      consumed: y.reduce((t, amount, j) => t + (n[j] || 0) * amount, 0)
    };
  });
  return {
    indicators: rows, D, demandId, modelName: getModelFolderName(),
    industries: own.map(s => ({ code: s.code, name: s.name, location: s.location, index: s.index, output: qAt(s.index) }))
  };
}

// UN totals for the place's Exiobase industries, for each indicator with an Exiobase factor in the year
async function unRegionData(region) {
  const year = getExiobaseYear();
  let result;
  if (region.kind === 'world') result = await exiobaseCommodityRows(year, [], ['WORLD'].concat(EXIOBASE_PROCESSED_REGIONS));
  else if (region.kind === 'country') result = await exiobaseCommodityRows(year, [], [region.location]);
  else result = await exiobaseCommodityRows(year, region.kind === 'state' ? [region.state] : []);
  const rows = result.rows.filter(row => row.location === region.location);
  const place = (result.places || []).find(p => p.location === region.location) || null;
  // The World's industries in each processed region, for the treemap's sections and the largest regions
  const byRegion = region.kind === 'world' ? result.rows.filter(row => row.location !== 'WORLD') : [];
  const weigh = (factors, factor) => Object.keys(factor.factors).reduce((t, id) => t + (factors[id] || 0) * factor.factors[id], 0);
  const factorKeys = Object.keys(SUPPORTING_INDUSTRIES_FACTORS).filter(key => {
    const factor = SUPPORTING_INDUSTRIES_FACTORS[key];
    return factor.indicator && factor.un && factor.un.factors && Object.keys(factor.un.factors).some(id => result.factorIds.has(id));
  });
  const indicators = factorKeys.map((key, k) => {
    const factor = supportingIndustriesFactor(key, 'un');
    const total = rows.reduce((t, row) => t + weigh(row.factors, factor), 0);
    const parts = (region.kind === 'world'
      ? EXIOBASE_PROCESSED_REGIONS.map(code => ({ label: code, name: exiobaseRegionName(code),
          value: byRegion.filter(row => row.location === code).reduce((t, row) => t + weigh(row.factors, factor), 0) }))
      : rows.map(row => ({ label: row.code, name: row.name, value: weigh(row.factors, factor) })))
      .filter(part => part.value > 0).sort((a, b) => b.value - a.value);
    return {
      indicator: `${factor.label} (${factor.indicator})`, code: factor.indicator, index: k, factorKey: key,
      name: factor.label, unit: factor.unit, total,
      shares: total ? parts.slice(0, 3).map(part => ({ label: part.label, name: part.name, share: part.value / total })) : []
    };
  });
  return {
    indicators, rows, byRegion, place, year: result.year, weightsYear: result.weightsYear || exiobaseStateTablesYear(result.year),
    usdPerEur: result.usdPerEur, missing: result.missing,
    // A country without its own Exiobase region shows the region holding it: Saudi Arabia (Rest of Middle East)
    label: place ? (place.partOf ? `${place.name} (${exiobaseRegionName(place.partOf)})` : place.name) : null,
    folders: place ? place.shownRegions : ['US']
  };
}

// Under the impacts chart, for an Exiobase year without some factors (2023 and 2024 have no greenhouse gas
// or jobs factors): which rows the chart leaves out, the year's data and how the data is generated
function showIndicatorYearNote() {
  const el = document.getElementById('indicatorYearNote');
  if (!el) return;
  const data = regionView && regionView.source === 'un' && regionView.data;
  const missing = (data && data.missing) || [];
  const yearNote = data && typeof EXIOBASE_YEAR_NOTES !== 'undefined' && EXIOBASE_YEAR_NOTES[data.year];
  if (!data || !(missing.length || yearNote) || (data.place && !data.place.shownRegions.length)) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  const left = missing.length ? ', so the chart leaves them out' : '';
  el.innerHTML = `The Exiobase ${data.year} files have ${yearNote || `no ${missing.join(' or ')} factors`}${left}. `
    + `Data: <a href="https://github.com/ModelEarth/trade-data/tree/main/year/${data.year}" target="_blank">trade-data/year/${data.year}</a>`
    + ` &middot; <a href="${exiobaseStatusUrl()}" target="_blank">Generating the trade data (exiobase/tradeflow)</a>`;
  el.style.display = '';
}

// The heading and text above the impacts chart
function regionInfoHTML() {
  const view = regionView;
  const data = view.data;
  const label = view.region.label;
  let html = `<h3 style="font-size:22px">${label}: All Industries</h3>`;
  const pick = view.outside ? '' : ' Click a commodity above for its own profile.';
  if (view.source === 'epa') {
    return html + `<b>Industries</b>: the direct impacts of ${label}'s industries (each one's impact per $1 times its output, D &times; q). `
      + `<b>Consumption</b>: the supply chain footprint of ${label}'s final consumption, including what it buys from elsewhere (N &times; y, using ${data.demandId}). `
      + `From ${data.modelName}.${pick}`;
  }
  const place = data.place;
  if (place && !place.shownRegions.length) return html + `<div class="supporting-industries-status si-barrier">${missingPlaceHTML(place, data.year)}</div>`;
  const nouns = data.indicators.map(d => SUPPORTING_INDUSTRIES_FACTORS[d.factorKey].noun);
  const factors = nouns.length > 1 ? `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}` : (nouns[0] || 'factors');
  const sales = view.region.kind === 'world'
    ? 'the industries\' sales to industries in their own country or region, in each processed region'
    : `${(place && place.name) || label}'s industries' ${unSalesPhrase(view.region.location)}`;
  html += `From the Exiobase ${data.year} trade tables: the ${factors} on ${sales}. The tables hold industry-to-industry flows, `
    + `so the impacts of sales to households, government and other countries aren't included.`
    + (view.region.kind === 'state' ? ` ${label}'s values are the US values times its share of US GDP in each industry's category (BEA).` : '')
    + (place && place.partOf ? ` ${place.name} has no Exiobase region of its own, so these are for ${exiobaseRegionName(place.partOf)} (${place.partOf}), which includes it.` : '')
    + pick; // The year's missing factors are noted under the chart (showIndicatorYearNote)
  if (view.region.kind === 'world' && place) html += `<p style="font-size:14px; margin:8px 0 0">${worldCoverageHTML(data.year, place.shownRegions)} <a href="${exiobaseStatusUrl()}" target="_blank">Exiobase year file status</a></p>`;
  return html;
}

// Impacts chart for a place. EPA: Industries and Consumption, with a bar for each on the row's own scale.
// UN: the total, with a bar of the largest regions (World) or industries, which the Largest column names.
function displayRegionTable() {
  const view = regionView;
  const formatType = getCurrentNumberFormat() || 'simple';
  const number = val => {
    if (val == null) return '';
    if (formatType === 'full') return formatCell(val, 'full');
    if (formatType === 'scientific') {
      const parts = Number(val).toExponential(3).split('e');
      return parts[1] ? `${parts[0]}&times;10<sup>${parts[1].replace('+', '')}</sup>` : parts[0];
    }
    return formatCell(val, 'easy');
  };
  const valueColumn = (title, field, tip) => ({
    title, field, width: 130, sorter: 'number', hozAlign: 'right', headerHozAlign: 'right',
    titleFormatter: () => `<span title="${tip}">${title}</span>`,
    formatter: cell => number(cell.getValue())
  });
  const bar = (width, color, tip) => `<div title="${tip}" style="height:8px; margin:2px 0; border-radius:4px; width:${Math.max(0, Math.min(100, width))}%; background:${color}"></div>`;
  const shareColors = ['#9b6dd6', '#7cc3ee', '#f6a9cf'];
  const pct = v => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
  const columns = view.source === 'epa' ? [
    { title: 'Indicator', field: 'indicator', widthGrow: 2, minWidth: IMPACT_INDICATOR_WIDTH },
    { title: 'Industries and Consumption', field: 'produced', minWidth: 160, widthGrow: 1, headerSort: false,
      titleFormatter: () => '<span title="Each bar on the row\'s own scale: Industries (purple) and Consumption (blue)">Industries / Consumption</span>',
      formatter: cell => {
        const d = cell.getRow().getData();
        const max = Math.max(Math.abs(d.produced), Math.abs(d.consumed)) || 1;
        return bar(100 * Math.abs(d.produced) / max, '#9b6dd6', 'Industries') + bar(100 * Math.abs(d.consumed) / max, '#7cc3ee', 'Consumption');
      } },
    valueColumn('Industries', 'produced', `Direct impacts of ${view.region.label}'s industries: D × q`),
    valueColumn('Consumption', 'consumed', `Supply chain footprint of ${view.region.label}'s final consumption: N × y`),
    { title: 'Unit', field: 'unit', width: 100 }
  ] : [
    { title: 'Indicator', field: 'indicator', widthGrow: 2, minWidth: IMPACT_INDICATOR_WIDTH },
    { title: 'Largest shares', field: 'shares', minWidth: 160, widthGrow: 1, headerSort: false,
      formatter: cell => {
        const shares = cell.getValue() || [];
        const parts = shares.map((s, k) => `<span title="${s.name}: ${pct(s.share)}" style="display:inline-block; height:10px; width:${100 * s.share}%; background:${shareColors[k]}"></span>`).join('');
        return `<div style="display:flex; height:10px; border-radius:5px; overflow:hidden; background:rgba(128,128,128,0.2)">${parts}</div>`;
      } },
    valueColumn('Total', 'total', `On ${view.region.label}'s industries' ${unSalesPhrase(view.region.location)}`),
    { title: 'Unit', field: 'unit', width: 100 }
  ];
  // UN: the largest regions (World) or industries on a line of their own under each indicator, spanning
  // the table, by name with the code after it: Electricity by coal (ELEC1) 20%
  const sharesLine = data => {
    const shares = data.shares || [];
    if (!shares.length) return '';
    return `<span class="region-shares-label">Largest ${view.region.kind === 'world' ? 'regions' : 'industries'}:</span> `
      + shares.map((s, k) => `<span class="region-share"><i style="background:${shareColors[k]}"></i>${s.name} (${s.label}) ${pct(s.share)}</span>`).join('');
  };
  mainTable = new Tabulator('#indicatorBarChart', {
    data: tableData,
    layout: 'fitColumns',
    placeholder: view.source === 'un' ? 'No Exiobase factors for this impact set in this year.' : 'No indicators in this impact set for this model.',
    columns,
    rowFormatter: row => {
      const el = row.getElement();
      el.classList.toggle('impact-selected', matrixRank === 'impact' && !!matrixImpact && row.getData().code === matrixImpact.code);
      if (view.source !== 'un') return;
      let line = el.querySelector('.region-shares-row');
      if (!line) {
        line = document.createElement('div');
        line.className = 'region-shares-row';
        el.appendChild(line);
      }
      line.innerHTML = sharesLine(row.getData());
    }
  });
  mainTable.on('rowClick', (e, row) => selectMatrixImpact(row.getData()));
  mainTable.on('renderComplete', positionImpactPointer);
}

// The treemap's regions: each processed region for the World, otherwise the place itself
function regionMatrixRegions() {
  const region = regionView.region;
  if (regionView.source === 'un' && region.kind === 'world') {
    return EXIOBASE_PROCESSED_REGIONS.map((code, i) => ({ key: `r${i}`, location: code, label: code }));
  }
  return [{ key: 'r0', location: region.location, label: region.label }];
}

// Top 25 of the place's industries in buildMatrixList's row shape, ranked by output or sales ('spent'),
// or by the chosen indicator ('impact')
function regionMatrixList(rank) {
  const view = regionView;
  const data = view.data;
  const shown = rank === 'impact' ? matrixImpactShown() : null;
  if (rank === 'impact' && !shown) return [];
  let rows;
  if (view.source === 'epa') {
    const d = shown ? (data.D.data[shown.index] || []) : null;
    rows = data.industries.map(item => {
      const impact = d ? (d[item.index] || 0) * item.output : null;
      return {
        sector: item.name, sectorCode: item.code, coefficient: null, spent: item.output, impact,
        regions: [{ key: 'r0', label: view.region.label, coefficient: null, output: item.output, spent: item.output, impact }],
        spent_r0: item.output, impact_r0: impact
      };
    });
  } else {
    const factor = shown ? supportingIndustriesFactor(shown.factorKey, 'un') : null;
    const weigh = factors => Object.keys(factor.factors).reduce((t, id) => t + (factors[id] || 0) * factor.factors[id], 0);
    const sections = new Map();
    data.byRegion.forEach(row => {
      if (!sections.has(row.code)) sections.set(row.code, []);
      sections.get(row.code).push(row);
    });
    rows = data.rows.map(item => {
      const parts = view.region.kind === 'world' ? (sections.get(item.code) || []) : [item];
      const regions = parts.map(part => {
        const r = matrixRegions.find(x => x.location === part.location) || matrixRegions[0];
        return { key: r.key, label: r.label, coefficient: null, output: null, spent: part.output, impact: factor ? weigh(part.factors) : null };
      });
      const row = { sector: item.name, sectorCode: item.code, coefficient: null, spent: item.output, impact: factor ? weigh(item.factors) : null, regions };
      regions.forEach(r => { row[`spent_${r.key}`] = r.spent; row[`impact_${r.key}`] = r.impact; });
      return row;
    });
  }
  if (rank === 'impact') rows = rows.filter(row => row.impact);
  return rows.sort((a, b) => Math.abs(rankValue(b, rank)) - Math.abs(rankValue(a, rank))).slice(0, 25);
}

async function showRegionMatrix(run) {
  matrixRegions = regionMatrixRegions();
  matrixLists = { 'region-spent': regionMatrixList('spent') };
  matrixHasSpent = true;
  if (matrixRank === 'coefficient' || (matrixRank === 'impact' && !matrixImpactShown())) matrixRank = 'spent';
  if (matrixRank === 'impact') await loadMatrixImpactLists();
  if (run !== mainRun) return;
  const matrixData = currentMatrixList();
  matrixTable = new Tabulator('#matrixTable', {
    data: matrixData,
    layout: 'fitColumns',
    placeholder: 'No industries with sales in this place.',
    columns: matrixTableColumns(),
    initialSort: [{ column: matrixRank, dir: 'desc' }]
  });
  try { renderMatrixTreemap(matrixData); } catch (e) { console.warn('renderMatrixTreemap failed', e); }
  setupMatrixToggles(true);
  showMatrixBarrier();
  showMatrixInfo();
  showMatrixSection();
}

// Shows the matrix with its treemap and table (a place missing from the year's files shows only the toolbar)
function showMatrixSection() {
  const matrixSection = document.getElementById('matrixSection');
  matrixSection.classList.remove('matrix-place-missing');
  matrixSection.style.display = 'block';
}

// The treemap's description for a place
function regionTagline(matrixData) {
  const view = regionView;
  const shown = matrixImpactShown();
  const impactView = matrixRank === 'impact' && shown;
  const who = `Top ${matrixData.length} industries in ${view.region.label}`;
  const area = impactView ? `${shown.name} (${shown.unit})` : matrixAmountLabel().toLowerCase();
  let amounts;
  if (view.source === 'epa') {
    amounts = impactView ? `Amounts are each industry's own direct ${shown.name.toLowerCase()}: its impact per $1 times its output (D × q).`
      : 'Amounts are each industry\'s total output (q).';
  } else {
    amounts = impactView ? `Amounts are the ${shown.name.toLowerCase()} on each industry's sales (the trade tables' factors).`
      : `Amounts are each industry's ${unSalesPhrase(view.region.location)} in the Exiobase ${view.data.year} files, in US dollars.`;
  }
  const split = matrixRegions.length > 1 ? ' Each industry is split into its regions, largest first; later sections are darker.' : '';
  const click = !view.outside ? ' Click an industry for its own profile.'
    : view.region.kind === 'world' ? ' Click an industry name for its US profile, or a country for its industries.'
    : ' Click an industry name for its US profile.';
  return `${who}, ranked by ${area}: rectangle area = ${impactView ? 'impact' : area}; color = normalized magnitude (low → high). ${amounts}${split}${click}`;
}

// The line under the treemap naming the data
function regionMatrixInfoHTML() {
  const view = regionView;
  const data = view.data;
  if (view.source === 'epa') {
    const url = `https://github.com/ModelEarth/useeio-json/tree/main/models/${getModelYear()}/${data.modelName}/matrix`;
    return `<small>${view.region.label}: each industry's total output (q) and direct impacts (D) in the <a href="${url}" target="_blank">${data.modelName}</a> matrices.</small>`;
  }
  const folders = data.folders || [];
  const path = folders.length === 1 ? `year/${data.year}/${folders[0]}/domestic` : `year/${data.year}`;
  return `<small>${view.region.label}: Exiobase ${data.year} domestic trade tables (<a href="https://github.com/ModelEarth/trade-data/tree/main/${path}" target="_blank">trade-data/${path}</a>), in US dollars at ${data.usdPerEur} per euro.</small>`;
}

// Data Sources for a place: the model's files, or the Exiobase files
function showRegionDataSources() {
  const view = regionView;
  const data = view.data;
  const infoEl = document.getElementById('dataSourcesInfo');
  let rows;
  if (view.source === 'epa') {
    const baseUrl = `https://github.com/ModelEarth/useeio-json/blob/main/models/${getModelYear()}/${data.modelName}`;
    infoEl.innerHTML = `Data sources for all industries in <strong>${view.region.label}</strong> (${data.modelName})`;
    rows = [
      { dataset: 'Total output (q)', description: 'Each industry\'s total output in dollars', format: 'JSON Matrix', url: `${baseUrl}/matrix/q.json`, usage: 'Output in the treemap and table; Industries impacts (D × q)' },
      { dataset: 'Direct impacts (D)', description: 'Each industry\'s own impacts per $1 of output', format: 'JSON Matrix', url: `${baseUrl}/matrix/D.json`, usage: 'Industries column (D × q) and the treemap\'s Impact view' },
      { dataset: 'Total impacts (N)', description: 'Supply chain impacts per $1 of final demand', format: 'JSON Matrix', url: `${baseUrl}/matrix/N.json`, usage: 'Consumption column (N × y)' },
      { dataset: 'Consumption demand (y)', description: `${data.demandId}: final consumption by commodity`, format: 'JSON Array', url: `${baseUrl}/demands/${data.demandId}.json`, usage: 'What the Consumption column covers' },
      { dataset: 'Sectors', description: `${data.industries.length} industries in ${view.region.label}`, format: 'JSON Array', url: `${baseUrl}/sectors.json`, usage: 'Industry names and codes' },
      { dataset: 'Indicators', description: `${data.indicators.length} impact indicators`, format: 'JSON Array', url: `${baseUrl}/indicators.json`, usage: 'Indicator names and units' }
    ];
  } else {
    infoEl.innerHTML = `Data sources for all industries in <strong>${view.region.label}</strong> (Exiobase ${data.year})`;
    rows = exiobaseSourceRows(data.year, data.weightsYear, data.folders || [], { states: view.region.kind === 'state', countries: view.outside });
  }
  renderDataSourcesTable('#dataSourcesTable', rows);
  document.getElementById('dataSourcesSection').style.display = 'block';
}


// Top 10 industries supplying the selected commodity in a state model, below the commodities
// report, from ../item/js/supporting-industries.js (also on the product label). The heading
// above it names the state and commodity, e.g. "Georgia Textiles...". Both are hidden for the
// national model and when no commodity is selected.
let supportingIndustriesPanel = null;
let supportingIndustriesKey = null; // The newest request, so an older one still loading is dropped
let supportingIndustriesShown = null; // { sector, state, industries } for the eyebrow

// The eyebrow above the heading: the source the UN / EPA toggle below it shows, with the panel's year
// "EPA / 2020 / 111CA/US-GA / GAEEIOv1.0-s-20" or "UN / Exiobase 2022 / TEXTI/US-GA"
function showSupportingEyebrow() {
  const el = document.getElementById('supportingIndustriesEyebrow');
  const shown = supportingIndustriesShown;
  if (!el || !shown) return;
  const source = getSupportingIndustriesSource();
  const yearSelect = document.querySelector('#supportingIndustries .si-year-select');
  const year = (yearSelect && yearSelect.value) || SUPPORTING_INDUSTRIES_DEFAULT_YEAR;
  const place = `US-${shown.state}`;
  el.title = SUPPORTING_INDUSTRIES_SOURCES[source].title;
  el.innerHTML = source === 'un'
    ? `<b>UN</b> / Exiobase ${year} / ${shown.industries.length ? shown.industries.join(', ') : 'No Exiobase industries'}/${place}`
    : `<b>EPA</b> / USEEIO ${year} / ${shown.sector.code}/${place} / <span class="sectorIdModel">${getModelFolderName()}</span>`;
}
// The UN / EPA toggle (setSupportingIndustriesSource) and the panel's dropdowns update the eyebrow. Queued so the
// panel's own handlers set its year first (EPA has 2020 only, and a factor change can narrow the UN years).
document.addEventListener('supportingIndustriesSource', () => queueMicrotask(showSupportingEyebrow));
document.addEventListener('change', event => {
  if (event.target.closest && event.target.closest('#supportingIndustries select')) queueMicrotask(showSupportingEyebrow);
});
async function showSupportingIndustries(sector) {
  const state = getModelState();
  const heading = document.getElementById('supportingIndustriesHeading');
  const headingWrap = document.getElementById('supportingHeading');
  const hide = () => {
    supportingIndustriesKey = null;
    supportingIndustriesShown = null;
    headingWrap.style.display = 'none';
    if (supportingIndustriesPanel) supportingIndustriesPanel.hide();
  };
  if (!sector || !state || sector.location !== `US-${state}` || !USEEIO_STATE_MODELS.has(state)) {
    hide();
    return;
  }
  const key = `${sector.code}/${state}/${typeof exiobaseTablesYear === 'function' ? exiobaseTablesYear() : ''}`;
  if (supportingIndustriesKey === key) return;
  supportingIndustriesKey = key;
  if (!supportingIndustriesPanel) {
    supportingIndustriesPanel = createSupportingIndustriesPanel({
      element: document.getElementById('supportingIndustries'),
      ownLabel: 'Selected commodity',
      footprintLink: false, // Already on the footprint report
      unLinkFor: footprintUnLink // Related sectors when UN has no industries for this one
    });
  }
  // The Exiobase industries for the UN option, none when they can't load (EPA still shows)
  const industries = await exiobaseIndustriesForSummary(sector.code).catch(error => {
    console.warn('Top industries: no Exiobase industries for ' + sector.code, error);
    return [];
  });
  if (supportingIndustriesKey !== key) return;
  heading.textContent = `${getState(state) || state} ${sector.name}`;
  supportingIndustriesShown = { sector, state, industries };
  headingWrap.style.display = '';
  supportingIndustriesPanel.setSector(sector.code, industries); // Fills the year dropdown the eyebrow reads
  showSupportingEyebrow();
  supportingIndustriesPanel.show(state, key, hide); // A state model that fails to load hides both
}

// A link to another of the state's sectors in UN, keeping the rest of the hash (year, set, ...)
function footprintUnLink(code) {
  const hash = Object.assign({}, getHash(), { demand: `${code}/US-${getModelState()}`, source: 'un' });
  return '#' + Object.keys(hash)
    .filter(k => hash[k] !== '' && hash[k] != null && typeof hash[k] !== 'object')
    .map(k => `${k}=${String(hash[k]).replace(/&/g, '%26')}`).join('&');
}

// A newer main() run, from a hash change, takes over from an earlier one still loading
let mainRun = 0;
// Subheader above the sector's H3: its ID and where that ID comes from, since the site mixes industry IDs
// (BEA Detail in the US model, BEA Summary in state models, NAICS and Exiobase elsewhere). "BEA Detail · 531HSO/US · USEEIOv2.0.1-411"
function sectorIdSubheader(sector) {
  const modelName = getModelFolderName();
  const scheme = /-s-/.test(modelName) ? 'BEA Summary' : 'BEA Detail'; // State models (e.g. GAEEIOv1.0-s-20) use BEA Summary sectors
  const title = `${scheme} sector code from the EPA ${modelName} model (${getModelYear()}). The impacts below come from this model.`;
  // craft-eyebrow from localsite/css/craft.css, as in codechat. The .craft wrapper (sectorHeading) supplies its colors and fonts.
  return `<div class="craft-eyebrow sectorIdSubheader" title="${title}"><b>${scheme}</b> / ${sector.code}/${sector.location} / <span class="sectorIdModel">${modelName}</span></div>`;
}

async function main() {
  const run = ++mainRun;
  let hash = getHash();
  document.getElementById('relocatedStateMenu').classList.toggle('outside-us', footprintOutsideUS());
  markCountrySelect();
  showCommoditySource(); // EPA commodities, or the UN list

  /* TO DELETE
  try { console.log('[sector_profile] entering main, hash=', JSON.stringify(hash)); } catch (e) {}
  // Ensure geoview=country is present on every page load (merge with existing tokens)
  try {
    if (!hash.geoview) {
      // Prefer updateHash (merge) to avoid overwriting demand/sector
      if (typeof updateHash === 'function') {
        updateHash({ geoview: 'country' });
      } else {
        // Fallback: merge current hash object and call goHash
        try {
          const current = getHash();
          current.geoview = 'country';
          if (typeof goHash === 'function') {
            goHash(current);
          } else {
            // Last resort: build a safe location.hash string
            const parts = [];
            for (const k in current) {
              if (current[k] !== undefined && current[k] !== null && String(current[k]).length > 0) {
                parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(current[k]));
              }
            }
            location.hash = parts.join('&');
          }
        } catch (e) {
          console.warn('sector_profile: fallback failed to set geoview=country', e);
        }
      }
      // Refresh local hash reference after mutation
      hash = getHash();
    }
  } catch (e) {
    console.warn('sector_profile: failed to ensure geoview=country', e);
  }
  */

  const info = document.getElementById("info");
  
  // Parse URL parameters
  //const fullhash = window.location.hash;
  //const params = new URLSearchParams(fullhash.substring(1));
  
  // No commodity in the hash, or a country or the World: all of the place's industries
  const region = footprintRegion();
  const legacySector = hash.index || hash.industry; // Older links name a sector by index
  if ((!hash.demand && !legacySector) || region.kind === 'world' || region.kind === 'country') {
    await showRegionView(region, run);
    return;
  }
  leaveRegionView();

  let sector;
  const sectors = await model.sectors();
  
  // Handle demand parameter (new format)
  if (hash.demand) {
    try { console.log('[sector_profile] processing demand ->', hash.demand); } catch (e) {}
    const [code, location] = hash.demand.split("/");
    sector = sectors.find(s => s.code === code && s.location === location);
    try { console.log('[sector_profile] resolved sector ->', sector ? sector.code + '/' + sector.location : null); } catch (e) {}
  }
  // Handle index parameter (legacy format)
  else if (hash.index) {
    const sectorIndex = parseInt(hash.index);
    sector = sectors.find(s => s.index === sectorIndex);
  }
  // Handle legacy industry parameter
  else if (hash.industry) {
    const sectorIndex = parseInt(hash.industry);
    sector = sectors.find(s => s.index === sectorIndex);
  }
  
  /*
  let stateCode;
  if (hash.state) {
    stateCode = hash.state;
  } else 

  if (hash.demand) {
    const [code, location] = hash.demand.split('/');
    if (!location) {
      info.textContent = "No location value in demand: " + hash.demand;
      document.getElementById('indicatorBarChart').innerHTML = "";
      return;
    } else if (location.includes('/')) {
      stateCode = location.split('/')[1];
    }
  }
  */

  if (!sector) {
    info.textContent = "No valid sector specified in the URL.";
    if (hash.state) {
      info.textContent = `No valid sector specified in the URL in ${getModelState()} model.`;
    }
    document.getElementById('indicatorBarChart').innerHTML = "";
    showSupportingIndustries(null);
    return;
  }
  showSupportingIndustries(sector);

  const demandId = await model.findDemand({
    system: "Complete",
    type: "Consumption",
  });
  if (!demandId) {
    info.textContent = "Failed to load demand";
    document.getElementById('indicatorBarChart').innerHTML = "";
    return;
  }
  
  info.textContent = `Analyzing sector '${sector.name}' based on ${demandId}`;

  const analysis = await useeio.SectorAnalysis.of(model, sector, demandId);
  const indicators = await model.indicators();
  const direct = norm100(await analysis.getEnvironmentalProfile(true));
  const total = norm100(await analysis.getEnvironmentalProfile(false));
  // Get actual environmental values (not normalized)
  const directValues = await analysis.getEnvironmentalProfile(true);
  const totalValues = await analysis.getEnvironmentalProfile(false);
  
  // Supplier and buyer impacts, split by region in state models
  const flows = await indicatorFlowImpacts(sector, analysis.normalizationTotals);
  if (run !== mainRun) return;
  indicatorFlows = flows;
  const regionValues = (regions, i) => regions ? regions.map(r => ({ label: r.label, value: r.values[i] })) : null;
  
  fullTableData = indicators.map(i => {
    return {
      indicator: `${i.name} (${i.code})`,
      code: i.code,
      index: i.index, // Row in the D and N matrices, for the treemap's Impact view
      name: i.name,
      direct: direct[i.index],
      total: total[i.index],
      directValue: directValues[i.index],
      // National total the values are divided by, to turn them back into indicator units
      normTotal: analysis.normalizationTotals ? analysis.normalizationTotals[i.index] : null,
      totalValue: totalValues[i.index],
      // Supplier = the supply chain without the industry itself (total minus direct)
      supplierValue: totalValues[i.index] - directValues[i.index],
      supplierRegions: regionValues(indicatorFlows.supplierRegions, i.index),
      buyersValue: indicatorFlows.buyers ? indicatorFlows.buyers[i.index] : null,
      buyersRegions: regionValues(indicatorFlows.buyerRegions, i.index),
      directValueEasy: formatCell(directValues[i.index], 'easy'),
      totalValueEasy: formatCell(totalValues[i.index], 'easy'),
      unit: i.unit
    }
  });
  // Indicator for the treemap's Impact view: the one chosen before (looked up again for this model), else GHG
  const impactRow = fullTableData.find(d => matrixImpact && d.code === matrixImpact.code)
    || fullTableData.find(d => d.code === 'GHG') || fullTableData[0];
  matrixImpact = impactRow ? { code: impactRow.code, index: impactRow.index, name: impactRow.name, unit: impactRow.unit } : null;
  // Sets with none of this model's indicators are disabled in the impact set dropdown
  // Energy stays enabled: choosing it switches to the national model
  if (impactSetControl) impactSetControl.setAvailable(fullTableData.map(d => d.code), ['energy']);
  // One scale for every combination, so each part keeps its length when others are added
  indicatorScaleMax = Math.max(...fullTableData.map(d =>
    Math.max(0, d.supplierValue) + Math.max(0, d.directValue) + Math.max(0, d.buyersValue || 0)), 0) || 1;

  // The ID subheader and the sector's title in the craft.css styles of codechat
  info.innerHTML = `<div class="craft sectorHeading">${sectorIdSubheader(sector)}<h3 class="craft-title">${unRegionName(sector.location)} ${sector.name}</h3></div>Environmental profile based on ${demandId} for <b>${sector.id}</b>`;
  
  // Filter according to the selected impact filter and create the table
  filterTableData();
  displayTable();

  // Load and display matrix and data sources
  await loadMatrixData(sector, analysis);
  if (run === mainRun) await loadDataSources(sector);
}

async function loadMatrixData(sector, analysis) {
  try {
    const matrixSection = document.getElementById('matrixSection');
    const matrixInfo = document.getElementById('matrixInfo');
    const matrixTableDiv = document.getElementById('matrixTable');
    
    // Get model information for data source URL
    const modelName = getModelFolderName();
    const dataSourceUrl = `https://github.com/ModelEarth/useeio-json/blob/main/models/${getModelYear()}/${modelName}/matrix/A.json`;
    
    // e.g. Georgia Coefficient A Matrix (GAEEIOv1.0-s-20), or US for the national model
    const stateCode = (getUrlHash().state || '').split(',')[0].toUpperCase();
    const placeName = stateCode ? ((typeof getState === 'function' && getState(stateCode)) || stateCode) : 'US';
    matrixEpaInfo = `<small>${placeName} Coefficient A Matrix (<a href="${dataSourceUrl}" target="_blank">${modelName}</a>)</small>`;
    matrixInfo.innerHTML = withDatasetsLink(matrixEpaInfo);
    
    // Get matrix data from the model
    const sectors = await model.sectors();
    const matrixA = await model.matrix('A'); // Technical coefficient matrix
    // Total output per sector (q, in dollars), used to turn coefficients into dollars spent
    let outputQ = null;
    try { outputQ = await model.matrix('q'); } catch (e) { console.warn('q vector not available, treemap shows per-dollar amounts', e); }
    
    console.log('Matrix A structure:', matrixA);
    console.log('Sector details:', sector);
    
    // Columns of A are the buying sectors, rows are what they buy (each column sums to less than 1).
    // Sellers: this sector's column, A[j, sector] × q[sector] = what this sector spends on j.
    // Buyers: this sector's row, A[sector, j] × q[j] = what sector j spends on this sector.
    // One top 25 list per direction and ranking, keyed like 'buyers-spent'
    matrixLists = {};
    if (!outputQ) matrixRank = 'coefficient'; // No totals without the q vector
    // State models list each sector once per region (the state and Rest of US; Rest of World later)
    matrixRegions = matrixRegionList(sectors);
    for (const direction of ['sellers', 'buyers']) {
      for (const rank of ['spent', 'coefficient']) {
        matrixLists[`${direction}-${rank}`] = (matrixA && matrixA.data && matrixA.data.length > 0)
          ? buildMatrixList(sectors, matrixA, outputQ, sector.index, direction, rank, matrixRegions) : [];
      }
    }
    console.log('Matrix data sample:', matrixLists['sellers-spent'].slice(0, 3), matrixLists['buyers-spent'].slice(0, 3));
    matrixContext = { sectors: sectors, matrixA: matrixA, outputQ: outputQ, sectorIndex: sector.index };
    if (!outputQ && matrixRank === 'impact') matrixRank = 'coefficient';
    // EPA lists, kept while UN shows. Then UN (Exiobase) when the hash has source=un and the sector has it.
    matrixEpa = { lists: matrixLists, regions: matrixRegions };
    matrixExiobase = await matrixExiobaseFor(sector);
    try {
      if (!await applyMatrixSource()) return; // A newer sector took over
    } catch (e) {
      console.warn('Exiobase matrix lists not available', e);
      matrixExiobase = { unavailable: `The Exiobase ${exiobaseYear()} trade tables could not be loaded` };
      await applyMatrixSource();
    }
    showMatrixInfo();
    if (matrixRank === 'impact') await loadMatrixImpactLists();
    const matrixData = currentMatrixList();
    
    if ([matrixEpa.lists, matrixLists].some(lists => Object.values(lists).some(list => list.length > 0))) {
        // Create Tabulator table for matrix data
        matrixTable = new Tabulator("#matrixTable", {
          data: matrixData,
          layout: "fitColumns",
          placeholder: "No significant technical coefficients in this direction.",
          columns: matrixTableColumns(),
          initialSort: [
            { column: matrixRank, dir: "desc" }
          ]
        });
      // Render a treemap visualization of the matrix contributions
      try {
        renderMatrixTreemap(matrixData);
      } catch (e) { console.warn('renderMatrixTreemap failed', e); }
      setupMatrixToggles(!!outputQ);
      showMatrixBarrier();
    } else {
      setupMatrixToggles(!!outputQ); // The source toggle still shows
      matrixTableDiv.innerHTML = '<p>No significant technical coefficients found for this sector.</p>';
    }
    
    showMatrixSection();
  } catch (error) {
    console.error('Error loading matrix data:', error);
    document.getElementById('matrixInfo').innerHTML = `<em>Error loading matrix data: ${error.message}</em>`;
    showMatrixSection();
  }
}

// Switch the page to a sector from the matrix table, in the location of the current demand (US-GA, RoUS or US),
// or for a place's industries, the place's (US-GA or US)
async function showMatrixSector(code) {
  if (!code || (regionView && regionView.outside)) return; // EPA profiles cover the US and its states
  if (matrixSource === 'un' && !getModelState()) {
    // The national model: the industry's first detail sector in it
    const codes = new Set((await model.sectors()).map(s => s.code));
    code = (await exiobaseDetailsFor(code).catch(() => [])).find(c => codes.has(c));
    if (!code) return;
  } else if (matrixSource === 'un') {
    code = await exiobaseSummaryFor(code).catch(() => null);
    if (!code) return; // No USEEIO sector for this Exiobase industry
  }
  const hash = getHash();
  const location = String(hash.demand || '').split('/')[1] || (hash.state ? `US-${hash.state.split(',')[0].toUpperCase()}` : 'US');
  const demand = `${code}/${location}`;
  if (demand !== hash.demand) goHash({ demand: demand });
}

// An industry's own profile from the treemap. For the World or another country, whose Exiobase industries
// have no profile there, the industry's first detail sector in the US national model (country=US, no state).
async function showMatrixIndustry(code) {
  if (!code) return;
  if (!regionView || !regionView.outside) return showMatrixSector(code);
  const demand = await exiobaseNationalDemand(code);
  if (!demand) { console.warn(`No USEEIO detail sector for Exiobase industry ${code}`); return; }
  goHash({ country: 'US', demand: demand }, ['state']);
}
// An Exiobase industry as a demand in the US national model: its first detail sector there, e.g. 622000/US
async function exiobaseNationalDemand(code) {
  const codes = new Set((await getModelByName('USEEIOv2.0.1-411').sectors()).map(s => s.code));
  const detail = (await exiobaseDetailsFor(code).catch(() => [])).find(c => codes.has(c));
  return detail ? `${detail}/US` : null;
}
// A country under an industry in the World treemap: that country, keeping the industry as the demand
// (national model, so no state). With no matching USEEIO sector, any earlier demand is dropped.
async function showMatrixCountry(country, code) {
  const demand = code ? await exiobaseNationalDemand(code) : null;
  if (demand) goHash({ country: country, demand: demand }, ['state']);
  else goHash({ country: country }, ['demand']);
}

// Columns for the matrix table. Region columns show dollars spent, or the indicator's impact in the Impact view.
function matrixTableColumns() {
  const shownImpact = matrixImpactShown();
  const impactView = matrixRank === 'impact' && shownImpact;
  const numberCell = val => {
    const formatType = getCurrentNumberFormat() || "simple";
    if (formatType === "full") return formatCell(val, 'full');
    if (formatType === "scientific") return formatCell(val, 'scientific');
    return formatCell(val, 'easy');
  };
  const pct = v => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
  return [
    {
      title: regionView ? "Industry" : "Sector Name",
      field: "sector",
      widthGrow: 5,
      minWidth: 360,
      cssClass: "matrix-sector-cell",
      formatter: cell => {
        const name = String(cell.getValue() || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        return `<span title="Show the ${name} profile">${name}</span>`;
      },
      cellClick: (e, cell) => showMatrixIndustry(cell.getRow().getData().sectorCode)
    },
    { title: "Code", field: "sectorCode", width: 80 },
    // One column per region when the model has more than one, or the largest of the World's regions
    ...(matrixRegions.length > 4 ? [{
      title: "Largest regions",
      field: "regions",
      headerSort: false,
      minWidth: 170,
      formatter: cell => {
        const row = cell.getRow().getData();
        const value = r => Math.abs((impactView ? r.impact : r.spent) || 0);
        const total = (cell.getValue() || []).reduce((t, r) => t + value(r), 0);
        return total ? (cell.getValue() || []).slice().sort((a, b) => value(b) - value(a)).slice(0, 3)
          .map(r => `<span title="${exiobaseRegionName(r.label)}">${r.label} ${pct(value(r) / total)}</span>`).join(', ') : '';
      }
    }] : []),
    ...(matrixRegions.length > 1 && matrixRegions.length <= 4 ? matrixRegions.map(region => impactView ? {
      title: region.label,
      field: `impact_${region.key}`,
      titleFormatter: () => `<span title="${shownImpact.name} in ${region.label} (${shownImpact.unit})">${region.label}</span>`,
      formatter: cell => cell.getValue() == null ? '' : treemapQuantity(cell.getValue()),
      sorter: "number",
      width: 110
    } : {
      title: region.label,
      field: `spent_${region.key}`,
      formatter: cell => {
        const row = cell.getRow().getData();
        if (cell.getValue() != null) return treemapDollars(cell.getValue());
        return row[`coef_${region.key}`] != null ? treemapAmount(row[`coef_${region.key}`]) : '';
      },
      sorter: "number",
      width: 110
    }) : []),
    ...(impactView ? [{
      title: shownImpact.code,
      field: "impact",
      titleFormatter: () => `<span title="${shownImpact.name} (${shownImpact.unit})">${shownImpact.code}</span>`,
      formatter: cell => cell.getValue() == null ? '' : treemapQuantity(cell.getValue(), shownImpact.unit),
      sorter: "number",
      width: 150
    }] : []),
    {
      title: matrixAmountLabel(),
      field: "spent",
      formatter: cell => cell.getValue() == null ? '' : treemapDollars(cell.getValue()),
      sorter: "number",
      width: 120
    },
    // The trade tables have no industry outputs, so UN has no per-dollar amounts. A place's industries have none either.
    ...(matrixSource === 'un' || regionView ? [] : [{
      title: "Per $1",
      field: "coefficient",
      formatter: cell => treemapAmount(cell.getValue()),
      headerSort: false,
      width: 120
    }, {
      title: "Coefficient",
      field: "coefficient",
      formatter: cell => numberCell(cell.getValue()),
      sorter: "number",
      width: 150
    }])
  ];
}

// Top 25 lists sized by the chosen indicator, for both directions. Suppliers: what this industry spends on
// each sector × that sector's total impact per $1 (N), so the tiles add up to the Suppliers bar. Buyers: what
// each sector spends on this industry × the buyer's direct impact per $1 (D), adding up to the Buyers bar.
async function loadMatrixImpactLists() {
  if (regionView) {
    const regionKey = `region-impact-${matrixImpact && matrixImpact.code}`;
    if (matrixImpact && matrixLists && !matrixLists[regionKey]) matrixLists[regionKey] = regionMatrixList('impact');
    return;
  }
  if (!matrixContext || !matrixImpact || !matrixLists) return;
  const key = direction => `${direction}-impact-${matrixImpact.code}`;
  if (matrixLists[key('sellers')]) return;
  if (matrixSource === 'un') {
    const shown = matrixImpactShown();
    const ex = matrixExiobase;
    if (!shown || !ex || ex.unavailable) return;
    const lists = {};
    for (const direction of ['sellers', 'buyers']) lists[direction] = await buildExiobaseMatrixList(ex, direction, 'impact', shown.factorKey);
    ex.lists[key('sellers')] = lists.sellers;
    ex.lists[key('buyers')] = lists.buyers;
    return;
  }
  const { sectors, matrixA, outputQ, sectorIndex } = matrixContext;
  const [D, N] = await Promise.all([model.matrix('D'), model.matrix('N')]);
  for (const direction of ['sellers', 'buyers']) {
    const factors = ((direction === 'sellers' ? N : D).data || [])[matrixImpact.index] || [];
    matrixLists[key(direction)] = buildMatrixList(sectors, matrixA, outputQ, sectorIndex, direction, 'impact', matrixRegions, factors);
  }
}

// Regions in the order the model lists them, e.g. GA then Rest of US
function matrixRegionList(sectors) {
  const label = loc => loc === 'RoUS' ? 'Rest of US' : loc === 'RoW' ? 'Rest of World' : String(loc || '').replace(/^US-/, '');
  const locations = [...new Set(sectors.map(s => s.location))];
  return locations.map((location, i) => ({ key: `r${i}`, location: location, label: label(location) }));
}

// Top 25 sellers to (column) or buyers from (row) the sector in the A matrix, with dollars spent.
// Each sector is one row combining its regions, with the amount for each region in row.regions.
// rank 'spent' orders by total dollars spent, 'coefficient' by the amount per $1.
function buildMatrixList(sectors, matrixA, outputQ, sectorIndex, direction, rank, regions, impactFactors) {
  const qAt = i => (outputQ && outputQ.data[i]) ? outputQ.data[i][0] : null;
  const groups = new Map();
  sectors.forEach((s, index) => {
    // Ensure sector name is a usable string. Some models may have
    // non-string or boolean values in the name field; fall back to
    // the sector code or a generated label to avoid literal 'true'.
    const sectorNameSafe = (typeof s.name === 'string' && s.name.trim().length > 0)
      ? s.name.trim()
      : (typeof s.code === 'string' && s.code.trim().length > 0 ? s.code.trim() : `Sector ${index}`);
    const coefficient = (direction === 'sellers'
      ? (matrixA.data[index] || [])[sectorIndex]
      : (matrixA.data[sectorIndex] || [])[index]) || 0;
    // Output of the buying sector: this sector for sellers, sector j for buyers
    const output = qAt(direction === 'sellers' ? sectorIndex : index);
    // Filter out very small values. Rest of US buyers have large outputs, so their coefficients are
    // about 100× smaller than in-state ones for the same dollars. Buyers are also kept when they spend
    // over 0.01% of this industry's output, the same dollar threshold the sellers' coefficient sets.
    const ownOutput = qAt(sectorIndex);
    const bigSpend = direction === 'buyers' && output != null && ownOutput
      && Math.abs(coefficient * output) > 0.0001 * ownOutput;
    // Ranked by impact, small purchases can still carry large impacts, so only zeros are left out
    if (rank === 'impact' ? !coefficient : (Math.abs(coefficient) <= 0.0001 && !bigSpend)) return;
    const region = regions.find(r => r.location === s.location) || { key: 'r0', label: '' };
    const key = s.code || sectorNameSafe;
    if (!groups.has(key)) groups.set(key, { sector: sectorNameSafe, sectorCode: s.code, regions: [] });
    groups.get(key).regions.push({
      key: region.key,
      label: region.label,
      sectorId: s.id,
      coefficient: coefficient,
      output: output,
      spent: output != null ? coefficient * output : null,
      // The chosen indicator's impact: dollars spent × impact per $1 (N for suppliers, D for buyers)
      impact: (impactFactors && output != null) ? coefficient * output * (impactFactors[index] || 0) : null
    });
  });
  return [...groups.values()]
    .map(g => {
      const hasSpent = g.regions.every(r => r.spent != null);
      const spent = hasSpent ? g.regions.reduce((t, r) => t + r.spent, 0) : null;
      let coefficient;
      if (direction === 'sellers') {
        // Per $1 of this industry's output, so the regions add up
        coefficient = g.regions.reduce((t, r) => t + r.coefficient, 0);
      } else {
        // Buyers have different outputs: total spent over their combined output
        const outputs = g.regions.reduce((t, r) => t + (r.output || 0), 0);
        coefficient = (hasSpent && outputs) ? spent / outputs
          : g.regions.reduce((t, r) => t + r.coefficient, 0) / g.regions.length;
      }
      const impact = g.regions.every(r => r.impact != null) ? g.regions.reduce((t, r) => t + r.impact, 0) : null;
      const row = { sector: g.sector, sectorCode: g.sectorCode, coefficient: coefficient, spent: spent, impact: impact, regions: g.regions };
      g.regions.forEach(r => { row[`spent_${r.key}`] = r.spent; row[`coef_${r.key}`] = r.coefficient; row[`impact_${r.key}`] = r.impact; });
      return row;
    })
    .sort((a, b) => Math.abs(rankValue(b, rank)) - Math.abs(rankValue(a, rank)))
    .slice(0, 25); // Show top 25
}

// The value a matrix row is ranked and sized by, falling back to the coefficient when there is no total
function rankValue(item, rank) {
  if (rank === 'impact') return item.impact || 0;
  return (rank === 'spent' && item.spent != null) ? item.spent : (item.coefficient || 0);
}

function currentMatrixList() {
  const direction = regionView ? 'region' : matrixDirection; // A place's industries have no direction
  const key = matrixRank === 'impact' ? `${direction}-impact-${matrixImpact && matrixImpact.code}` : `${direction}-${matrixRank}`;
  return (matrixLists && matrixLists[key]) || [];
}

// Total Spent and Impact show totals for the industry's whole output; Per $1 shows per-dollar amounts
function matrixShowsTotals() {
  return matrixRank !== 'coefficient';
}

// Sellers / Buyers toggle and, to its right, the Total Spent / Per $1 / Impact ranking toggle.
// Both update the table and the treemap above it.
function setupMatrixToggles(hasSpent) {
  const toolbar = document.getElementById('matrixToolbar');
  if (!toolbar) return;
  matrixHasSpent = hasSpent;
  const sourceEl = document.getElementById('matrixSource');
  if (sourceEl && !sourceEl.firstElementChild && typeof sourceButtonsHTML === 'function') {
    sourceEl.innerHTML = sourceButtonsHTML();
    setupSourceButtons(sourceEl);
  }
  markMatrixToggles();
  if (toolbar.dataset.ready) return;
  toolbar.dataset.ready = '1';
  toolbar.addEventListener('click', e => {
    const btn = e.target.closest('#matrixDirection button[data-direction], #matrixRank button[data-rank]');
    if (!btn || btn.disabled || !matrixLists) return;
    const totalsBefore = matrixShowsTotals();
    if (btn.dataset.direction) matrixDirection = btn.dataset.direction;
    if (btn.dataset.rank) matrixRank = btn.dataset.rank;
    showMatrixList(totalsBefore);
  });
}

// Active toggle buttons, with the chosen indicator on the Impact button, e.g. "Impact (GHG)"
function markMatrixToggles() {
  const toolbar = document.getElementById('matrixToolbar');
  if (!toolbar) return;
  // EPA totals and impacts need the industries' total outputs (q). UN has totals but no per-dollar
  // amounts, and Impact only for indicators with an Exiobase factor (GHG, LAND, WATR, MNRL, JOBS).
  const un = matrixSource === 'un';
  const unBlocked = !regionView && un && (!matrixExiobase || !!matrixExiobase.unavailable);
  toolbar.querySelectorAll('#matrixRank button').forEach(btn => {
    const rank = btn.dataset.rank;
    btn.disabled = unBlocked || (un ? (rank === 'coefficient' || (rank === 'impact' && !matrixImpactShown())) : (rank !== 'coefficient' && !matrixHasSpent));
  });
  toolbar.querySelectorAll('#matrixDirection button').forEach(btn => { btn.disabled = unBlocked; });
  toolbar.querySelectorAll('#matrixDirection button, #matrixRank button').forEach(btn => {
    const on = btn.dataset.direction ? btn.dataset.direction === matrixDirection : btn.dataset.rank === matrixRank;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const impactBtn = toolbar.querySelector('button[data-rank="impact"]');
  if (impactBtn) impactBtn.textContent = matrixImpact ? `Impact (${matrixImpact.code})` : 'Impact';
  // Total Spent for a sector, Output (EPA) or Sales (UN) for a place's industries
  const spentBtn = toolbar.querySelector('button[data-rank="spent"]');
  if (spentBtn) {
    if (!spentBtn.dataset.title) spentBtn.dataset.title = spentBtn.title;
    spentBtn.textContent = matrixAmountLabel();
    spentBtn.title = !regionView ? spentBtn.dataset.title : regionView.source === 'un'
      ? 'Rank the top 25 industries and size rectangles by their sales to industries in the same place'
      : 'Rank the top 25 industries and size rectangles by their total output';
  }
  markMatrixSource();
}

// Show the list for the current direction and ranking in the table and treemap. The impacts chart is redrawn
// when its columns switch between totals and per-dollar amounts, otherwise only its selected row is marked.
async function showMatrixList(totalsBefore) {
  if (matrixRank === 'impact') {
    try { await loadMatrixImpactLists(); } catch (e) { console.warn('Impact lists not available', e); }
  }
  markMatrixToggles();
  const list = currentMatrixList();
  if (matrixTable) {
    matrixTable.setColumns(matrixTableColumns());
    matrixTable.setData(list).then(() => matrixTable.setSort(matrixRank, 'desc'));
  }
  renderMatrixTreemap(list);
  showMatrixBarrier();
  if (totalsBefore !== matrixShowsTotals()) afterTreemapAnimation(updateTables);
  else markImpactRow();
}

// Run fn once the treemap's transition has finished, so heavy work (rebuilding the impacts chart)
// doesn't stall the animation
function afterTreemapAnimation(fn) {
  const anim = matrixTreemapAnim;
  if (!anim || anim.cancelled || anim.progress >= 1) { fn(); return; }
  anim.done.push(fn);
}

// Clicking a row in the impacts chart sizes the treemap by that indicator
function selectMatrixImpact(row) {
  if (!row || row.index == null || !matrixLists) return;
  if (matrixSource === 'un') {
    if (!unFactorForIndicator(row.code)) return; // No Exiobase factor for this indicator
  } else {
    const btn = document.querySelector('#matrixToolbar button[data-rank="impact"]');
    if (btn && btn.disabled) return;
  }
  const totalsBefore = matrixShowsTotals();
  matrixImpact = { code: row.code, index: row.index, name: row.name, unit: row.unit };
  matrixImpactClicked = true;
  matrixRank = 'impact';
  showMatrixList(totalsBefore);
}

// Outline the impacts chart row whose indicator sizes the treemap
function markImpactRow() {
  if (!mainTable || typeof mainTable.getRows !== 'function') return;
  mainTable.getRows().forEach(row => {
    const el = row.getElement();
    if (el) el.classList.toggle('impact-selected', matrixRank === 'impact' && !!matrixImpact && row.getData().code === matrixImpact.code);
  });
  positionImpactPointer();
}

// Move the triangle beside the selected row, or hide it when no row is selected (or the row is filtered out)
function positionImpactPointer() {
  const pointer = document.getElementById('impactPointer');
  const wrap = document.getElementById('indicatorBarChartWrap');
  if (!pointer || !wrap) return;
  const rowEl = document.querySelector('#indicatorBarChart .tabulator-row.impact-selected');
  if (!rowEl || !rowEl.offsetHeight) { pointer.style.display = 'none'; return; }
  pointer.style.top = `${rowEl.getBoundingClientRect().top - wrap.getBoundingClientRect().top + rowEl.offsetHeight / 2}px`;
  pointer.style.display = 'block';
}
window.addEventListener('resize', positionImpactPointer);

// Compact quantity in an indicator's unit: 1234567 -> 1.23M (kg CO2 eq)
function treemapQuantity(value, unit) {
  const abs = Math.abs(value || 0);
  const sign = value < 0 ? '-' : '';
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  let text = null;
  for (const [size, suffix] of units) {
    if (abs >= size) { text = `${sign}${parseFloat((abs / size).toPrecision(3))}${suffix}`; break; }
  }
  if (text === null) text = abs >= 1 ? `${sign}${parseFloat(abs.toPrecision(3))}` : formatCell(value, 'easy');
  return unit ? `${text} ${unit}` : text;
}

// Six-step color scale from the active theme's --heatmap-0..5 (base.css and localsite/css/themes).
// Dark mode uses --heatmap-dark-0..5 when a theme defines them, otherwise the light scale reversed,
// so low values sit near the dark background and high values are brightest.
function treemapHeatmapStops(el) {
  const style = getComputedStyle(el);
  const read = prefix => [0, 1, 2, 3, 4, 5].map(i => style.getPropertyValue(prefix + i).trim()).filter(Boolean);
  const dark = document.body.classList.contains('dark');
  if (dark) {
    const darkStops = read('--heatmap-dark-');
    if (darkStops.length === 6) return darkStops;
  }
  let stops = read('--heatmap-');
  if (stops.length !== 6) stops = ['#ddf1f1', '#b8e6e6', '#7dd3d3', '#42c0c0', '#2a9a9a', '#1a6b6b']; // base.css defaults
  return dark ? stops.slice().reverse() : stops;
}

// Legend beside #matrixInfo for the three tones within a tile: its regional sections, largest first, with
// the second and later darkened by overlayAlpha (see drawTile). No legend for tiles with a single region.
function showMatrixToneLegend(color, overlayAlpha) {
  const el = document.getElementById('matrixToneLegend');
  if (!el) return;
  if (!color) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const shade = a => a ? `background-image:linear-gradient(rgba(0,0,0,${a}),rgba(0,0,0,${a}));` : '';
  const labels = ['Largest region', '2nd', matrixRegions.length > 3 ? '3rd and later' : '3rd'];
  const alphas = [0, overlayAlpha[0], overlayAlpha[1]];
  el.innerHTML = labels.slice(0, Math.min(3, matrixRegions.length)).map((label, k) =>
    `<span class="tone" title="Section tone for the ${k ? label : 'largest'} region share within each tile"><i style="background-color:${color};${shade(alphas[k])}"></i>${label}</span>`).join('');
  el.style.display = '';
}

// Link to profile/footprint/ with the current hash (country, state, demand, year...), shown on other pages such as /engine
function updateFootprintPageLink() {
  const link = document.getElementById('footprintPageLink');
  if (!link) return;
  const footprintPath = new URL(FOOTPRINT_BASE).pathname;
  const onFootprint = window.location.pathname.replace(/index\.html$/, '') === footprintPath;
  link.style.display = onFootprint ? 'none' : '';
  if (onFootprint) return;
  const hash = typeof getHash === 'function' ? getHash() : {};
  const query = Object.keys(hash)
    .filter(k => hash[k] !== '' && hash[k] != null && typeof hash[k] !== 'object')
    .map(k => `${k}=${String(hash[k]).replace(/&/g, '%26')}`).join('&');
  link.href = FOOTPRINT_BASE + (query ? '#' + query : '');
}
updateFootprintPageLink();
window.addEventListener('hashchange', updateFootprintPageLink);
document.addEventListener('hashChangeEvent', updateFootprintPageLink);
// A quiet hash change (replaceState) sends no event, so refresh again just before the link is used
['mousedown', 'focus', 'touchstart'].forEach(type => document.getElementById('footprintPageLink')?.addEventListener(type, updateFootprintPageLink));
// The Matrix Datasets link at the end of #matrixInfo shows and hides the model's matrix datasets (#matrixDatasets)
// just below, above the matrix table. Delegated, since #matrixInfo is rewritten (withDatasetsLink).
document.addEventListener('click', event => {
  const link = event.target.closest && event.target.closest('#matrixDatasetsLink');
  if (!link) return;
  event.preventDefault();
  const datasets = document.getElementById('matrixDatasets');
  datasets.hidden = !datasets.hidden;
  link.setAttribute('aria-expanded', String(!datasets.hidden));
});
// #matrixInfo's text followed by the Matrix Datasets link, which replaces "matrices." when the text ends with it
function withDatasetsLink(html) {
  if (!html) return html;
  const datasets = document.getElementById('matrixDatasets');
  const link = `<a id="matrixDatasetsLink" href="" role="button" aria-controls="matrixDatasets" `
    + `aria-expanded="${datasets ? String(!datasets.hidden) : 'false'}">Matrix Datasets</a>`;
  const end = html.endsWith('</small>') ? '</small>' : '';
  const text = html.slice(0, html.length - end.length);
  return (text.endsWith('matrices.') ? text.slice(0, -'matrices.'.length) + link : text + ' ' + link) + end;
}

// Dark text on light tiles, white text on dark tiles
function treemapLabelColor(color) {
  const [r, g, b] = echarts.color.parse(color) || [0, 0, 0];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1f2937' : '#fff';
}

// A coefficient is dollars of input per dollar of output, shown as cents per $1 (e.g. 0.0234 -> 2.34¢ per $1)
function treemapAmount(coefficient) {
  const cents = (coefficient || 0) * 100;
  return `${parseFloat(cents.toPrecision(3))}¢ per $1`;
}

// Squarified treemap layout (Bruls et al.): rectangles in the order of values (sorted high to low),
// with areas proportional to the values, filling width × height
function treemapSquarify(values, width, height) {
  const total = values.reduce((t, v) => t + v, 0);
  const rects = values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  if (!total || width <= 0 || height <= 0) return rects;
  const areas = values.map(v => v * width * height / total);
  let x = 0, y = 0, w = width, h = height, i = 0;
  const worst = (row, side) => {
    const sum = row.reduce((t, a) => t + a, 0);
    return Math.max(side * side * Math.max(...row) / (sum * sum), (sum * sum) / (side * side * Math.min(...row)));
  };
  while (i < areas.length) {
    if (areas[i] <= 0) { i++; continue; }
    const side = Math.min(w, h);
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && areas[j] > 0 && worst(row.concat(areas[j]), side) <= worst(row, side)) row.push(areas[j++]);
    const sum = row.reduce((t, a) => t + a, 0);
    let k = i;
    if (w >= h) { // A column on the left
      const cw = sum / h;
      let cy = y;
      row.forEach(a => { rects[k++] = { x: x, y: cy, w: cw, h: a / cw }; cy += a / cw; });
      x += cw; w -= cw;
    } else { // A row along the top
      const rh = sum / w;
      let cx = x;
      row.forEach(a => { rects[k++] = { x: cx, y: y, w: a / rh, h: rh }; cx += a / rh; });
      y += rh; h -= rh;
    }
    i = j;
  }
  return rects;
}

// Compact dollars: 1234567 -> $1.23M
function treemapDollars(value) {
  const abs = Math.abs(value || 0);
  const sign = value < 0 ? '-' : '';
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${sign}$${parseFloat((abs / size).toPrecision(3))}${suffix}`;
  }
  return `${sign}$${Math.round(abs)}`;
}

function renderMatrixTreemap(matrixData) {
  try {
    const el = document.getElementById('matrixTreemap');
    const titleEl = document.getElementById('matrixTreemapTitle');
    const taglineEl = document.getElementById('matrixTreemapTagline');
    if (!el) return;
    matrixTreemapData = matrixData; // Re-rendered when dark mode or the theme changes
    if (!matrixData || matrixData.length === 0) {
      el.style.display = 'none';
      if (titleEl) titleEl.style.display = 'none';
      if (taglineEl) taglineEl.style.display = 'none';
      showMatrixToneLegend(null);
      if (matrixTreemapChart) { try{ matrixTreemapChart.dispose(); }catch(e){} matrixTreemapChart=null; }
      return;
    }

    el.style.display = 'block';
    // Industry name as the title above the treemap, followed by the tagline
    try {
      const sectorName = (document.querySelector('#info h3') || {}).textContent || '';
      if (titleEl) {
        titleEl.textContent = sectorName;
        titleEl.style.display = sectorName ? 'block' : 'none';
      }
      if (taglineEl && regionView) {
        taglineEl.style.display = 'block';
        taglineEl.textContent = regionTagline(matrixData);
      } else if (taglineEl) {
        taglineEl.style.display = 'block';
        const hasSpent = matrixData.some(d => d.spent != null);
        const who = matrixDirection === 'sellers'
          ? `Top ${matrixData.length} sectors selling to this industry`
          : `Top ${matrixData.length} sectors buying from this industry`;
        const amounts = !hasSpent ? 'Amounts are cents of input per $1 of output.'
          : matrixDirection === 'sellers'
            ? 'Amounts are what this industry spends on each (coefficient × its total output); hover for the amount per $1.'
            : 'Amounts are what each sector spends on this industry (coefficient × that sector\'s total output); hover for the amount per $1.';
        const shownImpact = matrixImpactShown();
        const impactView = matrixRank === 'impact' && shownImpact;
        const area = impactView ? `${shownImpact.name} (${shownImpact.unit})`
          : (matrixRank === 'spent' && hasSpent) ? 'total spent' : 'amount per $1';
        const split = matrixRegions.length > 1 ? ` Each sector is split into regional sections (${matrixRegions.map(r => r.label).join(', ')}), largest first; later sections are darker.` : '';
        const impactAmounts = matrixDirection === 'sellers'
          ? 'Amounts are what this industry spends on each sector × that sector\'s whole supply chain impact per $1, adding up to the Suppliers bar above. Click a row in the impacts chart to choose the indicator.'
          : 'Amounts are what each sector spends on this industry × that sector\'s own direct impact per $1, adding up to the Buyers bar above. Click a row in the impacts chart to choose the indicator.';
        const unAmounts = matrixSource !== 'un' ? null : impactView
          ? (matrixDirection === 'sellers'
            ? `Amounts are each supplier's own direct ${shownImpact.name.toLowerCase()} on what this industry buys from it (the trade tables' factors), not its whole supply chain.`
            : `Amounts are what each industry spends on this one × that industry's own direct ${shownImpact.name.toLowerCase()} per euro.`)
          : `Amounts are the state's share of the national flows in the Exiobase ${exiobaseYear()} trade tables, in US dollars at the ${exiobaseYear()} exchange rate.`;
        taglineEl.textContent = `${who}, ranked by ${area}: rectangle area = ${impactView ? 'impact' : area}; color = normalized magnitude (low → high). ${unAmounts || (impactView ? impactAmounts : amounts)}${split}`;
      }
    } catch (e) { /* ignore tagline errors */ }

    if (typeof echarts === 'undefined') { el.innerHTML = '<div style="color:#a00">ECharts not loaded</div>'; return; }
    // Reuse the chart so the tiles animate to their new sizes (see the tween below)
    const reuse = !!matrixTreemapChart && !matrixTreemapChart.isDisposed() && matrixTreemapChart.getDom() === el;
    if (!reuse && matrixTreemapChart) { try { matrixTreemapChart.dispose(); } catch (e) { console.warn('dispose previous treemap failed', e); } matrixTreemapChart = null; }
    const chart = reuse ? matrixTreemapChart : echarts.init(el);
    matrixTreemapChart = chart;

    // One tile per sector, sized by the active ranking (total spent or amount per $1).
    // Inside a tile each region is a section, largest first; later sections are darkened by a
    // transparent overlay. The text is centered over the whole tile: the sector, then one line per region.
    const multiRegion = matrixRegions.length > 1;
    const stops = treemapHeatmapStops(el);
    const style = getComputedStyle(el);
    const dark = document.body.classList.contains('dark');
    const shown = v => v != null ? treemapDollars(v) : '';
    // Tile amounts follow the ranking: total spent, or the per-dollar amount when Per $1 is chosen
    const shownImpact = matrixImpactShown();
    const impactView = matrixRank === 'impact' && shownImpact;
    // Impact amounts without the unit, which the tagline and hover give, so small tiles keep their numbers
    const amountText = item => impactView ? (item.impact != null ? treemapQuantity(item.impact) : '')
      : (matrixRank === 'spent' && item.spent != null) ? treemapDollars(item.spent) : treemapAmount(item.coefficient);
    // A region's share of its sector: by dollars when known, otherwise by coefficient
    const regionShare = (d, r) => {
      if (impactView) {
        const total = d.regions.reduce((t, x) => t + Math.abs(x.impact || 0), 0);
        return total ? Math.abs(r.impact || 0) / total : 0;
      }
      if (d.spent && r.spent != null) return Math.abs(r.spent / d.spent);
      const total = d.regions.reduce((t, x) => t + Math.abs(x.coefficient), 0);
      return total ? Math.abs(r.coefficient) / total : 0;
    };
    const values = matrixData.map(d => Math.abs(rankValue(d, matrixRank)));
    const maxValue = Math.max(...values, 0) || 1;
    // Overlay opacity for the second and third sections (dark tiles need more to show the step)
    const overlayAlpha = dark ? [0.3, 0.5] : [0.15, 0.3];
    const worldLinks = !!(regionView && regionView.region.kind === 'world');
    showMatrixToneLegend(multiRegion ? echarts.color.lerp(0.6, stops) : null, overlayAlpha);
    const tiles = matrixData.map((d, i) => {
      const color = echarts.color.lerp(Math.min(values[i] / maxValue, 1), stops);
      const parts = d.regions
        .map(r => ({ r: r, share: regionShare(d, r) }))
        .sort((a, b) => b.share - a.share);
      const regionLines = parts.map(({ r }) => multiRegion ? `${r.label} ${amountText(r)}` : amountText(r));
      // Clickable lines: the industry (its demand), and in the World view each country (country in the hash)
      const regionLinks = parts.map(({ r }) => {
        const location = worldLinks && (matrixRegions.find(x => x.key === r.key) || {}).location;
        return location ? { country: location, industry: d.sectorCode } : null;
      });
      return {
        key: String(d.sectorCode || d.sector), // Matches the same industry between views
        sectorCode: d.sectorCode,
        value: values[i],
        color: color,
        textColor: treemapLabelColor(color),
        shares: parts.map(p => p.share),
        lines: [d.sector, ...regionLines],
        links: [d.sectorCode ? { industry: d.sectorCode } : null, ...regionLinks],
        tip: `<b>${d.sector}</b><br/>`
          + (impactView && d.impact != null ? `${shownImpact.name}: ${treemapQuantity(d.impact, shownImpact.unit)}<br/>`
            + (multiRegion ? parts.map(({ r }) => `${r.label}: ${treemapQuantity(r.impact, shownImpact.unit)}`).join('<br/>') + '<br/>' : '') : '')
          + `${d.spent != null ? `${matrixAmountLabel()}: ${shown(d.spent)}<br/>` : ''}`
          + (multiRegion ? parts.map(({ r }) => `${r.label}: ${r.spent != null ? (r.coefficient != null ? `${shown(r.spent)} (${treemapAmount(r.coefficient)})` : shown(r.spent)) : treemapAmount(r.coefficient)}`).join('<br/>') + '<br/>' : '')
          + (d.coefficient != null ? `Per dollar: ${treemapAmount(d.coefficient)}<br/>Coefficient: ${formatCell(d.coefficient || 0, 'easy')}` : `${matrixSource === 'un' ? 'Exiobase industry' : 'Sector'} ${d.sectorCode}`)
          + (regionView && regionView.outside ? '' : `<br/><small>Click to show this ${regionView ? 'industry' : 'sector'}'s profile</small>`)
      };
    });

    // Tile layout for the current chart size, recomputed on resize
    let layoutKey = '', layout = [];
    const tileLayout = (width, height) => {
      const key = `${width}x${height}`;
      if (key !== layoutKey) { layoutKey = key; layout = treemapSquarify(tiles.map(t => t.value), width, height); }
      return layout;
    };

    // Transition, matched by industry: each industry glides from where it was drawn to its new tile,
    // industries leaving the top 25 fade out in place and new ones fade in. Drawn frame by frame here
    // rather than with ECharts' own transitions, which kept state between views and stopped animating.
    const prev = reuse ? matrixTreemapDrawn : {};
    matrixTreemapDrawn = {}; // Filled as tiles are drawn, so the next view starts from the current frame
    // A click mid-transition starts the next one from the current frame, keeping work waiting for the end
    const waiting = matrixTreemapAnim && !matrixTreemapAnim.cancelled ? matrixTreemapAnim.done.splice(0) : [];
    if (matrixTreemapAnim) matrixTreemapAnim.cancelled = true;
    const anim = { progress: Object.keys(prev).length ? 0 : 1, done: waiting };
    matrixTreemapLinks.boxes = new Map();
    matrixTreemapLinks.hovered = null;
    matrixTreemapAnim = anim;
    const tileKeys = new Set(tiles.map(t => t.key));
    // Leaving industries first, so they sit beneath the tiles that grow over them
    let items = Object.keys(prev).filter(key => !tileKeys.has(key)).map(key => ({ leave: prev[key] }))
      .concat(tiles.map((t, i) => ({ tile: i })));
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // cubic in-out
    const lerp = (a, b, t) => a + (b - a) * t;

    const gap = 3; // Between tiles only, so tiles reach the container edges
    // One tile: the industry's rect, its region sections, then the centered text (none while leaving)
    const drawTile = (box, shares, color, tile, opacity, width, height) => {
      const x0 = box.x + (box.x > 0.5 ? gap / 2 : 0);
      const y0 = box.y + (box.y > 0.5 ? gap / 2 : 0);
      const x1 = box.x + box.w - (box.x + box.w < width - 0.5 ? gap / 2 : 0);
      const y1 = box.y + box.h - (box.y + box.h < height - 0.5 ? gap / 2 : 0);
      const w = Math.max(x1 - x0, 0), h = Math.max(y1 - y0, 0);
      const children = [{ type: 'rect', silent: !tile, shape: { x: x0, y: y0, width: w, height: h }, style: { fill: color, opacity: opacity } }];
      // Region sections as vertical strips, left to right, largest first
      let offset = 0;
      shares.forEach((share, k) => {
        const size = share * w;
        if (k > 0 && size > 0) {
          children.push({
            type: 'rect', silent: true,
            shape: { x: x0 + offset, y: y0, width: size, height: h },
            style: { fill: `rgba(0,0,0,${overlayAlpha[Math.min(k - 1, overlayAlpha.length - 1)]})`, opacity: opacity }
          });
        }
        offset += size;
      });
      if (!tile) return { type: 'group', children: children };
      tile.links.forEach((link, k) => matrixTreemapLinks.boxes.delete(`${tile.key}|${k}`)); // Re-added for lines that fit
      // As many centered lines as fit: sector (larger title), then each region
      const lineHeight = 15, titleSize = 15, titleLineHeight = 19;
      const lineCount = h - 4 < titleLineHeight ? 0 : Math.min(tile.lines.length, 1 + Math.floor((h - 4 - titleLineHeight) / lineHeight));
      if (lineCount > 0 && w > 24) {
        // Truncated here rather than with a fixed text width, so a link's hover background fits its text
        let top = y0 + (h - (titleLineHeight + (lineCount - 1) * lineHeight)) / 2;
        tile.lines.slice(0, lineCount).forEach((line, k) => {
          const title = k === 0;
          const height = title ? titleLineHeight : lineHeight;
          const font = title ? `bold ${titleSize}px sans-serif` : '12px sans-serif';
          const link = tile.links[k];
          const text = echarts.format.truncateText(String(line), w - 16, font, '…');
          // Link lines: their bounds, for the click and hover handlers below, and the dark hover look
          const linkKey = link ? `${tile.key}|${k}` : null;
          const hovered = linkKey && matrixTreemapLinks.hovered === linkKey;
          if (link) {
            const textWidth = treemapTextWidth(text, font) + 8;
            matrixTreemapLinks.boxes.set(linkKey, { x: x0 + w / 2 - textWidth / 2, y: top, w: textWidth, h: height, link: link });
          }
          children.push({
            type: 'text', silent: true,
            style: {
              text: text,
              x: x0 + w / 2, y: top + height / 2, align: 'center', verticalAlign: 'middle', opacity: opacity,
              fill: hovered ? '#fff' : tile.textColor, font: font, padding: [1, 4], borderRadius: 3,
              backgroundColor: hovered ? 'rgba(17, 24, 39, 0.92)' : 'transparent'
            }
          });
          top += height;
        });
      } else if (w >= 8 && h >= 10) {
        // Too small for the lines: just the first letter of the sector name (the hover has the rest)
        const letter = (String(tile.lines[0] || '').match(/[A-Za-z0-9]/) || [''])[0].toUpperCase();
        if (letter) {
          children.push({
            type: 'text', silent: true,
            style: {
              text: letter, x: x0 + w / 2, y: y0 + h / 2, align: 'center', verticalAlign: 'middle', opacity: opacity,
              fill: tile.textColor, fontWeight: 'bold', fontSize: Math.max(8, Math.min(14, w - 2, h - 2))
            }
          });
        }
      }
      return { type: 'group', children: children };
    };

    const renderTile = (params, api) => {
      const width = api.getWidth(), height = api.getHeight();
      const item = items[params.dataIndex];
      if (!item) return null;
      const t = ease(anim.progress);
      const toPixels = b => ({ x: b.x * width, y: b.y * height, w: b.w * width, h: b.h * height });
      if (item.leave) return drawTile(toPixels(item.leave), item.leave.shares, item.leave.color, null, 1 - t, width, height);
      const tile = tiles[item.tile];
      const target = tileLayout(width, height)[item.tile];
      if (!tile || !target) return null;
      const from = t < 1 ? prev[tile.key] : null;
      let box = target, color = tile.color, shares = tile.shares;
      if (from) {
        const a = toPixels(from);
        box = { x: lerp(a.x, target.x, t), y: lerp(a.y, target.y, t), w: lerp(a.w, target.w, t), h: lerp(a.h, target.h, t) };
        color = echarts.color.lerp(t, [from.color, tile.color]);
        if (from.shares.length === tile.shares.length) shares = tile.shares.map((share, k) => lerp(from.shares[k], share, t));
      }
      matrixTreemapDrawn[tile.key] = { x: box.x / width, y: box.y / height, w: box.w / width, h: box.h / height, shares: shares, color: color };
      // Industries new to the top 25 fade in at their tile
      return drawTile(box, shares, color, tile, (from || anim.progress >= 1 || prev[tile.key]) ? 1 : t, width, height);
    };

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        // On the page body, so #matrixTreemap's overflow: hidden (for its rounded corners) doesn't crop it
        appendToBody: true,
        formatter: params => { const item = items[params.dataIndex]; return (item && item.tile != null && tiles[item.tile].tip) || ''; },
        ...(dark ? {
          backgroundColor: style.getPropertyValue('--bg-card').trim() || '#2b2926',
          borderColor: style.getPropertyValue('--border-subtle').trim() || '#555',
          textStyle: { color: style.getPropertyValue('--text-main').trim() || '#e5e7eb' }
        } : {})
      },
      series: [{
        type: 'custom',
        coordinateSystem: 'none', // Tiles are laid out in pixels by treemapSquarify
        animation: false, // The tween below animates the tiles
        renderItem: renderTile,
        data: items.map((item, i) => [i, 0])
      }]
    };

    // Clicking a tile switches the page to that sector
    chart.off('click');
    chart.on('click', params => {
      if (params.event && linkAt(params.event.offsetX, params.event.offsetY)) return; // The canvas handler below has it
      const item = items[params.dataIndex];
      if (item && item.tile != null) showMatrixSector(tiles[item.tile].sectorCode);
    });

    // Link lines (the industry name, and each country in the World view), found by the bounds drawTile
    // recorded, since the text itself is silent so the tile keeps its popup. A hovered line redraws dark.
    const linkAt = (x, y) => {
      for (const [key, box] of matrixTreemapLinks.boxes) {
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return { key, link: box.link };
      }
      return null;
    };
    let hoverRedraws = 0;
    const setHovered = key => {
      if (matrixTreemapLinks.hovered === key) return;
      matrixTreemapLinks.hovered = key;
      try { chart.setOption({ series: [{ data: items.map((item, i) => [i, -(++hoverRedraws)]) }] }); } catch (err) { console.error('treemap hover failed', err); }
    };
    const zr = chart.getZr();
    if (matrixTreemapLinks.handlers) Object.entries(matrixTreemapLinks.handlers).forEach(([type, fn]) => zr.off(type, fn));
    matrixTreemapLinks.handlers = {
      click: e => {
        const hit = linkAt(e.offsetX, e.offsetY);
        if (!hit) return;
        if (hit.link.country) showMatrixCountry(hit.link.country, hit.link.industry);
        else if (hit.link.industry) showMatrixIndustry(hit.link.industry);
      },
      mousemove: e => {
        const hit = linkAt(e.offsetX, e.offsetY);
        setHovered(hit ? hit.key : null);
        if (hit) zr.setCursorStyle('pointer');
      },
      globalout: () => setHovered(null)
    };
    Object.entries(matrixTreemapLinks.handlers).forEach(([type, fn]) => zr.on(type, fn));

    // Already drawn: tween from the current tiles to the new ones, one setOption per animation frame
    if (reuse) {
      try { chart.setOption(option); } catch (err) { console.error('treemap update failed', err); }
      if (anim.progress < 1) {
        let frame = 0;
        const step = now => {
          if (anim.cancelled || chart.isDisposed()) return;
          if (anim.start == null) anim.start = now;
          anim.progress = Math.min(1, (now - anim.start) / 700);
          if (anim.progress >= 1) items = items.filter(item => !item.leave); // Faded out
          try { chart.setOption({ series: [{ data: items.map((item, i) => [i, ++frame]) }] }); } catch (err) { console.error('treemap frame failed', err); return; }
          if (anim.progress < 1) requestAnimationFrame(step);
          else anim.done.splice(0).forEach(fn => fn());
        };
        requestAnimationFrame(step);
      } else {
        anim.done.splice(0).forEach(fn => fn());
      }
      return;
    }
    anim.done.splice(0).forEach(fn => fn());

    // Show loading and compute options asynchronously to avoid blocking the UI
    try { chart.showLoading(); } catch (e) {}
    // remove previous resize handler if present
    try { if (matrixTreemapResizeHandler) { window.removeEventListener('resize', matrixTreemapResizeHandler); matrixTreemapResizeHandler = null; } } catch (e) {}
    setTimeout(() => {
      try {
  chart.setOption(option);
  try { chart.hideLoading(); } catch (e) {}
  // Force a few resize/paint cycles so layout completes even when
  // DevTools isn't open (some browsers delay layout otherwise).
  try { matrixTreemapChart.resize(); } catch (e) {}
  try { requestAnimationFrame(() => { try { matrixTreemapChart.resize(); } catch (e) {} }); } catch (e) {}
  try { setTimeout(() => { try { matrixTreemapChart.resize(); } catch (e) {} }, 200); } catch (e) {}
  // attach a single resize handler for the treemap
  matrixTreemapResizeHandler = () => { try { if (matrixTreemapChart) matrixTreemapChart.resize(); } catch (e) {} };
  window.addEventListener('resize', matrixTreemapResizeHandler);
      } catch (err) {
        console.error('treemap setOption failed', err);
        try { chart.hideLoading(); } catch (e) {}
      }
    }, 20);
  } catch (e) { console.error('renderMatrixTreemap failed', e); }
}

async function loadDataSources(sector) {
  try {
    const dataSourcesSection = document.getElementById('dataSourcesSection');
    const dataSourcesInfo = document.getElementById('dataSourcesInfo');
    const dataSourcesTable = document.getElementById('dataSourcesTable');
    
    // Get model information
    const modelName = getModelFolderName();
    //const baseUrlRaw = `https://raw.githubusercontent.com/ModelEarth/useeio-json/main/models/${getModelYear()}/${modelName}`;
    const baseUrl = `https://github.com/ModelEarth/useeio-json/blob/main/models/${getModelYear()}/${modelName}`;
    
    dataSourcesInfo.innerHTML = `Data sources and methodology for sector: <strong>${sector.name}</strong> (${modelName})`;
    
    // Get model metadata (guard against models that don't expose metadata())
    let metadata = { version: modelName };
    if (model && typeof model.metadata === 'function') {
      try {
        metadata = await model.metadata();
      } catch (e) {
        console.warn('Could not load metadata:', e);
        // leave fallback metadata in place
      }
    } else {
      console.log('model.metadata() not available; using fallback metadata');
    }
    
    // Get indicators and demands to show what data is actually used
    const indicators = await model.indicators();
    const demands = await model.demands();
    
    // Create comprehensive data sources information
    const dataSourcesData = [
      {
        dataset: "Technical Coefficient Matrix (A)",
        description: "Inter-industry economic relationships and dependencies",
        format: "JSON Matrix",
        url: `${baseUrl}/matrix/A.json`,
        usage: "Calculates direct economic impacts between sectors"
      },
      {
        dataset: "Environmental Matrix (B)",
        description: "Direct environmental coefficients by sector",
        format: "JSON Matrix", 
        url: `${baseUrl}/matrix/B.json`,
        usage: "Direct environmental impacts per dollar of output"
      },
      {
        dataset: "Total Requirements Matrix (L)",
        description: "Leontief inverse matrix (I-A)^-1",
        format: "JSON Matrix",
        url: `${baseUrl}/matrix/L.json`, 
        usage: "Calculates total economic requirements (direct + indirect)"
      },
      {
        dataset: "Environmental Multipliers (D)",
        description: "Total environmental impact coefficients",
        format: "JSON Matrix",
        url: `${baseUrl}/matrix/D.json`,
        usage: "Total environmental impacts (direct + indirect + induced)"
      },
      {
        dataset: "Sectors",
        description: `${sector.code} - ${sector.name} and all other sectors`,
        format: "JSON Array",
        url: `${baseUrl}/sectors.json`,
        usage: "Sector classification and naming"
      },
      {
        dataset: "Indicators", 
        description: `${indicators.length} environmental impact indicators`,
        format: "JSON Array",
        url: `${baseUrl}/indicators.json`,
        usage: "Environmental impact categories (GHG, water, land, etc.)"
      },
      {
        dataset: "Demands",
        description: `${demands.length} demand vectors available`,
        format: "JSON Object",
        url: `${baseUrl}/demands.json`, 
        usage: "Economic demand scenarios for analysis"
      }
    ];
    
    // Add location-specific information if available
    if (sector.location && sector.location !== 'US') {
      dataSourcesData.push({
        dataset: "State-Level Data",
        description: `Location-specific data for ${sector.location}`,
        format: "Model Extension",
        url: "https://www.epa.gov/land-research/useeio-state-models",
        usage: "State-level economic and environmental coefficients"
      });
    }
    
    // Add metadata information
    dataSourcesData.push({
      dataset: "Model Metadata",
      description: `${metadata?.name || modelName} model information`,
      format: "JSON Object", 
      url: `${baseUrl}/metadata.json`,
      usage: "Model version, description, and technical specifications"
    });
    
    renderDataSourcesTable("#dataSourcesTable", dataSourcesData);
    dataSourcesSection.style.display = 'block';
  } catch (error) {
    console.error('Error loading data sources:', error);
    document.getElementById('dataSourcesInfo').innerHTML = `Data sources and methodology for sector: <strong>${sector?.name || 'Unknown'}</strong><br><em>Error: ${error.message}</em>`;
    document.getElementById('dataSourcesSection').style.display = 'block';
  }
}

// A table of data sources: rows of {dataset, description, usage, format, url, label (optional link text)}.
// Used by the Data Sources section and below the UN commodity list.
function renderDataSourcesTable(selector, rows) {
    return new Tabulator(selector, {
      data: rows,
      layout: "fitColumns",
      columns: [
        { title: "Dataset", field: "dataset", width: 180 },
        { title: "Description", field: "description", widthGrow: 2 },
        { title: "Usage in Report", field: "usage", widthGrow: 2 },
        { title: "Format", field: "format", width: 100 },
        { 
          title: "Data Link", 
          field: "url", 
          formatter: function(cell) {
            const url = cell.getValue();
            const filename = cell.getRow().getData().label || url.split('/').filter(Boolean).pop();
            return `<a href="${url}" target="_blank">${filename}</a>`;
          },
          width: 120
        }
      ]
    });
}

// Store table references for updating
var mainTable, matrixTable;
// Matrix view: 'sellers' (this sector's inputs) or 'buyers' (sectors using its output)
var matrixDirection = 'sellers';
// Rank and size by 'spent' (total dollars), 'coefficient' (amount per $1) or 'impact' (one indicator)
var matrixRank = 'spent';
var matrixLists = null;
// Indicator for the Impact ranking, chosen by clicking a row in the impacts chart: {code, index, name, unit}
var matrixImpact = null;
// Inputs kept from loadMatrixData for building the Impact lists on demand
var matrixContext = null;
// Regions in the model, e.g. [{key: 'r0', location: 'US-GA', label: 'GA'}, {key: 'r1', location: 'RoUS', label: 'Rest of US'}]
var matrixRegions = [];
// Whether the EPA model has total outputs (q), for Total Spent and Impact
var matrixHasSpent = true;
// 'epa' (the USEEIO model's A matrix) or 'un' (the Exiobase trade tables), from the UN / EPA toggle shared
// with the Top 10 panel (getSupportingIndustriesSource in ../item/js/supporting-industries.js)
var matrixSource = 'epa';
// The EPA lists and regions, kept while UN shows, and the EPA info line under the treemap
var matrixEpa = null;
var matrixEpaInfo = '';
// UN for the current sector: {state, targets (Exiobase industry ids), lists, regions}, or {unavailable: reason}
var matrixExiobase = null;

// The Exiobase year the matrix shows: the hash's year when it has state tables, otherwise the nearest
function exiobaseYear() {
  return typeof exiobaseTablesYear === 'function' ? exiobaseTablesYear() : '';
}

// The state and Exiobase industries that UN shows for a sector (as in the Top 10 panel), or why it can't
async function matrixExiobaseFor(sector) {
  if (typeof exiobaseStateFlows !== 'function') return { unavailable: 'Exiobase trade tables are not loaded on this page' };
  const state = getModelState();
  if (!state) return { unavailable: 'UN is split among states: choose a state', noState: true };
  if (sector.location !== `US-${state}`) {
    return { unavailable: `UN shows the state's own commodities: choose one in ${state}`, otherRegion: true };
  }
  const targets = await exiobaseIndustriesForSummary(sector.code).catch(() => []);
  if (!targets.length) return { unavailable: 'No Exiobase industry matches this sector', noMatch: true, sectorCode: sector.code, state };
  return {
    state, targets, lists: {},
    regions: [
      { key: 'r0', location: `US-${state}`, label: state },
      { key: 'r1', location: 'RoUS', label: 'Rest of US' },
      { key: 'r2', location: 'Foreign', label: 'Foreign' }
    ]
  };
}

// The indicator sizing the Impact view: the chosen USEEIO indicator, or for UN its Exiobase factor in that
// factor's unit (GHG -> Greenhouse Gases in t CO₂ eq). Null for UN when Exiobase has no such factor.
function matrixImpactShown() {
  if (!matrixImpact) return null;
  if (matrixSource !== 'un') return matrixImpact;
  const factorKey = typeof unFactorForIndicator === 'function' ? unFactorForIndicator(matrixImpact.code) : null;
  if (!factorKey) return null;
  const factor = supportingIndustriesFactor(factorKey, 'un');
  return { code: matrixImpact.code, index: matrixImpact.index, name: factor.label, unit: factor.unit, factorKey };
}

// Top 25 Exiobase industries selling to (sellers) or buying from (buyers) the sector's Exiobase industries in
// the state, in buildMatrixList's row shape, with regions for the state, Rest of US and Foreign (sellers only).
// rank 'spent' (US dollars) or 'impact' (factorKey's UN factor). Rows have no coefficient: the trade tables
// have no industry outputs to divide by.
async function buildExiobaseMatrixList(ex, direction, rank, factorKey) {
  const flows = await exiobaseStateFlows(ex.state, ex.targets, direction);
  const amount = supportingIndustriesFactor('amt', 'un');
  const impactFactor = factorKey ? supportingIndustriesFactor(factorKey, 'un') : null;
  const regionNames = ['state', 'restOfUS', 'foreign'];
  const rows = [];
  flows.industries.forEach(item => {
    const regions = [];
    regionNames.forEach((name, k) => {
      const region = item.regions[name];
      const spent = exiobaseRegionValue(region, amount, flows.usdPerEur);
      if (!(spent > 0)) return;
      const r = ex.regions[k];
      regions.push({
        key: r.key, label: r.label, coefficient: null, output: null, spent: spent,
        impact: impactFactor ? exiobaseRegionValue(region, impactFactor, flows.usdPerEur) : null
      });
    });
    if (!regions.length) return;
    const row = {
      sector: item.name, sectorCode: item.code, coefficient: null,
      spent: regions.reduce((t, r) => t + r.spent, 0),
      impact: impactFactor ? regions.reduce((t, r) => t + r.impact, 0) : null,
      regions: regions
    };
    if (rank === 'impact' && !row.impact) return;
    regions.forEach(r => { row[`spent_${r.key}`] = r.spent; row[`impact_${r.key}`] = r.impact; });
    rows.push(row);
  });
  return rows.sort((a, b) => Math.abs(rankValue(b, rank)) - Math.abs(rankValue(a, rank))).slice(0, 25);
}

// Points the matrix lists and regions at the shown source: UN when the hash has source=un and the sector has
// Exiobase industries in a state model, otherwise EPA. Loads the Exiobase lists the first time UN shows for a
// sector. Returns false when a newer sector took over while loading.
async function applyMatrixSource() {
  const wanted = typeof getSupportingIndustriesSource === 'function' ? getSupportingIndustriesSource() : 'epa';
  const ex = matrixExiobase;
  // UN stays chosen when it can't show the sector: showMatrixBarrier() then says why
  matrixSource = (wanted === 'un' && typeof exiobaseStateFlows === 'function') ? 'un' : 'epa';
  if (matrixSource === 'epa') {
    matrixLists = matrixEpa.lists;
    matrixRegions = matrixEpa.regions;
    return true;
  }
  if (!ex || ex.unavailable) {
    matrixLists = {};
    matrixRegions = [];
    return true;
  }
  if (!ex.lists['sellers-spent']) {
    document.getElementById('matrixInfo').innerHTML = `<small>Loading the Exiobase ${exiobaseYear()} trade tables...</small>`;
    const [sellers, buyers] = await Promise.all([
      buildExiobaseMatrixList(ex, 'sellers', 'spent'),
      buildExiobaseMatrixList(ex, 'buyers', 'spent')
    ]);
    if (ex !== matrixExiobase) return false;
    ex.lists['sellers-spent'] = sellers;
    ex.lists['buyers-spent'] = buyers;
  }
  matrixLists = ex.lists;
  matrixRegions = ex.regions;
  if (matrixRank === 'coefficient' || (matrixRank === 'impact' && !matrixImpactShown())) matrixRank = 'spent';
  return true;
}

// The UN / EPA buttons in the matrix toolbar. When UN can't show the sector, its hover text says why. It stays
// clickable for a sector with no Exiobase industry (the explanation links to related UN sectors), else it greys out.
function markMatrixSource() {
  const el = document.getElementById('matrixSource');
  if (!el || !el.firstElementChild || typeof markSourceButtons !== 'function') return;
  const ex = !regionView && matrixExiobase;
  markSourceButtons(el, matrixSource, ex && ex.unavailable ? ex.unavailable : '', !!(ex && ex.noMatch));
  markEpaAvailability(el);
}

// The line under the treemap naming the data: the state's A matrix, or the Exiobase trade tables
function showMatrixInfo() {
  const info = document.getElementById('matrixInfo');
  if (!info) return;
  if (regionView) { info.innerHTML = withDatasetsLink(regionMatrixInfoHTML()); return; }
  if (matrixSource !== 'un') { info.innerHTML = withDatasetsLink(matrixEpaInfo); return; }
  const ex = matrixExiobase;
  if (!ex || ex.unavailable) { info.innerHTML = ''; return; }
  const year = exiobaseYear();
  const placeName = (typeof getState === 'function' && getState(ex.state)) || ex.state;
  const url = `https://github.com/ModelEarth/trade-data/tree/main/year/${year}/US/domestic`;
  info.innerHTML = withDatasetsLink(`<small>${placeName} share of the Exiobase industries ${ex.targets.join(', ')} in the `
    + `<a href="${url}" target="_blank">Exiobase ${year} trade tables</a> (trade-us.csv), split among states by BEA GDP by state, as in the Top 10 panel.`
    + (getExiobaseYear() !== year ? ` ${getExiobaseYear()} has no state tables, so the nearest year with them is shown.` : '') + '</small>');
}

// When UN is chosen but can't show the sector, say why in place of the treemap and table. With no Exiobase
// match, the Top 10 panel above lists the related industries (exiobaseBarrierHTML), so this points there.
let matrixBarrierKey = null;
async function showMatrixBarrier() {
  const el = document.getElementById('matrixBarrier');
  const table = document.getElementById('matrixTable');
  if (!el) return;
  const ex = matrixExiobase;
  const blocked = !regionView && matrixSource === 'un' && (!ex || ex.unavailable);
  const tableWasHidden = !!table && table.style.display === 'none';
  if (table) table.style.display = blocked ? 'none' : '';
  if (!blocked) {
    el.style.display = 'none';
    matrixBarrierKey = null;
    if (tableWasHidden && matrixTable) matrixTable.redraw(true); // Columns sized while hidden
    return;
  }
  el.style.display = '';
  const key = JSON.stringify(ex || {});
  if (key === matrixBarrierKey) return;
  matrixBarrierKey = key;
  let html;
  if (ex && ex.noState) {
    html = await exiobaseBarrierHTML({ noState: true });
  } else if (ex && ex.noMatch) {
    // The Top 10 panel shows for every state with a model. The link scrolls rather than changing the hash.
    html = USEEIO_STATE_MODELS.has(ex.state)
      ? `<div class="supporting-industries-status si-barrier">UN can't show this sector's suppliers and buyers: no Exiobase industry
          belongs mainly to it. <a href="#" onclick="document.getElementById('supportingIndustriesHeading').scrollIntoView({ behavior: 'smooth' }); return false;">Related industries are listed above</a>, below the commodities.</div>`
      : await exiobaseBarrierHTML({ sectorCode: ex.sectorCode, state: ex.state, linkFor: footprintUnLink });
  } else {
    html = `<div class="supporting-industries-status si-barrier">UN can't show this sector. ${(ex && ex.unavailable) || ''}.</div>`;
  }
  if (matrixBarrierKey === key) el.innerHTML = html;
}

// The UN / EPA toggle here or in the Top 10 panel: show the matrix section from the other source
document.addEventListener('supportingIndustriesSource', async () => {
  if (regionView) { main(); return; } // All of a place's industries, from the other source
  if (!matrixEpa || !matrixExiobase) return;
  const totalsBefore = matrixShowsTotals();
  try {
    if (!await applyMatrixSource()) return;
  } catch (e) {
    console.warn('Exiobase matrix lists not available', e);
    matrixExiobase = { unavailable: `The Exiobase ${exiobaseYear()} trade tables could not be loaded` };
    await applyMatrixSource();
  }
  showMatrixInfo();
  showMatrixList(totalsBefore);
});

// Keep a global reference to the matrix treemap chart so we can dispose/resize reliably
let matrixTreemapChart = null;
// Keep a reference to the resize handler so we don't add many listeners
let matrixTreemapResizeHandler = null;
// Last treemap data, to redraw with new colors when dark mode or the theme changes
let matrixTreemapData = null;
// Where each industry's tile was last drawn (fractions of the chart size, plus sections and color),
// so the next view's transition starts from there; and the running transition
let matrixTreemapDrawn = {};
let matrixTreemapAnim = null;
// The treemap's link lines: their bounds in pixels by tile and line, the hovered one, and the canvas handlers
let matrixTreemapLinks = { boxes: new Map(), hovered: null, handlers: null };
// Width of a line of treemap text in the given CSS font, to size its link area
let treemapMeasureContext = null;
function treemapTextWidth(text, font) {
  if (!treemapMeasureContext) treemapMeasureContext = document.createElement('canvas').getContext('2d');
  treemapMeasureContext.font = font;
  return treemapMeasureContext.measureText(text).width;
}

// localsite.js sets "dark" and the theme class (maestro, georgia...) on body
(function watchTreemapLook() {
  const lookKey = () => (document.body.classList.contains('dark') ? 'dark' : 'light') + ' '
    + (typeof localStylelookThemes !== 'undefined' ? localStylelookThemes.filter(t => document.body.classList.contains(t)).join(' ') : '');
  const redraw = () => {
    const el = document.getElementById('matrixTreemap');
    if (matrixTreemapData && el && el.style.display !== 'none') renderMatrixTreemap(matrixTreemapData);
  };
  let lastKey = null;
  const observer = new MutationObserver(() => {
    const key = lookKey();
    if (key === lastKey) return;
    lastKey = key;
    redraw();
    // A theme stylesheet loads on demand, so redraw again once its --heatmap colors arrive
    const themeLink = document.getElementById('stylelookThemeStylesheet');
    if (themeLink) themeLink.addEventListener('load', redraw, { once: true });
  });
  const start = () => { lastKey = lookKey(); observer.observe(document.body, { attributes: true, attributeFilter: ['class'] }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

// Global variables to store results data (keep full unfiltered data and the shown table data)
let fullTableData = [];
let tableData = [];
// Parts included in the indicator bar chart (checkboxes above it)
let indicatorParts = { supplier: true, industry: true, buyers: true };
let indicatorScaleMax = 1;
let indicatorFlows = { supplierRegions: null, buyers: null, buyerRegions: null, regions: [], ownOutput: 0 };
// Overlay opacity by region for Supplier and Buyers sections: none for the state, darker for Rest of US
// (and later Rest of World)
const indicatorOverlay = [0, 0.25, 0.45];
// Bar and button colors per part: light blue, purple, pink
const indicatorPartColors = { supplier: '#7cc3ee', industry: '#9b6dd6', buyers: '#fbd7e9' };
// Parts with their own color per region instead of the overlay: Buyers in the state are light pink
// (30% of #f27ab6 on white), Interstate Buyers a deeper pink (65%)
const indicatorRegionColors = { buyers: ['#fbd7e9', '#f6a9cf'] };

// Color and overlay for a part's kth region section (0 is the state, 1 is Rest of US)
function indicatorRegionStyle(part, k) {
  const colors = indicatorRegionColors[part];
  if (!colors) return { color: indicatorPartColors[part], overlay: indicatorOverlay[Math.min(k, indicatorOverlay.length - 1)] };
  // Past the listed colors (e.g. a later Rest of World), darken the last one with the overlay
  const extra = Math.max(0, k - colors.length + 1);
  return { color: colors[Math.min(k, colors.length - 1)], overlay: indicatorOverlay[Math.min(extra, indicatorOverlay.length - 1)] };
}

// Supplier and buyer impacts per $1 of the industry's output, normalized by the same totals as the profile.
// Supplier: the supply chain part of N = D × L, D[i, j] × L[j, sector] over the sectors j in each region,
//   leaving out the industry's own direct impacts (1 × D[i, sector]). Adds up to total minus direct.
// Buyers: each buyer's direct impacts D[i, j] times the share of its costs spent on this industry,
//   A[sector, j], times its output q[j], over this industry's output q[sector]. A downstream share,
//   not part of the model's standard (upstream) footprint.
async function indicatorFlowImpacts(sector, totals) {
  const result = { supplierRegions: null, buyers: null, buyerRegions: null, regions: [], ownOutput: 0 };
  try {
    const sectors = await model.sectors();
    const regions = matrixRegionList(sectors);
    result.regions = regions;
    const multiRegion = regions.length > 1;
    const [D, L, A] = await Promise.all([model.matrix('D'), multiRegion ? model.matrix('L') : null, model.matrix('A')]);
    let q = null;
    try { q = await model.matrix('q'); } catch (e) { console.warn('q vector not available, no Buyers impacts', e); }
    const norm = (sum, i) => totals && totals[i] ? sum / totals[i] : 0;
    const sumOver = (i, location, weight) => {
      let sum = 0;
      sectors.forEach(s => { if (location == null || s.location === location) sum += (D.data[i][s.index] || 0) * weight(s.index); });
      return norm(sum, i);
    };
    const supplierWeight = j => ((L.data[j] || [])[sector.index] || 0) - (j === sector.index ? 1 : 0);
    const qAt = j => (q && q.data[j]) ? q.data[j][0] : 0;
    const ownOutput = qAt(sector.index);
    result.ownOutput = ownOutput; // The industry's total output in dollars, for totals in the impact chart
    const buyerWeight = j => ownOutput ? ((A.data[sector.index] || [])[j] || 0) * qAt(j) / ownOutput : 0;
    if (multiRegion) {
      result.supplierRegions = regions.map(r => ({ label: r.label, values: D.data.map((row, i) => sumOver(i, r.location, supplierWeight)) }));
    }
    if (q && ownOutput) {
      result.buyers = D.data.map((row, i) => sumOver(i, null, buyerWeight));
      if (multiRegion) result.buyerRegions = regions.map(r => ({ label: r.label, values: D.data.map((row, i) => sumOver(i, r.location, buyerWeight)) }));
    }
  } catch (e) {
    console.warn('Supplier and buyer impacts not available', e);
  }
  return result;
}

function indicatorPartsValue(row) {
  return (indicatorParts.supplier ? row.supplierValue || 0 : 0)
    + (indicatorParts.industry ? row.directValue || 0 : 0)
    + (indicatorParts.buyers ? row.buyersValue || 0 : 0);
}

function indicatorShade(alpha) {
  return alpha ? `background-image:linear-gradient(rgba(0,0,0,${alpha}),rgba(0,0,0,${alpha}));` : '';
}

// Bar sections left to right: Supplier (Rest of US, then state), Industry, Buyers (state, then Rest of US).
// Each part has its own color; Rest of US sections are darkened by an overlay, so they sit on the outside.
function indicatorSections(row) {
  const sections = [];
  const { supplier, industry, buyers } = indicatorPartColors;
  if (indicatorParts.supplier) {
    if (row.supplierRegions) row.supplierRegions.map((r, k) => ({ label: `Suppliers in ${r.label}`, value: r.value, ...indicatorRegionStyle('supplier', k) })).reverse().forEach(x => sections.push(x));
    else sections.push({ label: 'Suppliers', value: row.supplierValue || 0, color: supplier, overlay: 0 });
  }
  if (indicatorParts.industry) sections.push({ label: 'Industry', value: row.directValue || 0, color: industry, overlay: 0 });
  if (indicatorParts.buyers && row.buyersValue != null) {
    if (row.buyersRegions) row.buyersRegions.forEach((r, k) => sections.push({ label: `Buyers in ${r.label}`, value: r.value, ...indicatorRegionStyle('buyers', k) }));
    else sections.push({ label: 'Buyers', value: row.buyersValue, color: buyers, overlay: 0 });
  }
  return sections;
}

function indicatorBar(row) {
  try {
    const sections = indicatorSections(row);
    const widths = sections.map(section => Math.max(0, section.value) / indicatorScaleMax * 100);
    const total = widths.reduce((t, w) => t + w, 0);
    // Hover in the indicator's unit per $1 (bar widths stay as shares of the US total)
    const unitValue = value => row.normTotal != null ? value * row.normTotal : value;
    const tip = sections.map(section => `${section.label}: ${formatCell(unitValue(section.value), 'easy')}${row.normTotal != null && row.unit ? ' ' + row.unit : ''}`).join('\n') + '\nPer $1 of output';
    if (total <= 0) return `<div style="height:16px" title="${tip}"></div>`;
    // outer wrapper is transparent so no gray rectangle shows beneath the bar
    return `<div style="height:16px" title="${tip}"><div style="display:flex;width:${Math.min(total, 100)}%;height:100%;border-radius:6px;overflow:hidden">`
      + sections.map((section, k) => `<div style="flex:0 0 ${widths[k] / total * 100}%;background-color:${section.color};${indicatorShade(section.overlay)}"></div>`).join('')
      + '</div></div>';
  } catch (e) {
    return '';
  }
}

// Suppliers / Industry / Buyers buttons above the indicator bar chart, in their bar colors. Clicking a
// button shows only that part; its checkbox adds or removes the part, to combine them. The legend after
// the buttons shows the light (state) and dark (Rest of US) shades.
function setupIndicatorParts() {
  const toolbar = document.getElementById('indicatorToolbar');
  if (!toolbar) return;
  toolbar.style.display = '';
  const regions = indicatorFlows.regions.length > 1 ? indicatorFlows.regions : [];
  const swatch = style => `<i style="background-color:${style.color};${indicatorShade(style.overlay)}"></i>`;
  const buyersAvailable = !!indicatorFlows.buyers;
  if (!buyersAvailable) indicatorParts.buyers = false;
  // Keep at least one part, e.g. after showing only Buyers then loading a model without them
  if (!indicatorParts.supplier && !indicatorParts.industry && !indicatorParts.buyers) indicatorParts = { supplier: true, industry: true, buyers: false };
  toolbar.querySelectorAll('input[data-part]').forEach(input => {
    const part = input.dataset.part;
    input.checked = !!indicatorParts[part];
    input.disabled = part === 'buyers' && !buyersAvailable;
    input.closest('label').classList.toggle('active', input.checked);
    input.closest('label').classList.toggle('disabled', input.disabled);
  });
  // Which shade is which region: a legend for Suppliers and one for Buyers, each in its part color
  const note = document.getElementById('indicatorRegionNote');
  if (note) {
    // Full state name (getState from localsite.js), e.g. US-GA -> Georgia
    const regionName = r => (/^US-/.test(r.location || '') && typeof getState === 'function' && getState(r.location.slice(3))) || r.label;
    // Rest of US reads as Interstate Suppliers or Interstate Buyers
    const legendName = (r, part) => r.location === 'RoUS' ? (part === 'supplier' ? 'Interstate Suppliers' : 'Interstate Buyers') : regionName(r);
    const isState = r => /^US-/.test(r.location || '');
    // Each rect's hover shows its button name: Suppliers, Industry or Buyers
    const partName = part => ((toolbar.querySelector(`label[data-part-label="${part}"]`) || {}).textContent || part).trim();
    const swatches = (parts, k) => parts.map(part => `<span class="indicator-swatch" title="${partName(part)}">${swatch(indicatorRegionStyle(part, k))}</span>`).join('');
    const item = (parts, r, k) => `<span class="indicator-legend-item">${swatches(parts, k)}${legendName(r, parts[0])}</span>`;
    // Interstate items for a part, in bar order: Suppliers end with Rest of US first, Buyers start after the state
    const interstate = part => {
      const items = regions.map((r, k) => isState(r) ? '' : item([part], r, k)).filter(Boolean);
      return items.length ? `<span class="indicator-legend-group">${(part === 'supplier' ? items.reverse() : items).join('')}</span>` : '';
    };
    // The state appears once, with a rect for each checked part in bar order: Suppliers, Industry (purple), Buyers
    const stateIndex = regions.findIndex(isState);
    const stateParts = ['supplier', 'industry', 'buyers'].filter(part => indicatorParts[part]);
    let stateItem = '';
    if (indicatorParts.industry && !indicatorParts.supplier && !indicatorParts.buyers) {
      // Industry only: its own production, in the state (or the US for the national model)
      stateItem = `<span class="indicator-legend-item">${swatches(['industry'], 0)}Production in ${stateIndex >= 0 ? regionName(regions[stateIndex]) : 'the US'}</span>`;
    } else if (stateIndex >= 0 && stateParts.length) {
      stateItem = `<span class="indicator-legend-item">${swatches(stateParts, stateIndex)}${regionName(regions[stateIndex])}</span>`;
    }
    note.innerHTML = (indicatorParts.supplier ? interstate('supplier') : '') + stateItem + (indicatorParts.buyers ? interstate('buyers') : '');
  }
  if (toolbar.dataset.ready) return;
  toolbar.dataset.ready = '1';
  toolbar.addEventListener('change', e => {
    const input = e.target.closest('input[data-part]');
    if (!input) return;
    // Keep at least one part
    const next = Object.assign({}, indicatorParts, { [input.dataset.part]: input.checked });
    if (!next.supplier && !next.industry && !next.buyers) { input.checked = true; return; }
    indicatorParts = next;
    displayTable();
  });
  // Clicking the button (not its checkbox) shows only that part
  toolbar.addEventListener('click', e => {
    const label = e.target.closest('label[data-part-label]');
    if (!label || e.target.matches('input')) return;
    e.preventDefault(); // Stop the label from toggling its checkbox
    const input = label.querySelector('input[data-part]');
    if (!input || input.disabled) return;
    indicatorParts = { supplier: false, industry: false, buyers: false, [input.dataset.part]: true };
    displayTable();
  });
}

// Indicator and Impacts column widths, the narrowest they get before the bar moves into the Indicator column
const IMPACT_INDICATOR_WIDTH = 200;
const IMPACT_BAR_WIDTH = 200;
let impactTableNarrow = false;
// True when the table can't fit Indicator, Impacts and the value columns (120px each) and Unit (100px)
function isImpactTableNarrow() {
  const wrap = document.getElementById('indicatorBarChartWrap');
  const width = wrap ? wrap.clientWidth : 0;
  if (!width) return impactTableNarrow; // Hidden: keep the current layout
  const valueColumns = indicatorFlows.buyers ? 4 : 3; // Suppliers, Industry, Buyers, Total
  return width < IMPACT_INDICATOR_WIDTH + IMPACT_BAR_WIDTH + valueColumns * 120 + 100;
}
// Rebuild the table when its width crosses the narrow layout's threshold
function watchImpactTableWidth() {
  const wrap = document.getElementById('indicatorBarChartWrap');
  if (!wrap || wrap.dataset.widthWatch || typeof ResizeObserver === 'undefined') return;
  wrap.dataset.widthWatch = '1';
  new ResizeObserver(() => {
    if (mainTable && isImpactTableNarrow() !== impactTableNarrow) displayTable();
  }).observe(wrap);
}

function displayTable() {
  if (regionView) { displayRegionTable(); return; } // All of a place's industries
  const formatType = getCurrentNumberFormat() || "simple";
  // Value column in the selected number format
  // Rows hold per-dollar values divided by national totals. Value columns multiply by that national total
  // to show the indicator's own unit per $1, and with Total Spent chosen above the treemap, also by the
  // industry's total output to show the total for its whole output.
  const showTotals = matrixShowsTotals() && indicatorFlows.ownOutput > 0;
  const shownValue = (row, val) => {
    if (row.normTotal == null) return val;
    return (val || 0) * row.normTotal * (showTotals ? indicatorFlows.ownOutput : 1);
  };
  const valueColumn = (title, field) => ({
    title: title,
    field: field,
    titleFormatter: () => `<span title="${showTotals
      ? `Total for the industry's output of ${treemapDollars(indicatorFlows.ownOutput)}, in the indicator's unit`
      : 'Per $1 of the industry\'s output, in the indicator\'s unit'}">${title}</span>`,
    sorter: (a, b, aRow, bRow) => shownValue(aRow.getData(), a) - shownValue(bRow.getData(), b),
    formatter: function(cell) {
      const val = shownValue(cell.getRow().getData(), cell.getValue());
      if (formatType === "full") return formatCell(val, 'full');
      if (formatType === "scientific") {
        let scientificValue = Number(val).toExponential(3);
        let parts = scientificValue.split("e");
        if (parts[1]) return `${parts[0]}&times;10<sup>${parts[1].replace('+', '')}</sup>`;
        return scientificValue;
      }
      return formatCell(val, 'easy');
    },
    width: 120
  });
  
  // When the table is too narrow for all its columns, the Indicator column is hidden and each indicator's
  // name shows on the first line of the Impacts column, above its bar, so the table still sorts by impact.
  // The Impacts column is then frozen at the left while the value columns scroll.
  impactTableNarrow = isImpactTableNarrow();
  const columns = [
    ...(impactTableNarrow ? [] : [{ title: "Indicator", field: "indicator", widthGrow: 2, minWidth: IMPACT_INDICATOR_WIDTH }]),
    // Stacked bar of the checked parts (Supplier, Industry, Buyers) on one shared scale
    { title: "Impacts", field: "partsBar", minWidth: impactTableNarrow ? IMPACT_INDICATOR_WIDTH : IMPACT_BAR_WIDTH,
      ...(impactTableNarrow ? { widthGrow: 2, frozen: true } : {}), headerSortStartingDir: "desc",
      titleFormatter: () => '<span title="Per $1 of output as a share of each indicator\'s US total, so indicators with different units can be compared">Impacts</span>',
      sorter: (a, b, aRow, bRow) => indicatorPartsValue(aRow.getData()) - indicatorPartsValue(bRow.getData()),
      formatter: cell => {
        const data = cell.getRow().getData() || {};
        return impactTableNarrow
          ? `<div class="indicator-name-narrow">${data.indicator || ''}</div><div class="indicator-bar-narrow">${indicatorBar(data)}</div>`
          : indicatorBar(data);
      }
    },
    valueColumn("Suppliers", "supplierValue"),
    valueColumn("Industry", "directValue"),
    ...(indicatorFlows.buyers ? [valueColumn("Buyers", "buyersValue")] : []),
    // Header hover text via a title attribute: Tabulator 5.2.7's headerTooltip option throws on hover
    Object.assign(valueColumn("Total", "totalValue"), { titleFormatter: () => `<span title="Suppliers + Industry: the model's total footprint${showTotals ? `, for the industry's output of ${treemapDollars(indicatorFlows.ownOutput)}` : ' per $1 of output'}">Total</span>` }),
    { title: "Unit", field: "unit", width: 100 }
  ];

  mainTable = new Tabulator("#indicatorBarChart", {
    data: tableData,
    layout: "fitColumns",
    // Energy has no state indicators: offer the national model instead
    placeholder: (currentImpactSet() === 'energy' && getHash().state)
      ? 'No state indicators for energy impacts in this model. <a href="#" onclick="showNationalModel(\'energy\'); return false;">View for US</a>'
      : "No indicators in this impact set for this model.",
    columns: columns,
    initialSort: [
      { column: "partsBar", dir: "desc" },
    ],
    // Outline the row whose indicator sizes the treemap's Impact view
    rowFormatter: row => {
      row.getElement().classList.toggle('impact-selected', matrixRank === 'impact' && !!matrixImpact && row.getData().code === matrixImpact.code);
    }
  });
  // Clicking a row sizes the treemap below by that indicator
  mainTable.on("rowClick", (e, row) => selectMatrixImpact(row.getData()));
  // Rows move when the table renders, sorts or resizes
  mainTable.on("renderComplete", positionImpactPointer);
  setupIndicatorParts();
  watchImpactTableWidth();

  
}



// Initialize dropdowns and add event listeners
function initializeDropdownsAndEvents() {
  console.log('Initializing dropdowns and events');
  
  // Check if dropdown elements exist
  const localeSelect = document.getElementById('locale-select');
  const numberFormatSelect = document.getElementById('number-format-select');
  console.log('Locale select found:', !!localeSelect);
  console.log('Number format select found:', !!numberFormatSelect);
  
  // Model year dropdown, from the hash (js/config.js)
  setupModelYearSelect('year-select');

  // Initialize the dropdowns
  if (typeof initializeDropdowns === 'function') {
    initializeDropdowns();
    console.log('Dropdowns initialized');
  } else {
    console.error('initializeDropdowns function not available from config.js');
  }
  
  // Add event listeners to update tables when dropdowns change
  if (localeSelect) {
    localeSelect.addEventListener("change", function() {
      updateTables();
    });
  }
  
  if (numberFormatSelect) {
    numberFormatSelect.addEventListener("change", function() {
      updateTables();
    });
  }

  // Impact set dropdown (All Factors, Adverse Factors, Air Factors ... Positive Factors for Prosperity) from localsite/js/impact-sets.js
  if (typeof addImpactSetSelect === 'function') {
    impactSetControl = addImpactSetSelect('#impact-set-select', {
      // "Air Factors", "Health Factors", ... and "Positive Factors" for Prosperity
      allLabel: 'All Factors',
      titles: Object.assign(Object.fromEntries([impactSetAdverse].concat(impactSets).map(set => [set.id, set.title + ' Factors'])), { prosperity: 'Positive Factors' }),
      onChange: setId => {
        fitImpactSetTitle();
        if (setId === 'energy' && getHash().state) {
          showNationalModel(setId);
          return;
        }
        filterTableData();
        updateTables();
      }
    });
    fitImpactSetTitle();
    if (impactSetControl && fullTableData.length) {
      impactSetControl.setAvailable(fullTableData.map(d => d.code), ['energy']);
      filterTableData();
      updateTables();
    }
  }
}

// Impact set dropdown control, from addImpactSetSelect in localsite/js/impact-sets.js
let impactSetControl = null;

// The impact set dropdown is styled as a title with an arrow after it (#impact-set-select in template-footprint.html).
// field-sizing fits it to the chosen set; other browsers get its width from the chosen option's text.
function fitImpactSetTitle() {
  const select = document.getElementById('impact-set-select');
  if (!select || (window.CSS && CSS.supports('field-sizing', 'content'))) return;
  const option = select.options[select.selectedIndex];
  if (!option) return;
  const style = getComputedStyle(select);
  const context = (fitImpactSetTitle.canvas || (fitImpactSetTitle.canvas = document.createElement('canvas'))).getContext('2d');
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  select.style.width = Math.ceil(context.measureText(option.textContent).width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2) + 'px';
}

// The chosen impact set: the dropdown once it is set up, otherwise the hash
function currentImpactSet() {
  if (impactSetControl) return impactSetControl.value();
  return (typeof getHash === 'function' && getHash().set) || '';
}

// Filter fullTableData into tableData according to the impact set (All Impacts, Adverse, Air, ...)
function filterTableData() {
  const setId = currentImpactSet();
  tableData = (fullTableData || []).filter(d => typeof impactSetIncludes !== 'function' || impactSetIncludes(setId, d.code));
}

// Function to update all tables when format changes
function updateTables() {
  // Recreate the main table with new format (like commodities.html), even when a filter leaves no rows
  if (fullTableData && fullTableData.length > 0 && (getHash().demand || regionView)) {
    displayTable();
  }
  // For matrix table, just redraw since it uses dynamic formatters
  if (matrixTable) {
    matrixTable.redraw();
  }
  if (commoditiesReport) commoditiesReport.render();
  if (commoditiesReportUN && showsUnCommodities()) commoditiesReportUN.render();
}

// Initialize everything once the page has loaded. footprint-layout.js may load this script after the load event.
function initializeAfterLoad() {
  // Give a small delay to ensure all scripts are loaded
  setTimeout(function() {
    initializeDropdownsAndEvents();
  }, 100);
}
if (document.readyState === 'complete') initializeAfterLoad();
else window.addEventListener('load', initializeAfterLoad);

main();
