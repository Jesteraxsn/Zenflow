"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME } from "@/lib/session";

// Goes to the signed-in user's portal, or to login when signed out.
export default function AccountLink({ className, signedOutLabel = "Log in", signedInLabel = "My Account" }) {
  const { role } = useAuth();
  return (
    <Link href={role ? ROLE_HOME[role] : "/login"} className={className}>
      {role ? signedInLabel : signedOutLabel}
    </Link>
  );
}
