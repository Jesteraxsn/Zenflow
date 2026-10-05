import { startsAtISO } from "./format";

// Mirrors the database's checks (works_on / therapist_free_at in schema.sql) so the UI
// can grey out slots. The database still has the final say inside create_booking.

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const dayIndex = (s) => DAYS.indexOf(s.trim().slice(0, 3).toLowerCase());

export function manilaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// Does a free-text schedule like "Mon – Sat" or "Mon, Wed, Fri" include this date (YYYY-MM-DD)?
// Anything we can't read counts as every day, so a typo never hides a therapist.
export function worksOn(workDays, dateKey) {
  if (!workDays?.trim() || /daily|every/i.test(workDays)) return true;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  let parsed = false;
  for (const part of workDays.split(",")) {
    const [from, to = from] = part.split(/\s*[–—-]\s*/);
    const a = dayIndex(from);
    const b = dayIndex(to);
    if (a < 0 || b < 0) continue;
    parsed = true;
    if (a <= b ? dow >= a && dow <= b : dow >= a || dow <= b) return true;
  }
  return !parsed;
}

// Therapists who can take bookings on a date. "Off today" only counts for today.
export function bookableTherapists(therapists, dateKey = manilaToday()) {
  return therapists.filter(
    (t) => t.active && worksOn(t.work_days, dateKey) && !(t.status === "Off today" && dateKey === manilaToday()),
  );
}

const hhmm = (t) => (t ?? "").slice(0, 5);

// Whole session fits inside the therapist's shift (times are Manila wall-clock).
function withinShift(t, time, duration) {
  const [h, m] = time.split(":").map(Number);
  const end = h * 60 + m + duration;
  const endHHMM = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return time >= hhmm(t.shift_start) && endHHMM <= hhmm(t.shift_end);
}

function overlaps(busy, therapistId, start, end) {
  return busy.some(
    (b) => b.therapist_id === therapistId && new Date(b.starts_at) < end && new Date(b.ends_at) > start,
  );
}

// Returns { [slotValue]: { available, reason, freeCount } } for one day.
// Pass `therapists` already filtered with bookableTherapists(…, date).
export function slotAvailability({ date, slots, duration, busy, therapists, therapistId, now = new Date() }) {
  const pool = therapistId ? therapists.filter((t) => t.id === therapistId) : therapists;
  const result = {};
  for (const slot of slots) {
    const start = new Date(startsAtISO(date, slot.value));
    const end = new Date(start.getTime() + duration * 60000);
    if (start < now) {
      result[slot.value] = { available: false, reason: "past", freeCount: 0 };
      continue;
    }
    const onShift = pool.filter((t) => withinShift(t, slot.value, duration));
    if (onShift.length === 0) {
      result[slot.value] = { available: false, reason: "off", freeCount: 0 };
      continue;
    }
    const free = onShift.filter((t) => !overlaps(busy, t.id, start, end));
    result[slot.value] = { available: free.length > 0, reason: free.length ? null : "booked", freeCount: free.length };
  }
  return result;
}
