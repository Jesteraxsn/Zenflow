// Route access rules, shared by src/proxy.js (server) and the login page (client).

export const ROLE_HOME = {
  customer: "/dashboard",
  receptionist: "/receptionist",
  admin: "/admin",
};

// Which roles may open which path prefixes. Anything not listed is public.
export const PROTECTED = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/receptionist", roles: ["receptionist", "admin"] },
  { prefix: "/dashboard", roles: ["customer"] },
  { prefix: "/checkout", roles: ["customer", "receptionist", "admin"] },
  { prefix: "/booking-status", roles: ["customer", "receptionist", "admin"] },
];

export function rulesFor(pathname) {
  return PROTECTED.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
}

export function canAccess(role, pathname) {
  const rule = rulesFor(pathname);
  return !rule || rule.roles.includes(role);
}

// Only allow same-site relative redirects that the role may open.
export function safeNext(next, role) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return canAccess(role, next.split("?")[0]) ? next : null;
}
