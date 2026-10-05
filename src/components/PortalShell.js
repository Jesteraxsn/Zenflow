"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import Icon from "./Icon";
import { useAuth } from "@/context/AuthContext";
import { initials } from "@/lib/format";

const roleLabel = { admin: "Administrator", receptionist: "Front desk", customer: "Customer" };

// Shared chrome for staff portals (admin, receptionist).
export default function PortalShell({ nav, home, title, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const name = profile?.full_name || "Staff";
  const isActive = (href) => (href === home ? pathname === href : pathname.startsWith(href));

  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo href={home} mark subtitle={`${title} · Powered by ZenFlow`} />
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden text-[11px] text-muted hover:text-forest sm:inline" target="_blank">
              View customer site ↗
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold">{name}</p>
              <p className="text-[10px] text-muted">{roleLabel[profile?.role] ?? ""}</p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-sage text-xs font-semibold text-forest">
              {initials(name)}
            </span>
            <button onClick={logout} className="text-muted hover:text-forest" aria-label="Log out" title="Log out">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 sm:px-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-b-2 pb-2.5 text-xs whitespace-nowrap transition ${
                isActive(item.href) ? "border-forest font-semibold text-forest" : "border-transparent text-ink/70 hover:text-forest"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">{children}</main>
      <footer className="mt-auto bg-bark text-white/75">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-[11px] sm:flex-row sm:justify-between sm:px-6">
          <p>Luna St., La Paz, Iloilo City, Philippines</p>
          <p>Ginhawa {title.toLowerCase()} · Powered by ZenFlow · © 2026</p>
        </div>
      </footer>
    </>
  );
}
