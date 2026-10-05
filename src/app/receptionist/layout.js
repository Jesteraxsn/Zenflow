import PortalShell from "@/components/PortalShell";

const nav = [
  { href: "/receptionist", label: "Today" },
  { href: "/receptionist/walk-in", label: "Encode walk-in" },
  { href: "/receptionist/bookings", label: "Bookings" },
  { href: "/receptionist/earnings", label: "Therapist earnings" },
];

export const metadata = { title: "Front desk" };

export default function ReceptionistLayout({ children }) {
  return (
    <PortalShell nav={nav} home="/receptionist" title="Front desk">
      {children}
    </PortalShell>
  );
}
