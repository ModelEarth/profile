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
  from this page's comparison — but check its
  [Releases](https://github.com/cornerstone-data/supply-chain-factors/releases) for a
  newer prebuilt CSV before the next time that xlsx needs refreshing.

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
