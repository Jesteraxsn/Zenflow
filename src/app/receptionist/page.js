"use client";

import Link from "next/link";
import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { ErrorBox, Loading, Toast } from "@/components/States";
import { getBookings, getTherapists, setBookingStatus, verifyPayment } from "@/lib/api";
import { bookableTherapists } from "@/lib/availability";
import { TIME_SLOTS } from "@/lib/constants";
import { longDate, peso, startsAtISO, timeOf, todayKey } from "@/lib/format";
import { dayStartISO } from "@/lib/reports";
import useAsync from "@/lib/useAsync";
import useNow from "@/lib/useNow";
import useToast from "@/lib/useToast";

const cellStyle = {
  pending_payment: "bg-sand",
  pending_verification: "bg-tan",
  confirmed: "bg-sage",
  completed: "bg-sand text-muted",
  no_show: "bg-rose/10 text-rose",
};

export default function ReceptionistToday() {
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([getBookings({ from: dayStartISO(0), to: dayStartISO(1) }), getTherapists(), getBookings({ from: dayStartISO(1), to: dayStartISO(30) })]),
    [],
    { pollMs: 15000 },
  );
  const [working, setWorking] = useState(null);
  const [toast, showToast] = useToast();
  const now = useNow(30000);

  if (loading) return <Loading label="Loading today's schedule…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const [todays, therapists, future] = data;
  const live = todays.filter((b) => b.status !== "cancelled");
  const toVerify = [...todays, ...future].filter((b) => b.status === "pending_verification");
  const onShift = bookableTherapists(therapists);
  const today = todayKey();

  const slotFor = (therapistId, slot) => {
    const start = new Date(startsAtISO(today, slot.value)).getTime();
    return live.find((b) => b.therapist_id === therapistId && Math.abs(new Date(b.starts_at).getTime() - start) < 45 * 60000);
  };

  async function act(booking, fn, message) {
    setWorking(booking.id);
    try {
      await fn();
      showToast(message);
      reload();
    } finally {
      setWorking(null);
    }
  }

  const stats = [
    ["Sessions today", live.length],
    ["Still to come", live.filter((b) => new Date(b.starts_at).getTime() > now && b.status === "confirmed").length],
    ["Payments to verify", toVerify.length],
    ["Collected today", peso(live.filter((b) => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + Number(b.price), 0))],
  ];

  return (
    <>
      <PageIntro
        eyebrow={longDate(today)}
        title="Today at the sanctuary"
        subtitle="Every therapist's schedule at a glance — no more flipping through logbooks. Updates live."
        action={
          <Link href="/receptionist/walk-in" className="btn-primary">
            <Icon name="plus" size={14} /> Encode walk-in
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-[11px] text-muted">{k}</p>
            <p className="font-serif text-2xl">{v}</p>
          </div>
        ))}
      </div>

      {toVerify.length > 0 && (
        <section className="card mb-5 border-tan bg-tan/40 p-5">
          <h2 className="font-serif text-xl">Payments awaiting verification</h2>
          <ul className="mt-3 divide-y divide-line/70">
            {toVerify.map((b) => {
              const payment = b.payments?.at(-1);
              return (
                <li key={b.id} className={`flex flex-wrap items-center justify-between gap-3 py-2.5 text-xs ${working === b.id ? "opacity-50" : ""}`}>
                  <span>
                    <span className="font-semibold">{b.code}</span> · {b.client_name} · {b.service?.name} ·{" "}
                    <span className="text-muted">{longDate(b.starts_at).split(",").slice(0, 2).join(",")} {timeOf(b.starts_at)}</span>
                    {payment?.reference && <span className="block text-[11px] text-muted">Ref {payment.reference}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{peso(b.price)}</span>
                    {payment && (
                      <button
                        disabled={working === b.id}
                        onClick={() => act(b, () => verifyPayment(payment.id, true), `${b.code} confirmed`)}
                        className="rounded-full bg-forest px-3 py-1 text-[10px] font-semibold text-white hover:bg-forest-dark"
                      >
                        Verify
                      </button>
                    )}
                    <Link href="/receptionist/bookings" className="text-[11px] text-forest hover:underline">Details</Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card overflow-x-auto">
        <div className="p-5">
          <h2 className="font-serif text-2xl">Therapist schedule</h2>
          <p className="text-[11px] text-muted">Booked slots are blocked automatically, so double-booking can&apos;t happen. Click a confirmed session to mark it done.</p>
        </div>
        <table className="w-full min-w-[860px] text-xs">
          <thead className="bg-tan/60 text-[10px] uppercase tracking-wider text-bark">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Therapist</th>
              {TIME_SLOTS.map((t) => <th key={t.value} className="px-2 py-3 font-semibold">{t.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {onShift.map((t) => (
              <tr key={t.id}>
                <td className="px-5 py-3">
                  <span className="font-semibold">{t.full_name}</span>
                  <span className="block text-[10px] text-muted">{t.status} · {t.shift_start.slice(0, 5)}–{t.shift_end.slice(0, 5)}</span>
                </td>
                {TIME_SLOTS.map((slot) => {
                  const b = slotFor(t.id, slot);
                  const past = new Date(startsAtISO(today, slot.value)).getTime() < now;
                  return (
                    <td key={slot.value} className="px-1.5 py-2">
                      {b ? (
                        <button
                          disabled={b.status !== "confirmed" || working === b.id}
                          onClick={() => act(b, () => setBookingStatus(b, "completed"), `${b.code} marked completed`)}
                          title={b.status === "confirmed" ? "Mark completed" : undefined}
                          className={`w-full rounded-md px-2 py-1.5 text-left ${cellStyle[b.status] ?? "bg-sand"} ${b.status === "confirmed" ? "hover:ring-2 hover:ring-forest/30" : "cursor-default"}`}
                        >
                          <p className="truncate font-semibold">{b.client_name}</p>
                          <p className="truncate text-[10px] text-muted">{b.service?.name}</p>
                        </button>
                      ) : (
                        <div className={`rounded-md border border-dashed border-line py-3 text-center text-[10px] ${past ? "text-muted/40" : "text-muted"}`}>
                          {past ? "—" : "Open"}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-4 p-5 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sage" /> Confirmed</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-tan" /> Verifying payment</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sand" /> Completed / awaiting payment</span>
          <span className="ml-auto flex items-center gap-1.5"><StatusBadge status="confirmed" /> click to complete</span>
        </div>
      </section>
      <Toast message={toast} />
    </>
  );
}
