import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Listing } from "@/lib/leaseup/types";
import { BadgeCheck, Bed, Bath, MapPin, Calendar, Share2, MessageSquare, Phone, Flag, Eye, Heart as HeartIcon, MessageCircle, Clock } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSession } from "@/lib/leaseup/use-session";
import { SafeScoreBadge } from "./SafeScoreBadge";
import { SafeScoreGauge } from "./SafeScoreGauge";
import { CountUp } from "./CountUp";
import { ReportListingDialog } from "./ReportListingDialog";
import { ShareToStoryButton } from "./ShareToStoryButton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fetchListings } from "@/lib/leaseup/queries";
import { cn } from "@/lib/utils";
import { ReactionBar } from "./ReactionBar";
import { SecureDepositDialog } from "./SecureDepositDialog";
import { SecureDepositBadge } from "./SecureDepositBadge";
import { TourBookingPanel } from "./TourBookingPanel";
import { PriceComparisonPanel } from "./PriceComparisonPanel";
import { PriceLabelBadge } from "./PriceLabelBadge";
import { Lock } from "lucide-react";


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
  const [reportOpen, setReportOpen] = useState(false);
  const [views, setViews] = useState<number | null>(null);
  const [saveCount, setSaveCount] = useState<number>(0);
  const [msgCount, setMsgCount] = useState<number>(0);
  const [depositOpen, setDepositOpen] = useState(false);
  const { user } = useSession();

  useEffect(() => {
    if (!open || !listing) return;
    setActivePhoto(0);
    setViews(listing.view_count ?? null);
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
        const sav = await supabase.from("saved_listings").select("listing_id", { count: "exact", head: true }).eq("listing_id", listing.id);
        setSaveCount(sav.count ?? 0);
        const convs = await supabase.from("conversations").select("id").eq("listing_id", listing.id);
        const convIds = (convs.data ?? []).map((c: any) => c.id);
        if (convIds.length === 0) { setMsgCount(0); return; }
        const msg = await supabase.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", convIds);
        setMsgCount(msg.count ?? 0);
      } catch { /* ignore */ }
    })();
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

  const priceBar = useMemo(() => {
    if (!listing || comps.length < 3) return null;
    const prices = comps.map(c => c.price).concat(listing.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const pct = max === min ? 50 : ((listing.price - min) / (max - min)) * 100;
    const below = ((avg - listing.price) / avg) * 100;
    return { min, max, avg, pct, below };
  }, [comps, listing]);

  const alsoSaved = useMemo(() => {
    if (!listing) return [] as Listing[];
    return allListings
      .filter(l => l.id !== listing.id && l.campus_id === listing.campus_id)
      .sort((a, b) => Math.abs(a.price - listing.price) - Math.abs(b.price - listing.price))
      .slice(0, 6);
  }, [allListings, listing]);

  if (!listing) return null;
  const photos = listing.photo_urls ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0 pb-24">

        <SheetHeader className="sr-only"><SheetTitle>{listing.title}</SheetTitle></SheetHeader>

        {/* Photo gallery — horizontal snap-scroll, no photos = gradient placeholder */}
        <div className="relative bg-muted">
          {photos.length > 0 ? (
            <div
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
                  className="h-full w-full flex-shrink-0 snap-start object-cover"
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

          {/* Save heart — top-right overlay */}
          {onSave && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSave(listing); }}
              aria-label={isSaved ? "Unsave listing" : "Save listing"}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
            >
              <HeartIcon
                className={cn("h-5 w-5", isSaved ? "fill-red-500 text-red-500" : "text-foreground/70")}
              />
            </button>
          )}
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {photos.map((p, i) => (
              <button key={i} onClick={() => setActivePhoto(i)} className={`h-16 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 ${i === activePhoto ? "border-primary" : "border-transparent"}`}>
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
                {listing.profile?.verified_email && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-success">
                    <BadgeCheck className="h-4 w-4" />Verified
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-extrabold">{listing.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />{listing.area ?? "Near campus"}
                <SafeScoreBadge score={listing.safe_score} />
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
            </div>
          </div>

          {/* Social-proof stats row */}
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
            <Stat icon={<Eye className="h-3.5 w-3.5" />} value={<CountUp value={views ?? 0} />} label="views" />
            <Stat icon={<HeartIcon className="h-3.5 w-3.5" />} value={<CountUp value={saveCount} />} label="saves" />
            <Stat icon={<MessageCircle className="h-3.5 w-3.5" />} value={<CountUp value={msgCount} />} label="messages" />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} value={daysAgo(listing.created_at)} label="posted" />
          </div>

          {/* Emoji reactions */}
          <ReactionBar listingId={listing.id} />



          {/* SafeScore animated gauge */}
          <div className="flex items-center gap-4 rounded-xl border bg-background p-3">
            <SafeScoreGauge score={listing.safe_score} />
            <ul className="flex-1 space-y-1 text-xs text-muted-foreground">
              {(listing.photo_urls?.length ?? 0) >= 3 && <li>✓ {listing.photo_urls!.length} photos</li>}
              {listing.profile?.verified_email && <li>✓ .edu verified poster</li>}
              {listing.available_from && listing.available_to && <li>✓ Exact dates listed</li>}
              {listing.description && listing.description.length >= 200 && <li>✓ Detailed description</li>}
              {!listing.profile?.verified_email && <li>⚠ Poster not .edu verified</li>}
            </ul>
          </div>

          {/* Price comparison panel — powered by campus_price_stats view */}
          <PriceComparisonPanel price={listing.price} campusId={listing.campus_id ?? null} beds={listing.beds} />

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
            <div><Calendar className="mx-auto h-5 w-5 text-primary" /><div className="mt-1 font-bold">{listing.available_from ? new Date(listing.available_from).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}</div></div>
          </div>


          <div className="grid grid-cols-2 gap-2 text-xs">
            <Fact label="Available from" value={listing.available_from ? new Date(listing.available_from).toLocaleDateString() : "—"} />
            <Fact label="Available until" value={listing.available_to ? new Date(listing.available_to).toLocaleDateString() : "—"} />
            <Fact label="Furnished" value={listing.furnished ? "Yes" : "No"} />
            <Fact label="Utilities" value={listing.utilities_included ? "Included" : "Separate"} />
            <Fact label="Pets" value={listing.pet_friendly ? "Allowed" : "No pets"} />
            <Fact label="Parking" value={listing.parking ? "Yes" : "No"} />
          </div>

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
                  {listing.profile.name}
                  {listing.profile.verified_email && <BadgeCheck className="h-4 w-4 text-success" />}
                </div>
                <div className="text-xs text-muted-foreground">
                  {listing.profile.year ?? "Student"}{listing.profile.major ? ` · ${listing.profile.major}` : ""}
                </div>
              </div>
              <span className="text-xs font-semibold text-primary">View profile</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                if (!user) { toast.error("Sign in to message"); return; }
                onMessage(listing);
              }}
              className="bg-primary hover:bg-primary-dark text-primary-foreground gap-2"
            >
              <MessageSquare className="h-4 w-4" />Message
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!user) { toast.error("Sign in to see contact"); return; }
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
        </div>
      </SheetContent>
      <ReportListingDialog open={reportOpen} onOpenChange={setReportOpen} listingId={listing.id} />
      <SecureDepositDialog listing={listing} open={depositOpen} onOpenChange={setDepositOpen} />
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

