"use client";

import { useState } from "react";
import Icon from "./Icon";

// Dark-headed panel with collapsible sections (pricing, reports, logs pages).
export default function AccordionPanel({ title, sections, action }) {
  const [open, setOpen] = useState(sections[0]?.id);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-card">
      <h2 className="bg-espresso px-5 py-3 text-xs font-semibold text-white">{title}</h2>
      {sections.map((s, i) => (
        <div key={s.id} className="border-b border-line last:border-0">
          <button
            onClick={() => setOpen(open === s.id ? null : s.id)}
            className={`flex w-full items-center gap-2 px-5 py-3 text-left text-xs ${i % 2 === 0 ? "bg-sand/60" : ""}`}
          >
            <Icon name="chevronRight" size={13} className={`transition ${open === s.id ? "rotate-90" : ""}`} />
            {s.label}
          </button>
          {open === s.id && <div className="px-5 pt-2 pb-5">{s.content}</div>}
        </div>
      ))}
      {action && <div className="flex justify-center border-t border-line px-5 py-6">{action}</div>}
    </section>
  );
}
