/**
 * Q513 — short, calm safety guidance shown next to the contact button on the
 * listing page and the listing slide-out. Only advice; makes no claim that
 * LeaseUp checks people or listings.
 */
import { ShieldCheck } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function SafetyTips({ className }: { className?: string }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-2xl border border-border bg-muted/60 p-3 text-xs leading-relaxed text-foreground",
        className,
      )}
    >
      <h3 id={id} className="flex items-center gap-1.5 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        Stay safe
      </h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li>Meet in a public place or tour the place in person before paying anything.</li>
        <li>Never wire money or pay with gift cards or crypto.</li>
        <li>Keep all your messages on LeaseUp.</li>
      </ul>
    </section>
  );
}
