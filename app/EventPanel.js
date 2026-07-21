"use client";
import { useRouter } from "next/navigation";
import { n } from "./ui";

export default function EventPanel({ event, onClose }) {
  const router = useRouter();
  if (!event) return null;
  const e = event;
  const isArrival = e.type === "arrival" || e.type === "delayed";
  const isPlan = e.type === "plan";
  const isStockout = e.type === "stockout";

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="panelside">
        <button className="close" onClick={onClose} aria-label="Close">✕</button>

        {isArrival && (
          <>
            <h3>Container {e.batchRef}</h3>
            <div className="sub">Arriving {e.date} · {n(e.units)} units total</div>
            <div className="blk">Products in this container</div>
            <table className="mini">
              <thead><tr><th>Product</th><th className="r">Units</th></tr></thead>
              <tbody>
                {(e.products || []).map((p, i) => (
                  <tr key={i}><td>{p.name}</td><td className="r">{n(p.units)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="note" style={{ marginTop: 14 }}>
              <span className="linkish" onClick={() => router.push("/pipeline")}>Open full Pipeline page →</span>
            </div>
          </>
        )}

        {isPlan && (
          <>
            <h3>{e.title}</h3>
            <div className="sub">Planned production due {e.date}</div>
            <div className="kv"><div><div className="k">Planned units</div><div className="v">{e.detail}</div></div></div>
            <div className="note">
              <span className="linkish" onClick={() => router.push("/production")}>Open Production planning →</span>
            </div>
          </>
        )}

        {isStockout && (
          <>
            <h3>{e.title}</h3>
            <div className="sub">Predicted stockout around {e.date}</div>
            {e.count > 1 ? (
              <>
                <div className="blk">{e.count} variations at risk</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(e.variants || []).map((v, i) => (
                    <span key={i} className="pill low" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{v}</span>
                  ))}
                </div>
              </>
            ) : <div className="note">{e.detail}</div>}
            <div className="note" style={{ marginTop: 14 }}>
              <span className="linkish" onClick={() => router.push("/inventory")}>See all variations in Inventory →</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
