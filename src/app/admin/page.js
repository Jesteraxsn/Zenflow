"use client";

import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import EarningsChart from "@/components/EarningsChart";
import { ErrorBox, Loading } from "@/components/States";
import { countNewClients, getBookings, getLogs, getTherapists } from "@/lib/api";
import { dateKey, firstName, peso, relativeTime, todayKey } from "@/lib/format";
import { dailyEarnings, dayStartISO, isEarning } from "@/lib/reports";
import useAsync from "@/lib/useAsync";
import useNow from "@/lib/useNow";
import { useAuth } from "@/context/AuthContext";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const now = useNow();
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([
        getBookings({ from: dayStartISO(-13), to: dayStartISO(30) }),
        getTherapists(),
        getLogs(6),
        countNewClients(dayStartISO(-6)),
      ]),
    [],
    { pollMs: 30000 },
  );

  if (loading) return <Loading label="Gathering today's numbers…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const [bookings, therapists, logs, newClients] = data;
  const today = todayKey();
  const lastWeekSameDay = dateKey(new Date(now - 7 * 86400000));
  const todays = bookings.filter((b) => dateKey(b.starts_at) === today);
  const revenue = todays.filter(isEarning).reduce((s, b) => s + Number(b.price), 0);
  const prevRevenue = bookings.filter((b) => isEarning(b) && dateKey(b.starts_at) === lastWeekSameDay).reduce((s, b) => s + Number(b.price), 0);
  const change = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
  const toVerify = bookings.filter((b) => b.status === "pending_verification").length;
  const onDuty = therapists.filter((t) => t.status === "On duty").length;
  const chart = dailyEarnings(bookings, 7);
  const weekTotal = chart.reduce((s, d) => s + d.amount, 0);

  const stats = [
    { label: "Today's revenue", value: peso(revenue), note: change === null ? "Confirmed & completed" : `${change >= 0 ? "+" : ""}${change}% vs same day last week`, icon: "peso" },
    { label: "Appointments today", value: todays.filter((b) => b.status !== "cancelled").length, note: `${toVerify} payment${toVerify === 1 ? "" : "s"} to verify`, icon: "calendar", href: "/admin/bookings" },
    { label: "New clients", value: newClients, note: "Signed up this week", icon: "users", href: "/admin/clients" },
    { label: "Therapists on duty", value: onDuty, note: `${therapists.length - onDuty} on break or off`, icon: "leaf", href: "/admin/therapists" },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Administration"
        title={`Welcome back, ${firstName(profile?.full_name)}`}
        subtitle="A calm overview of today's sanctuary operations."
        action={
          <Link href="/admin/reports" className="btn-primary">
            <Icon name="grid" size={14} /> Financial reports
          </Link>
        }
      />

      {toVerify > 0 && (
        <Link href="/admin/bookings" className="mb-5 flex items-center justify-between rounded-xl border border-tan bg-tan/40 px-5 py-3 text-xs transition hover:border-bark/30">
          <span><strong>{toVerify}</strong> payment{toVerify === 1 ? " is" : "s are"} waiting for verification.</span>
          <span className="font-semibold text-forest">Review now →</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <div className="flex items-start justify-between">
                <p className="text-xs text-muted">{s.label}</p>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-sand text-muted">
                  <Icon name={s.icon} size={14} />
                </span>
              </div>
              <p className="mt-2 font-serif text-3xl">{s.value}</p>
              <p className="mt-1 text-[11px] text-forest">{s.note}</p>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="card p-5 transition hover:border-forest/40">{body}</Link>
          ) : (
            <div key={s.label} className="card p-5">{body}</div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif text-2xl">Earnings summary</h2>
              <p className="text-[11px] text-muted">Last 7 days · confirmed &amp; completed</p>
            </div>
            <p className="font-serif text-2xl">{peso(weekTotal)}</p>
          </div>
          <div className="mt-6">
            <EarningsChart data={chart} />
          </div>
        </section>

        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="font-serif text-xl">Quick management</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Services", "/admin/services"],
                ["Therapists", "/admin/therapists"],
                ["Bookings", "/admin/bookings"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="rounded-md bg-sage py-2.5 text-center text-xs text-forest transition hover:bg-forest hover:text-white">
                  {label}
                </Link>
              ))}
            </div>
          </section>
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl">Recent activity</h2>
              <Link href="/admin/logs" className="text-[11px] text-forest hover:underline">View all</Link>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <span className="w-16 shrink-0 text-[10px] text-muted">{relativeTime(log.created_at)}</span>
                  <span className="flex-1">{log.action}</span>
                  <span className="shrink-0 font-semibold">{log.amount ? peso(log.amount) : "—"}</span>
                </li>
              ))}
              {logs.length === 0 && <li className="py-3 text-xs text-muted">No activity yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
