/**
 * Q100 — Share sheet for the listing detail page.
 *
 * Mobile: tries the Web Share API first. If unavailable (or on desktop) a
 * small popover with Copy link / WhatsApp / Email / iMessage rows opens
 * below the Share button. Sharing increments an anonymous share_count —
 * we never record *who* shared *what*.
 */
import { useEffect, useRef, useState } from "react";
import { Share2, Link2, Mail, MessageSquare, Check } from "lucide-react";
import { copyToClipboard, recordShare, withUtm } from "@/lib/leaseup/share";
import { cn } from "@/lib/utils";


export function ShareSheet({
  url,
  title,
  text,
  listingId,
  className,
}: {
  url: string;
  title: string;
  text: string;
  listingId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isApple =
    typeof navigator !== "undefined" && /iPhone|iPad|Mac/.test(navigator.userAgent);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onShareClick() {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const nav = window.navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (isMobile && typeof nav.share === "function") {
      try {
        await nav.share({ title, text, url: withUtm(url, "native_share") });
        recordShare(listingId);
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    setOpen((o) => !o);
  }

  async function onCopy() {
    const ok = await copyToClipboard(withUtm(url, "clipboard"));
    if (ok) {
      recordShare(listingId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  function openExternal(href: string) {
    recordShare(listingId);
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  const shareUrl = withUtm(url, "clipboard");
  const rowClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-muted";

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={onShareClick}
        aria-label="Share listing"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-semibold shadow-sm transition active:scale-95"
      >
        <Share2 className="h-4 w-4" /> Share
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 max-w-xs rounded-2xl border border-gray-100 bg-white p-2 shadow-xl dark:border-border dark:bg-surface">
          <button type="button" onClick={onCopy} className={rowClass}>
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Link2 className="h-4 w-4 text-muted-foreground" />
            )}
            {copied ? "✓ Copied!" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() =>
              openExternal(
                `mailto:?subject=${encodeURIComponent("Check out this sublease on LeaseUp")}&body=${encodeURIComponent(`I found a sublease you might like: ${shareUrl}`)}`,
              )
            }
            className={rowClass}
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email
          </button>
          {isApple && (
            <button
              type="button"
              onClick={() =>
                openExternal(`sms:?body=${encodeURIComponent(`Check out this sublease: ${shareUrl}`)}`)
              }
              className={cn(rowClass, "md:hidden")}
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              iMessage
            </button>
          )}
        </div>
      )}
    </div>
  );
}
