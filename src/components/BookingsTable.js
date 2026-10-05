"use client";

import { useState } from "react";
import Icon from "./Icon";
import StatusBadge from "./StatusBadge";
import { ErrorBox, Loading, Toast } from "./States";
import { cancelBooking, deleteBooking, getBookings, proofUrl, setBookingStatus, verifyPayment } from "@/lib/api";
import { PAYMENT_METHODS } from "@/lib/constants";
import { dateKey, peso, shortDate, timeOf, todayKey } from "@/lib/format";
import useAsync from "@/lib/useAsync";
import useToast from "@/lib/useToast";

const TABS = [
  { id: "verify", label: "To verify", test: (b) => b.status === "pending_verification" },
  { id: "today", label: "Today", test: (b) => dateKey(b.starts_at) === todayKey() },
  { id: "upcoming", label: "Upcoming", test: (b) => ["confirmed", "pending_payment", "pending_verification"].includes(b.status) && new Date(b.starts_at) > new Date() },
  { id: "completed", label: "Completed", test: (b) => b.status === "completed" },
  { id: "closed", label: "Cancelled / no-show", test: (b) => ["cancelled", "no_show"].includes(b.status) },
  { id: "all", label: "All", test: () => true },
];

// Booking list with payment verification, used by the admin and front-desk portals.
export default function BookingsTable({ canDelete = false, initialTab = "verify" }) {
  const { data, loading, error, reload } = useAsync(() => getBookings(), [], { pollMs: 15000 });
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [working, setWorking] = useState(null);
  const [toast, showToast] = useToast();
  const [actionError, setActionError] = useState(null);

  const rows = data ?? [];
  const activeTab = TABS.find((t) => t.id === tab);
  const visible = rows
    .filter(activeTab.test)
    .filter((b) =>
      `${b.code} ${b.client_name} ${b.service?.name} ${b.therapist?.full_name}`.toLowerCase().includes(query.toLowerCase()),
    );
  if (["verify", "today", "upcoming"].includes(tab)) visible.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  async function run(booking, fn, message) {
    setWorking(booking.id);
    setActionError(null);
    try {
      await fn();
      showToast(message);
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setWorking(null);
    }
  }

  async function openProof(path) {
    try {
      window.open(await proofUrl(path), "_blank", "noopener");
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const count = rows.filter(t.test).length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full border px-3 py-1.5 text-[11px] ${tab === t.id ? "border-forest bg-forest text-white" : "border-line hover:border-forest"}`}
              >
                {t.label}
                {t.id !== "all" && count > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 ${tab === t.id ? "bg-white/20" : t.id === "verify" ? "bg-tan text-bark" : "bg-sand"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon name="search" size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className="input py-2 pl-9 text-xs sm:w-60" placeholder="Search code, client, therapist…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button onClick={reload} className="rounded-full p-2 text-muted hover:bg-sand hover:text-forest" title="Refresh" aria-label="Refresh">
            <Icon name="clock" size={16} />
          </button>
        </div>
      </div>

      <div className="px-5">
        <ErrorBox error={error || actionError} onRetry={error ? reload : undefined} />
      </div>

      {loading ? (
        <Loading label="Loading bookings…" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-tan/60 text-[10px] uppercase tracking-wider text-bark">
              <tr>
                {["Booking", "Client", "Treatment", "Therapist", "Schedule", "Payment", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((b) => {
                const payment = b.payments?.at(-1);
                const busy = working === b.id;
                return (
                  <tr key={b.id} className={`hover:bg-sand/50 ${busy ? "opacity-50" : ""}`}>
                    <td className="py-3 pr-4 pl-5">
                      <span className="font-semibold">{b.code}</span>
                      <span className="block text-[10px] text-muted">{b.source === "walk_in" ? "Walk-in" : "Online"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {b.client_name}
                      {b.client_phone && <span className="block text-[10px] text-muted">{b.client_phone}</span>}
                    </td>
                    <td className="px-4 py-3">{b.service?.name}</td>
                    <td className="px-4 py-3 text-muted">{b.therapist?.full_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{shortDate(b.starts_at)} · {timeOf(b.starts_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{peso(b.price)}</span>
                      {payment && (
                        <span className="block text-[10px] text-muted">
                          {PAYMENT_METHODS[payment.method]}
                          {payment.reference && ` · ${payment.reference}`}
                        </span>
                      )}
                      {payment?.proof_path && (
                        <button onClick={() => openProof(payment.proof_path)} className="text-[10px] font-semibold text-forest hover:underline">
                          View proof ↗
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {b.status === "pending_verification" && payment && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => run(b, () => verifyPayment(payment.id, true), `${b.code} verified and confirmed`)}
                              className="rounded-full bg-forest px-3 py-1 text-[10px] font-semibold text-white hover:bg-forest-dark"
                            >
                              Verify
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => run(b, () => verifyPayment(payment.id, false), `${b.code} payment rejected`)}
                              className="rounded-full border border-rose px-3 py-1 text-[10px] font-semibold text-rose hover:bg-rose/5"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {b.status === "confirmed" && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => run(b, () => setBookingStatus(b, "completed"), `${b.code} marked completed`)}
                              className="rounded-full border border-forest px-3 py-1 text-[10px] font-semibold text-forest hover:bg-sage"
                            >
                              Done
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => run(b, () => setBookingStatus(b, "no_show"), `${b.code} marked no-show`)}
                              className="rounded-full border border-line px-3 py-1 text-[10px] text-muted hover:border-rose hover:text-rose"
                            >
                              No-show
                            </button>
                          </>
                        )}
                        {["pending_payment", "pending_verification", "confirmed"].includes(b.status) && (
                          <button
                            disabled={busy}
                            onClick={() => run(b, () => cancelBooking(b.id), `${b.code} cancelled`)}
                            className="px-1 text-[10px] text-muted hover:text-rose"
                          >
                            Cancel
                          </button>
                        )}
                        {canDelete && (
                          <button
                            disabled={busy}
                            onClick={() => run(b, () => deleteBooking(b), `${b.code} deleted`)}
                            className="px-1 text-muted hover:text-rose"
                            aria-label={`Delete ${b.code}`}
                            title="Delete booking"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted">
                    {tab === "verify" ? "No payments waiting for verification. 🎉" : "No bookings match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Toast message={toast} />
    </section>
  );
}
