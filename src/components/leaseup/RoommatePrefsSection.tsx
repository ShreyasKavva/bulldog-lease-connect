/**
 * Q145 — collapsible "Roommate preferences (optional)" section for the post flow.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LOOKING_FOR_OPTIONS,
  STUDY_STYLE_OPTIONS,
  SOCIAL_VIBE_OPTIONS,
  PETS_OPTIONS,
  SMOKING_OPTIONS,
  type RoommatePrefs,
} from "@/lib/leaseup/roommate-prefs";

const PILL_OFF =
  "border border-gray-200 rounded-full px-3 py-1.5 text-sm text-gray-600 bg-white dark:border-border dark:bg-transparent dark:text-foreground/70";
const PILL_ON =
  "border border-[#FF5A5F] rounded-full px-3 py-1.5 text-sm text-[#FF5A5F] bg-[#FF5A5F]/10 font-medium";

function Pill({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn("transition", on ? PILL_ON : PILL_OFF)}>
      {label}
    </button>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function RoommatePrefsSection({
  value,
  onChange,
}: {
  value: RoommatePrefs;
  onChange: (next: RoommatePrefs) => void;
}) {
  const [open, setOpen] = useState(false);
  const lookingFor = value.looking_for ?? [];

  const toggleLooking = (id: string) =>
    onChange({
      ...value,
      looking_for: lookingFor.includes(id) ? lookingFor.filter((x) => x !== id) : [...lookingFor, id],
    });

  const single = (key: keyof RoommatePrefs, id: string) =>
    onChange({ ...value, [key]: value[key] === id ? null : id });

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
      >
        🏠 Roommate preferences (optional)
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-gray-100 px-4 py-4 dark:border-border">
          <Row title="Looking for">
            {LOOKING_FOR_OPTIONS.map((o) => (
              <Pill key={o.id} on={lookingFor.includes(o.id)} label={o.label} onClick={() => toggleLooking(o.id)} />
            ))}
          </Row>
          <Row title="Study style">
            {STUDY_STYLE_OPTIONS.map((o) => (
              <Pill key={o.id} on={value.study_style === o.id} label={o.label} onClick={() => single("study_style", o.id)} />
            ))}
          </Row>
          <Row title="Social vibe">
            {SOCIAL_VIBE_OPTIONS.map((o) => (
              <Pill key={o.id} on={value.social_vibe === o.id} label={o.label} onClick={() => single("social_vibe", o.id)} />
            ))}
          </Row>
          <Row title="Pets">
            {PETS_OPTIONS.map((o) => (
              <Pill key={o.id} on={value.pets === o.id} label={o.label} onClick={() => single("pets", o.id)} />
            ))}
          </Row>
          <Row title="Smoking">
            {SMOKING_OPTIONS.map((o) => (
              <Pill key={o.id} on={value.smoking === o.id} label={o.label} onClick={() => single("smoking", o.id)} />
            ))}
          </Row>
        </div>
      )}
    </div>
  );
}
