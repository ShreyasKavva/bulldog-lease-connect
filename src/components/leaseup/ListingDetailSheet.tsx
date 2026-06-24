import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Listing } from "@/lib/leaseup/types";
import { BadgeCheck, Bed, Bath, MapPin, Calendar, Share2, MessageSquare, Phone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSession } from "@/lib/leaseup/use-session";

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
  const { user } = useSession();
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
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />{listing.area ?? "Athens, GA"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-primary">${listing.price.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">per month</div>
            </div>
          </div>

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

          <button
            onClick={() => {
              const url = `${window.location.origin}/?listing=${listing.id}`;
              navigator.clipboard.writeText(url);
              toast.success("Link copied");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          ><Share2 className="h-3.5 w-3.5" />Share listing</button>

          <p className="rounded-md bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
            Always visit the property in person before sending any payment. Never pay a deposit via Venmo, CashApp, or wire transfer without a signed agreement.
          </p>
        </div>
      </SheetContent>
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
