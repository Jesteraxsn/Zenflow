import { startsAtISO } from "./format";

// Mirrors the database's conflict check so the UI can grey out taken slots.
// The database still has the final say (exclusion constraint in create_booking).

export function bookableTherapists(therapists) {
  return therapists.filter((t) => t.active && t.status !== "Off today");
}

function overlaps(busy, therapistId, start, end) {
  return busy.some(
    (b) => b.therapist_id === therapistId && new Date(b.starts_at) < end && new Date(b.ends_at) > start,
  );
}

// Returns { [slotValue]: { available, reason, freeCount } } for one day.
export function slotAvailability({ date, slots, duration, busy, therapists, therapistId, now = new Date() }) {
  const pool = therapistId ? therapists.filter((t) => t.id === therapistId) : bookableTherapists(therapists);
  const result = {};
  for (const slot of slots) {
    const start = new Date(startsAtISO(date, slot.value));
    const end = new Date(start.getTime() + duration * 60000);
    if (start < now) {
      result[slot.value] = { available: false, reason: "past", freeCount: 0 };
      continue;
    }
    const free = pool.filter((t) => !overlaps(busy, t.id, start, end));
    result[slot.value] = { available: free.length > 0, reason: free.length ? null : "booked", freeCount: free.length };
  }
  return result;
}
