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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          payload: Json
          report_date: string
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          payload: Json
          report_date: string
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          payload?: Json
          report_date?: string
        }
        Relationships: []
      }
      document_counter: {
        Row: {
          last_value: number
          type: Database["public"]["Enums"]["doc_type"]
          year: number
        }
        Insert: {
          last_value?: number
          type: Database["public"]["Enums"]["doc_type"]
          year: number
        }
        Update: {
          last_value?: number
          type?: Database["public"]["Enums"]["doc_type"]
          year?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          category_main: string
          category_sub: string
          color: string
          created_at: string
          created_by: string
          description: string | null
          document_date: string
          file_name: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          order_number: string | null
          outgoing_folder: Database["public"]["Enums"]["outgoing_folder"] | null
          recipient: string | null
          reference_code: string
          search_vector: unknown
          sender: string | null
          status: Database["public"]["Enums"]["doc_status"]
          title: string
          type: Database["public"]["Enums"]["doc_type"]
          updated_at: string
        }
        Insert: {
          category_main: string
          category_sub: string
          color: string
          created_at?: string
          created_by: string
          description?: string | null
          document_date?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          order_number?: string | null
          outgoing_folder?:
            | Database["public"]["Enums"]["outgoing_folder"]
            | null
          recipient?: string | null
          reference_code: string
          search_vector?: unknown
          sender?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          title: string
          type: Database["public"]["Enums"]["doc_type"]
          updated_at?: string
        }
        Update: {
          category_main?: string
          category_sub?: string
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          document_date?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          order_number?: string | null
          outgoing_folder?:
            | Database["public"]["Enums"]["outgoing_folder"]
            | null
          recipient?: string | null
          reference_code?: string
          search_vector?: unknown
          sender?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          title?: string
          type?: Database["public"]["Enums"]["doc_type"]
          updated_at?: string
        }
        Relationships: []
      }
      legal_annotations: {
        Row: {
          content: string
          created_at: string
          id: string
          legal_text_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          legal_text_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          legal_text_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_annotations_legal_text_id_fkey"
            columns: ["legal_text_id"]
            isOneToOne: false
            referencedRelation: "legal_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_favorites: {
        Row: {
          created_at: string
          id: string
          legal_text_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          legal_text_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          legal_text_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_favorites_legal_text_id_fkey"
            columns: ["legal_text_id"]
            isOneToOne: false
            referencedRelation: "legal_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_text_references: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          relation: string
          source_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          relation?: string
          source_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          relation?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_text_references_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "legal_texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_text_references_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "legal_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_texts: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          file_name: string | null
          file_path: string | null
          id: string
          publication_date: string | null
          reference: string
          search_vector: unknown
          source_url: string | null
          text_type: string | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          publication_date?: string | null
          reference: string
          search_vector?: unknown
          source_url?: string | null
          text_type?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          publication_date?: string | null
          reference?: string
          search_vector?: unknown
          source_url?: string | null
          text_type?: string | null
          title?: string
        }
        Relationships: []
      }
      other_tasks: {
        Row: {
          created_at: string
          created_by: string
          detail: string
          id: string
          observation: string | null
          position: number
          task_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          detail: string
          id?: string
          observation?: string | null
          position?: number
          task_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          detail?: string
          id?: string
          observation?: string | null
          position?: number
          task_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_documents: {
        Row: {
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          created_by: string
          description: string | null
          file_name: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          read_at: string | null
          read_by: string | null
          read_by_director: boolean
          report_date: string
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["report_category"]
          created_at?: string
          created_by: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          read_at?: string | null
          read_by?: string | null
          read_by_director?: boolean
          report_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["report_category"]
          created_at?: string
          created_by?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          read_at?: string | null
          read_by?: string | null
          read_by_director?: boolean
          report_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_reference_code: {
        Args: {
          _category_sub: string
          _type: Database["public"]["Enums"]["doc_type"]
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_director: { Args: { _user_id: string }; Returns: boolean }
      is_secretary: { Args: { _user_id: string }; Returns: boolean }
      snapshot_daily_report: { Args: { _date?: string }; Returns: string }
    }
    Enums: {
      app_role: "secretary" | "director"
      doc_status: "pending" | "processed" | "archived"
      doc_type: "incoming" | "outgoing"
      outgoing_folder: "technical" | "administration"
      report_category: "mission" | "technical" | "financial" | "administrative"
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
    Enums: {
      app_role: ["secretary", "director"],
      doc_status: ["pending", "processed", "archived"],
      doc_type: ["incoming", "outgoing"],
      outgoing_folder: ["technical", "administration"],
      report_category: ["mission", "technical", "financial", "administrative"],
    },
  },
} as const
