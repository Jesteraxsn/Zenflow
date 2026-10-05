"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import AccordionPanel from "@/components/AccordionPanel";
import EarningsChart from "@/components/EarningsChart";
import TherapistEarningsTable from "@/components/TherapistEarningsTable";
import { ErrorBox, Loading } from "@/components/States";
import { getBookings, getTherapists } from "@/lib/api";
import { dateKey, peso, timeOf } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { dailyEarnings, dayStartISO, earningsByService, earningsByTherapist, isEarning } from "@/lib/reports";
import useAsync from "@/lib/useAsync";

const RANGES = [
  { id: "week", label: "Last 7 days", days: 7 },
  { id: "month", label: "Last 30 days", days: 30 },
  { id: "quarter", label: "Last 90 days", days: 90 },
];

export default function FinancialReports() {
  const [range, setRange] = useState(RANGES[0]);
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([getBookings({ from: dayStartISO(-range.days + 1), to: dayStartISO(1), limit: 5000 }), getTherapists()]),
    [range.id],
  );

  if (loading) return <Loading label="Crunching the numbers…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const [bookings, therapists] = data;
  const earning = bookings.filter(isEarning);
  const byTherapist = earningsByTherapist(bookings, therapists);
  const byService = earningsByService(bookings);
  const gross = earning.reduce((s, b) => s + Number(b.price), 0);
  const commission = byTherapist.reduce((s, r) => s + r.commission, 0);
  const noShows = bookings.filter((b) => b.status === "no_show").length;
  const finished = bookings.filter((b) => ["completed", "no_show"].includes(b.status)).length;
  const chart = dailyEarnings(bookings, Math.min(range.days, 14));

  const exportTransactions = () =>
    downloadCsv(
      `ginhawa-transactions-${range.id}.csv`,
      earning.map((b) => ({
        code: b.code,
        date: dateKey(b.starts_at),
        time: timeOf(b.starts_at),
        client: b.client_name,
        service: b.service?.name,
        therapist: b.therapist?.full_name,
        source: b.source,
        status: b.status,
        amount: b.price,
      })),
    );
  const exportCommissions = () =>
    downloadCsv(`ginhawa-commissions-${range.id}.csv`, byTherapist.map(({ id, ...r }) => r));

  const sections = [
    {
      id: "total",
      label: "Aggregated total earnings",
      content: (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => setRange(r)} className={`rounded-full border px-3 py-1 text-[11px] ${range.id === r.id ? "border-forest bg-forest text-white" : "border-line"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            {[
              ["Gross revenue", peso(gross)],
              ["Therapist commissions", peso(commission)],
              ["Net to sanctuary", peso(gross - commission)],
              ["No-show rate", finished ? `${((noShows / finished) * 100).toFixed(1)}%` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-sand p-4">
                <p className="text-[11px] text-muted">{k}</p>
                <p className="font-serif text-2xl">{v}</p>
              </div>
            ))}
          </div>
          <EarningsChart data={chart} />
        </div>
      ),
    },
    { id: "therapist", label: "Per-therapist earnings breakdown", content: <TherapistEarningsTable rows={byTherapist} /> },
    {
      id: "service",
      label: "Service popularity",
      content: (
        <ul className="space-y-2 text-xs">
          {byService.map((s) => (
            <li key={s.service}>
              <div className="flex justify-between">
                <span className="font-medium">{s.service}</span>
                <span>{s.sessions} sessions · {peso(s.gross)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-sand">
                <div className="h-1.5 rounded-full bg-forest" style={{ width: `${(s.gross / (byService[0]?.gross || 1)) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "export",
      label: "Export report (PDF/CSV)",
      content: (
        <div className="flex flex-wrap gap-3">
          <button onClick={exportTransactions} className="btn-outline">Transactions CSV</button>
          <button onClick={exportCommissions} className="btn-outline">Commissions CSV</button>
          <button onClick={() => window.print()} className="btn-outline">Print / save as PDF</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageIntro eyebrow="Administration" title="Financial reports" subtitle={`Earnings and therapist commissions · ${range.label.toLowerCase()}.`} />
      <AccordionPanel title="Financial reports" sections={sections} action={<button onClick={exportTransactions} className="btn-primary">Generate financial report</button>} />
    </>
  );
}
