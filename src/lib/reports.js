import { EARNING_STATUSES } from "./constants";
import { addDays, dateKey, todayKey, weekday } from "./format";

export const isEarning = (b) => EARNING_STATUSES.includes(b.status);

// Revenue per day for the last `days` days (oldest first), for the bar chart.
export function dailyEarnings(bookings, days = 7) {
  const today = todayKey();
  const keys = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  return keys.map((key) => ({
    key,
    day: key === today ? "Today" : weekday(key),
    amount: bookings.filter((b) => isEarning(b) && dateKey(b.starts_at) === key).reduce((s, b) => s + Number(b.price), 0),
  }));
}

// Sessions, gross and commission per therapist.
export function earningsByTherapist(bookings, therapists) {
  return therapists
    .map((t) => {
      const mine = bookings.filter((b) => isEarning(b) && b.therapist_id === t.id);
      const gross = mine.reduce((s, b) => s + Number(b.price), 0);
      return {
        id: t.id,
        therapist: t.full_name,
        rate: Number(t.commission_rate),
        sessions: mine.length,
        gross,
        commission: Math.round(gross * Number(t.commission_rate) * 100) / 100,
      };
    })
    .sort((a, b) => b.gross - a.gross);
}

export function earningsByService(bookings) {
  const map = new Map();
  for (const b of bookings.filter(isEarning)) {
    const name = b.service?.name ?? "Unknown";
    const row = map.get(name) ?? { service: name, sessions: 0, gross: 0 };
    row.sessions += 1;
    row.gross += Number(b.price);
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.gross - a.gross);
}

// ISO timestamp for the start of a Manila day `offset` days from today.
export function dayStartISO(offset = 0) {
  return `${addDays(todayKey(), offset)}T00:00:00+08:00`;
}
