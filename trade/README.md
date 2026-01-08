[Active Projects](../../projects/)
# Trade Profiles (CSV and SQL)

We're using UN Comtrade [Exiobase](https://exiobase.eu) trade factors and US Bureau of Economic Analysis (BEA) data with Claude Code CLI to create Python that outputs [Exiobase .CSV files](../../exiobase/tradeflow/) and US state commodity analysis .CSV files from our [BEA+Exiobase data prep python](../../exiobase/tradeflow/bea/).

<!--Each country-year database instance will represent a country and year from Exiobase.-->

**Dashboards and Reports**  
Pitch in to help us refine and optimize our interactive reports:  

- [Country Trade Data](../footprint/)  
- [US States - Summary Totals](../footprint/#state=all)  
- [BEA Dashboard](../../trade-data/bea-dashboard/)  
- [Import Dependency & Supply Chain Risk Dashboard](../../trade-data/year/2019/US/imports/import-dependency-dashboard.html)  
- [Comparison Frontends](../../comparison/)

Also see [IO Charts](../../io/charts/) using [US States from Matrix table files](/io/about/) with new [50 State USEEIO json](https://github.com/ModelEarth/useeio-json/)

Exiobase+BEA processing vibe coded with guidance from the US EPA's [generate\_import\_factors.py](https://github.com/ModelEarth/USEEIO/tree/master/import_emission_factors). 

### In the works - India trade flow

We're aiming for the equivalent to the US BEA state data process above.  
[Overview](../../exiobase/India_data/) for Python at [india-state-allocation.py](https://github.com/ModelEarth/exiobase/blob/main/tradeflow/india-state-allocation.py) and resulting [India trade flow data](https://github.com/ModelEarth/exiobase/tree/main/India_data).


## Tables: trade, factor, industry 

[Exiobase Overview](../../exiobase/tradeflow/) - Pulled from Exiobase for domestic, imports, exports
[BEA + Exiobase Overview](../../exiobase/tradeflow/bea/) - Pull for US state-to-state

[View table names as csv files](https://github.com/ModelEarth/trade-data/tree/main/year/2019) and [Trade Flow by Country and State](../state/)

**CSV-to-SQL table names**
[factor](https://github.com/ModelEarth/trade-data/blob/main/year/2019/factor.csv) (includes factor\_id<!-- and flow\_id-->)  
[industry](https://github.com/ModelEarth/trade-data/blob/main/year/2019/industry.csv) (5-char sectors) 
trade (trade_id, year, region1, region2, industry1, industry2, amount)  
trade_factor  

**Supporting local file**
trade_factor_lg - For local processing (too large to send to github)

**Redundant** (For reports but not needed in SQL)
[trade_impact](../footprint/)  
trade_resource
trade_material  
trade_employment

<!--
importindustry\_factor  
importcommodity\_factor  
importcontributions  
importmultiplier\_factor 
-->

For future:
commodities (6-char products)  
commodity\_factor  


Also see [Open CEDA](https://watershed.com/solutions/ceda)

[Stanford's Cornerstone Sustainability Data Initiative](https://cornerstonedata.org) - Collaboration on USEEIO and Open CEDA, the world’s two most widely used models for Scope 3 (value chain) carbon accounting and policy research. [GitHub](https://github.com/cornerstone-data)


## Tables: sector, beasummary, sector_beasummary

For "sector" table is the 6-char ~400 international CEDA Sectors that aligns with BEA Detail and USEEIO ([see concordance](https://github.com/ModelEarth/USEEIO/blob/master/import_emission_factors/concordances/ceda_to_useeio_commodity_concordance.csv)]

Our "beasummary" table is the ~60 categories which aggregate the Sectors (BEA Details).  
Typically the summary aggregate IDs are 5-char, but they can range from 2 to 6 char.

For CEDA "sector_beasummary" table:

The [useeio_internal_concordance.csv](https://github.com/ModelEarth/USEEIO/blob/master/import_emission_factors/concordances/useeio_internal_concordance.csv) relates BEA to USEEIO, which could be changed to the CEDA sector.


## Member CRM tables

[SuiteCRM](../crm) - Partner Data analysis using Azure, SQL Express and MariaDB.
[MemberCommons Admin Dashboard](../../team/admin)  



# Trade Flow Impact Visualizations

See chart starter sample in upper right.

<!--
In the CoLab, add the [Sector table output](https://github.com/ModelEarth/USEEIO/commit/c10d087d916477b3335127de560d4689fa5818ea) Ben created.
-->

TO DO: Create [interactive versions](/profile/impacts/) of the [three Exiobase charts](https://exiobase.eu)  
See our various [Data Prep processes](/profile/prep/) - Three Charts using International Exiobase Data

TO DO: [Generate datasets for additional years and trade flow types](https://github.com/ModelEarth/projects/issues/30)

TO DO: <a href="/profile/prep/">Create International Industry Reports</a> - like Energy Consumption in Drying



<!--<a href="#reports">Our Javascript USEEIO TO DOs</a>-->
<!--<a href="/io/charts/">Our React USEEIO widget TO DOs</a>-->

<b>Pulling data into state SQL databases</b>
New simple table names - for use by elementary school students
<a href="/profile/prep/sql/supabase/">Supabase from .csv files</a>
<a href="/profile/prep/sql/duckdb/">DuckDB from .csv files</a>
<a href="/requests/products/">Harmonized System (HS) codes</a> - <a href="https://colab.research.google.com/drive/1etpn1no8JgeUxwLr_5dBFEbt8sq5wd4v?usp=sharing">Our HS CoLab</a>

<b>View SQL Data</b>
[Javascript with Supabase](/profile/impacts) and [Just Tables](/profile/prep/sql/supabase/SupabaseWebpage.html)
Our DuckDB parquet tables in [ObservableHQ Dashboard](https://observablehq.com/d/2898d01446cefef1) and [Static Framework](/data-commons/dist/innovation/)
<a href="/profile/impacts/">Sample of JavaScript joining DuckDB Parquet tables</a>
<a href="https://model.earth/storm/impact/process.html">SQL Documentation Sample - Storm Tweet Data</a>

<b>Python to pull CSV files into SQL</b>
<a href="https://colab.research.google.com/drive/1qWgO_UjeoYYB3ZSzT3QdXSfVZb7j09_S?usp=sharing">Generate Supabase Exiobase (Colab)</a> - <a href="https://github.com/ModelEarth/profile/tree/main/impacts/exiobase/US-source">Bkup</a>
<a href="https://colab.research.google.com/drive/1Wm9Bvi9pC66xNtxKHfaJEeIYuXKpb1TA?usp=sharing">Generate DuckDB Exiobase (CoLab) - <a href="https://github.com/ModelEarth/profile/tree/main/impacts/exiobase/US-source">Bkup</a>
<br>


# US EPA Trade Data Pipeline

The US EPA also merges in US Bureau of Economic Analysis (BEA) with Exiobase. We'd like to reproduce this process for other countries using Exiobase and later Google Data Commons.

For the US EPA analysis, their repo generates six [US-2020-17schema CSV files](https://github.com/ModelEarth/profile/tree/main/impacts/exiobase/US-source/2022) by running <a href="https://github.com/ModelEarth/USEEIO/tree/master/import_factors_exio">generate\_import\_factors.py</a>. The merge combines US BEA and <a href="https://exiobase.eu">EXIOBASE</a> data emissions factors for annual trade data. (The ExiobaseSupabase CoLab above aims to send the same Exiobase data directly to Supabase and DuckDB for each country and year.)

Exiobase provides the equivalent to <a href="https://github.com/USEPA/useeior/blob/master/format_specs/Model.md">M, N, and x</a> which is used in the <a href="/io/about/">USEEIO models</a> for import emissions factors. Exiobase also provides gross trade data which has no equivalent in USEEIO.

# Additional (older)

[Trade Impact Colabs](../impacts/json) - Deploys Exiobase international data to GitHub as JSON
[Global Trade - our Comtrade and Exobase API data pulls](../../global-trade)
[Try MARIO Input-Output library](https://mario-suite.readthedocs.io/en/latest/intro.html) as a striped-down [Pymyrio](https://pymrio.readthedocs.io/en/latest/intro.html)

For Exiobase processing directly into SQL, Gary experimented with Spark on a linux VM to avoid higher expenses using Databricks. Spark is the data processing program that databricks provides, but since you can't control the costs, for now it's best to use directly on linux to be safe.  [Private doc](https://docs.google.com/document/d/1gNsPJmC8_Et3dwd1Kgg0weOSbFC3vPQ3E-S9M_ttg2k/edit?usp=sharing) and [.env for testing](https://colab.research.google.com/drive/1TgA9FJzhhue74Bgf-MJoOAKSBrzpiyss?usp=sharing)

<b>Exiobase International Trade Data</b>
Our IO Team has been generating [JSON](../impacts/json/), <a href="/profile/prep/sql/duckdb/">DuckDB Parquet</a> and <a href="/profile/prep/sql/supabase/">Supabase database inserts</a> for comparing industries and identifying imports with positive environmental impacts using [a Javascript frontend](../impacts/).

<a href="https://github.com/ModelEarth/profile/tree/main/impacts">IO Data on GitHub</a> -  Includes <a href="/io/about/">US state data</a> and <a href="https://github.com/ModelEarth/profile/tree/main/impacts/exiobase/US-source">Exiobase US Trade CSV files</a>.

We've also output [DuckDB parquet files from USEEIO](https://github.com/ModelEarth/profile/tree/main/impacts/useeio) - dev by Satyabrat<!-- When readme added: [DuckDB parquet files from USEEIO](../impacts/useeio) -->
DuckDB supports SQL JOINs in any browser via [WebAssembly WASM](https://duckdb.org/docs/api/wasm/overview.html)

There are examples of using [Apache Parquet](../impacts/useeio/parquet/) files from static html files using DuckDB-Wasm and JavaScript

<!--
We're also using [Mario](https://mario-suite.readthedocs.io/en/latest/intro.html), a friendly version of Pymrio. (Mario may lack some of the functionality and/or data Pymrio provides.)
-->

**About country-year database instances**
The Industry is a 5-char sector ID, and the Commodity is 6-char.
Table names are plural, unless they relate entities.
IDs are singular with an underscore, example: factor_id
This is a standard used widely by Salesforce and others.

We're using UUIDs for any ID that could be shared beyond the database.
So IDs are UUIDs for industries, accounts, users, projects, etc.

For spreadsheets, use capitalized CamelCase for column names. 


**Prior Colabs:**   
<!-- these 2 also reside on DuckDB page -->
[Parquet To Github](https://colab.research.google.com/drive/1Pqpdebj4rY06E6NAgqJskgt-G4HBHPUZ?usp=sharing)
[Colab to Github](https://colab.research.google.com/drive/1mnZKBypCBlVLXiCuSpGj0JZf4NZzNR7h?usp=sharing)
[Exiobase To Github Pipeline](https://colab.research.google.com/drive/1N47_pfTUyOzeukgf4KYX1pmN_Oj1N3r_?usp=sharing) - Pulls zip of year from Exiobase and unzips 
[Create Database from Panda Dataframe](https://colab.research.google.com/drive/1IMpOYzT6oXbZXaJKugi5vCmUB_tIHo0J?usp=sharing) - Output SQL 
[Pymrio Exiobase Industry](https://colab.research.google.com/drive/1bXUO1iXyBGbmZODmnl0NVn3yFpWwBCOi?usp=sharing) - Sends to Supabase
[Inserting Factors and Sectors into Supabase](https://colab.research.google.com/drive/1INHz02V-cU_y_nAlS-BWxQQtz8Qg_lLi#scrollTo=KUnI-Va8M1Nl) - Invite only
[Satwick's PYMRIO.ipynb CoLab](https://colab.research.google.com/drive/1AZPfBlG0iUKmKRZjlNxn8uOuvtAfEarn?usp=sharing)  

TO DO: Send to DuckDB instances for a country and year - See DuckDB example in our [zip code processing](https://model.earth/community-zipcodes/) 


TO DO: Experiment in our [Pymiro CoLab](https://colab.research.google.com/drive/1Q9_1AhdY8uPUfLVUN71X6mKbEy_kqPuQ?usp=sharing) using the [Pymiro for Exiobase library](https://pymrio.readthedocs.io/en/latest/). Save DuckDB country-year data instances. Jaya and Satwick are investigating using .feather within the Pymiro CoLab.

TO DO: Try the following frontend [javascript with a .feather file](feather).

The [Big Sankey](https://github.com/baptiste-an/Application-mapping-GHG) ([view chart](https://sankey.theshiftproject.org/)) uses Plotly with .feather files. We could do the same with [Anvil](https://anvil.works) and Google Looker. 

[ExiobaseSupabase CoLab](https://colab.research.google.com/drive/1LsEDmXrAAGs40OiAKWH48K63E_2bMGBb?usp=sharing)<!-- Himanshu, Sahil, Ben, Parth, Jack, Satwik, Indrasenareddy--> and [New version by Gary](https://colab.research.google.com/drive/16a2pykb_ycfHhAhxK949giWuVf3c_IeD)

TO DO: Update the ExiobaseSupabase CoLab above to also pull the BEA data to match the <a href="https://github.com/ModelEarth/USEEIO/tree/master/import_factors_exio">generate\_import\_factors.py</a>. Test with the US.   <!-- Yuhao, Ruolin, Nancy-->


**Data Prep Notes**
- We remove underscores and use CamelCase for column names.
- We exclude the Year columns because each database is a different year.
- Commodity refers to the 6-character detail sectors.
- Sector refers to the 5-character and fewer sectors.
- Region is referred to as Import.
- National is omitted from the table names.
- Country abbreviations (Example: US) are appended to country-specific tables.
This structure supports pulling all the country data into one database.