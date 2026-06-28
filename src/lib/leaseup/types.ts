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
  is_active: boolean;
  flagged?: boolean;
  safe_score: number | null;
  view_count?: number;
  status?: "active" | "filled" | "inactive";
  filled_at?: string | null;
  filled_with_user_id?: string | null;
  filled_via_lease_up?: boolean;
  created_at: string;
  profile?: Profile;
  photo_urls?: string[];
};

export type Conversation = {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  listing_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  other?: Profile;
  listing?: { id: string; title: string } | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
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
  area: string | null;
  furnished: boolean | null;
  pets_ok: boolean | null;
  is_active: boolean;
  expiry_notified_at: string | null;
  created_at: string;
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
