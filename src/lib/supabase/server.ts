import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// For server-side reads/writes under RLS as the logged-in user.
// The service-role key (if ever needed for admin tasks) must only be used
// in trusted server contexts and must never be sent to the browser.
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}
