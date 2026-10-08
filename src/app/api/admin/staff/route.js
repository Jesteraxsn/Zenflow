import { serviceClient, sessionClient } from "@/lib/supabase-server";
import { STAFF_ROLES } from "@/lib/session";

const fail = (status, error) => Response.json({ error }, { status });

// PATCH { id, email?, password? } — an admin changes a staff account's login email and/or password.
// Only admin and receptionist accounts can be changed here, never customers.
export async function PATCH(request) {
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "Please sign in again.");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return fail(403, "Only admins can change staff logins.");

  const admin = serviceClient();
  if (!admin) return fail(500, "Server is missing SUPABASE_SERVICE_ROLE_KEY in .env.local.");

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!id) return fail(400, "No account selected.");
  if (!email && !password) return fail(400, "Nothing to change.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "Enter a valid email address.");
  if (password && password.length < 6) return fail(400, "Password must be at least 6 characters.");

  const { data: target } = await admin.from("profiles").select("id, full_name, email, role").eq("id", id).maybeSingle();
  if (!target || !STAFF_ROLES.includes(target.role)) return fail(400, "Only admin and front desk accounts can be changed here.");

  const changes = {};
  if (email && email !== target.email) changes.email = email;
  if (password) changes.password = password;
  if (!Object.keys(changes).length) return fail(400, "Nothing to change.");
  if (changes.email) changes.email_confirm = true; // staff emails are set by the admin, no confirmation mail

  const { error } = await admin.auth.admin.updateUserById(id, changes);
  if (error) return fail(400, error.message);
  if (changes.email) await admin.from("profiles").update({ email: changes.email }).eq("id", id);

  const what = [changes.email && `email to ${changes.email}`, changes.password && "password"].filter(Boolean).join(" and ");
  await supabase.rpc("log_activity", { p_type: "security", p_action: `Changed ${target.full_name || target.email}'s ${what}` });

  return Response.json({ ok: true, email: changes.email ?? target.email });
}
