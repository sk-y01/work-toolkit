import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient<Database> | null = isConfigured
  ? createClient<Database>(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function isSupabaseConfigured(): boolean {
  return isConfigured;
}

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      "[Supabase] 환경변수(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다. " +
        ".env.local 파일을 확인하세요."
    );
  }
  return supabase;
}
