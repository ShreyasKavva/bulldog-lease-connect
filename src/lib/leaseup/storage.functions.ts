/**
 * Q410 — server-side signing for private storage objects.
 *
 * Storage used to be readable by the `anon` role: anyone with the publishable
 * key could LIST every bucket (folder names are user ids), descend into a
 * student's folder and download their photos with no account. The fix revokes
 * anonymous read on storage.objects, which also removes the browser's ability
 * to mint signed URLs — so signing moves here, behind the service role.
 *
 * This endpoint is deliberately narrow. It will only sign a path that is
 * either
 *   (a) referenced by a real row — a listing's `photos` array, or a profile's
 *       `avatar_url`; or
 *   (b) inside the caller's own `${userId}/…` folder, when the request
 *       carries a valid bearer token (fresh uploads not yet attached to a row).
 * It never lists a bucket and never reveals what else exists.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type SignableBucket = "listing-photos" | "avatars";

export type SignTransform = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

type SignInput = {
  bucket: SignableBucket;
  paths: string[];
  ttl?: number;
  transform?: SignTransform;
};

const MAX_PATHS = 300;
const DEFAULT_TTL = 60 * 60 * 24 * 7; // 7 days

function isStoragePath(p: unknown): p is string {
  return (
    typeof p === "string" &&
    p.length > 0 &&
    p.length < 512 &&
    !/^https?:\/\//i.test(p) &&
    !p.includes("..")
  );
}

/** The signed-in user id, when the request carries a valid bearer token. */
async function callerId(): Promise<string | null> {
  try {
    const auth = getRequest().headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return null;
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await client.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export const signStoragePaths = createServerFn({ method: "POST" })
  .inputValidator((input: SignInput) => {
    if (input?.bucket !== "listing-photos" && input?.bucket !== "avatars") {
      throw new Error("Unsupported bucket");
    }
    const paths = Array.from(new Set((input.paths ?? []).filter(isStoragePath))).slice(0, MAX_PATHS);
    return { bucket: input.bucket, paths, ttl: input.ttl, transform: input.transform };
  })
  .handler(async ({ data }) => {
    const out: Record<string, string> = {};
    if (data.paths.length === 0) return out;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ttl = Math.min(Math.max(data.ttl ?? DEFAULT_TTL, 60), DEFAULT_TTL);

    const allowed = new Set<string>();

    // (b) the caller's own folder
    const uid = await callerId();
    if (uid) {
      for (const p of data.paths) if (p.split("/")[0] === uid) allowed.add(p);
    }

    // (a) paths referenced by a real row
    const rest = data.paths.filter((p) => !allowed.has(p));
    if (rest.length > 0) {
      if (data.bucket === "listing-photos") {
        const { data: rows } = await supabaseAdmin
          .from("listings")
          .select("photos")
          .overlaps("photos", rest);
        for (const row of rows ?? []) {
          for (const p of (row as { photos: string[] | null }).photos ?? []) {
            if (rest.includes(p)) allowed.add(p);
          }
        }
      } else {
        const { data: rows } = await supabaseAdmin
          .from("profiles")
          .select("avatar_url")
          .in("avatar_url", rest);
        for (const row of rows ?? []) {
          const p = (row as { avatar_url: string | null }).avatar_url;
          if (p && rest.includes(p)) allowed.add(p);
        }
      }
    }

    const list = Array.from(allowed);
    if (list.length === 0) return out;

    const signed = await Promise.all(
      list.map((p) =>
        supabaseAdmin.storage
          .from(data.bucket)
          .createSignedUrl(p, ttl, data.transform ? { transform: data.transform } : undefined),
      ),
    );
    signed.forEach((r, i) => {
      const u = r.data?.signedUrl;
      if (u) out[list[i]] = u;
    });

    // A transform can fail on an unusual source file; an unresized photo beats
    // a missing one, so retry those without the transform.
    if (data.transform) {
      const missing = list.filter((p) => !out[p]);
      if (missing.length > 0) {
        const fb = await Promise.all(
          missing.map((p) => supabaseAdmin.storage.from(data.bucket).createSignedUrl(p, ttl)),
        );
        fb.forEach((r, i) => {
          const u = r.data?.signedUrl;
          if (u) out[missing[i]] = u;
        });
      }
    }

    return out;
  });
