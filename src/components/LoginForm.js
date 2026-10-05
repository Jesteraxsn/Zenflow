"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Field from "@/components/Field";
import Icon from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { signIn } from "@/lib/api";
import { ROLE_HOME, safeNext } from "@/lib/session";

// Sign-in card shared by the customer (/login) and staff (/admin/login) pages.
// Accounts whose role isn't in `roles` are signed straight back out and pointed elsewhere.
export default function LoginForm({ roles, eyebrow, heading, intro, submitLabel, wrongPortal, children }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function login(email, password) {
    setBusy(true);
    setError(null);
    try {
      const profile = await signIn(email, password);
      if (!roles.includes(profile.role)) {
        await signOut();
        setError(wrongPortal);
        setBusy(false);
        return;
      }
      const next = safeNext(new URLSearchParams(window.location.search).get("next"), profile.role);
      router.replace(next ?? ROLE_HOME[profile.role]);
      router.refresh();
    } catch (err) {
      setError(err.message === "Invalid login credentials" ? "Email or password is incorrect." : err.message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login(form.email, form.password);
        }}
        className="card p-8 shadow-lg"
      >
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">{heading}</h1>
        <p className="mt-1 text-xs text-muted">{intro}</p>

        <div className="mt-6 space-y-4">
          <Field id="email" label="Email address" icon="mail" type="email" placeholder="you@example.com" required value={form.email} onChange={set("email")} />
          <Field id="password" label="Password" icon="lock" type="password" placeholder="Enter your password" required value={form.password} onChange={set("password")} />
        </div>

        {error && <p className="mt-3 text-xs text-rose">{error}</p>}

        <div className="mt-4 flex justify-end text-xs">
          <Link href="/forgot-password" className="font-semibold text-forest hover:underline">Forgot password?</Link>
        </div>

        <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
          {busy ? "Signing in…" : submitLabel} <Icon name="arrow" size={14} />
        </button>
        {children}
      </form>
    </div>
  );
}
