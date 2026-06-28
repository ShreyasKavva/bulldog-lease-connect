import { supabase } from "@/integrations/supabase/client";

export type RoommateProfile = {
  id: string;
  user_id: string;
  campus_id: string | null;
  budget_min: number | null;
  budget_max: number | null;
  move_in_date: string | null;
  lease_length: "semester" | "academic_year" | "full_year" | "flexible" | null;
  beds_wanted: number | null;
  areas_preferred: string[];
  lifestyle_early_bird: boolean;
  lifestyle_night_owl: boolean;
  lifestyle_studious: boolean;
  lifestyle_social: boolean;
  lifestyle_clean: number | null;
  lifestyle_quiet: number | null;
  has_pets: boolean;
  pet_friendly: boolean;
  smokes: boolean;
  smoker_ok: boolean;
  gender_preference: "no_preference" | "same_gender" | "any";
  about_me: string | null;
  vibe_tags: string[];
  is_active: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type RoommateProfileWithUser = RoommateProfile & {
  profile: {
    id: string;
    name: string | null;
    avatar_emoji: string | null;
    banner_color: string | null;
    avatar_url?: string | null;
    year: string | null;
    major: string | null;
    verified_email: boolean;
    is_verified?: boolean;
  } | null;
};

export type RoommateInterest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined";
  note: string | null;
  created_at: string;
};

const PROFILE_FIELDS =
  "id,name,avatar_emoji,banner_color,avatar_url,year,major,verified_email,is_verified";

export async function fetchMyRoommateProfile(userId: string): Promise<RoommateProfile | null> {
  const { data, error } = await supabase
    .from("roommate_profiles" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export async function fetchRoommateProfiles(opts: {
  campusId?: string | null;
  excludeUserId?: string;
}): Promise<RoommateProfileWithUser[]> {
  let q = supabase
    .from("roommate_profiles" as any)
    .select(`*, profile:profiles!roommate_profiles_user_id_fkey(${PROFILE_FIELDS})`)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(120);
  if (opts.campusId) q = q.eq("campus_id", opts.campusId);
  if (opts.excludeUserId) q = q.neq("user_id", opts.excludeUserId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as any) ?? [];
}

export async function upsertRoommateProfile(p: Partial<RoommateProfile> & { user_id: string }) {
  const { data, error } = await supabase
    .from("roommate_profiles" as any)
    .upsert(p as any, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data as any as RoommateProfile;
}

export async function setRoommateActive(userId: string, active: boolean) {
  const { error } = await supabase
    .from("roommate_profiles" as any)
    .update({ is_active: active } as any)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function sendRoommateInterest(fromId: string, toId: string, note?: string) {
  const { data, error } = await supabase
    .from("roommate_interests" as any)
    .insert({ from_user_id: fromId, to_user_id: toId, note: note ?? null } as any)
    .select()
    .single();
  if (error) throw error;
  return data as any as RoommateInterest;
}

export async function fetchMyOutgoingInterests(userId: string): Promise<RoommateInterest[]> {
  const { data, error } = await supabase
    .from("roommate_interests" as any)
    .select("*")
    .eq("from_user_id", userId);
  if (error) throw error;
  return (data as any) ?? [];
}

export async function fetchMyIncomingInterests(userId: string): Promise<RoommateInterest[]> {
  const { data, error } = await supabase
    .from("roommate_interests" as any)
    .select("*")
    .eq("to_user_id", userId);
  if (error) throw error;
  return (data as any) ?? [];
}

// ============ Compatibility scoring ============
export type CompatBreakdown = {
  score: number; // 0-100
  reasons: { good: boolean; text: string }[];
};

export function computeCompatibility(
  me: RoommateProfile | null,
  them: RoommateProfile,
): CompatBreakdown {
  if (!me) return { score: 0, reasons: [] };
  let score = 0;
  const reasons: CompatBreakdown["reasons"] = [];

  // Budget overlap
  if (
    me.budget_min != null && me.budget_max != null &&
    them.budget_min != null && them.budget_max != null
  ) {
    const overlapLo = Math.max(me.budget_min, them.budget_min);
    const overlapHi = Math.min(me.budget_max, them.budget_max);
    if (overlapHi >= overlapLo) {
      const myRange = me.budget_max - me.budget_min || 1;
      const theirRange = them.budget_max - them.budget_min || 1;
      const overlapSize = overlapHi - overlapLo;
      const minRange = Math.min(myRange, theirRange);
      const ratio = minRange > 0 ? overlapSize / minRange : 1;
      if (ratio >= 0.9) {
        score += 35;
        reasons.push({ good: true, text: `Similar budget ($${overlapLo}–${overlapHi})` });
      } else {
        score += 25;
        reasons.push({ good: true, text: `Budget overlaps ($${overlapLo}–${overlapHi})` });
      }
    } else {
      reasons.push({ good: false, text: "Budgets don't overlap" });
    }
  }

  // Sleep schedule
  const meEarly = me.lifestyle_early_bird, themEarly = them.lifestyle_early_bird;
  const meNight = me.lifestyle_night_owl, themNight = them.lifestyle_night_owl;
  if ((meEarly && themEarly) || (meNight && themNight)) {
    score += 20;
    reasons.push({ good: true, text: meNight ? "Both night owls 🌙" : "Both early birds ☀️" });
  } else if ((meEarly && themNight) || (meNight && themEarly)) {
    reasons.push({ good: false, text: "Opposite sleep schedules" });
  }

  // Cleanliness
  if (me.lifestyle_clean != null && them.lifestyle_clean != null) {
    const diff = Math.abs(me.lifestyle_clean - them.lifestyle_clean);
    if (diff <= 1) {
      score += 15;
      reasons.push({ good: true, text: "Similar cleanliness 🧹" });
    } else if (diff >= 3) {
      reasons.push({ good: false, text: "Different cleanliness standards" });
    }
  }

  // Social
  const meSocial = me.lifestyle_social ? 5 : 2;
  const themSocial = them.lifestyle_social ? 5 : 2;
  const meStudious = me.lifestyle_studious ? 5 : 2;
  const themStudious = them.lifestyle_studious ? 5 : 2;
  if (Math.abs(meSocial - themSocial) <= 1 || Math.abs(meStudious - themStudious) <= 1) {
    score += 10;
    reasons.push({ good: true, text: "Similar social vibes" });
  }

  // Pets
  const petsOk = (me.has_pets ? them.pet_friendly : true) && (them.has_pets ? me.pet_friendly : true);
  if (petsOk) {
    score += 15;
    if (me.has_pets && them.pet_friendly) reasons.push({ good: true, text: "They're pet-friendly 🐾" });
    else if (them.has_pets && me.pet_friendly) reasons.push({ good: true, text: "You're pet-friendly 🐾" });
  } else {
    score -= 15;
    if (me.has_pets && !them.pet_friendly) reasons.push({ good: false, text: "You have a pet — they prefer no pets" });
    if (them.has_pets && !me.pet_friendly) reasons.push({ good: false, text: "They have a pet — you prefer no pets" });
  }

  // Smoking
  if (me.smokes && !them.smoker_ok) reasons.push({ good: false, text: "You smoke — they prefer non-smokers" });
  else if (them.smokes && !me.smoker_ok) reasons.push({ good: false, text: "They smoke — you prefer non-smokers" });

  // Move-in date
  if (me.move_in_date && them.move_in_date) {
    const diffDays = Math.abs(
      (new Date(me.move_in_date).getTime() - new Date(them.move_in_date).getTime()) / 86400000,
    );
    if (diffDays <= 30) {
      score += 5;
      reasons.push({ good: true, text: "Similar move-in date 📅" });
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export function compatColor(score: number): string {
  if (score >= 80) return "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (score >= 60) return "text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300";
  return "text-muted-foreground bg-muted";
}
