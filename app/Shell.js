"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { href: "/", label: "Dashboard", ic: "▦" },
  { href: "/pipeline", label: "Pipeline", ic: "⇢" },
  { href: "/production", label: "Production", ic: "⚙" },
  { href: "/inventory", label: "Inventory & SKUs", ic: "▤" },
  { href: "/sales", label: "Sales analytics", ic: "▲" },
];

export default function Shell({ children }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = NAV.find(n => n.href === path)?.label || "Demand Command";

  return (
    <div className="shell">
      {open && <div className="navscrim" onClick={() => setOpen(false)} />}
      <aside className={`side ${open ? "open" : ""}`}>
        <div className="logo">Demand Command<span>Planning control center</span></div>
        <nav>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className={path === n.href ? "active" : ""} onClick={() => setOpen(false)}>
              <span className="ic">{n.ic}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="foot">Reads live from your Google Sheet · refreshes every ~5 min</div>
      </aside>
      <div className="main">
        <div className="mtop">
          <button onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <span className="t">{current}</span>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
