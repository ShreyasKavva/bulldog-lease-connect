import {
  MessageSquare,
  Target,
  TrendingDown,
  Star,
  Heart,
  Eye,
  Handshake,
  Clock,
  UserCircle2,
  Bell,
  type LucideIcon,
} from "lucide-react";

export type NotificationKind =
  | "new_message"
  | "message" // legacy alias
  | "listing_match"
  | "looking_for_match" // legacy alias
  | "price_drop"
  | "new_review"
  | "review_prompt"
  | "listing_saved"
  | "listing_viewed_milestone"
  | "looking_for_interest"
  | "interest_match" // legacy alias
  | "lease_expiring"
  | "looking_for_expiring"
  | "saved_search_match"
  | "roommate_interest"
  | "roommate_match"
  | "profile_incomplete";

type Meta = {
  icon: LucideIcon;
  emoji: string;
  /** Tailwind utility classes for the icon's bg + foreground. */
  tone: string;
  /** Sonner toast priority — only "high" surfaces auto-toasts. */
  priority: "high" | "normal";
};

const FALLBACK: Meta = {
  icon: Bell,
  emoji: "🔔",
  tone: "bg-muted text-muted-foreground",
  priority: "normal",
};

const TABLE: Record<string, Meta> = {
  new_message: { icon: MessageSquare, emoji: "💬", tone: "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-gray-100", priority: "high" },
  message: { icon: MessageSquare, emoji: "💬", tone: "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-gray-100", priority: "high" },
  listing_match: { icon: Target, emoji: "🎯", tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", priority: "high" },
  looking_for_match: { icon: Target, emoji: "🎯", tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", priority: "high" },
  saved_search_match: { icon: Target, emoji: "🎯", tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", priority: "high" },
  price_drop: { icon: TrendingDown, emoji: "📉", tone: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300", priority: "high" },
  new_review: { icon: Star, emoji: "⭐", tone: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300", priority: "normal" },
  review_prompt: { icon: Star, emoji: "⭐", tone: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300", priority: "normal" },
  listing_saved: { icon: Heart, emoji: "❤️", tone: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300", priority: "normal" },
  listing_viewed_milestone: { icon: Eye, emoji: "👀", tone: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300", priority: "normal" },
  looking_for_interest: { icon: Handshake, emoji: "🤝", tone: "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-gray-100", priority: "normal" },
  interest_match: { icon: Handshake, emoji: "🤝", tone: "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-gray-100", priority: "normal" },
  lease_expiring: { icon: Clock, emoji: "⏰", tone: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300", priority: "normal" },
  looking_for_expiring: { icon: Clock, emoji: "⏰", tone: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300", priority: "normal" },
  roommate_interest: { icon: Handshake, emoji: "👥", tone: "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-gray-100", priority: "normal" },
  roommate_match: { icon: Handshake, emoji: "🎉", tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", priority: "high" },
  profile_incomplete: { icon: UserCircle2, emoji: "👤", tone: "bg-muted text-muted-foreground", priority: "normal" },
};

export function notificationMeta(type: string): Meta {
  return TABLE[type] ?? FALLBACK;
}

/** Maps a notification type → the profile preference key gating it. */
export function notificationPrefKey(type: string): string | null {
  if (type === "new_message" || type === "message") return "new_message";
  if (type === "listing_match" || type === "looking_for_match" || type === "saved_search_match") return "listing_match";
  if (type === "price_drop") return "price_drop";
  if (type === "listing_saved") return "listing_saved";
  if (type === "listing_viewed_milestone") return "view_milestone";
  if (type === "new_review" || type === "review_prompt") return "new_review";
  if (type === "looking_for_interest" || type === "interest_match") return "looking_for_interest";
  if (type === "lease_expiring" || type === "looking_for_expiring") return "lease_expiring";
  return null;
}
