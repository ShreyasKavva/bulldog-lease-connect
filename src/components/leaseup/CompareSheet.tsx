import type { Listing } from "@/lib/leaseup/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SafeScoreBadge } from "./SafeScoreBadge";
import { Check, X, BedDouble, Bath, MapPin, Calendar, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function YesNo({ v }: { v: boolean | null | undefined }) {
  return v ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground/50" />;
}

export function CompareSheet({
  listings,
  open,
  onOpenChange,
  onOpenListing,
  onRemove,
  onMessage,
}: {
  listings: Listing[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onOpenListing: (l: Listing) => void;
  onRemove: (id: string) => void;
  onMessage: (l: Listing) => void;
}) {
  // Determine the "best" value in each row for highlighting.
  const minPrice = Math.min(...listings.map(l => l.price));
  const minPerBed = Math.min(
    ...listings.map(l => (l.beds > 0 ? l.price / l.beds : Infinity)),
  );
  const maxScore = Math.max(...listings.map(l => l.safe_score ?? 0));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b bg-surface px-5 py-4">
          <SheetTitle>Compare {listings.length} listing{listings.length !== 1 ? "s" : ""}</SheetTitle>
          <p className="text-xs text-muted-foreground">Best value per row highlighted in green.</p>
        </SheetHeader>

        {listings.length === 0 ? (
          <div className="grid h-[60vh] place-items-center text-center">
            <div>
              <div className="text-5xl">⚖️</div>
              <p className="mt-2 text-sm text-muted-foreground">Pin listings with the compare icon to stack them here.</p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${listings.length}, minmax(220px, 1fr))` }}
            >
              {/* Photo + headline */}
              {listings.map(l => {
                const photo = l.photo_urls?.[0];
                const perBed = l.beds > 0 ? l.price / l.beds : Infinity;
                return (
                  <div key={l.id} className="rounded-xl border bg-surface shadow-card">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-muted">
                      {photo ? (
                        <img src={photo} alt={l.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-4xl">🏠</div>
                      )}
                      <button
                        onClick={() => onRemove(l.id)}
                        aria-label="Remove from compare"
                        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className={cn("text-xl font-extrabold", l.price === minPrice && "text-success")}>
                          ${l.price.toLocaleString()}<span className="text-[10px] font-medium text-muted-foreground">/mo</span>
                        </div>
                        <SafeScoreBadge score={l.safe_score ?? 0} />
                      </div>
                      <h3 className="line-clamp-2 text-sm font-bold leading-snug">{l.title}</h3>

                      <Row label={<><DollarSign className="h-3.5 w-3.5" /> Per bed</>} highlight={perBed === minPerBed}>
                        ${perBed === Infinity ? "—" : Math.round(perBed).toLocaleString()}/mo
                      </Row>
                      <Row label={<><BedDouble className="h-3.5 w-3.5" /> Beds</>}>{l.beds}</Row>
                      <Row label={<><Bath className="h-3.5 w-3.5" /> Baths</>}>{Number(l.baths)}</Row>
                      <Row label={<><MapPin className="h-3.5 w-3.5" /> Area</>}>{l.area ?? "—"}</Row>
                      <Row label={<><Calendar className="h-3.5 w-3.5" /> From</>}>{fmtDate(l.available_from)}</Row>
                      <Row label={<><Calendar className="h-3.5 w-3.5" /> Until</>}>{fmtDate(l.available_to)}</Row>
                      <Row label="SafeScore" highlight={(l.safe_score ?? 0) === maxScore}>{l.safe_score ?? 0}</Row>
                      <Row label="Furnished"><YesNo v={l.furnished} /></Row>
                      <Row label="Utilities incl."><YesNo v={l.utilities_included} /></Row>
                      <Row label="Pet friendly"><YesNo v={l.pet_friendly} /></Row>
                      <Row label="Parking"><YesNo v={l.parking} /></Row>
                      <Row label="Type">{l.type === "transfer" ? "Transfer" : "Sublease"}</Row>
                      <Row label="Poster">{l.profile?.name ?? "Student"}</Row>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => { onOpenChange(false); onOpenListing(l); }}
                          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted"
                        >
                          View
                        </button>
                        <button
                          onClick={() => { onOpenChange(false); onMessage(l); }}
                          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark"
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  children,
  highlight,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-2 border-t pt-1.5 text-xs",
      highlight && "text-success font-bold",
    )}>
      <span className="flex items-center gap-1 text-muted-foreground">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  );
}
