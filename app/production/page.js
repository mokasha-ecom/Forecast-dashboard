"use client";
import { useState } from "react";
import { useData, ErrBox, Loading, n } from "../ui";
import SkuPanel from "../SkuPanel";

export default function ProductionPage() {
  const { data, err, reload } = useData();
  const [skuId, setSkuId] = useState(null);
  if (err) return <ErrBox err={err} />;
  if (!data) return <Loading />;

  const { demandVsProduction, products, settings } = data;
  const sku = skuId ? data.skus.find(s => s.id === skuId) : null;

  // SKUs that most need production, sorted by recommended qty
  const toProduce = data.skus.filter(s => s.recommend > 0).sort((a, b) => b.recommend - a.recommend);
  const totalRecommend = toProduce.reduce((a, s) => a + s.recommend, 0);
  const confirmedPlan = data.plan.filter(p => p.confirmed).reduce((a, p) => a + p.units, 0);
  const tentativePlan = data.plan.filter(p => !p.confirmed).reduce((a, p) => a + p.units, 0);

  return (
    <>
      <div className="phead">
        <div><h1>Production planning</h1><div className="sub">Where production is behind demand, and how much to make.</div></div>
        <div className="meta"><button className="refresh" onClick={reload}>Refresh</button></div>
      </div>

      <div className="tiles">
        <div className="tile amber"><div className="n">{n(totalRecommend)}</div><div className="l">Recommended units to produce</div></div>
        <div className="tile"><div className="n">{n(confirmedPlan)}</div><div className="l">Confirmed in plan</div></div>
        <div className="tile"><div className="n">{n(tentativePlan)}</div><div className="l">Tentative (unconfirmed)</div></div>
      </div>

      <div className="section">
        <h2>Demand vs production <span className="hint">next {settings.leadTime + settings.coverage} months, by product</span></h2>
        <table>
          <thead><tr>
            <th>Product</th><th className="r">Forecast demand</th><th className="r">Incoming + planned</th><th className="r">Gap</th>
          </tr></thead>
          <tbody>
            {demandVsProduction.map((d, i) => (
              <tr key={i}>
                <td><b>{d.product}</b></td>
                <td className="r">{n(d.demand)}</td>
                <td className="r">{n(d.supply)}</td>
                <td className={`r ${d.gap < 0 ? "gap-neg" : "gap-pos"}`}>{d.gap > 0 ? "+" : ""}{n(d.gap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note">Negative gap = production is behind forecast demand. Positive = producing more than forecast (overstock risk).</div>
      </div>

      <div className="section">
        <h2>Recommended production <span className="hint">by SKU, highest need first</span></h2>
        <table>
          <thead><tr>
            <th>SKU</th><th className="hidemobile">Product</th><th className="r">Stock</th>
            <th className="r">Forecast/mo</th><th className="r">Incoming</th><th className="r">Produce</th>
          </tr></thead>
          <tbody>
            {toProduce.slice(0, 60).map(s => (
              <tr key={s.id} className="click" onClick={() => setSkuId(s.id)}>
                <td><b>{s.id}</b></td>
                <td className="hidemobile">{[s.product, s.size, s.color].filter(Boolean).join(" / ")}</td>
                <td className="r">{n(s.stock)}</td>
                <td className="r">{n(s.forecastMonthly)}</td>
                <td className="r">{n(s.incomingAll)}</td>
                <td className="r"><span className="recbadge">{n(s.recommend)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {toProduce.length > 60 && <div className="note">Showing top 60 of {toProduce.length}.</div>}
      </div>

      <div className="section">
        <h2>Current production plan</h2>
        {data.plan.length === 0 && <div className="empty">No production planned yet.</div>}
        {data.plan.length > 0 && (
          <table>
            <thead><tr><th>SKU</th><th className="hidemobile">Product</th><th>Target month</th><th className="r">Planned units</th><th>Confirmed</th></tr></thead>
            <tbody>
              {data.plan.sort((a, b) => (a.month || "").localeCompare(b.month || "")).map((p, i) => (
                <tr key={i}>
                  <td className="mono">{p.sku}</td>
                  <td className="hidemobile">{p.product}</td>
                  <td>{p.month}</td>
                  <td className="r">{n(p.units)}</td>
                  <td><span className={`pill ${p.confirmed ? "ok" : "low"}`}>{p.confirmed ? "Yes" : "Tentative"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {sku && <SkuPanel sku={sku} onClose={() => setSkuId(null)} />}
    </>
  );
}
