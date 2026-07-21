import { num, toMonth, toDate, monthAdd, monthOfDate } from "./csv";

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------
export function readSettings(rows) {
  const map = {};
  rows.forEach(r => { if (r.Setting) map[r.Setting] = num(r.Value); });
  return {
    leadTime: map.Lead_Time_Months || 4,
    coverage: map.Coverage_Target_Months || 3,
    z: map.Service_Level_Z || 1.28,
    daysPerMonth: map.Working_Days_Per_Month || 30,
    lowDays: map.Low_Stock_Days || 30,
    orderDays: map.Order_Now_Days || 20,
    horizon: Math.max(6, map.Forecast_Horizon_Months || 6), // dashboard needs >=6
    dashboardOosMin: 200, // only surface OOS on the main dashboard if forecast >= this
  };
}

// ---------------------------------------------------------------------------
// LINEAR TREND FORECAST
//   Fits a least-squares line through monthly history and projects forward.
//   history: [{month, trueDemand}] sorted oldest->newest (complete months only)
//   partial: {rate, weight} optional current-month signal (annualised rate + 0..1 weight)
// ---------------------------------------------------------------------------
function fitTrend(points) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, n: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].y, n: 1 };
  const meanX = points.reduce((a, p) => a + p.x, 0) / n;
  const meanY = points.reduce((a, p) => a + p.y, 0) / n;
  let numr = 0, den = 0;
  points.forEach(p => { numr += (p.x - meanX) * (p.y - meanY); den += (p.x - meanX) ** 2; });
  const slope = den ? numr / den : 0;
  const intercept = meanY - slope * meanX;
  return { slope, intercept, n };
}

// Returns { base, slope, trendPct } — base = forecast for the next full month.
function linearForecast(history, partial) {
  const complete = history.map((h, i) => ({ x: i, y: h.trueDemand }));
  // Blend the partial current month in as a fractional data point.
  // We give it an x just past the last complete month, and fold its influence
  // by repeating it proportional to its weight (days elapsed / month length).
  let points = complete.slice();
  if (partial && partial.weight > 0) {
    const nextX = complete.length;
    // weight in 0..1 -> emulate partial leverage by shrinking toward trend line.
    points.push({ x: nextX, y: partial.rate, w: partial.weight });
  }
  // Weighted least squares (default weight 1 for complete months).
  const n = points.length;
  if (n === 0) return { base: 0, slope: 0, trendPct: 0 };
  if (n === 1) return { base: Math.max(0, points[0].y), slope: 0, trendPct: 0 };
  const W = points.map(p => p.w ?? 1);
  const sw = W.reduce((a, b) => a + b, 0);
  const mx = points.reduce((a, p, i) => a + p.x * W[i], 0) / sw;
  const my = points.reduce((a, p, i) => a + p.y * W[i], 0) / sw;
  let numr = 0, den = 0;
  points.forEach((p, i) => { numr += W[i] * (p.x - mx) * (p.y - my); den += W[i] * (p.x - mx) ** 2; });
  const slope = den ? numr / den : 0;
  const intercept = my - slope * mx;
  // Forecast for the next month after the last COMPLETE month.
  const forecastX = complete.length; // position of "this month"
  const base = Math.max(0, slope * forecastX + intercept);
  const avg = my || 1;
  const trendPct = avg ? (slope / avg) * 100 : 0; // % change per month vs level
  return { base, slope, trendPct };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export function compute(data) {
  const S = readSettings(data.settings);
  const now = new Date();
  const thisMonth = monthOfDate(now);
  const dayOfMonth = now.getDate();
  const daysInCalMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // ---- seasonality: sku -> {monthNum: adj} (also keyed by product name) ----
  const seasonal = {};
  data.seasonality.forEach(r => {
    const id = r.SKU_ID; if (!id) return;
    (seasonal[id] = seasonal[id] || {})[num(r.Month_Number)] = num(r.Adjustment);
  });

  // ---- sales history per SKU, with stockout-corrected "true demand" ----
  // Complete months vs the current (partial) month are separated.
  const history = {};       // id -> [{month, units, trueDemand}] complete months
  const partialMonth = {};  // id -> {units, days, rate}  (current month MTD)
  data.sales.forEach(r => {
    const id = r.SKU_ID, month = toMonth(r.Month);
    if (!id || !month) return;
    const units = num(r.Units_Sold);
    const rawDays = num(r.Days_In_Stock, 0);

    if (month === thisMonth) {
      // Current month = month-to-date total the user types in.
      if (units > 0) {
        // Days observed so far: use Days_In_Stock if given, else day-of-month.
        const days = Math.max(1, rawDays > 0 ? Math.min(rawDays, daysInCalMonth) : dayOfMonth);
        const rate = (units / days) * S.daysPerMonth; // annualised to a full month
        partialMonth[id] = { units, days, rate: Math.round(rate) };
      }
      return;
    }
    // Complete month: apply stockout uplift when it ran out early.
    const days = Math.max(1, Math.min(S.daysPerMonth, rawDays > 0 ? rawDays : S.daysPerMonth));
    const uplift = S.daysPerMonth / days;
    const trueDemand = Math.round(units * Math.min(uplift, 3)); // cap 3x
    (history[id] = history[id] || []).push({ month, units, days, trueDemand });
  });
  Object.values(history).forEach(h => h.sort((a, b) => a.month.localeCompare(b.month)));

  // ---- inventory ----
  const inv = {};
  let newestSnapshot = null;
  data.inventory.forEach(r => {
    if (!r.SKU_ID) return;
    inv[r.SKU_ID] = { wh: num(r.Warehouse_Stock), fba: num(r.FBA_Stock) };
    const d = toDate(r.Snapshot_Date);
    if (d && (!newestSnapshot || d > newestSnapshot)) newestSnapshot = d;
  });

  // ---- pipeline (incoming, not yet arrived) ----
  // The sheet stores each container twice: product-level "-ALL" summary rows AND
  // a variant breakdown. To avoid double counting, per batch we drop the "-ALL"
  // rows WHEN that batch also has variant rows; batches that only have an "-ALL"
  // row are kept (nothing else describes them).
  const isAll = id => /-ALL$/i.test(id || "");
  const batchHasVariants = {};
  data.pipeline.forEach(r => {
    if (r.SKU_ID && !isAll(r.SKU_ID)) batchHasVariants[r.Batch_Ref] = true;
  });

  const pipe = {};        // id -> {month: units}
  const pipeRows = [];
  data.pipeline.forEach(r => {
    if (!r.SKU_ID) return;
    // Skip redundant product-level summary rows when the batch is broken out.
    if (isAll(r.SKU_ID) && batchHasVariants[r.Batch_Ref]) return;
    const arrived = /^arrived$/i.test(r.Status || "");
    const eta = toDate(r.ETA_Date);
    const row = {
      sku: r.SKU_ID, ref: r.Batch_Ref || "—", units: num(r.Units), eta,
      etaMonth: eta ? monthOfDate(eta) : null,
      status: r.Status || "In Transit", notes: r.Notes || "", arrived,
    };
    pipeRows.push(row);
    if (!arrived && row.etaMonth) {
      (pipe[r.SKU_ID] = pipe[r.SKU_ID] || {});
      pipe[r.SKU_ID][row.etaMonth] = (pipe[r.SKU_ID][row.etaMonth] || 0) + row.units;
    }
  });

  // ---- production plan ----
  // Same "-ALL" de-dup as pipeline, keyed per product+month: if any variant of a
  // product has a plan row for that month, drop the product-level "-ALL" row.
  const productName = {};
  data.products.forEach(p => { if (p.SKU_ID) productName[p.SKU_ID] = p.Product || p.SKU_ID; });
  const planHasVariants = {}; // "productName|month" -> true
  data.plan.forEach(r => {
    const m = toMonth(r.Target_Month);
    if (!r.SKU_ID || !m || isAll(r.SKU_ID)) return;
    if (num(r.Planned_Units) <= 0) return;
    planHasVariants[(productName[r.SKU_ID] || r.SKU_ID) + "|" + m] = true;
  });

  const plan = {};
  const planRows = [];
  data.plan.forEach(r => {
    const id = r.SKU_ID, m = toMonth(r.Target_Month);
    if (!id || !m) return;
    const units = num(r.Planned_Units);
    if (units <= 0) return;
    if (isAll(id) && planHasVariants[(productName[id] || id) + "|" + m]) return;
    (plan[id] = plan[id] || {})[m] = (plan[id][m] || 0) + units;
    planRows.push({ sku: id, month: m, units, confirmed: /^yes$/i.test(r.Confirmed || "") });
  });

  // ---- per-SKU computation ----
  const skus = [];
  const bySku = {};
  data.products.forEach(p => {
    const id = p.SKU_ID;
    if (!id) return;
    const isProduct = /^product$/i.test(p.Level || "");
    const discontinued = /^discontinued$/i.test(p.Status || "");
    if (isProduct) return;        // product-level rows handled in rollup
    if (discontinued) return;     // skip discontinued variants from active planning

    const h = history[id] || [];
    const pm = partialMonth[id];
    const partial = pm ? { rate: pm.rate, weight: Math.min(1, pm.days / daysInCalMonth) } : null;
    const { base, trendPct } = linearForecast(h, partial);

    // std dev of complete months for safety stock
    const vals = h.map(x => x.trueDemand);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length - 1)) : 0;
    const safety = Math.round(S.z * sd);

    // seasonality-adjusted forecast over the horizon
    const months = [];
    for (let i = 0; i < S.horizon; i++) {
      const m = monthAdd(thisMonth, i);
      const mn = +m.split("-")[1];
      const adj = seasonal[id]?.[mn] ?? seasonal[p.Product]?.[mn] ?? 0;
      months.push({ month: m, demand: Math.round(base * (1 + adj)) });
    }

    const stockWhRaw = inv[id]?.wh ?? 0;
    const stockFbaRaw = inv[id]?.fba ?? 0;
    // Floor at 0 for planning math — negative sheet values mean oversold, not "owe stock".
    const stockWh = Math.max(0, stockWhRaw);
    const stockFba = Math.max(0, stockFbaRaw);
    const stock = stockWh + stockFba;
    const oversold = (stockWhRaw + stockFbaRaw) < 0;
    const daily = base / S.daysPerMonth;
    const coverDays = daily > 0 ? Math.round(stock / daily) : (stock > 0 ? 999 : 0);

    // running projection month by month
    let bal = stock;
    let stockoutMonth = null;
    const projection = months.map(({ month, demand }) => {
      const incoming = (pipe[id]?.[month] || 0) + (plan[id]?.[month] || 0);
      bal = bal + incoming - demand;
      if (bal < 0 && !stockoutMonth) stockoutMonth = month;
      return { month, demand, incoming, balance: Math.round(bal) };
    });

    let status;
    if (stock <= 0) status = "Out of Stock";
    else if (coverDays <= S.orderDays) status = "Order Now";
    else if (coverDays <= S.lowDays) status = "Low Stock";
    else status = "Healthy";

    const urgent = !!stockoutMonth && monthDiff(thisMonth, stockoutMonth) < S.leadTime;

    // recommended production for (leadTime + coverage) window
    const need = months.slice(0, Math.min(S.horizon, S.leadTime + S.coverage))
      .reduce((a, m) => a + m.demand, 0);
    const incomingAll = Object.values(pipe[id] || {}).reduce((a, b) => a + b, 0);
    const plannedAll = Object.values(plan[id] || {}).reduce((a, b) => a + b, 0);
    const recommend = Math.max(0, Math.round(need + safety - stock - incomingAll - plannedAll));

    const totalHistSales = h.reduce((a, x) => a + x.units, 0);

    const rec = {
      id, product: p.Product || id, size: p.Size || "", color: p.Color || "",
      stock, stockWh, stockFba, oversold, coverDays, status, urgent,
      forecastMonthly: Math.round(base), trendPct: Math.round(trendPct),
      safety, recommend, stockoutMonth,
      incomingAll, plannedAll, totalHistSales,
      partialMonth: pm ? { units: pm.units, days: pm.days, projected: pm.rate } : null,
      history: h.slice(-12), projection,
    };
    skus.push(rec);
    bySku[id] = rec;
  });

  // ---- product-level rollups (the management widget core) ----
  // Group active variants by product name.
  const byProduct = {};
  skus.forEach(s => {
    const g = (byProduct[s.product] = byProduct[s.product] || {
      product: s.product, variants: [],
      stock: 0, incoming: 0, planned: 0, need: 0, recommend: 0,
    });
    g.variants.push(s);
    g.stock += s.stock;
    g.incoming += s.incomingAll;
    g.planned += s.plannedAll;
    // "need" = forecast demand across the coverage+lead window
    g.need += s.projection.slice(0, Math.min(S.horizon, S.leadTime + S.coverage))
      .reduce((a, m) => a + m.demand, 0);
    g.recommend += s.recommend;
  });

  const products = Object.values(byProduct).map(g => {
    const available = g.stock + g.incoming + g.planned;
    const gap = available - g.need; // negative = shortage
    // top variations by historical sales
    const top = g.variants.slice().sort((a, b) => b.totalHistSales - a.totalHistSales).slice(0, 4)
      .map(v => ({
        id: v.id, label: [v.size, v.color].filter(Boolean).join(" ") || v.id,
        stock: v.stock, forecastMonthly: v.forecastMonthly, trendPct: v.trendPct,
        status: v.status, recommend: v.recommend, coverDays: v.coverDays,
      }));
    const anyUrgent = g.variants.some(v => v.urgent);
    const oosCount = g.variants.filter(v => v.status === "Out of Stock").length;
    return {
      product: g.product,
      stock: g.stock, incoming: g.incoming, planned: g.planned,
      available, need: g.need, gap,
      recommend: g.recommend, variantCount: g.variants.length,
      anyUrgent, oosCount, topVariations: top,
    };
  }).sort((a, b) => a.gap - b.gap); // biggest shortage first

  // ---- rollups / counts ----
  const counts = { "Out of Stock": 0, "Order Now": 0, "Low Stock": 0, Healthy: 0 };
  skus.forEach(s => counts[s.status]++);
  const urgentCount = skus.filter(s => s.urgent).length;
  const incomingUnits = pipeRows.filter(r => !r.arrived).reduce((a, r) => a + r.units, 0);
  const delayed = pipeRows.filter(r => /delayed/i.test(r.status));

  // ---- dashboard "needs action" (filtered): OOS only if forecast >= threshold ----
  const dashOos = skus.filter(s =>
    s.status === "Out of Stock" && s.forecastMonthly >= S.dashboardOosMin);
  const dashUrgent = skus.filter(s => s.urgent);

  // ---- alerts (FBA hints removed) ----
  const alerts = [];
  dashOos.forEach(s =>
    alerts.push({ tier: 1, text: `${label(s)} is out of stock (forecast ~${s.forecastMonthly}/mo)`, sku: s.id }));
  dashUrgent.filter(s => s.status !== "Out of Stock").forEach(s =>
    alerts.push({ tier: 1, text: `${label(s)} runs out in ${s.stockoutMonth} — before new production can arrive`, sku: s.id }));
  delayed.forEach(r =>
    alerts.push({ tier: 1, text: `Batch ${r.ref} (${r.sku}) is marked Delayed`, sku: r.sku }));
  skus.filter(s => s.status === "Order Now").forEach(s =>
    alerts.push({ tier: 2, text: `${label(s)} has ${s.coverDays} days of cover — start production planning`, sku: s.id }));
  skus.filter(s => s.status === "Low Stock").forEach(s =>
    alerts.push({ tier: 3, text: `${label(s)} below ${S.lowDays}-day cover (${s.coverDays} days)`, sku: s.id }));
  alerts.sort((a, b) => a.tier - b.tier);

  // ---- timeline events: -15 days .. +6 months, PRODUCT-LEVEL only ----
  const winStart = new Date(now); winStart.setDate(winStart.getDate() - 15);
  const winEnd = new Date(now); winEnd.setMonth(winEnd.getMonth() + 6);
  const productOf = {}; // sku -> product name
  data.products.forEach(p => { if (p.SKU_ID) productOf[p.SKU_ID] = p.Product || p.SKU_ID; });

  // Incoming containers grouped by batch (a batch can span many SKUs/products).
  const batchMap = {};
  pipeRows.forEach(r => {
    if (r.arrived || !r.eta || r.eta < winStart || r.eta > winEnd) return;
    const key = r.ref + "|" + r.eta.toISOString().slice(0, 10);
    const b = (batchMap[key] = batchMap[key] || {
      ref: r.ref, date: r.eta.toISOString().slice(0, 10), units: 0,
      status: r.status, products: {}, skus: [],
    });
    b.units += r.units;
    b.skus.push({ sku: r.sku, product: productOf[r.sku] || r.sku, units: r.units });
    const pn = productOf[r.sku] || r.sku;
    b.products[pn] = (b.products[pn] || 0) + r.units;
  });
  const events = [];
  Object.values(batchMap).forEach(b => {
    events.push({
      date: b.date, type: /delayed/i.test(b.status) ? "delayed" : "arrival",
      title: `Container ${b.ref}`,
      detail: `${b.units.toLocaleString()} units · ${Object.keys(b.products).length} product(s)`,
      batchRef: b.ref, units: b.units,
      products: Object.entries(b.products).map(([name, u]) => ({ name, units: u }))
        .sort((a, b2) => b2.units - a.units),
      skus: b.skus,
    });
  });

  // Product-level planned production due dates
  const planByProductMonth = {};
  planRows.forEach(r => {
    const pn = productOf[r.sku] || r.sku;
    const k = pn + "|" + r.month;
    planByProductMonth[k] = (planByProductMonth[k] || 0) + r.units;
  });
  Object.entries(planByProductMonth).forEach(([k, units]) => {
    const [pn, m] = k.split("|");
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(y, mo - 1, 1);
    if (d >= winStart && d <= winEnd) events.push({
      date: d.toISOString().slice(0, 10), type: "plan",
      title: `${pn}`, detail: `${units.toLocaleString()} planned units due`, product: pn,
    });
  });

  // Product-level predicted stockouts — collapse per-variant into one dot per
  // product per month so the timeline stays readable. Only meaningful sellers.
  const soGroup = {}; // "product|month" -> {count, variants:[label], units}
  skus.forEach(s => {
    if (!s.stockoutMonth || s.forecastMonthly < 50) return;
    const k = s.product + "|" + s.stockoutMonth;
    const g = (soGroup[k] = soGroup[k] || { product: s.product, month: s.stockoutMonth, count: 0, variants: [] });
    g.count++;
    g.variants.push([s.size, s.color].filter(Boolean).join(" ") || s.id);
  });
  Object.values(soGroup).forEach(g => {
    const [y, m] = g.month.split("-").map(Number);
    const d = new Date(y, m - 1, 15);
    if (d < winStart || d > winEnd) return;
    events.push({
      date: d.toISOString().slice(0, 10), type: "stockout",
      title: g.product,
      detail: g.count === 1 ? `Predicted stockout: ${g.variants[0]}`
        : `${g.count} variations predicted to stock out`,
      product: g.product, variants: g.variants.slice(0, 12), count: g.count,
    });
  });
  events.sort((a, b) => a.date.localeCompare(b.date));

  // ---- demand vs production (per product) ----
  const demandVsProduction = products.map(p => ({
    product: p.product, demand: p.need, supply: p.incoming + p.planned,
    gap: (p.incoming + p.planned) - p.need,
  })).sort((a, b) => a.gap - b.gap);

  const staleDays = newestSnapshot ? Math.floor((now - newestSnapshot) / 86400000) : null;

  return {
    generatedAt: now.toISOString(),
    settings: S, counts, urgentCount, incomingUnits, staleDays,
    windowStart: winStart.toISOString().slice(0, 10),
    windowEnd: winEnd.toISOString().slice(0, 10),
    alerts, events, products, demandVsProduction,
    skus: skus.sort((a, b) => rank(a) - rank(b) || a.coverDays - b.coverDays),
    pipeline: pipeRows.map(r => ({
      sku: r.sku, product: productOf[r.sku] || r.sku, ref: r.ref, units: r.units,
      eta: r.eta ? r.eta.toISOString().slice(0, 10) : null, status: r.status,
      arrived: r.arrived, notes: r.notes,
    })),
    plan: planRows.map(r => ({
      sku: r.sku, product: productOf[r.sku] || r.sku, month: r.month,
      units: r.units, confirmed: r.confirmed,
    })),
  };
}

function label(s) { return [s.product, s.size, s.color].filter(Boolean).join(" / "); }
function rank(s) { return s.status === "Out of Stock" ? 0 : s.urgent ? 1 : s.status === "Order Now" ? 2 : s.status === "Low Stock" ? 3 : 4; }
function monthDiff(a, b) { const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number); return (by - ay) * 12 + (bm - am); }
