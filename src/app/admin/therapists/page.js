"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import { ErrorBox, Loading, Toast } from "@/components/States";
import { getBookings, getTherapists, removeTherapist, saveTherapist, setTherapistStatus } from "@/lib/api";
import { THERAPIST_STATUSES } from "@/lib/constants";
import { initials, timeOf } from "@/lib/format";
import { dayStartISO } from "@/lib/reports";
import useAsync from "@/lib/useAsync";
import useToast from "@/lib/useToast";

const statusStyle = {
  "On duty": "bg-sage text-forest",
  "On break": "bg-tan text-bark",
  "Off today": "bg-sand text-muted",
};

const blank = {
  id: null,
  full_name: "",
  title: "Massage Therapist",
  specialties: [],
  work_days: "Mon – Sat",
  shift_start: "09:00",
  shift_end: "18:00",
  commission_rate: 0.35,
  status: "On duty",
};

const SHIFTS = [
  { name: "Morning", from: "09:00", to: "13:00" },
  { name: "Afternoon", from: "13:00", to: "17:00" },
  { name: "Evening", from: "17:00", to: "21:00" },
];

const hhmm = (t) => (t ?? "").slice(0, 5);

export default function TherapistManagement() {
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([getTherapists(), getBookings({ from: dayStartISO(0), to: dayStartISO(1) })]),
    [],
  );
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState("all");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [toast, showToast] = useToast();

  if (loading) return <Loading label="Loading your care team…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const [rows, todays] = data;
  const selected = form ?? rows.find((t) => t.id === selectedId) ?? rows[0] ?? blank;
  const visible = rows.filter((t) => filter === "all" || t.status === filter);
  const count = (s) => rows.filter((t) => t.status === s).length;
  const sessionsToday = (id) => todays.filter((b) => b.therapist_id === id && b.status !== "cancelled");

  const pick = (t) => {
    setSelectedId(t.id);
    setForm(null);
    setConfirmRemove(false);
    setActionError(null);
  };
  const set = (k, transform = (v) => v) => (e) => setForm({ ...selected, [k]: transform(e.target.value) });

  async function act(fn, message) {
    setSaving(true);
    setActionError(null);
    try {
      const result = await fn();
      showToast(message);
      if (result?.id) setSelectedId(result.id);
      setForm(null);
      setConfirmRemove(false);
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setSaving(false);
    }
  }

  const save = () => {
    if (!selected.full_name.trim()) return setActionError(new Error("Name is required."));
    act(() => saveTherapist(selected), `Saved ${selected.full_name}`);
  };

  return (
    <>
      <PageIntro
        eyebrow="Administration"
        title="Therapist management"
        subtitle="Coordinate your care team, specialties, and today's shift coverage."
        action={
          <button onClick={save} disabled={saving || !form} className="btn-primary">
            <Icon name="edit" size={14} /> Update therapist profile
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[["all", `All staff · ${rows.length}`], ...THERAPIST_STATUSES.map((s) => [s, `${s} · ${count(s)}`])].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] ${filter === id ? "border-forest bg-forest text-white" : "border-line bg-card hover:border-forest"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {selected.id &&
            (confirmRemove ? (
              <button onClick={() => act(() => removeTherapist(selected), `Removed ${selected.full_name}`)} className="btn-danger px-4 py-2 text-[10px]">
                Confirm remove {selected.full_name.split(" ")[0]}
              </button>
            ) : (
              <button onClick={() => setConfirmRemove(true)} className="btn-danger px-4 py-2 text-[10px]">
                <Icon name="trash" size={13} /> Remove staff
              </button>
            ))}
          <button
            onClick={() => {
              setForm({ ...blank });
              setConfirmRemove(false);
            }}
            className="btn-outline px-4 py-2 text-[10px]"
          >
            <Icon name="plus" size={13} /> Add staff
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden">
          <h2 className="p-5 font-serif text-2xl">Staff profiles</h2>
          <ul className="divide-y divide-line">
            {visible.map((t) => {
              const active = t.id === selected.id;
              return (
                <li
                  key={t.id}
                  onClick={() => pick(t)}
                  className={`grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 text-xs transition sm:grid-cols-[auto_1.4fr_1.2fr_1fr_auto] ${active ? "bg-sage" : "hover:bg-sand/60"}`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold ${active ? "bg-forest text-white" : "bg-tan text-bark"}`}>
                    {initials(t.full_name)}
                  </span>
                  <span>
                    <span className="block font-semibold">{t.full_name}</span>
                    <span className="text-[11px] text-muted">{t.title} · {sessionsToday(t.id).length} today</span>
                  </span>
                  <span className="hidden text-forest sm:block">{t.specialties.join(" · ")}</span>
                  <span className="hidden sm:block">
                    {hhmm(t.shift_start)} – {hhmm(t.shift_end)}
                    <span className="block text-[11px] text-muted">{t.work_days}</span>
                  </span>
                  <span className={`badge ${statusStyle[t.status]}`}>{t.status}</span>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-5 py-8 text-center text-xs text-muted">No therapists in this group.</li>}
          </ul>
        </section>

        <aside className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl">{selected.id ? selected.full_name : "New therapist"}</h2>
              {form && <span className="badge bg-tan text-bark">Unsaved</span>}
            </div>
            {selected.id && (
              <div className="mt-3 flex gap-1.5">
                {THERAPIST_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={saving || selected.status === s}
                    onClick={() => act(() => setTherapistStatus(selected, s), `${selected.full_name} is now ${s}`)}
                    className={`flex-1 rounded-md py-1.5 text-[10px] font-semibold ${selected.status === s ? statusStyle[s] : "bg-sand/60 text-muted hover:bg-sand"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={selected.full_name} onChange={set("full_name")} />
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input" value={selected.title} onChange={set("title")} />
              </div>
              <div>
                <label className="label">Specialties (comma separated)</label>
                <input
                  className="input"
                  value={selected.specialties.join(", ")}
                  onChange={set("specialties", (v) => v.split(",").map((s) => s.trim()).filter(Boolean))}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3">
                  <label className="label">Work days</label>
                  <input className="input" value={selected.work_days} onChange={set("work_days")} />
                </div>
                <div>
                  <label className="label">Start</label>
                  <input type="time" className="input px-2" value={hhmm(selected.shift_start)} onChange={set("shift_start")} />
                </div>
                <div>
                  <label className="label">End</label>
                  <input type="time" className="input px-2" value={hhmm(selected.shift_end)} onChange={set("shift_end")} />
                </div>
                <div>
                  <label className="label">Commission</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input px-2"
                    value={Math.round(Number(selected.commission_rate) * 100)}
                    onChange={set("commission_rate", (v) => Number(v) / 100)}
                  />
                </div>
              </div>
            </div>
            {actionError && <p className="mt-3 text-xs text-rose">{actionError.message}</p>}
            <button onClick={save} disabled={saving || !form} className="btn-primary mt-4 w-full">
              {saving ? "Saving…" : selected.id ? "Save profile" : "Add therapist"}
            </button>
          </section>

          <section className="card p-5">
            <h2 className="font-serif text-xl">Today&apos;s shifts</h2>
            <ul className="mt-3 space-y-2">
              {SHIFTS.map((s) => {
                const covering = rows.filter((t) => t.status !== "Off today" && hhmm(t.shift_start) < s.to && hhmm(t.shift_end) > s.from);
                return (
                  <li key={s.name} className="rounded-lg bg-tan/50 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-forest">{covering.length} therapist{covering.length === 1 ? "" : "s"}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{s.from} – {s.to} · {covering.map((t) => t.full_name.split(" ")[0]).join(", ") || "No coverage"}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          {selected.id && (
            <section className="card p-5">
              <h2 className="font-serif text-xl">{selected.full_name.split(" ")[0]}&apos;s day</h2>
              <ul className="mt-3 space-y-1.5 text-xs">
                {sessionsToday(selected.id).map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span>{timeOf(b.starts_at)} · {b.service?.name}</span>
                    <span className="text-muted">{b.client_name}</span>
                  </li>
                ))}
                {sessionsToday(selected.id).length === 0 && <li className="text-muted">No sessions today.</li>}
              </ul>
            </section>
          )}
        </aside>
      </div>
      <Toast message={toast} />
    </>
  );
}
