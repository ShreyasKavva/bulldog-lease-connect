/**
 * Q482 — one honest placeholder for every listing that has no usable photo.
 *
 * Two testers independently reported "the same generic cover photo on several
 * listings", the clearest fake-site signal there is. LeaseUp never shipped a
 * stock photo fallback, but the no-photo states were a scattered mix of a bare
 * 🏠 emoji, grey gradients and a house icon, all of which read as "the site
 * put a stand-in picture here". This is the single neutral tile they now all
 * share: brand tint, a home outline and honest wording — never a photograph of
 * a home that is not this listing.
 *
 * ListingPhoto wraps <img> so a signed URL that has expired or 404s swaps in
 * the same tile instead of the browser's broken-image glyph.
 */
import { Home } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const ICON: Record<Size, string> = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-12 w-12",
};

/** Neutral "no photo" tile. Fills its parent; the label is dropped on tiny tiles. */
export function ListingPhotoFallback({
  size = "md",
  label = "Photos coming soon",
  className,
  ...rest
}: {
  size?: Size;
  label?: string;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-primary/10 text-primary dark:bg-primary/15",
        className,
      )}
      {...rest}
    >
      <Home className={cn(ICON[size], "opacity-70")} strokeWidth={1.5} aria-hidden />
      {size !== "xs" && size !== "sm" && (
        <span className="px-2 text-center text-xs font-medium opacity-80">{label}</span>
      )}
    </div>
  );
}

/** <img> that falls back to the neutral tile when the photo fails to load. */
export function ListingPhoto({
  src,
  alt,
  size = "md",
  fallbackClassName,
  ...imgProps
}: {
  src: string | null | undefined;
  alt: string;
  size?: Size;
  fallbackClassName?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  const [failed, setFailed] = useState(false);
  // A new src deserves a fresh attempt (carousels reuse the same element).
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <ListingPhotoFallback
        size={size}
        className={cn(imgProps.className, fallbackClassName)}
        onClick={imgProps.onClick as unknown as React.MouseEventHandler<HTMLDivElement>}
      />
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} {...imgProps} />;
}
