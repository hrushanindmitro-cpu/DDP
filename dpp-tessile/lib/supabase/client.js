import { createBrowserClient } from "@supabase/ssr";

// Browser client with the public anon key. Used only to send a file to a signed upload URL
// that the server created after checking rights, plan and file type.
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
