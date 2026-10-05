"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Calendar from "@/components/Calendar";
import BookingSummary from "@/components/BookingSummary";
import Icon from "@/components/Icon";
import { ErrorBox, Loading } from "@/components/States";
import { cancelBooking, createBooking, getBooking, getBusySlots, getServices, getTherapists } from "@/lib/api";
import { bookableTherapists, slotAvailability } from "@/lib/availability";
import { TIME_SLOTS } from "@/lib/constants";
import { peso } from "@/lib/format";
import useAsync from "@/lib/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useBooking } from "@/context/BookingContext";

export default function BookPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { draft, update } = useBooking();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const catalog = useAsync(() => Promise.all([getServices(), getTherapists()]), []);
  const busy = useAsync(() => (draft.date ? getBusySlots(draft.date) : Promise.resolve([])), [draft.date], { pollMs: 20000 });

  if (catalog.loading) return <Loading label="Preparing the schedule…" />;
  if (catalog.error) return <ErrorBox error={catalog.error} onRetry={catalog.reload} />;

  const [services, therapists] = catalog.data;
  const service = services.find((s) => s.id === draft.serviceId) ?? services[0];
  const duration = service.durations.includes(draft.duration) ? draft.duration : service.durations.at(-1);
  const staff = bookableTherapists(therapists, draft.date ?? undefined);
  const chosen = draft.therapistMode === "specific" ? therapists.find((t) => t.id === draft.therapistId) : null;

  const availability = draft.date
    ? slotAvailability({
        date: draft.date,
        slots: TIME_SLOTS,
        duration,
        busy: busy.data ?? [],
        therapists: staff,
        therapistId: chosen?.id,
      })
    : {};
  const selectedStillFree = draft.time && availability[draft.time]?.available;
  const ready = draft.date && selectedStillFree && (draft.therapistMode === "any" || chosen);

  async function proceed() {
    if (!user) {
      // Keep the draft; come back here after logging in.
      update({ serviceId: service.id, duration });
      router.push("/login?next=/book");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Changing your mind releases the slot you were holding.
      if (draft.bookingId) {
        const previous = await getBooking(draft.bookingId).catch(() => null);
        if (previous?.status === "pending_payment") await cancelBooking(previous.id);
      }
      const booking = await createBooking({
        serviceId: service.id,
        date: draft.date,
        time: draft.time,
        duration,
        therapistId: chosen?.id,
      });
      update({ serviceId: service.id, duration, bookingId: booking.id });
      router.push("/checkout");
    } catch (err) {
      setSubmitError(err);
      busy.reload();
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Reserve your ritual"
        title="Choose a time to restore."
        subtitle="Select your treatment, preferred therapist, and a quiet moment for yourself."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <section className="card space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <div>
                <label htmlFor="service" className="label">Treatment</label>
                <select
                  id="service"
                  className="input"
                  value={service.id}
                  onChange={(e) => {
                    const s = services.find((x) => x.id === e.target.value);
                    update({ serviceId: s.id, duration: s.durations.at(-1), time: null });
                  }}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.durations.at(-1)} minutes · {peso(s.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="duration" className="label">Duration</label>
                <select id="duration" className="input" value={duration} onChange={(e) => update({ duration: Number(e.target.value), time: null })}>
                  {service.durations.map((d) => (
                    <option key={d} value={d}>{d} minutes</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="label">Therapist preference</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { mode: "any", label: "Any available therapist" },
                  { mode: "specific", label: "Choose a specific therapist" },
                ].map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => update({ therapistMode: opt.mode, time: null })}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs transition ${
                      draft.therapistMode === opt.mode ? "border-forest bg-sage text-forest" : "border-line hover:border-forest"
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full border ${draft.therapistMode === opt.mode ? "border-forest bg-forest" : "border-muted"}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
              {draft.therapistMode === "any" ? (
                <p className="mt-2 text-[11px] text-muted">
                  We&apos;ll match you with whichever therapist is free, rotating evenly so everyone gets fair hours.
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {staff.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => update({ therapistId: t.id, time: null })}
                      className={`rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                        draft.therapistId === t.id ? "border-forest bg-sage" : "border-line hover:border-forest"
                      }`}
                    >
                      <span className="block font-semibold">{t.full_name}</span>
                      <span className="text-[11px] text-muted">{t.title} · {t.specialties.join(", ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-[1fr_240px]">
            <section className="card p-6">
              <Calendar value={draft.date} onChange={(date) => update({ date, time: null })} />
            </section>
            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-xl">Available times</h2>
                {busy.loading && draft.date && <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-forest" />}
              </div>
              {!draft.date ? (
                <p className="text-xs text-muted">Pick a date to see open slots.</p>
              ) : draft.therapistMode === "specific" && !chosen ? (
                <p className="text-xs text-muted">Choose a therapist to see their open slots.</p>
              ) : (
                <div className="space-y-2">
                  {TIME_SLOTS.map((slot) => {
                    const a = availability[slot.value] ?? {};
                    const selected = draft.time === slot.value;
                    return (
                      <button
                        key={slot.value}
                        type="button"
                        disabled={!a.available}
                        onClick={() => update({ time: slot.value })}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-xs transition ${
                          selected
                            ? "bg-forest text-white"
                            : a.available
                              ? "bg-sand hover:bg-sage"
                              : "cursor-not-allowed bg-sand/50 text-muted/50"
                        }`}
                      >
                        <span className={a.available ? "" : "line-through"}>{slot.label}</span>
                        <span className={`text-[10px] ${selected ? "text-white/80" : "text-muted"}`}>
                          {a.reason === "past" ? "Passed" : a.reason === "booked" ? "Booked" : a.reason === "off" ? "Unavailable" : !chosen && a.freeCount ? `${a.freeCount} free` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        <BookingSummary
          service={service}
          therapistName={chosen ? chosen.full_name : "Any available therapist"}
          date={draft.date}
          time={selectedStillFree ? draft.time : null}
          duration={duration}
        >
          {submitError && <p className="mt-4 text-xs text-rose">{submitError.message}</p>}
          <button disabled={!ready || submitting} onClick={proceed} className="btn-primary mt-5 w-full">
            {submitting ? "Holding your slot…" : user ? "Proceed to checkout" : "Log in to continue"} <Icon name="arrow" size={14} />
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">
            {ready ? "We'll hold this slot for 30 minutes while you pay." : "Choose a date and time to continue."}
          </p>
        </BookingSummary>
      </div>
    </>
  );
}
