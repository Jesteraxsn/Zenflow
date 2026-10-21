"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import Icon from "./Icon";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME } from "@/lib/session";
import { firstName } from "@/lib/format";

const nav = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Treatments", match: ["/services", "/book"] },
  { href: "/dashboard", label: "My Appointments", match: ["/dashboard", "/checkout", "/booking-status"] },
  { href: "/journal", label: "Wellness Journal" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const accountHref = role ? ROLE_HOME[role] : "/login";
  const accountLabel = !role ? "Log in" : role === "customer" ? `Hi, ${firstName(profile?.full_name)}` : "Staff portal";

  async function logout() {
    setOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  }

  const isActive = (item) =>
    item.match ? item.match.some((m) => pathname.startsWith(m)) : pathname === item.href;

  return (
    <header className="border-b border-line bg-cream">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo mark="zenflow" />
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs transition hover:text-forest ${isActive(item) ? "font-medium text-forest" : "text-ink/80"}`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={accountHref}
            className="rounded-full border border-forest px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-forest hover:bg-sage"
          >
            {accountLabel}
          </Link>
          {role && (
            <button onClick={logout} className="text-muted hover:text-forest" aria-label="Log out" title="Log out">
              <Icon name="logout" size={17} />
            </button>
          )}
        </nav>
        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          <Icon name={open ? "x" : "menu"} size={22} />
        </button>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-sand">
              {item.label}
            </Link>
          ))}
          <Link href={accountHref} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-forest hover:bg-sand">
            {accountLabel}
          </Link>
          {role && (
            <button onClick={logout} className="rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-sand">
              Log out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
