"use client";

import Link from "next/link";
import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import { ErrorBox, Loading } from "@/components/States";
import { createBooking, getBusySlots, getServices, getTherapists } from "@/lib/api";
import { bookableTherapists, slotAvailability } from "@/lib/availability";
import { PAYMENT_METHODS, TIME_SLOTS } from "@/lib/constants";
import { longDate, peso, timeOf, todayKey } from "@/lib/format";
import useAsync from "@/lib/useAsync";

export default function WalkInPage() {
  const today = todayKey();
  const [form, setForm] = useState({ client: "", phone: "", serviceId: "", duration: null, therapistId: "any", date: today, time: "", payment: "cash" });
  const [done, setDone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const catalog = useAsync(() => Promise.all([getServices(), getTherapists()]), []);
  const busy = useAsync(() => getBusySlots(form.date), [form.date, done?.id], { pollMs: 15000 });

  if (catalog.loading) return <Loading label="Loading…" />;
  if (catalog.error) return <ErrorBox error={catalog.error} onRetry={catalog.reload} />;

  const [services, therapists] = catalog.data;
  const service = services.find((s) => s.id === form.serviceId) ?? services[0];
  const duration = service.durations.includes(form.duration) ? form.duration : service.durations.at(-1);
  const staff = bookableTherapists(therapists);
  const therapistId = form.therapistId === "any" ? null : form.therapistId;
  const availability = slotAvailability({ date: form.date, slots: TIME_SLOTS, duration, busy: busy.data ?? [], therapists: staff, therapistId });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value, ...(k !== "client" && k !== "phone" && k !== "payment" ? { time: "" } : {}) });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const booking = await createBooking({
        serviceId: service.id,
        date: form.date,
        time: form.time,
        duration,
        therapistId,
        clientName: form.client.trim(),
        clientPhone: form.phone.trim(),
        walkIn: true,
        paymentMethod: form.payment,
      });
      const therapist = therapists.find((t) => t.id === booking.therapist_id);
      setDone({ ...booking, therapistName: therapist?.full_name, serviceName: service.name });
    } catch (err) {
      setSaveError(err);
      busy.reload();
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sage text-forest">
          <Icon name="check" size={22} />
        </span>
        <h1 className="mt-4 font-serif text-3xl">Walk-in encoded</h1>
        <p className="mt-2 text-sm">
          <strong>{done.code}</strong> · {done.client_name}
        </p>
        <p className="mt-1 text-sm text-muted">
          {done.serviceName} with {done.therapistName}
          <br />
          {longDate(done.starts_at)} at {timeOf(done.starts_at)} · {peso(done.price)} paid ({PAYMENT_METHODS[form.payment]})
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => { setDone(null); setForm({ ...form, client: "", phone: "", time: "" }); }} className="btn-primary">
            Encode another
          </button>
          <Link href="/receptionist" className="btn-outline">Back to today</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageIntro eyebrow="Front desk" title="Encode a walk-in" subtitle="Record a guest who arrived without a reservation. Payment is collected at the counter." />
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className="label">Client name</label>
            <input required className="input" value={form.client} onChange={set("client")} placeholder="Full name" />
          </div>
          <div>
            <label className="label">Mobile number</label>
            <input className="input" value={form.phone} onChange={set("phone")} placeholder="09XX XXX XXXX" />
          </div>
          <div>
            <label className="label">Treatment</label>
            <select className="input" value={service.id} onChange={set("serviceId")}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {peso(s.price)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Duration</label>
            <select className="input" value={duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value), time: "" })}>
              {service.durations.map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <div>
            <label className="label">Therapist</label>
            <select className="input" value={form.therapistId} onChange={set("therapistId")}>
              <option value="any">Any available (auto-assign)</option>
              {staff.map((t) => <option key={t.id} value={t.id}>{t.full_name} · {t.status}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" min={today} className="input" value={form.date} onChange={set("date")} />
          </div>
          <div className="sm:col-span-2">
            <p className="label">Time slot</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              {TIME_SLOTS.map((t) => {
                const a = availability[t.value] ?? {};
                return (
                  <button
                    key={t.value}
                    type="button"
                    disabled={!a.available}
                    onClick={() => setForm({ ...form, time: t.value })}
                    className={`rounded-md py-2 text-xs ${
                      form.time === t.value ? "bg-forest text-white" : a.available ? "bg-sand hover:bg-sage" : "bg-sand/50 text-muted/50 line-through"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="label">Payment received</p>
            <div className="flex flex-wrap gap-3">
              {["cash", "gcash", "card"].map((p) => (
                <label key={p} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-xs ${form.payment === p ? "border-forest bg-sage" : "border-line"}`}>
                  <input type="radio" name="payment" value={p} checked={form.payment === p} onChange={set("payment")} className="accent-forest" />
                  {PAYMENT_METHODS[p]}
                </label>
              ))}
            </div>
          </div>
        </section>

        <aside className="card h-fit p-6">
          <h2 className="font-serif text-2xl">Walk-in summary</h2>
          <p className="mt-4 text-sm font-semibold">{service.name}</p>
          <p className="text-xs text-muted">{longDate(form.date)}</p>
          <p className="text-xs text-muted">{form.time ? TIME_SLOTS.find((t) => t.value === form.time)?.label : "No time selected"} · {duration} minutes</p>
          <p className="text-xs text-muted">{therapistId ? staff.find((t) => t.id === therapistId)?.full_name : "Auto-assigned therapist"}</p>
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs text-muted">Amount to collect</p>
            <p className="font-serif text-3xl">{peso(service.price)}</p>
          </div>
          {saveError && <p className="mt-3 text-xs text-rose">{saveError.message}</p>}
          <button type="submit" disabled={!form.time || !form.client.trim() || saving} className="btn-primary mt-5 w-full">
            {saving ? "Saving…" : "Save walk-in booking"}
          </button>
        </aside>
      </form>
    </>
  );
}
