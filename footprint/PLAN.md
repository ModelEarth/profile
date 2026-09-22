# Plan: BEA Sector Import Factors report

## Current state (2026-09-22)

`index.html`'s "BEA Sector Import Factors" view computes kg-per-USD import
emission factors by BEA Detail sector from this site's own `trade.csv` /
`trade_factor.csv` (US imports), joined to BEA Detail codes via EPA's own
[Exiobase→BEA concordance](https://github.com/USEPA/USEEIO/blob/master/import_emission_factors/concordances/exio_to_useeio2_commodity_concordance.csv),
and compared against EPA's published
[US_detail_import_factors_exiobase_2019_17sch.csv](https://github.com/USEPA/USEEIO/tree/master/import_emission_factors/output)
(2019 only — that's the only year EPA's archived repo publishes).

Validated 2026-09-21 against 295 matched (BEA Detail, flow) pairs:

- **Carbon dioxide**: median ratio (ours/EPA) ~0.9, 85% within 2x — a good independent
  reproduction using totally different code.
- **Methane / Nitrous oxide**: systematically low (median ratios ~0.008 and ~0.16).
  Root-caused to a weighting-methodology difference, not a bug — spot-checked
  Russia's crude-petroleum sector, where our CH4 coefficient (28.19 kg/M€) matched a
  from-scratch independent pymrio recomputation (28.187 kg/M€) almost exactly. We
  weight each BEA sector by Exiobase's own bilateral trade-dollar amounts; EPA
  weights by official Census import-share statistics plus a more elaborate
  MRIO-sector-to-BEA-Detail averaging step (see EPA's `generate_import_factors.py`).
  CH4/N2O vary far more by exporting country than CO2 does, so the weighting choice
  moves those two flows much more.

## Improvement ideas

### Close (or at least narrow) the CH4/N2O weighting gap

Replicate more of EPA's own weighting pipeline instead of a flat trade-dollar sum:
pull in Census/BEA import-share data (or at minimum weight by a longer trade-value
average across years, which should dampen single-year Exiobase bilateral-trade
noise) before collapsing MRIO sectors into a BEA Detail figure. EPA's
`generate_import_factors.py` + `generate_import_shares.py` in the USEEIO repo is the
concrete reference implementation to port from.

### Add BEA Summary-level rollup

Ship the coarser ~71-sector Summary view alongside Detail (deferred from v1 per the
2026-09-21 decision to start with Detail only). Needs one more rollup step
(Detail→Summary), not yet built — EPA's own `BEA_service_to_useeio2_sector_concordance.csv`
or the Detail codes' first-N-digit prefix convention can drive it.

### Add Regional-level comparison

We currently only compare against EPA's `US_detail_import_factors` (a single national
number per sector). EPA also publishes `Regional_detail_import_factors` (7 world
regions: APAC, EU, ROW, etc., via `country_to_region_concordance.csv`). Our own
trade data already has full per-country granularity, so rolling up to those same 7
regions and comparing region-by-region would isolate *which* countries/regions drive
the CH4/N2O gap, rather than only seeing the already-blended national number.

### Watch Cornerstone — the actively maintained successor to USEEIO/EPA's import-factor work

USEPA's own `import_emission_factors` script (`generate_import_factors.py`) already
defaults to `source = 'gloria'`, not `exiobase` — i.e. even EPA's own archived repo
has moved on from Exiobase as its primary MRIO. Worth evaluating whether
[GLORIA](https://github.com/USEPA/USEEIO/blob/master/import_emission_factors/download_gloria.py)
has better GHG/extension completeness than our Exiobase 2019 data (which is missing
the `energy` extension entirely and has all-NaN SF6/HFC/PFC — see
`exiobase/tradeflow/README.md`'s "Two known data gaps" note) before assuming Exiobase
is the ceiling.

The real successor project is [cornerstone-data](https://github.com/cornerstone-data)
(USEPA's own USEEIO/useeior work "now continues" there, per that org's repos):

- **[`bedrock`](https://github.com/cornerstone-data/bedrock)** — the active pipeline
  (commits daily), merging USEEIO + CEDA-US into a "Cornerstone U.S. model," working
  toward a full **global MRIO model targeted for release October 2026** — a month out
  from this writing. That global release, not `bedrock`'s current US-only merge, is
  the eventual direct replacement for what Exiobase does for this site today.
  Its trade-transform config already reaches 2017–2024
  (`bedrock/transform/trade/Trade_Imports_2024.yaml`), well past EPA's 2019-only
  public file. **Nothing to integrate yet, though**: `bedrock`'s own README says
  "EEIO matrices for each `bedrock` release will be uploaded at a future date for
  sharing," and running the pipeline itself requires GCP authentication — there's no
  public downloadable output today. Revisit around/after October 2026.
- **[`supply-chain-factors`](https://github.com/cornerstone-data/supply-chain-factors)**
  — the actively maintained successor to the standalone "Supply Chain GHG Emission
  Factors" R tool/spreadsheet. This repo already keeps a stale local copy of the old
  EPA output at `profile/footprint/SupplyChainGHGEmissionFactorsv1.4.0-rc.1.xlsx`.
  Note this tool computes *domestic* US cradle-to-shelf factors by BEA sector, not
  country-of-origin import factors, so it's a different (complementary) data product
  from this page's comparison.

  **Checked 2026-09-22 for a newer release**: v1.4.0 (final, not the rc.1 we have)
  [published 2025-10-15](https://github.com/cornerstone-data/supply-chain-factors/releases/tag/v1.4.0),
  factors in 2024 USD using 2023 GHG data. Final files are on
  [Zenodo](https://doi.org/10.5281/zenodo.17202747), not GitHub Releases assets:
  `SupplyChainGHGEmissionFactorsv1.4.0.xlsx` (the file to replace our rc.1 copy with)
  plus a bonus `USEEIOv2.6.0-phoebe-23.rds` — cornerstone's own complete USEEIO model
  object for this build (see the pre-compiled-indicators section below).

  **Don't swap the file in without also fixing `commodities.html`'s parser** — the
  workbook structure changed between rc.1 and the v1.4.0 final, confirmed by
  downloading both and diffing their first sheet:
  - rc.1's first sheet (`CO2e`) had a `Reference USEEIO Code` column and a combined
    `Supply Chain Emission Factors with Margins` column — exactly what
    `commodities.html`'s `main()` looks for (`headerRow.indexOf('Reference USEEIO
    Code')` etc., around line 74).
  - v1.4.0 final's `CO2e` sheet dropped both: it's now keyed by `2017 NAICS Code`
    only (no USEEIO code), and the combined margin column split into
    `Supply Chain Emission Factors without Margins` + `Margins of Supply Chain
    Emission Factors` separately.
  - `Reference USEEIO Code` and the combined `...with Margins` column still exist,
    but only on the second sheet (`byGHG`) — and only per individual gas (HFC-227ea,
    Carbon dioxide, ...), not as an `All GHGs` aggregate row anymore, so getting the
    single CO2e-equivalent total per USEEIO code now needs summing `byGHG` rows
    (or a NAICS→USEEIO crosswalk applied to the `CO2e` sheet) instead of one direct
    header lookup.
  - Net effect if the file were swapped in as-is: `co2eData` silently ends up empty
    (the existing `try/catch` swallows it — see console.warn at line 94), so every
    row's `co2e` column would silently show 0, not an error. Needs a real parser
    update, not just a filename change.

### Pre-compiled indicators for the other five extensions — use these instead of pulling BLS/EIA/USDA/USGS directly

For `employment`/`energy`/`land`/`material`/`water`, USEEIO's own indicators (JOBS,
ENRG, LAND, MNRL, WATR) are computed by EPA/Cornerstone from separate US government
inventories (BLS jobs, EIA energy, USDA land, USGS water/minerals), not from Exiobase
— see `exiobase/tradeflow/bea/README.md`'s "Beyond GHGs" section. Rather than
integrating those four agencies' raw data ourselves, EPA's own model exports already
carry the computed per-sector results — found while checking the supply-chain-factors
release above (2026-09-22):

- **Already wired into this codebase, just not cloned locally**:
  `profile/footprint/js/config.js`'s `getModel()` points `useeio.modelOf()` at
  `/useeio-json/models/2020` — a sibling repo this workspace doesn't currently have.
  [`ModelEarth/useeio-json`](https://github.com/ModelEarth/useeio-json) is our own
  org's copy, and its `models/2020/USEEIOv2.0.1-411/` folder already has
  `indicators.json` (23 indicators, confirmed includes JOBS/ENRG/LAND/MNRL/WATR) plus
  full `matrix/N.json` and `matrix/D.json` — per-BEA-Detail-sector results for all of
  them, pre-computed, ready to `fetch()` the same way `commodities.html` already
  fetches `indicators()`/`matrix('D')` for JOBS today. Cloning this repo as a sibling
  of `webroot` (per `config.js`'s comment: "clone the useeio-json repo into the same
  webroot") would make ENRG/LAND/MNRL/WATR available with no new data pipeline.
  Caveat: `USEEIOv2.0.1-411` is 2012 USD/economic-data basis — old relative to our
  2018-2024 Exiobase years.
- **Newer EPA builds exist but don't help here**: EPA's
  [USEEIO v2.5 models](https://catalog.data.gov/dataset/useeio-v2-5-models)
  (2017-2022, built for the 2024 import-emission-factors report, aliases like
  `kingbird`/`yellowthroat` at `pasteur.epa.gov`) were checked 2026-09-22 and only
  carry GHG + Material Footprint indicators (`GHG`, `MF-Bio`, `MF-Fossil`, `MF-Metal`,
  `MF-Mineral`) — JOBS/ENRG/LAND/WATR aren't in these exports at all, so they're not
  a fresher substitute for the pre-compiled indicators above, only for GHG/materials.
- **Cornerstone's own newer full model, unverified**: the `USEEIOv2.6.0-phoebe-23.rds`
  bundled with the v1.4.0 supply-chain-factors release above (2024 USD/2023 GHG data —
  much newer than 2012) is cornerstone's own current build and the best candidate to
  eventually replace `USEEIOv2.0.1-411` with, but it's an R `.rds` object — this
  environment has no R/`pyreadr` to open it and confirm its indicator list still
  includes JOBS/ENRG/LAND/MNRL/WATR. Needs checking with R before relying on it.

### Other

- Add the remaining 2 of EPA's 5 output files we haven't touched yet
  (`Regional_summary_import_factors`, `import_shares_2019`) if the Regional/Summary
  work above happens — `import_shares_2019.csv` in particular is EPA's own
  country-contribution weighting and would be the most direct way to actually adopt
  their weighting methodology rather than approximate it.
- `EUR_TO_USD_2019 = 1.1194` (ECB 2019 average) is hardcoded in `index.html` — fine
  for the 2019 comparison this page ships today, but needs a per-year table before
  extending EPA-comparison support past 2019 (not just adding more of our own years,
  which already work with no EPA column).
