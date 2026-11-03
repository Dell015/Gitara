import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when the two env values are filled in (see .env.example). */
export const isSupabaseConfigured = Boolean(url && key);

/** null when Supabase isn't configured: the app still runs, local-only. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true, // keeps the guest account across reloads
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
