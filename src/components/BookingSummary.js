import { TIME_SLOTS } from "@/lib/constants";
import { longDate, peso } from "@/lib/format";
import { priceFor } from "@/lib/pricing";

export const slotLabel = (value) => TIME_SLOTS.find((s) => s.value === value)?.label ?? value;

// Right-hand summary card used on the booking and checkout steps.
export default function BookingSummary({ service, therapistName, date, time, duration, title = "Your booking", children }) {
  return (
    <aside className="card h-fit p-6 lg:sticky lg:top-6">
      <h2 className="font-serif text-2xl">{title}</h2>
      {service ? (
        <>
          <p className="mt-4 text-sm font-semibold">{service.name}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>{date ? longDate(date) : "Select a date"}</li>
            <li>{time ? `${slotLabel(time)} · ${duration} minutes` : "Select a time"}</li>
            <li>{therapistName}</li>
            <li>Serenity Suite</li>
          </ul>
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs text-muted">Total</p>
            <p className="font-serif text-3xl">{peso(priceFor(service, duration))}</p>
          </div>
        </>
      ) : (
        <p className="mt-4 text-xs text-muted">Choose a treatment to begin.</p>
      )}
      {children}
    </aside>
  );
}
