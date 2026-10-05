"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import { EmptyCard, ErrorBox, Loading } from "@/components/States";
import { getBooking, getSettings, submitPayment, uploadProof } from "@/lib/api";
import { HOLD_MINUTES } from "@/lib/constants";
import { longDate, peso, timeOf } from "@/lib/format";
import useAsync from "@/lib/useAsync";
import useNow from "@/lib/useNow";
import { useAuth } from "@/context/AuthContext";
import { useBooking } from "@/context/BookingContext";

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <div>
        <p className="text-[11px] text-muted">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="flex items-center gap-1 text-[11px] text-forest hover:underline"
      >
        <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function useCountdown(deadline) {
  const now = useNow(1000);
  return deadline ? Math.max(0, deadline - now) : null;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { draft, update, reset, loaded } = useBooking();
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const { data, loading, error, reload } = useAsync(
    () => (draft.bookingId ? Promise.all([getBooking(draft.bookingId), getSettings()]) : Promise.resolve(null)),
    [draft.bookingId],
  );
  const booking = data?.[0];
  const bank = data?.[1]?.bank_details ?? {};
  const deadline = booking ? new Date(booking.created_at).getTime() + HOLD_MINUTES * 60000 : null;
  const remaining = useCountdown(deadline);

  if (!loaded || loading) return <Loading label="Loading your reservation…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!booking) {
    return <EmptyCard title="No booking in progress" body="Choose a treatment and time first." href="/book" cta="Choose a time" />;
  }
  if (booking.status !== "pending_payment") {
    return (
      <EmptyCard
        title={booking.status === "cancelled" ? "This hold has expired" : "Payment already submitted"}
        body={booking.status === "cancelled" ? "The slot was released. Please pick a new time." : `Booking ${booking.code} is being processed.`}
        href={booking.status === "cancelled" ? "/book" : `/booking-status?id=${booking.id}`}
        cta={booking.status === "cancelled" ? "Choose a new time" : "View booking status"}
      />
    );
  }

  const expired = remaining === 0;
  const mm = String(Math.floor((remaining ?? 0) / 60000)).padStart(2, "0");
  const ss = String(Math.floor(((remaining ?? 0) % 60000) / 1000)).padStart(2, "0");

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const path = file ? await uploadProof(user.id, booking.id, file) : null;
      await submitPayment(booking.id, reference.trim(), path, method);
      reset();
      router.push(`/booking-status?id=${booking.id}`);
    } catch (err) {
      setSubmitError(err);
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Secure your appointment"
        title="Complete your payment."
        subtitle="Your slot is confirmed once our front desk verifies your payment. Pay the exact amount, then submit your reference below."
        action={
          <span className={`badge ${expired ? "bg-rose/10 text-rose" : "bg-tan text-bark"}`}>
            <Icon name="clock" size={12} /> {expired ? "Hold expired" : `Slot held · ${mm}:${ss}`}
          </span>
        }
      />

      {expired && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-xs text-rose">
          <span>Your 30-minute hold has ended and the slot may be released.</span>
          <button onClick={() => { update({ bookingId: null, time: null }); router.push("/book"); }} className="font-semibold underline">
            Pick another time
          </button>
        </div>
      )}

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Payment details</h2>
            <div className="flex gap-2">
              {[
                ["bank_transfer", "Bank transfer"],
                ["gcash", "GCash"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] ${method === value ? "border-forest bg-forest text-white" : "border-line hover:border-forest"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {method === "bank_transfer" ? (
              <>
                <CopyRow label="Bank" value={bank.bank ?? "—"} />
                <CopyRow label="Account name" value={bank.accountName ?? "—"} />
                <CopyRow label="Account number" value={bank.accountNumber ?? "—"} />
              </>
            ) : (
              <CopyRow label="GCash number" value={bank.gcash ?? "—"} />
            )}
            <CopyRow label="Amount" value={peso(booking.price)} />
          </div>

          <p className="mt-4 rounded-lg bg-sand px-4 py-3 text-xs text-ink/80">
            Use your booking code <strong>{booking.code}</strong> as the transfer note so we can match your payment quickly.
          </p>

          <div className="mt-5">
            <label htmlFor="reference" className="label">Reference number on your receipt</label>
            <input id="reference" className="input" placeholder="e.g. 4821 0093 1157" required value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line px-6 py-8 text-center transition hover:border-forest">
            <Icon name="upload" size={22} className="text-muted" />
            <span className="mt-2 text-sm font-medium">{file ? file.name : "Upload receipt or screenshot (optional)"}</span>
            <span className="mt-1 text-[11px] text-muted">PNG, JPG or PDF · up to 5 MB</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > 5 * 1024 * 1024) {
                  setSubmitError(new Error("That file is over 5 MB."));
                  return;
                }
                setFile(f);
              }}
            />
          </label>
        </section>

        <aside className="card h-fit p-6">
          <h2 className="font-serif text-2xl">Order summary</h2>
          <p className="mt-1 text-[11px] text-muted">Booking {booking.code}</p>
          <p className="mt-4 text-sm font-semibold">{booking.service?.name}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>{longDate(booking.starts_at)}</li>
            <li>{timeOf(booking.starts_at)} – {timeOf(booking.ends_at)}</li>
            <li>{booking.therapist?.full_name} · Serenity Suite</li>
          </ul>
          <div className="mt-5 rounded-lg bg-tan px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-bark">Total amount due</p>
            <p className="font-serif text-4xl">{peso(booking.price)}</p>
          </div>
          <p className="mt-2 text-[11px] text-muted">Full payment is required to confirm your reservation.</p>
          {submitError && <p className="mt-3 text-xs text-rose">{submitError.message}</p>}
          <button type="submit" disabled={submitting || expired} className="btn-primary mt-5 w-full">
            {submitting ? "Submitting…" : "Submit payment"} <Icon name="arrow" size={14} />
          </button>
          <Link href="/book" className="mt-3 block text-center text-[11px] text-muted hover:text-forest">
            ← Change time or treatment
          </Link>
        </aside>
      </form>
    </>
  );
}
