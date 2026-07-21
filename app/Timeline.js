"use client";
import { useState } from "react";

export default function Timeline({ events, windowStart, windowEnd, onEvent }) {
  const [tip, setTip] = useState(null);
  const start = new Date(windowStart + "T00:00:00");
  const end = new Date(windowEnd + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const span = end - start;
  const pos = iso => Math.max(0, Math.min(100, ((new Date(iso + "T00:00:00") - start) / span) * 100));
  const todayPct = ((today - start) / span) * 100;

  // month ticks
  const ticks = [];
  const t = new Date(start.getFullYear(), start.getMonth(), 1);
  while (t <= end) {
    const pct = ((t - start) / span) * 100;
    if (pct >= 0 && pct <= 100) ticks.push({ pct, label: t.toLocaleDateString(undefined, { month: "short" }) });
    t.setMonth(t.getMonth() + 1);
  }

  // fan out dots that share an exact x so they stay clickable
  const byPct = {};
  const laid = events.map((e, i) => {
    const p = Math.round(pos(e.date) * 2) / 2;
    byPct[p] = (byPct[p] || 0);
    const idx = byPct[p]++;
    return { e, i, p, stackIdx: idx };
  });
  const stackCount = {};
  laid.forEach(l => { stackCount[l.p] = (stackCount[l.p] || 0) + 1; });

  return (
    <>
      <div className="tl">
        <div className="tl-axis" />
        {ticks.map((tk, i) => (
          <span key={i}>
            <div className="tl-tick" style={{ left: `${tk.pct}%` }} />
            <div className="tl-ticklabel" style={{ left: `${tk.pct}%` }}>{tk.label}</div>
          </span>
        ))}
        <div className="tl-today" style={{ left: `${todayPct}%` }} />
        <div className="tl-todaylabel" style={{ left: `${todayPct}%` }}>Today</div>

        {laid.map(({ e, i, p, stackIdx }) => {
          const count = stackCount[p];
          const spread = count > 1 ? (stackIdx - (count - 1) / 2) * 17 : 0;
          return (
            <div key={i} className={`tl-dot ${e.type}`}
              style={{ left: `${p}%`, top: `${66 + spread}px` }}
              onMouseEnter={() => setTip(i)} onMouseLeave={() => setTip(null)}
              onClick={() => onEvent && onEvent(e)} />
          );
        })}

        {tip !== null && events[tip] && (
          <div className="tl-tip" style={{ left: `${pos(events[tip].date)}%` }}>
            <div className="t">{events[tip].title}</div>
            <div className="d">{events[tip].detail} · {events[tip].date}</div>
            <div className="cta">Click for details →</div>
          </div>
        )}
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--blue)" }} />Container arriving</span>
        <span><i style={{ background: "var(--green)" }} />Planned production due</span>
        <span><i style={{ background: "var(--red)" }} />Predicted stockout / delay</span>
      </div>
    </>
  );
}
