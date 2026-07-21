"use client";
import { useState } from "react";
import { useData, Pill, Trend, ErrBox, Loading, n } from "./ui";
import Timeline from "./Timeline";
import EventPanel from "./EventPanel";
import SkuPanel from "./SkuPanel";

export default function Dashboard() {
  const { data, err, reload } = useData();
  const [openProd, setOpenProd] = useState({});
  const [event, setEvent] = useState(null);
  const [skuId, setSkuId] = useState(null);

  if (err) return <ErrBox err={err} />;
  if (!data) return <Loading />;

  const { counts, urgentCount, incomingUnits, staleDays, alerts, events, products, settings } = data;
  const sku = skuId ? data.skus.find(s => s.id === skuId) : null;
  const toggle = p => setOpenProd(o => ({ ...o, [p]: !o[p] }));

  return (
    <>
      <div className="phead">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">What you have, what's coming, and what to produce — at a glance.</div>
        </div>
        <div className="meta">
          {staleDays !== null && (
            <span className={staleDays > 3 ? "stale" : ""}>
              Inventory updated {staleDays === 0 ? "today" : `${staleDays} day${staleDays > 1 ? "s" : ""} ago`}
            </span>
          )}
          <button className="refresh" onClick={reload}>Refresh</button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile red"><div className="n">{counts["Out of Stock"]}</div><div className="l">Out of stock (all SKUs)</div></div>
        <div className="tile red"><div className="n">{urgentCount}</div><div className="l">Urgent — run out before production lands</div></div>
        <div className="tile amber"><div className="n">{counts["Order Now"]}</div><div className="l">Start production now</div></div>
        <div className="tile blue"><div className="n">{counts["Low Stock"]}</div><div className="l">Low stock — watch</div></div>
        <div className="tile green"><div className="n">{counts["Healthy"]}</div><div className="l">Healthy</div></div>
        <div className="tile"><div className="n">{n(incomingUnits)}</div><div className="l">Units incoming</div></div>
      </div>

      <div className="section">
        <h2>Next 6 months <span className="hint">containers, planned production & predicted stockouts</span></h2>
        <Timeline events={events} windowStart={data.windowStart} windowEnd={data.windowEnd} onEvent={setEvent} />
      </div>

      {/* MANAGEMENT WIDGET */}
      <div className="section">
        <h2>
          Have + on the way + planned vs what you need
          <span className="hint">per product · {settings.leadTime}+{settings.coverage} month window</span>
        </h2>

        <div className="prodrow" style={{ border: "none", background: "transparent" }}>
          <div className="head" style={{ cursor: "default", padding: "0 14px 6px" }}>
            <div className="pname" style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Product</div>
            <div className="cell"><span className="cl">Have</span></div>
            <div className="cell"><span className="cl">On the way</span></div>
            <div className="cell hidesm"><span className="cl">Planned</span></div>
            <div className="cell"><span className="cl">Need</span></div>
            <div className="cell gap"><span className="cl">Surplus / short</span></div>
            <div className="cell"><span className="cl">Produce</span></div>
            <div />
          </div>
        </div>

        {products.map(p => (
          <div key={p.product} className={`prodrow ${openProd[p.product] ? "open" : ""}`}>
            <div className="head" onClick={() => toggle(p.product)}>
              <div className="pname">
                {p.product}
                {p.anyUrgent && <span className="urgentflag">URGENT</span>}
                <small>{p.variantCount} variations{p.oosCount ? ` · ${p.oosCount} OOS` : ""}</small>
              </div>
              <div className="cell"><span className="cv">{n(p.stock)}</span></div>
              <div className="cell"><span className="cv">{n(p.incoming)}</span></div>
              <div className="cell hidesm"><span className="cv">{n(p.planned)}</span></div>
              <div className="cell"><span className="cv">{n(p.need)}</span></div>
              <div className="cell gap"><span className={`cv ${p.gap < 0 ? "neg" : "pos"}`}>{p.gap > 0 ? "+" : ""}{n(p.gap)}</span></div>
              <div className="cell"><span className="cv">{p.recommend > 0 ? <span className="recbadge">{n(p.recommend)}</span> : "—"}</span></div>
              <div className="chev">›</div>
            </div>

            {openProd[p.product] && (
              <div className="subvars">
                <div className="sv-h">Top {p.topVariations.length} best-selling variations</div>
                <table>
                  <thead><tr>
                    <th>Variation</th><th className="r">Stock</th><th className="r">Forecast/mo</th>
                    <th className="r hidemobile">Trend</th><th className="r">Days cover</th>
                    <th className="r">Produce</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {p.topVariations.map(v => (
                      <tr key={v.id} className="click" onClick={() => setSkuId(v.id)}>
                        <td><b>{v.label}</b></td>
                        <td className="r">{n(v.stock)}</td>
                        <td className="r">{n(v.forecastMonthly)}</td>
                        <td className="r hidemobile"><Trend pct={v.trendPct} /></td>
                        <td className="r">{v.coverDays === 999 ? "—" : v.coverDays}</td>
                        <td className="r">{v.recommend > 0 ? n(v.recommend) : "—"}</td>
                        <td><Pill status={v.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        <div className="note">
          Have = current stock · On the way = pipeline containers · Planned = production plan ·
          Need = forecast demand over the next {settings.leadTime + settings.coverage} months.
          Negative surplus means you're short — the Produce column recommends how much to make.
        </div>
      </div>

      {/* ALERTS */}
      <div className="section">
        <h2>Alerts <span className="hint">out-of-stock shown only for movers ≥ {settings.dashboardOosMin}/mo</span></h2>
        {alerts.length === 0 && <div className="empty">No alerts. Everything is inside its thresholds.</div>}
        {alerts.slice(0, 40).map((a, i) => (
          <div key={i} className={`alert t${a.tier}`} onClick={() => a.sku && setSkuId(a.sku)}>
            <span className="b">{a.tier === 1 ? "Act today" : a.tier === 2 ? "This week" : "Watch"}</span>
            <span>{a.text}</span>
          </div>
        ))}
        {alerts.length > 40 && <div className="note">+{alerts.length - 40} more — see Inventory & SKUs for the full list.</div>}
      </div>

      {event && <EventPanel event={event} onClose={() => setEvent(null)} />}
      {sku && <SkuPanel sku={sku} onClose={() => setSkuId(null)} />}
    </>
  );
}
