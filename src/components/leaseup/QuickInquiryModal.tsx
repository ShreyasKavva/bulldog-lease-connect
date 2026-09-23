/**
 * QuickInquiryModal — Q162. Express inquiry sheet fired from any
 * "💬 Message" quick action outside the full detail sheet.
 *
 * Mounted once in __root.tsx; open it from anywhere with
 * `openQuickInquiry(listing)`.
 */
import { useEffect, useMemo, useState } from "react";
import { friendlyError } from "@/lib/leaseup/friendly-error";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/leaseup/use-session";
import { getOrCreateConversation, sendMessage } from "@/lib/leaseup/queries";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { openSignIn } from "./SignInModal";
import type { Listing } from "@/lib/leaseup/types";

const EVENT = "lu:quick-inquiry";

/** Fire from anywhere to open the express inquiry modal. */
export function openQuickInquiry(listing: Listing) {
  if (typeof window === "undefined" || !listing?.id) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { listing } }));
}

function defaultBody(title: string, campus: string) {
  return `Hi! I saw your sublease on LeaseUp and I'm interested. Is ${title} still available? I'm looking for housing near ${campus}. Please let me know!`;
}

export function QuickInquiryModal() {
  const { user } = useSession();
  const [listing, setListing] = useState<Listing | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: campuses } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    enabled: !!listing,
    staleTime: 5 * 60_000,
  });

  const campusName = useMemo(() => {
    const c = (campuses ?? []).find((x) => x.id === listing?.campus_id);
    return c?.short_name || c?.name || "campus";
  }, [campuses, listing?.campus_id]);

  useEffect(() => {
    function onOpen(e: Event) {
      const l = (e as CustomEvent<{ listing: Listing }>).detail?.listing;
      if (l?.id) { setListing(l); setText(""); setBusy(false); }
    }
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!listing) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setListing(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [listing]);

  // Fill the default body once the campus name resolves (user edits win).
  useEffect(() => {
    if (!listing) return;
    setText((prev) => (prev ? prev : defaultBody(listing.title ?? "this place", campusName)));
  }, [listing, campusName]);

  if (!listing) return null;

  const photo = (listing.photo_urls?.length ? listing.photo_urls : listing.photos)?.[0] ?? null;
  const hostId = listing.user_id ?? null;
  const isOwn = !!user?.id && user.id === hostId;

  async function handleSend() {
    if (!user?.id || !hostId || !text.trim() || !listing) return;
    setBusy(true);
    try {
      const convId = await getOrCreateConversation(user.id, hostId, listing.id);
      await sendMessage(convId, user.id, hostId, text.trim(), listing.id);
      toast.success("Message sent");
      setListing(null);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't send message"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={() => setListing(null)}
      role="dialog"
      aria-modal="true"
      aria-label="Message the host"
    >
      <div
        className="w-full rounded-t-2xl bg-surface p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {photo ? (
            <img src={photo} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{listing.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ${listing.price?.toLocaleString?.() ?? listing.price}/mo · {campusName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setListing(null)}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!user ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Sign in to message this host.</p>
            <button
              type="button"
              onClick={() => {
                setListing(null);
                openSignIn(typeof window !== "undefined" ? window.location.pathname : undefined);
              }}
              className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Sign in to message
            </button>
          </div>
        ) : isOwn ? (
          <p className="mt-4 text-sm text-muted-foreground">This is your own listing.</p>
        ) : (
          <>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-4 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-indigo-500"
              placeholder="Write your message…"
            />
            <button
              type="button"
              disabled={busy || !text.trim() || !hostId}
              onClick={handleSend}
              className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send Message"}
            </button>
            <button
              type="button"
              onClick={() => setListing(null)}
              className="mt-2 w-full text-center text-xs text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
