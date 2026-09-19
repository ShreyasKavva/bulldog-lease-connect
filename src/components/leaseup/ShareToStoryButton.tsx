import { useEffect, useRef, useState } from "react";
import { Share2, Loader2, Copy, ImageDown, Download, RefreshCw, X, MessageSquare, Send } from "lucide-react";
import type { Listing } from "@/lib/leaseup/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { renderStoryGraphic } from "@/lib/leaseup/story-graphic";
import { buildShareUrl, copyGroupMe, shareListingNative } from "@/lib/share";


type Variant = "pill" | "icon" | "block";

export function ShareToStoryButton({
  listing,
  variant = "pill",
  label = "Share",
  className,
}: {
  listing: Listing;
  variant?: Variant;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const btnBase =
    variant === "icon"
      ? "grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30 active:scale-90"
      : variant === "block"
        ? "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary-dark active:scale-95"
        : "flex min-h-11 items-center gap-1.5 rounded-md py-2 text-xs font-semibold text-muted-foreground hover:text-foreground";

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label="Share listing"
        className={cn(btnBase, className)}
      >
        <Share2 className={variant === "icon" ? "h-6 w-6" : "h-3.5 w-3.5"} />
        {variant !== "icon" && <span>{label}</span>}
      </button>
      {open && <ShareListingSheet listing={listing} onClose={() => setOpen(false)} />}
    </>
  );
}

function logShare(listingId: string, type: "story_graphic" | "link_copy" | "native_share") {
  supabase.from("listing_shares").insert({ listing_id: listingId, share_type: type } as never).then(() => {});
}

function ShareListingSheet({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const [stage, setStage] = useState<"choose" | "loading" | "preview">("choose");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const listingUrl = buildShareUrl(listing.id, "copy");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function createGraphic() {
    setStage("loading");
    try {
      const [blob] = await Promise.all([
        renderStoryGraphic(listing),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
      if (!blob) throw new Error("Could not render");
      blobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
      setStage("preview");
      logShare(listing.id, "story_graphic");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't generate image");
      setStage("choose");
    }
  }

  function download() {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leasup-${listing.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Saved to your downloads");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(listingUrl);
      toast.success("Link copied ✓");
      logShare(listing.id, "link_copy");
    } catch {
      toast.error("Couldn't copy link");
    }
  }


  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-muted hover:bg-muted/70"
        >
          <X className="h-4 w-4" />
        </button>

        {stage === "choose" && (
          <>
            <h2 className="pr-10 text-xl font-black">Share this listing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Post to your Instagram Story — every follower sees it.
            </p>

            <div className="mt-5 space-y-2">
              <button
                onClick={createGraphic}
                className="flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground transition hover:bg-primary-dark active:scale-[0.99]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 text-2xl">📱</div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold">Create Story Graphic</div>
                  <div className="text-xs opacity-90">1080×1920 image, ready for Instagram</div>
                </div>
              </button>

              <button
                onClick={() => shareListingNative(listing)}
                className="flex w-full items-center gap-3 rounded-2xl bg-background p-4 text-left transition hover:bg-muted active:scale-[0.99]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Send className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold">Share via…</div>
                  <div className="text-xs text-muted-foreground">Opens your phone's share sheet</div>
                </div>
              </button>

              <button
                onClick={() => copyGroupMe(listing)}
                className="flex w-full items-center gap-3 rounded-2xl bg-background p-4 text-left transition hover:bg-muted active:scale-[0.99]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><MessageSquare className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold">📋 Copy for GroupMe</div>
                  <div className="text-xs text-muted-foreground">Formatted post with emojis + link — paste anywhere</div>
                </div>
              </button>

              <button
                onClick={copyLink}
                className="flex w-full items-center gap-3 rounded-2xl bg-background p-4 text-left transition hover:bg-muted active:scale-[0.99]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Copy className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold">Copy Link</div>
                  <div className="truncate text-xs text-muted-foreground">{listingUrl}</div>
                </div>
              </button>

            </div>
          </>
        )}

        {stage === "loading" && (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative grid h-20 w-20 place-items-center rounded-full bg-primary text-3xl">🎨</div>
            </div>
            <div>
              <div className="text-base font-bold">Creating your graphic…</div>
              <div className="mt-1 text-xs text-muted-foreground">Mixing colors and laying out the card</div>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {stage === "preview" && previewUrl && (
          <>
            <h2 className="pr-10 text-xl font-black">Your Story is ready</h2>
            <p className="mt-1 text-sm text-muted-foreground">Save it, then post to your Instagram Story.</p>

            <div className="mx-auto mt-4 w-full max-w-[260px] overflow-hidden rounded-2xl bg-black shadow-lg">
              <img src={previewUrl} alt="Story preview" className="block h-auto w-full" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={download}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark active:scale-95"
              >
                <ImageDown className="h-4 w-4" />Save to Camera Roll
              </button>
              <button
                onClick={download}
                className="flex items-center justify-center gap-2 rounded-xl bg-background py-3 text-sm font-bold hover:bg-muted active:scale-95"
              >
                <Download className="h-4 w-4" />Download
              </button>
            </div>

            <button
              onClick={createGraphic}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />Regenerate
            </button>

            <p className="mt-3 rounded-lg bg-muted/60 p-3 text-center text-xs text-muted-foreground">
              Save this image, then open Instagram → Your Story → Add image → Post.
              Add the link in your bio so people can tap through.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
