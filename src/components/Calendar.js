"use client";

import { useState } from "react";
import Icon from "./Icon";
import { toISODate } from "@/lib/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar({ value, onChange, minDate = new Date() }) {
  const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  const [view, setView] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : min;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const firstWeekday = view.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];

  const canGoBack = view > new Date(min.getFullYear(), min.getMonth(), 1);
  const shift = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-serif text-xl">
          {view.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
        </p>
        <div className="flex gap-1">
          <button type="button" disabled={!canGoBack} onClick={() => shift(-1)} className="rounded-full p-1.5 hover:bg-sand disabled:opacity-30" aria-label="Previous month">
            <Icon name="chevronLeft" />
          </button>
          <button type="button" onClick={() => shift(1)} className="rounded-full p-1.5 hover:bg-sand" aria-label="Next month">
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{d}</span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const iso = toISODate(date);
          const disabled = date < min;
          const selected = iso === value;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-sm transition ${
                selected
                  ? "bg-forest text-white"
                  : disabled
                    ? "text-muted/40"
                    : "hover:bg-sage"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
