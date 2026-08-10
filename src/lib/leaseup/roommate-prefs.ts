/**
 * Q145 — optional roommate preferences captured in the post flow and shown
 * on the listing slide-out. Stored in listings.roommate_prefs (jsonb).
 */
export type RoommatePrefs = {
  looking_for?: string[];
  study_style?: string | null;
  social_vibe?: string | null;
  pets?: string | null;
  smoking?: string | null;
};

export const LOOKING_FOR_OPTIONS = [
  { id: "undergrad", label: "Undergrad", chip: "🎓 Undergrad" },
  { id: "grad_student", label: "Grad student", chip: "🎓 Grad student" },
  { id: "young_professional", label: "Young professional", chip: "💼 Young professional" },
  { id: "any", label: "Any", chip: "🙌 Anyone" },
] as const;

export const STUDY_STYLE_OPTIONS = [
  { id: "early_bird", label: "🌅 Early bird", chip: "🌅 Early bird" },
  { id: "night_owl", label: "🌙 Night owl", chip: "🌙 Night owl" },
  { id: "flexible", label: "🔀 Flexible", chip: "🔀 Flexible schedule" },
] as const;

export const SOCIAL_VIBE_OPTIONS = [
  { id: "quiet", label: "🤫 Quiet & focused", chip: "🤫 Quiet & focused" },
  { id: "social", label: "🎉 Social & outgoing", chip: "🎉 Social & outgoing" },
  { id: "mix", label: "🤝 Mix of both", chip: "🤝 Mix of both" },
] as const;

export const PETS_OPTIONS = [
  { id: "ok", label: "🐾 Pets OK", chip: "🐾 Pets OK" },
  { id: "no", label: "🚫 No pets", chip: "🚫 No pets" },
] as const;

export const SMOKING_OPTIONS = [
  { id: "no", label: "✅ Non-smoking", chip: "✅ Non-smoking" },
  { id: "ok", label: "🚬 Smoking OK", chip: "🚬 Smoking OK" },
] as const;

type Opt = { id: string; label: string; chip: string };

function chipFor(options: readonly Opt[], id: string | null | undefined): string | null {
  if (!id) return null;
  return options.find((o) => o.id === id)?.chip ?? null;
}

/** Flat chip labels for display; empty array when nothing was set. */
export function roommatePrefChips(prefs: unknown): string[] {
  if (!prefs || typeof prefs !== "object") return [];
  const p = prefs as RoommatePrefs;
  const chips: string[] = [];
  for (const id of p.looking_for ?? []) {
    const c = chipFor(LOOKING_FOR_OPTIONS as readonly Opt[], id);
    if (c) chips.push(c);
  }
  const rest = [
    chipFor(STUDY_STYLE_OPTIONS as readonly Opt[], p.study_style),
    chipFor(SOCIAL_VIBE_OPTIONS as readonly Opt[], p.social_vibe),
    chipFor(PETS_OPTIONS as readonly Opt[], p.pets),
    chipFor(SMOKING_OPTIONS as readonly Opt[], p.smoking),
  ];
  for (const c of rest) if (c) chips.push(c);
  return chips;
}

export function hasRoommatePrefs(prefs: unknown): boolean {
  return roommatePrefChips(prefs).length > 0;
}

/**
 * Q147 — browse filtering. Each group is a set of selected ids; a listing
 * matches when its stored value is in the set, or when the listing left the
 * field unset / marked "any" (never hide flexible hosts).
 */
export type RoommateFilterSets = {
  looking_for?: string[];
  study_style?: string[];
  pets?: string[];
  smoking?: string[];
};

function groupMatches(selected: string[] | undefined, values: string[]): boolean {
  if (!selected || selected.length === 0) return true;
  if (values.length === 0 || values.includes("any")) return true;
  return values.some((v) => selected.includes(v));
}

export function matchesRoommateFilters(prefs: unknown, f: RoommateFilterSets): boolean {
  const p = (prefs && typeof prefs === "object" ? prefs : {}) as RoommatePrefs;
  return (
    groupMatches(f.looking_for, p.looking_for ?? []) &&
    groupMatches(f.study_style, p.study_style ? [p.study_style] : []) &&
    groupMatches(f.pets, p.pets ? [p.pets] : []) &&
    groupMatches(f.smoking, p.smoking ? [p.smoking] : [])
  );
}
