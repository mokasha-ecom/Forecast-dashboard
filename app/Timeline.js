"use client";
import { useState, useMemo } from "react";

// Lane-based timeline with a draggable range slider (3-12 months, default 6).
// Each lane lays its events left-to-right. If a pill would overlap its neighbour
// it collapses to a dot; hovering any pill or dot shows the full detail.
export default function Timeline({ events, windowStart, onEvent }) {
  const [months, setMonths] = useState(6);
  const [hover, setHover] = useState(null);

  const start = useMemo(() => new Date(windowStart + "T00:00:00"), [windowStart]);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // visible window end = today + N months (start stays at -15 days for context)
  const end = useMemo(() => {
    const d = new Date(today); d.setMonth(d.getMonth() + months); return d;
  }, [months]);
  const span = end - start || 1;
  const rawPct = iso => ((new Date(iso + "T00:00:00") - start) / span) * 100;
  const todayPct = Math.max(0, Math.min(100, rawPct(today.toISOString().slice(0, 10))));

  // month ticks across the visible window
  const ticks = useMemo(() => {
    const out = [];
    const t = new Date(start.getFullYear(), start.getMonth(), 1);
    while (t <= end) {
      const p = ((t - start) / span) * 100;
      if (p >= -2 && p <= 102) out.push({ p, label: t.toLocaleDateString(undefined, { month: "short" }) });
      t.setMonth(t.getMonth() + 1);
    }
    return out;
  }, [start, end, span]);

  const lanes = [
    { key: "arrival", icon: "⚓", label: "Arrivals", color: "var(--blue)", bg: "var(--blue-bg)",
      match: e => e.type === "arrival" || e.type === "delayed" },
    { key: "plan", icon: "⚙", label: "Planned", color: "var(--green)", bg: "var(--green-bg)",
      match: e => e.type === "plan" },
    { key: "stockout", icon: "⚠", label: "Stockouts", color: "var(--red)", bg: "var(--red-bg)",
      match: e => e.type === "stockout" },
  ];

  const pillText = (e) => {
    if (e.type === "arrival" || e.type === "delayed") return `${e.batchRef} · ${compact(e.units)}`;
    if (e.type === "plan") return `${shortName(e.title)} · ${compact(e.units)}`;
    if (e.type === "stockout") return e.count > 1 ? `${e.title}: ${e.count}` : shortName(e.title);
    return e.title;
  };
  const estPct = (txt) => Math.min(42, 3.2 + txt.length * 0.95);

  // Decide per-event whether it renders as a pill or a dot, and its x position.
  const layout = (evs) => {
    const items = evs
      .map(e => ({ e, center: rawPct(e.date) }))
      .filter(it => it.center >= -1 && it.center <= 101)
      .sort((a, b) => a.center - b.center);
    let lastRight = -Infinity;
    items.forEach(it => {
      const w = estPct(pillText(it.e));
      let left = it.center - w / 2;
      // If a full pill would collide with the previous item, render a dot instead.
      if (left < lastRight + 1) {
        it.dot = true;
        it.left = it.center;                 // dots sit exactly on their date
        lastRight = Math.max(lastRight, it.center + 2.2); // dot ~2.2% wide
      } else {
        it.dot = false;
        it.left = Math.max(0, left);
        lastRight = it.left + w;
      }
    });
    // keep pills from running off the right edge
    const overflow = lastRight - 100;
    if (overflow > 0) items.forEach(it => { if (!it.dot) it.left = Math.max(0, it.left - overflow); });
    return items;
  };

  return (
    <div>
      <div className="tl2-ctrl">
        <span className="tl2-ctrl-label">Range</span>
        <input type="range" min="3" max="12" step="1" value={months}
          onChange={e => setMonths(+e.target.value)} className="tl2-slider" />
        <span className="tl2-ctrl-val">{months} months</span>
      </div>

      <div className="tl2">
        <div className="tl2-grid">
          {ticks.map((tk, i) => <div key={i} className="tl2-gl" style={{ left: `${tk.p}%` }} />)}
          <div className="tl2-today" style={{ left: `${todayPct}%` }} />
        </div>

        {lanes.map(lane => {
          const items = layout(events.filter(lane.match));
          return (
            <div className="tl2-lane" key={lane.key}>
              <div className="tl2-lanehead">
                <span className="tl2-ic" style={{ color: lane.color }}>{lane.icon}</span>{lane.label}
              </div>
              <div className="tl2-track">
                {items.length === 0 && <span className="tl2-none">No events</span>}
                {items.map((it, i) => {
                  const key = `${lane.key}-${i}`;
                  const common = {
                    onMouseEnter: () => setHover(key),
                    onMouseLeave: () => setHover(null),
                    onClick: () => onEvent && onEvent(it.e),
                  };
                  const tip = hover === key && (
                    <span className="tl2-tip">
                      <b>{it.e.title}</b><br />{it.e.detail}<br />
                      <span className="cta">Click for details →</span>
                    </span>
                  );
                  return it.dot ? (
                    <button key={key} className="tl2-dot" {...common}
                      style={{ left: `${it.left}%`, background: lane.color }}>{tip}</button>
                  ) : (
                    <button key={key} className="tl2-pill" {...common}
                      style={{ left: `${it.left}%`, background: lane.bg, color: lane.color }}>
                      {pillText(it.e)}{tip}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="tl2-axis">
          <div className="tl2-axishead" />
          <div className="tl2-axistrack">
            {ticks.map((tk, i) => <span key={i} className="tl2-month" style={{ left: `${tk.p}%` }}>{tk.label}</span>)}
            <span className="tl2-todaylabel" style={{ left: `${todayPct}%` }}>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function compact(nu) {
  if (nu == null) return "";
  if (nu >= 1000) return (nu / 1000).toFixed(nu >= 10000 ? 0 : 1) + "k";
  return String(nu);
}
function shortName(s) { return s && s.length > 16 ? s.slice(0, 15) + "…" : s; }
