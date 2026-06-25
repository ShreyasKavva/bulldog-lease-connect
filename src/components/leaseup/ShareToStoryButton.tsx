import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import type { Listing } from "@/lib/leaseup/types";
import { toast } from "sonner";

export function ShareToStoryButton({ listing }: { listing: Listing }) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const W = 1080, H = 1920;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0F172A");
      bg.addColorStop(1, "#1E293B");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Try to draw photo
      const photoUrl = listing.photo_urls?.[0];
      if (photoUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const ar = img.width / img.height;
            const targetW = W - 120;
            const targetH = targetW / ar;
            const x = 60, y = 280;
            // rounded rect clip
            const r = 32;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + targetW, y, x + targetW, y + targetH, r);
            ctx.arcTo(x + targetW, y + targetH, x, y + targetH, r);
            ctx.arcTo(x, y + targetH, x, y, r);
            ctx.arcTo(x, y, x + targetW, y, r);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, x, y, targetW, targetH);
            ctx.restore();
            resolve();
          };
          img.onerror = () => resolve();
          img.src = photoUrl;
        });
      }

      // Brand
      ctx.fillStyle = "#2563EB";
      ctx.font = "bold 56px -apple-system, system-ui, sans-serif";
      ctx.fillText("LeaseUp", 60, 140);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "500 32px -apple-system, system-ui, sans-serif";
      ctx.fillText("Student subleases at UGA", 60, 195);

      // Price
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 140px -apple-system, system-ui, sans-serif";
      ctx.fillText(`$${listing.price.toLocaleString()}`, 60, 1380);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "500 40px -apple-system, system-ui, sans-serif";
      ctx.fillText("per month", 60, 1430);

      // Title (wrap)
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 60px -apple-system, system-ui, sans-serif";
      const words = listing.title.split(" ");
      let line = "", y = 1530;
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > W - 120) {
          ctx.fillText(line, 60, y);
          y += 72;
          line = w;
        } else line = test;
      }
      if (line) ctx.fillText(line, 60, y);

      // Beds/baths/area
      ctx.fillStyle = "#CBD5E1";
      ctx.font = "500 36px -apple-system, system-ui, sans-serif";
      ctx.fillText(`${listing.beds} bed · ${Number(listing.baths)} bath${listing.area ? ` · ${listing.area}` : ""}`, 60, y + 70);

      // CTA
      ctx.fillStyle = "#2563EB";
      ctx.fillRect(60, H - 200, W - 120, 120);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 44px -apple-system, system-ui, sans-serif";
      const cta = "Find it on leasup.co";
      const tw = ctx.measureText(cta).width;
      ctx.fillText(cta, (W - tw) / 2, H - 125);

      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Failed to render");

      const file = new File([blob], `leasup-${listing.id}.png`, { type: "image/png" });
      const shareData: ShareData = {
        files: [file],
        title: listing.title,
        text: `${listing.title} — $${listing.price}/mo on LeaseUp`,
      };
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `leasup-${listing.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Story image downloaded");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message ?? "Couldn't generate image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-md py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
      Share to Story
    </button>
  );
}
