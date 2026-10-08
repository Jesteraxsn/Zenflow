"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import { ErrorBox, Loading, Toast } from "@/components/States";
import { useAuth } from "@/context/AuthContext";
import { getStaffAccounts, updateStaffLogin } from "@/lib/api";
import useAsync from "@/lib/useAsync";
import useToast from "@/lib/useToast";

const roleLabel = { admin: "Admin", receptionist: "Front desk" };
const empty = { email: "", password: "", confirm: "" };

export default function StaffAccountsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getStaffAccounts(), []);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toast, showToast] = useToast();

  if (loading) return <Loading label="Loading staff accounts…" />;

  const staff = data ?? [];
  const selected = staff.find((s) => s.id === selectedId) ?? staff[0];
  const isMe = selected?.id === user?.id;

  const pick = (s) => {
    setSelectedId(s.id);
    setForm(empty);
    setSaveError(null);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const email = form.email.trim();
    if (!email && !form.password) return setSaveError(new Error("Enter a new email, a new password, or both."));
    if (form.password && form.password.length < 6) return setSaveError(new Error("Password must be at least 6 characters."));
    if (form.password !== form.confirm) return setSaveError(new Error("Passwords don't match."));
    setSaving(true);
    setSaveError(null);
    try {
      await updateStaffLogin(selected.id, { email: email || undefined, password: form.password || undefined });
      showToast(`Updated ${selected.full_name || selected.email}'s login`);
      setForm(empty);
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
        title="Staff accounts"
        subtitle="Change the login email or password of admin and front desk accounts."
      />
      <ErrorBox error={error} onRetry={reload} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-tan/60 text-[10px] uppercase tracking-wider text-bark">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Login email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {staff.map((s) => (
                  <tr key={s.id} onClick={() => pick(s)} className={`cursor-pointer transition ${selected?.id === s.id ? "bg-sage" : "hover:bg-sand/60"}`}>
                    <td className="px-5 py-3.5 font-semibold">
                      {s.full_name || "—"}
                      {s.id === user?.id && <span className="ml-2 text-[10px] font-normal text-muted">(you)</span>}
                    </td>
                    <td className="px-3 py-3.5 text-muted">{roleLabel[s.role]}</td>
                    <td className="px-5 py-3.5">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-[11px] text-muted">
            To add a staff member, have them create an account, then change their role to admin or receptionist in Supabase.
          </p>
        </section>

        {selected && (
          <form onSubmit={save} className="card h-fit p-5">
            <h2 className="font-serif text-2xl">{selected.full_name || "Staff account"}</h2>
            <p className="text-[11px] text-muted">{roleLabel[selected.role]} · {selected.email}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="email" className="label">New email</label>
                <input id="email" type="email" className="input" placeholder={selected.email} value={form.email} onChange={set("email")} />
              </div>
              <div>
                <label htmlFor="password" className="label">New password</label>
                <input id="password" type="password" autoComplete="new-password" className="input" placeholder="Leave blank to keep the current one" value={form.password} onChange={set("password")} />
              </div>
              <div>
                <label htmlFor="confirm" className="label">Confirm new password</label>
                <input id="confirm" type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={set("confirm")} />
              </div>
            </div>
            {isMe && <p className="mt-3 text-[11px] text-muted">This is your own account. Use the new details next time you sign in.</p>}
            {saveError && <p className="mt-3 text-xs text-rose">{saveError.message}</p>}
            <button type="submit" disabled={saving} className="btn-primary mt-5 w-full">
              <Icon name="lock" size={14} /> {saving ? "Saving…" : "Save login changes"}
            </button>
          </form>
        )}
      </div>
      <Toast message={toast} />
    </>
  );
}
