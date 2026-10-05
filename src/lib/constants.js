// Bookable start times (90 minutes apart so the longest treatment fits).
export const TIME_SLOTS = [
  { value: "10:00", label: "10:00 AM" },
  { value: "11:30", label: "11:30 AM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:30", label: "2:30 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:30", label: "5:30 PM" },
  { value: "19:00", label: "7:00 PM" },
];

export const SERVICE_CATEGORIES = ["Signature Ritual", "Massage Therapy", "Facial Care", "Body Care"];

export const THERAPIST_STATUSES = ["On duty", "On break", "Off today"];

// Booking statuses that occupy a therapist's time.
export const LIVE_STATUSES = ["pending_payment", "pending_verification", "confirmed", "completed"];
// Statuses that count as earned revenue.
export const EARNING_STATUSES = ["confirmed", "completed"];

export const HOLD_MINUTES = 30;

// Seeded by supabase/schema.sql — for the live demonstration only.
export const DEMO_PASSWORD = "ginhawa2026";
export const DEMO_ACCOUNTS = [
  { role: "customer", label: "Customer", name: "Patricia Diamante", email: "patricia@ginhawa.demo" },
  { role: "receptionist", label: "Front desk", name: "Jayson Reyes", email: "frontdesk@ginhawa.demo" },
  { role: "admin", label: "Admin", name: "Marlinda Alminaza", email: "admin@ginhawa.demo" },
];

export const PAYMENT_METHODS = {
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  cash: "Cash",
  card: "Card",
};
