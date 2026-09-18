import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://leasup.co";

type Entry = { loc: string; priority: string; changefreq?: string };

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = [
          { loc: `${BASE_URL}/`, priority: "1.0", changefreq: "daily" },
          { loc: `${BASE_URL}/browse`, priority: "0.9", changefreq: "daily" },
          { loc: `${BASE_URL}/looking`, priority: "0.7", changefreq: "daily" },
          { loc: `${BASE_URL}/market`, priority: "0.8", changefreq: "daily" },
          { loc: `${BASE_URL}/campuses`, priority: "0.7", changefreq: "weekly" },
          { loc: `${BASE_URL}/tours`, priority: "0.5", changefreq: "weekly" },
          { loc: `${BASE_URL}/ambassador`, priority: "0.5", changefreq: "monthly" },
          { loc: `${BASE_URL}/about`, priority: "0.5", changefreq: "monthly" },
        ];

        try {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          // Paginate — PostgREST caps a single response at 1000 rows.
          const pageSize = 1000;
          // Active listings — one entry each, and the source of truth for
          // which campus pages are worth submitting (Q269: an empty campus
          // page is thin content, so it stays out of the sitemap).
          const campusIds = new Set<string>();
          for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await supabase
              .from("listings")
              .select("id,campus_id")
              .eq("is_active", true)
              .eq("status", "active")
              .order("id")
              .range(offset, offset + pageSize - 1);
            if (error) throw error;
            for (const l of data ?? []) {
              if (l.campus_id) campusIds.add(l.campus_id as string);
              entries.push({
                loc: `${BASE_URL}/listing/${l.id}`,
                priority: "0.6",
                changefreq: "daily",
              });
            }
            if (!data || data.length < pageSize) break;
          }
          if (campusIds.size > 0) {
            const ids = [...campusIds];
            for (let i = 0; i < ids.length; i += 200) {
              const { data, error } = await supabase
                .from("campuses")
                .select("slug")
                .in("id", ids.slice(i, i + 200))
                .order("name");
              if (error) throw error;
              for (const c of data ?? []) {
                entries.push({
                  loc: `${BASE_URL}/sublease/${c.slug}`,
                  priority: "0.9",
                  changefreq: "daily",
                });
              }
            }
          }
        } catch {
          // Fail open — return base entries
        }

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...entries.map((e) =>
            [
              `  <url>`,
              `    <loc>${e.loc}</loc>`,
              `    <priority>${e.priority}</priority>`,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
              `  </url>`,
            ].filter(Boolean).join("\n"),
          ),
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
