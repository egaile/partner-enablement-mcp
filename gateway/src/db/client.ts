import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadConfig } from "../config.js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const config = loadConfig();
  _client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  return _client;
}
