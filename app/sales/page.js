"use client";
import { useState, useMemo } from "react";
import { useData, Trend, ErrBox, Loading, n } from "../ui";
import SkuPanel from "../SkuPanel";

export default function SalesPage() {
  const { data, err, reload } = useData();
  const [skuId, setSkuId] = useState(null);

  const derived = useMemo(() => {
    if (!data) return null;
    const skus = data.skus;
    const withHist = skus.filter(s => (s.history || []).length > 0);
    const totalSold = s => (s.history || []).reduce((a, h) => a + h.units, 0);
    const topMovers = withHist.map(s => ({ ...s, sold: totalSold(s) }))
      .sort((a, b) => b.sold - a.sold).slice(0, 15);
    const risers = withHist.filter(s => s.forecastMonthly >= 30 && s.trendPct > 5)
      .sort((a, b) => b.trendPct - a.trendPct).slice(0, 12);
    const fallers = withHist.filter(s => s.forecastMonthly >= 30 && s.trendPct < -5)
      .sort((a, b) => a.trendPct - b.trendPct).slice(0, 12);
    // product-level sales mix (last complete history)
    const mix = {};
    withHist.forEach(s => { mix[s.product] = (mix[s.product] || 0) + totalSold(s); });
    const mixArr = Object.entries(mix).map(([product, sold]) => ({ product, sold }))
      .sort((a, b) => b.sold - a.sold);
    const grand = mixArr.reduce((a, m) => a + m.sold, 0) || 1;
    return { topMovers, risers, fallers, mixArr, grand };
  }, [data]);

  if (err) return <ErrBox err={err} />;
  if (!data) return <Loading />;

  const { topMovers, risers, fallers, mixArr, grand } = derived;
  const sku = skuId ? data.skus.find(s => s.id === skuId) : null;
  const maxMix = mixArr[0]?.sold || 1;

  return (
    <>
      <div className="phead">
        <div><h1>Sales analytics</h1><div className="sub">What's selling, what's accelerating, and what's fading.</div></div>
        <div className="meta"><button className="refresh" onClick={reload}>Refresh</button></div>
      </div>

      <div className="section">
        <h2>Sales mix by product <span className="hint">share of units sold across history</span></h2>
        <table>
          <thead><tr><th>Product</th><th className="r">Units sold</th><th className="r">Share</th><th style={{ width: "34%" }}></th></tr></thead>
          <tbody>
            {mixArr.map(m => (
              <tr key={m.product}>
                <td><b>{m.product}</b></td>
                <td className="r">{n(m.sold)}</td>
                <td className="r">{Math.round((m.sold / grand) * 100)}%</td>
                <td>
                  <div style={{ background: "var(--line2)", borderRadius: 4, height: 8 }}>
                    <div style={{ width: `${(m.sold / maxMix) * 100}%`, background: "var(--blue)", height: 8, borderRadius: 4 }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Top movers <span className="hint">most units sold, all months</span></h2>
        <table>
          <thead><tr><th>SKU</th><th className="hidemobile">Variant</th><th className="r">Units sold</th><th className="r">Forecast/mo</th><th className="r hidemobile">Trend</th></tr></thead>
          <tbody>
            {topMovers.map(s => (
              <tr key={s.id} className="click" onClick={() => setSkuId(s.id)}>
                <td><b>{s.id}</b></td>
                <td className="hidemobile">{[s.product, s.size, s.color].filter(Boolean).join(" / ")}</td>
                <td className="r">{n(s.sold)}</td>
                <td className="r">{n(s.forecastMonthly)}</td>
                <td className="r hidemobile"><Trend pct={s.trendPct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="salesgrid">
        <div className="section" style={{ margin: 0 }}>
          <h2>Accelerating ▲</h2>
          <TrendTable rows={risers} onPick={setSkuId} empty="No clear risers." />
        </div>
        <div className="section" style={{ margin: 0 }}>
          <h2>Fading ▼</h2>
          <TrendTable rows={fallers} onPick={setSkuId} empty="No clear decliners." />
        </div>
      </div>

      {sku && <SkuPanel sku={sku} onClose={() => setSkuId(null)} />}
      <style>{`@media (max-width:720px){.salesgrid{grid-template-columns:1fr !important}}`}</style>
    </>
  );
}

function TrendTable({ rows, onPick, empty }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <table>
      <thead><tr><th>SKU</th><th className="r">Forecast/mo</th><th className="r">Trend</th></tr></thead>
      <tbody>
        {rows.map(s => (
          <tr key={s.id} className="click" onClick={() => onPick(s.id)}>
            <td><b>{s.id}</b><div style={{ fontSize: 11, color: "var(--faint)" }}>{[s.size, s.color].filter(Boolean).join(" ")}</div></td>
            <td className="r">{n(s.forecastMonthly)}</td>
            <td className="r"><Trend pct={s.trendPct} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
