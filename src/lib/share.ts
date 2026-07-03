import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/leaseup/types";

export type ShareSource = "groupme" | "instagram" | "native" | "copy";
type DbShareType = "story_graphic" | "link_copy" | "native_share";

const SOURCE_TO_DB: Record<ShareSource, DbShareType> = {
  groupme: "link_copy",
  instagram: "story_graphic",
  native: "native_share",
  copy: "link_copy",
};

export function buildShareUrl(listingId: string, source: ShareSource): string {
  return `https://leasup.co/listings/${listingId}?utm_source=${source}&utm_campaign=poster-share`;
}

export function logShare(listingId: string, source: ShareSource) {
  const type = SOURCE_TO_DB[source];
  void supabase.from("listing_shares").insert({ listing_id: listingId, share_type: type } as never);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "flexible";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}

export function buildGroupMeText(l: Listing, campusName?: string | null): string {
  const bedLabel = l.beds === 0 ? "Studio" : `${l.beds}BR`;
  const where = l.area ?? campusName ?? "near campus";
  const flags = [
    l.furnished ? "✓ Furnished" : "",
    l.utilities_included ? "✓ Utilities included" : "",
  ].filter(Boolean).join("  ");
  const url = buildShareUrl(l.id, "groupme");
  return `🏠 Sublease available${campusName ? ` at ${campusName}` : ""}!

${l.title}
📍 ${where}
💰 $${l.price}/mo
🛏️ ${bedLabel}/${l.baths}BA
📅 ${fmtDate(l.available_from)} – ${fmtDate(l.available_to)}
${flags ? flags + "\n" : ""}
Message me or check it out: ${url}

Posted on LeaseUp 🔗 leasup.co`;
}

export async function shareListingNative(l: Listing, campusName?: string | null) {
  const url = buildShareUrl(l.id, "native");
  const text = `${l.title} — $${l.price}/mo${campusName ? ` at ${campusName}` : ""}. Available ${fmtDate(l.available_from)}.`;
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title: "LeaseUp — Student Sublease", text, url });
      logShare(l.id, "native");
      return;
    }
  } catch {
    // user cancelled — do not log or fall through
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    logShare(l.id, "copy");
    toast.success("Link copied to clipboard!");
  } catch {
    toast.error("Couldn't copy link");
  }
}

export async function copyGroupMe(l: Listing, campusName?: string | null) {
  const text = buildGroupMeText(l, campusName);
  try {
    await navigator.clipboard.writeText(text);
    logShare(l.id, "groupme");
    toast.success("Copied! Paste into GroupMe.");
  } catch {
    toast.error("Couldn't copy — try again");
  }
}

// Legacy shim — keep existing imports working.
export async function shareListing(opts: { title: string; price?: number | string; id: string }) {
  const url = buildShareUrl(opts.id, "native");
  const text = opts.price != null ? `$${opts.price}/mo — ${opts.title} on LeaseUp` : opts.title;
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title: opts.title, text, url });
      logShare(opts.id, "native");
      return;
    }
  } catch { /* cancelled */ return; }
  try {
    await navigator.clipboard.writeText(url);
    logShare(opts.id, "copy");
    toast.success("Link copied!");
  } catch { toast.error("Couldn't copy link"); }
}
