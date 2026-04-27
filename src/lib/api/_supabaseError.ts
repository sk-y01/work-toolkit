import type { PostgrestError } from "@supabase/supabase-js";

export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) {
    throw new Error(`[Supabase] ${result.error.message}`);
  }
  if (result.data === null || result.data === undefined) {
    throw new Error("[Supabase] 데이터가 비어 있습니다.");
  }
  return result.data;
}

export function unwrapMaybe<T>(result: {
  data: T | null;
  error: PostgrestError | null;
}): T | null {
  if (result.error) {
    throw new Error(`[Supabase] ${result.error.message}`);
  }
  return result.data;
}
