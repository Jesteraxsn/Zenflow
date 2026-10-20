"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { EmptyCard, ErrorBox, Loading } from "@/components/States";
import { cancelBooking, getBooking } from "@/lib/api";
import { PAYMENT_METHODS } from "@/lib/constants";
import { longDate, peso, timeOf } from "@/lib/format";
import useAsync from "@/lib/useAsync";
import { useBooking } from "@/context/BookingContext";

const headline = {
  pending_payment: ["Awaiting payment", "Your slot is on hold.", "Complete your payment to lock in this time."],
  pending_verification: ["Payment received", "Your time is being held.", "We have received your payment and will confirm your slot shortly."],
  confirmed: ["You're all set", "Your appointment is confirmed.", "We look forward to welcoming you. Please arrive 15 minutes early."],
  completed: ["Thank you", "We hope you feel restored.", "This session is complete. We'd love to see you again."],
  cancelled: ["Cancelled", "This appointment was cancelled.", "The time slot has been released."],
  no_show: ["Missed appointment", "We missed you.", "This appointment was marked as a no-show."],
};

function timeline(status) {
  const order = ["pending_payment", "pending_verification", "confirmed", "completed"];
  const reached = order.indexOf(status);
  return [
    { label: "Booking created", note: "Time slot held for you", done: true },
    { label: "Payment submitted", note: "Reference received", done: reached >= 1 },
    { label: "Payment verified", note: "Checked by our front desk", done: reached >= 2 },
    { label: "Treatment completed", note: "Enjoy your ritual", done: reached >= 3 },
  ];
}

function StatusView() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const { update } = useBooking();
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Poll so the customer sees the front desk's verification land live.
  const { data: booking, loading, error, reload } = useAsync(() => (id ? getBooking(id) : Promise.resolve(null)), [id], { pollMs: 8000 });

  if (!id) return <EmptyCard title="Nothing to track yet" body="Open a booking from your dashboard to follow its status." href="/dashboard" cta="Go to my appointments" />;
  if (loading) return <Loading label="Checking your booking…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!booking) return <EmptyCard title="Booking not found" href="/dashboard" cta="Go to my appointments" />;

  const rejected = booking.status === "pending_payment" && booking.payments?.some((p) => p.status === "rejected");
  const [eyebrow, title, subtitle] = rejected
    ? ["Payment not verified", "Please upload your receipt again.", "We couldn't verify your last payment. Your slot is still held for you."]
    : headline[booking.status];
  const payment = booking.payments?.at(-1);
  const cancellable = ["pending_payment", "pending_verification", "confirmed"].includes(booking.status);

  async function cancel() {
    try {
      await cancelBooking(booking.id);
      setConfirming(false);
      reload();
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} subtitle={subtitle} action={<StatusBadge status={booking.status} />} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card p-6">
          <h2 className="font-serif text-2xl">Reservation summary</h2>
          <p className="text-[11px] text-muted">Booking {booking.code}</p>
          <h3 className="mt-5 font-serif text-xl">{booking.service?.name}</h3>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            {[
              ["Date", longDate(booking.starts_at)],
              ["Time", `${timeOf(booking.starts_at)} – ${timeOf(booking.ends_at)}`],
              ["Therapist", booking.therapist?.full_name],
              ["Room", "Serenity Suite"],
              ["Payment reference", payment?.reference || "—"],
              ["Payment method", payment ? PAYMENT_METHODS[payment.method] : "Not yet paid"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="eyebrow text-[10px]">{k}</dt>
                <dd className="mt-1">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-xs text-muted">{payment ? "Amount paid" : "Amount due"}</p>
            <p className="font-serif text-3xl">{peso(booking.price)}</p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl">Payment &amp; status</h2>
              {booking.status === "pending_verification" && (
                <span className="flex items-center gap-1 text-[10px] text-muted">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-forest" /> Live
                </span>
              )}
            </div>
            {booking.status === "cancelled" || booking.status === "no_show" ? (
              <p className="mt-4 text-xs text-muted">This booking is closed.</p>
            ) : (
              <ol className="mt-5 space-y-5">
                {timeline(booking.status).map((step) => (
                  <li key={step.label} className="flex gap-3">
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                        step.done ? "border-forest bg-forest text-white" : "border-muted/50"
                      }`}
                    >
                      {step.done && <Icon name="check" size={9} strokeWidth={3} />}
                    </span>
                    <div>
                      <p className={`text-xs font-semibold ${step.done ? "" : "text-muted"}`}>{step.label}</p>
                      <p className="text-[11px] text-muted">{step.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {booking.status === "pending_payment" && (
            <button
              onClick={() => {
                update({ bookingId: booking.id });
                router.push("/checkout");
              }}
              className="btn-primary w-full"
            >
              Complete payment <Icon name="arrow" size={14} />
            </button>
          )}
          <Link href="/dashboard" className={booking.status === "pending_payment" ? "btn-outline w-full" : "btn-primary w-full"}>
            View dashboard <Icon name="arrow" size={14} />
          </Link>

          {cancellable &&
            (confirming ? (
              <div className="rounded-lg border border-rose/30 bg-rose/5 p-4 text-center text-xs">
                <p>Cancel this appointment?</p>
                <div className="mt-3 flex justify-center gap-2">
                  <button onClick={cancel} className="btn-danger px-4 py-2 text-[10px]">Yes, cancel</button>
                  <button onClick={() => setConfirming(false)} className="btn-outline px-4 py-2 text-[10px]">Keep it</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} className="btn-danger w-full">Cancel appointment</button>
            ))}
          {actionError && <p className="text-center text-xs text-rose">{actionError.message}</p>}
          <p className="text-center text-[11px] text-muted">Cancellations made 24 hours before your slot are refunded in full.</p>
        </aside>
      </div>
    </>
  );
}

export default function BookingStatusPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StatusView />
    </Suspense>
  );
}
