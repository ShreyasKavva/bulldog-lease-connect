import { formatDay } from "@/lib/leaseup/dates";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Listing } from "@/lib/leaseup/types";
import { roommatePrefChips } from "@/lib/leaseup/roommate-prefs";
import { BadgeCheck, Bed, Bath, MapPin, Calendar, Share2, MessageSquare, Phone, Flag, Eye, Heart as HeartIcon, MessageCircle, Clock, ChevronLeft, ChevronRight, X as XIcon } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSession } from "@/lib/leaseup/use-session";
import { CountUp } from "./CountUp";
import { ReportListingDialog } from "./ReportListingDialog";
import { ShareToStoryButton } from "./ShareToStoryButton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchListings } from "@/lib/leaseup/queries";
import { posterName } from "@/lib/leaseup/display-name";
import { cn } from "@/lib/utils";
import { SecureDepositDialog } from "./SecureDepositDialog";
import { SecureDepositBadge } from "./SecureDepositBadge";
import { TourBookingPanel } from "./TourBookingPanel";
import { PriceLabelBadge } from "./PriceLabelBadge";
import { Lock } from "lucide-react";
import { haptic } from "@/lib/leaseup/haptics";
import { pushRecentView } from "@/lib/leaseup/recent-views";
import { isDemoListing } from "@/lib/leaseup/demo";
import { leaseTermLabel } from "@/lib/leaseup/lease-term";
import { PriceContextBadge } from "@/components/leaseup/PriceContextBadge";
import { CostCalculator } from "@/components/leaseup/CostCalculator";
import { ExpiryChip } from "@/components/leaseup/ExpiryChip";
import { hasSchoolEmail, SCHOOL_EMAIL_LINE, NO_SCHOOL_EMAIL_LINE } from "@/lib/leaseup/school-email";



export function ListingDetailSheet({
  listing, open, onOpenChange, onMessage, onViewProfile, onSave, isSaved,
}: {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMessage: (listing: Listing) => void;
  onViewProfile: (userId: string) => void;
  onSave?: (listing: Listing) => void;
  isSaved?: boolean;
}) {
  const [activePhoto, setActivePhoto] = useState(0);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [views, setViews] = useState<number | null>(null);
  const [saveCount, setSaveCount] = useState<number>(0);
  const [msgCount, setMsgCount] = useState<number>(0);
  const [depositOpen, setDepositOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { user } = useSession();
  const [statusSaving, setStatusSaving] = useState(false);
  const qc = useQueryClient();


  useEffect(() => {
    if (!open || !listing) return;
    setActivePhoto(0);
    setViews(listing.view_count ?? null);
    pushRecentView(listing.id);
    const key = `viewed:${listing.id}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      supabase.rpc("increment_listing_view" as any, { _listing_id: listing.id }).then(({ data }) => {
        if (typeof data === "number") setViews(data);
      });
    }
    // Load social proof counts
    (async () => {
      try {
        const sav = await supabase.from("saved_listing_counts" as any).select("save_count").eq("listing_id", listing.id).maybeSingle();
        setSaveCount(((sav.data as any)?.save_count as number | undefined) ?? 0);
        const convs = await supabase.from("conversations").select("id").eq("listing_id", listing.id);
        const convIds = (convs.data ?? []).map((c: any) => c.id);
        if (convIds.length === 0) { setMsgCount(0); return; }
        const msg = await supabase.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", convIds);
        setMsgCount(msg.count ?? 0);
      } catch { /* ignore */ }
    })();
  }, [open, listing]);

  /** Q141 — dynamic tab title + share meta while the slide-out is open. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!open || !listing) return;

    const setMeta = (sel: string, attr: string, name: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const prevTitle = document.title;
    const prevDesc =
      document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";
    const prevOgTitle =
      document.head.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? "";
    const prevOgDesc =
      document.head.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ?? "";
    const prevOgUrl =
      document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content ?? "";

    const bedLabel = listing.beds === 0 ? "Studio" : `${listing.beds}BR`;
    const where = listing.area ?? "";
    const avail = listing.available_from
      ? new Date(listing.available_from).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "";
    const title = `${listing.title} — $${Number(listing.price).toLocaleString("en-US")}/mo · LeaseUp`;
    const desc = [bedLabel, where, avail && `Available ${avail}`, "LeaseUp"]
      .filter(Boolean)
      .join(" · ");

    document.title = title;
    setMeta('meta[name="description"]', "name", "description", desc);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", desc);
    setMeta('meta[property="og:url"]', "property", "og:url", `https://leasup.co/listing/${listing.id}`);

    return () => {
      if (prevTitle) document.title = prevTitle;
      if (prevDesc) setMeta('meta[name="description"]', "name", "description", prevDesc);
      if (prevOgTitle) setMeta('meta[property="og:title"]', "property", "og:title", prevOgTitle);
      if (prevOgDesc) setMeta('meta[property="og:description"]', "property", "og:description", prevOgDesc);
      if (prevOgUrl) setMeta('meta[property="og:url"]', "property", "og:url", prevOgUrl);
    };
  }, [open, listing]);


  // Comp listings (same campus, ±1 bed)
  const { data: allListings = [] } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchListings,
    enabled: open,
    staleTime: 60_000,
  });

  const comps = useMemo(() => {
    if (!listing) return [] as Listing[];
    return allListings.filter(l =>
      l.id !== listing.id && l.campus_id === listing.campus_id && Math.abs(l.beds - listing.beds) <= 0
    );
  }, [allListings, listing]);

  const alsoSaved = useMemo(() => {
    if (!listing) return [] as Listing[];
    return allListings
      .filter(l => l.id !== listing.id && l.campus_id === listing.campus_id)
      .sort((a, b) => Math.abs(a.price - listing.price) - Math.abs(b.price - listing.price))
      .slice(0, 6);
  }, [allListings, listing]);

  /** Q166 — up to 4 other active listings at the same campus, most viewed first. */
  const moreAtCampus = useMemo(() => {
    if (!listing) return [] as Listing[];
    return allListings
      .filter((l) => l.id !== listing.id && l.campus_id === listing.campus_id && (l.status ?? "active") === "active")
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
      .slice(0, 4);
  }, [allListings, listing]);



  const { data: hostProfile } = useQuery({
    queryKey: ["public-profile", listing?.user_id],
    enabled: open && !!listing?.user_id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_profile" as any, { _uid: listing!.user_id });
      return (data ?? null) as {
        name?: string | null; avatar_url?: string | null; verified_email?: boolean | null;
        created_at?: string | null; campus_name?: string | null; active_listing_count?: number | null;
      } | null;
    },
  });

  if (!listing) return null;
  const photos = listing.photo_urls ?? [];
  const hostDisplayName = (listing as Listing & { host?: { display_name?: string | null } }).host?.display_name;
  const host = hostProfile;
  const prefChips = roommatePrefChips((listing as Listing & { roommate_prefs?: unknown }).roommate_prefs);
  const hostName = posterName({ display_name: listing.display_name, profile: host as any, host: { display_name: hostDisplayName } }, "Host");
  const otherActive = Math.max(0, (host?.active_listing_count ?? 0) - 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0 pb-24">

        <SheetHeader className="sr-only"><SheetTitle>{listing.title}</SheetTitle></SheetHeader>

        {/* View full page link — shareable URL */}
        <a
          href={`/listing/${listing.id}`}
          onClick={() => onOpenChange(false)}
          className="absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-md backdrop-blur-sm transition hover:bg-white"
        >
          View full page →
        </a>

        {/* Photo gallery — horizontal snap-scroll, no photos = gradient placeholder */}
        <div className="relative bg-muted">
          {photos.length > 0 ? (
            <div
              ref={galleryRef}
              className="flex aspect-[16/10] snap-x snap-mandatory overflow-x-auto scroll-smooth"
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / el.clientWidth);
                if (i !== activePhoto) setActivePhoto(i);
              }}
            >
              {photos.map((p, i) => (
                <img
                  key={i}
                  src={p}
                  alt={`${listing.title} — photo ${i + 1}`}
                  onClick={() => setLightboxIndex(i)}
                  className="h-full w-full flex-shrink-0 cursor-zoom-in snap-start object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="grid aspect-[16/10] w-full place-items-center bg-gradient-to-br from-primary/20 via-primary-light to-primary/10 text-7xl">
              🏠
            </div>
          )}

          {/* Photo X of Y counter */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {activePhoto + 1} / {photos.length}
            </div>
          )}

          {/* Save + Share — top-right overlay */}
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            {onSave && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); haptic("light"); onSave(listing); }}
                aria-label={isSaved ? "Unsave listing" : "Save listing"}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
              >
                <HeartIcon
                  className={cn("h-5 w-5", isSaved ? "fill-red-500 text-red-500" : "text-foreground/70")}
                />
              </button>
            )}
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                // Q135 — always copy the canonical listing URL, not the current page.
                const origin =
                  typeof window !== "undefined" ? window.location.origin : "https://leasup.co";
                const url = `${origin}/listing/${listing.id}`;
                try {
                  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(url);
                    toast.success("Link copied! 🔗");
                  } else if (typeof navigator !== "undefined" && (navigator as any).share) {
                    await (navigator as any).share({ title: listing.title, url });
                  }
                } catch { /* user cancelled or clipboard blocked */ }
              }}

              aria-label="Share listing"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
            >
              <Share2 className="h-4 w-4 text-foreground/70" />
            </button>
          </div>
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {photos.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  setActivePhoto(i);
                  const el = galleryRef.current;
                  if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                }}
                className={`h-16 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 ${i === activePhoto ? "border-primary" : "border-transparent"}`}
              >
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white ${listing.type === "transfer" ? "bg-success" : "bg-foreground/80"}`}>
                  {listing.type === "transfer" ? "Lease Transfer" : "Sublease"}
                </span>
                {hasSchoolEmail(listing.profile) && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-success">
                    <BadgeCheck className="h-4 w-4" />{SCHOOL_EMAIL_LINE}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-extrabold">{listing.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />{listing.area ?? "Near campus"}
                {views !== null && views > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">
                    <Eye className="h-3 w-3" />{views} {views === 1 ? "view" : "views"}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-primary">${listing.price.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">per month</div>
              <div className="mt-1">
                <PriceContextBadge price={listing.price} campusId={listing.campus_id} listingId={listing.id} />
              </div>
            </div>

          </div>

          {/* Q155 — lease term pill */}
          {leaseTermLabel(listing.available_from, listing.available_to) && (
            <div>
              <span className="inline-block rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                {leaseTermLabel(listing.available_from, listing.available_to)}
              </span>
            </div>
          )}


          {/* Social-proof stats row — Q174-FIX: zero counts are never shown */}
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
            {(views ?? 0) > 0 && (
              <Stat icon={<Eye className="h-3.5 w-3.5" />} value={<CountUp value={views ?? 0} />} label={(views ?? 0) === 1 ? "view" : "views"} />
            )}
            {saveCount > 0 && (
              <Stat icon={<HeartIcon className="h-3.5 w-3.5" />} value={<CountUp value={saveCount} />} label={saveCount === 1 ? "save" : "saves"} />
            )}
            {msgCount > 0 && (
              <Stat icon={<MessageCircle className="h-3.5 w-3.5" />} value={<CountUp value={msgCount} />} label={msgCount === 1 ? "message" : "messages"} />
            )}
            <Stat icon={<Clock className="h-3.5 w-3.5" />} value={daysAgo(listing.created_at)} label="posted" />
          </div>





          <div className="flex items-center gap-4 rounded-xl border bg-background p-3">
            <ul className="flex-1 space-y-1 text-xs text-muted-foreground">
              {(listing.photo_urls?.length ?? 0) >= 3 && <li>✓ {listing.photo_urls!.length} photos</li>}
              {hasSchoolEmail(listing.profile) && <li>✓ {SCHOOL_EMAIL_LINE}</li>}
              {listing.available_from && listing.available_to && <li>✓ Exact dates listed</li>}
              {listing.description && listing.description.length >= 200 && <li>✓ Detailed description</li>}
              {!hasSchoolEmail(listing.profile) && <li>⚠ {NO_SCHOOL_EMAIL_LINE}</li>}
            </ul>
          </div>


          {/* Similar listings */}
          {comps.length > 0 && (
            <div className="rounded-xl border bg-background p-3 text-xs">
              <div className="mb-2 font-bold uppercase text-muted-foreground">Similar listings</div>
              <div className="space-y-1.5">
                {[...comps].sort((a, b) => Math.abs(a.price - listing.price) - Math.abs(b.price - listing.price)).slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-bold">{c.title}</span>
                      <span className="text-muted-foreground"> · {c.beds}BR · ${c.price}/mo</span>
                    </div>
                    <PriceLabelBadge price={c.price} campusId={c.campus_id ?? null} beds={c.beds} size="xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 rounded-xl bg-background p-3 text-center text-xs">
            <div><Bed className="mx-auto h-5 w-5 text-primary" /><div className="mt-1 font-bold">{listing.beds} bed</div></div>
            <div><Bath className="mx-auto h-5 w-5 text-primary" /><div className="mt-1 font-bold">{Number(listing.baths)} bath</div></div>
            <div><Calendar className="mx-auto h-5 w-5 text-primary" /><div className="mt-1 font-bold">{formatDay(listing.available_from) ?? "—"}</div></div>
          </div>


          <div className="grid grid-cols-2 gap-2 text-xs">
            <Fact label="Available from" value={formatDay(listing.available_from) ?? "—"} />
            <Fact label="Available until" value={formatDay(listing.available_to) ?? "—"} />
            <Fact label="Furnished" value={listing.furnished ? "Yes" : "No"} />
            <Fact label="Utilities" value={listing.utilities_included ? "Included" : "Separate"} />
            <Fact label="Pets" value={listing.pet_friendly ? "Allowed" : "No pets"} />
            <Fact label="Parking" value={listing.parking ? "Yes" : "No"} />
          </div>

          {/* Q164 — cost estimator */}
          <CostCalculator
            price={listing.price}
            availableFrom={listing.available_from}
            availableTo={listing.available_to}
          />

          {/* Q165 — availability urgency */}
          <ExpiryChip availableTo={listing.available_to} price={listing.price} />


          {listing.description && (
            <div>
              <h3 className="mb-1 text-sm font-bold uppercase text-muted-foreground">Description</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{listing.description}</p>
            </div>
          )}

          {(listing.amenities?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase text-muted-foreground">Amenities</h3>
              <div className="flex flex-wrap gap-1.5">
                {listing.amenities!.map((a) => (
                  <span key={a} className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">{a}</span>
                ))}
              </div>
            </div>
          )}

          {listing.profile && (
            <button
              onClick={() => onViewProfile(listing.user_id)}
              className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-background"
            >
              <div className="grid h-12 w-12 place-items-center rounded-full text-xl" style={{ background: listing.profile.banner_color ?? "#2563EB" }}>
                {listing.profile.avatar_emoji ?? "🙂"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1 font-bold">
                  {posterName(listing)}
                  {listing.profile.verified_email && <BadgeCheck className="h-4 w-4 text-success" />}
                </div>
                <div className="text-xs text-muted-foreground">
                  {listing.profile.year ?? "Student"}{listing.profile.major ? ` · ${listing.profile.major}` : ""}
                </div>
              </div>
              <span className="text-xs font-semibold text-primary">View profile</span>
            </button>
          )}

          {/* Q174-FIX — demo-account warning, shown before the Message action */}
          {isDemoListing(listing.user_id) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              🧪 Sample listing — this one is posted by the LeaseUp demo account, so don't expect a reply.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onMessage(listing)}
              className="bg-primary hover:bg-primary-dark text-primary-foreground gap-2"
            >
              <MessageSquare className="h-4 w-4" />Message
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!user) { onMessage(listing); return; }
                if (listing.profile?.phone) toast.success(`📞 ${listing.profile.phone}`);
                else toast(`✉️ ${listing.profile?.email ?? "Use Message instead"}`);
              }}
              className="gap-2"
            ><Phone className="h-4 w-4" />Contact</Button>
          </div>
          <TourBookingPanel listing={listing} />


          {listing.deposit_escrow_enabled && listing.deposit_amount ? (
            <div className="rounded-xl border-2 border-success/40 bg-success-light/30 p-3">
              <div className="flex items-center gap-2 text-sm font-bold"><SecureDepositBadge /> ${listing.deposit_amount.toLocaleString()} refundable deposit</div>
              <p className="mt-1 text-xs text-muted-foreground">Funds are held by LeaseUp until move-in. Protects both sides.</p>
              {user && user.id !== listing.user_id && (
                <Button
                  onClick={() => setDepositOpen(true)}
                  className="mt-2 h-10 w-full bg-success font-bold text-white hover:bg-success/90"
                >
                  <Lock className="mr-1.5 h-4 w-4" />Pay deposit securely
                </Button>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <ShareToStoryButton listing={listing} label="Share to Story" />
            <button
              onClick={() => { if (!user) { toast.error("Sign in to report"); return; } setReportOpen(true); }}
              className="flex items-center gap-1.5 rounded-md py-2 text-xs font-semibold text-muted-foreground hover:text-red-600"
            ><Flag className="h-3.5 w-3.5" />Report</button>
          </div>

          {alsoSaved.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase text-muted-foreground">Students also saved →</h3>
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {alsoSaved.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { onOpenChange(false); setTimeout(() => window.dispatchEvent(new CustomEvent("lu:open-listing", { detail: l.id })), 50); }}
                    className="group relative h-28 w-40 flex-shrink-0 overflow-hidden rounded-lg bg-muted shadow-card"
                  >
                    {l.photo_urls?.[0] ? (
                      <img src={l.photo_urls[0]} alt="" className="lu-card-img h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-3xl">🏠</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-left">
                      <div className="text-sm font-bold text-white">${l.price.toLocaleString()}<span className="text-[10px] font-medium">/mo</span></div>
                      <div className="line-clamp-1 text-[10px] text-white/80">{l.beds}bd · {l.area ?? "Near campus"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="rounded-md bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
            Always visit the property in person before sending any payment. Never pay a deposit via Venmo, CashApp, or wire transfer without a signed agreement.
          </p>

          {/* Q166 — social proof row */}
          {((views ?? 0) > 0 || saveCount > 0 || msgCount > 0) && (() => {
            const items = [
              (views ?? 0) > 0 ? `👁 ${views} views` : null,
              saveCount > 0 ? `❤️ ${saveCount} saves` : null,
              msgCount > 0 ? `💬 ${msgCount} inquiries` : null,
            ].filter(Boolean) as string[];
            return (
              <div className="mt-2 flex items-center gap-3 border-t border-gray-100 py-2.5 text-xs text-gray-500 dark:border-border dark:text-muted-foreground">
                {items.map((t, i) => (
                  <span key={t} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-300">·</span>}
                    {t}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Host profile card */}

          <button
            type="button"
            onClick={() => onViewProfile(listing.user_id)}
            className="flex w-full items-center gap-3 rounded-xl border bg-muted/40 p-3 text-left transition hover:bg-muted/60"
          >
            {host?.avatar_url ? (
              <img src={host.avatar_url} alt={hostName} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {hostName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-bold text-foreground">{hostName}</span>
                {(host?.verified_email ?? listing.profile?.verified_email) && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                    <BadgeCheck className="h-3 w-3" /> School email
                  </span>
                )}
              </div>
              {host?.created_at && (
                <div className="text-[11px] text-muted-foreground">
                  Member since {new Date(host.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </div>
              )}
              {otherActive > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  {otherActive} other listing{otherActive === 1 ? "" : "s"}
                  {host?.campus_name ? ` near ${host.campus_name}` : ""}
                </div>
              )}
            </div>
          </button>

          {/* Q145 — roommate preferences */}
          {prefChips.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold">Roommate preferences</h3>
              <div className="flex flex-wrap gap-2">
                {prefChips.map((c) => (
                  <span key={c} className="rounded-full bg-gray-50 px-3 py-1 text-sm text-gray-600 dark:bg-muted dark:text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}



          {/* Q166 — More near [campus] */}
          {moreAtCampus.length > 0 && (
            <div>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-700 dark:text-muted-foreground">
                🏘 More near {host?.campus_name ?? "this campus"}
              </h3>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {moreAtCampus.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { onOpenChange(false); setTimeout(() => window.dispatchEvent(new CustomEvent("lu:open-listing", { detail: l.id })), 50); }}
                    className="w-44 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-surface text-left transition hover:shadow-md dark:border-border"
                  >
                    <div className="h-28 w-full bg-muted">
                      {l.photo_urls?.[0] ? (
                        <img src={l.photo_urls[0]} alt="" loading="lazy" className="h-28 w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-2xl">🏠</div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-sm font-extrabold text-foreground">
                        ${l.price.toLocaleString()}<span className="text-[10px] font-medium text-muted-foreground">/mo</span>
                      </div>
                      <div className="truncate text-xs font-semibold text-foreground">{l.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {l.available_from
                          ? `From ${formatDay(l.available_from)}`
                          : (l.area ?? "Near campus")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sticky action footer — Q152 save/copy row above the primary CTA */}
        <div
          className="sticky bottom-0 left-0 right-0 z-10 space-y-2 border-t bg-surface/95 p-3 backdrop-blur md:relative md:bottom-auto"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <div className="flex gap-2">
            {onSave && (
              <button
                type="button"
                onClick={() => { haptic("light"); onSave(listing); }}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 text-sm font-semibold transition hover:bg-background dark:border-border"
              >
                <HeartIcon className={cn("h-4 w-4", isSaved ? "fill-red-500 text-red-500" : "text-foreground/70")} />
                {isSaved ? "Saved" : "Save"}
              </button>
            )}
          </div>

          {/* Q156 — share row: copy / WhatsApp / email */}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                const origin = typeof window !== "undefined" ? window.location.origin : "https://leasup.co";
                try {
                  await navigator.clipboard.writeText(`${origin}/listing/${listing.id}`);
                  toast.success("Copied!");
                } catch { toast.error("Couldn't copy link"); }
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              📋 Copy link
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent("Check out this sublease on LeaseUp: ")}${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : "https://leasup.co"}/listing/${listing.id}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              📱 WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent("Sublease on LeaseUp")}&body=${encodeURIComponent(`Hey! Found this sublease you might like: ${typeof window !== "undefined" ? window.location.origin : "https://leasup.co"}/listing/${listing.id}`)}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              📧 Email
            </a>
          </div>

          {user?.id !== listing.user_id && (
            <Button
              onClick={() => onMessage(listing)}
              className="h-12 w-full gap-2 bg-[#FF5A5F] text-white font-bold text-sm hover:bg-[#e04e53]"
            >
              <MessageSquare className="h-4 w-4" />
              Message {hostDisplayName || "Host"} →
            </Button>
          )}

          {/* Q153 — host-only lifecycle control */}
          {user?.id === listing.user_id && (
            <Button
              variant="outline"
              disabled={statusSaving}
              onClick={async () => {
                const isActive = (listing.status ?? "active") === "active";
                if (isActive && !window.confirm("Mark this listing as taken? It will be hidden from browse.")) return;
                setStatusSaving(true);
                const { error } = await supabase
                  .from("listings")
                  .update({ status: isActive ? "taken" : "active" })
                  .eq("id", listing.id);
                setStatusSaving(false);
                if (error) { toast.error("Couldn't update listing"); return; }
                toast.success(isActive ? "Listing marked as taken ✓" : "Listing reactivated ✓");
                qc.invalidateQueries({ queryKey: ["listings"] });
                onOpenChange(false);
              }}
              className="h-12 w-full font-bold text-sm"
            >
              {(listing.status ?? "active") === "active" ? "✅ Mark as taken" : "🔄 Reactivate listing"}
            </Button>
          )}
        </div>


      </SheetContent>
      <ReportListingDialog open={reportOpen} onOpenChange={setReportOpen} listingId={listing.id} />
      <SecureDepositDialog listing={listing} open={depositOpen} onOpenChange={setDepositOpen} />
      {lightboxIndex !== null && photos.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <XIcon className="h-5 w-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                aria-label="Previous"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length); }}
                className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                aria-label="Next"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % photos.length); }}
                className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <img
            src={photos[lightboxIndex]}
            alt={`${listing.title} — photo ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
          {photos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              {lightboxIndex + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-2.5">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs">
      <span className="text-primary">{icon}</span>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

