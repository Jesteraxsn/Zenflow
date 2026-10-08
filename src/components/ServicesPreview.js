"use client";

import { getServices } from "@/lib/api";
import { fromPrice } from "@/lib/pricing";
import useAsync from "@/lib/useAsync";

export default function ServicesPreview() {
  const { data: services, loading } = useAsync(() => getServices(), []);

  if (loading) return <p className="py-6 text-center text-xs text-muted">Loading treatments…</p>;

  return (
    <ul className="divide-y divide-line">
      {(services ?? []).map((s) => (
        <li key={s.id} className="flex items-center justify-between py-3 text-sm">
          <span>
            <span className="font-semibold">{s.name}</span>
            <span className="ml-2 text-xs text-muted">({s.durations.join(" / ")} mins)</span>
          </span>
          <span className="font-semibold">{fromPrice(s)}</span>
        </li>
      ))}
    </ul>
  );
}
