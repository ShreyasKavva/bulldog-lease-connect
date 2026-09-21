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
      ambassador_applications: {
        Row: {
          committed_to_post: boolean
          created_at: string
          email: string
          id: string
          name: string
          reason: string
          school: string
        }
        Insert: {
          committed_to_post?: boolean
          created_at?: string
          email: string
          id?: string
          name: string
          reason: string
          school: string
        }
        Update: {
          committed_to_post?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          reason?: string
          school?: string
        }
        Relationships: []
      }
      boost_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          listing_id: string | null
          paid_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string | null
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string | null
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boost_purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boost_purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boost_purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boost_purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boost_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boost_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boost_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_email_domains: {
        Row: {
          campus_id: string
          created_at: string
          domain: string
          id: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          domain: string
          id?: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          domain?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_email_domains_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_notify_signups: {
        Row: {
          campus_id: string
          created_at: string
          email: string
          id: string
          notified_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campus_id: string
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campus_id?: string
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campus_notify_signups_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          aliases: string | null
          city: string
          created_at: string
          domain: string | null
          id: string
          ipeds_unitid: number | null
          lat: number
          level: number
          lng: number
          name: string
          search_text: string | null
          short_name: string
          slug: string
          state: string
          zip: string | null
        }
        Insert: {
          aliases?: string | null
          city: string
          created_at?: string
          domain?: string | null
          id?: string
          ipeds_unitid?: number | null
          lat: number
          level?: number
          lng: number
          name: string
          search_text?: string | null
          short_name: string
          slug: string
          state: string
          zip?: string | null
        }
        Update: {
          aliases?: string | null
          city?: string
          created_at?: string
          domain?: string | null
          id?: string
          ipeds_unitid?: number | null
          lat?: number
          level?: number
          lng?: number
          name?: string
          search_text?: string | null
          short_name?: string
          slug?: string
          state?: string
          zip?: string | null
        }
        Relationships: []
      }
      closed_deals: {
        Row: {
          campus_id: string | null
          closed_at: string
          found_via_lease_up: boolean
          id: string
          looking_for_post_id: string | null
          user_id: string
        }
        Insert: {
          campus_id?: string | null
          closed_at?: string
          found_via_lease_up?: boolean
          id?: string
          looking_for_post_id?: string | null
          user_id: string
        }
        Update: {
          campus_id?: string | null
          closed_at?: string
          found_via_lease_up?: boolean
          id?: string
          looking_for_post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closed_deals_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closed_deals_looking_for_post_id_fkey"
            columns: ["looking_for_post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closed_deals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closed_deals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closed_deals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          deleted_by_p1: boolean
          deleted_by_p2: boolean
          id: string
          last_message: string | null
          last_message_at: string | null
          listing_id: string | null
          looking_post_id: string | null
          muted_by_p1: boolean
          muted_by_p2: boolean
          participant_1_id: string
          participant_2_id: string
          pinned_by_p1: boolean
          pinned_by_p2: boolean
        }
        Insert: {
          created_at?: string
          deleted_by_p1?: boolean
          deleted_by_p2?: boolean
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          listing_id?: string | null
          looking_post_id?: string | null
          muted_by_p1?: boolean
          muted_by_p2?: boolean
          participant_1_id: string
          participant_2_id: string
          pinned_by_p1?: boolean
          pinned_by_p2?: boolean
        }
        Update: {
          created_at?: string
          deleted_by_p1?: boolean
          deleted_by_p2?: boolean
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          listing_id?: string | null
          looking_post_id?: string | null
          muted_by_p1?: boolean
          muted_by_p2?: boolean
          participant_1_id?: string
          participant_2_id?: string
          pinned_by_p1?: boolean
          pinned_by_p2?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_looking_post_id_fkey"
            columns: ["looking_post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_agreements: {
        Row: {
          agreed_at: string | null
          created_at: string
          deposit_amount_cents: number
          disputed_at: string | null
          id: string
          listing_id: string | null
          move_in_date: string | null
          paid_at: string | null
          platform_fee_cents: number | null
          poster_id: string | null
          refunded_at: string | null
          released_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          subletter_id: string | null
          total_charged_cents: number | null
          updated_at: string
        }
        Insert: {
          agreed_at?: string | null
          created_at?: string
          deposit_amount_cents: number
          disputed_at?: string | null
          id?: string
          listing_id?: string | null
          move_in_date?: string | null
          paid_at?: string | null
          platform_fee_cents?: number | null
          poster_id?: string | null
          refunded_at?: string | null
          released_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          subletter_id?: string | null
          total_charged_cents?: number | null
          updated_at?: string
        }
        Update: {
          agreed_at?: string | null
          created_at?: string
          deposit_amount_cents?: number
          disputed_at?: string | null
          id?: string
          listing_id?: string | null
          move_in_date?: string | null
          paid_at?: string | null
          platform_fee_cents?: number | null
          poster_id?: string | null
          refunded_at?: string | null
          released_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          subletter_id?: string | null
          total_charged_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_subletter_id_fkey"
            columns: ["subletter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_subletter_id_fkey"
            columns: ["subletter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_agreements_subletter_id_fkey"
            columns: ["subletter_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_waitlist: {
        Row: {
          created_at: string
          email: string | null
          id: string
          listing_id: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          listing_id?: string | null
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          listing_id?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_waitlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_waitlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_waitlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_waitlist_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
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
      listing_feedback: {
        Row: {
          additional_comments: string | null
          created_at: string
          how_found_renter: string
          id: string
          is_testimonial: boolean
          listing_id: string | null
          user_id: string | null
        }
        Insert: {
          additional_comments?: string | null
          created_at?: string
          how_found_renter: string
          id?: string
          is_testimonial?: boolean
          listing_id?: string | null
          user_id?: string | null
        }
        Update: {
          additional_comments?: string | null
          created_at?: string
          how_found_renter?: string
          id?: string
          is_testimonial?: boolean
          listing_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_feedback_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_feedback_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_feedback_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_feedback_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reports: {
        Row: {
          auto_flagged: boolean
          auto_score: number
          created_at: string
          details: string | null
          id: string
          listing_id: string
          priority: string
          reason: string
          reporter_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          auto_flagged?: boolean
          auto_score?: number
          created_at?: string
          details?: string | null
          id?: string
          listing_id: string
          priority?: string
          reason: string
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          auto_flagged?: boolean
          auto_score?: number
          created_at?: string
          details?: string | null
          id?: string
          listing_id?: string
          priority?: string
          reason?: string
          reporter_id?: string | null
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
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
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
            foreignKeyName: "listing_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_shares: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          share_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          share_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          share_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_shares_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_shares_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_shares_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_shares_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_stats_daily: {
        Row: {
          created_at: string
          date: string
          id: string
          listing_id: string
          messages: number
          saves: number
          views: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          listing_id: string
          messages?: number
          saves?: number
          views?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          listing_id?: string
          messages?: number
          saves?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_stats_daily_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_stats_daily_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_stats_daily_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_stats_daily_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string | null
          amenities: string[] | null
          area: string | null
          auto_flagged_at: string | null
          available_from: string | null
          available_to: string | null
          baths: number
          beds: number
          bumped_at: string | null
          campus_id: string
          created_at: string
          deposit_amount: number | null
          deposit_escrow_enabled: boolean
          description: string
          display_name: string | null
          featured_purchased_at: string | null
          featured_until: string | null
          filled_at: string | null
          filled_via_lease_up: boolean
          filled_with_user_id: string | null
          flagged: boolean
          furnished: boolean
          id: string
          is_active: boolean
          is_featured: boolean
          lat: number | null
          laundry: string | null
          lng: number | null
          parking: boolean
          pending_review: boolean
          pending_review_since: string | null
          pet_friendly: boolean
          photos: string[] | null
          price: number
          roommate_prefs: Json | null
          safe_score: number | null
          saves_count: number
          semester: string | null
          share_count: number
          sort_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
          utilities_included: boolean
          verification_tier: string
          view_count: number
          views: number
          wifi_included: boolean | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          auto_flagged_at?: string | null
          available_from?: string | null
          available_to?: string | null
          baths?: number
          beds?: number
          bumped_at?: string | null
          campus_id: string
          created_at?: string
          deposit_amount?: number | null
          deposit_escrow_enabled?: boolean
          description?: string
          display_name?: string | null
          featured_purchased_at?: string | null
          featured_until?: string | null
          filled_at?: string | null
          filled_via_lease_up?: boolean
          filled_with_user_id?: string | null
          flagged?: boolean
          furnished?: boolean
          id?: string
          is_active?: boolean
          is_featured?: boolean
          lat?: number | null
          laundry?: string | null
          lng?: number | null
          parking?: boolean
          pending_review?: boolean
          pending_review_since?: string | null
          pet_friendly?: boolean
          photos?: string[] | null
          price: number
          roommate_prefs?: Json | null
          safe_score?: number | null
          saves_count?: number
          semester?: string | null
          share_count?: number
          sort_at?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
          utilities_included?: boolean
          verification_tier?: string
          view_count?: number
          views?: number
          wifi_included?: boolean | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          auto_flagged_at?: string | null
          available_from?: string | null
          available_to?: string | null
          baths?: number
          beds?: number
          bumped_at?: string | null
          campus_id?: string
          created_at?: string
          deposit_amount?: number | null
          deposit_escrow_enabled?: boolean
          description?: string
          display_name?: string | null
          featured_purchased_at?: string | null
          featured_until?: string | null
          filled_at?: string | null
          filled_via_lease_up?: boolean
          filled_with_user_id?: string | null
          flagged?: boolean
          furnished?: boolean
          id?: string
          is_active?: boolean
          is_featured?: boolean
          lat?: number | null
          laundry?: string | null
          lng?: number | null
          parking?: boolean
          pending_review?: boolean
          pending_review_since?: string | null
          pet_friendly?: boolean
          photos?: string[] | null
          price?: number
          roommate_prefs?: Json | null
          safe_score?: number | null
          saves_count?: number
          semester?: string | null
          share_count?: number
          sort_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          utilities_included?: boolean
          verification_tier?: string
          view_count?: number
          views?: number
          wifi_included?: boolean | null
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
      looking_for_interests: {
        Row: {
          created_at: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_interests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
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
          display_name: string | null
          expiry_notified_at: string | null
          furnished: boolean | null
          id: string
          is_active: boolean
          move_in_date: string | null
          move_out_date: string | null
          num_people: number
          pets_ok: boolean | null
          title: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          area?: string | null
          beds_min?: number | null
          budget_max?: number | null
          campus_id?: string | null
          created_at?: string
          description: string
          display_name?: string | null
          expiry_notified_at?: string | null
          furnished?: boolean | null
          id?: string
          is_active?: boolean
          move_in_date?: string | null
          move_out_date?: string | null
          num_people?: number
          pets_ok?: boolean | null
          title: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          area?: string | null
          beds_min?: number | null
          budget_max?: number | null
          campus_id?: string | null
          created_at?: string
          description?: string
          display_name?: string | null
          expiry_notified_at?: string | null
          furnished?: boolean | null
          id?: string
          is_active?: boolean
          move_in_date?: string | null
          move_out_date?: string | null
          num_people?: number
          pets_ok?: boolean | null
          title?: string
          updated_at?: string
          upvotes?: number
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
      looking_for_upvotes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_upvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_url: string | null
          content: string
          content_type: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          content: string
          content_type?: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          content?: string
          content_type?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
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
      payment_intents: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          listing_id: string | null
          metadata: Json
          payee_id: string | null
          payer_id: string | null
          purpose: string
          refunded_at: string | null
          released_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string | null
          metadata?: Json
          payee_id?: string | null
          payer_id?: string | null
          purpose?: string
          refunded_at?: string | null
          released_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string | null
          metadata?: Json
          payee_id?: string | null
          payer_id?: string | null
          purpose?: string
          refunded_at?: string | null
          released_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_emoji: string | null
          avatar_url: string | null
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
          instagram_handle: string | null
          intent: string | null
          is_admin: boolean
          is_ambassador: boolean
          last_seen: string | null
          major: string | null
          name: string
          notification_preferences: Json
          onboarding_completed: boolean
          phone: string | null
          referral_code: string | null
          referral_count: number
          referred_by: string | null
          response_rate: number | null
          updated_at: string
          verified_email: boolean
          vibe_tags: string[] | null
          year: string | null
        }
        Insert: {
          avatar_emoji?: string | null
          avatar_url?: string | null
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
          instagram_handle?: string | null
          intent?: string | null
          is_admin?: boolean
          is_ambassador?: boolean
          last_seen?: string | null
          major?: string | null
          name?: string
          notification_preferences?: Json
          onboarding_completed?: boolean
          phone?: string | null
          referral_code?: string | null
          referral_count?: number
          referred_by?: string | null
          response_rate?: number | null
          updated_at?: string
          verified_email?: boolean
          vibe_tags?: string[] | null
          year?: string | null
        }
        Update: {
          avatar_emoji?: string | null
          avatar_url?: string | null
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
          instagram_handle?: string | null
          intent?: string | null
          is_admin?: boolean
          is_ambassador?: boolean
          last_seen?: string | null
          major?: string | null
          name?: string
          notification_preferences?: Json
          onboarding_completed?: boolean
          phone?: string | null
          referral_code?: string | null
          referral_count?: number
          referred_by?: string | null
          response_rate?: number | null
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
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          subscription: Json
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          subscription: Json
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          subscription?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          campus_id: string | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          campus_id?: string | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          campus_id?: string | null
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      renter_feedback: {
        Row: {
          additional_comments: string | null
          created_at: string
          how_found: string
          id: string
          user_id: string
        }
        Insert: {
          additional_comments?: string | null
          created_at?: string
          how_found: string
          id?: string
          user_id: string
        }
        Update: {
          additional_comments?: string | null
          created_at?: string
          how_found?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "renter_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renter_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renter_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_removed: boolean
          listing_id: string | null
          reviewed_user_id: string
          reviewer_id: string
          reviewer_role: string | null
          stars: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_removed?: boolean
          listing_id?: string | null
          reviewed_user_id: string
          reviewer_id: string
          reviewer_role?: string | null
          stars: number
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_removed?: boolean
          listing_id?: string | null
          reviewed_user_id?: string
          reviewer_id?: string
          reviewer_role?: string | null
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewed_user_id_fkey"
            columns: ["reviewed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewed_user_id_fkey"
            columns: ["reviewed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewed_user_id_fkey"
            columns: ["reviewed_user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      roommate_interests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          note: string | null
          status: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          note?: string | null
          status?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          note?: string | null
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roommate_interests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roommate_interests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roommate_interests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roommate_interests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roommate_interests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roommate_interests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      roommate_profiles: {
        Row: {
          about_me: string | null
          areas_preferred: string[]
          beds_wanted: number | null
          budget_max: number | null
          budget_min: number | null
          campus_id: string | null
          created_at: string
          gender_preference: string
          has_pets: boolean
          id: string
          is_active: boolean
          lease_length: string | null
          lifestyle_clean: number | null
          lifestyle_early_bird: boolean
          lifestyle_night_owl: boolean
          lifestyle_quiet: number | null
          lifestyle_social: boolean
          lifestyle_studious: boolean
          mode: string
          move_in_date: string | null
          pet_friendly: boolean
          smoker_ok: boolean
          smokes: boolean
          updated_at: string
          user_id: string
          vibe_tags: string[]
          view_count: number
        }
        Insert: {
          about_me?: string | null
          areas_preferred?: string[]
          beds_wanted?: number | null
          budget_max?: number | null
          budget_min?: number | null
          campus_id?: string | null
          created_at?: string
          gender_preference?: string
          has_pets?: boolean
          id?: string
          is_active?: boolean
          lease_length?: string | null
          lifestyle_clean?: number | null
          lifestyle_early_bird?: boolean
          lifestyle_night_owl?: boolean
          lifestyle_quiet?: number | null
          lifestyle_social?: boolean
          lifestyle_studious?: boolean
          mode?: string
          move_in_date?: string | null
          pet_friendly?: boolean
          smoker_ok?: boolean
          smokes?: boolean
          updated_at?: string
          user_id: string
          vibe_tags?: string[]
          view_count?: number
        }
        Update: {
          about_me?: string | null
          areas_preferred?: string[]
          beds_wanted?: number | null
          budget_max?: number | null
          budget_min?: number | null
          campus_id?: string | null
          created_at?: string
          gender_preference?: string
          has_pets?: boolean
          id?: string
          is_active?: boolean
          lease_length?: string | null
          lifestyle_clean?: number | null
          lifestyle_early_bird?: boolean
          lifestyle_night_owl?: boolean
          lifestyle_quiet?: number | null
          lifestyle_social?: boolean
          lifestyle_studious?: boolean
          mode?: string
          move_in_date?: string | null
          pet_friendly?: boolean
          smoker_ok?: boolean
          smokes?: boolean
          updated_at?: string
          user_id?: string
          vibe_tags?: string[]
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "roommate_profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roommate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roommate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roommate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          collection_name: string
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          collection_name?: string
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          collection_name?: string
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
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          area: string | null
          campus_id: string | null
          created_at: string
          email: string | null
          filters: Json
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
          user_id: string | null
        }
        Insert: {
          area?: string | null
          campus_id?: string | null
          created_at?: string
          email?: string | null
          filters?: Json
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
          user_id?: string | null
        }
        Update: {
          area?: string | null
          campus_id?: string | null
          created_at?: string
          email?: string | null
          filters?: Json
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
          user_id?: string | null
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
      tour_availability: {
        Row: {
          available_date: string
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          listing_id: string
          poster_id: string
          slot_duration_minutes: number
          start_time: string
        }
        Insert: {
          available_date: string
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          listing_id: string
          poster_id: string
          slot_duration_minutes?: number
          start_time: string
        }
        Update: {
          available_date?: string
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          listing_id?: string
          poster_id?: string
          slot_duration_minutes?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_availability_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_availability_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_availability_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_bookings: {
        Row: {
          availability_id: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          listing_id: string
          message: string | null
          poster_id: string
          poster_survey: string | null
          scheduled_date: string
          scheduled_time: string
          status: string
          subletter_id: string
          subletter_survey: string | null
          survey_prompted_at: string | null
        }
        Insert: {
          availability_id?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          poster_id: string
          poster_survey?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: string
          subletter_id: string
          subletter_survey?: string | null
          survey_prompted_at?: string | null
        }
        Update: {
          availability_id?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          poster_id?: string
          poster_survey?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string
          subletter_id?: string
          subletter_survey?: string | null
          survey_prompted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_bookings_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "tour_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_subletter_id_fkey"
            columns: ["subletter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_subletter_id_fkey"
            columns: ["subletter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_subletter_id_fkey"
            columns: ["subletter_id"]
            isOneToOne: false
            referencedRelation: "user_risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      campus_price_stats: {
        Row: {
          avg_price: number | null
          beds: number | null
          campus_id: string | null
          listing_count: number | null
          max_price: number | null
          median_price: number | null
          min_price: number | null
          p25_price: number | null
          p75_price: number | null
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
      listing_reaction_counts: {
        Row: {
          count: number | null
          listing_id: string | null
          reaction_type: string | null
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
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reaction_events: {
        Row: {
          created_at: string | null
          listing_id: string | null
          reaction_type: string | null
        }
        Insert: {
          created_at?: string | null
          listing_id?: string | null
          reaction_type?: string | null
        }
        Update: {
          created_at?: string | null
          listing_id?: string | null
          reaction_type?: string | null
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
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          avatar_emoji: string | null
          avatar_url: string | null
          banner_color: string | null
          bio: string | null
          campus_id: string | null
          created_at: string | null
          currently_emoji: string | null
          currently_status: string | null
          currently_updated_at: string | null
          id: string | null
          instagram_handle: string | null
          is_ambassador: boolean | null
          last_seen: string | null
          major: string | null
          name: string | null
          referral_count: number | null
          response_rate: number | null
          updated_at: string | null
          verified_email: boolean | null
          vibe_tags: string[] | null
          year: string | null
        }
        Insert: {
          avatar_emoji?: string | null
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          campus_id?: string | null
          created_at?: string | null
          currently_emoji?: string | null
          currently_status?: string | null
          currently_updated_at?: string | null
          id?: string | null
          instagram_handle?: string | null
          is_ambassador?: boolean | null
          last_seen?: string | null
          major?: string | null
          name?: string | null
          referral_count?: number | null
          response_rate?: number | null
          updated_at?: string | null
          verified_email?: boolean | null
          vibe_tags?: string[] | null
          year?: string | null
        }
        Update: {
          avatar_emoji?: string | null
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          campus_id?: string | null
          created_at?: string | null
          currently_emoji?: string | null
          currently_status?: string | null
          currently_updated_at?: string | null
          id?: string | null
          instagram_handle?: string | null
          is_ambassador?: boolean | null
          last_seen?: string | null
          major?: string | null
          name?: string | null
          referral_count?: number | null
          response_rate?: number | null
          updated_at?: string | null
          verified_email?: boolean | null
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
      saved_listing_counts: {
        Row: {
          listing_id: string | null
          save_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listing_events: {
        Row: {
          created_at: string | null
          listing_id: string | null
        }
        Insert: {
          created_at?: string | null
          listing_id?: string | null
        }
        Update: {
          created_at?: string | null
          listing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "suspicious_listings_filtered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "trending_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      suspicious_listings: {
        Row: {
          beds: number | null
          campus_id: string | null
          created_at: string | null
          flag_reason: string | null
          id: string | null
          median_price: number | null
          p25_price: number | null
          p75_price: number | null
          pending_review: boolean | null
          photos: string[] | null
          price: number | null
          title: string | null
          user_id: string | null
          verification_tier: string | null
          view_count: number | null
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
      suspicious_listings_filtered: {
        Row: {
          beds: number | null
          campus_id: string | null
          created_at: string | null
          flag_reason: string | null
          id: string | null
          median_price: number | null
          p25_price: number | null
          p75_price: number | null
          pending_review: boolean | null
          photos: string[] | null
          price: number | null
          title: string | null
          user_id: string | null
          verification_tier: string | null
          view_count: number | null
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
      trending_listings: {
        Row: {
          address: string | null
          amenities: string[] | null
          area: string | null
          available_from: string | null
          available_to: string | null
          baths: number | null
          beds: number | null
          campus_id: string | null
          created_at: string | null
          description: string | null
          flagged: boolean | null
          furnished: boolean | null
          id: string | null
          is_active: boolean | null
          lat: number | null
          lng: number | null
          parking: boolean | null
          pet_friendly: boolean | null
          photos: string[] | null
          price: number | null
          safe_score: number | null
          semester: string | null
          title: string | null
          trending_score: number | null
          type: string | null
          updated_at: string | null
          user_id: string | null
          utilities_included: boolean | null
          view_count: number | null
          views: number | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          available_from?: string | null
          available_to?: string | null
          baths?: number | null
          beds?: number | null
          campus_id?: string | null
          created_at?: string | null
          description?: string | null
          flagged?: boolean | null
          furnished?: boolean | null
          id?: string | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          parking?: boolean | null
          pet_friendly?: boolean | null
          photos?: string[] | null
          price?: number | null
          safe_score?: number | null
          semester?: string | null
          title?: string | null
          trending_score?: never
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          utilities_included?: boolean | null
          view_count?: number | null
          views?: number | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          available_from?: string | null
          available_to?: string | null
          baths?: number | null
          beds?: number | null
          campus_id?: string | null
          created_at?: string | null
          description?: string | null
          flagged?: boolean | null
          furnished?: boolean | null
          id?: string | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          parking?: boolean | null
          pet_friendly?: boolean | null
          photos?: string[] | null
          price?: number | null
          safe_score?: number | null
          semester?: string | null
          title?: string | null
          trending_score?: never
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
          utilities_included?: boolean | null
          view_count?: number | null
          views?: number | null
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
      user_risk_scores: {
        Row: {
          avg_rating: number | null
          banned: boolean | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          reports_filed: number | null
          reports_received: number | null
          risk_level: string | null
          verified_email: boolean | null
        }
        Insert: {
          avg_rating?: never
          banned?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          reports_filed?: never
          reports_received?: never
          risk_level?: never
          verified_email?: boolean | null
        }
        Update: {
          avg_rating?: never
          banned?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          reports_filed?: never
          reports_received?: never
          risk_level?: never
          verified_email?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_approve_pending_listings: { Args: never; Returns: undefined }
      bump_listing: { Args: { _listing_id: string }; Returns: string }
      campus_for_email_domain: { Args: { _domain: string }; Returns: string }
      campuses_with_listings: {
        Args: never
        Returns: {
          city: string
          domain: string
          id: string
          lat: number
          level: number
          listing_count: number
          lng: number
          name: string
          short_name: string
          slug: string
          state: string
        }[]
      }
      compute_verification_tier: {
        Args: { _listing_id: string }
        Returns: string
      }
      count_saved_search_matches: {
        Args: { _search_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_referral_code: { Args: never; Returns: string }
      get_campus_price_stats: {
        Args: { bed_count: number; campus: string }
        Returns: Json
      }
      get_conversation_participant_email: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: string
      }
      get_host_stats: { Args: { host_id: string }; Returns: Json }
      get_listing_benchmark: { Args: { _listing_id: string }; Returns: Json }
      get_neighborhood_price_breakdown: {
        Args: { campus: string }
        Returns: {
          area: string
          avg_price: number
          listing_count: number
          median_price: number
        }[]
      }
      get_price_label: {
        Args: { bed_count: number; campus: string; listing_price: number }
        Returns: string
      }
      get_public_profile: { Args: { _uid: string }; Returns: Json }
      get_stale_listings_for_user: {
        Args: { _uid: string }
        Returns: {
          beds: number
          campus_id: string
          days_active: number
          listing_id: string
          median_price: number
          price: number
          title: string
        }[]
      }
      has_interacted: { Args: { _a: string; _b: string }; Returns: boolean }
      increment_listing_share: {
        Args: { _listing_id: string }
        Returns: number
      }
      increment_listing_view: { Args: { _listing_id: string }; Returns: number }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_banned: { Args: { _uid: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      nearby_campuses_with_listings: {
        Args: { _campus_id: string; _limit?: number }
        Returns: {
          city: string
          distance_miles: number
          domain: string
          id: string
          lat: number
          level: number
          listing_count: number
          lng: number
          name: string
          short_name: string
          slug: string
          state: string
        }[]
      }
      notif_pref_enabled: {
        Args: { _key: string; _uid: string }
        Returns: boolean
      }
      process_looking_for_expiry: { Args: never; Returns: undefined }
      process_post_tour_surveys: { Args: never; Returns: undefined }
      process_review_prompts: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      search_campuses: {
        Args: { _limit?: number; _q: string }
        Returns: {
          city: string
          domain: string
          id: string
          lat: number
          level: number
          listing_count: number
          lng: number
          name: string
          short_name: string
          slug: string
          state: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_listing_stats: { Args: never; Returns: undefined }
      upvote_looking_for_post: { Args: { _post_id: string }; Returns: number }
      user_in_message_convo: {
        Args: { _message: string; _user: string }
        Returns: boolean
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
