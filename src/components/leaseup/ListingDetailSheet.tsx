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


export function ListingDetailSheet({
  listing, open, onOpenChange, onMessage, onViewProfile,
}: {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMessage: (listing: Listing) => void;
  onViewProfile: (userId: string) => void;
}) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [views, setViews] = useState<number | null>(null);
  const [saveCount, setSaveCount] = useState<number>(0);
  const [msgCount, setMsgCount] = useState<number>(0);
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
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">

        <SheetHeader className="sr-only"><SheetTitle>{listing.title}</SheetTitle></SheetHeader>

        <div className="relative aspect-[16/10] bg-muted">
          {photos[activePhoto] ? (
            <img src={photos[activePhoto]} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-6xl">🏠</div>
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

          {/* Price comparison bar */}
          {priceBar && (
            <div className="rounded-xl border bg-background p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-bold uppercase text-muted-foreground">{listing.beds}BR range nearby</span>
                {priceBar.below > 5 ? (
                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 font-bold text-orange-600">🔥 {Math.round(priceBar.below)}% below avg</span>
                ) : priceBar.below < -5 ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-bold text-muted-foreground">{Math.round(-priceBar.below)}% above avg</span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-bold text-muted-foreground">Around avg</span>
                )}
              </div>
              <div className="relative h-2 rounded-full bg-muted">
                <div
                  className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-primary shadow"
                  style={{ left: `${Math.max(2, Math.min(98, priceBar.pct))}%`, transition: "left 600ms ease-out" }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>${Math.round(priceBar.min)}</span>
                <span className="font-bold text-foreground">${listing.price.toLocaleString()} this listing</span>
                <span>${Math.round(priceBar.max)}</span>
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => {
                const url = `${window.location.origin}/?listing=${listing.id}`;
                navigator.clipboard.writeText(url);
                toast.success("Link copied");
              }}
              className="flex items-center gap-1.5 rounded-md py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            ><Share2 className="h-3.5 w-3.5" />Copy link</button>
            <ShareToStoryButton listing={listing} />
            <button
              onClick={() => { if (!user) { toast.error("Sign in to report"); return; } setReportOpen(true); }}
              className="flex items-center gap-1.5 rounded-md py-2 text-xs font-semibold text-muted-foreground hover:text-red-600"
            ><Flag className="h-3.5 w-3.5" />Report</button>
          </div>

          <p className="rounded-md bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
            Always visit the property in person before sending any payment. Never pay a deposit via Venmo, CashApp, or wire transfer without a signed agreement.
          </p>
        </div>
      </SheetContent>
      <ReportListingDialog open={reportOpen} onOpenChange={setReportOpen} listingId={listing.id} />
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
