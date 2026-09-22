import { supabase } from "@/integrations/supabase/client";
import { formatDateRange } from "@/lib/leaseup/dates";
import { toast } from "sonner";

export type ShareSource = "groupme" | "discord" | "native_share" | "clipboard";
const MEDIUM: Record<ShareSource, string> = {
  groupme: "share_button",
  discord: "copy_button",
  native_share: "web_share_api",
  clipboard: "copy_url",
};

export function withUtm(url: string, source: ShareSource, campaign = "listing_share"): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://leasup.co");
    u.searchParams.set("utm_source", source);
    u.searchParams.set("utm_medium", MEDIUM[source]);
    u.searchParams.set("utm_campaign", campaign);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}utm_source=${source}&utm_medium=${MEDIUM[source]}&utm_campaign=${campaign}`;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

export type ShareListingInput = {
  title: string;
  price: number;
  beds: number;
  area?: string | null;
  campusShortName?: string | null;
  availableFrom?: string | null;
  availableTo?: string | null;
};

export function buildGroupMeText(l: ShareListingInput, url: string): string {
  const where = l.area ?? l.campusShortName ?? "";
  const range = l.availableFrom && l.availableTo
    ? (formatDateRange(l.availableFrom, l.availableTo) ?? "")
    : "";
  const parts = [`$${l.price}/mo`, where, range].filter(Boolean).join(" · ");
  const posted = `Posted by a student on LeaseUp`;
  return `${l.title} — ${parts}\n${posted}\n${url}`;
}

export function buildDiscordText(l: ShareListingInput, url: string): string {
  const bedStr = l.beds === 0 ? "Studio" : `${l.beds}BR`;
  const where = l.area ?? l.campusShortName ?? "";
  const range = l.availableFrom && l.availableTo
    ? `${fmtDate(l.availableFrom)}–${fmtDate(l.availableTo)}`
    : "";
  const line2 = ["📍 " + where, "🛏 " + bedStr, range && "📅 " + range].filter(Boolean).join(" · ");
  const verified = l.campusShortName
    ? `Verified ${l.campusShortName} student on LeaseUp`
    : `Verified student on LeaseUp`;
  return `**${l.title} — $${l.price}/mo**\n${line2}\n${verified}\n\n${url}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      window.prompt("Copy this", text);
      return true;
    } catch { return false; }
  }
}

const UA_MOBILE = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export async function shareToGroupMe(text: string) {
  if (UA_MOBILE()) {
    const href = `groupme://app/share?text=${encodeURIComponent(text)}`;
    let opened = false;
    const t = setTimeout(async () => {
      if (opened) return;
      const ok = await copyToClipboard(text);
      if (ok) toast("Text copied — paste into GroupMe");
    }, 1200);
    try {
      window.location.href = href;
      opened = true;
      window.addEventListener("blur", () => clearTimeout(t), { once: true });
    } catch {
      clearTimeout(t);
      const ok = await copyToClipboard(text);
      if (ok) toast("Text copied — paste into GroupMe");
    }
  } else {
    const ok = await copyToClipboard(text);
    if (ok) toast.success("Copied — paste into GroupMe");
  }
}

export async function shareToDiscord(text: string) {
  const ok = await copyToClipboard(text);
  if (ok) toast.success("Copied — paste into Discord");
}

export function recordShare(listingId: string | null | undefined) {
  if (!listingId) return;
  // Fire-and-forget
  supabase.rpc("increment_listing_share" as any, { _listing_id: listingId }).then(() => {}, () => {});
}
