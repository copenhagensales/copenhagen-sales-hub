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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          application_date: string
          candidate_id: string
          cover_letter_url: string | null
          created_at: string
          cv_url: string | null
          deadline: string | null
          employment_end_reason: string | null
          employment_ended_date: string | null
          hired_date: string | null
          id: string
          next_step: string | null
          notes: string | null
          rejection_details: string | null
          rejection_reason: string | null
          responsible_user_id: string | null
          role: Database["public"]["Enums"]["application_role"]
          source: string | null
          status: Database["public"]["Enums"]["application_status"]
          team_id: string | null
          test_results_url: string | null
          updated_at: string
        }
        Insert: {
          application_date?: string
          candidate_id: string
          cover_letter_url?: string | null
          created_at?: string
          cv_url?: string | null
          deadline?: string | null
          employment_end_reason?: string | null
          employment_ended_date?: string | null
          hired_date?: string | null
          id?: string
          next_step?: string | null
          notes?: string | null
          rejection_details?: string | null
          rejection_reason?: string | null
          responsible_user_id?: string | null
          role: Database["public"]["Enums"]["application_role"]
          source?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          team_id?: string | null
          test_results_url?: string | null
          updated_at?: string
        }
        Update: {
          application_date?: string
          candidate_id?: string
          cover_letter_url?: string | null
          created_at?: string
          cv_url?: string | null
          deadline?: string | null
          employment_end_reason?: string | null
          employment_ended_date?: string | null
          hired_date?: string | null
          id?: string
          next_step?: string | null
          notes?: string | null
          rejection_details?: string | null
          rejection_reason?: string | null
          responsible_user_id?: string | null
          role?: Database["public"]["Enums"]["application_role"]
          source?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          team_id?: string | null
          test_results_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      communication_logs: {
        Row: {
          application_id: string
          content: string | null
          created_at: string
          created_by: string | null
          direction: string
          duration: number | null
          id: string
          outcome: string | null
          read: boolean | null
          type: string
        }
        Insert: {
          application_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          duration?: number | null
          id?: string
          outcome?: string | null
          read?: boolean | null
          type: string
        }
        Update: {
          application_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          duration?: number | null
          id?: string
          outcome?: string | null
          read?: boolean | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          application_id: string
          comments: string | null
          created_at: string
          id: string
          rating: string
          review_date: string
          review_period: number
          reviewed_by: string | null
        }
        Insert: {
          application_id: string
          comments?: string | null
          created_at?: string
          id?: string
          rating: string
          review_date: string
          review_period: number
          reviewed_by?: string | null
        }
        Update: {
          application_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          rating?: string
          review_date?: string
          review_period?: number
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      revenue_data: {
        Row: {
          application_id: string
          created_at: string
          id: string
          period: number | null
          revenue: number | null
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          period?: number | null
          revenue?: number | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          period?: number | null
          revenue?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_data_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      application_role: "fieldmarketing" | "salgskonsulent"
      application_status:
        | "ny"
        | "telefon_screening"
        | "case_rollespil"
        | "interview"
        | "tilbud"
        | "ansat"
        | "afslag"
        | "ghosted_cold"
      user_role: "admin" | "hiring_manager" | "interviewer"
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
      application_role: ["fieldmarketing", "salgskonsulent"],
      application_status: [
        "ny",
        "telefon_screening",
        "case_rollespil",
        "interview",
        "tilbud",
        "ansat",
        "afslag",
        "ghosted_cold",
      ],
      user_role: ["admin", "hiring_manager", "interviewer"],
    },
  },
} as const
