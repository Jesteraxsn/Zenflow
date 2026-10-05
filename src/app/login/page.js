"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LoginForm from "@/components/LoginForm";
import { STAFF_LOGIN } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();

  function goRegister(e) {
    e.preventDefault();
    router.push(`/register${window.location.search}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <LoginForm
          roles={["customer"]}
          eyebrow="Welcome back"
          heading={<>Your sanctuary<br />awaits.</>}
          intro="Sign in to manage appointments and continue your wellness journey."
          submitLabel="Login to portal"
          wrongPortal={
            <>
              This is a staff account. Please use the{" "}
              <Link href={STAFF_LOGIN} className="font-semibold underline">staff login</Link>.
            </>
          }
        >
          <p className="mt-5 text-center text-xs text-muted">
            New to Ginhawa?{" "}
            <Link href="/register" onClick={goRegister} className="font-medium text-forest hover:underline">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-center text-[11px] text-muted">
            Staff member?{" "}
            <Link href={STAFF_LOGIN} className="hover:text-forest hover:underline">Sign in here</Link>
          </p>
        </LoginForm>
      </main>
      <SiteFooter />
    </>
  );
}
