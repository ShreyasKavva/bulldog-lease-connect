/**
 * Q410 — thin client helper over the server-side signing endpoint.
 *
 * The browser can no longer mint signed URLs itself (anonymous read on
 * storage.objects was revoked), so every surface that used to call
 * supabase.storage.createSignedUrl(s) goes through here instead.
 */
import {
  signStoragePaths,
  type SignableBucket,
  type SignTransform,
} from "./storage.functions";

export async function signPaths(
  bucket: SignableBucket,
  paths: string[],
  opts?: { ttl?: number; transform?: SignTransform },
): Promise<Map<string, string>> {
  const clean = Array.from(new Set(paths.filter((p) => !!p && !/^https?:\/\//i.test(p))));
  if (clean.length === 0) return new Map();
  try {
    const result = await signStoragePaths({
      data: { bucket, paths: clean, ttl: opts?.ttl, transform: opts?.transform },
    });
    return new Map(Object.entries(result ?? {}));
  } catch {
    return new Map();
  }
}

export async function signPath(
  bucket: SignableBucket,
  path: string | null | undefined,
  opts?: { ttl?: number; transform?: SignTransform },
): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const map = await signPaths(bucket, [path], opts);
  return map.get(path) ?? null;
}
