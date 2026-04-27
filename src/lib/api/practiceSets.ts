import { requireSupabase } from "../supabase/client";
import type {
  Difficulty,
  PracticeSet,
  PracticeSetRow,
  SetSource,
} from "../supabase/types";
import { unwrap } from "./_supabaseError";

export type PracticeSetWithRows = PracticeSet & {
  rows: PracticeSetRow[];
};

export type CreateSetInput = {
  ownerId: string;
  title: string;
  description?: string | null;
  difficulty?: Difficulty;
  category?: string | null;
  isPublic?: boolean;
  source?: SetSource;
  colCount: number;
  rows: string[][];
};

export async function listMySets(): Promise<PracticeSet[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from("practice_sets")
    .select("*")
    .order("created_at", { ascending: false });
  return unwrap(result);
}

export async function listPublicSets(): Promise<PracticeSet[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from("practice_sets")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  return unwrap(result);
}

export async function getSetWithRows(setId: string): Promise<PracticeSetWithRows> {
  const supabase = requireSupabase();

  const setResult = await supabase
    .from("practice_sets")
    .select("*")
    .eq("id", setId)
    .single();
  const set = unwrap(setResult);

  const rowsResult = await supabase
    .from("practice_set_rows")
    .select("*")
    .eq("set_id", setId)
    .order("row_index", { ascending: true });
  const rows = unwrap(rowsResult);

  return { ...set, rows };
}

export async function createSet(input: CreateSetInput): Promise<PracticeSetWithRows> {
  const supabase = requireSupabase();

  if (input.rows.length === 0) {
    throw new Error("세트에는 최소 1행 이상의 데이터가 필요합니다.");
  }
  for (const row of input.rows) {
    if (row.length !== input.colCount) {
      throw new Error(
        `행의 셀 개수(${row.length})가 colCount(${input.colCount}) 와 일치하지 않습니다.`
      );
    }
  }

  const setResult = await supabase
    .from("practice_sets")
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      description: input.description ?? null,
      difficulty: input.difficulty ?? "normal",
      category: input.category ?? null,
      is_public: input.isPublic ?? false,
      source: input.source ?? "builtin",
      row_count: input.rows.length,
      col_count: input.colCount,
    })
    .select("*")
    .single();
  const created = unwrap(setResult);

  const rowsPayload = input.rows.map((cells, idx) => ({
    set_id: created.id,
    row_index: idx,
    cells,
  }));

  const rowsResult = await supabase
    .from("practice_set_rows")
    .insert(rowsPayload)
    .select("*")
    .order("row_index", { ascending: true });

  if (rowsResult.error) {
    await supabase.from("practice_sets").delete().eq("id", created.id);
    throw new Error(`[Supabase] ${rowsResult.error.message}`);
  }

  return { ...created, rows: rowsResult.data ?? [] };
}

export async function deleteSet(setId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("practice_sets").delete().eq("id", setId);
  if (error) throw new Error(`[Supabase] ${error.message}`);
}

export type UpdateSetPatch = {
  title?: string;
  description?: string | null;
  difficulty?: Difficulty;
  category?: string | null;
  isPublic?: boolean;
};

export async function updateSet(setId: string, patch: UpdateSetPatch): Promise<PracticeSet> {
  const supabase = requireSupabase();
  const result = await supabase
    .from("practice_sets")
    .update({
      title: patch.title,
      description: patch.description,
      difficulty: patch.difficulty,
      category: patch.category,
      is_public: patch.isPublic,
    })
    .eq("id", setId)
    .select("*")
    .single();
  return unwrap(result);
}
