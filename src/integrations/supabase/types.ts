export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      match_runs: {
        Row: {
          config_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          matched: number
          message: string | null
          processed: number
          run_type: string
          started_at: string
          status: string
          total: number | null
          unmatched: Json | null
        }
        Insert: {
          config_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          matched?: number
          message?: string | null
          processed?: number
          run_type: string
          started_at?: string
          status?: string
          total?: number | null
          unmatched?: Json | null
        }
        Update: {
          config_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          matched?: number
          message?: string | null
          processed?: number
          run_type?: string
          started_at?: string
          status?: string
          total?: number | null
          unmatched?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "match_runs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "sheet_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_aliases: {
        Row: {
          alias: string
          canonical_name: string | null
          created_at: string
          id: string
          record_id: string | null
        }
        Insert: {
          alias: string
          canonical_name?: string | null
          created_at?: string
          id?: string
          record_id?: string | null
        }
        Update: {
          alias?: string
          canonical_name?: string | null
          created_at?: string
          id?: string
          record_id?: string | null
        }
        Relationships: []
      }
      org_match_cache: {
        Row: {
          canonical_name: string | null
          confidence: number | null
          created_at: string
          id: string
          input_normalized: string
          input_original: string
          method: string
          record_id: string
        }
        Insert: {
          canonical_name?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          input_normalized: string
          input_original: string
          method: string
          record_id: string
        }
        Update: {
          canonical_name?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          input_normalized?: string
          input_original?: string
          method?: string
          record_id?: string
        }
        Relationships: []
      }
      sheet_configs: {
        Row: {
          contacts_spreadsheet_url: string
          contacts_tab: string
          created_at: string
          event_spreadsheet_url: string
          event_tab: string
          id: string
          name: string
          org_spreadsheet_url: string
          org_tab: string
          row_limit: number | null
          updated_at: string
        }
        Insert: {
          contacts_spreadsheet_url: string
          contacts_tab: string
          created_at?: string
          event_spreadsheet_url: string
          event_tab: string
          id?: string
          name: string
          org_spreadsheet_url: string
          org_tab: string
          row_limit?: number | null
          updated_at?: string
        }
        Update: {
          contacts_spreadsheet_url?: string
          contacts_tab?: string
          created_at?: string
          event_spreadsheet_url?: string
          event_tab?: string
          id?: string
          name?: string
          org_spreadsheet_url?: string
          org_tab?: string
          row_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
