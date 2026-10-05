import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Sessions live in cookies so src/proxy.js can read them.
// Keys come from .env.local (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
