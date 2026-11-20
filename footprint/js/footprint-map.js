// World map of the Cornerstone GHG emission factors, across the top of profile/footprint/ (#footprintMap in index.html,
// inside localsite's #fullscreen, so it fills the window below the header and search filters as on trade/advantage/).
// Built on the shared map in ../js/profile-map.js and ../css/profile-map.css (also used by trade/advantage/),
// with the data loaders of js/cornerstone-report.js (window.CornerstoneData). Pages without #footprintMap
// (engine/index.html) skip it.
//
// Hash: gas=CO2 (one of the 8 emission columns, TotalGHGs when absent), mapview=region | change | level | world | share (region when absent),
// year=2025 (2024 to 2026, otherwise 2026, from the page's #year-select), maprank=top | bottom (the 10 highest or lowest in the view, all when absent),
// adjust=published (the factors as released; shared with the report. By default inflation is removed: factors in 2024 dollars,
// and "Change" is the estimated change in emissions, real GDP growth times the change in the 2024-dollar factor; see js/cornerstone-report.js),
// and the place (country=, worldregion=, state=) shared with the rest of the page.
// "Change" compares the year with the year before it, so it needs 2025 or 2026. Declines are green, rises red.
// In 2026-rc, 2025 and 2026 are the 2024 factors inflation-adjusted with one US price index per sector, so each
// sector changes by the same percent in every country, and a country's change comes only from its sector mix.
// With the US or a state, the US states are drawn over the US, and a click on one chooses it.
(function () {
  const holder = document.getElementById('footprintMap');
  if (!holder || !window.ProfileMap || !window.CornerstoneData || typeof L === 'undefined' || typeof d3 === 'undefined') return;
  const PM = window.ProfileMap;
  const CD = window.CornerstoneData;

  const GAS_OPTIONS = [
    ['TotalGHGs', 'Greenhouse Gases (all)'], ['CO2', 'CO2, carbon dioxide'], ['CH4', 'CH4, methane'], ['N2O', 'N2O, nitrous oxide'],
    ['HFCs', 'HFCs, hydrofluorocarbons'], ['PFCs', 'PFCs, perfluorocarbons'], ['SF6', 'SF6, sulfur hexafluoride'], ['NF3', 'NF3, nitrogen trifluoride']
  ];
  const gasLabel = gas => gas === 'TotalGHGs' ? 'Greenhouse Gases (all)' : gas;
  const PRICE = 'PRO'; // Producer price, cradle to gate
  // Declining is green, rising red. Below the comparison is blue, above it orange.
  const COLORS = {
    change: ['#065f46', '#34d399', '#eef2f7', '#fb923c', '#b91c1c'],
    level: ['#fff7e6', '#fdc58a', '#f07b3f', '#c2361f', '#5c0b0b'],
    compare: ['#1e40af', '#93c5fd', '#eef2f7', '#fdba74', '#c2410c'],
    share: ['#f5f3ff', '#c4b5fd', '#8b5cf6', '#4c1d95']
  };
  const CONTIGUOUS_US = [[24.4, -124.8], [49.4, -66.9]];
  const WORLD_BOUNDS = [[-50, -165], [72, 175]];

  // ---- Markup: the map, a panel at its upper left, the legend (with the Emissions choice) at its upper right, and the tooltip ----
  holder.innerHTML = `
    <div id="footprintMapCanvas"></div>
    <div id="footprintMapPanel" class="glass">
      <div class="fm-row">
        <label class="fm-check" title="Fill each country with its world region's value"><input type="checkbox" id="footprintMapByRegion"> By region</label>
      </div>
      <div class="fm-title">Emission factors map</div>
      <label class="fm-field"><span>Show</span><select id="footprintMapView"></select></label>
      <label class="fm-field"><span>Sector</span><select id="footprintMapSector"><option value="">All sectors (average)</option></select></label>
      <div id="footprintMapAdjust"></div>
      <div id="footprintMapNote" class="fm-note"></div>
      <div class="fm-field"><span>Countries</span>
        <div id="footprintMapRank" class="fm-radios" role="radiogroup" aria-label="Countries shown">
          <label><input type="radio" name="footprintMapRank" value=""> All</label>
          <label><input type="radio" name="footprintMapRank" value="top"> Top 10</label>
          <label><input type="radio" name="footprintMapRank" value="bottom"> Bottom 10</label>
        </div>
      </div>
      <div id="footprintMapRankHint" class="fm-hint"></div>
      <div id="footprintMapRanked" class="fm-list"></div>
      <div class="fm-subtitle">World regions</div>
      <div id="footprintMapRegions" class="fm-list"></div>
    </div>
    <div id="footprintMapLegend" class="map-legend glass">
      <label class="fm-field"><span>Emissions</span><select id="footprintMapGas">${GAS_OPTIONS.map(g => `<option value="${g[0]}">${g[1]}</option>`).join('')}</select></label>
      <div class="legend-title"></div><div class="legend-body"></div></div>
    <div id="footprintMapTooltip" class="map-tooltip"></div>`;

  const map = PM.createMap('footprintMapCanvas', { leaflet: { worldCopyJump: false, minZoom: 1.5 } }).fitBounds(WORLD_BOUNDS);
  const tiles = PM.basemap(map, { attributionPrefix: 'Data: Cornerstone EEIO 2026-rc | ' });
  const tooltip = PM.tooltip(document.getElementById('footprintMapTooltip'));
  PM.keepOffMap(document.getElementById('footprintMapPanel'));
  PM.keepOffMap(document.getElementById('footprintMapLegend'));
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => map.invalidateSize()).observe(holder);

  // ---- State ----
  let sector = '';           // Cornerstone code, or '' for the average of all sectors
  let sectorFromDemand = null; // The hash's demand when the sector was last set from it
  let byRegion = false;
  let countryLayers = null;  // iso3 -> [layers]
  let stateLayer = null;
  let rankLayer = null;      // Numbered badges on the top or bottom 10
  const stateLayers = new Map();
  let current = null;        // The drawn data, for the tooltip
  let fittedPlace = null;
  let run = 0;

  const hashGas = () => { const g = String(getHash().gas || ''); return GAS_OPTIONS.some(o => o[0] === g) ? g : 'TotalGHGs'; };
  const hashRank = () => { const r = String(getHash().maprank || ''); return r === 'top' || r === 'bottom' ? r : ''; };
  const prevYear = year => { const y = String(Number(year) - 1); return CD.YEARS.includes(y) ? y : null; };
  function hashView(year) {
    const view = String(getHash().mapview || '');
    if (view === 'change') return prevYear(year) ? 'change' : 'level';
    if (['level', 'region', 'world', 'share'].includes(view)) return view;
    return 'region'; // The default: each country compared with its world region
  }
  const pct = v => (v == null || !isFinite(v)) ? '-' : (v > 0 ? '+' : '') + (Math.abs(v) < 0.1 ? (v * 100).toFixed(1) : (v * 100).toFixed(0)) + '%';
  const plainPct = v => (v == null || !isFinite(v)) ? '-' : (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Each location's factor for the gas: the sector's, or the unweighted mean of all sectors
  function levels(factors, gas) {
    const out = new Map();
    if (!factors) return out;
    factors.forEach((rows, loc) => {
      const pick = f => gas === 'TotalGHGs' ? f.total : f.gases[gas];
      if (sector) {
        const f = rows.get(sector);
        if (f && isFinite(pick(f))) out.set(loc, pick(f));
        return;
      }
      let sum = 0, n = 0;
      rows.forEach(f => { const v = pick(f); if (isFinite(v)) { sum += v; n++; } });
      if (n) out.set(loc, sum / n);
    });
    return out;
  }

  // The view's value for a location, with base the location it is compared with, and growthLoc the place whose
  // production growth applies with inflation removed (a country on its region's factors grows at its own rate)
  function viewValue(data, loc, base, growthLoc) {
    const cur = data.cur.get(loc);
    if (cur == null) return null;
    switch (data.view) {
      case 'change': {
        const prev = data.prev.get(loc);
        if (data.adjusted) return CD.emissionsChange(prev, cur, growthOf(data, growthLoc || loc));
        return prev ? (cur - prev) / prev : null;
      }
      case 'region': case 'world': { const b = data.cur.get(base); return b ? cur / b - 1 : null; }
      case 'share': {
        const total = data.total.get(loc);
        if (!total) return null;
        return data.gas === 'TotalGHGs' ? 1 - data.co2.get(loc) / total : cur / total;
      }
      default: return cur;
    }
  }
  function growthOf(data, loc) {
    const g = data.growth && data.growth.get(loc);
    return g ? g[data.year] : null;
  }
  // The color scale works on log ratios for comparisons, so twice as high and half as high get equal color
  const toScale = (view, v) => (view === 'region' || view === 'world') ? Math.log2(1 + v) : v;
  const fromScale = (view, x) => (view === 'region' || view === 'world') ? Math.pow(2, x) - 1 : x;
  function quantile(values, q) { return d3.quantile(values.slice().sort((a, b) => a - b), q); }

  function buildScale(view, values) {
    const xs = values.filter(v => v != null && isFinite(v)).map(v => toScale(view, v));
    if (!xs.length) return { color: () => null, ticks: [] };
    let scale, ticks;
    if (view === 'change' || view === 'region' || view === 'world') {
      const reach = quantile(xs.map(Math.abs), 0.95) || 1e-6;
      scale = PM.colorScale(view === 'change' ? COLORS.change : COLORS.compare, [-reach, reach], { diverging: true, center: 0, symmetric: true });
      ticks = [-reach, 0, reach];
    } else {
      const low = view === 'share' ? 0 : quantile(xs, 0.02);
      const high = quantile(xs, view === 'share' ? 1 : 0.98);
      scale = PM.colorScale(view === 'share' ? COLORS.share : COLORS.level, [low, high]);
      ticks = [low, (low + high) / 2, high];
    }
    if (scale.clamp) scale.clamp(true);
    return { color: v => (v == null || !isFinite(v)) ? null : scale(toScale(view, v)), ticks: ticks.map(x => fromScale(view, x)) };
  }

  function formatView(view, v) {
    if (view === 'change' || view === 'region' || view === 'world') return pct(v);
    if (view === 'share') return plainPct(v);
    return CD.formatNumber(v);
  }

  // The location whose factors a country shows: its own, or its region's
  function countryLoc(reference, iso3) {
    const country = reference.countries.get(iso3);
    if (!country) return null;
    return { country, loc: byRegion || !country.hasFactors ? country.region : iso3, regional: byRegion || !country.hasFactors };
  }

  // The 10 highest (top) or lowest (bottom) in the view: countries with their own factors, or regions when by region.
  // Countries using their region's factors would repeat its value, so they are left out.
  function rankPlaces(data, rank) {
    let rows;
    if (byRegion) {
      rows = [...data.reference.regions.values()].map(r => ({ code: r.code, name: r.name, value: viewValue(data, r.code, CD.WORLD) }));
    } else {
      rows = [...data.reference.countries.entries()].filter(([, c]) => c.hasFactors)
        .map(([iso3, c]) => ({ code: iso3, name: c.name, value: data.valueOf(iso3) }));
    }
    rows = rows.filter(r => r.value != null && isFinite(r.value));
    rows.sort((a, b) => rank === 'top' ? b.value - a.value : a.value - b.value);
    return rows.slice(0, 10);
  }
  function rankHint(data) {
    const top = data.rank === 'top';
    const among = byRegion ? 'world regions' : 'countries with their own factors';
    switch (data.view) {
      case 'change': {
        const what = data.adjusted ? 'Estimated emissions' : 'Factors';
        return top ? `${what} rose the most, or fell the least, from ${data.prevYear} to ${data.year}, of the ${among}.`
          : `${what} fell the most, or rose the least, from ${data.prevYear} to ${data.year}, of the ${among}.`;
      }
      case 'region': case 'world': return `${top ? 'Highest' : 'Lowest'} ${byRegion || data.view === 'world' ? 'compared with the World' : 'compared with their region'}, of the ${among}.`;
      case 'share': return `${top ? 'Highest' : 'Lowest'} ${data.gas === 'TotalGHGs' ? 'non-CO2' : data.gas} share, of the ${among}.`;
      default: return `${top ? 'Highest' : 'Lowest'} ${gasLabel(data.gas)} factors in ${data.year}, of the ${among}.`;
    }
  }

  // ---- Shapes ----
  async function ensureShapes() {
    if (countryLayers) return;
    const features = await PM.countryFeatures();
    countryLayers = new Map();
    L.geoJSON(features, {
      style: () => ({ color: '#94a3b8', weight: 0.5, fillColor: '#e2e8f0', fillOpacity: 0.3 }),
      onEachFeature: (feature, layer) => {
        const iso3 = feature.properties.iso3;
        if (!iso3) return;
        if (!countryLayers.has(iso3)) countryLayers.set(iso3, []);
        countryLayers.get(iso3).push(layer);
        layer.on('click', () => CD.goPlace(iso3));
        layer.on('mouseover', event => { layer.setStyle({ weight: 1.6 }); tooltip.show(event, countryTooltip(iso3, feature.properties.name)); });
        layer.on('mousemove', tooltip.move);
        layer.on('mouseout', () => { styleCountry(iso3); tooltip.hide(); });
      }
    }).addTo(map);
  }
  async function ensureStates() {
    if (stateLayer) return;
    const features = await PM.stateFeatures();
    stateLayer = L.geoJSON(features.filter(f => f.properties.code), {
      style: () => ({ color: '#64748b', weight: 0.6, fillOpacity: 0 }),
      onEachFeature: (feature, layer) => {
        const code = feature.properties.code;
        stateLayers.set(code, layer);
        layer.on('click', () => {
          if (typeof hiddenhash === 'object') hiddenhash.state = '';
          goHash({ country: 'US', state: code }, ['worldregion']);
        });
        layer.on('mouseover', event => tooltip.show(event, stateTooltip(code)));
        layer.on('mousemove', tooltip.move);
        layer.on('mouseout', tooltip.hide);
      }
    });
  }

  function countryTooltip(iso3, shapeName) {
    if (!current) return `<b>${escapeHtml(shapeName || iso3)}</b>`;
    const info = countryLoc(current.reference, iso3);
    if (!info) return `<b>${escapeHtml(shapeName || iso3)}</b><div class="tt-muted">Not in the Cornerstone locations</div>`;
    const { country, loc, regional } = info;
    const region = current.reference.regions.get(country.region);
    const lines = [`<b>${escapeHtml(country.name)}</b>`];
    const value = current.valueOf(iso3);
    lines.push(`<div>${escapeHtml(current.viewLabel)}: <b>${formatView(current.view, value)}</b></div>`);
    const unit = current.adjusted ? ' kg CO2e/2024$' : ' kg CO2e/$';
    if (current.view === 'change') {
      lines.push(`<div>${current.prevYear}: ${CD.formatNumber(current.prev.get(loc))} to ${current.year}: ${CD.formatNumber(current.cur.get(loc))}${unit}</div>`);
      if (current.adjusted) {
        const g = current.growth && current.growth.get(byRegion ? loc : iso3);
        if (g && g[current.year] != null) {
          const source = g['source' + current.year] === 'Region' ? 'its region\'s average' : g['source' + current.year];
          lines.push(`<div>Real production growth ${current.year}: ${pct(g[current.year])} <span class="tt-muted">(${escapeHtml(source)})</span></div>`);
        }
      }
    } else {
      lines.push(`<div>${current.year}: ${CD.formatNumber(current.cur.get(loc))}${unit}</div>`);
    }
    if (region) lines.push(`<div class="tt-muted">${escapeHtml(region.name)}: ${CD.formatNumber(current.cur.get(region.code))}, World: ${CD.formatNumber(current.cur.get(CD.WORLD))}</div>`);
    if (regional) lines.push(`<div class="tt-muted">${byRegion ? 'Colored by its region' : 'Uses its region\'s factors'}</div>`);
    lines.push('<div class="tt-muted">Click to show this country</div>');
    return lines.join('');
  }
  function stateTooltip(code) {
    const name = (typeof getState === 'function' && getState(code)) || code;
    const lines = [`<b>${escapeHtml(name)}</b>`, '<div class="tt-muted">Cornerstone factors are national, so states share the US factors and US margins.</div>'];
    if (current) lines.push(`<div>US ${escapeHtml(current.viewLabel)}: <b>${formatView(current.view, current.valueOf('USA'))}</b></div>`);
    lines.push('<div class="tt-muted">Click to show this state</div>');
    return lines.join('');
  }

  function styleCountry(iso3) {
    const layers = countryLayers && countryLayers.get(iso3);
    if (!layers || !current) return;
    const dark = PM.isDark();
    const info = countryLoc(current.reference, iso3);
    const value = current.valueOf(iso3);
    const fill = current.scale.color(value);
    const place = current.place;
    const selected = place.kind === 'country' && place.code === iso3 || place.kind === 'us' && iso3 === 'USA';
    const inRegion = place.kind === 'region' && info && info.country.region === place.code;
    // With a top or bottom 10, the others are left gray
    const ranked = current.rankedSet ? current.rankedSet.has(byRegion ? (info && info.country.region) : iso3) : null;
    const shown = fill && ranked !== false;
    layers.forEach(layer => layer.setStyle({
      fillColor: shown ? fill : (dark ? '#27272a' : '#e2e8f0'),
      fillOpacity: shown ? (info && info.regional && !byRegion ? 0.55 : 0.85) : 0.3,
      color: selected || inRegion || ranked ? (dark ? '#f8fafc' : '#0f172a') : (dark ? '#52525b' : '#94a3b8'),
      weight: selected ? 2.4 : inRegion || ranked ? 1.4 : 0.5
    }));
    if (selected || inRegion || ranked) layers.forEach(layer => layer.bringToFront());
  }

  // ---- Panel and legend ----
  function fillViewOptions(year, view, adjusted) {
    const prev = prevYear(year);
    const what = adjusted ? 'Emissions change' : 'Factor change';
    const options = [
      ['region', 'Compared with its world region'],
      ['change', prev ? `${what} from ${prev} to ${year}` : `${what} from the year before (2025, 2026)`, !prev],
      ['level', `Emission factor ${year}${adjusted && year !== CD.BASE_YEAR ? ', 2024 dollars' : ''}`],
      ['world', 'Compared with the World'],
      ['share', 'Gas share of the total']
    ];
    document.getElementById('footprintMapView').innerHTML = options.map(o =>
      `<option value="${o[0]}"${o[2] ? ' disabled' : ''}${o[0] === view ? ' selected' : ''}>${o[1]}</option>`).join('');
  }

  function viewLabelFor(data) {
    switch (data.view) {
      case 'change': return data.adjusted ? `Emissions change ${data.prevYear} to ${data.year}` : `Factor change ${data.prevYear} to ${data.year}`;
      case 'region': return byRegion ? 'Region compared with the World' : 'Compared with its world region';
      case 'world': return 'Compared with the World';
      case 'share': return data.gas === 'TotalGHGs' ? 'Non-CO2 share' : `${data.gas} share of total`;
      default: return `${gasLabel(data.gas)} factor${data.adjusted && data.year !== CD.BASE_YEAR ? ', 2024 dollars' : ''}`;
    }
  }

  function renderLegend(data) {
    const legend = document.getElementById('footprintMapLegend');
    const sectorName = sector ? ((data.reference.sectors.get(sector) || {}).name || sector) : 'Average of all sectors';
    legend.querySelector('.legend-title').textContent = data.viewLabel;
    const labels = data.scale.ticks.map(t => formatView(data.view, t));
    let keys = '';
    if (data.view === 'change') {
      keys = `<div class="legend-keys" style="margin-top:6px"><span class="legend-key"><i style="background:${COLORS.change[0]}"></i>Declining</span>`
        + `<span class="legend-key"><i style="background:${COLORS.change[4]}"></i>Rising</span></div>`;
    } else if (data.view === 'region' || data.view === 'world') {
      keys = `<div class="legend-keys" style="margin-top:6px"><span class="legend-key"><i style="background:${COLORS.compare[0]}"></i>Lower</span>`
        + `<span class="legend-key"><i style="background:${COLORS.compare[4]}"></i>Higher</span></div>`;
    }
    const notes = [`${escapeHtml(sectorName)}. Producer price, kg CO2e per ${data.adjusted ? CD.BASE_YEAR : data.year} US dollar.`];
    if (data.view === 'change' && data.adjusted) {
      notes.push(`Inflation removed: real production (GDP) growth times the change in the 2024-dollar factor${sector ? ', with the whole economy\'s growth' : ''}.`);
    } else if (data.view === 'change') notes.push('2025 and 2026 are the 2024 factors adjusted for US price changes by sector (Cornerstone 2026-rc), so each sector changes alike in every country, and these differences come from each country\'s mix of sectors. Choose Inflation removed for estimated emissions.');
    if (!byRegion) notes.push('Lighter countries use their region\'s factors.');
    legend.querySelector('.legend-body').innerHTML = PM.legendRamp(data.view === 'change' ? COLORS.change
      : (data.view === 'region' || data.view === 'world') ? COLORS.compare : data.view === 'share' ? COLORS.share : COLORS.level, labels)
      + keys + `<div style="margin-top:6px">${notes.join(' ')}</div>`;
  }

  function renderRegions(data) {
    const regions = [...data.reference.regions.values()];
    const rows = [{ code: CD.WORLD, name: 'World' }].concat(regions).map(r => ({
      code: r.code, name: r.name, value: viewValue(data, r.code, CD.WORLD)
    }));
    rows.sort((a, b) => (b.code === CD.WORLD) - (a.code === CD.WORLD) || (b.value ?? -Infinity) - (a.value ?? -Infinity));
    const place = data.place;
    document.getElementById('footprintMapRegions').innerHTML = rows.map(r => {
      const color = r.code === CD.WORLD && (data.view === 'region' || data.view === 'world') ? '#eef2f7' : data.scale.color(r.value);
      const selected = place.kind === 'world' && r.code === CD.WORLD || place.kind === 'region' && place.code === r.code;
      return `<div class="fm-region${selected ? ' is-selected' : ''}" data-place="${r.code}" role="button" tabindex="0">`
        + `<i style="background:${color || 'transparent'}"></i><span>${escapeHtml(r.name)}</span><b>${formatView(data.view, r.value)}</b></div>`;
    }).join('');
  }

  function renderRanked(data) {
    document.querySelectorAll('#footprintMapRank input').forEach(input => { input.checked = input.value === data.rank; });
    document.getElementById('footprintMapRankHint').textContent = data.rank ? rankHint(data) : '';
    const place = data.place;
    document.getElementById('footprintMapRanked').innerHTML = data.ranked.map((r, i) => {
      const selected = place.code === r.code && (place.kind === 'country' || place.kind === 'region') || place.kind === 'us' && r.code === 'USA';
      return `<div class="fm-region${selected ? ' is-selected' : ''}" data-place="${r.code}" role="button" tabindex="0">`
        + `<em>${i + 1}</em><i style="background:${data.scale.color(r.value) || 'transparent'}"></i><span>${escapeHtml(r.name)}</span><b>${formatView(data.view, r.value)}</b></div>`;
    }).join('');

    // Numbered badges on the ranked countries (by region, on each region's largest member)
    if (!rankLayer) rankLayer = L.layerGroup().addTo(map);
    rankLayer.clearLayers();
    data.ranked.forEach((r, i) => {
      let layers = countryLayers.get(r.code);
      if (byRegion) {
        const members = ((data.reference.regions.get(r.code) || {}).countries || []).flatMap(c => countryLayers.get(c) || []);
        layers = members.length ? [members.reduce((a, b) => area(b) > area(a) ? b : a)] : null;
      }
      if (!layers || !layers.length) return; // Too small for the world map's shapes, but still in the list
      const badge = L.marker(PM.shapeCenter(layers[0]), {
        icon: L.divIcon({ className: 'fm-rank-badge', html: String(i + 1), iconSize: [20, 20] }),
        title: `${i + 1}. ${r.name}: ${formatView(data.view, r.value)}`,
        keyboard: false
      });
      badge.on('click', () => CD.goPlace(r.code));
      rankLayer.addLayer(badge);
    });
  }
  function area(layer) { const b = layer.getBounds(); return (b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth()); }

  function fitPlace(place) {
    const key = place.kind + ':' + place.code + ':' + (place.state || '');
    if (key === fittedPlace) return;
    fittedPlace = key;
    const pad = { paddingTopLeft: [holder.clientWidth > 760 ? 280 : 20, 20], paddingBottomRight: [holder.clientWidth > 760 ? 280 : 20, 20] };
    const boundsOf = layers => {
      let bounds = null;
      layers.forEach(layer => {
        let b = layer.getBounds();
        if (b.getEast() - b.getWest() > 180) { const c = PM.shapeCenter(layer); b = L.latLngBounds([c.lat - 10, c.lng - 25], [c.lat + 10, c.lng + 25]); }
        bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
      });
      return bounds;
    };
    let bounds = null;
    if (place.kind === 'us' && place.state && stateLayers.get(place.state)) bounds = stateLayers.get(place.state).getBounds().pad(0.6);
    else if (place.kind === 'us') bounds = L.latLngBounds(CONTIGUOUS_US);
    else if (place.kind === 'country' && countryLayers.get(place.code)) bounds = boundsOf(countryLayers.get(place.code)).pad(0.4);
    else if (place.kind === 'region') {
      const reference = current.reference;
      const members = ((reference.regions.get(place.code) || {}).countries || []).flatMap(c => countryLayers.get(c) || []);
      if (members.length) bounds = boundsOf(members).pad(0.15);
    }
    if (bounds) map.fitBounds(bounds, Object.assign({ maxZoom: 6 }, pad));
    else map.fitBounds(WORLD_BOUNDS);
  }

  // ---- Render ----
  async function render() {
    const thisRun = ++run;
    const year = CD.year();
    const view = hashView(year);
    const gas = hashGas();
    // Removing inflation changes only the change view and the factors of 2025 and 2026. The comparisons (with the region
    // or the World) and the gas shares divide factors that share each sector's price index, so it cancels: those views
    // use the factors as published and hide the toggle.
    const removesInflation = view === 'change' || (view === 'level' && year !== CD.BASE_YEAR);
    const adjusted = CD.adjusted() && removesInflation;
    const adjustEl = document.getElementById('footprintMapAdjust');
    CD.adjustControl(adjustEl, 'fm-toggle');
    adjustEl.hidden = !removesInflation;
    const prev = view === 'change' ? prevYear(year) : null;
    const place = CD.place();
    document.getElementById('footprintMapGas').value = gas;
    fillViewOptions(year, view, CD.adjusted());
    document.getElementById('footprintMapByRegion').checked = byRegion;
    // The year comes from the page's year dropdown (#year-select), which also lists the USEEIO and Exiobase years
    const note = document.getElementById('footprintMapNote');
    const asked = String(getHash().year || '').trim();
    const notes = [];
    if (asked && asked !== year) notes.push(`Cornerstone has ${CD.YEARS[0]} to ${CD.YEARS[CD.YEARS.length - 1]}, so the map shows ${year}.`);
    if (String(getHash().mapview || '') === 'change' && !prevYear(year)) notes.push(`There is no year before ${year}. Choose 2025 or 2026 to see the change.`);
    note.textContent = notes.join(' ');
    const legendTitle = document.querySelector('#footprintMapLegend .legend-title');
    legendTitle.textContent = 'Loading the emission factors...';

    // The sector names, so the hash's demand can choose the sector before the factors load. Without a sector the
    // averages start loading meanwhile (loaders keep their results, so the call below reuses them).
    if (!sector && !getHash().demand) {
      CD.loadAverages(year, PRICE, adjusted).catch(() => {});
      if (prev) CD.loadAverages(prev, PRICE, adjusted).catch(() => {});
    }
    let reference;
    try {
      reference = await CD.loadReference();
    } catch (error) {
      console.warn('footprint-map', error);
      if (thisRun === run) legendTitle.textContent = 'The emission factors could not load.';
      return;
    }
    if (thisRun !== run) return;

    // Sector menu, once. The hash's demand chooses the sector when Cornerstone has its code (531HSO).
    const sectorSelect = document.getElementById('footprintMapSector');
    if (sectorSelect.options.length === 1) {
      [...reference.sectors.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
        .forEach(([code, s]) => sectorSelect.add(new Option(`${s.name} (${code})`, code)));
    }
    const demand = String(getHash().demand || '').split('/')[0];
    if (demand !== sectorFromDemand) {
      sectorFromDemand = demand;
      if (demand && reference.sectors.has(demand)) sector = demand;
    }
    sectorSelect.value = sector;

    // "All sectors (average)" reads each location's averages (CD.loadAverages, a small file). A chosen sector needs the
    // year's full factors (about 5 MB). The year before (for the change view) loads alongside, but the map draws the
    // year's values as soon as they arrive.
    const load = y => sector ? CD.loadFactors(y, PRICE, adjusted) : CD.loadAverages(y, PRICE, adjusted);
    const later = prev ? Promise.all([load(prev), adjusted ? CD.loadGrowth() : null]) : null;
    if (later) later.catch(() => {}); // Reported below, once awaited
    let cur, before = null, growth = null;
    try {
      [cur] = await Promise.all([load(year), ensureShapes()]);
    } catch (error) {
      console.warn('footprint-map', error);
      if (thisRun === run) legendTitle.textContent = 'The emission factors could not load.';
      return;
    }
    if (thisRun !== run) return;

    // Draws a view of the loaded factors: the countries, legend, regions and ranked list
    const draw = (shownView, shownPrev, before, growth) => {
      const data = { year, prevYear: shownPrev, view: shownView, gas, place, reference, adjusted, growth };
      data.cur = levels(cur, gas);
      data.prev = levels(before, gas);
      data.total = shownView === 'share' ? levels(cur, 'TotalGHGs') : null;
      data.co2 = shownView === 'share' && gas === 'TotalGHGs' ? levels(cur, 'CO2') : null;
      data.viewLabel = viewLabelFor(data);
      data.valueOf = iso3 => {
        const info = countryLoc(reference, iso3);
        if (!info) return null;
        const base = shownView === 'world' || byRegion ? CD.WORLD : info.country.region;
        return viewValue(data, info.loc, base, byRegion ? info.loc : iso3);
      };
      const shown = [...countryLayers.keys()].map(data.valueOf).filter(v => v != null);
      data.scale = buildScale(shownView, shown);
      data.rank = hashRank();
      data.ranked = data.rank ? rankPlaces(data, data.rank) : [];
      data.rankedSet = data.rank ? new Set(data.ranked.map(r => r.code)) : null;
      current = data;
      countryLayers.forEach((layers, iso3) => styleCountry(iso3));
      renderLegend(data);
      renderRegions(data);
      renderRanked(data);
    };
    if (later) {
      // The year's factors first, until the year before arrives for the change
      draw('level', null, null, null);
      legendTitle.textContent = `${viewLabelFor({ view: 'level', gas, year, adjusted })}, loading ${prev} for the change...`;
      try {
        [before, growth] = await later;
      } catch (error) {
        console.warn('footprint-map', error);
        if (thisRun === run) legendTitle.textContent = `The ${prev} emission factors could not load, so the change can't be shown.`;
        return;
      }
      if (thisRun !== run) return;
    }
    draw(view, prev, before, growth);

    // The US states over the US, for the US or a state
    if (place.kind === 'us') {
      await ensureStates();
      if (thisRun !== run) return;
      if (!map.hasLayer(stateLayer)) stateLayer.addTo(map);
      const dark = PM.isDark();
      stateLayers.forEach((layer, code) => {
        const selected = code === place.state;
        layer.setStyle({ color: selected ? (dark ? '#f8fafc' : '#0f172a') : (dark ? '#71717a' : '#64748b'), weight: selected ? 2.4 : 0.6 });
        if (selected) layer.bringToFront();
      });
    } else if (stateLayer && map.hasLayer(stateLayer)) {
      map.removeLayer(stateLayer);
    }
    fitPlace(place);
  }

  // ---- Controls ----
  document.getElementById('footprintMapGas').addEventListener('change', event => {
    if (event.target.value === 'TotalGHGs') goHash({}, ['gas']);
    else goHash({ gas: event.target.value });
  });
  document.getElementById('footprintMapView').addEventListener('change', event => goHash({ mapview: event.target.value }));
  document.getElementById('footprintMapSector').addEventListener('change', event => { sector = event.target.value; render(); });
  document.getElementById('footprintMapByRegion').addEventListener('change', event => { byRegion = event.target.checked; render(); });
  document.getElementById('footprintMapRank').addEventListener('change', event => {
    if (event.target.value) goHash({ maprank: event.target.value });
    else goHash({}, ['maprank']);
  });
  ['footprintMapRegions', 'footprintMapRanked'].forEach(id => {
    const list = document.getElementById(id);
    list.addEventListener('click', event => {
      const row = event.target.closest('[data-place]');
      if (row) CD.goPlace(row.dataset.place);
    });
    list.addEventListener('keydown', event => {
      const row = event.target.closest('[data-place]');
      if (row && event.key === 'Enter') CD.goPlace(row.dataset.place);
    });
  });
  document.addEventListener('hashChangeEvent', render);
  PM.watchTheme(() => { tiles.sync(); render(); });
  render();
})();
