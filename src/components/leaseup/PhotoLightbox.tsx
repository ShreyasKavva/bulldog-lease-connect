/**
 * Q513 — full-screen photo viewer shared by the listing page and the listing
 * slide-out. Built on the Radix dialog primitive so it is a real modal:
 * role="dialog" + aria-modal, labelled title, focus trapped inside, Escape
 * closes (only this layer when opened from the slide-out), and focus returns
 * to the photo that opened it. Arrow keys and swipe step through photos.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X as XIcon } from "lucide-react";
import { ListingPhoto } from "./ListingPhoto";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export function PhotoLightbox({
  photos,
  index,
  title,
  onIndex,
  onClose,
}: {
  photos: string[];
  index: number;
  title: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const count = photos.length;
  const go = useCallback(
    (delta: number) => onIndex((index + delta + count) % count),
    [index, count, onIndex],
  );

  const touchX = useRef<number | null>(null);
  // Radix returns focus to its own Trigger, and this dialog has none — so
  // remember whatever opened it (the photo button) and hand focus back there.
  const openerRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null,
  );

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/95" />
        <DialogPrimitive.Content
          aria-modal="true"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            openerRef.current?.focus?.();
          }}
          onKeyDown={(e) => {
            if (count < 2) return;
            if (e.key === "ArrowRight") {
              e.preventDefault();
              go(1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(-1);
            }
          }}
          onTouchStart={(e) => {
            touchX.current = e.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            if (start == null || count < 2) return;
            const dx = (e.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
          className="fixed inset-0 z-[101] flex flex-col text-white outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            {title} — photo {index + 1} of {count}
          </DialogPrimitive.Title>

          <div className="flex items-center justify-between px-4 py-3">
            <p aria-live="polite" className="text-sm font-semibold text-white">
              {index + 1} / {count}
            </p>
            <DialogPrimitive.Close
              aria-label="Close photos"
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25",
                FOCUS,
              )}
            >
              <XIcon className="h-5 w-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
            <ListingPhoto
              src={photos[index]}
              alt={`${title} — photo ${index + 1} of ${count}`}
              size="lg"
              className="mx-auto max-h-[78vh] max-w-[92vw] object-contain"
            />
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className={cn(
                    "absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70 sm:left-4",
                    FOCUS,
                  )}
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className={cn(
                    "absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70 sm:right-4",
                    FOCUS,
                  )}
                >
                  <ChevronRight className="h-6 w-6" aria-hidden />
                </button>
              </>
            )}
          </div>

          {count > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-5 pt-4">
              {photos.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onIndex(i)}
                  aria-label={`Show photo ${i + 1} of ${count}`}
                  aria-current={i === index ? "true" : undefined}
                  className={cn(
                    "h-12 w-16 shrink-0 overflow-hidden rounded-md transition",
                    i === index ? "border-2 border-white" : "opacity-60 hover:opacity-100",
                    FOCUS,
                  )}
                >
                  <ListingPhoto src={p} alt="" size="xs" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
