export type Difficulty = "easy" | "normal" | "hard";
export type SetSource = "builtin" | "upload" | "generated";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          team: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          team?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
          team?: string | null;
        };
        Relationships: [];
      };
      practice_sets: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          difficulty: Difficulty;
          category: string | null;
          is_public: boolean;
          source: SetSource;
          row_count: number;
          col_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description?: string | null;
          difficulty?: Difficulty;
          category?: string | null;
          is_public?: boolean;
          source?: SetSource;
          row_count: number;
          col_count: number;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          difficulty?: Difficulty;
          category?: string | null;
          is_public?: boolean;
        };
        Relationships: [];
      };
      practice_set_rows: {
        Row: {
          set_id: string;
          row_index: number;
          cells: string[];
        };
        Insert: {
          set_id: string;
          row_index: number;
          cells: string[];
        };
        Update: {
          cells?: string[];
        };
        Relationships: [];
      };
      practice_records: {
        Row: {
          id: string;
          user_id: string;
          set_id: string | null;
          accuracy: number;
          total_time_sec: number;
          errors: number;
          completed_rows: number;
          total_rows: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          set_id?: string | null;
          accuracy: number;
          total_time_sec: number;
          errors: number;
          completed_rows: number;
          total_rows: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          set_id: string | null;
          user_id: string | null;
          display_name: string | null;
          best_accuracy: number | null;
          best_time_perfect_sec: number | null;
          attempts: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type PracticeSet = Database["public"]["Tables"]["practice_sets"]["Row"];
export type PracticeSetRow = Database["public"]["Tables"]["practice_set_rows"]["Row"];
export type PracticeRecordRow = Database["public"]["Tables"]["practice_records"]["Row"];
export type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];

export type PracticeSetInsert = Database["public"]["Tables"]["practice_sets"]["Insert"];
export type PracticeSetRowInsert = Database["public"]["Tables"]["practice_set_rows"]["Insert"];
export type PracticeRecordInsert = Database["public"]["Tables"]["practice_records"]["Insert"];
