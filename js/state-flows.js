// state-flows.js - US state-to-state purchases built from three trade-data tables that
// exiobase/tradeflow/bea/main.py writes (see exiobase/tradeflow/bea/notes.md):
// trade-us.csv holds each Exiobase industry pair's national purchases (origin "us" for US
// producers, "foreign" for imports), industry_category.csv each industry's state_industry_code,
// and category_state.csv each state's share of that code's GDP, as origin and destination weights.
// A US flow from state O to state D is amount * origin weight(O) * destination weight(D), with the
// origin weight for the supplying industry's code and the destination weight for the buyer's.
// Imports are placed in D by the destination weight alone.
// Used by profile/trade/map/state.html and profile/charts/sankey/state.html.

window.StateFlows = (function () {
  var YEAR = "2019";
  var DOMESTIC = "year/" + YEAR + "/US/domestic/";
  var FILES = {
    tradeUs: DOMESTIC + "trade-us.csv",
    industryCategory: DOMESTIC + "industry_category.csv",
    categoryState: DOMESTIC + "category_state.csv",
    stateCodes: DOMESTIC + "state_codes.csv",
    eurRates: "concordance/eur_annual_rates.csv"
  };

  // Each metric sums trade-us.csv columns (amount, or factor_id 901-910 in factor.csv), each
  // times a scale to the metric's unit. Amount is in millions (USD when a rate is found).
  // Greenhouse gases use 100-year global warming potentials, as the product label's UN option does.
  var METRICS = {
    level:      { label: "Amount spent",     unit: "M",            columns: { amount: 1 } },
    ghg:        { label: "Greenhouse gases", unit: "t CO₂ eq", columns: { 901: 0.001, 902: 0.028, 903: 0.265, 904: 23.5, 905: 0.001 } },
    co2:        { label: "Carbon dioxide",   unit: "t CO₂",    columns: { 901: 0.001 } },
    employment: { label: "Jobs",             unit: "jobs",         columns: { 906: 1000 } },
    energy:     { label: "Energy use",       unit: "TJ",           columns: { 907: 1 } },
    land:       { label: "Land use",         unit: "km²",      columns: { 908: 1 } },
    material:   { label: "Material use",     unit: "kt",           columns: { 909: 1 } },
    water:      { label: "Water use",        unit: "m³",       columns: { 910: 1e6 } }
  };
  var METRIC_KEYS = Object.keys(METRICS);

  function parseCsv(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n").filter(Boolean);
    var split = function (line) {
      var values = [];
      var current = "";
      var quoted = false;
      for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"') {
          if (quoted && line[i + 1] === '"') { current += '"'; i++; } else { quoted = !quoted; }
        } else if (c === "," && !quoted) {
          values.push(current.trim());
          current = "";
        } else {
          current += c;
        }
      }
      values.push(current.trim());
      return values;
    };
    var headers = lines.length ? split(lines[0]) : [];
    return lines.slice(1).map(function (line) {
      var values = split(line);
      var row = {};
      headers.forEach(function (header, i) { row[header] = values[i] || ""; });
      return row;
    });
  }

  function number(value) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : 0;
  }

  function zeros() {
    return METRIC_KEYS.map(function () { return 0; });
  }

  function addInto(target, values, factor) {
    for (var i = 0; i < values.length; i++) target[i] += values[i] * factor;
  }

  function byMetric(values) {
    var result = {};
    METRIC_KEYS.forEach(function (key, i) { result[key] = values[i]; });
    return result;
  }

  // US dollars per euro for YEAR from eur_annual_rates.csv, or null
  function parseUsdPerEur(text) {
    var row = parseCsv(text).find(function (entry) { return String(entry.Year).trim() === YEAR; });
    var rate = row ? Number(row.USD) : NaN;
    return isFinite(rate) && rate > 0 ? rate : null;
  }

  // Returns
  //   metricKeys: the metrics with values this year (energy has none in 2019)
  //   rows: one per origin state, destination state and supplying state_industry_code (upper
  //     case), with flow_type intra_state or inter_state and a value per metric
  //   imports: state -> code -> values, imports bought in each state by supplying code
  //   specializations: state -> [{ code, quotient }], codes where the state's share of US GDP
  //     for the code is at least 1.25 times its share of all GDP, largest first
  function build(tradeUsText, industryCategoryText, categoryStateText, usdPerEur) {
    var amountScale = usdPerEur || 1;
    var rowValues = function (row) {
      return METRIC_KEYS.map(function (key) {
        var columns = METRICS[key].columns;
        return Object.keys(columns).reduce(function (sum, column) {
          return sum + number(row[column]) * columns[column] * (column === "amount" ? amountScale : 1);
        }, 0);
      });
    };

    var categoryOf = {};
    parseCsv(industryCategoryText).forEach(function (row) {
      categoryOf[row.industry_id] = String(row.state_industry_code).toUpperCase();
    });

    var weights = { origin: {}, destination: {} };
    var gdp = {};
    parseCsv(categoryStateText).forEach(function (row) {
      var byCode = weights[row.weight_type];
      if (!byCode) return;
      var code = String(row.state_industry_code).toUpperCase();
      var state = String(row.state).toUpperCase();
      (byCode[code] = byCode[code] || {})[state] = number(row.weight);
      if (row.weight_type === "origin") {
        (gdp[state] = gdp[state] || {})[code] = number(row.value);
      }
    });

    // National purchases by supplying code and buying code
    var national = { us: {}, foreign: {} };
    parseCsv(tradeUsText).forEach(function (row) {
      var totals = national[row.origin];
      var code1 = categoryOf[row.industry1];
      var code2 = categoryOf[row.industry2];
      if (!totals || !code1 || !code2) return;
      var byCode2 = totals[code1] = totals[code1] || {};
      addInto(byCode2[code2] = byCode2[code2] || zeros(), rowValues(row), 1);
    });

    // What each destination state buys from a supplying code, summed over the buying codes
    var boughtByState = function (byCode2) {
      var bought = {};
      Object.keys(byCode2).forEach(function (code2) {
        var destination = weights.destination[code2] || {};
        Object.keys(destination).forEach(function (state) {
          addInto(bought[state] = bought[state] || zeros(), byCode2[code2], destination[state]);
        });
      });
      return bought;
    };

    var rows = [];
    Object.keys(national.us).forEach(function (code1) {
      var origin = weights.origin[code1] || {};
      var bought = boughtByState(national.us[code1]);
      Object.keys(bought).forEach(function (destinationState) {
        Object.keys(origin).forEach(function (originState) {
          var flow = bought[destinationState].map(function (value) { return value * origin[originState]; });
          var row = byMetric(flow);
          row.origin_state = originState;
          row.destination_state = destinationState;
          row.state_industry_code = code1;
          row.flow_type = originState === destinationState ? "intra_state" : "inter_state";
          rows.push(row);
        });
      });
    });

    var imports = {};
    Object.keys(national.foreign).forEach(function (code1) {
      var bought = boughtByState(national.foreign[code1]);
      Object.keys(bought).forEach(function (state) {
        (imports[state] = imports[state] || {})[code1] = byMetric(bought[state]);
      });
    });

    var specializations = {};
    var codeTotals = {};
    var grandTotal = 0;
    Object.keys(gdp).forEach(function (state) {
      Object.keys(gdp[state]).forEach(function (code) {
        codeTotals[code] = (codeTotals[code] || 0) + gdp[state][code];
        grandTotal += gdp[state][code];
      });
    });
    Object.keys(gdp).forEach(function (state) {
      var stateTotal = Object.keys(gdp[state]).reduce(function (sum, code) { return sum + gdp[state][code]; }, 0);
      if (!stateTotal || !grandTotal) return;
      specializations[state] = Object.keys(gdp[state]).map(function (code) {
        return { code: code, quotient: (gdp[state][code] / codeTotals[code]) / (stateTotal / grandTotal) };
      }).filter(function (entry) {
        return entry.quotient >= 1.25;
      }).sort(function (a, b) { return b.quotient - a.quotient; });
    });

    var metricKeys = METRIC_KEYS.filter(function (key) {
      return key === "level" || rows.some(function (row) { return row[key] > 0; });
    });

    return { metricKeys: metricKeys, rows: rows, imports: imports, specializations: specializations };
  }

  return {
    YEAR: YEAR,
    FILES: FILES,
    METRICS: METRICS,
    parseCsv: parseCsv,
    parseUsdPerEur: parseUsdPerEur,
    build: build
  };
})();
