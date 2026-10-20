"use client";
import { useState, useMemo } from "react";
import { useData, Pill, Trend, ErrBox, Loading, n } from "../ui";
import SkuPanel from "../SkuPanel";

const STATUSES = ["All", "Out of Stock", "Order Now", "Low Stock", "Healthy"];

export default function InventoryPage() {
  const { data, err, reload } = useData();
  const [skuId, setSkuId] = useState(null);
  const [status, setStatus] = useState("All");
  const [product, setProduct] = useState("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("cover"); // cover | forecast | stock | recommend

  const productNames = useMemo(() => {
    if (!data) return [];
    return ["All", ...Array.from(new Set(data.skus.map(s => s.product)))];
  }, [data]);

  if (err) return <ErrBox err={err} />;
  if (!data) return <Loading />;

  let rows = data.skus.filter(s => {
    if (status !== "All" && s.status !== status) return false;
    if (product !== "All" && s.product !== product) return false;
    if (q) {
      const hay = `${s.id} ${s.product} ${s.size} ${s.color}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  rows = rows.sort((a, b) => {
    if (sort === "forecast") return b.forecastMonthly - a.forecastMonthly;
    if (sort === "stock") return b.stock - a.stock;
    if (sort === "recommend") return b.recommend - a.recommend;
    return a.coverDays - b.coverDays; // cover
  });

  const sku = skuId ? data.skus.find(s => s.id === skuId) : null;

  return (
    <>
      <div className="phead">
        <div><h1>Inventory & SKUs</h1><div className="sub">Every active variant with live stock, forecast and status.</div></div>
        <div className="meta"><button className="refresh" onClick={reload}>Refresh</button></div>
      </div>

      <div className="section">
        <div className="filters">
          <select value={product} onChange={e => setProduct(e.target.value)}>
            {productNames.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="cover">Sort: least cover first</option>
            <option value="forecast">Sort: highest forecast</option>
            <option value="stock">Sort: most stock</option>
            <option value="recommend">Sort: most to produce</option>
          </select>
          <input placeholder="Search SKU, size, color…" value={q} onChange={e => setQ(e.target.value)} />
          <span className="note" style={{ marginTop: 0 }}>{rows.length} shown</span>
        </div>

        <table>
          <thead><tr>
            <th>SKU</th><th className="hidemobile">Variant</th><th className="r">Stock</th>
            <th className="r hidemobile">FBA</th><th className="r">Days cover</th>
            <th className="r hidemobile">Forecast/mo</th><th className="r hidemobile">Trend</th>
            <th className="r">Produce</th><th>Status</th>
          </tr></thead>
          <tbody>
            {rows.slice(0, 300).map(s => (
              <tr key={s.id} className="click" onClick={() => setSkuId(s.id)}>
                <td><b>{s.id}</b>{s.urgent && <span className="urgentflag">URGENT</span>}</td>
                <td className="hidemobile">{[s.size, s.color].filter(Boolean).join(" ")}</td>
                <td className="r">{n(s.stock)}</td>
                <td className="r hidemobile">{n(s.stockFba)}</td>
                <td className="r">{s.coverDays === 999 ? "—" : s.coverDays}</td>
                <td className="r hidemobile">{n(s.forecastMonthly)}</td>
                <td className="r hidemobile"><Trend pct={s.trendPct} /></td>
                <td className="r">{s.recommend > 0 ? n(s.recommend) : "—"}</td>
                <td><Pill status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 300 && <div className="note">Showing first 300 — narrow the filters to see more.</div>}
      </div>

      {sku && <SkuPanel sku={sku} onClose={() => setSkuId(null)} />}
    </>
  );
}
