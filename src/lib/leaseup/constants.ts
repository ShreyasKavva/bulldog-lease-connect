export const UGA_CENTER: [number, number] = [33.9502, -83.3747];

export const NEIGHBORHOODS: { name: string; lat: number; lng: number }[] = [
  { name: "Downtown Athens", lat: 33.9590, lng: -83.3782 },
  { name: "Five Points", lat: 33.9410, lng: -83.3760 },
  { name: "Normaltown", lat: 33.9700, lng: -83.3850 },
  { name: "Eastside", lat: 33.9500, lng: -83.3450 },
  { name: "Westside", lat: 33.9450, lng: -83.4200 },
  { name: "Milledge Ave", lat: 33.9430, lng: -83.3820 },
  { name: "South Campus", lat: 33.9380, lng: -83.3740 },
  { name: "North Campus", lat: 33.9590, lng: -83.3750 },
];

export const VIBE_TAGS = [
  "🎉 Social", "📚 Studious", "🌙 Night Owl", "☀️ Early Bird",
  "🐾 Pet Parent", "🎵 Music Lover", "🏋️ Gym Rat", "🍕 Foodie",
  "🎮 Gamer", "🌿 Chill", "🏠 Homebody", "✈️ Study Abroad",
];

export const AMENITIES = [
  "In-unit laundry", "Dishwasher", "AC", "Gym", "Pool", "Balcony",
  "Walk to campus", "Bus route", "WiFi included", "Trash included",
];

export const AVATAR_EMOJIS = ["🙂","😎","🤓","🥳","🧑‍🎓","🦁","🐶","🐱","🌻","🍕","🎧","⚽"];
export const BANNER_COLORS = ["#2563EB","#16A34A","#DC2626","#EA580C","#7C3AED","#DB2777","#0891B2","#1C1E21"];

export const YEARS = ["Freshman","Sophomore","Junior","Senior","Grad","Alumni"];

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  if (s < 604800) return `${Math.floor(s/86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 24 * 3600 * 1000;
}
