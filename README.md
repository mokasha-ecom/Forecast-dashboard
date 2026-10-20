# Demand Command v2

A demand-planning command center that reads live from your Google Sheet.
No database, no API keys. Edit the Sheet, the app updates itself (within ~5 minutes).

## What's new in v2
- **Linear-trend forecasting** replaces the weighted average, so consistent up/down
  trends carry forward. Seasonality still applies on top. The current (partial) month
  is blended in weighted by how far through the month you are.
- **Side navigation** with five pages: Dashboard, Pipeline, Production, Inventory & SKUs,
  Sales analytics.
- **Management widget** on the dashboard: "Have + on the way + planned vs what you need",
  per product, expandable to the top-selling variations.
- **New timeline**: 15 days back to 6 months ahead, product-level, containers labelled
  by batch. Click any point for details.
- **Fully responsive** on phone and desktop.
- Fixed a double-count in your Pipeline/Plan sheets (product-level "-ALL" rows were being
  added on top of the variant breakdown).

## The current month (how to update it)
In the **Sales** tab, the current month has one row per SKU. Each day when you update stock,
type two numbers into that row:
- `Units_Sold`  = units sold so far this month (month-to-date total)
- `Days_In_Stock` = how many days into the month that total covers (usually today's date, e.g. 21)

The app annualises that (units / days x 30) and blends it into the trend, weighted by how far
through the month you are — so early-month numbers barely move the forecast and late-month
numbers count almost fully.

## The one file you may ever edit
`config.js` — holds your Google Sheet ID and tab names.

## Deploy (unchanged from v1)
1. GitHub -> new private repo `demand-command` -> upload ALL files (keep folders) -> commit.
2. Vercel -> Add New -> Project -> pick the repo -> Deploy.
3. Open the vercel.app link. Done.

## Requirements on the Sheet
- Share: Anyone with the link -> Viewer
- Tabs: Products, Sales, Inventory, Pipeline, Production_Plan, Seasonality, Settings
- Month = YYYY-MM, dates = YYYY-MM-DD, SKU_ID identical across tabs
