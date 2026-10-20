"use client";
import { Pill, Trend, n, label } from "./ui";

export default function SkuPanel({ sku, onClose }) {
  if (!sku) return null;
  const hist = sku.history || [];
  const maxH = Math.max(...hist.map(x => x.trueDemand), 1);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="panelside">
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
        <h3>{sku.id}</h3>
        <div className="sub">
          {label(sku)} <Pill status={sku.status} />
          {sku.urgent && <span className="urgentflag">URGENT</span>}
          {sku.oversold && <span className="urgentflag">OVERSOLD</span>}
        </div>

        <div className="kv">
          <div><div className="k">In stock</div><div className="v">{n(sku.stock)}</div></div>
          <div><div className="k">Days of cover</div><div className="v">{sku.coverDays === 999 ? "—" : sku.coverDays}</div></div>
          <div><div className="k">Warehouse</div><div className="v">{n(sku.stockWh)}</div></div>
          <div><div className="k">FBA</div><div className="v">{n(sku.stockFba)}</div></div>
          <div><div className="k">Forecast / month</div><div className="v">{n(sku.forecastMonthly)}</div></div>
          <div><div className="k">Trend</div><div className="v"><Trend pct={sku.trendPct} /></div></div>
          <div><div className="k">Incoming</div><div className="v">{n(sku.incomingAll)}</div></div>
          <div><div className="k">Recommend to produce</div><div className="v">{n(sku.recommend)}</div></div>
        </div>

        {sku.partialMonth && (
          <div className="note" style={{ marginTop: -8, marginBottom: 8 }}>
            This month so far: <b>{n(sku.partialMonth.units)}</b> units in {sku.partialMonth.days} days →
            projected <b>{n(sku.partialMonth.projected)}</b>/mo (blended into the trend).
          </div>
        )}

        <div className="blk">Demand history · linear trend {sku.trendPct > 0 ? "+" : ""}{sku.trendPct}%/mo</div>
        {hist.length ? (
          <>
            <div className="bars">
              {hist.map((h, i) => (
                <div key={i} className={`bar ${h.trueDemand !== h.units ? "corrected" : ""}`}
                  style={{ height: `${(h.trueDemand / maxH) * 100}%` }}
                  title={`${h.month}: sold ${h.units}, true demand ~${h.trueDemand}`}>
                  <span className="cap">{h.trueDemand}</span>
                </div>
              ))}
            </div>
            <div className="barlabels">{hist.map((h, i) => <span key={i}>{h.month.slice(5)}</span>)}</div>
            <div className="note">Blue bars are stockout-corrected (sold-out months uplifted to true demand).</div>
          </>
        ) : <div className="note">No complete sales history yet for this SKU.</div>}

        <div className="blk">Projection · next {sku.projection?.length || 0} months</div>
        <table className="mini">
          <thead><tr><th>Month</th><th className="r">Demand</th><th className="r">Incoming</th><th className="r">End balance</th></tr></thead>
          <tbody>
            {(sku.projection || []).map((p, i) => (
              <tr key={i}>
                <td>{p.month}</td>
                <td className="r">{n(p.demand)}</td>
                <td className="r">{p.incoming ? n(p.incoming) : "—"}</td>
                <td className={`r ${p.balance < 0 ? "gap-neg" : ""}`}>{n(p.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sku.stockoutMonth && (
          <div className="note">
            Projected to go negative in <b>{sku.stockoutMonth}</b>
            {sku.urgent ? " — inside the production lead time. Start production now." : "."}
          </div>
        )}
      </div>
    </>
  );
}
