"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Field from "@/components/Field";
import Icon from "@/components/Icon";
import { Loading } from "@/components/States";
import { supabase } from "@/lib/supabase";
import { ROLE_HOME } from "@/lib/session";

// Landing page for the emailed reset link. The Supabase client swaps the link's code
// for a short-lived session; here the user picks a new password with it.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(null); // null = checking, false = bad/expired link
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    // Give the client a moment to finish exchanging the code from the link.
    const timer = setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession();
      setReady((r) => r ?? Boolean(s.session));
    }, 1500);
    return () => {
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError("");
    const { data, error } = await supabase.auth.updateUser({ password: form.password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    router.replace(ROLE_HOME[profile?.role] ?? "/");
    router.refresh();
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="card w-full max-w-md p-8 shadow-lg">
          <p className="eyebrow">Account help</p>
          <h1 className="mt-2 font-serif text-4xl">Choose a new password.</h1>
          {ready === null ? (
            <Loading label="Checking your reset link…" />
          ) : ready === false ? (
            <>
              <p className="mt-4 text-sm text-muted">This reset link is invalid or has expired. Request a new one and use it within the hour.</p>
              <Link href="/forgot-password" className="btn-primary mt-6 w-full">
                Send a new link <Icon name="arrow" size={14} />
              </Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <div className="mt-6 space-y-4">
                <Field id="password" label="New password" icon="lock" type="password" placeholder="At least 6 characters" required value={form.password} onChange={set("password")} />
                <Field id="confirm" label="Confirm new password" icon="lock" type="password" placeholder="Type it again" required value={form.confirm} onChange={set("confirm")} />
              </div>
              {error && <p className="mt-3 text-xs text-rose">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
                {busy ? "Saving…" : "Save new password"} <Icon name="arrow" size={14} />
              </button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
