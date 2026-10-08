// Every read/write the app makes to Supabase lives here.
import { supabase } from "./supabase";
import { slugify, startsAtISO } from "./format";
import { priceBreakdown } from "./pricing";

function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const BOOKING_FIELDS =
  "*, service:services(id, name, category), therapist:therapists(id, full_name), payments(id, method, amount, reference, proof_path, status, created_at)";

// ---------- auth ----------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const profile = ok(await supabase.from("profiles").select("*").eq("id", data.user.id).single());
  return profile;
}

export async function signUp({ fullName, email, phone, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });
  if (error) throw new Error(error.message);
  // Demo build auto-confirms accounts, so sign in straight away if no session came back.
  if (!data.session) await signIn(email, password);
}

// ---------- catalog ----------
export async function getServices({ includeInactive = false } = {}) {
  let q = supabase.from("services").select("*").order("price", { ascending: false });
  if (!includeInactive) q = q.eq("active", true);
  return ok(await q);
}

export async function getTherapists() {
  return ok(await supabase.from("therapists").select("*").eq("active", true).order("full_name"));
}

export async function getSettings() {
  const rows = ok(await supabase.from("settings").select("key, value"));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ---------- availability & booking ----------
export async function getBusySlots(dateKey) {
  return ok(await supabase.rpc("get_busy_slots", { p_day: dateKey }));
}

export async function createBooking({ serviceId, date, time, duration, therapistId, clientName, clientPhone, walkIn, paymentMethod }) {
  return ok(
    await supabase
      .rpc("create_booking", {
        p_service: serviceId,
        p_starts_at: startsAtISO(date, time),
        p_duration: duration,
        p_therapist: therapistId || null,
        p_client_name: clientName || null,
        p_client_phone: clientPhone || null,
        p_walk_in: Boolean(walkIn),
        p_payment_method: paymentMethod || "cash",
      })
      .single(),
  );
}

export async function getBooking(id) {
  return ok(await supabase.from("bookings").select(BOOKING_FIELDS).eq("id", id).maybeSingle());
}

export async function getMyBookings(userId) {
  return ok(
    await supabase.from("bookings").select(BOOKING_FIELDS).eq("customer_id", userId).order("starts_at", { ascending: false }),
  );
}

export async function uploadProof(userId, bookingId, file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/${bookingId}-${Date.now()}.${ext}`;
  ok(await supabase.storage.from("payment-proofs").upload(path, file, { upsert: true }));
  return path;
}

export async function submitPayment(bookingId, reference, proofPath, method = "bank_transfer") {
  return ok(
    await supabase.rpc("submit_payment", {
      p_booking: bookingId,
      p_reference: reference,
      p_proof_path: proofPath,
      p_method: method,
    }),
  );
}

export async function cancelBooking(id) {
  ok(await supabase.rpc("cancel_booking", { p_booking: id }));
}

// ---------- staff ----------
export async function getBookings({ from, to, limit = 300 } = {}) {
  let q = supabase.from("bookings").select(BOOKING_FIELDS).order("starts_at", { ascending: false }).limit(limit);
  if (from) q = q.gte("starts_at", from);
  if (to) q = q.lt("starts_at", to);
  return ok(await q);
}

export async function verifyPayment(paymentId, approve = true) {
  ok(await supabase.rpc("verify_payment", { p_payment: paymentId, p_approve: approve }));
}

export async function setBookingStatus(booking, status) {
  ok(await supabase.from("bookings").update({ status }).eq("id", booking.id));
  const labels = { completed: "Marked completed", no_show: "Marked no-show", confirmed: "Confirmed" };
  await logActivity("booking", `${labels[status] ?? `Set ${status}`}: ${booking.code} (${booking.client_name})`, null, booking.id);
}

export async function deleteBooking(booking) {
  await logActivity("cancellation", `Deleted booking ${booking.code} (${booking.client_name})`, null);
  ok(await supabase.from("bookings").delete().eq("id", booking.id));
}

export async function proofUrl(path) {
  const data = ok(await supabase.storage.from("payment-proofs").createSignedUrl(path, 600));
  return data.signedUrl;
}

export async function logActivity(type, action, amount = null, bookingId = null) {
  // Logging should never block the action it describes.
  await supabase.rpc("log_activity", { p_type: type, p_action: action, p_amount: amount, p_booking: bookingId });
}

export async function getLogs(limit = 200) {
  return ok(await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(limit));
}

export async function getClients() {
  const [profiles, bookings] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "customer").order("full_name").then(ok),
    supabase.from("bookings").select("customer_id, price, status, starts_at").not("customer_id", "is", null).then(ok),
  ]);
  return profiles.map((p) => {
    const mine = bookings.filter((b) => b.customer_id === p.id);
    const paid = mine.filter((b) => b.status === "confirmed" || b.status === "completed");
    return {
      ...p,
      visits: mine.filter((b) => b.status === "completed").length,
      spent: paid.reduce((s, b) => s + Number(b.price), 0),
      last: mine.map((b) => b.starts_at).sort().at(-1) ?? null,
    };
  });
}

export async function countNewClients(sinceISO) {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "customer")
    .gte("created_at", sinceISO);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------- admin ----------
export async function saveService(service) {
  const record = {
    name: service.name.trim(),
    category: service.category,
    description: service.description,
    durations: service.durations,
    prices: service.prices,
    price: Number(service.price),
    active: service.active,
  };
  if (service.id) {
    const saved = ok(await supabase.from("services").update(record).eq("id", service.id).select().single());
    await logActivity("pricing", `Updated service: ${saved.name}`);
    return saved;
  }
  const saved = ok(
    await supabase.from("services").insert({ ...record, slug: `${slugify(record.name)}-${Date.now().toString(36)}` }).select().single(),
  );
  await logActivity("pricing", `Added service: ${saved.name} (${priceBreakdown(saved)})`);
  return saved;
}

// `pricing` is { durations, prices, price } from toServicePricing().
export async function updateServicePrice(service, pricing) {
  ok(await supabase.from("services").update({ prices: pricing.prices, price: pricing.price }).eq("id", service.id));
  await logActivity("pricing", `Updated price: ${service.name} ${priceBreakdown(service)} → ${priceBreakdown({ ...service, ...pricing })}`);
}

export async function saveSetting(key, value) {
  ok(await supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }));
}

export async function saveTherapist(therapist) {
  const record = {
    full_name: therapist.full_name.trim(),
    title: therapist.title,
    specialties: therapist.specialties,
    work_days: therapist.work_days,
    shift_start: therapist.shift_start,
    shift_end: therapist.shift_end,
    commission_rate: Number(therapist.commission_rate),
    status: therapist.status,
  };
  if (therapist.id) {
    const saved = ok(await supabase.from("therapists").update(record).eq("id", therapist.id).select().single());
    await logActivity("schedule", `Updated therapist profile: ${saved.full_name}`);
    return saved;
  }
  const saved = ok(await supabase.from("therapists").insert(record).select().single());
  await logActivity("schedule", `Added therapist: ${saved.full_name}`);
  return saved;
}

export async function setTherapistStatus(therapist, status) {
  ok(await supabase.from("therapists").update({ status }).eq("id", therapist.id));
  await logActivity("schedule", `Set ${therapist.full_name} to ${status}`);
}

export async function removeTherapist(therapist) {
  // Soft delete keeps past bookings and earnings intact.
  ok(await supabase.from("therapists").update({ active: false }).eq("id", therapist.id));
  await logActivity("schedule", `Removed therapist: ${therapist.full_name}`);
}
