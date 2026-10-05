import { peso } from "@/lib/format";

// Simple bar chart; the highest day is emphasised like the design.
export default function EarningsChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const top = Math.max(...data.map((d) => d.amount));
  return (
    <div className="flex h-52 items-end gap-3">
      {data.map((d) => (
        <div key={d.key ?? d.day} className="group flex flex-1 flex-col items-center gap-2">
          <span className="text-[10px] text-muted opacity-0 transition group-hover:opacity-100">{peso(d.amount)}</span>
          <div
            className={`w-full rounded-t-sm transition ${d.amount === top && top > 0 ? "bg-forest" : "bg-sage group-hover:bg-forest/40"}`}
            style={{ height: `${Math.max(2, (d.amount / max) * 150)}px` }}
            title={`${d.day}: ${peso(d.amount)}`}
          />
          <span className="text-[10px] text-muted">{d.day}</span>
        </div>
      ))}
    </div>
  );
}
