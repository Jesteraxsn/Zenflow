"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import { ErrorBox, Loading } from "@/components/States";
import { getClients } from "@/lib/api";
import { peso, shortDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import useAsync from "@/lib/useAsync";

export default function ClientsPage() {
  const { data, loading, error, reload } = useAsync(() => getClients(), []);
  const [query, setQuery] = useState("");

  if (loading) return <Loading label="Loading clients…" />;

  const clients = (data ?? []).filter((c) => `${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <PageIntro
        eyebrow="Administration"
        title="Clients"
        subtitle="Guests with a Ginhawa account, their visits and lifetime spend."
        action={
          <button
            onClick={() =>
              downloadCsv("ginhawa-clients.csv", clients.map((c) => ({ name: c.full_name, email: c.email, phone: c.phone, visits: c.visits, spent: c.spent, last_visit: c.last })))
            }
            className="btn-outline"
          >
            <Icon name="download" size={14} /> Export CSV
          </button>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      <section className="card overflow-x-auto">
        <div className="p-5">
          <div className="relative w-full sm:w-72">
            <Icon name="search" size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className="input py-2 pl-9 text-xs" placeholder="Search clients…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-tan/60 text-[10px] uppercase tracking-wider text-bark">
            <tr>
              {["Client", "Contact", "Visits", "Total spent", "Last booking", "Member since"].map((h) => (
                <th key={h} className="px-5 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-sand/50">
                <td className="px-5 py-3.5 font-semibold">{c.full_name || "—"}</td>
                <td className="px-5 py-3.5">
                  {c.email}
                  <span className="block text-[11px] text-muted">{c.phone || ""}</span>
                </td>
                <td className="px-5 py-3.5">{c.visits}</td>
                <td className="px-5 py-3.5 font-semibold">{peso(c.spent)}</td>
                <td className="px-5 py-3.5 text-muted">{c.last ? shortDate(c.last) : "—"}</td>
                <td className="px-5 py-3.5 text-muted">{shortDate(c.created_at)}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No clients found.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
