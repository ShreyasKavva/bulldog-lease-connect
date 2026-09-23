/**
 * Signed-out regression tests for the /browse "Trending this week" rail.
 *
 * The rail is fed by `fetchTrendingIds()` (src/lib/leaseup/referral.queries.ts),
 * which reads the `trending_listings` view with the anonymous publishable key,
 * then renders the matching rows from `fetchListings()`. Both reads happen for
 * logged-out visitors, so they depend on the anon GRANT + RLS staying in place.
 * The view has been rebuilt before (Q483 notes) — these tests fail loudly if a
 * future view rebuild, grant change or policy change breaks the signed-out rail
 * or starts leaking private location columns to anonymous callers.
 *
 * Run with:  bun test
 * No auth header is ever sent: every request here is the anonymous case.
 */
import { describe, expect, test } from "bun:test";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

/** Mirrors PUBLIC_LISTING_COLUMNS in src/lib/leaseup/queries.ts. */
const PRIVATE_LISTING_COLUMNS = ["address", "lat", "lng", "area"] as const;

/** Anonymous REST call — apikey only, never an Authorization bearer. */
async function anonRest(path: string, init?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

describe("signed-out /browse trending rail", () => {
  test("environment exposes the anonymous key", () => {
    expect(SUPABASE_URL).toMatch(/^https:\/\//);
    expect(ANON_KEY.length).toBeGreaterThan(10);
  });

  test("anon can read trending_listings exactly as fetchTrendingIds does", async () => {
    const { status, body } = await anonRest(
      "trending_listings?select=id,trending_score&order=trending_score.desc&limit=5",
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    for (const row of body) {
      expect(typeof row.id).toBe("string");
      expect(Number.isFinite(Number(row.trending_score))).toBe(true);
    }
  });

  test("campus-scoped trending read still works for anon (campus_id filter)", async () => {
    const { status, body } = await anonRest(
      "trending_listings?select=id,trending_score&campus_id=not.is.null&limit=1",
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test("trending_listings never exposes private location columns to anon", async () => {
    for (const col of PRIVATE_LISTING_COLUMNS) {
      const { status } = await anonRest(`trending_listings?select=${col}&limit=1`);
      // 400 = column absent from the view (the intended shape).
      expect(status).not.toBe(200);
    }
  });

  test("anon cannot write to trending_listings", async () => {
    const { status } = await anonRest("trending_listings", {
      method: "POST",
      body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000000", trending_score: 999 }),
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("trending ids resolve to listings the rail can actually render", async () => {
    const trending = await anonRest(
      "trending_listings?select=id,trending_score&order=trending_score.desc&limit=5",
    );
    expect(trending.status).toBe(200);
    const ids: string[] = (trending.body ?? []).map((r: any) => r.id);
    if (ids.length === 0) return; // empty rail is a valid state; nothing to resolve

    const { status, body } = await anonRest(
      `listings?select=id,title,price,beds,baths,view_count,saves_count,photos&id=in.(${ids.join(",")})`,
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    for (const l of body) {
      expect(typeof l.title).toBe("string");
      expect(Number.isFinite(Number(l.price))).toBe(true);
      for (const col of PRIVATE_LISTING_COLUMNS) {
        expect(l).not.toHaveProperty(col);
      }
    }
  });

  test("the public listings read the rail depends on works signed out", async () => {
    const { status, body } = await anonRest(
      "listings?select=id,title,price&is_active=eq.true&status=eq.active&limit=1",
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});
