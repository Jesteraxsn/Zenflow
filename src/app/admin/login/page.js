"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import LoginForm from "@/components/LoginForm";
import { CUSTOMER_LOGIN, STAFF_ROLES } from "@/lib/session";

// Staff sign-in (admins and front desk). Kept outside the (portal) group so it skips the portal chrome.
export default function StaffLoginPage() {
  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Logo href="/" mark="zenflow" subtitle="Staff portal · Powered by ZenFlow" />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <LoginForm
          roles={STAFF_ROLES}
          eyebrow="Staff portal"
          heading="Admin & front desk sign in"
          intro="For Ginhawa administrators and reception staff only."
          submitLabel="Login to portal"
          wrongPortal={
            <>
              This is a customer account. Please use the{" "}
              <Link href={CUSTOMER_LOGIN} className="font-semibold underline">customer login</Link>.
            </>
          }
        >
          <p className="mt-5 text-center text-[11px] text-muted">
            Not staff?{" "}
            <Link href={CUSTOMER_LOGIN} className="hover:text-forest hover:underline">Customer login</Link>
          </p>
        </LoginForm>
      </main>
      <footer className="mt-auto bg-bark text-white/75">
        <div className="mx-auto max-w-7xl px-4 py-4 text-[11px] sm:px-6">Ginhawa staff portal · Powered by ZenFlow · © 2026</div>
      </footer>
    </>
  );
}
