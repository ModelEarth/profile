# Plan: Footprint sections as common .js for earthscape.js and engine/index.html

## Goal

Embed the footprint report's charts on [engine/index.html](../../engine/index.html), next to the
charts that [localsite/js/earthscape.js](../../localsite/js/earthscape.js) already provides. To do that,
the sections built inline in `profile/footprint/index.html` become common .js that any page can call
with a div and a few options.

Sections to move, as they are named in the page's script today:

| Section | Element ids | Inline code in index.html |
|---|---|---|
| Matrix (treemap and table) | `#matrixSection`, `#matrixToolbar`, `#matrixTreemap`, `#matrixInfo`, `#matrixTable` | `loadMatrixData()` through `renderMatrixTreemap()`, `watchTreemapLook()`, and the `matrix*` / `matrixTreemap*` globals |
| Impacts chart | `#indicatorToolbar`, `#indicatorParts`, `#indicatorBarChart`, `#impactPointer` | `indicatorFlowImpacts()`, `setupIndicatorParts()`, `displayTable()`, `indicator*` globals, and the impacts part of `main()` |
| Data sources | `#dataSourcesSection`, `#dataSourcesTable` | `loadDataSources()` |
| Page wiring | `#profileTopBar`, `#info` | `main()`, `hashChangedUseeio()`, `showNationalModel()`, `initializeDropdownsAndEvents()` |

## Done first: a shared layout template (2026-11-15)

A simpler step than the section factories below, so engine/index.html shows the footprint now:

- `template-footprint.html`: the page's markup and styles in `#template-footprint`, split into sections
  with their margins at the bottom: `#tradeVizSection`, `#placeSection`, `#industriesSection`,
  `#supportingSection`, `#impactsSection`, `#matrixSection`, `#dataSourcesSection` and `#aboutSection`.
- `js/footprint.js`: the page's former inline script.
- `js/footprint-layout.js`: `loadFootprintLayout(holder, { sections })` loads the template, then
  Tabulator, ECharts, useeio.js, trade-viz-links.js, config.js, commodities-report.js,
  supporting-industries.js, impact-sets.js and footprint.js in order.
- A menu with checkmarks at the top right (`#footprintWidgetList`, like `#widgetList` in
  localsite/info/template-charts.html) shows and hides each section with the `footprint-hidden` class.
- profile/footprint/index.html shows every section. engine/index.html shows only `#matrixSection`, after
  the NISAR paragraph.

The factories below would still let two copies share a page and remove the page globals.

## Current state (2026-11-15)

Common .js that the page already uses. **Keep these where they are.**

- `js/useeio.js`: the USEEIO model library (`useeio.modelOf`, `SectorAnalysis`). It is shared by every
  page in this folder.
- `js/config.js`: model selection (`getModelYear`, `getModelState`, `getModelFolderName`,
  `getModelKey`, `getModel`), the year, locale and number-format dropdowns, and `formatNumber`. The
  other footprint pages use it too (commodities, naics, demands, model, calculation and others).
- `js/commodities-report.js`: `CommoditiesReport.create({...})`. This is already the factory pattern
  this plan copies for the other sections. It is shared with `commodities.html`.
- `../item/js/supporting-industries.js`: `createSupportingIndustriesPanel({...})`, shared with the
  product label (`profile/item`).
- `/localsite/js/impact-sets.js`: `addImpactSetSelect()` and `impactSetIncludes()`. It is already in
  localsite and loaded by localsite.js.

### Model year (added 2026-11-15)

- The `year` hash parameter (`#year=2020`) picks the folder in `useeio-json/models/{year}`. The
  dropdown is `#year-select`, set up by `setupModelYearSelect()` in config.js. It follows the
  guidance in localsite/AGENTS.md:
  - Choosing a year calls `goHash({year})`.
  - `hashChangedUseeio()` rebuilds `model`.
  - A `hashChangeEvent` listener keeps the dropdown in step when the user presses Back.
- `USEEIO_MODEL_YEARS = ['2020']` lists the years. It is the only year folder in useeio-json with
  JSON models (`models/2018` holds just `2018CEEIO.xlsx`). A year in the hash that is not on the list
  falls back to the newest year.
- Within `models/2020`, the data years differ by model:
  - The 50 state models (`XXEEIOv1.0-s-20`) use 2020 data and 2020 demand vectors.
  - The national model `USEEIOv2.0.1-411` uses 2012 demand vectors.
  - The page's "based on 2012_US_Consumption_Complete" line shows this. It should be stated next to
    the dropdown once a second year exists.
- Not yet year-aware:
  - `../item/js/supporting-industries.js` (`USEEIO_STATE_MODEL_ENDPOINT` is fixed at 2020, and its
    Exiobase option at 2019).
  - `states.html`, which reads `/useeio-json/models/2020`.

## Approach

### Exiobase (UN) in the matrix section (added 2026-11-15)

- The matrix toolbar has the same UN / EPA toggle as the Top 10 panel. Both use `sourceButtonsHTML()`
  from `../item/js/supporting-industries.js`, and both are kept in step by
  `setSupportingIndustriesSource()`:
  - it writes `source=un` to the hash quietly;
  - it fires a `supportingIndustriesSource` event on `document`.
- UN builds the treemap and table from `exiobaseStateFlows(state, targets, direction)`, the same state
  split of `trade-us.csv` that ranks the Top 10. Its regions are the state, Rest of US and Foreign.
- Suppliers' impacts are each supplier's own direct factors on the purchase. Buyers' impacts are each
  buyer's direct factor per euro times what it spends.
- The trade tables have no industry outputs, so UN has no Per $1 view. Its Impact view covers only the
  indicators with an Exiobase factor: GHG, LAND, WATR, MNRL and JOBS.
- The impacts bar chart stays EPA, for the same reason: it is per $1 of output.
- The toggles list UN first. When UN can't show a sector, its hover text gives the reason.
  - For a sector with no Exiobase industry (e.g. 42 Wholesale, 562 Waste management), UN stays
    clickable and `exiobaseBarrierHTML()` explains why. It links to the sectors that show related Exiobase
    industries in UN: industries holding part of the sector, hand-picked ones
    (`EXIOBASE_RELATED_BY_SUMMARY`) and ones with a similar name.
  - For the national model or another region's commodity, UN is greyed out (no related sectors to link).
  - The Top 10 panel shows the full explanation, and `#matrixBarrier` points to it.
- The commodity table has the toggle too. UN lists the Exiobase industries for the US and each
  state in the hash:
  - The rows come from `exiobaseCommodityRows(year, states)`.
  - They go through the same `CommoditiesReport.create()`, using its new `loadRows`, `columns`,
    `regionTotals` and `totalsLine` options.
  - Its sources go through `renderDataSourcesTable()`, shared with the Data Sources section.
- UN years run from 2018 to 2024. The `#year-select` dropdown lists them when UN is on, using the
  same `year=` hash parameter.
  - The commodity list reads each year's domestic `trade.csv` and `trade_factor.csv`.
  - The Top 10 and matrix use the nearest year with state tables (2019 or 2022).
  - 2023 and 2024 have no greenhouse gas or jobs factors.
  - Year status: exiobase/tradeflow/.
- When the matrix section moves to `earthscape-footprint.js`, it keeps calling these
  supporting-industries.js functions rather than copying them.

### All industries of a place (added 2026-11-15)

- With no `demand` in the hash, the page shows all the industries of a place, from
  `footprintRegion()`:
  - `country=all` is the World; another country (`country=CN`) comes before a state;
  - otherwise the first state, or the US.
- A country or the World always shows UN. EPA's buttons are hidden there
  (`markEpaAvailability`), and `showsExiobase()` in config.js returns true.
- The page no longer selects the top commodity. Clicking the selected commodity again returns to
  the whole place.
- EPA, in `epaRegionData()`:
  - Industries = D × q over the place's industries.
  - Consumption = N × y, using the model's Consumption Complete demand vector.
  - The treemap sizes industries by output (q) or by one indicator's D × q.
- UN, in `unRegionData()`:
  - Totals are the factors on the place's domestic flows.
  - A "Largest shares" bar and column show the top regions (World) or industries.
  - The treemap sizes industries by sales or by one factor. The World splits each tile into its
    14 regions.
- World:
  - It adds up `EXIOBASE_PROCESSED_REGIONS`: 13 countries and Rest of Middle East.
  - `EXIOBASE_WORLD_COVERAGE` holds their 2018 shares of the world (all 49 regions that year):
    78.9% of within-country industry sales, 83.9% of GHG and 68.4% of jobs.
  - A country without its own Exiobase region uses the Rest of World region holding it, from
    `concordance/exio_country_concordance.csv`.
  - Countries outside the 14 show for 2018 only.
- For the move to `earthscape-footprint.js`:
  - The place's views reuse the matrix section's toggles, table and treemap.
  - The direction toggle and Per $1 are hidden there (`setRegionModeUI`), and the list key is
    `region-*`.

### 1. Where the common .js lives

earthscape.js is the Data Commons timeline and year-file table loader. Its functions are
`loadEarthScape(my)`, `loadEarthScapeYears(my)`, `getTimelineChart()` and the Tabulator and D3
loaders. Adding about 1,200 lines of USEEIO code to it would make every timeline page download code
it never uses.

The plan:

- **New file `localsite/js/earthscape-footprint.js`.** It holds the section factories:
  `FootprintMatrix.create()`, `FootprintImpacts.create()` and `FootprintSources.create()`. It also
  holds one entry point, `loadFootprintSections(my)`. That entry point takes the same style of `my`
  options object that `loadEarthScape(my)` takes.
- **A thin hook in earthscape.js:** `loadEarthScapeFootprint(my)`. It lazy-loads the new file and its
  dependencies, then calls `loadFootprintSections(my)`. It works the way `earthscape_loadTabulator()`
  does today. Pages that already include earthscape.js then get footprint charts with one call.
- **Add `earthscape_loadECharts()`** next to `earthscape_loadTabulator()`. The treemap needs ECharts
  5.4.3, which engine/index.html does not load.

**Why localsite and not profile/footprint/js:**
- engine/index.html already loads localsite.js.
- earthscape.js resolves its loaders from `theroot`.
- localsite is the shared repo that the other site repos already depend on.
- profile/footprint/index.html would load the same file, so there is only one copy.

### 2. Keep or move the existing common .js

| File | Recommendation | Reason |
|---|---|---|
| `profile/footprint/js/useeio.js` | Keep. The new module loads it from `/profile/footprint/js/useeio.js` when `typeof useeio === 'undefined'`. | Every footprint page and `profile/item` use it. Moving it means editing about 10 pages. **Open decision:** move it to `localsite/js/` if engine must work without the profile repo cloned. |
| `profile/footprint/js/config.js` | Keep it, but split it. Move the model-selection functions into the new module as `FootprintModel` (year, state, folder, key, `modelOf`). config.js then calls those, keeping its global names (`getModelYear`, `getModelFolderName`, ...) as wrappers. Its dropdown and format helpers stay where they are. | Engine needs model selection but not the locale and number-format dropdowns. The global names keep commodities.html and the other pages working unchanged. |
| `js/commodities-report.js` | Keep. Optionally have the new module load it for a commodities section on engine. | It is already a factory. It only needs `model` and `getModelKey` passed in, rather than read as globals (step 3). |
| `item/js/supporting-industries.js` | Keep. | The product label owns it, and it is already a factory. |
| `localsite/js/impact-sets.js` | Keep. | It is already in localsite. |

### 3. Rules for each section factory

These follow the `CommoditiesReport.create()` pattern:

- **`create({ element, ...options })`** takes a container element or selector. The factory builds its
  own markup: toolbar, treemap div, info line and table div. A host page then needs only one
  `<div>`, and the ids are scoped inside the container. This allows two instances on one page and
  avoids clashes with engine's ids.
- **No page globals.** State such as `matrixLists`, `matrixRank`, `matrixImpact`, `matrixTable` and
  `matrixTreemapChart` moves into the factory's closure. Each section gets the model and sector from
  a context object passed to `show(ctx)`:
  `ctx = { model, modelKey, year, state, sector, analysis, demandId }`.
  This matters on engine: its commented-out widget code declares a global `var model`, and
  earthscape.js already has globals named `timelineChart` and `lineAreaChart`.
- **Methods:** `show(ctx)`, `hide()`, `redraw()` (for locale and number-format changes) and
  `destroy()`.
- **Run token.** Each `show()` keeps its own run token, as `main()` does with `mainRun` and
  CommoditiesReport does with `report.run`. A slow load from an earlier hash is then dropped.
- **Shared links between sections go through callbacks.** For example, the impacts chart's
  selected indicator drives the treemap's Impact view (`selectMatrixImpact`). Pass
  `onIndicatorSelect` from the impacts section, and have the matrix section expose `setImpact()`.
  Neither section reads the other's globals.
- **CSS:** move the `#matrix*`, `#indicator*` and `.matrix-toggle` rules from the page's `<style>`
  into `localsite/css/earthscape-footprint.css`. Scope them under a section class, not page ids. Keep
  the dark-mode rules.
- **Hash:** sections read the hash only through the context. The page (or `loadFootprintSections`)
  owns the single `hashChangeEvent` listener for `year`, `state`, `demand` and `set`. It uses
  `window.priorHash` to skip reloads when none of those keys changed.

### 4. Steps

1. **Model selection into the module.**
   - Move `FootprintModel` (year list, `getModelYear`, `getUseeioJsonEndpoint`, state, folder, key,
     `modelOf`) into `earthscape-footprint.js`.
   - config.js keeps its wrappers.
   - Point `supporting-industries.js` at `getModelYear()` when that function is defined.
2. **Data sources.** It is the smallest section (`loadDataSources`), so do it first to prove the
   pattern: factory, markup and CSS move, then index.html calls `FootprintSources.create()`.
3. **Matrix section.**
   - Move `loadMatrixData()`, the list builders, the toggles, the table columns, the treemap
     (`treemapSquarify`, `renderMatrixTreemap`, resize and animation) and `watchTreemapLook()`.
   - `showMatrixSector(code)` becomes an `onSectorClick` option. The footprint page passes
     `goHash({demand})`, and engine can do the same.
4. **Impacts chart.**
   - Move `indicatorFlowImpacts()`, the parts toolbar, `displayTable()` with its narrow layout,
     and the impact set dropdown wiring.
   - The Energy-to-national switch (`showNationalModel`) stays a page option (`onImpactSet`).
     Engine may not want it.
5. **Thin page.**
   - profile/footprint/index.html keeps the layout, the commodities report, supporting industries,
     the all-industries message and one `main()`.
   - `main()` resolves the sector and `SectorAnalysis` once, then calls each section's `show(ctx)`.
   - The goal is to cut the inline script from about 1,600 lines to under 300.
6. **Engine embed.**
   - Add `<div id="footprintSections"></div>` to engine/index.html, then call
     `loadEarthScapeFootprint({ elementID: 'footprintSections', sections: ['impacts', 'matrix'] })`.
   - Engine already listens for `state` in its own `hashChangeEvent`, so the footprint charts follow
     the same `state` hash.
   - With no `demand` in the hash, show the state's top commodity, as `getTopSector()` does now.
   - Optional: a `year-select` there, using the same `setupModelYearSelect()`.
7. **More years.**
   - When useeio-json publishes another year folder, add it to `USEEIO_MODEL_YEARS`.
   - Better: read a small `models/years.json` (or list the folders with `models.json` in each), so
     no code edit is needed.
   - Label the national model's 2012 data year beside the dropdown.

### 5. Checks after each step

- profile/footprint/index.html works with all of these hashes, plus Back and Forward between them:
  - none
  - `#state=GA`
  - `#state=GA&demand=...`
  - `#set=energy`
  - `#year=2020`
  - an unknown `#year=2018`
- The matrix toggles (Suppliers / Buyers, Total Spent / Per $1 / Impact) and clicking an impacts row
  update the treemap.
- Dark mode, and the narrow layout of the impacts table.
- commodities.html and the product label (`profile/item`) behave as before.
- engine/index.html: changing state reloads the footprint sections without reloading the DataUSA
  iframes twice.

## Issues found (2026-11-15)

Found while adding the UN years, countries and the World, and checking them in the browser at
`#state=GA`, `#country=CN`, `#country=all`, `#country=SA` and `#country=ES`.

### Exiobase data (trade-data and the exiobase/tradeflow pipeline)

Fixing these belongs in the pipeline. The page shows the files as they are.

- **Totals jump from 2021.**
  - US domestic flows: €12.0T in 2020, then €21.9T (2021), €29.3T (2022) and €33.6T (2024).
  - In dollars that's $13.7T, $25.9T, $30.9T and $36.4T.
  - The 14-region World goes from $52T (2019) to $85.9T (2024).
  - World metals and minerals go from 81.8 Gt (2019) to 105.9 Gt (2024).
- **2023 and 2024 have materials only.** Their `trade_factor.csv` files hold factor 909 and
  nothing else, so there's no GHG, jobs, land or water.
- **GHG looks overstated for China.**
  - China's 2019 domestic flows carry 23.2 Gt of GHG, about twice China's actual total emissions.
  - Basic iron and steel (BASIC) alone carries 2.97 Gt.
  - The US is lower than its actual total (3.5 Gt against about 6 Gt), as expected for
    industry-to-industry flows only.
- **Grid sectors carry large GHG.** In China, electricity distribution (DISTR, 1.69 Gt) and
  transmission (TRAN1, 652 Mt) sit next to coal power (ELEC1, 4.63 Gt). Generation emissions may
  be counted again on the grid sectors.
- **Land is larger than the land.** US land on domestic flows sums to 13.5M km², more than the
  US land area of 9.8M km². The 14-region World sums to 79.8M km².
- **Water is high for Rest of Middle East.** WM's domestic flows carry 627B m³, 33% of the
  World's water.
- **State tables exist for 2019 and 2022 only.** Those are `trade-us.csv`,
  `industry_category.csv` and `category_state.csv`. Other years borrow the nearest one's state
  weights.
- **Only 14 regions after 2018.** 2018 has all 49 Exiobase regions; later years have the default
  14. Nothing in trade-data lists a year's regions, so the page hardcodes
  `EXIOBASE_PROCESSED_REGIONS`. A small `year/{year}/regions.json` would let it read them instead.
- **Stray 2023 folder.** `year/2023/default/` holds domestic and exports files, likely from a run
  with `COUNTRY.list: default` writing to a folder named "default".
- **Bad concordance row.** In `concordance/exio_country_concordance.csv`, DR Congo's ISO code is
  "rCD" and its name is cut off, so `country=CD` finds no region.
- **Exports are too large for the browser.** The exports files are about 180 MB per year. The
  World view therefore covers trade within each region only, and the coverage note says so.
- **National model uses 2012 data.** The USEEIO national model (USEEIOv2.0.1-411) uses 2012
  demand, while the state models use 2020 data.

### Page

- The World's commodity footer lists all 15 places (World and 14 regions). It's long but wraps.
- World treemap tiles list up to 14 region lines. Small tiles show as many as fit.
- Fixed: the year dropdown widened for UN, since 2023 and 2024 read "(amounts only)". The years are now plain,
  and a note under the impacts chart (`#indicatorYearNote`) says which factors the year lacks, linking to
  trade-data/year/{year} and the exiobase/tradeflow overview.
- Fixed: a country outside the US or the World hides localsite's US Regions, US Map and state menu, and a
  country dropdown (`#footprintCountry`, from localsite's `loadCountryNames()` and countries-full.csv) shows
  the hash's first country. localsite's location menu lists the 13 countries with yearly Exiobase data
  beside "Countries" (`window.geoviewCountries`). The hash's first country now decides the place
  (country=IN,US is India).
- Fixed while checking:
  - The Largest column cut off its text. The largest regions or industries now sit on a line of
    their own under each indicator, spanning the table, by name with the code after it, e.g.
    "Electricity by coal (ELEC1) 17%".
  - A country inside a Rest of World region is now headed with that region, e.g. "Saudi Arabia
    (Rest of Middle East)".
  - The description names only the factors the year has.
  - A place missing from the year's files shows only its note.
  - An Impact indicator picked automatically (materials for 2024) no longer sticks after the
    year changes.
