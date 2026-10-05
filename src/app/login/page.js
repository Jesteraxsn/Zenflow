"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Field from "@/components/Field";
import Icon from "@/components/Icon";
import { signIn } from "@/lib/api";
import { ROLE_HOME, safeNext } from "@/lib/session";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/constants";

const portals = { customer: "Customer", receptionist: "Receptionist", admin: "Admin" };
// Which actual roles may enter each portal.
const portalAllows = { customer: ["customer"], receptionist: ["receptionist", "admin"], admin: ["admin"] };

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", portal: "customer" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function login(email, password, portal) {
    setBusy(true);
    setError("");
    try {
      const profile = await signIn(email, password);
      // Picked the wrong portal? Send them to the one they belong to instead of failing.
      const home = portalAllows[portal].includes(profile.role)
        ? (portal === "receptionist" ? "/receptionist" : ROLE_HOME[profile.role])
        : ROLE_HOME[profile.role];
      const next = safeNext(new URLSearchParams(window.location.search).get("next"), profile.role);
      router.replace(next ?? home);
      router.refresh();
    } catch (err) {
      setError(err.message === "Invalid login credentials" ? "Email or password is incorrect." : err.message);
      setBusy(false);
    }
  }

  function goRegister(e) {
    e.preventDefault();
    router.push(`/register${window.location.search}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login(form.email, form.password, form.portal);
            }}
            className="card p-8 shadow-lg"
          >
            <p className="eyebrow">Welcome back</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight">
              Your sanctuary
              <br />
              awaits.
            </h1>
            <p className="mt-1 text-xs text-muted">Sign in to manage appointments and continue your wellness journey.</p>

            <div className="mt-6 space-y-4">
              <Field id="email" label="Email address" icon="mail" type="email" placeholder="you@example.com" required value={form.email} onChange={set("email")} />
              <Field id="password" label="Password" icon="lock" type="password" placeholder="Enter your password" required value={form.password} onChange={set("password")} />
              <div>
                <label htmlFor="portal" className="label">Portal role</label>
                <div className="relative">
                  <Icon name="user" size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                  <select id="portal" value={form.portal} onChange={set("portal")} className="input appearance-none pl-10">
                    {Object.entries(portals).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <Icon name="chevron" size={15} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-rose">{error}</p>}

            <div className="mt-4 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" className="accent-forest" defaultChecked /> Remember me
              </label>
              <Link href="/forgot-password" className="font-semibold text-forest hover:underline">Forgot password?</Link>
            </div>

            <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
              {busy ? "Signing in…" : "Login to portal"} <Icon name="arrow" size={14} />
            </button>
            <p className="mt-5 text-center text-xs text-muted">
              New to Ginhawa?{" "}
              <Link href="/register" onClick={goRegister} className="font-medium text-forest hover:underline">
                Create an account
              </Link>
            </p>
          </form>

          <div className="mt-5 rounded-xl border border-dashed border-line p-5">
            <p className="eyebrow text-[10px] text-muted">Live demo · one-click sign in</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.role}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setForm({ email: a.email, password: DEMO_PASSWORD, portal: a.role });
                    login(a.email, DEMO_PASSWORD, a.role);
                  }}
                  className="rounded-lg bg-sand px-2 py-2.5 text-center text-[11px] transition hover:bg-sage disabled:opacity-50"
                >
                  <span className="block font-semibold">{a.label}</span>
                  <span className="text-[10px] text-muted">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
