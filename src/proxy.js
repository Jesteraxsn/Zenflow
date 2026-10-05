import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ROLE_HOME, rulesFor } from "@/lib/session";

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });

  // Supabase session from cookies (and refresh it if needed).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = data?.role ?? null;
  }

  const redirect = (path) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // Signed-in users don't need the login/register screens.
  if (role && (pathname === "/login" || pathname === "/register")) {
    return redirect(ROLE_HOME[role]);
  }

  const rule = rulesFor(pathname);
  if (!rule) return response;

  // Not signed in → login, then come back here.
  if (!role) return redirect(`/login?next=${encodeURIComponent(pathname + search)}`);

  // Signed in with the wrong role → their own portal.
  if (!rule.roles.includes(role)) return redirect(ROLE_HOME[role]);

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/receptionist/:path*",
    "/dashboard/:path*",
    "/checkout/:path*",
    "/booking-status/:path*",
    "/login",
    "/register",
  ],
};
