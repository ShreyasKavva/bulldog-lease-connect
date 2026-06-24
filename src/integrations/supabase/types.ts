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
      campuses: {
        Row: {
          city: string
          created_at: string
          domain: string | null
          id: string
          lat: number
          lng: number
          name: string
          short_name: string
          state: string
        }
        Insert: {
          city: string
          created_at?: string
          domain?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          short_name: string
          state: string
        }
        Update: {
          city?: string
          created_at?: string
          domain?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          short_name?: string
          state?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          listing_id: string | null
          participant_1_id: string
          participant_2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          listing_id?: string | null
          participant_1_id: string
          participant_2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          listing_id?: string | null
          participant_1_id?: string
          participant_2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_analyses: {
        Row: {
          created_at: string
          filename: string
          flags: Json
          id: string
          raw_excerpt: string | null
          risk_score: number | null
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          flags?: Json
          id?: string
          raw_excerpt?: string | null
          risk_score?: number | null
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          flags?: Json
          id?: string
          raw_excerpt?: string | null
          risk_score?: number | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          address: string | null
          amenities: string[] | null
          area: string | null
          available_from: string | null
          available_to: string | null
          baths: number
          beds: number
          campus_id: string
          created_at: string
          description: string
          furnished: boolean
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          parking: boolean
          pet_friendly: boolean
          photos: string[] | null
          price: number
          safe_score: number | null
          semester: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
          utilities_included: boolean
          views: number
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          available_from?: string | null
          available_to?: string | null
          baths?: number
          beds?: number
          campus_id: string
          created_at?: string
          description?: string
          furnished?: boolean
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          parking?: boolean
          pet_friendly?: boolean
          photos?: string[] | null
          price: number
          safe_score?: number | null
          semester?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
          utilities_included?: boolean
          views?: number
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          available_from?: string | null
          available_to?: string | null
          baths?: number
          beds?: number
          campus_id?: string
          created_at?: string
          description?: string
          furnished?: boolean
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          parking?: boolean
          pet_friendly?: boolean
          photos?: string[] | null
          price?: number
          safe_score?: number | null
          semester?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          utilities_included?: boolean
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_posts: {
        Row: {
          area: string | null
          beds_min: number | null
          budget_max: number | null
          campus_id: string | null
          created_at: string
          description: string
          furnished: boolean | null
          id: string
          move_in_date: string | null
          move_out_date: string | null
          pets_ok: boolean | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string | null
          beds_min?: number | null
          budget_max?: number | null
          campus_id?: string | null
          created_at?: string
          description: string
          furnished?: boolean | null
          id?: string
          move_in_date?: string | null
          move_out_date?: string | null
          pets_ok?: boolean | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string | null
          beds_min?: number | null
          budget_max?: number | null
          campus_id?: string | null
          created_at?: string
          description?: string
          furnished?: boolean | null
          id?: string
          move_in_date?: string | null
          move_out_date?: string | null
          pets_ok?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_posts_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_emoji: string | null
          banner_color: string | null
          bio: string | null
          campus_id: string | null
          created_at: string
          email: string
          id: string
          major: string | null
          name: string
          phone: string | null
          updated_at: string
          verified_email: boolean
          vibe_tags: string[] | null
          year: string | null
        }
        Insert: {
          avatar_emoji?: string | null
          banner_color?: string | null
          bio?: string | null
          campus_id?: string | null
          created_at?: string
          email: string
          id: string
          major?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          verified_email?: boolean
          vibe_tags?: string[] | null
          year?: string | null
        }
        Update: {
          avatar_emoji?: string | null
          banner_color?: string | null
          bio?: string | null
          campus_id?: string | null
          created_at?: string
          email?: string
          id?: string
          major?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          verified_email?: boolean
          vibe_tags?: string[] | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_listing_safe_score: {
        Args: { _listing_id: string }
        Returns: number
      }
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
