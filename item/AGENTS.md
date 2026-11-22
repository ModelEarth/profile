# Product Profile Item - Agent Guidelines

## Overview
This directory contains the product impact label system that displays environmental data from YAML files in various visual formats (FDA nutrition-style or badge-style).

## Key Files

### JavaScript
- **label.js** - Main loader that fetches YAML data from GitHub and manages the menu system
- **label-product.js** - Renders product labels with environmental metrics, charts, and visualizations

### CSS
- **label.css** - Complete styling for all label formats, charts, and UI components

### HTML
- **index.html** - Main product label viewer with search and menu functionality
- **about/index.html** - Sample/demo page for product labels

## Data Structure

### YAML Product Files
Product data is loaded from GitHub: `https://raw.githubusercontent.com/ModelEarth/products-data/refs/heads/main/{country}/{category}/{id}.yaml`

Key data fields:
- **gwp** - Global Warming Potential (kgCO2e)
- **gwp_per_kg** - GWP per kilogram
- **gwp_z** - Z-score showing how product compares to category average
- **pct10_gwp through pct90_gwp** - Percentile distribution data for category
- **category.name** - Category name for grouping
- **declaredUnit** - Unit of measurement

## Visualization Components

### Bar Chart (Vertical)
Shows percentile distribution (10th-90th) with product marker overlay. Located in `renderPercentileBarChart()`.

### Boxplot Chart
Displays quartile distribution with:
- Whiskers (min/max range)
- Box (Q1-Q3 interquartile range)
- Median line (red)
- Product position indicator (green circle/line)

### Z-Score Indicator
Shows how product compares to category average:
- Negative Z-score (green) = Better than average
- Positive Z-score (red) = Worse than average
- Near zero (yellow) = Average

## Label Styles

### FDA Style
Nutrition facts format with:
- Primary metrics prominently displayed
- Percent of average benchmarks
- Hierarchical section organization

### Badge Style
Card-based format with:
- Color-coded eco score badge
- Material composition bars
- Impact breakdown metrics

## Important Functions

- **loadProfile()** - Async function that loads YAML from GitHub
- **renderProductLabel()** - Main entry point for label rendering
- **renderPercentileBarChart()** - Creates vertical bar chart with percentiles
- **renderBoxplotChart()** - Generates boxplot visualization
- **createInfoIcon()** - Creates clickable info icons with tooltips

## Tooltips
All metric tooltips are defined in `METRIC_TOOLTIPS` object:
- gwp: Global Warming Potential explanation
- gwp_z: Z-score interpretation
- biogenic_carbon: Carbon storage info
- uncertainty: Data quality indicators

## Chart Positioning
- Z-score indicator uses `position: absolute` with `top: 100px` to overlay behind bars
- Product markers use z-index layering for proper visibility
- Charts use responsive SVG with viewBox for scaling

## Common Tasks

### Adding New Metrics
1. Update YAML data structure
2. Add tooltip to `METRIC_TOOLTIPS`
3. Create rendering function in label-product.js
4. Add CSS styling to label.css

### Modifying Charts
- Bar chart: `renderPercentileBarChart()` around line 650-750
- Boxplot: `renderBoxplotChart()` around line 797-966
- Update CSS in `.percentile-bar-chart` and `.boxplot-chart-section`

### Changing Colors
Color scheme uses Tailwind-inspired palette:
- Primary blue: #3b82f6
- Success green: #22c55e
- Warning yellow: #f59e0b
- Error red: #ef4444
- Neutral grays: #64748b, #94a3b8, #cbd5e1

## Testing
Test with various products and categories:
- US/Acoustical_Ceilings/61a3d3f6469b4e9baa9da7605650a63d
- Different percentile ranges
- Missing data scenarios
- Dark mode compatibility

## Follow-up: Subcategories Without a CSV

The building materials menus (`PRODUCT_CATEGORIES` in js/label.js) list only subcategories that have a CSV in products-data (`{country}/{country}-{subcategory}.csv`), since the lists and maincat sections load from those CSVs. The US subcategories below have YAML folders but no CSV yet, so they're in each section's `noCsv` list and left out of the left menu and the category cards. US Mechanical & Plumbing and Other Products have none left, so those sections are hidden.

- Structural Materials: Supplementary_Cementitious_Materials
- Metals: Aluminium_Billets, Aluminium_Sheet_Goods
- Wall Systems: Cement_Board, Fiber-cement_Siding
- Coatings & Protection: Dampproofing_And_Waterproofing, Grouting
- Mechanical & Plumbing: Utility_Piping, Water_Closets, Other_Plumbing_Fixtures, Elevators
- Other Products: Tables, Clothing, Food_Beverage

To restore one, generate its CSV in products-data, then move its name from `noCsv` back into `subcategories`.
