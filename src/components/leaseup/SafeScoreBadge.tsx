import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function SafeScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "md" }) {
  if (score == null) return null;
  const tier =
    score >= 80 ? { label: "Trusted", cls: "bg-success-light text-success" } :
    score >= 60 ? { label: "Solid", cls: "bg-primary-light text-primary-dark" } :
    score >= 40 ? { label: "Basic", cls: "bg-accent text-accent-foreground" } :
                  { label: "New", cls: "bg-muted text-muted-foreground" };
  return (
    <span
      title={`SafeScore: completeness + verification check (${score}/100)`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        tier.cls,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Shield className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {score} · {tier.label}
    </span>
  );
}
