// Commodities report shared by commodities.html and sector_profile.html: the commodity table, and below it
// the State Total and Rest of US outputs (or US Total) with details, left of round buttons for how many
// rows to show, ranked by Output.
// Requires Tabulator, js/useeio.js, js/config.js (model, getModelState) and formatCell() from localsite.js.

const CommoditiesReport = (function() {

  const rowLimits = [5, 10, 20, 50]; // Followed by a button showing the row total, for all rows
  const co2eFile = 'SupplyChainGHGEmissionFactorsv1.4.0-rc.1.xlsx';
  let co2ePromise = null;

  // Loads the xlsx library only when a page doesn't already include it
  function loadXlsx() {
    if (typeof XLSX !== 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // CO2e factors by USEEIO code from the Excel file, loaded once per page
  function loadCo2eData() {
    if (!co2ePromise) {
      co2ePromise = (async () => {
        const co2eData = {};
        try {
          await loadXlsx();
          const response = await fetch(co2eFile);
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          // Find header row and relevant columns
          const headerRow = jsonData.find(row => row.includes('Reference USEEIO Code') || row.includes('Supply Chain Emission Factors with Margins'));
          const headerIndex = jsonData.indexOf(headerRow);
          const useeioCodeIndex = headerRow.indexOf('Reference USEEIO Code');
          const emissionFactorIndex = headerRow.indexOf('Supply Chain Emission Factors with Margins');

          // Process data rows
          for (let i = headerIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row[useeioCodeIndex] && row[emissionFactorIndex]) {
              co2eData[row[useeioCodeIndex]] = parseFloat(row[emissionFactorIndex]);
            }
          }
        } catch (error) {
          console.warn('Could not load CO2e data from Excel file:', error);
        }
        return co2eData;
      })();
    }
    return co2ePromise;
  }

  // One row per commodity with its output, jobs, GHG and CO2e
  async function loadRows(theModel) {
    const q = await theModel.matrix('q'); // Commodity
    const sectors = await theModel.sectors();
    const indicators = await theModel.indicators();
    const jobsIndicator = indicators.filter(i => i.code === 'JOBS')[0];
    const ghgIndicator = indicators.filter(i => i.code === 'GHG' || i.code === 'GHGR')[0]; // Try both GHG codes
    const impacts = await theModel.matrix('D'); // Indicator_Sector
    const co2eData = await loadCo2eData();

    return sectors.map(sector => {
      const output = q.get(sector.index, 0);
      const jobs = output * impacts.get(jobsIndicator.index, sector.index);
      const ghg = ghgIndicator ? output * impacts.get(ghgIndicator.index, sector.index) : 0;
      const co2e = co2eData[sector.code] || 0;
      const row = {
        ...sector,
        output: Math.round(output),
        jobs: Math.round(jobs),
        ghg: ghg,
        co2e: co2e
      };
      row.jobsEasy = formatCell(row.jobs);
      row.outputEasy = "$" + formatCell(row.output);
      row.ghgEasy = formatCell(row.ghg);
      row.co2eEasy = formatCell(row.co2e);
      return row;
    });
  }

  function sumRows(rows) {
    return rows.reduce((acc, row) => {
      acc.output += row.output || 0;
      acc.jobs += row.jobs || 0;
      acc.ghg += row.ghg || 0;
      acc.co2e += row.co2e || 0;
      return acc;
    }, { output: 0, jobs: 0, ghg: 0, co2e: 0 });
  }

  function totalsLine(label, totals) {
    return `<strong>${label}:</strong> $${formatCell(totals.output)}, ${formatCell(totals.jobs)} jobs, <span style="white-space:nowrap">${formatCell(totals.ghg)} Metric Tons (Mt) of Greenhouse Gases (GHG)</span>, <span style="white-space:nowrap">${formatCell(totals.co2e)} Carbon Dioxide equivalent (CO2e)</span>.`;
  }

  // State Total and Rest of US when a state is in the hash, otherwise the US Total
  function regionTotals(rows, state) {
    if (state) {
      const stateTotals = sumRows(rows.filter(row => row.location.includes(state)));
      const rousTotals = sumRows(rows.filter(row => !row.location.includes(state)));
      console.log("Calculated totals:", { stateTotals, rousTotals });
      return [{ label: 'State Total', totals: stateTotals }, { label: 'Rest of US', totals: rousTotals }];
    }
    const usTotals = sumRows(rows);
    console.log("Calculated US totals:", usTotals);
    return [{ label: 'US Total', totals: usTotals }];
  }

  // One line of outputs with a details link, or a line per region with jobs, GHG and CO2e
  function totalsHtml(regions, detailsOpen) {
    if (detailsOpen) return regions.map(r => totalsLine(r.label, r.totals)).join('<br>');
    return regions.map(r => `<strong>${r.label}:</strong> $${formatCell(r.totals.output)}`).join(', ')
      + ' <a href="#" class="commodity-totals-details" title="Jobs, GHG and CO2e totals">details</a>';
  }

  // Value column in the selected number format, sorted by its raw value
  function numberColumn(title, field, maxWidth, locale, formatType) {
    return {
      title: title,
      field: formatType === "simple" ? field + "Easy" : field,
      hozAlign: "right",
      maxWidth: maxWidth,
      formatter: function (cell) {
        var value = cell.getValue();
        if (formatType === "full") {
          return new Intl.NumberFormat(locale).format(value);
        } else if (formatType === "scientific") {
          let scientificValue = Number(value).toExponential(1);
          let parts = scientificValue.split("e");
          let base = parts[0];
          let exponent = parseInt(parts[1]);
          if (exponent === 0) {
            return base;
          }
          return `${base}&times;10<sup>${exponent}</sup>`;
        }
        return value;
      },
      headerSortTristate: false,
      headerSortStartingDir: "desc",
      sorter:
        formatType === "simple"
          ? function (a, b, aRow, bRow) {
              return aRow.getData()[field] - bRow.getData()[field];
            }
          : undefined,
    };
  }

  // linkNames false shows names as text, for pages where clicking the row selects the commodity
  function tableColumns(locale, formatType, state, linkNames) {
    //You can also pass #index=0 from commodities.html to sector_profile.html
    //But we are not passing index as it may change over time
    const columns = [
      {
        title: "Commodity",
        field: "name",
        formatter: function(cell) {
          const sector = cell.getRow().getData();
          if (linkNames === false) return sector.name;
          // State from the hash since RoUS also needs state= in URL to get the state model.
          // All of the hash's states, e.g. TX,GA, so the next page keeps them.
          const demandHash = `demand=${sector.code}/${sector.location}`;
          const stateParam = state ? `&state=${getHash().state}` : '';
          return `<a href="sector_profile.html#${demandHash}${stateParam}">${sector.name}</a>`;
        }
      },
      {
        title: "Location",
        field: "location",
        hozAlign: "right",
        width: 100
      },
      numberColumn("Output", "output", "115px", locale, formatType),
      numberColumn("Jobs", "jobs", "100px", locale, formatType),
      numberColumn("GHG", "ghg", "120px", locale, formatType)
    ];
    // Add CO2e column only when viewing US data (no state specified)
    if (!state) {
      columns.push(numberColumn("CO2e", "co2e", "110px", locale, formatType));
    }
    return columns;
  }

  // Round row limit buttons, added once for any page using the report
  function addStyles() {
    if (document.getElementById('commodity-row-limits-style')) return;
    const style = document.createElement('style');
    style.id = 'commodity-row-limits-style';
    style.textContent = `
      .commodity-report-footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 16px; margin-top: 8px; clear: both; }
      .commodity-totals { flex: 1 1 300px; min-width: 0; font-size: 0.9em; line-height: 1.5; }
      .commodity-totals-details { margin-left: 4px; }
      .commodity-row-limits { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; margin-left: auto; }
      .commodity-row-limits button { min-width: 34px; height: 34px; padding: 0 8px; border: 1px solid #d9d9d9; border-radius: 999px;
        background: #fff; color: #444; font-size: 13px; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
      .commodity-row-limits button:hover { background: #f5f5f5; border-color: #c7c7c7; color: #111; }
      .commodity-row-limits button.active { background: #0366d6; border-color: #0366d6; color: #fff; }
      .dark .commodity-row-limits button { background: #2f2f2f; border-color: #555; color: #d7d7d7; }
      .dark .commodity-row-limits button:hover { background: #3c3c3c; border-color: #6a6a6a; color: #fff; }
      .dark .commodity-row-limits button.active { background: var(--accent, #3a8fd9); border-color: var(--accent, #3a8fd9); color: #fff; }
      .commodity-table-wrap { position: relative; }
      .commodity-table-wrap .tabulator-row { cursor: pointer; }
      .commodity-table-wrap .tabulator-row.commodity-selected { box-shadow: inset 4px 0 0 #0366d6; background: rgba(3, 102, 214, 0.08); }
      .dark .commodity-table-wrap .tabulator-row.commodity-selected { box-shadow: inset 4px 0 0 var(--accent, #3a8fd9); background: rgba(58, 143, 217, 0.18); }
      /* Triangle outside the table's left edge, pointing at the selected commodity */
      .commodity-pointer { display: none; position: absolute; left: -13px; width: 0; height: 0; transform: translateY(-50%); pointer-events: none;
        border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 9px solid #0366d6; }
      .dark .commodity-pointer { border-left-color: var(--accent, #3a8fd9); }
    `;
    document.head.appendChild(style);
  }

  // Key matching a row to a demand hash value, e.g. 1111A0/US-GA
  function rowKey(row) {
    return `${row.code}/${row.location}`;
  }

  // options: table and loading element ids, rows (0 for all), onRender(rows) after each render,
  // filter(row) for the rows the table lists (totals use all rows), linkNames (false for plain names),
  // and to make rows selectable: onRowClick(row, selected) and selected(), the selected row's code/location
  function create(options) {
    addStyles();
    const report = {
      rows: [],          // All commodities for the current model
      limit: options.rows || 0,
      table: null,
      tableBuilt: false,
      pending: false,
      modelName: null,
      run: 0,
      regions: [],       // Totals for the State and Rest of US, or the US
      detailsOpen: false
    };
    const tableEl = document.getElementById(options.table);
    const loadingEl = options.loading ? document.getElementById(options.loading) : null;

    // Below the table: the totals on the left, and at the right, round buttons for
    // 5, 10, 20, 50 and the row total for all
    const footerEl = document.createElement('div');
    footerEl.className = 'commodity-report-footer';
    const totalsEl = document.createElement('div');
    totalsEl.className = 'commodity-totals';
    const limitsEl = document.createElement('div');
    limitsEl.className = 'commodity-row-limits';
    limitsEl.setAttribute('role', 'group');
    limitsEl.setAttribute('aria-label', 'Commodities to show, ranked by Output');
    footerEl.appendChild(totalsEl);
    footerEl.appendChild(limitsEl);
    tableEl.insertAdjacentElement('afterend', footerEl);

    // Selectable rows get a left bar and a triangle beside the selected one
    let pointerEl = null;
    if (options.onRowClick) {
      const wrapEl = document.createElement('div');
      wrapEl.className = 'commodity-table-wrap';
      tableEl.insertAdjacentElement('beforebegin', wrapEl);
      pointerEl = document.createElement('span');
      pointerEl.className = 'commodity-pointer';
      pointerEl.setAttribute('aria-hidden', 'true');
      wrapEl.appendChild(pointerEl);
      wrapEl.appendChild(tableEl);
      window.addEventListener('resize', positionPointer);
    }
    // Details expands the totals and leaves only the active row button, which closes them again
    totalsEl.addEventListener('click', e => {
      if (!e.target.closest('.commodity-totals-details')) return;
      e.preventDefault();
      report.detailsOpen = true;
      renderFooter();
    });
    limitsEl.addEventListener('click', e => {
      const button = e.target.closest('button');
      if (!button) return;
      if (report.detailsOpen) {
        report.detailsOpen = false;
        renderFooter();
        return;
      }
      report.limit = Number(button.dataset.rows);
      render();
    });

    function renderFooter() {
      totalsEl.innerHTML = report.regions.length ? totalsHtml(report.regions, report.detailsOpen) : '';
      footerEl.style.alignItems = report.detailsOpen ? 'flex-start' : '';
      const count = listedRows().length;
      const shown = shownLimit();
      const buttons = rowLimits.filter(n => n < count).map(n => ({ rows: n, label: n, title: `Top ${n} by Output` }))
        .concat({ rows: 0, label: count, title: `All ${count} commodities` });
      limitsEl.innerHTML = buttons
        .filter(b => !report.detailsOpen || b.rows === shown)
        .map(b => `<button type="button" data-rows="${b.rows}" class="${shown === b.rows ? 'active' : ''}" title="${report.detailsOpen ? 'Close details' : b.title}">${b.label}</button>`)
        .join('');
      footerEl.style.display = count ? '' : 'none';
    }

    // Rows the table lists, e.g. without Rest of US
    function listedRows() {
      return options.filter ? report.rows.filter(options.filter) : report.rows;
    }

    // The chosen limit, or 0 (all) when the table lists no more rows than the limit
    function shownLimit() {
      return report.limit && report.limit < listedRows().length ? report.limit : 0;
    }

    // Top rows by Output, or all listed rows in the model's order
    function shownRows() {
      const limit = shownLimit();
      if (!limit) return listedRows();
      return listedRows().slice().sort((a, b) => b.output - a.output).slice(0, limit);
    }

    function isSelected(row) {
      return !!options.selected && options.selected() === rowKey(row);
    }

    // Outline the selected row, then move the triangle beside it
    function markSelected() {
      if (!report.table || !report.tableBuilt || !pointerEl) return;
      report.table.getRows().forEach(row => {
        const el = row.getElement();
        if (el) el.classList.toggle('commodity-selected', isSelected(row.getData()));
      });
      positionPointer();
    }

    // Hide the triangle when no row is selected, or the selected row is scrolled out of view
    function positionPointer() {
      if (!pointerEl) return;
      const rowEl = tableEl.querySelector('.tabulator-row.commodity-selected');
      const holderEl = tableEl.querySelector('.tabulator-tableholder');
      if (!rowEl || !rowEl.offsetHeight) { pointerEl.style.display = 'none'; return; }
      const rowRect = rowEl.getBoundingClientRect();
      const middle = rowRect.top + rowEl.offsetHeight / 2;
      if (holderEl) {
        const holderRect = holderEl.getBoundingClientRect();
        if (middle < holderRect.top || middle > holderRect.bottom) { pointerEl.style.display = 'none'; return; }
      }
      pointerEl.style.top = `${middle - pointerEl.parentElement.getBoundingClientRect().top}px`;
      pointerEl.style.display = 'block';
    }

    function render() {
      // Wait for load() so an empty table is never rendered
      if (!report.rows.length) return;
      const state = getModelState();
      const columns = tableColumns(getCurrentLocale(), getCurrentNumberFormat(), state, options.linkNames);
      const data = shownRows();
      renderFooter();

      // Create the Tabulator instance once, then update it in place to avoid a blank flash
      if (!report.table) {
        report.table = new Tabulator(tableEl, {
          maxHeight: 500,
          data: data,
          layout: "fitColumns",
          columns: columns,
          rowFormatter: row => {
            if (pointerEl) row.getElement().classList.toggle('commodity-selected', isSelected(row.getData()));
          }
        });
        if (options.onRowClick) {
          report.table.on("rowClick", (e, row) => options.onRowClick(row.getData(), isSelected(row.getData())));
          // Rows move when the table renders, sorts, resizes or scrolls
          report.table.on("renderComplete", positionPointer);
          report.table.on("scrollVertical", positionPointer);
        }
        report.table.on("tableBuilt", function() {
          report.tableBuilt = true;
          if (loadingEl) loadingEl.style.display = 'none';
          if (report.pending) {
            report.pending = false;
            render();
          }
        });
      } else if (!report.tableBuilt) {
        report.pending = true;
      } else {
        report.table.setColumns(columns);
        report.table.replaceData(data);
      }
      if (options.onRender) options.onRender(report.rows);
    }

    // Loads the current model's commodities, then renders. Reuses the rows while the model is unchanged.
    async function load() {
      const modelName = getModelFolderName();
      if (modelName === report.modelName && report.rows.length) {
        render();
        return;
      }
      const run = ++report.run;
      try {
        const rows = await loadRows(model);
        // A newer hash change started another load; let it render instead
        if (run !== report.run) return;
        report.rows = rows;
        report.modelName = modelName;
        console.log("Commodities loaded, length:", rows.length);
        report.regions = regionTotals(rows, getModelState());
        render();
      } catch (error) {
        console.error("Error loading commodities:", error.stack);
        if (loadingEl) {
          loadingEl.innerHTML = '<div style="color: red;">Error loading data. Please try again.</div>';
          loadingEl.style.display = 'block';
        }
      }
    }

    return {
      load: load,
      render: render,
      markSelected: markSelected,
      rows: () => report.rows
    };
  }

  return { create: create };
})();
