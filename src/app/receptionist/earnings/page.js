"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import TherapistEarningsTable from "@/components/TherapistEarningsTable";
import { ErrorBox, Loading } from "@/components/States";
import { getBookings, getTherapists } from "@/lib/api";
import { dayStartISO, earningsByTherapist } from "@/lib/reports";
import useAsync from "@/lib/useAsync";

const RANGES = [
  { id: "today", label: "Today", from: 0 },
  { id: "week", label: "Last 7 days", from: -6 },
  { id: "month", label: "Last 30 days", from: -29 },
];

export default function ReceptionistEarnings() {
  const [range, setRange] = useState(RANGES[1]);
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([getBookings({ from: dayStartISO(range.from), to: dayStartISO(1), limit: 5000 }), getTherapists()]),
    [range.id],
  );

  return (
    <>
      <PageIntro
        eyebrow="Front desk"
        title="Therapist earnings"
        subtitle="Commissions are computed automatically from confirmed and completed sessions — no manual math."
      />
      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">{range.label}</h2>
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => setRange(r)} className={`rounded-full border px-3 py-1 text-[11px] ${range.id === r.id ? "border-forest bg-forest text-white" : "border-line"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <ErrorBox error={error} onRetry={reload} />
        {loading ? <Loading /> : data && <TherapistEarningsTable rows={earningsByTherapist(data[0], data[1])} />}
      </section>
    </>
  );
}
