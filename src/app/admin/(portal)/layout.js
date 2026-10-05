import PortalShell from "@/components/PortalShell";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/therapists", label: "Therapists" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/reports", label: "Financial reports" },
  { href: "/admin/logs", label: "System logs" },
  { href: "/receptionist", label: "Front desk ↗" },
];

export const metadata = { title: "Admin" };

export default function AdminLayout({ children }) {
  return (
    <PortalShell nav={nav} home="/admin" title="Admin portal">
      {children}
    </PortalShell>
  );
}
