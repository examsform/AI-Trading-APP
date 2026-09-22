import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      supabaseInstance = createClient(url, key);
      return supabaseInstance;
    } catch {
      return null;
    }
  }

  return null;
}

export async function saveRecordLocallyOrRemote<T>(
  key: string,
  record: T,
  tableName?: string
): Promise<{ success: boolean; storage: "supabase" | "local" }> {
  const client = getSupabaseClient();

  if (client && tableName) {
    try {
      const { error } = await client.from(tableName).insert(record as Record<string, unknown>);
      if (!error) return { success: true, storage: "supabase" };
    } catch {
      // Fall through to localStorage bridge
    }
  }

  if (typeof window !== "undefined") {
    try {
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = Array.isArray(existing) ? [record, ...existing] : [record];
      localStorage.setItem(key, JSON.stringify(updated));
      return { success: true, storage: "local" };
    } catch {
      return { success: false, storage: "local" };
    }
  }

  return { success: false, storage: "local" };
}
