"use client";
import { useState } from "react";

// Lane-based timeline: one row per event type, each event a labelled pill placed
// by date. Covers windowStart .. windowEnd (6 months). Click a pill -> onEvent.
export default function Timeline({ events, windowStart, windowEnd, onEvent }) {
  const [hover, setHover] = useState(null);
  const start = new Date(windowStart + "T00:00:00");
  const end = new Date(windowEnd + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const span = end - start || 1;
  const pct = iso => Math.max(1.5, Math.min(98.5, ((new Date(iso + "T00:00:00") - start) / span) * 100));
  const todayPct = Math.max(0, Math.min(100, ((today - start) / span) * 100));

  const ticks = [];
  const t = new Date(start.getFullYear(), start.getMonth(), 1);
  while (t <= end) {
    const p = ((t - start) / span) * 100;
    if (p >= 0 && p <= 100) ticks.push({ p, label: t.toLocaleDateString(undefined, { month: "short" }) });
    t.setMonth(t.getMonth() + 1);
  }

  const lanes = [
    { key: "arrival", icon: "\u2693", label: "Arrivals", color: "var(--blue)", bg: "var(--blue-bg)",
      match: e => e.type === "arrival" || e.type === "delayed" },
    { key: "plan", icon: "\u2699", label: "Planned", color: "var(--green)", bg: "var(--green-bg)",
      match: e => e.type === "plan" },
    { key: "stockout", icon: "\u26A0", label: "Stockouts", color: "var(--red)", bg: "var(--red-bg)",
      match: e => e.type === "stockout" },
  ];

  const pillText = (e) => {
    if (e.type === "arrival" || e.type === "delayed") return `${e.batchRef} \u00b7 ${compact(e.units)}`;
    if (e.type === "plan") return `${shortName(e.title)} \u00b7 ${compact(e.units)}`;
    if (e.type === "stockout") return e.count > 1 ? `${e.title}: ${e.count}` : e.title;
    return e.title;
  };

  return (
    <div className="tl2">
      <div className="tl2-grid">
        {ticks.map((tk, i) => <div key={i} className="tl2-gl" style={{ left: `${tk.p}%` }} />)}
        <div className="tl2-today" style={{ left: `${todayPct}%` }} />
      </div>

      {lanes.map(lane => {
        const evs = events.filter(lane.match);
        return (
          <div className="tl2-lane" key={lane.key}>
            <div className="tl2-lanehead">
              <span className="tl2-ic" style={{ color: lane.color }}>{lane.icon}</span>{lane.label}
            </div>
            <div className="tl2-track">
              {evs.length === 0 && <span className="tl2-none">\u2014</span>}
              {evs.map((e, i) => (
                <button key={i} className="tl2-pill"
                  style={{ left: `${pct(e.date)}%`, background: lane.bg, color: lane.color }}
                  onMouseEnter={() => setHover(`${lane.key}-${i}`)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onEvent && onEvent(e)}>
                  {pillText(e)}
                  {hover === `${lane.key}-${i}` && (
                    <span className="tl2-tip">
                      <b>{e.title}</b><br />{e.detail}<br /><span className="cta">Click for details \u2192</span>
                    </span>
                  )}
                </button>
              ))}
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
  );
}

function compact(nu) {
  if (nu == null) return "";
  if (nu >= 1000) return (nu / 1000).toFixed(nu >= 10000 ? 0 : 1) + "k";
  return String(nu);
}
function shortName(s) { return s.length > 14 ? s.slice(0, 13) + "\u2026" : s; }
