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
          slug: string
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
          slug: string
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
          slug?: string
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
      listing_reactions: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          listing_id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          flagged: boolean
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
          view_count: number
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
          flagged?: boolean
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
          view_count?: number
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
          flagged?: boolean
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
          view_count?: number
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_emoji: string | null
          banned: boolean
          banner_color: string | null
          bio: string | null
          campus_id: string | null
          created_at: string
          currently_emoji: string | null
          currently_status: string | null
          currently_updated_at: string | null
          email: string
          id: string
          is_admin: boolean
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
          banned?: boolean
          banner_color?: string | null
          bio?: string | null
          campus_id?: string | null
          created_at?: string
          currently_emoji?: string | null
          currently_status?: string | null
          currently_updated_at?: string | null
          email: string
          id: string
          is_admin?: boolean
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
          banned?: boolean
          banner_color?: string | null
          bio?: string | null
          campus_id?: string | null
          created_at?: string
          currently_emoji?: string | null
          currently_status?: string | null
          currently_updated_at?: string | null
          email?: string
          id?: string
          is_admin?: boolean
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
      saved_searches: {
        Row: {
          area: string | null
          campus_id: string | null
          created_at: string
          furnished_only: boolean
          id: string
          keyword: string | null
          last_notified_at: string | null
          max_price: number | null
          min_beds: number | null
          name: string
          notify: boolean
          pet_friendly_only: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string | null
          campus_id?: string | null
          created_at?: string
          furnished_only?: boolean
          id?: string
          keyword?: string | null
          last_notified_at?: string | null
          max_price?: number | null
          min_beds?: number | null
          name: string
          notify?: boolean
          pet_friendly_only?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string | null
          campus_id?: string | null
          created_at?: string
          furnished_only?: boolean
          id?: string
          keyword?: string | null
          last_notified_at?: string | null
          max_price?: number | null
          min_beds?: number | null
          name?: string
          notify?: boolean
          pet_friendly_only?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      increment_listing_view: { Args: { _listing_id: string }; Returns: number }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
