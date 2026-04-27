import { requireSupabase } from "../supabase/client";
import type { LeaderboardRow, PracticeRecordRow } from "../supabase/types";
import { unwrap } from "./_supabaseError";

export type CreateRecordInput = {
  userId: string;
  setId?: string | null;
  accuracy: number;
  totalTimeSec: number;
  errors: number;
  completedRows: number;
  totalRows: number;
};

export async function createRecord(input: CreateRecordInput): Promise<PracticeRecordRow> {
  const supabase = requireSupabase();
  const result = await supabase
    .from("practice_records")
    .insert({
      user_id: input.userId,
      set_id: input.setId ?? null,
      accuracy: input.accuracy,
      total_time_sec: input.totalTimeSec,
      errors: input.errors,
      completed_rows: input.completedRows,
      total_rows: input.totalRows,
    })
    .select("*")
    .single();
  return unwrap(result);
}

export async function listMyRecentRecords(
  userId: string,
  limit = 5
): Promise<PracticeRecordRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from("practice_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrap(result);
}

export async function getLeaderboardForSet(
  setId: string,
  limit = 20
): Promise<LeaderboardRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from("leaderboard")
    .select("*")
    .eq("set_id", setId)
    .order("best_accuracy", { ascending: false, nullsFirst: false })
    .order("best_time_perfect_sec", { ascending: true, nullsFirst: false })
    .limit(limit);
  return unwrap(result);
}

export async function deleteRecord(recordId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("practice_records").delete().eq("id", recordId);
  if (error) throw new Error(`[Supabase] ${error.message}`);
}
