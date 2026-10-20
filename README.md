# Demand Command v3

A demand-planning command center that reads live from your Google Sheet.
No database, no API keys. Edit the Sheet, the app updates itself (within ~5 minutes).

## What's new in v3 (since v2)
- **Forecast now trends forward.** Each future month continues along the linear trend
  line (e.g. a +12%/mo SKU climbs 74 -> 83 -> 93...), instead of repeating a flat number.
  Seasonality still layers on top, with a sanity cap so steep slopes don't run away.
- **Rebuilt timeline (lane layout).** Three rows -- Arrivals, Planned, Stockouts -- each
  event a labelled pill placed by date. Nothing stacks; the full 6-month width is used.
  Planned production now shows on the timeline; click a pill for target month, confirmed
  vs tentative status, and the SKU breakdown.
- **Planning window is now 3 months** for "need", recommended production, and demand-vs-
  production. The timeline and projection still look 6 months ahead. Change it without
  code via an optional `Need_Window_Months` row in Settings (defaults to 3).
- **Demand history chart** in the slide-over is taller with fixed label spacing (no more
  clipped numbers).

## Carried over from v2
- Side navigation: Dashboard, Pipeline, Production, Inventory & SKUs, Sales analytics.
- Management widget: "Have + on the way + planned vs what you need", per product,
  expandable to the top-selling variations.
- Fully responsive on phone and desktop.
- Product-level "-ALL" rows in Pipeline/Plan are de-duplicated (no double counting).

## The current month (how to update it)
In the Sales tab, the current month has one row per SKU. Each day when you update stock,
type two numbers into that row:
- Units_Sold  = units sold so far this month (month-to-date total)
- Days_In_Stock = how many days into the month that total covers (usually today's date)

The app annualises that (units / days x 30) and blends it into the trend, weighted by how
far through the month you are.

## The one file you may ever edit
config.js -- holds your Google Sheet ID and tab names.

## Deploy
1. GitHub -> your repo -> Add file -> Upload files -> drag in ALL files (keep folders) -> commit.
2. Vercel redeploys automatically within ~1 minute.
3. Open the vercel.app link.

## Requirements on the Sheet
- Share: Anyone with the link -> Viewer
- Tabs: Products, Sales, Inventory, Pipeline, Production_Plan, Seasonality, Settings
- Month = YYYY-MM, dates = YYYY-MM-DD, SKU_ID identical across tabs
