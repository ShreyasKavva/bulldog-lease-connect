import { toast } from "sonner";

export async function shareListing(opts: { title: string; price?: number | string; id: string }) {
  const url = `https://leasup.co/listings/${opts.id}`;
  const text = opts.price != null ? `$${opts.price}/mo — ${opts.title} on LeaseUp` : opts.title;
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title: opts.title, text, url });
      return;
    }
  } catch {
    // user cancelled or failed — fall through to clipboard
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  } catch {
    toast.error("Couldn't copy link");
  }
}
