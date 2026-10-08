// All dates are shown in the spa's timezone, whatever the viewer's device says.
export const TZ = "Asia/Manila";

export function peso(amount) {
  const n = Number(amount) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}₱${Math.abs(n).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

// "YYYY-MM-DD" for a Date or timestamp, in Manila time.
export function dateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(value));
}

export function todayKey() {
  return dateKey(new Date());
}

export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Timestamp for a Manila wall-clock date + "HH:MM".
export function startsAtISO(key, hhmm) {
  return `${key}T${hhmm}:00+08:00`;
}

// Manila wall-clock "HH:MM" for a moment (default: now).
export function hhmmOf(ts = Date.now()) {
  return new Date(ts).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

export function timeOf(ts) {
  return new Date(ts).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

export function longDate(value) {
  const d = typeof value === "string" && value.length === 10 ? new Date(`${value}T12:00:00+08:00`) : new Date(value);
  return d.toLocaleDateString("en-PH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function shortDate(value) {
  const d = typeof value === "string" && value.length === 10 ? new Date(`${value}T12:00:00+08:00`) : new Date(value);
  return d.toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric" });
}

export function weekday(key) {
  return new Date(`${key}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short" });
}

export function relativeTime(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "yesterday";
  return shortDate(ts);
}

export function greeting(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(date));
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "there";
}

export function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// "YYYY-MM-DD" from a local Date object (used by the calendar grid).
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
