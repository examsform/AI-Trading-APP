import { createBrowserClient } from "@supabase/ssr";

// Public anon key only — safe for the browser. Never put the service-role key here.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
