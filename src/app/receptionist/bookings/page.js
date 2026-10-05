import PageIntro from "@/components/PageIntro";
import BookingsTable from "@/components/BookingsTable";

export default function ReceptionistBookings() {
  return (
    <>
      <PageIntro eyebrow="Front desk" title="Bookings" subtitle="Verify payments, mark sessions done, and handle cancellations. Updates live." />
      <BookingsTable canDelete />
    </>
  );
}
