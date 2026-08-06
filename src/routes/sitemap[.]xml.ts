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
          { loc: `${BASE_URL}/looking`, priority: "0.7", changefreq: "daily" },
          { loc: `${BASE_URL}/lease-analysis`, priority: "0.8", changefreq: "weekly" },
          { loc: `${BASE_URL}/find-my-match`, priority: "0.8", changefreq: "weekly" },
          { loc: `${BASE_URL}/market`, priority: "0.8", changefreq: "daily" },
        ];

        try {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data } = await supabase.from("campuses").select("slug").order("name");
          for (const c of data ?? []) {
            entries.push({
              loc: `${BASE_URL}/sublease/${c.slug}`,
              priority: "0.9",
              changefreq: "daily",
            });
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
