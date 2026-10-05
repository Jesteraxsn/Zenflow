"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import AccordionPanel from "@/components/AccordionPanel";
import { ErrorBox, Loading, Toast } from "@/components/States";
import { getServices, getSettings, logActivity, saveSetting, updateServicePrice } from "@/lib/api";
import { peso } from "@/lib/format";
import useAsync from "@/lib/useAsync";
import useToast from "@/lib/useToast";

const FEE_FIELDS = [
  ["homeService", "Home service fee (₱)"],
  ["aromatherapy", "Aromatherapy add-on (₱)"],
  ["hotStone", "Hot stone add-on (₱)"],
  ["lateCancel", "Late cancellation fee (%)"],
];

export default function PricingControl() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([getServices({ includeInactive: true }), getSettings()]), []);
  const [prices, setPrices] = useState({});
  const [fees, setFees] = useState(null);
  const [promo, setPromo] = useState(null);
  const [bank, setBank] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toast, showToast] = useToast();

  if (loading) return <Loading label="Loading pricing…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const [services, settings] = data;
  const feeValues = fees ?? settings.fees ?? {};
  const promoValues = promo ?? settings.promo ?? {};
  const bankValues = bank ?? settings.bank_details ?? {};
  const priceOf = (s) => prices[s.id] ?? Number(s.price);
  const changed = services.filter((s) => priceOf(s) !== Number(s.price));
  const dirty = changed.length > 0 || fees || promo || bank;

  async function saveAll() {
    setSaving(true);
    setSaveError(null);
    try {
      for (const s of changed) await updateServicePrice(s, priceOf(s));
      if (fees) await saveSetting("fees", fees);
      if (promo) await saveSetting("promo", promo);
      if (bank) await saveSetting("bank_details", bank);
      if (fees || promo || bank) await logActivity("pricing", "Updated fees, promo or payment settings");
      setPrices({});
      setFees(null);
      setPromo(null);
      setBank(null);
      showToast("Pricing saved");
      reload();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  const sections = [
    {
      id: "base",
      label: "Base price modification sheet",
      content: (
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted">
            <tr><th className="py-2">Treatment</th><th className="py-2">Current</th><th className="py-2">New price (₱)</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {services.map((s) => (
              <tr key={s.id}>
                <td className="py-2.5 font-medium">{s.name}{!s.active && <span className="ml-2 text-[10px] text-muted">(hidden)</span>}</td>
                <td className="py-2.5 text-muted">{peso(s.price)}</td>
                <td className="py-2.5">
                  <input
                    type="number"
                    min="0"
                    className={`input w-32 py-1.5 ${priceOf(s) !== Number(s.price) ? "border-forest bg-sage" : ""}`}
                    value={priceOf(s)}
                    onChange={(e) => setPrices({ ...prices, [s.id]: Number(e.target.value) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      id: "fees",
      label: "Extra fees & add-on pricing",
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          {FEE_FIELDS.map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input type="number" min="0" className="input" value={feeValues[k] ?? 0} onChange={(e) => setFees({ ...feeValues, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "promo",
      label: "Discount & promo settings",
      content: (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Promo code</label>
            <input className="input uppercase" value={promoValues.code ?? ""} onChange={(e) => setPromo({ ...promoValues, code: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label">Discount (%)</label>
            <input type="number" min="0" max="100" className="input" value={promoValues.percent ?? 0} onChange={(e) => setPromo({ ...promoValues, percent: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Senior / PWD discount (%)</label>
            <input type="number" min="0" max="100" className="input" value={promoValues.senior ?? 0} onChange={(e) => setPromo({ ...promoValues, senior: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-xs sm:col-span-3">
            <input type="checkbox" className="accent-forest" checked={Boolean(promoValues.active)} onChange={(e) => setPromo({ ...promoValues, active: e.target.checked })} />
            Promo code is active
          </label>
        </div>
      ),
    },
    {
      id: "bank",
      label: "Payment account shown at checkout",
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["bank", "Bank"],
            ["accountName", "Account name"],
            ["accountNumber", "Account number"],
            ["gcash", "GCash number"],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input className="input" value={bankValues[k] ?? ""} onChange={(e) => setBank({ ...bankValues, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageIntro eyebrow="Administration" title="Pricing control" subtitle="Manage base prices, add-on fees, promotions and the payment account customers see." />
      <AccordionPanel
        title="Pricing control"
        sections={sections}
        action={
          <div className="text-center">
            {saveError && <p className="mb-2 text-xs text-rose">{saveError.message}</p>}
            <button onClick={saveAll} disabled={saving || !dirty} className="btn-primary">
              {saving ? "Saving…" : "Save pricing changes"}
            </button>
            <p className="mt-2 text-[11px] text-muted">
              {dirty ? `${changed.length} price change${changed.length === 1 ? "" : "s"}${fees || promo || bank ? " + settings" : ""} pending` : "No unsaved changes"}
            </p>
          </div>
        }
      />
      <Toast message={toast} />
    </>
  );
}
