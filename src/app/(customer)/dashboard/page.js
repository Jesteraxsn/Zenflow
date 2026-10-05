"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { ErrorBox, Loading } from "@/components/States";
import { getMyBookings } from "@/lib/api";
import { firstName, greeting, longDate, peso, shortDate, timeOf, TZ } from "@/lib/format";
import useAsync from "@/lib/useAsync";
import useNow from "@/lib/useNow";
import { useAuth } from "@/context/AuthContext";
import { useBooking } from "@/context/BookingContext";

const quickActions = [
  { icon: "leaf", label: "Browse treatments", href: "/services" },
  { icon: "calendar", label: "Book a new time", href: "/book" },
  { icon: "chat", label: "Read the wellness journal", href: "/journal" },
];

const ACTIVE = ["pending_payment", "pending_verification", "confirmed"];
const progressSteps = ["Treatment selected", "Payment submitted", "Schedule confirmed", "Restored"];
const progressIndex = { pending_payment: 1, pending_verification: 2, confirmed: 3, completed: 4 };

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { update } = useBooking();
  const now = useNow();
  const { data, loading, error, reload } = useAsync(
    () => (user ? getMyBookings(user.id) : Promise.resolve([])),
    [user?.id],
    { pollMs: 15000 },
  );

  if (!user || loading) return <Loading label="Loading your appointments…" />;

  const bookings = data ?? [];
  const upcoming = bookings
    .filter((b) => ACTIVE.includes(b.status) && new Date(b.ends_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const next = upcoming[0];
  const history = bookings.filter((b) => !upcoming.includes(b));
  const completed = bookings.filter((b) => b.status === "completed");
  const spent = bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + Number(b.price), 0);
  const step = next ? progressIndex[next.status] : 0;

  function pay(booking) {
    update({ bookingId: booking.id });
    router.push("/checkout");
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">
            {new Date().toLocaleDateString("en-PH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="font-serif text-4xl sm:text-[44px]">
            {greeting()}, {firstName(profile?.full_name)}.
          </h1>
          <p className="mt-1 text-sm text-muted">
            {next ? "Your next pause is already waiting." : "Ready when you are. Book your next moment of calm."}
          </p>
        </div>
        <Link href="/services" className="btn-primary">
          Book new treatment <Icon name="arrow" size={14} />
        </Link>
      </div>

      <ErrorBox error={error} onRetry={reload} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {next ? (
            <section className="card p-6">
              <div className="flex items-start justify-between">
                <p className="eyebrow text-[10px]">Upcoming appointment</p>
                <StatusBadge status={next.status} />
              </div>
              <h2 className="mt-2 font-serif text-3xl">{next.service?.name}</h2>
              <p className="mt-3 text-sm">{longDate(next.starts_at)} · {timeOf(next.starts_at)}</p>
              <p className="mt-1 text-xs text-muted">
                {Math.round((new Date(next.ends_at) - new Date(next.starts_at)) / 60000)} minutes · Serenity Suite
              </p>
              <p className="mt-1 text-xs text-muted">With {next.therapist?.full_name} · {peso(next.price)}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {next.status === "pending_payment" ? (
                  <button onClick={() => pay(next)} className="btn-primary">Complete payment</button>
                ) : (
                  <Link href={`/booking-status?id=${next.id}`} className="btn-outline">View details</Link>
                )}
                <Link href={`/booking-status?id=${next.id}`} className="text-xs text-muted hover:text-forest">
                  Track status
                </Link>
              </div>
            </section>
          ) : (
            <section className="card p-8 text-center">
              <p className="font-serif text-2xl">No upcoming appointments</p>
              <p className="mt-2 text-sm text-muted">Choose a treatment and we&apos;ll find you a quiet hour.</p>
              <Link href="/services" className="btn-primary mt-5">Browse treatments</Link>
            </section>
          )}

          {next && (
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl">Booking status</h2>
                <span className="text-[11px] text-muted">Ref {next.code}</span>
              </div>
              <ol className="mt-6 grid grid-cols-4">
                {progressSteps.map((label, i) => {
                  const done = i < step;
                  return (
                    <li key={label} className="relative flex flex-col items-center text-center">
                      {i > 0 && <span className={`absolute top-1.5 right-1/2 h-px w-full ${done ? "bg-forest" : "bg-line"}`} />}
                      <span className={`relative h-3 w-3 rounded-full border-2 border-forest ${done ? "bg-forest" : "bg-card"}`} />
                      <span className="mt-2 text-[10px] text-muted sm:text-[11px]">{label}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {upcoming.length > 1 && (
            <section className="card p-6">
              <h2 className="font-serif text-xl">Also coming up</h2>
              <ul className="mt-3 divide-y divide-line">
                {upcoming.slice(1).map((b) => (
                  <li key={b.id}>
                    <Link href={`/booking-status?id=${b.id}`} className="flex items-center justify-between py-3 text-sm hover:text-forest">
                      <span>
                        <span className="font-medium">{b.service?.name}</span>
                        <span className="block text-[11px] text-muted">{shortDate(b.starts_at)} · {timeOf(b.starts_at)}</span>
                      </span>
                      <StatusBadge status={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-6">
            <h2 className="font-serif text-xl">Past visits</h2>
            {history.length === 0 ? (
              <p className="mt-3 text-xs text-muted">Your visit history will appear here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {history.map((b) => (
                  <li key={b.id}>
                    <Link href={`/booking-status?id=${b.id}`} className="flex items-center justify-between py-3 text-sm hover:text-forest">
                      <span>
                        <span className="font-medium">{b.service?.name}</span>
                        <span className="block text-[11px] text-muted">{shortDate(b.starts_at)} · {b.therapist?.full_name}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs">{peso(b.price)}</span>
                        <StatusBadge status={b.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card grid grid-cols-2 gap-3 p-5 text-center">
            <div>
              <p className="font-serif text-3xl">{completed.length}</p>
              <p className="text-[11px] text-muted">Visits</p>
            </div>
            <div>
              <p className="font-serif text-3xl">{peso(spent)}</p>
              <p className="text-[11px] text-muted">Invested in rest</p>
            </div>
          </section>
          <section className="card p-5">
            <h2 className="font-serif text-xl">Quick actions</h2>
            <div className="mt-4 space-y-2">
              {quickActions.map((a) => (
                <Link key={a.label} href={a.href} className="flex items-center justify-between rounded-lg bg-sand px-4 py-3 text-xs transition hover:bg-sage">
                  <span className="flex items-center gap-3">
                    <Icon name={a.icon} size={15} className="text-muted" />
                    {a.label}
                  </span>
                  <Icon name="arrow" size={13} className="text-muted" />
                </Link>
              ))}
            </div>
          </section>
          <section className="card p-5">
            <p className="eyebrow text-[10px]">This week</p>
            <p className="mt-2 font-serif text-xl italic">&ldquo;Rest is not an escape. It is the way home.&rdquo;</p>
            <p className="mt-3 text-[11px] text-muted">Prepare for your ritual by hydrating well and arriving 15 minutes early.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
