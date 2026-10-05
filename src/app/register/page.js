"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Field from "@/components/Field";
import Icon from "@/components/Icon";
import { signUp } from "@/lib/api";
import { safeNext } from "@/lib/session";

const perks = [
  "Personalized treatment recommendations",
  "Effortless appointment management",
  "Private wellness notes and reminders",
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signUp(form);
      const next = safeNext(new URLSearchParams(window.location.search).get("next"), "customer");
      router.replace(next ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        /rate limit/i.test(err.message)
          ? "Supabase is limiting sign-up emails. Turn off “Confirm email” in Supabase → Authentication → Sign In / Providers → Email, then try again."
          : err.message,
      );
      setBusy(false);
    }
  }

  function goLogin(e) {
    e.preventDefault();
    router.push(`/login${window.location.search}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="grid flex-1 lg:grid-cols-[2fr_3fr]">
        <section className="bg-forest-dark px-8 py-16 text-white sm:px-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">Begin your journey</p>
          <h1 className="mt-4 font-serif text-5xl leading-tight">
            Make space for the
            <br />
            life within you.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/75">
            Create your account to reserve restorative treatments, follow your wellness rhythm, and receive thoughtful
            care from our sanctuary team.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/85">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <Icon name="sparkle" size={14} className="text-tan" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex items-center justify-center px-4 py-14">
          <form onSubmit={handleSubmit} className="card w-full max-w-md p-8 shadow-lg">
            <p className="eyebrow">New membership</p>
            <h2 className="mt-2 font-serif text-4xl">Create your account.</h2>
            <p className="mt-1 text-xs text-muted">A few details, then your path to restoration begins.</p>

            <div className="mt-6 space-y-4">
              <Field id="name" label="Full name" icon="user" placeholder="Your full name" required value={form.fullName} onChange={set("fullName")} />
              <Field id="email" label="Email address" icon="mail" type="email" placeholder="you@example.com" required value={form.email} onChange={set("email")} />
              <Field id="phone" label="Mobile number" icon="chat" type="tel" placeholder="09XX XXX XXXX" value={form.phone} onChange={set("phone")} />
              <Field id="password" label="Password" icon="lock" type="password" placeholder="Create a secure password" required value={form.password} onChange={set("password")} />
            </div>

            {error && <p className="mt-3 text-xs text-rose">{error}</p>}

            <p className="mt-4 text-[11px] text-muted">By creating an account, you agree to our Terms of Care and Privacy Policy.</p>
            <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
              {busy ? "Creating account…" : "Create account"} <Icon name="arrow" size={14} />
            </button>
            <p className="mt-5 text-center text-xs text-muted">
              Already a member?{" "}
              <Link href="/login" onClick={goLogin} className="font-medium text-forest hover:underline">
                Log in to your portal
              </Link>
            </p>
          </form>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
