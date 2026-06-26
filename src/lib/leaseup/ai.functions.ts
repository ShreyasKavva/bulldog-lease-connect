import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

function gateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

function extractJson<T>(text: string): T {
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  const start = raw.indexOf("{");
  const startA = raw.indexOf("[");
  const s = start === -1 ? startA : startA === -1 ? start : Math.min(start, startA);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  return JSON.parse(raw.slice(s, end + 1)) as T;
}

// ---- LEASE ANALYSIS ----
const AnalyzeInput = z.object({
  filename: z.string().min(1),
  text: z.string().max(60000).optional(),
  pdf_base64: z.string().max(8_000_000).optional(),
}).refine(v => (v.text && v.text.length >= 50) || v.pdf_base64, {
  message: "Provide lease text (50+ chars) or a PDF",
});

const SYSTEM_PROMPT = `You are a tenant-advocate lease reviewer for college students.
Identify clauses that could hurt the tenant: auto-renewal, joint & several liability,
early-termination fees, subletting bans, guarantor traps, security-deposit traps,
maintenance burdens, entry rights, late fees, etc.

Return ONLY JSON in this exact shape (no prose, no markdown fences):
{
  "summary": "2-3 sentence plain-English overview",
  "risk_score": 0-100 (higher = riskier for tenant),
  "key_terms": { "rent": "string or null", "term": "string or null", "deposit": "string or null", "late_fee": "string or null" },
  "flags": [
    {
      "severity": "low|medium|high",
      "category": "one of: fees, deposit, termination, liability, maintenance, privacy, renewal, subletting, pets, utilities, other",
      "clause": "short clause name",
      "concern": "1-2 sentence explanation in plain English",
      "suggestion": "1 sentence: what the tenant should do or ask the landlord"
    }
  ]
}`;

export const analyzeLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data, context }) => {
    const provider = gateway();

    const userContent: any[] = [{ type: "text", text: SYSTEM_PROMPT }];
    if (data.pdf_base64) {
      userContent.push({
        type: "file",
        mediaType: "application/pdf",
        data: data.pdf_base64,
      });
    } else if (data.text) {
      userContent.push({ type: "text", text: `LEASE TEXT:\n"""\n${data.text.slice(0, 50000)}\n"""` });
    }

    const { text } = await generateText({
      model: provider(MODEL),
      messages: [{ role: "user", content: userContent }],
      temperature: 0.2,
    });

    let parsed: { summary: string; risk_score: number; flags: any[]; key_terms?: any };
    try { parsed = extractJson(text); }
    catch { parsed = { summary: text.slice(0, 500), risk_score: 50, flags: [] }; }

    const { data: row, error } = await context.supabase
      .from("lease_analyses")
      .insert({
        user_id: context.userId,
        filename: data.filename,
        summary: parsed.summary ?? null,
        risk_score: Math.max(0, Math.min(100, Math.round(parsed.risk_score ?? 50))),
        flags: { items: parsed.flags ?? [], key_terms: parsed.key_terms ?? null },
        raw_excerpt: data.text ? data.text.slice(0, 2000) : `[PDF: ${data.filename}]`,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const listLeaseAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lease_analyses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const deleteLeaseAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("lease_analyses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---- FIND MY MATCH ----
const MatchInput = z.object({
  preferences: z.string().min(10).max(2000),
});

export const findMyMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MatchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: listings, error } = await context.supabase
      .from("listings")
      .select("id,title,description,price,beds,baths,area,furnished,utilities_included,pet_friendly,available_from,available_to,safe_score")
      .eq("is_active", true)
      .limit(60);
    if (error) throw error;
    if (!listings || listings.length === 0) return { matches: [] as Array<{ id: string; score: number; why: string }> };

    const provider = gateway();
    const compact = listings.map((l: any) => ({
      id: l.id,
      title: l.title,
      price: l.price,
      beds: l.beds,
      baths: Number(l.baths),
      area: l.area,
      furnished: l.furnished,
      utilities: l.utilities_included,
      pets: l.pet_friendly,
      from: l.available_from,
      to: l.available_to,
      desc: (l.description ?? "").slice(0, 280),
      safe: l.safe_score,
    }));

    const prompt = `Match a student to the best sublease listings based on their preferences.
Score each listing 0-100 by fit (budget, location, beds, dates, furnishing, lifestyle).
Return ONLY JSON (no markdown):
{ "matches": [ { "id": "<listing id>", "score": 0-100, "why": "1 sentence why it fits" } ] }
Include only the top 6 matches sorted by score desc.

STUDENT PREFERENCES:
"""${data.preferences}"""

LISTINGS:
${JSON.stringify(compact)}`;

    const { text } = await generateText({
      model: provider(MODEL),
      prompt,
      temperature: 0.3,
    });

    let parsed: { matches: Array<{ id: string; score: number; why: string }> };
    try { parsed = extractJson(text); } catch { parsed = { matches: [] }; }
    const valid = new Set(listings.map((l: any) => l.id));
    parsed.matches = (parsed.matches ?? []).filter(m => valid.has(m.id)).slice(0, 6);
    return parsed;
  });
