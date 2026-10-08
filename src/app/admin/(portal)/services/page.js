"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { ErrorBox, Loading, Toast } from "@/components/States";
import { getServices, saveService } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { fromPrice, priceBreakdown, priceList, toServicePricing } from "@/lib/pricing";
import useAsync from "@/lib/useAsync";
import useToast from "@/lib/useToast";

const blank = { id: null, name: "", category: "Massage Therapy", description: "", durations: [60], prices: { 60: 0 }, price: 0, active: true };

export default function ServiceManagement() {
  const { data: rows, loading, error, reload } = useAsync(() => getServices({ includeInactive: true }), []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toast, showToast] = useToast();

  if (loading) return <Loading label="Loading services…" />;

  const list = rows ?? [];
  // Until something is clicked, edit the first service. `options` holds the duration/price rows being edited.
  const withOptions = (s) => ({ ...s, options: priceList(s) });
  const current = form ?? (list[0] ? withOptions(list[0]) : withOptions(blank));

  const edit = (service) => {
    setForm(withOptions(service));
    setSaveError(null);
  };
  const change = (patch) => setForm({ ...current, ...patch });
  const set = (k) => (e) => change({ [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });
  const setOption = (i, k) => (e) =>
    change({ options: current.options.map((o, j) => (j === i ? { ...o, [k]: e.target.value === "" ? "" : Number(e.target.value) } : o)) });
  const addOption = () => {
    const longest = Math.max(0, ...current.options.map((o) => Number(o.duration) || 0));
    change({ options: [...current.options, { duration: longest + 30, price: current.options.at(-1)?.price ?? 0 }] });
  };
  const removeOption = (i) => change({ options: current.options.filter((_, j) => j !== i) });

  async function save() {
    if (!current.name.trim()) return setSaveError(new Error("Service name is required."));
    const pricing = toServicePricing(current.options);
    if (!pricing.durations.length) return setSaveError(new Error("Add at least one duration in minutes."));
    if (pricing.durations.length !== current.options.filter((o) => Number(o.duration) > 0).length)
      return setSaveError(new Error("Each duration can only be listed once."));
    if (current.options.some((o) => o.price === "" || Number(o.price) < 0)) return setSaveError(new Error("Enter a price for every duration."));
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveService({ ...current, ...pricing });
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
                  <th className="px-3 py-3 font-semibold">Duration &amp; price</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((s) => (
                  <tr key={s.id} onClick={() => edit(s)} className={`cursor-pointer transition ${current.id === s.id ? "bg-sage" : "hover:bg-sand/60"}`}>
                    <td className="px-5 py-3.5 font-semibold">{s.name}</td>
                    <td className="px-3 py-3.5 text-muted">{s.category}</td>
                    <td className="px-3 py-3.5">
                      <span className="font-semibold">{fromPrice(s)}</span>
                      <span className="block text-[10px] text-muted">{priceBreakdown(s)}</span>
                    </td>
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
            <div>
              <div className="grid grid-cols-[1fr_1fr_28px] gap-2">
                <span className="label">Duration (min)</span>
                <span className="label">Price (₱)</span>
              </div>
              <div className="space-y-2">
                {current.options.map((o, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_28px] items-center gap-2">
                    <input type="number" min="5" step="5" className="input" aria-label="Duration in minutes" value={o.duration} onChange={setOption(i, "duration")} />
                    <input type="number" min="0" className="input" aria-label="Price in pesos" value={o.price} onChange={setOption(i, "price")} />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      disabled={current.options.length === 1}
                      className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-sand hover:text-rose disabled:opacity-30"
                      aria-label="Remove this duration"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addOption} className="mt-2 text-[11px] font-semibold text-forest hover:underline">
                + Add duration
              </button>
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
