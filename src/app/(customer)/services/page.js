"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PageIntro from "@/components/PageIntro";
import Icon from "@/components/Icon";
import { ErrorBox, Loading } from "@/components/States";
import { getServices } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { peso } from "@/lib/format";
import useAsync from "@/lib/useAsync";
import { useBooking } from "@/context/BookingContext";

export default function ServicesPage() {
  const router = useRouter();
  const { update } = useBooking();
  const [filter, setFilter] = useState("All");
  const { data: services, loading, error, reload } = useAsync(() => getServices(), []);

  const visible = (services ?? []).filter((s) => filter === "All" || s.category === filter);

  function select(service) {
    update({
      serviceId: service.id,
      duration: service.durations.at(-1),
      date: null,
      time: null,
    });
    router.push("/book");
  }

  return (
    <>
      <PageIntro
        eyebrow="Our treatment menu"
        title="Choose what your body needs."
        subtitle="Thoughtful therapies rooted in Filipino healing traditions, offered at an unhurried pace."
        action={
          <div className="flex flex-wrap gap-2">
            {["All", ...SERVICE_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full border px-3.5 py-1.5 text-[11px] transition ${
                  filter === c ? "border-forest bg-forest text-white" : "border-line bg-card text-ink hover:border-forest"
                }`}
              >
                {c === "All" ? "All treatments" : c}
              </button>
            ))}
          </div>
        }
      />

      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <Loading label="Loading treatments…" />
      ) : (
        <div className="space-y-4">
          {visible.map((s) => (
            <article key={s.id} className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="eyebrow text-[10px]">{s.category}</p>
                <h2 className="mt-1 font-serif text-2xl">{s.name}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{s.description}</p>
              </div>
              <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="sm:text-right">
                  <p className="font-serif text-xl">{peso(s.price)}</p>
                  <p className="text-[11px] text-muted">{s.durations.join(" / ")} minutes</p>
                </div>
                <button onClick={() => select(s)} className="btn-primary px-5 py-2.5 text-[10px]">
                  Select &amp; schedule <Icon name="arrow" size={13} />
                </button>
              </div>
            </article>
          ))}
          {visible.length === 0 && <p className="text-sm text-muted">No treatments in this category yet.</p>}
        </div>
      )}
    </>
  );
}
