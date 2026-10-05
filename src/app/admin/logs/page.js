"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import AccordionPanel from "@/components/AccordionPanel";
import { ErrorBox, Loading } from "@/components/States";
import { getLogs } from "@/lib/api";
import { peso, relativeTime, shortDate, timeOf } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import useAsync from "@/lib/useAsync";
import useNow from "@/lib/useNow";

const TYPES = ["all", "booking", "payment", "pricing", "schedule", "cancellation"];

export default function SystemLogs() {
  const { data, loading, error, reload } = useAsync(() => getLogs(500), [], { pollMs: 20000 });
  const [type, setType] = useState("all");
  const [days, setDays] = useState(90);
  const now = useNow();

  if (loading) return <Loading label="Loading audit trail…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const cutoff = now - days * 86400000;
  const logs = data.filter((l) => new Date(l.created_at).getTime() >= cutoff);
  const audit = logs.filter((l) => l.type !== "security" && (type === "all" || l.type === type));
  const security = logs.filter((l) => l.type === "security");

  const sections = [
    {
      id: "audit",
      label: "Audit trail activity table",
      content: (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)} className={`rounded-full border px-3 py-1 text-[11px] capitalize ${type === t ? "border-forest bg-forest text-white" : "border-line"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wider text-muted">
                <tr><th className="py-2">When</th><th className="py-2">User</th><th className="py-2">Action</th><th className="py-2 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 text-muted" title={`${shortDate(l.created_at)} ${timeOf(l.created_at)}`}>{relativeTime(l.created_at)}</td>
                    <td className="py-2.5">{l.actor_name}<span className="block text-[10px] capitalize text-muted">{l.actor_role}</span></td>
                    <td className="py-2.5">{l.action}</td>
                    <td className="py-2.5 text-right font-semibold">{l.amount ? peso(l.amount) : "—"}</td>
                  </tr>
                ))}
                {audit.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">No entries.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ),
    },
    {
      id: "security",
      label: "System security events",
      content: (
        <ul className="space-y-2 text-xs">
          {security.map((l) => (
            <li key={l.id} className="flex justify-between rounded-lg bg-rose/5 px-4 py-3">
              <span>{l.action}</span>
              <span className="text-muted">{relativeTime(l.created_at)}</span>
            </li>
          ))}
          {security.length === 0 && <li className="text-muted">No security events.</li>}
        </ul>
      ),
    },
    {
      id: "archive",
      label: "Archive / cleanup filters",
      content: (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Show entries from the last</label>
            <select className="input w-48" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 7, 30, 90, 365].map((d) => <option key={d} value={d}>{d === 1 ? "24 hours" : `${d} days`}</option>)}
            </select>
          </div>
          <p className="pb-3 text-[11px] text-muted">{logs.length} entries in range. Older entries are archived, not deleted.</p>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageIntro eyebrow="Administration" title="System logs" subtitle="Audit trail of bookings, payments, pricing changes and security events. Updates live." />
      <AccordionPanel
        title="System logs"
        sections={sections}
        action={
          <button
            onClick={() =>
              downloadCsv("ginhawa-audit-log.csv", logs.map((l) => ({ when: l.created_at, user: l.actor_name, role: l.actor_role, type: l.type, action: l.action, amount: l.amount })))
            }
            className="btn-primary"
          >
            Export logs
          </button>
        }
      />
    </>
  );
}
