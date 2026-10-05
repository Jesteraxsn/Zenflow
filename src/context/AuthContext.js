"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

async function loadProfile(user) {
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, profile: null, loading: true });

  const sync = useCallback(async (user) => {
    const profile = await loadProfile(user);
    setState({ user, profile, loading: false });
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => sync(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Defer: Supabase calls inside this callback can deadlock the auth client.
        setTimeout(() => sync(session?.user ?? null), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [sync]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, profile: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, role: state.profile?.role ?? null, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
