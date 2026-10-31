import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

// Uses only the public anon key. Access control is enforced by Row Level Security in the database.
export function createClient() {
  const store = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(list) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      }
    }
  });
}
