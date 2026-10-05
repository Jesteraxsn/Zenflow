"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { ErrorBox, Loading, Toast } from "@/components/States";
import { getServices, saveService } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { peso } from "@/lib/format";
import useAsync from "@/lib/useAsync";
import useToast from "@/lib/useToast";

const blank = { id: null, name: "", category: "Massage Therapy", description: "", durations: [60], price: 0, active: true };

export default function ServiceManagement() {
  const { data: rows, loading, error, reload } = useAsync(() => getServices({ includeInactive: true }), []);
  const [form, setForm] = useState(null);
  const [durationText, setDurationText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toast, showToast] = useToast();

  if (loading) return <Loading label="Loading services…" />;

  const list = rows ?? [];
  // Until something is clicked, edit the first service.
  const current = form ?? (list[0] ? { ...list[0] } : blank);
  const durationValue = form ? durationText : current.durations.join(", ");
  const durations = durationValue.split(",").map((n) => Number(n.trim())).filter((n) => n > 0);

  const edit = (service) => {
    setForm({ ...service });
    setDurationText(service.durations.join(", "));
    setSaveError(null);
  };
  const change = (patch) => {
    if (!form) setDurationText(current.durations.join(", "));
    setForm({ ...current, ...patch });
  };
  const set = (k) => (e) => change({ [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });

  async function save() {
    if (!current.name.trim()) return setSaveError(new Error("Service name is required."));
    if (!durations.length) return setSaveError(new Error("Add at least one duration in minutes."));
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveService({ ...current, durations });
      edit(saved);
      showToast(`Saved ${saved.name}`);
      reload();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Administration"
        title="Service management"
        subtitle="Maintain treatments, pricing, duration and category so your catalog stays accurate."
        action={
          <button onClick={save} disabled={saving} className="btn-primary">
            <Icon name="check" size={14} /> {saving ? "Saving…" : "Save service changes"}
          </button>
        }
      />
      <ErrorBox error={error} onRetry={reload} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="font-serif text-2xl">Treatment roster</h2>
              <p className="text-[11px] text-muted">{list.length} services · {list.filter((r) => r.active).length} visible to customers</p>
            </div>
            <button onClick={() => edit(blank)} className="btn-outline px-4 py-2 text-[10px]">
              <Icon name="plus" size={13} /> Add service
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-tan/60 text-[10px] uppercase tracking-wider text-bark">
                <tr>
                  <th className="px-5 py-3 font-semibold">Service</th>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 font-semibold">Duration</th>
                  <th className="px-3 py-3 font-semibold">Price</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((s) => (
                  <tr key={s.id} onClick={() => edit(s)} className={`cursor-pointer transition ${current.id === s.id ? "bg-sage" : "hover:bg-sand/60"}`}>
                    <td className="px-5 py-3.5 font-semibold">{s.name}</td>
                    <td className="px-3 py-3.5 text-muted">{s.category}</td>
                    <td className="px-3 py-3.5">{s.durations.join(" / ")} min</td>
                    <td className="px-3 py-3.5 font-semibold">{peso(s.price)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={s.active ? "active" : "inactive"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="card h-fit p-5">
          <h2 className="font-serif text-2xl">{current.id ? "Edit treatment" : "New treatment"}</h2>
          <p className="text-[11px] text-muted">{current.id ? current.name : "Fill in the details below"}</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Service name</label>
              <input className="input" value={current.name} onChange={set("name")} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea rows={3} className="input" value={current.description} onChange={set("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Durations (min)</label>
                <input
                  className="input"
                  placeholder="60, 90"
                  value={durationValue}
                  onChange={(e) => {
                    if (!form) setForm({ ...current });
                    setDurationText(e.target.value);
                  }}
                />
              </div>
              <div>
                <label className="label">Price (₱)</label>
                <input type="number" min="0" className="input" value={current.price} onChange={set("price")} />
              </div>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={current.category} onChange={set("category")}>
                {SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <label className="flex items-center justify-between rounded-lg bg-sand px-3.5 py-3 text-xs">
              <span>
                <span className="font-semibold">Available for booking</span>
                <span className="block text-[11px] text-muted">Hidden from customers when off</span>
              </span>
              <input type="checkbox" className="h-4 w-4 accent-forest" checked={Boolean(current.active)} onChange={(e) => change({ active: e.target.checked })} />
            </label>
          </div>
          {saveError && <p className="mt-3 text-xs text-rose">{saveError.message}</p>}
          <button onClick={save} disabled={saving} className="btn-primary mt-5 w-full">{saving ? "Saving…" : "Save treatment"}</button>
        </aside>
      </div>
      <Toast message={toast} />
    </>
  );
}
