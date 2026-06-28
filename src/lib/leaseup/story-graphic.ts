import type { Listing } from "./types";

const W = 1080;
const H = 1920;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const srcAr = img.width / img.height;
  const dstAr = dw / dh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (srcAr > dstAr) {
    sw = img.height * dstAr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dstAr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2) {
  const words = text.split(/\s+/);
  let line = "";
  let lines: string[] = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 0) last = last.slice(0, -1);
    if (words.join(" ") !== lines.join(" ")) last = last.replace(/\s*\S*$/, "") + "…";
    lines[maxLines - 1] = last;
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length;
}

function safeScoreColor(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 7.5) return "#10B981";
  if (s >= 5) return "#F59E0B";
  return "#EF4444";
}

function formatRange(from?: string | null, to?: string | null): string | null {
  if (!from && !to) return null;
  const fmt = (d?: string | null) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" });
    } catch { return ""; }
  };
  return [fmt(from), fmt(to)].filter(Boolean).join(" – ");
}

export async function renderStoryGraphic(listing: Listing): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0F2447");
  bg.addColorStop(1, "#1D4ED8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const font = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif";

  // Top brand block
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 72px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText("LeaseUp", W / 2, 140);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `500 32px ${font}`;
  const campusName = (listing as any).campus?.name ?? (listing as any).campus_name ?? null;
  ctx.fillText(`Student Subleases${campusName ? ` · ${campusName}` : ""}`, W / 2, 220);
  ctx.textAlign = "left";

  // Photo 300 → 900
  const photoUrl = listing.photo_urls?.[0] ?? listing.photos?.[0];
  if (photoUrl) {
    const img = await loadImage(photoUrl);
    if (img) drawCover(ctx, img, 0, 300, 1080, 600);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 300, 1080, 600);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `700 160px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText("🏠", W / 2, 660);
    ctx.textAlign = "left";
  }

  // Vignette on photo
  const vig = ctx.createLinearGradient(0, 300, 0, 900);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 300, 1080, 600);

  // Info card 900 → 1600 (h=660), 40px inset
  ctx.fillStyle = "#FFFFFF";
  roundedRect(ctx, 40, 900, 1000, 660, 24);
  ctx.fill();

  const padX = 90;

  // Price
  ctx.fillStyle = "#2563EB";
  ctx.font = `800 96px ${font}`;
  ctx.fillText(`$${Number(listing.price).toLocaleString()}/mo`, padX, 1010);

  // Title (1 line, ellipsis)
  ctx.fillStyle = "#1C1E21";
  ctx.font = `600 48px ${font}`;
  wrapText(ctx, listing.title || "Sublease", padX, 1100, W - padX * 2, 56, 1);

  // Meta row
  ctx.fillStyle = "#65676B";
  ctx.font = `500 32px ${font}`;
  const metaParts = [
    listing.area ? `📍 ${listing.area}` : "📍 Near Campus",
    listing.beds ? `${listing.beds}BR` : null,
    listing.baths ? `${Number(listing.baths)}BA` : null,
    listing.furnished ? "Furnished" : null,
  ].filter(Boolean) as string[];
  wrapText(ctx, metaParts.join(" · "), padX, 1175, W - padX * 2, 40, 1);

  // Dates
  const range = formatRange(listing.start_date, listing.end_date);
  if (range) {
    ctx.fillText(`📅 ${range}`, padX, 1240);
  }

  // Divider
  ctx.fillStyle = "#E4E6EB";
  ctx.fillRect(padX, 1300, W - padX * 2, 2);

  // SafeScore
  const score = (listing as any).safe_score ?? null;
  ctx.fillStyle = safeScoreColor(score);
  ctx.beginPath();
  ctx.arc(padX + 18, 1360, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1C1E21";
  ctx.font = `600 32px ${font}`;
  ctx.fillText(`SafeScore: ${score != null ? Number(score).toFixed(1) : "—"}`, padX + 50, 1372);

  // Poster info
  const profile = (listing as any).profile ?? (listing as any).profiles ?? null;
  const posterName = profile?.name || profile?.email?.split("@")[0] || "A student";
  const avatarChar = (posterName[0] || "?").toUpperCase();
  ctx.fillStyle = "#2563EB";
  ctx.beginPath();
  ctx.arc(padX + 22, 1452, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 28px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(avatarChar, padX + 22, 1462);
  ctx.textAlign = "left";
  ctx.fillStyle = "#1C1E21";
  ctx.font = `500 30px ${font}`;
  const verified = profile?.is_verified || profile?.email_verified ? " · ✓ Verified" : "";
  ctx.fillText(`Posted by ${posterName}${verified}`, padX + 60, 1462);

  // Bottom CTA 1600 → 1920
  ctx.fillStyle = "#2563EB";
  ctx.fillRect(0, 1600, W, 320);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `500 40px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText("Find this at", W / 2, 1700);
  ctx.font = `800 72px ${font}`;
  ctx.fillText("leasup.co", W / 2, 1790);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `500 32px ${font}`;
  ctx.fillText("Tap the link in bio →", W / 2, 1870);
  ctx.textAlign = "left";

  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
