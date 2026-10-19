// Energy view for localsite/info: set=energy, from EPA eGRID 2024 electricity data.
// With a state: the USEEIO state models have no energy indicators (ENRG, NNRG, RNRG), so this view replaces
// the inflow-outflow grid (body.stateEnergyView hides it) with the state's summary cards, resource mix,
// CO2e emission rates and a Tabulator table of the eGRID subregions its power plants are in.
// Impact Levels (the heatmap mosaic) stays, with the state model's 16 indicators.
// Several states (state=GA,AL): the cards total the states, and the mix and rates show each state.
// Without a state: the USEEIO national charts stay, and this view adds the US totals, each state's resource mix,
// the subregion emission rates and a table of all states. Choosing a state opens its view.
// Markup and CSS: #stateEnergy (after #industryHeader) in info/template-charts.html, shown by body.energyView.
// When the page has #heroBottomEnergy (info/index.html), the title, intro and summary cards move to the bottom of the hero.
// Data: egrid-data.js, loaded the first time the view is shown. Built by egrid_to_js.py from the eGRID workbooks in
// https://github.com/ModelEarth/useeio-json/tree/main/egrid
// Resides in profile/js. localsite.js loads this file after naics.js. Plan: profile/state/PLAN.md

(function() {
  if (window.stateEnergyView) return; // Loaded already

  const fuelColors = {
    coal: '#555555', oil: '#8c564b', gas: '#f2a541', nuclear: '#9467bd', hydro: '#1f77b4', biomass: '#6b8e23',
    wind: '#17becf', solar: '#f7d02c', geothermal: '#d62728', otherFossil: '#a3a3a3', other: '#cfcfcf'
  };
  let egridReady = null;
  let renderedView = ""; // State codes, e.g. AL,GA, or US for all states
  let renderedStates = []; // The states shown that have eGRID data
  let energyTable = null;

  // The states in the hash, e.g. ["AL", "GA"] for state=AL,GA
  function energyStates(hash) {
    const states = String(hash.state || "").toUpperCase().split(",").map(s => s.trim()).filter(s => /^[A-Z]{2}$/.test(s));
    return states.filter((state, i) => states.indexOf(state) === i);
  }
  function isEnergyView(hash) {
    return String(hash.set || "").toLowerCase() === "energy";
  }
  // The states shown, or US for all states
  function energyViewFor(hash) {
    return energyStates(hash).join(",") || "US";
  }

  function loadEgridData() {
    if (!egridReady) {
      egridReady = new Promise(function(resolve, reject) {
        if (typeof egridData !== 'undefined') {
          resolve();
          return;
        }
        loadScript(local_app.localsite_root() + '../profile/js/egrid-data.js', function() {
          if (typeof egridData !== 'undefined') resolve();
          else reject(new Error("egrid-data.js did not define egridData"));
        });
      });
    }
    return egridReady;
  }

  function stateName(state) {
    const option = document.querySelector("#state_select option[value='" + state + "']");
    return option && option.text ? option.text : state;
  }
  // e.g. "Georgia", "Georgia and Alabama" or "Georgia, Alabama and Florida"
  function stateNames(states) {
    const names = states.map(stateName);
    return names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names.join("");
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  }
  function formatNumber(value, digits) {
    if (value === null || value === undefined || isNaN(value)) return "–";
    return Number(value).toLocaleString(undefined, {minimumFractionDigits: digits, maximumFractionDigits: digits});
  }
  function formatPct(fraction, digits) {
    if (fraction === null || fraction === undefined || isNaN(fraction)) return "–";
    return formatNumber(fraction * 100, digits === undefined ? 1 : digits) + "%";
  }
  // MWh as TWh, or GWh for small totals
  function formatEnergy(mwh) {
    if (mwh === null || mwh === undefined) return "–";
    return mwh >= 1e6 ? formatNumber(mwh / 1e6, 1) + " TWh" : formatNumber(mwh / 1e3, 0) + " GWh";
  }
  function formatChange(fraction) {
    if (fraction === null || fraction === undefined || isNaN(fraction)) return "–";
    const cls = fraction < 0 ? "energy-change-down" : (fraction > 0 ? "energy-change-up" : "");
    return "<span class='" + cls + "'>" + (fraction > 0 ? "+" : "") + formatPct(fraction, 1) + "</span>";
  }
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
  function mixTotal(mix) {
    return mix.reduce((sum, mwh) => sum + Math.max(mwh, 0), 0) || 1;
  }
  // The fuel with the most generation, e.g. {label: "Gas", share: 0.45}
  function largestSource(mix) {
    const total = mixTotal(mix);
    let best = 0;
    mix.forEach((mwh, i) => { if (mwh > mix[best]) best = i; });
    return {label: egridData.fuels[best].label, share: Math.max(mix[best], 0) / total};
  }

  // One state's record, or the totals for several states in the same shape
  function combineStates(states) {
    const records = states.map(state => egridData.states[state]);
    if (records.length === 1) return records[0];
    const sum = field => records.reduce((total, st) => total + (st[field] || 0), 0);
    const generation = sum("generation");
    // Rates and percentages weighted by each state's generation
    const weighted = field => generation ? records.reduce((total, st) => total + (st[field] || 0) * (st.generation || 0), 0) / generation : null;
    return {
      capacity: sum("capacity"), generation: generation, co2e: sum("co2e"),
      co2eRate: weighted("co2eRate"), renewablePct: weighted("renewablePct"), nonhydroRenewablePct: weighted("nonhydroRenewablePct"),
      mix: egridData.fuels.map((fuel, i) => records.reduce((total, st) => total + st.mix[i], 0))
    };
  }

  // Each eGRID subregion's share of the states' plant generation, and which of the states have plants in it
  function subregionShares(states) {
    const generation = {};
    const statesIn = {};
    let total = 0;
    states.forEach(function(state) {
      (egridData.stateSubregions[state] || []).forEach(function(entry) {
        generation[entry[0]] = (generation[entry[0]] || 0) + entry[2];
        (statesIn[entry[0]] = statesIn[entry[0]] || []).push(state);
        total += entry[2];
      });
    });
    const shares = {};
    Object.keys(generation).forEach(id => { shares[id] = total ? generation[id] / total : 0; });
    return {shares: shares, statesIn: statesIn};
  }

  function card(label, value, sub) {
    return "<div class='energy-card'><div class='energy-card-label'>" + label + "</div>"
      + "<div class='energy-card-value'>" + value + "</div>"
      + (sub ? "<div class='energy-card-sub'>" + sub + "</div>" : "") + "</div>";
  }

  // Summary cards for a state (compared with the US), or for the US when st is the US
  function renderCards(st, us) {
    const isUS = st === us;
    const rateDiff = (!isUS && st.co2eRate && us.co2eRate) ? (st.co2eRate - us.co2eRate) / us.co2eRate : null;
    const rateSub = rateDiff === null ? "Per MWh of net generation" : "US " + formatNumber(us.co2eRate, 0) + " · "
      + formatPct(Math.abs(rateDiff), 0) + (rateDiff < 0 ? " lower" : " higher");
    const largest = largestSource(st.mix);
    setHtml("stateEnergyCards",
      card("Net generation", formatEnergy(st.generation), isUS ? "Largest source: " + largest.label + " " + formatPct(largest.share, 0) : formatPct(st.generation / us.generation, 1) + " of US")
      + card("Nameplate capacity", formatNumber(st.capacity / 1000, 1) + " GW", formatNumber(st.capacity, 0) + " MW")
      + card("CO<sub>2</sub>e emissions", formatNumber(st.co2e / 1e6, 1) + " Mt", "Million metric tons")
      + card("CO<sub>2</sub>e rate", formatNumber(st.co2eRate, 0) + " <span style='font-size:13px;font-weight:400'>kg/MWh</span>", rateSub)
      + card("Renewables", formatPct(st.renewablePct, 1), (isUS ? "" : "US " + formatPct(us.renewablePct, 1) + " · ") + "Non-hydro " + formatPct(st.nonhydroRenewablePct, 1)));
  }

  // Stacked bar of generation by fuel. Negative net generation (e.g. pumped storage) is left out of the bar.
  // A compact row (all states) is clickable and opens that state's view.
  function mixBar(label, mix, title, state) {
    const total = mixTotal(mix);
    const segments = egridData.fuels.map(function(fuel, i) {
      const share = Math.max(mix[i], 0) / total;
      if (share <= 0) return "";
      return "<span style='width:" + (share * 100) + "%;background:" + fuelColors[fuel.id] + "' title='"
        + escapeHtml(title + " " + fuel.label + ": " + formatPct(share, 1) + " (" + formatEnergy(mix[i]) + ")") + "'></span>";
    }).join("");
    const rowAttrs = state
      ? " energy-mix-compact' data-state='" + state + "' role='button' tabindex='0' title='" + escapeHtml("View " + title) + "'"
      : "'";
    return "<div class='energy-mix-row" + rowAttrs + "><div class='energy-mix-label'>" + escapeHtml(label) + "</div>"
      + "<div class='energy-mix-bar' role='img' aria-label='" + escapeHtml(title) + " resource mix'>" + segments + "</div></div>";
  }

  // Legend with each fuel's share in the first mix. Fuels missing from both mixes are left out.
  function mixLegend(mix, compareMix, compareLabel) {
    const total = mixTotal(mix);
    const compareTotal = mixTotal(compareMix);
    return "<div class='energy-legend'>" + egridData.fuels.map(function(fuel, i) {
      if (mix[i] <= 0 && compareMix[i] <= 0) return "";
      return "<span title='" + escapeHtml(fuel.label + ": " + compareLabel + " " + formatPct(Math.max(compareMix[i], 0) / compareTotal, 1)) + "'>"
        + "<i style='background:" + fuelColors[fuel.id] + "'></i>" + escapeHtml(fuel.label) + " "
        + formatPct(Math.max(mix[i], 0) / total, 1) + "</span>";
    }).join("") + "</div>";
  }

  // One state compared with the US, or a bar per state (choose one to view it alone) with the states' combined shares
  function renderStateMix(states, st, us) {
    setText("stateEnergyMixTitle", "Resource Mix");
    if (states.length === 1) {
      setHtml("stateEnergyMix", mixBar(states[0], st.mix, stateName(states[0])) + mixBar("US", us.mix, "US")
        + mixLegend(st.mix, us.mix, "US"));
      return;
    }
    // Each state, then after a space the states combined and the US
    setHtml("stateEnergyMix", mixLegend(st.mix, us.mix, "US")
      + "<div class='energy-note' style='margin:10px 0 8px'>Shares above are for the " + states.length + " states combined. Choose a state to view it alone.</div>"
      + "<div class='energy-mix-states'>" + states.map(state => mixBar(state, egridData.states[state].mix, stateName(state), state)).join("")
      + "<div class='energy-mix-gap'></div>" + mixBar("Total", st.mix, states.length + " states combined")
      + mixBar("US", us.mix, "US") + "</div>");
  }

  // The US, then each state from the lowest CO2e rate to the highest
  function renderNationalMix(us) {
    const states = Object.keys(egridData.states)
      .sort((a, b) => (egridData.states[a].co2eRate || 0) - (egridData.states[b].co2eRate || 0));
    setText("stateEnergyMixTitle", "Resource Mix by State");
    setHtml("stateEnergyMix", mixLegend(us.mix, us.mix, "US")
      + "<div class='energy-note' style='margin:10px 0 8px'>States ranked from the lowest CO<sub>2</sub>e rate to the highest. Click a bar to view state.</div>"
      + "<div class='energy-mix-states'>" + mixBar("US", us.mix, "US") + "<div class='energy-mix-gap'></div>"
      + states.map(state => mixBar(state, egridData.states[state].mix, stateName(state), state)).join("") + "</div>");
  }

  function rateRows(rows, note) {
    const max = Math.max.apply(null, rows.map(r => r.rate || 0)) || 1;
    return rows.map(function(row) {
      return "<div class='energy-rate-row " + row.cls + "'><div>" + escapeHtml(row.label) + "</div>"
        + "<div class='energy-rate-track'><div class='energy-rate-fill' style='width:" + ((row.rate || 0) / max * 100) + "%'></div></div>"
        + "<div class='energy-rate-value'>" + formatNumber(row.rate, 0) + "</div></div>";
    }).join("") + "<div class='energy-note'>Kilograms of CO<sub>2</sub> equivalent per MWh of net generation, " + egridData.year + ". " + note + "</div>";
  }

  // CO2e output rates: each state (and the states combined), the subregions their plants are in, and the US
  function renderStateRates(states, st, us) {
    const rows = states.map(state => ({label: stateName(state), rate: egridData.states[state].co2eRate, cls: "energy-rate-state"}));
    if (states.length > 1) rows.push({label: states.length + " states combined", rate: st.co2eRate, cls: "energy-rate-state"});
    const shares = subregionShares(states).shares;
    egridData.subregions
      .filter(s => shares[s.id] >= 0.01) // Skip subregions under 1% of the generation
      .sort((a, b) => shares[b.id] - shares[a.id])
      .forEach(s => rows.push({label: s.id + " " + s.name + " (" + formatPct(shares[s.id], 0) + ")", rate: s.co2eRate2024, cls: ""}));
    rows.push({label: "United States", rate: us.co2eRate, cls: "energy-rate-us"});
    setText("stateEnergyRatesTitle", "CO₂e Emission Rate");
    setHtml("stateEnergyRates", rateRows(rows, states.length > 1
      ? "Subregion percentages are shares of the states' combined generation."
      : "Subregion percentages are shares of the state's generation."));
  }

  // CO2e output rates: the US and every eGRID subregion, highest first
  function renderNationalRates(us) {
    const rows = [{label: "United States", rate: us.co2eRate, cls: "energy-rate-us"}].concat(
      egridData.subregions.slice()
        .sort((a, b) => (b.co2eRate2024 || 0) - (a.co2eRate2024 || 0))
        .map(s => ({label: s.id + " " + s.name, rate: s.co2eRate2024, cls: ""})));
    setText("stateEnergyRatesTitle", "CO₂e Emission Rate by eGRID Subregion");
    setHtml("stateEnergyRates", rateRows(rows, "eGRID subregions are grid areas, which can cross state lines."));
  }

  // The states' subregions (by share of the states' generation), or all subregions
  function subregionRows(states, showAll) {
    const {shares, statesIn} = subregionShares(states);
    return egridData.subregions
      .filter(s => showAll || shares[s.id] !== undefined)
      .map(s => Object.assign({}, s, {share: shares[s.id] === undefined ? null : shares[s.id], own: shares[s.id] !== undefined,
        states: (statesIn[s.id] || []).join(", ")}))
      // The states' subregions first, by share of their generation, then the others by emission rate
      .sort((a, b) => (b.share || 0) - (a.share || 0) || (b.co2eRate2024 || 0) - (a.co2eRate2024 || 0));
  }

  // A new Tabulator in #tabulator-energytable. Narrow screens hide the higher "responsive" numbers first.
  function showEnergyTable(options) {
    loadTabulator().then(function() {
      if (energyTable) {
        energyTable.destroy();
        energyTable = null;
      }
      energyTable = new Tabulator("#tabulator-energytable", Object.assign({
        layout: "fitColumns",
        responsiveLayout: "hide"
      }, options));
      if (options.onRowClick) {
        energyTable.on("rowClick", (e, row) => options.onRowClick(row.getData()));
      }
    });
  }

  const pctFormatter = cell => formatPct(cell.getValue(), 1);
  const rateFormatter = cell => formatNumber(cell.getValue(), 0);

  function renderStateTable(states) {
    const showAll = !!(document.getElementById("stateEnergyAllSubregions") || {}).checked;
    const rows = subregionRows(states, showAll);
    const multiple = states.length > 1;
    setText("stateEnergyTableTitle", "eGRID Subregions");
    setText("stateEnergyTableIntro", showAll
      ? "All " + rows.length + " eGRID subregions. " + (multiple ? "Subregions of the selected states" : states[0] + "'s subregions") + " are in bold."
      : "eGRID subregions with power plants in " + stateNames(states) + ".");
    showEnergyTable({
      data: rows,
      rowFormatter: function(row) {
        row.getElement().classList.toggle("energy-own-row", showAll && row.getData().own);
      },
      columns: [
        {title: "Subregion", field: "name", frozen: true, minWidth: 150, widthGrow: 3, responsive: 0,
          formatter: cell => "<b>" + escapeHtml(cell.getRow().getData().id) + "</b> " + escapeHtml(cell.getValue())},
        {title: multiple ? "Share of states" : "Share of " + states[0], field: "share", hozAlign: "right", sorter: "number", minWidth: 90, responsive: 0, formatter: pctFormatter},
        // Which of the selected states have plants in the subregion
        {title: "States", field: "states", minWidth: 80, responsive: 1, visible: multiple},
        {title: "CO2e " + egridData.year + " kg/MWh", field: "co2eRate2024", hozAlign: "right", sorter: "number", minWidth: 100, responsive: 0, formatter: rateFormatter},
        {title: "CO2e " + egridData.compareYear + " kg/MWh", field: "co2eRate2023", hozAlign: "right", sorter: "number", minWidth: 100, responsive: 2, formatter: rateFormatter},
        {title: "Change", field: "co2eChange", hozAlign: "right", sorter: "number", minWidth: 80, responsive: 1, formatter: cell => formatChange(cell.getValue())},
        {title: "Renewables", field: "renewablePct", hozAlign: "right", sorter: "number", minWidth: 95, responsive: 2, formatter: pctFormatter},
        {title: "Capacity MW", field: "capacity", hozAlign: "right", sorter: "number", minWidth: 100, responsive: 3, formatter: rateFormatter}
      ]
    });
  }

  // Every state, from the most generation to the least. Clicking a row opens the state's view.
  function renderNationalTable() {
    const rows = Object.keys(egridData.states).map(function(state) {
      const st = egridData.states[state];
      const largest = largestSource(st.mix);
      return Object.assign({}, st, {state: state, name: stateName(state), largest: largest.label, largestShare: largest.share});
    }).sort((a, b) => (b.generation || 0) - (a.generation || 0));
    setText("stateEnergyTableTitle", "Electricity by State");
    setText("stateEnergyTableIntro", "Choose a state for its eGRID subregions and resource mix.");
    showEnergyTable({
      data: rows,
      onRowClick: data => goHash({'state': data.state}),
      columns: [
        {title: "State", field: "name", frozen: true, minWidth: 130, widthGrow: 2, responsive: 0},
        {title: "Generation TWh", field: "generation", hozAlign: "right", sorter: "number", minWidth: 100, responsive: 0,
          formatter: cell => formatNumber(cell.getValue() / 1e6, 1)},
        {title: "CO2e kg/MWh", field: "co2eRate", hozAlign: "right", sorter: "number", minWidth: 95, responsive: 0, formatter: rateFormatter},
        {title: "Renewables", field: "renewablePct", hozAlign: "right", sorter: "number", minWidth: 95, responsive: 1, formatter: pctFormatter},
        {title: "Largest source", field: "largest", minWidth: 120, responsive: 2,
          formatter: cell => escapeHtml(cell.getValue()) + " " + formatPct(cell.getRow().getData().largestShare, 0)},
        {title: "CO2e Mt", field: "co2e", hozAlign: "right", sorter: "number", minWidth: 85, responsive: 3,
          formatter: cell => formatNumber(cell.getValue() / 1e6, 1)},
        {title: "Capacity GW", field: "capacity", hozAlign: "right", sorter: "number", minWidth: 95, responsive: 3,
          formatter: cell => formatNumber(cell.getValue() / 1000, 1)}
      ]
    });
  }

  function renderSource() {
    setHtml("stateEnergySource", "Source: US EPA <a href='https://www.epa.gov/egrid' target='_blank' rel='noopener'>eGRID</a> "
      + egridData.year + " (state, subregion and plant data) and the eGRID " + egridData.compareYear + " to " + egridData.year + " subregion comparison. "
      + "<a href='https://github.com/ModelEarth/useeio-json/tree/main/egrid' target='_blank' rel='noopener'>Workbooks</a>");
  }

  // One or more states, e.g. AL,GA. The summary cards total the states.
  function renderStateEnergy(view) {
    renderedView = view;
    const requested = view.split(",");
    const states = renderedStates = requested.filter(state => egridData.states[state]);
    const missing = requested.filter(state => !egridData.states[state]);
    const us = egridData.us;
    const allLabel = document.getElementById("stateEnergyAllSubregionsLabel");
    if (allLabel) allLabel.style.display = "";
    setText("stateEnergyTitle", stateNames(requested) + " Electricity Generation");
    renderSource();
    const missingNote = missing.length ? " eGRID has no electricity data for " + stateNames(missing) + "." : "";
    if (!states.length) {
      setText("stateEnergyIntro", missingNote.trim());
      ["stateEnergyCards", "stateEnergyMix", "stateEnergyRates", "stateEnergyTableIntro"].forEach(id => setHtml(id, ""));
      if (energyTable) {
        energyTable.destroy();
        energyTable = null;
      }
      return;
    }
    const st = combineStates(states);
    setHtml("stateEnergyIntro", "Power plants located in " + escapeHtml(stateNames(states)) + "."
      + (states.length > 1 ? " The summary figures total the " + states.length + " states." : "")
      + escapeHtml(missingNote) + " Electricity may be used in other states. "
      + "<a href='#' class='energyNationalLink'>View all states</a>");
    renderCards(st, us);
    renderStateMix(states, st, us);
    renderStateRates(states, st, us);
    renderStateTable(states);
  }

  function renderNationalEnergy() {
    renderedView = "US";
    renderedStates = [];
    const us = egridData.us;
    const allLabel = document.getElementById("stateEnergyAllSubregionsLabel");
    if (allLabel) allLabel.style.display = "none";
    setText("stateEnergyTitle", "US Electricity Generation");
    setText("stateEnergyIntro", "EPA eGRID data for power plants in each state. "
      + "The energy use indicators in the charts below (ENRG, NNRG, RNRG) come from the USEEIO national model.");
    renderSource();
    renderCards(us, us);
    renderNationalMix(us);
    renderNationalRates(us);
    renderNationalTable();
  }

  // The title, intro and summary cards go at the bottom of the hero when the page has one
  function placeHeroEnergy() {
    const holder = document.getElementById("heroBottomEnergy");
    if (!holder) return;
    ["stateEnergyTitle", "stateEnergyIntro", "stateEnergyCards"].forEach(function(id) {
      const el = document.getElementById(id);
      if (el && el.parentNode !== holder) holder.appendChild(el);
    });
  }

  function updateStateEnergyView() {
    const hash = getHash();
    const active = isEnergyView(hash);
    const view = energyViewFor(hash);
    document.body.classList.toggle("energyView", active);
    // State models have no energy indicators, so a state's view replaces the USEEIO charts
    document.body.classList.toggle("stateEnergyView", active && view !== "US");
    if (!active || view === renderedView) return;
    loadEgridData().then(function() {
      onElmReady("#stateEnergy", function() {
        const current = getHash();
        if (!isEnergyView(current) || energyViewFor(current) !== view) return; // The hash changed while loading
        placeHeroEnergy();
        if (view === "US") renderNationalEnergy();
        else renderStateEnergy(view);
      });
    }).catch(function(error) {
      console.warn("State energy view: " + error.message);
    });
  }

  document.addEventListener("change", function(e) {
    if (e.target && e.target.id === "stateEnergyAllSubregions" && renderedView && renderedView !== "US" && renderedStates.length) renderStateTable(renderedStates);
  });
  document.addEventListener("click", function(e) {
    if (!e.target.closest) return;
    // The national model has the energy use indicators (ENRG, NNRG, RNRG)
    if (e.target.closest(".energyNationalLink")) {
      e.preventDefault();
      goHash({}, ["state", "geo"]);
      return;
    }
    const stateRow = e.target.closest(".energy-mix-compact[data-state]");
    if (stateRow) goHash({'state': stateRow.dataset.state});
  });
  document.addEventListener("keydown", function(e) {
    const stateRow = e.target.closest ? e.target.closest(".energy-mix-compact[data-state]") : null;
    if (stateRow && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      goHash({'state': stateRow.dataset.state});
    }
  });
  document.addEventListener("hashChangeEvent", updateStateEnergyView);
  updateStateEnergyView();

  window.stateEnergyView = {update: updateStateEnergyView};
})();
