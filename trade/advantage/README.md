# Import Dependency and Competitive Advantage

How much each US state relies on suppliers outside the state, and the industries where it holds an advantage over other states. Open the panel at the map's upper left: its States tab ranks every state, and its Filters tab holds the filters. "Show above map" moves the filters out of the panel and over the map. The page remembers the tab you leave open and where the filters are. Choose a map view with the tabs among the trade buttons at the top of the map:

- **Trade flows** (the default) - The [US State Trade Map](../map/state.html): what the focus state buys from and sells to other states. The Import Dependency report appears below the map, and the **Competitive advantage report** toggle adds that report too.
- **Import dependency** (`#report=dependency`) - States shaded by how much they rely on outside suppliers. Lines show the states supplying the most to the focus state. Only the Import Dependency report appears below the map.
- **Competitive advantage** (`#report=advantage`) - States shaded by their specialization or trade balance. Lines show the states buying the most from the focus state. Only the Competitive Advantage report appears below the map.

Changing the view adds a browser history entry, so Back returns to the previous view.

The map fills the window below the search filters. "Open Earth View" in the search filters' menu shows the Earth map (earth.nullschool.net) in its place, and its close-X brings the trade map back.

## Measures

Purchases and sales are split into the seven BEA industry categories. Values use the selected indicator (amount spent, greenhouse gases, jobs and so on), so the shares answer "where do this state's purchases come from" for money or for environmental impacts.

**Import dependency**

| Measure | Definition |
|---|---|
| Foreign import share | Imports from other countries / all purchases |
| Bought outside the state | (Other states + imports) / all purchases |
| Supplier concentration (HHI) | Sum of squared shares of the states supplying it, from near 0 (many states) to 1 (one state) |

**Competitive advantage**

| Measure | Definition |
|---|---|
| Location quotient | The state's share of the industry's US GDP / its share of all US GDP. Above 1, the state specializes in the industry. |
| Interstate trade balance | (Sales to other states - purchases from them) / (the two together), from -100% to +100% |
| Share of US interstate sales | The state's sales to other states / all states' interstate sales |

Concentration and shares follow the state import dependency and export competitiveness definitions in [main\_trade\_analyzer.py](https://github.com/ModelEarth/exiobase/blob/main/tradeflow/bea/main_trade_analyzer.py) and [trade\_competitiveness.py](https://github.com/ModelEarth/exiobase/blob/main/tradeflow/trade_competitiveness.py).

## Data

2019 state-to-state purchases come from [trade-data](https://github.com/ModelEarth/trade-data/tree/main/year/2019/US/domestic): trade-us.csv (Exiobase national purchases), industry\_category.csv and category\_state.csv (BEA GDP by state), through [state-flows.js](../../js/state-flows.js). These are the same flows as the [State Trade Map](../map/state.html) and [State Sankey](../../charts/sankey/state.html). The page loads a trade-data folder in the webroot when there is one, and GitHub's copy otherwise.

The tables use the Tabulator defaults in [localsite/js/earthscape.js](https://github.com/ModelEarth/localsite/blob/main/js/earthscape.js). Use the circle menu on each report to download its table as CSV.
