"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Field from "@/components/Field";
import Icon from "@/components/Icon";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="card w-full max-w-md p-8 shadow-lg">
          <p className="eyebrow">Account help</p>
          <h1 className="mt-2 font-serif text-4xl">Reset your password.</h1>
          {sent ? (
            <p className="mt-4 text-sm text-muted">If that email is registered, a reset link is on its way. Check your inbox.</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="mt-1 text-xs text-muted">Enter your email and we&apos;ll send you a reset link.</p>
              <div className="mt-6">
                <Field id="email" label="Email address" icon="mail" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <p className="mt-3 text-xs text-rose">{error}</p>}
              <button type="submit" className="btn-primary mt-6 w-full">
                Send reset link <Icon name="arrow" size={14} />
              </button>
            </form>
          )}
          <p className="mt-5 text-center text-xs text-muted">
            <Link href="/login" className="font-medium text-forest hover:underline">Back to login</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
