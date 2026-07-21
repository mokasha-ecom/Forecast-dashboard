"use client";
import { useEffect, useState, useCallback } from "react";

// Shared fetch hook — one API call powers every page.
export function useData() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    setErr(null);
    fetch("/api/data").then(r => r.json()).then(d => {
      if (d.error) setErr(d.error); else setData(d);
    }).catch(e => setErr(String(e)));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { data, err, reload: load };
}

export function Pill({ status }) {
  const cls = status === "Out of Stock" ? "oos" : status === "Order Now" ? "order" : status === "Low Stock" ? "low" : "ok";
  return <span className={`pill ${cls}`}>{status}</span>;
}

export function Trend({ pct }) {
  if (pct === undefined || pct === null) return <span className="trend flat">—</span>;
  const cls = pct > 3 ? "up" : pct < -3 ? "down" : "flat";
  const arrow = pct > 3 ? "▲" : pct < -3 ? "▼" : "→";
  return <span className={`trend ${cls}`}>{arrow} {pct > 0 ? "+" : ""}{pct}%</span>;
}

export function ErrBox({ err }) {
  return (
    <div className="err">
      <b>Could not load data.</b><br />{err}<br /><br />
      Check that the Google Sheet is shared as “Anyone with the link – Viewer” and the tab names match config.js.
    </div>
  );
}

export function Loading() {
  return <div className="center">Loading your data…</div>;
}

export function n(x) { return (x ?? 0).toLocaleString(); }
export function label(s) { return [s.product, s.size, s.color].filter(Boolean).join(" / "); }
