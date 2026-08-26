/**
 * Domain types — the single source of truth for the LeaseUp data model on
 * the client. These mirror the Postgres schema in supabase/migrations/.
 *
 * If you add a column to a table, update the type here too — most components
 * import from this file rather than from the auto-generated Supabase types,
 * because we project extra UI-only fields onto these objects (e.g. `profile`,
 * `photo_urls`, `interest_count`).
 *
 * Conventions:
 * - snake_case to match Postgres column names exactly. Do NOT camelCase here.
 * - Optional fields (`?`) are columns added in later migrations; older rows
 *   may not have them set. Code should defensively check.
 * - `photo_urls` on Listing is NOT a DB column; it's populated client-side
 *   in queries.ts::attachSignedUrls() from the `photos` Storage paths.
 */
export type Profile = {
  id: string;
  email: string;
  name: string;
  year: string | null;
  major: string | null;
  campus_id: string | null;
  bio: string | null;
  avatar_emoji: string | null;
  banner_color: string | null;
  vibe_tags: string[] | null;
  phone: string | null;
  verified_email: boolean;
  is_admin?: boolean;
  banned?: boolean;
  currently_status?: string | null;
  currently_emoji?: string | null;
  currently_updated_at?: string | null;
  last_seen?: string | null;
  updated_at?: string | null;
  created_at: string;
  onboarding_completed?: boolean;
  intent?: "listing" | "looking" | null;
};


export type Listing = {
  id: string;
  user_id: string;
  campus_id: string;
  title: string;
  description: string;
  type: "sublease" | "transfer";
  price: number;
  beds: number;
  baths: number;
  area: string | null;
  lat: number | null;
  lng: number | null;
  furnished: boolean;
  utilities_included: boolean;
  pet_friendly: boolean;
  parking: boolean;
  available_from: string | null;
  available_to: string | null;
  amenities: string[] | null;
  photos: string[] | null;
  /** Q175 — poster display name override (used by seeded sample listings). */
  display_name?: string | null;
  is_active: boolean;
  flagged?: boolean;
  view_count?: number;
  /** Q143 — maintained by a DB trigger on saved_listings. */
  saves_count?: number;
  status?: "active" | "filled" | "inactive";
  filled_at?: string | null;
  filled_with_user_id?: string | null;
  filled_via_lease_up?: boolean;
  created_at: string;
  profile?: Profile;
  photo_urls?: string[];
  // Queue 17 — payments
  is_featured?: boolean;
  featured_until?: string | null;
  featured_purchased_at?: string | null;
  deposit_amount?: number | null;
  deposit_escrow_enabled?: boolean;
  // Queue 21 — trust & safety
  pending_review?: boolean;
  pending_review_since?: string | null;
  verification_tier?: "unverified" | "basic" | "verified" | "premium";
  auto_flagged_at?: string | null;
};

export type Conversation = {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  listing_id: string | null;
  /** Q183 — roommate-search thread context (null for listing/general threads). */
  looking_post_id?: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  pinned_by_p1?: boolean;
  pinned_by_p2?: boolean;
  muted_by_p1?: boolean;
  muted_by_p2?: boolean;
  deleted_by_p1?: boolean;
  deleted_by_p2?: boolean;
  other?: Profile;
  /** Q108 — inbox preview extras (computed in fetchConversations). */
  last_message_sender_id?: string | null;
  unread_count?: number;

  listing?: {
    id: string;
    title: string;
    price?: number | null;
    beds?: number | null;
    area?: string | null;

    available_from?: string | null;
    available_to?: string | null;
    is_active?: boolean;
    status?: string | null;
    photo_url?: string | null;
    user_id?: string | null;
    /** Q175 — poster display name override (seeded listings). */
    display_name?: string | null;
  } | null;
};

export type MessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  read_at: string | null;
  content_type: "text" | "image" | "document";
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
  reactions?: MessageReaction[];
};

export type LookingForPost = {
  id: string;
  user_id: string;
  campus_id: string | null;
  title: string;
  description: string;
  budget_max: number | null;
  move_in_date: string | null;
  move_out_date: string | null;
  beds_min: number | null;
  num_people?: number | null;
  area: string | null;
  furnished: boolean | null;
  pets_ok: boolean | null;
  display_name?: string | null;
  is_active: boolean;
  expiry_notified_at: string | null;
  created_at: string;
  upvotes?: number | null;
  profile?: Profile;
  interest_count?: number;
};


export type LeaseAnalysis = {
  id: string;
  user_id: string;
  filename: string;
  summary: string | null;
  risk_score: number | null;
  flags: Array<{ severity: "low" | "medium" | "high"; clause: string; concern: string }>;
  raw_excerpt: string | null;
  created_at: string;
};

export type SavedSearch = {
  id: string;
  user_id: string;
  name: string;
  campus_id: string | null;
  area: string | null;
  max_price: number | null;
  min_beds: number | null;
  furnished_only: boolean;
  pet_friendly_only: boolean;
  keyword: string | null;
  notify: boolean;
  last_notified_at: string | null;
  created_at: string;
};
