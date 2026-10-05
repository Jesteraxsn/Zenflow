import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import BookingsTable from "@/components/BookingsTable";

export default function AdminBookings() {
  return (
    <>
      <PageIntro
        eyebrow="Administration"
        title="Bookings"
        subtitle="Every reservation across online and walk-in channels. Verify payments to confirm slots."
        action={
          <Link href="/receptionist/walk-in" className="btn-primary">
            <Icon name="plus" size={14} /> Encode walk-in
          </Link>
        }
      />
      <BookingsTable canDelete />
    </>
  );
}
