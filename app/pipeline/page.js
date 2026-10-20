"use client";
import { useState, useMemo } from "react";
import { useData, ErrBox, Loading, n } from "../ui";

export default function PipelinePage() {
  const { data, err, reload } = useData();
  const [show, setShow] = useState("incoming"); // incoming | arrived | all
  const [q, setQ] = useState("");

  const batches = useMemo(() => {
    if (!data) return [];
    // Group by batch ref + arrived state only (a container is one shipment). If its
    // rows carry different ETAs, show the latest. This keeps one container = one card.
    const map = {};
    data.pipeline.forEach(r => {
      const key = r.ref + "|" + (r.arrived ? "a" : "i");
      const b = (map[key] = map[key] || { ref: r.ref, eta: r.eta, arrived: r.arrived, status: r.status, units: 0, lines: [] });
      if (r.eta && (!b.eta || r.eta > b.eta)) b.eta = r.eta;
      if (/delayed/i.test(r.status || "")) b.status = r.status;
      b.units += r.units; b.lines.push(r);
    });
    return Object.values(map).sort((a, b) => (a.eta || "").localeCompare(b.eta || ""));
  }, [data]);

  if (err) return <ErrBox err={err} />;
  if (!data) return <Loading />;

  const filtered = batches.filter(b => {
    if (show === "incoming" && b.arrived) return false;
    if (show === "arrived" && !b.arrived) return false;
    if (q && !(`${b.ref}`.toLowerCase().includes(q.toLowerCase()) ||
      b.lines.some(l => l.product.toLowerCase().includes(q.toLowerCase())))) return false;
    return true;
  });

  const incomingUnits = batches.filter(b => !b.arrived).reduce((a, b) => a + b.units, 0);

  return (
    <>
      <div className="phead">
        <div><h1>Pipeline</h1><div className="sub">Incoming containers and shipments by batch.</div></div>
        <div className="meta"><button className="refresh" onClick={reload}>Refresh</button></div>
      </div>

      <div className="tiles">
        <div className="tile blue"><div className="n">{batches.filter(b => !b.arrived).length}</div><div className="l">Incoming batches</div></div>
        <div className="tile"><div className="n">{n(incomingUnits)}</div><div className="l">Units in transit</div></div>
        <div className="tile green"><div className="n">{batches.filter(b => b.arrived).length}</div><div className="l">Arrived batches</div></div>
      </div>

      <div className="section">
        <div className="filters">
          <div className="seg">
            <button className={show === "incoming" ? "on" : ""} onClick={() => setShow("incoming")}>Incoming</button>
            <button className={show === "arrived" ? "on" : ""} onClick={() => setShow("arrived")}>Arrived</button>
            <button className={show === "all" ? "on" : ""} onClick={() => setShow("all")}>All</button>
          </div>
          <input placeholder="Search batch or product…" value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {filtered.length === 0 && <div className="empty">No batches match.</div>}
        {filtered.map((b, i) => (
          <Batch key={i} b={b} />
        ))}
      </div>
    </>
  );
}

function Batch({ b }) {
  const [open, setOpen] = useState(false);
  const delayed = /delayed/i.test(b.status || "");
  return (
    <div className="prodrow" style={{ marginBottom: 8 }}>
      <div className="head" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 34px" }} onClick={() => setOpen(o => !o)}>
        <div className="pname">Container {b.ref}<small>{b.lines.length} product line(s)</small></div>
        <div className="cell"><span className="cl">ETA</span><span className="cv" style={{ fontSize: 13 }}>{b.eta || "—"}</span></div>
        <div className="cell"><span className="cl">Units</span><span className="cv" style={{ fontSize: 15 }}>{n(b.units)}</span></div>
        <div className="cell"><span className="cl">Status</span>
          <span className={`pill ${b.arrived ? "ok" : delayed ? "oos" : "low"}`}>{b.status || (b.arrived ? "Arrived" : "In Transit")}</span>
        </div>
        <div className="chev" style={{ transform: open ? "rotate(90deg)" : "" }}>›</div>
      </div>
      {open && (
        <div className="subvars">
          <table>
            <thead><tr><th>SKU</th><th>Product</th><th className="r">Units</th><th className="hidemobile">Notes</th></tr></thead>
            <tbody>
              {b.lines.sort((a, c) => c.units - a.units).map((l, i) => (
                <tr key={i}><td className="mono">{l.sku}</td><td>{l.product}</td><td className="r">{n(l.units)}</td><td className="hidemobile" style={{ color: "var(--faint)" }}>{l.notes || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
