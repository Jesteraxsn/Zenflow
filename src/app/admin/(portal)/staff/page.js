"use client";

import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import PasswordInput from "@/components/PasswordInput";
import { ErrorBox, Loading, Toast } from "@/components/States";
import { useAuth } from "@/context/AuthContext";
import { addReceptionist, getStaffAccounts, removeReceptionist, updateStaffLogin } from "@/lib/api";
import useAsync from "@/lib/useAsync";
import useToast from "@/lib/useToast";

const roleLabel = { admin: "Admin", receptionist: "Front desk" };
const emptyLogin = { email: "", password: "", confirm: "" };
const emptyNew = { fullName: "", email: "", phone: "", password: "", confirm: "" };

export default function StaffAccountsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getStaffAccounts(), []);
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyLogin);
  const [newForm, setNewForm] = useState(emptyNew);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toast, showToast] = useToast();

  if (loading) return <Loading label="Loading staff accounts…" />;

  const staff = data ?? [];
  const selected = staff.find((s) => s.id === selectedId) ?? staff[0];
  const isMe = selected?.id === user?.id;

  const reset = () => {
    setForm(emptyLogin);
    setNewForm(emptyNew);
    setConfirmRemove(false);
    setSaveError(null);
  };
  const pick = (s) => {
    setSelectedId(s.id);
    setAdding(false);
    reset();
  };
  const startAdding = () => {
    setAdding(true);
    reset();
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setNew = (k) => (e) => setNewForm({ ...newForm, [k]: e.target.value });

  async function run(action, message, after) {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await action();
      showToast(message);
      after?.(result);
      reload();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  function saveLogin(e) {
    e.preventDefault();
    const email = form.email.trim();
    if (!email && !form.password) return setSaveError(new Error("Enter a new email, a new password, or both."));
    if (form.password && form.password.length < 6) return setSaveError(new Error("Password must be at least 6 characters."));
    if (form.password !== form.confirm) return setSaveError(new Error("Passwords don't match."));
    run(
      () => updateStaffLogin(selected.id, { email: email || undefined, password: form.password || undefined }),
      `Updated ${selected.full_name || selected.email}'s login`,
      () => setForm(emptyLogin),
    );
  }

  function saveNew(e) {
    e.preventDefault();
    if (!newForm.fullName.trim()) return setSaveError(new Error("Enter the receptionist's name."));
    if (newForm.password.length < 6) return setSaveError(new Error("Password must be at least 6 characters."));
    if (newForm.password !== newForm.confirm) return setSaveError(new Error("Passwords don't match."));
    run(() => addReceptionist(newForm), `Added ${newForm.fullName.trim()} to the front desk`, (result) => {
      setAdding(false);
      setSelectedId(result.id);
      setNewForm(emptyNew);
    });
  }

  function remove() {
    run(() => removeReceptionist(selected.id), `Removed ${selected.full_name || selected.email}`, () => {
      setSelectedId(null);
      setConfirmRemove(false);
    });
  }

  return (
    <>
      <PageIntro
        eyebrow="Administration"
        title="Staff accounts"
        subtitle="Add or remove front desk accounts, and change staff login emails and passwords."
        action={
          <button onClick={startAdding} className="btn-primary">
            <Icon name="plus" size={14} /> Add receptionist
          </button>
        }
      />
      <ErrorBox error={error} onRetry={reload} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card h-fit overflow-hidden">
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
                  <tr
                    key={s.id}
                    onClick={() => pick(s)}
                    className={`cursor-pointer transition ${!adding && selected?.id === s.id ? "bg-sage" : "hover:bg-sand/60"}`}
                  >
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
        </section>

        {adding ? (
          <form onSubmit={saveNew} className="card h-fit p-5">
            <h2 className="font-serif text-2xl">New receptionist</h2>
            <p className="text-[11px] text-muted">Creates a front desk login they can use right away at the staff login page.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="fullName" className="label">Full name</label>
                <input id="fullName" required className="input" value={newForm.fullName} onChange={setNew("fullName")} />
              </div>
              <div>
                <label htmlFor="newEmail" className="label">Login email</label>
                <input id="newEmail" type="email" required className="input" placeholder="name@example.com" value={newForm.email} onChange={setNew("email")} />
              </div>
              <div>
                <label htmlFor="phone" className="label">Mobile number <span className="font-normal normal-case text-muted">(optional)</span></label>
                <input id="phone" className="input" placeholder="09XX XXX XXXX" value={newForm.phone} onChange={setNew("phone")} />
              </div>
              <div>
                <label htmlFor="newPassword" className="label">Password</label>
                <PasswordInput id="newPassword" required autoComplete="new-password" className="input" placeholder="At least 6 characters" value={newForm.password} onChange={setNew("password")} />
              </div>
              <div>
                <label htmlFor="newConfirm" className="label">Confirm password</label>
                <PasswordInput id="newConfirm" required autoComplete="new-password" className="input" value={newForm.confirm} onChange={setNew("confirm")} />
              </div>
            </div>
            {saveError && <p className="mt-3 text-xs text-rose">{saveError.message}</p>}
            <button type="submit" disabled={saving} className="btn-primary mt-5 w-full">
              <Icon name="plus" size={14} /> {saving ? "Creating…" : "Create receptionist account"}
            </button>
            <button type="button" onClick={() => pick(selected ?? {})} className="mt-2 w-full text-center text-[11px] text-muted hover:text-forest">
              Cancel
            </button>
          </form>
        ) : (
          selected && (
            <div className="h-fit space-y-5">
              <form onSubmit={saveLogin} className="card p-5">
                <h2 className="font-serif text-2xl">{selected.full_name || "Staff account"}</h2>
                <p className="text-[11px] text-muted">{roleLabel[selected.role]} · {selected.email}</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="email" className="label">New email</label>
                    <input id="email" type="email" className="input" placeholder={selected.email} value={form.email} onChange={set("email")} />
                  </div>
                  <div>
                    <label htmlFor="password" className="label">New password</label>
                    <PasswordInput id="password" autoComplete="new-password" className="input" placeholder="Leave blank to keep the current one" value={form.password} onChange={set("password")} />
                  </div>
                  <div>
                    <label htmlFor="confirm" className="label">Confirm new password</label>
                    <PasswordInput id="confirm" autoComplete="new-password" className="input" value={form.confirm} onChange={set("confirm")} />
                  </div>
                </div>
                {isMe && <p className="mt-3 text-[11px] text-muted">This is your own account. Use the new details next time you sign in.</p>}
                {saveError && <p className="mt-3 text-xs text-rose">{saveError.message}</p>}
                <button type="submit" disabled={saving} className="btn-primary mt-5 w-full">
                  <Icon name="lock" size={14} /> {saving ? "Saving…" : "Save login changes"}
                </button>
              </form>

              {selected.role === "receptionist" && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold">Remove from front desk</h3>
                  <p className="mt-1 text-[11px] text-muted">
                    Deletes this login so they can no longer sign in. Bookings and log entries they made are kept.
                  </p>
                  {confirmRemove ? (
                    <div className="mt-3 flex gap-2">
                      <button onClick={remove} disabled={saving} className="btn-danger flex-1 px-4 py-2 text-[10px]">
                        Yes, remove {(selected.full_name || selected.email).split(" ")[0]}
                      </button>
                      <button onClick={() => setConfirmRemove(false)} className="btn-outline px-4 py-2 text-[10px]">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRemove(true)} className="btn-danger mt-3 w-full px-4 py-2 text-[10px]">
                      <Icon name="trash" size={13} /> Remove receptionist
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>
      <Toast message={toast} />
    </>
  );
}
