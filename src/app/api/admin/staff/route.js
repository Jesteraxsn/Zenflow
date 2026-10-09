import { serviceClient, sessionClient } from "@/lib/supabase-server";
import { STAFF_ROLES } from "@/lib/session";

// Staff account management. Every method checks the caller is an admin, then uses
// Supabase's admin API (service role key), which never leaves the server.

const fail = (status, error) => Response.json({ error }, { status });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireAdmin() {
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: fail(401, "Please sign in again.") };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return { error: fail(403, "Only admins can manage staff accounts.") };
  const admin = serviceClient();
  if (!admin) return { error: fail(500, "Server is missing SUPABASE_SERVICE_ROLE_KEY in .env.local.") };
  const log = (action) => supabase.rpc("log_activity", { p_type: "security", p_action: action });
  return { user, admin, log };
}

const readBody = (request) => request.json().catch(() => ({}));
const str = (v) => (typeof v === "string" ? v.trim() : "");

// POST { fullName, email, phone?, password } — create a front desk (receptionist) account.
export async function POST(request) {
  const { error, admin, log } = await requireAdmin();
  if (error) return error;

  const body = await readBody(request);
  const fullName = str(body.fullName);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const password = typeof body.password === "string" ? body.password : "";
  if (!fullName) return fail(400, "Enter the receptionist's name.");
  if (!EMAIL.test(email)) return fail(400, "Enter a valid email address.");
  if (password.length < 6) return fail(400, "Password must be at least 6 characters.");

  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: phone || null },
  });
  if (createError) {
    const taken = /already|registered|exists/i.test(createError.message);
    return fail(400, taken ? "That email already has an account." : createError.message);
  }

  // The sign-up trigger makes every new account a customer; promote this one.
  const { error: roleError } = await admin.from("profiles").update({ role: "receptionist", full_name: fullName, phone: phone || null }).eq("id", data.user.id);
  if (roleError) {
    await admin.auth.admin.deleteUser(data.user.id); // don't leave a half-made account behind
    return fail(500, roleError.message);
  }

  await log(`Added front desk account: ${fullName} (${email})`);
  return Response.json({ ok: true, id: data.user.id });
}

// PATCH { id, email?, password? } — change a staff account's login email and/or password.
export async function PATCH(request) {
  const { error, admin, log } = await requireAdmin();
  if (error) return error;

  const body = await readBody(request);
  const id = str(body.id);
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!id) return fail(400, "No account selected.");
  if (!email && !password) return fail(400, "Nothing to change.");
  if (email && !EMAIL.test(email)) return fail(400, "Enter a valid email address.");
  if (password && password.length < 6) return fail(400, "Password must be at least 6 characters.");

  const { data: target } = await admin.from("profiles").select("id, full_name, email, role").eq("id", id).maybeSingle();
  if (!target || !STAFF_ROLES.includes(target.role)) return fail(400, "Only admin and front desk accounts can be changed here.");

  const changes = {};
  if (email && email !== target.email) changes.email = email;
  if (password) changes.password = password;
  if (!Object.keys(changes).length) return fail(400, "Nothing to change.");
  if (changes.email) changes.email_confirm = true; // staff emails are set by the admin, no confirmation mail

  const { error: updateError } = await admin.auth.admin.updateUserById(id, changes);
  if (updateError) return fail(400, updateError.message);
  if (changes.email) await admin.from("profiles").update({ email: changes.email }).eq("id", id);

  const what = [changes.email && `email to ${changes.email}`, changes.password && "password"].filter(Boolean).join(" and ");
  await log(`Changed ${target.full_name || target.email}'s ${what}`);
  return Response.json({ ok: true, email: changes.email ?? target.email });
}

// DELETE { id } — remove a front desk account entirely. Past bookings and logs keep their history.
export async function DELETE(request) {
  const { error, user, admin, log } = await requireAdmin();
  if (error) return error;

  const id = str((await readBody(request)).id);
  if (!id) return fail(400, "No account selected.");
  if (id === user.id) return fail(400, "You can't remove your own account.");

  const { data: target } = await admin.from("profiles").select("id, full_name, email, role").eq("id", id).maybeSingle();
  if (!target || target.role !== "receptionist") return fail(400, "Only front desk accounts can be removed here.");

  const { error: deleteError } = await admin.auth.admin.deleteUser(id);
  if (deleteError) return fail(400, deleteError.message);

  await log(`Removed front desk account: ${target.full_name || target.email} (${target.email})`);
  return Response.json({ ok: true });
}
