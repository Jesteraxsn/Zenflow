import { TIME_SLOTS } from "@/lib/constants";
import { longDate, peso } from "@/lib/format";
import { addonLabel, priceFor } from "@/lib/pricing";

export const slotLabel = (value) => TIME_SLOTS.find((s) => s.value === value)?.label ?? value;

// Right-hand summary card on the booking step. `price` is a quote() result; without it the
// plain duration price is shown.
export default function BookingSummary({ service, therapistName, date, time, duration, addons = [], price, title = "Your booking", children }) {
  const total = price ? price.total : priceFor(service, duration);
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
            <li>{addons.includes("homeService") ? "Home service" : "Serenity Suite"}</li>
          </ul>
          {price && (price.addonsTotal > 0 || price.discount > 0) && (
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted">{duration}-minute treatment</dt><dd className="shrink-0">{peso(price.base)}</dd></div>
              {addons.length > 0 && (
                <div className="flex justify-between gap-3"><dt className="text-muted">{addons.map(addonLabel).join(", ")}</dt><dd className="shrink-0">+{peso(price.addonsTotal)}</dd></div>
              )}
              {price.discount > 0 && (
                <div className="flex justify-between gap-3 text-forest"><dt>{price.discountLabel}</dt><dd className="shrink-0">−{peso(price.discount)}</dd></div>
              )}
            </dl>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-xs text-muted">Total</p>
            <p className="font-serif text-3xl">{peso(total)}</p>
          </div>
        </>
      ) : (
        <p className="mt-4 text-xs text-muted">Choose a treatment to begin.</p>
      )}
      {children}
    </aside>
  );
}
