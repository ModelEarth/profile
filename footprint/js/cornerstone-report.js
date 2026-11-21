// Cornerstone GHG emission factors: an annual report for the World, a world region, a country, the US or a state.
// Fills #cornerstoneSection in template-footprint.html from the eeio-data repo's CSV files (eeio-data/csv/):
//   {YEAR}PRO.csv and {YEAR}PUR.csv  Code, Location, TotalGHGs, CO2, CH4, N2O, HFCs, PFCs, SF6, NF3 in kg CO2e per USD
//   US/margins/{YEAR}PUR.csv         Code, Location (USA), TotalMargin, Wholesale, Retail, Transportation
//   Locations.csv, SectorDescriptions.csv and NAICStoCornerstone.csv
// Source: Cornerstone EEIO 2026-rc (https://github.com/cornerstone-data/eeio-docs), years 2024 to 2026.
//
// The place follows the hash, like the rest of the page (footprintRegion in js/footprint.js):
//   No country, state or demand, or country=all   The World (GLOB), with a list of the world regions
//   worldregion=CARB (with country=all)            A world region, with a list of its countries
//   country=IN                                     A country, beside its region and the World
//   country=US, state=GA, or a demand alone        The US factors, with the US margins (wholesale, retail, transport)
// The year is year= when it is 2024, 2025 or 2026, otherwise 2026, set with the page's year dropdown (#year-select, js/config.js).
//
// Inflation (removed by default, adjust=published in the hash for "As published"): 2026-rc measured emissions for 2024 only. Its 2025
// and 2026 factors are the 2024 factors divided by a US price index for each sector, so they fall wherever prices rose.
// With inflation removed, factors are put back in 2024 dollars with the price change read from the data (the median,
// across the locations, of each sector's 2024 factor over its factor in the year), and a change from one year to the
// next is the estimated change in emissions: (1 + real GDP growth) x (change in the 2024-dollar factor) - 1, with the
// growth from eeio-data/gdp/real-gdp-growth.csv (see eeio-data/gdp/README.md). The map (js/footprint-map.js) shares the toggle.
(function () {
  // The eeio-data .csv and .json files load directly from GitHub. When Settings sets Online to false (the onlinemode
  // cookie that localsite/js/localsite.js reads into #onlinemode), they load from the local eeio-data beside profile/ in the webroot.
  const scriptSrc = document.currentScript ? document.currentScript.src : window.location.href;
  const CS_RAW_GITHUB = 'https://raw.githubusercontent.com/ModelEarth/eeio-data/main/';
  function csOffline() {
    let mode;
    if (typeof Cookies !== 'undefined') {
      mode = Cookies.get('onlinemode');
    } else {
      const match = document.cookie.match(/(?:^|;\s*)onlinemode=([^;]*)/);
      mode = match ? decodeURIComponent(match[1]) : undefined;
    }
    return mode === 'false';
  }
  // A path within the eeio-data repo, e.g. 'csv/2026PRO.csv', as a URL to fetch
  function eeioDataUrl(path) {
    return csOffline() ? new URL('../../../eeio-data/' + path, scriptSrc).href : CS_RAW_GITHUB + path;
  }
  // A line in the Console Log (#logText in #log_display, localsite/info/template-main.html), which shows when Online is false
  function csLog(text) {
    console.log(text);
    const append = elm => elm.appendChild(document.createTextNode(text + '\n'));
    const logText = document.getElementById('logText');
    if (logText) append(logText);
    else if (typeof waitForElm === 'function') waitForElm('#logText').then(append);
  }
  // Fetch a path within the eeio-data repo. When offline, log each file loaded locally, or that the local eeio-data is missing.
  let csMissingLogged = false;
  async function eeioDataFetch(path) {
    const url = eeioDataUrl(path);
    if (!csOffline()) return fetch(url);
    const missing = reason => {
      if (csMissingLogged) return;
      csMissingLogged = true;
      csLog(`eeio-data is not available locally (${path} ${reason}). Clone ModelEarth/eeio-data into the webroot, or set Online in Settings.`);
    };
    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      missing(error.message);
      throw error;
    }
    if (response.ok) csLog(`eeio-data/${path} loaded locally`);
    else missing(response.status);
    return response;
  }
  const CS_GITHUB = 'https://github.com/ModelEarth/eeio-data/blob/main/csv/';
  const CS_YEARS = ['2024', '2025', '2026'];
  const CS_GASES = ['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6', 'NF3'];
  const CS_PRICE_NAMES = { PRO: 'Producer price', PUR: 'Purchaser price' };
  const CS_WORLD = 'GLOB';
  const CS_BASE_YEAR = '2024'; // The year of the emissions data. 2025 and 2026 are inflation adjusted from it.
  const CS_GROWTH = 'gdp/real-gdp-growth.csv';
  // Each sector's price change since 2024, from eeio-data/gdp/price-index.py, so removing inflation doesn't need the 2024 factors
  const CS_PRICE_INDEX = 'gdp/price-index.csv';
  // Each location's average factor over all sectors, by year, price and basis (eeio-data/averages/location-averages.py),
  // for the map's "All sectors (average)" and the report's change line without each year's 5 MB of factors
  const CS_AVERAGES = 'averages/location-averages.csv';
  const CS_GROWTH_GITHUB = 'https://github.com/ModelEarth/eeio-data/tree/main/gdp';

  // Cornerstone's 3-letter country codes (Locations.csv) with the 2-letter codes the hash uses, e.g. IND IN
  const CS_COUNTRY_CODES = ('ABWAW AFGAF AGOAO AIAAI ALAAX ALBAL ANDAD AREAE ARGAR ARMAM ASMAS ATFTF ATGAG AUSAU AUTAT AZEAZ BDIBI '
    + 'BELBE BENBJ BESBQ BFABF BGDBD BGRBG BHRBH BHSBS BIHBA BLMBL BLRBY BLZBZ BMUBM BOLBO BRABR BRBBB BRNBN BTNBT BVTBV BWABW '
    + 'CAFCF CANCA CCKCC CHECH CHLCL CHNCN CIVCI CMRCM CODCD COGCG COKCK COLCO COMKM CPVCV CRICR CUBCU CUWCW CXRCX CYMKY CYPCY '
    + 'CZECZ DEUDE DJIDJ DMADM DNKDK DOMDO DZADZ ECUEC EGYEG ERIER ESHEH ESPES ESTEE ETHET FINFI FJIFJ FLKFK FRAFR FROFO FSMFM '
    + 'GABGA GBRGB GEOGE GGYGG GHAGH GIBGI GINGN GLPGP GMBGM GNBGW GNQGQ GRCGR GRDGD GRLGL GTMGT GUFGF GUMGU GUYGY HKGHK HMDHM '
    + 'HNDHN HRVHR HTIHT HUNHU IDNID IMNIM INDIN IOTIO IRLIE IRNIR IRQIQ ISLIS ISRIL ITAIT JAMJM JEYJE JORJO JPNJP KAZKZ KENKE '
    + 'KGZKG KHMKH KIRKI KNAKN KORKR KWTKW LAOLA LBNLB LBRLR LBYLY LCALC LIELI LKALK LSOLS LTULT LUXLU LVALV MACMO MAFMF MARMA '
    + 'MCOMC MDAMD MDGMG MDVMV MEXMX MHLMH MKDMK MLIML MLTMT MMRMM MNEME MNGMN MNPMP MOZMZ MRTMR MSRMS MTQMQ MUSMU MWIMW MYSMY '
    + 'MYTYT NAMNA NCLNC NERNE NFKNF NGANG NICNI NIUNU NLDNL NORNO NPLNP NRUNR NZLNZ OMNOM PAKPK PANPA PCNPN PERPE PHLPH PLWPW '
    + 'PNGPG POLPL PRIPR PRKKP PRTPT PRYPY PSEPS PYFPF QATQA REURE ROURO RUSRU RWARW SAUSA SDNSD SENSN SGPSG SGSGS SHNSH SJMSJ '
    + 'SLBSB SLESL SLVSV SMRSM SOMSO SPMPM SRBRS SSDSS STPST SURSR SVKSK SVNSI SWESE SWZSZ SXMSX SYCSC SYRSY TCATC TCDTD TGOTG '
    + 'THATH TJKTJ TKLTK TKMTM TLSTL TONTO TTOTT TUNTN TURTR TUVTV TWNTW TZATZ UGAUG UKRUA UMIUM URYUY USAUS UZBUZ VATVA VCTVC '
    + 'VENVE VGBVG VIRVI VNMVN VUTVU WLFWF WSMWS XXKXK YEMYE ZAFZA ZMBZM ZWEZW').split(' ');
  const alpha2Of = new Map(CS_COUNTRY_CODES.map(c => [c.slice(0, 3), c.slice(3)]));
  const alpha3Of = new Map(CS_COUNTRY_CODES.map(c => [c.slice(3), c.slice(0, 3)]));

  // ---- Loading ----
  const textCache = {};
  function loadText(path) {
    if (!textCache[path]) {
      textCache[path] = eeioDataFetch('csv/' + path).then(response => {
        if (!response.ok) throw new Error(`eeio-data/csv/${path} ${response.status}`);
        return response.text();
      }).catch(error => { delete textCache[path]; throw error; });
    }
    return textCache[path];
  }
  // Rows of cells, with quoted cells ("Bolivia, Plurinational State of") kept whole
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.length > 1 || r[0]);
  }
  // Objects keyed by the header row
  async function loadTable(path) {
    const rows = parseCsv(await loadText(path));
    const header = rows.shift() || [];
    return rows.map(cells => Object.fromEntries(header.map((name, i) => [name, cells[i]])));
  }

  const memo = {};
  function once(key, fn) {
    if (!memo[key]) memo[key] = fn().catch(error => { delete memo[key]; throw error; });
    return memo[key];
  }
  // location -> Map(code -> {total, gases: {CO2, ...}}), in the year's dollars, or in 2024 dollars when real
  function loadFactors(year, price, real) {
    if (real && year !== CS_BASE_YEAR) return loadRealFactors(year, price);
    return once(`factors:${year}${price}`, async () => {
      const byLocation = new Map();
      (await loadTable(`${year}${price}.csv`)).forEach(r => {
        if (!byLocation.has(r.Location)) byLocation.set(r.Location, new Map());
        const gases = {};
        CS_GASES.forEach(g => { gases[g] = Number(r[g]); });
        byLocation.get(r.Location).set(r.Code, { total: Number(r.TotalGHGs), gases });
      });
      return byLocation;
    });
  }
  // code -> {total, wholesale, retail, transport}, for US purchases. Real puts them in 2024 dollars with the purchaser
  // price index, which the margins follow (their year-to-year ratios match the PUR factors' within rounding).
  function loadMargins(year, real) {
    if (real && year !== CS_BASE_YEAR) {
      return once(`margins:${year}real`, async () => {
        const [margins, index] = await Promise.all([loadMargins(year), loadPriceIndex(year, 'PUR')]);
        return new Map([...margins.entries()].map(([code, m]) => {
          const k = index.get(code) || 1;
          return [code, { total: m.total * k, wholesale: m.wholesale * k, retail: m.retail * k, transport: m.transport * k }];
        }));
      });
    }
    return once(`margins:${year}`, async () => new Map((await loadTable(`US/margins/${year}PUR.csv`)).map(r => [r.Code, {
      total: Number(r.TotalMargin), wholesale: Number(r.Wholesale), retail: Number(r.Retail), transport: Number(r.Transportation)
    }])));
  }

  // code -> the year's prices over 2024's for the sector (1.03 when prices rose 3%), read from the data: the median,
  // across all locations, of the sector's 2024 factor over its factor in the year. Cornerstone applies one US price
  // index per sector to every location, so the ratios agree within rounding. eeio-data/gdp/price-index.csv holds them
  // (31 KB); without it they're worked out here from the 2024 factors, another 5 MB download.
  function loadPriceIndex(year, price) {
    return once(`index:${year}${price}`, async () => {
      try {
        const table = await loadPriceIndexFile();
        const column = price + year;
        if (table.length && column in table[0]) {
          return new Map(table.filter(r => r[column] !== '').map(r => [r.Code, Number(r[column])]));
        }
      } catch (error) {
        console.warn('cornerstone-report: price-index.csv', error);
      }
      const [base, later] = await Promise.all([loadFactors(CS_BASE_YEAR, price), loadFactors(year, price)]);
      const ratios = new Map();
      later.forEach((rows, loc) => {
        const baseRows = base.get(loc);
        if (!baseRows) return;
        rows.forEach((f, code) => {
          const b = baseRows.get(code);
          if (!b || !(f.total > 0) || !(b.total > 0)) return;
          if (!ratios.has(code)) ratios.set(code, []);
          ratios.get(code).push(b.total / f.total);
        });
      });
      return new Map([...ratios.entries()].map(([code, list]) => [code, median(list)]));
    });
  }
  function loadPriceIndexFile() {
    return once('priceIndexFile', async () => {
      const response = await eeioDataFetch(CS_PRICE_INDEX);
      if (!response.ok) throw new Error(`price-index.csv ${response.status}`);
      const rows = parseCsv(await response.text());
      const header = rows.shift() || [];
      return rows.map(cells => Object.fromEntries(header.map((name, i) => [name, cells[i]])));
    });
  }
  // The year's factors in 2024 dollars: each one times its sector's price index
  function loadRealFactors(year, price) {
    return once(`factors:${year}${price}real`, async () => {
      const [factors, index] = await Promise.all([loadFactors(year, price), loadPriceIndex(year, price)]);
      const byLocation = new Map();
      factors.forEach((rows, loc) => {
        const out = new Map();
        rows.forEach((f, code) => {
          const k = index.get(code) || 1;
          const gases = {};
          CS_GASES.forEach(g => { gases[g] = f.gases[g] * k; });
          out.set(code, { total: f.total * k, gases });
        });
        byLocation.set(loc, out);
      });
      return byLocation;
    });
  }
  // location -> Map('ALL' -> {total, gases}): each location's unweighted mean factor over all its sectors, shaped like
  // loadFactors() with one row, in the year's dollars or in 2024 dollars when real. From location-averages.csv, or
  // worked out from the year's factors when it can't load.
  const CS_ALL = 'ALL';
  function loadAverages(year, price, real) {
    const basis = real && year !== CS_BASE_YEAR ? 'real' : 'published';
    return once(`averages:${year}${price}${basis}`, async () => {
      try {
        const rows = (await loadAveragesFile()).filter(r => r.Year === year && r.Price === price && r.Basis === basis);
        if (rows.length) {
          return new Map(rows.map(r => {
            const gases = {};
            CS_GASES.forEach(g => { gases[g] = Number(r[g]); });
            return [r.Location, new Map([[CS_ALL, { total: Number(r.TotalGHGs), gases }]])];
          }));
        }
      } catch (error) {
        console.warn('cornerstone-report: location-averages.csv', error);
      }
      const factors = await loadFactors(year, price, real);
      return new Map([...factors.entries()].map(([loc, rows]) => {
        const list = [...rows.values()];
        const gases = {};
        CS_GASES.forEach(g => { gases[g] = mean(list.map(f => f.gases[g])); });
        return [loc, new Map([[CS_ALL, { total: mean(list.map(f => f.total)), gases }]])];
      }));
    });
  }
  function loadAveragesFile() {
    return once('averagesFile', async () => {
      const response = await eeioDataFetch(CS_AVERAGES);
      if (!response.ok) throw new Error(`location-averages.csv ${response.status}`);
      const rows = parseCsv(await response.text());
      const header = rows.shift() || [];
      return rows.map(cells => Object.fromEntries(header.map((name, i) => [name, cells[i]])));
    });
  }
  // location -> {name, source2025, 2025: 0.0216 (2.16%), ...}, the change in production with inflation removed
  function loadGrowth() {
    return once('growth', async () => {
      const response = await eeioDataFetch(CS_GROWTH);
      if (!response.ok) throw new Error(`real-gdp-growth.csv ${response.status}`);
      const rows = parseCsv(await response.text());
      const header = rows.shift() || [];
      const growth = new Map();
      rows.forEach(cells => {
        const r = Object.fromEntries(header.map((name, i) => [name, cells[i]]));
        const entry = { name: r.Name };
        CS_YEARS.forEach(y => {
          if (r['Growth' + y] !== undefined && r['Growth' + y] !== '') { entry[y] = Number(r['Growth' + y]) / 100; entry['source' + y] = r['Source' + y]; }
        });
        growth.set(r.Location, entry);
      });
      return growth;
    });
  }
  // The estimated change in emissions from the year before: production growth times the change in the 2024-dollar factor
  function emissionsChange(prevReal, curReal, growth) {
    if (!(prevReal > 0) || curReal == null || growth == null || !isFinite(growth)) return null;
    return (1 + growth) * (curReal / prevReal) - 1;
  }
  // {sectors: Map(code -> {name, description, search}), countries: Map, regions: Map}
  function loadReference() {
    return once('reference', async () => {
      const [descriptions, locations, naics] = await Promise.all([
        loadTable('SectorDescriptions.csv'), loadTable('Locations.csv'), loadTable('NAICStoCornerstone.csv')
      ]);
      const sectors = new Map(descriptions.map(r => [r.Code, { name: r.Name, description: r.Description || '', naics: [] }]));
      // NAICS 2017 codes and names, so the filter finds a sector by either
      naics.forEach(r => {
        const sector = sectors.get(r.CornerstoneCode);
        if (sector) sector.naics.push(`${r.NAICS2017Code} ${r.NAICSName}`);
      });
      sectors.forEach((sector, code) => {
        sector.search = `${code} ${sector.name} ${sector.naics.join(' ')}`.toLowerCase();
      });
      const countries = new Map();
      const regions = new Map();
      locations.forEach(r => {
        countries.set(r.Location, { code: r.Location, name: r.LocationName, region: r.Region, hasFactors: r.HasCountryEFs === 'Yes' });
        if (!regions.has(r.Region)) regions.set(r.Region, { code: r.Region, name: r.RegionName, countries: [] });
        regions.get(r.Region).countries.push(r.Location);
      });
      return { sectors, countries, regions };
    });
  }

  // ---- The place and year, from the hash ----
  function csYear() {
    const year = String(getHash().year || '').trim();
    return CS_YEARS.includes(year) ? year : CS_YEARS[CS_YEARS.length - 1];
  }
  // True unless adjust=published: factors in 2024 dollars, and changes following real production.
  // Older links with adjust=real get the same default.
  const csAdjusted = () => String(getHash().adjust || '') !== 'published';
  const csPrevYear = year => { const y = String(Number(year) - 1); return CS_YEARS.includes(y) ? y : null; };

  // The inflation toggle with an info icon at its right, revealing a short statement and the logic, in the map's panel.
  // toggleClass styles the buttons like the container's other toggles.
  const CS_ADJUST_INFO = `<p><b>Why the published factors fall each year.</b> Cornerstone 2026-rc measured emissions for 2024. `
    + `Its 2025 and 2026 factors are the 2024 factors divided by a US price index for each sector, in kg CO2e per dollar of that year. `
    + `Wherever prices rose, a dollar buys less, so the factor falls though no emissions data changed. `
    + `Each sector changes by the same percent in every country.</p>`
    + `<p><b>Inflation removed:</b></p><ol>`
    + `<li>Each sector's price change is read from the data: the median, across the 170 locations, of its 2024 factor divided by its factor in the year.</li>`
    + `<li>The year's factors times that ratio are in 2024 dollars (kg CO2e per 2024 US dollar), comparable across years. `
    + `The US margins use the purchaser price ratio.</li>`
    + `<li>The change from one year to the next is the estimated change in emissions: `
    + `(1 + real GDP growth) &times; (change in the 2024-dollar factor) &minus; 1. Real GDP growth stands in for the change in production. `
    + `For a single sector it is still the whole economy's growth.</li></ol>`
    + `<p>Growth: World Bank WDI actual for 2025, World Bank Global Economic Prospects (June 2026) forecast for 2026, `
    + `the OECD Economic Outlook 119 where those lack a country, otherwise the region's average. `
    + `Regions and the World are weighted by 2024 GDP in US dollars. `
    + `<a href="${CS_GROWTH_GITHUB}" target="_blank" rel="noopener">eeio-data/gdp</a></p>`
    + `<p>Cornerstone's 2017 to 2026 time series (December 2026) will use each year's own emissions data, so the 2024-dollar factors will then change too.</p>`;
  const CS_INFO_ICON = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/>'
    + '<rect x="7.3" y="7" width="1.4" height="4.6" rx="0.7" fill="currentColor"/><circle cx="8" cy="4.8" r="0.9" fill="currentColor"/></svg>';
  function adjustControl(el, toggleClass) {
    if (!el) return;
    if (!el.dataset.ready) {
      el.dataset.ready = '1';
      el.classList.add('cs-adjust');
      el.innerHTML = `<div class="${toggleClass}" role="group" aria-label="Inflation">`
        + `<button type="button" data-adjust="real">Inflation removed</button><button type="button" data-adjust="published">As published</button></div>`
        + `<button type="button" class="cs-info-button" aria-expanded="false" title="How inflation is removed">${CS_INFO_ICON}</button>`
        + `<div class="cs-info-body" hidden><p class="cs-adjust-text"></p>${CS_ADJUST_INFO}</div>`;
      el.addEventListener('click', event => {
        const info = event.target.closest('.cs-info-button');
        if (info) {
          const body = el.querySelector('.cs-info-body');
          body.hidden = !body.hidden;
          info.setAttribute('aria-expanded', String(!body.hidden));
          return;
        }
        const button = event.target.closest('button[data-adjust]');
        if (!button || (button.dataset.adjust === 'real') === csAdjusted()) return;
        if (button.dataset.adjust === 'published') goHash({ adjust: 'published' });
        else goHash({}, ['adjust']);
      });
    }
    const adjusted = csAdjusted();
    el.querySelectorAll('button[data-adjust]').forEach(b => b.classList.toggle('active', (b.dataset.adjust === 'real') === adjusted));
    el.querySelector('.cs-adjust-text').textContent = adjusted
      ? 'Inflation removed: factors in 2024 dollars, and changes follow real production growth.'
      : 'As published: each year\'s dollars, so price rises lower the 2025 and 2026 factors.';
  }

  // {kind: 'world' | 'region' | 'country' | 'us', code (Cornerstone location), state}
  function csPlace() {
    const hash = getHash();
    const country = String(hash.country || '').split(',')[0].trim().toUpperCase();
    const state = String(hash.state || '').split(',')[0].trim().toUpperCase();
    const region = String(hash.worldregion || '').trim().toUpperCase();
    if (country && !['ALL', 'WORLD', 'US'].includes(country)) {
      return alpha3Of.has(country) ? { kind: 'country', code: alpha3Of.get(country) } : { kind: 'world', code: CS_WORLD, unknown: country };
    }
    if (/^[A-Z]{2}$/.test(state) && country !== 'ALL' && country !== 'WORLD') return { kind: 'us', code: 'USA', state };
    if (country === 'US') return { kind: 'us', code: 'USA' };
    if (region) return { kind: 'region', code: region }; // With country=all or no country
    if (!country && (hash.demand || hash.index || hash.industry)) return { kind: 'us', code: 'USA' }; // As footprintRegion
    return { kind: 'world', code: CS_WORLD };
  }
  // The hash for a place in the report's dropdown. A state is cleared, as is the region for a country.
  function goPlace(code, reference) {
    if (typeof hiddenhash === 'object') hiddenhash.state = ''; // So localsite doesn't bring the prior state back
    if (code === CS_WORLD) goHash({ country: 'all' }, ['state', 'worldregion']);
    else if (reference.regions.has(code)) goHash({ country: 'all', worldregion: code }, ['state']);
    else goHash({ country: alpha2Of.get(code) || code }, ['state', 'worldregion']);
  }

  // ---- Formatting ----
  function csNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '';
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 100) return value.toFixed(0);
    if (abs >= 0.01) return String(Number(value.toPrecision(3)));
    return String(Number(value.toPrecision(2))); // 0.000078
  }
  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function median(values) {
    const sorted = values.filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (!sorted.length) return NaN;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  const mean = values => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

  // ---- Report state ----
  // PRO or PUR, chosen with the toggle and kept in the browser for the next visit. Defaults to PUR for the US, so its margins show.
  const CS_PRICE_KEY = 'footprint_price_preference';
  let price = null;
  try {
    const saved = localStorage.getItem(CS_PRICE_KEY);
    if (CS_PRICE_NAMES[saved]) price = saved;
  } catch (e) { /* Storage blocked: use the default */ }
  let filterText = '';
  let table = null;
  let tableMax = 1;
  let run = 0;

  function placeName(place, reference) {
    if (place.kind === 'world') return 'World';
    if (place.kind === 'region') return (reference.regions.get(place.code) || {}).name || place.code;
    if (place.kind === 'us' && place.state) return (typeof getState === 'function' && getState(place.state)) || place.state;
    if (place.kind === 'us') return 'United States';
    return (reference.countries.get(place.code) || {}).name || place.code;
  }

  function placeOptions(place, reference) {
    const selected = place.kind === 'us' ? 'USA' : place.code;
    const option = (code, label) => `<option value="${code}"${code === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const regions = [...reference.regions.values()].sort((a, b) => a.name.localeCompare(b.name));
    const countries = [...reference.countries.values()].sort((a, b) => a.name.localeCompare(b.name));
    return option(CS_WORLD, 'World')
      + `<optgroup label="World regions">${regions.map(r => option(r.code, r.name)).join('')}</optgroup>`
      + `<optgroup label="Countries">${countries.map(c => option(c.code, c.name + (c.hasFactors ? '' : ' (regional factors)'))).join('')}</optgroup>`;
  }

  // The places summarized above the table: the regions for the World, the countries with their own factors for a region
  function placeSummaries(place, reference, factors) {
    let codes = [];
    if (place.kind === 'world') codes = [...reference.regions.keys()];
    else if (place.kind === 'region') codes = ((reference.regions.get(place.code) || {}).countries || []).filter(c => factors.has(c));
    return codes.map(code => {
      const rows = [...(factors.get(code) || new Map()).entries()];
      if (!rows.length) return null;
      const top = rows.reduce((a, b) => (b[1].total > a[1].total ? b : a));
      const name = reference.regions.has(code) ? reference.regions.get(code).name : (reference.countries.get(code) || {}).name;
      return { code, name: name || code, average: mean(rows.map(r => r[1].total)), median: median(rows.map(r => r[1].total)),
        top: (reference.sectors.get(top[0]) || {}).name || top[0], topValue: top[1].total };
    }).filter(Boolean).sort((a, b) => b.average - a.average);
  }

  function placesHtml(place, summaries) {
    if (!summaries.length) return '';
    const label = place.kind === 'world' ? 'World regions' : 'Countries with their own factors';
    const max = Math.max(...summaries.map(s => s.average)) || 1;
    const rows = summaries.map(s => `<tr data-place="${s.code}" title="Show ${escapeHtml(s.name)}">
      <td>${escapeHtml(s.name)}</td>
      <td class="cs-num"><span class="cs-bar" style="width:${Math.round(60 * s.average / max)}px"></span>${csNumber(s.average)}</td>
      <td class="cs-num">${csNumber(s.median)}</td>
      <td>${escapeHtml(s.top)} <span class="cs-muted">${csNumber(s.topValue)}</span></td></tr>`).join('');
    return `<table class="cs-places"><thead><tr><th>${label}</th><th title="Unweighted mean of the sector factors">Average</th>
      <th>Median</th><th>Highest sector</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function totalFormatter(cell) {
    const value = cell.getValue();
    const width = Math.max(0, Math.round(70 * value / tableMax));
    return `<span class="cs-bar" style="width:${width}px"></span>${csNumber(value)}`;
  }

  function tableColumns(place, showMargins, compare) {
    const num = (title, field, tip) => ({ title, field, hozAlign: 'right', headerHozAlign: 'right', sorter: 'number', headerTooltip: tip || title,
      formatter: cell => csNumber(cell.getValue()) });
    const columns = [
      { title: 'Code', field: 'code', width: 84, headerTooltip: 'Cornerstone sector code, based on BEA Detail commodity codes' },
      { title: 'Sector', field: 'name', width: 320, // Longer names end in an ellipsis. Tabulator 5.2 passes (event, cell), earlier versions (cell)
        tooltip: (e, cell) => ((cell && cell.getRow) ? cell : e).getRow().getData().description,
        formatter: cell => escapeHtml(cell.getValue()) },
      { title: 'Greenhouse Gases (all)', field: 'total', hozAlign: 'left', sorter: 'number', minWidth: 130, formatter: totalFormatter,
        headerTooltip: 'kg CO2e per USD, cradle to gate' }
    ];
    if (showMargins) {
      columns.push(num('With margins', 'shelf', 'Cradle to shelf: Greenhouse Gases (all) in purchaser price plus the US margins'));
      columns.push(num('US margins', 'margin', 'Wholesale, retail and transport that deliver a US purchase (gate to shelf)'));
      columns.push(num('Wholesale', 'wholesale'), num('Retail', 'retail'), num('Transport', 'transport'));
    }
    compare.forEach(c => columns.push(num(c.label, c.field, `Greenhouse Gases (all) in ${c.label}`)));
    CS_GASES.forEach(g => columns.push(num(g, g, `${g} in kg CO2e per USD`)));
    return columns;
  }

  function filterRows() {
    if (!table) return;
    const words = filterText.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) table.clearFilter();
    else table.setFilter(data => words.every(w => data.search.includes(w)));
  }

  async function render() {
    const section = document.getElementById('cornerstoneSection');
    if (!section) return;
    const thisRun = ++run;
    const place = csPlace();
    const year = csYear();
    const isUs = place.kind === 'us';
    const shownPrice = price || (isUs ? 'PUR' : 'PRO');
    const adjusted = csAdjusted();
    const prev = csPrevYear(year);
    // Inflation is removed unless adjust=published, set with the toggle in the map's panel (js/footprint-map.js)
    const status = document.getElementById('cornerstoneStatus');
    status.textContent = `Loading the ${year} Cornerstone emission factors...`;
    status.style.display = '';

    // The change line compares the averages over all sectors (location-averages.csv), so the year before's
    // full factors aren't downloaded
    let reference, factors, margins = null, prevAverages = null, curAverages = null, growth = null;
    try {
      [reference, factors, margins, prevAverages, curAverages, growth] = await Promise.all([
        loadReference(), loadFactors(year, shownPrice, adjusted), isUs && shownPrice === 'PUR' ? loadMargins(year, adjusted) : null,
        prev ? loadAverages(prev, shownPrice, adjusted) : null, prev ? loadAverages(year, shownPrice, adjusted) : null,
        prev && adjusted ? loadGrowth() : null
      ]);
    } catch (error) {
      console.warn('cornerstone-report', error);
      if (thisRun === run) status.textContent = `The Cornerstone emission factors could not load: ${error.message}`;
      return;
    }
    if (thisRun !== run) return;
    status.style.display = 'none';

    // A region code not in Locations.csv shows the World
    if (place.kind === 'region' && !reference.regions.has(place.code)) { place.kind = 'world'; place.unknown = place.code; place.code = CS_WORLD; }
    const name = placeName(place, reference);
    const country = reference.countries.get(place.code);
    // A country without its own factors uses its region's
    const dataCode = country && !country.hasFactors ? country.region : place.code;
    const own = factors.get(dataCode) || new Map();
    const compare = [];
    if (country) {
      const region = reference.regions.get(country.region);
      if (country.hasFactors && region) compare.push({ label: region.name, field: 'cmpRegion', data: factors.get(region.code) });
      compare.push({ label: 'World', field: 'cmpWorld', data: factors.get(CS_WORLD) });
    } else if (place.kind === 'region') {
      compare.push({ label: 'World', field: 'cmpWorld', data: factors.get(CS_WORLD) });
    }

    const demandCode = String(getHash().demand || '').split('/')[0];
    const rows = [...own.entries()].map(([code, f]) => {
      const sector = reference.sectors.get(code) || { name: code, description: '', search: code.toLowerCase() };
      const row = { code, name: sector.name, description: sector.description, search: sector.search, total: f.total, ...f.gases };
      if (margins) {
        const m = margins.get(code);
        if (m) Object.assign(row, { margin: m.total, wholesale: m.wholesale, retail: m.retail, transport: m.transport, shelf: f.total + m.total });
      }
      compare.forEach(c => { const other = c.data && c.data.get(code); row[c.field] = other ? other.total : null; });
      return row;
    }).sort((a, b) => b.total - a.total);
    tableMax = Math.max(...rows.map(r => r.total), 0) || 1;

    // Heading, in the craft.css styles of the sector heading below
    const codeLabel = place.kind === 'us' && place.state ? `USA (for ${place.state})` : dataCode;
    document.getElementById('cornerstoneHeading').innerHTML = `<div class="craft-eyebrow" title="Cornerstone EEIO 2026-rc spend-based GHG emission factors">`
      + `<b>Cornerstone EEIO</b> / <span class="cs-case">2026-rc</span> / ${escapeHtml(codeLabel)} / ${year}`
      + `${adjusted && year !== CS_BASE_YEAR ? ' / 2024 dollars' : ''}</div>`
      + `<h3 class="craft-title">${escapeHtml(name)} Emission Factors ${year}</h3>`;

    // Toolbar: place and price. The year is the page's year dropdown (#year-select).
    document.getElementById('cornerstonePlace').innerHTML = placeOptions(place, reference);
    document.querySelectorAll('#cornerstonePrice button').forEach(b => b.classList.toggle('active', b.dataset.price === shownPrice));

    // Summary
    const totals = rows.map(r => r.total);
    const top = rows[0];
    const notes = [];
    if (place.unknown) notes.push(`Cornerstone has no factors for ${escapeHtml(place.unknown)}, so the World is shown.`);
    if (country && !country.hasFactors) notes.push(`${escapeHtml(country.name)} uses the factors of ${escapeHtml((reference.regions.get(country.region) || {}).name || country.region)}.`);
    if (place.kind === 'us' && place.state) notes.push(`Cornerstone covers countries, so ${escapeHtml(name)} shows the US factors and US margins.`);
    const dollars = adjusted ? CS_BASE_YEAR : year;
    let summary = `${rows.length} sectors in kg CO2e per US dollar (${CS_PRICE_NAMES[shownPrice].toLowerCase()}, ${dollars} dollars). `
      + `Median ${csNumber(median(totals))}, average ${csNumber(mean(totals))}`
      + (top ? `, highest ${escapeHtml(top.name)} at ${csNumber(top.total)}.` : '.');
    compare.forEach(c => {
      if (c.data) summary += ` ${escapeHtml(c.label)} median ${csNumber(median([...c.data.values()].map(f => f.total)))}.`;
    });
    if (margins) {
      summary += ` US margins add a median of ${csNumber(median(rows.map(r => r.margin).filter(v => v !== undefined)))} for wholesale, retail and transport (column "With margins").`;
    } else if (isUs) {
      summary += ' Choose Purchaser price to add the US margins.';
    }
    // The change from the year before: the published factors, or the estimated emissions with inflation removed
    const averageOf = (averages, code) => { const row = averages && averages.get(code); return row && row.get(CS_ALL) ? row.get(CS_ALL).total : null; };
    const prevMean = averageOf(prevAverages, dataCode);
    const curMean = averageOf(curAverages, dataCode);
    if (prevMean && curMean != null) {
      const factorChange = curMean / prevMean - 1;
      const pctText = v => (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
      if (adjusted) {
        // A country's own production; a country on its region's factors still grows at its own rate
        const g = growth && (growth.get(place.code) || growth.get(dataCode));
        const change = g ? emissionsChange(prevMean, curMean, g[year]) : null;
        summary += change == null ? ` No ${year} production growth for ${escapeHtml(name)}.`
          : ` <b>Estimated emissions change from ${prev}: ${pctText(change)}</b> (real production growth ${pctText(g[year])}, `
            + `${g['source' + year] === 'Region' ? 'its region\'s average' : escapeHtml(g['source' + year])}; average factor in 2024 dollars ${pctText(factorChange)}).`;
      } else {
        summary += ` Average factor change from ${prev}: ${pctText(factorChange)}, mostly price change (see Inflation removed).`;
      }
    }
    const demandRow = demandCode && rows.find(r => r.code === demandCode);
    if (demandRow) {
      summary += ` <b>${escapeHtml(demandRow.name)}</b> (${demandRow.code}) is ${csNumber(demandRow.total)}, `
        + `number ${rows.indexOf(demandRow) + 1} of ${rows.length}.`;
    }
    document.getElementById('cornerstoneSummary').innerHTML = (notes.length ? `<span class="cs-note">${notes.join(' ')}</span> ` : '') + summary;

    // Regions of the World, or countries of a region
    const places = document.getElementById('cornerstonePlaces');
    places.innerHTML = placesHtml(place, placeSummaries(place, reference, factors));
    places.style.display = places.innerHTML ? '' : 'none';

    // Sector table, with its title
    document.getElementById('cornerstoneTableTitle').textContent =
      `${name} Emission Factors by Sector (${rows.length} sectors, ${shownPrice === 'PUR' ? 'purchaser' : 'producer'} price)`;
    const columns = tableColumns(place, !!margins, compare.filter(c => c.data));
    const options = {
      data: rows, columns, layout: 'fitDataStretch', height: '460px', index: 'code',
      initialSort: [{ column: margins ? 'shelf' : 'total', dir: 'desc' }],
      rowFormatter: row => row.getElement().classList.toggle('cs-selected', row.getData().code === demandCode)
    };
    if (table) table.destroy();
    const built = new Tabulator('#cornerstoneTable', options);
    table = built;
    built.on('tableBuilt', () => {
      if (built !== table) return; // A newer render replaced it
      filterRows();
      if (demandRow) built.scrollToRow(demandRow.code, 'center', false).catch(() => {});
    });

    // Sources, and a link to a state's US margins from the other places
    const files = [`${year}${shownPrice}.csv`].concat(margins ? [`US/margins/${year}PUR.csv`] : []);
    const marginsLink = isUs ? '' : ` US margins (wholesale, retail and transport) show for the US and its states, for example `
      + `<a href="${window.location.pathname}#showheader=true&showsearch=true&country=US&source=un&year=${year}&state=GA">Georgia</a>.`;
    document.getElementById('cornerstoneNote').innerHTML = `Cradle-to-gate emission factors from the `
      + `<a href="https://docs.cornerstonedata.org/eeio" target="_blank" rel="noopener">Cornerstone EEIO</a> 2026-rc release `
      + `(<a href="https://github.com/cornerstone-data/eeio-docs" target="_blank" rel="noopener">eeio-docs</a>, `
      + `<a href="https://doi.org/10.5281/zenodo.23396891" target="_blank" rel="noopener">Zenodo</a>, CC BY 4.0). `
      + `Producer price is the cost to the producer plus profits and taxes. Purchaser price adds the cost of sales and distribution. `
      + `Data: ${files.map(f => `<a href="${CS_GITHUB}${f}" target="_blank" rel="noopener">${f}</a>`).join(', ')}.${marginsLink}`;
  }

  function setup() {
    const section = document.getElementById('cornerstoneSection');
    if (!section || section.dataset.ready) return;
    section.dataset.ready = '1';
    document.getElementById('cornerstonePrice').addEventListener('click', event => {
      const button = event.target.closest('button[data-price]');
      if (!button) return;
      price = button.dataset.price;
      try { localStorage.setItem(CS_PRICE_KEY, price); } catch (e) { /* Storage blocked: the choice lasts until reload */ }
      render();
    });
    document.getElementById('cornerstonePlace').addEventListener('change', async event => {
      goPlace(event.target.value, await loadReference());
    });
    document.getElementById('cornerstonePlaces').addEventListener('click', async event => {
      const row = event.target.closest('tr[data-place]');
      if (row) goPlace(row.dataset.place, await loadReference());
    });
    document.getElementById('cornerstoneFilter').addEventListener('input', event => {
      filterText = event.target.value;
      filterRows();
    });
    document.addEventListener('hashChangeEvent', render);
    render();
  }

  window.renderCornerstoneReport = render;
  // Shared with the world map (js/footprint-map.js)
  window.CornerstoneData = {
    YEARS: CS_YEARS, GASES: CS_GASES, WORLD: CS_WORLD,
    BASE_YEAR: CS_BASE_YEAR, loadFactors, loadAverages, loadReference, loadMargins, loadGrowth, loadPriceIndex, emissionsChange,
    year: csYear, place: csPlace, formatNumber: csNumber, adjusted: csAdjusted, prevYear: csPrevYear, adjustControl,
    goPlace: async code => goPlace(code, await loadReference())
  };
  // Add the Cornerstone years to the page's year dropdown (setupModelYearSelect in js/config.js)
  const yearSelect = document.getElementById('year-select');
  if (yearSelect && yearSelect.refreshYears) yearSelect.refreshYears();
  setup();
})();
