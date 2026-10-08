import { peso } from "./format";

// Each service has a price per duration in `prices` ({ "60": 1450, "90": 1850 }).
// `price` is the lowest of them, kept for "from ₱…" labels and as a fallback.
// Mirrors the lookup in create_booking (supabase/schema.sql).

export function priceFor(service, duration) {
  const p = service?.prices?.[String(duration)];
  return Number(p ?? service?.price ?? 0);
}

export function priceList(service) {
  return [...service.durations].sort((a, b) => a - b).map((d) => ({ duration: d, price: priceFor(service, d) }));
}

// "₱1,450" when every duration costs the same, otherwise "from ₱1,150".
export function fromPrice(service) {
  const all = priceList(service).map((r) => r.price);
  const min = Math.min(...all);
  return all.every((p) => p === min) ? peso(min) : `from ${peso(min)}`;
}

// "60 min ₱1,150 · 90 min ₱1,450"
export function priceBreakdown(service) {
  return priceList(service)
    .map((r) => `${r.duration} min ${peso(r.price)}`)
    .join(" · ");
}

// Turn editor rows [{ duration, price }] into what the database stores.
export function toServicePricing(rows) {
  const clean = rows
    .map((r) => ({ duration: Number(r.duration), price: Number(r.price) }))
    .filter((r) => r.duration > 0)
    .sort((a, b) => a.duration - b.duration);
  const durations = [...new Set(clean.map((r) => r.duration))];
  const prices = Object.fromEntries(clean.map((r) => [String(r.duration), r.price]));
  return { durations, prices, price: durations.length ? Math.min(...durations.map((d) => prices[String(d)])) : 0 };
}
