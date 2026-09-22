/**
 * AI server functions. All AI calls in the app funnel through here.
 *
 * Powered by the Lovable AI Gateway (see ai-gateway.server.ts). The gateway
 * key (LOVABLE_API_KEY) is auto-provisioned on Lovable Cloud; we read it
 * inside each handler — never at module scope — per server-fn env rules.
 *
 * Functions exported from this file:
 *   - analyzeLease   tenant-advocate review of a lease (text or PDF base64).
 *                    Persists a row in `lease_analyses`.
 *   - findMyMatch    ranks listings against a user's vibe-quiz payload.
 *   - screenListing  pre-publish moderation — returns auto_reject /
 *                    pending_review / quality_nudge / ok. Called by
 *                    PostListingDialog before the insert.
 *
 * Output parsing: the LLM is asked for strict JSON. extractJson() tolerates
 * ```json fences and partial prose wrapping. If you change a system prompt,
 * keep the JSON-only contract or the parser will throw.
 *
 * MODEL is centralized — bump cautiously and re-run lease analysis fixtures
 * before shipping.
 */
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

const LeaseReviewInput = z.object({
  leaseText: z.string().min(80, "Paste at least a few paragraphs of lease text.").max(60000),
});

export type LeaseReviewItem = {
  category: string;
  status: "red" | "yellow" | "green";
  finding: string;
  advice: string;
};

export type LeaseReviewResult = {
  summary: string;
  items: LeaseReviewItem[];
};

const LEASE_REVIEW_CATEGORIES = [
  "sublease clause",
  "early termination",
  "rent increases",
  "security deposit",
  "utilities",
  "guest policy",
  "notice to vacate",
  "auto-renewal",
];

function normalizeLeaseReview(parsed: Partial<LeaseReviewResult>): LeaseReviewResult {
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const normalized = items.map((item) => ({
    category: String(item?.category ?? "Lease term"),
    status: (["red", "yellow", "green"] as const).includes(item?.status as any) ? item.status : "yellow",
    finding: String(item?.finding ?? "This lease term needs a closer look."),
    advice: String(item?.advice ?? "Ask your landlord to explain this in writing before you sign."),
  })).slice(0, 8);

  return {
    summary: String(parsed.summary ?? "We reviewed the lease text and highlighted the clauses most likely to affect a student sublease."),
    items: normalized.length > 0 ? normalized : LEASE_REVIEW_CATEGORIES.map((category) => ({
      category,
      status: "yellow" as const,
      finding: "The lease text did not make this term clear.",
      advice: "Ask the landlord or property manager for the exact policy in writing.",
    })),
  };
}

// SECURITY (Q280): must stay behind requireSupabaseAuth. Without it this is an
// open, unauthenticated AI endpoint anyone on the internet can call to burn
// model credits (50k chars per request).
export const analyzeLeaseText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LeaseReviewInput.parse(d))
  .handler(async ({ data }): Promise<LeaseReviewResult> => {
    const provider = gateway();
    const prompt = `You are a tenant-friendly lease reviewer for college students. Review the lease text below for subleasing risk and common student housing traps.

Return ONLY valid JSON with exactly this shape:
{
  "summary": "2-3 sentence plain English summary",
  "items": [
    { "category": "sublease clause", "status": "red|yellow|green", "finding": "plain English finding", "advice": "specific next step" }
  ]
}

You must include one item for each category: ${LEASE_REVIEW_CATEGORIES.join(", ")}.
Use status red for risky/prohibited, yellow for unclear/requires permission, green for favorable/clear.

Lease: ${data.leaseText.slice(0, 50000)}`;

    const { text } = await generateText({
      model: provider(MODEL),
      prompt,
      temperature: 0.2,
    });

    try {
      return normalizeLeaseReview(extractJson<LeaseReviewResult>(text));
    } catch {
      return normalizeLeaseReview({
        summary: text.slice(0, 500),
        items: [],
      });
    }
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
      .select("id,title,description,price,beds,baths,area,furnished,utilities_included,pet_friendly,available_from,available_to")
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

// ---- LISTING SCREENING (Queue 21) ----
const ScreenInput = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  price: z.number().int().nonnegative(),
  beds: z.number().int().nonnegative(),
  campus: z.string().default(""),
  has_contact: z.boolean().default(false),
  photo_count: z.number().int().nonnegative().default(0),
});

export type ScreenResult = {
  quality_score: number;
  scam_risk: "low" | "medium" | "high";
  issues: string[];
  auto_reject: boolean;
  warnings: string[];
};

export const screenListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScreenInput.parse(d))
  .handler(async ({ data }): Promise<ScreenResult> => {
    const provider = gateway();
    const prompt = `You are a content moderator for a student housing marketplace called LeaseUp.
Analyze the listing below and return ONLY a JSON object (no markdown) with this exact shape:
{
  "quality_score": 0-100,
  "scam_risk": "low" | "medium" | "high",
  "issues": [string],
  "auto_reject": boolean,
  "warnings": [string]
}

Set auto_reject true ONLY for obvious scams, illegal content, hate speech, or fraud.
"high" scam_risk: strong signals (off-platform payment, out-of-country, mailing keys, urgency + no specifics).
"medium": some signals but plausible.

Scam signals:
- Price drastically below market for student housing
- "Send money via Venmo / CashApp / Zelle / wire to hold"
- Requests for SSN / bank info upfront
- "Out of the country, I'll mail the keys"
- Generic / copied description, zero specifics
- 0 photos
- Hyper-urgent language ("must sign today")

Quality signals:
- Specific unit details, neighborhood, dates
- Clear price + lease terms
- 3+ photos
- Mentions utilities, furnishing

LISTING:
Title: ${data.title}
Description: ${data.description.slice(0, 1500)}
Price: $${data.price}/mo
Beds: ${data.beds}BR
Campus: ${data.campus}
Photos uploaded: ${data.photo_count}
Has contact info: ${data.has_contact}`;

    const { text } = await generateText({
      model: provider(MODEL),
      prompt,
      temperature: 0.1,
    });

    let parsed: ScreenResult;
    try {
      parsed = extractJson<ScreenResult>(text);
    } catch {
      parsed = { quality_score: 60, scam_risk: "low", issues: [], auto_reject: false, warnings: [] };
    }
    return {
      quality_score: Math.max(0, Math.min(100, Math.round(parsed.quality_score ?? 60))),
      scam_risk: (["low", "medium", "high"] as const).includes(parsed.scam_risk) ? parsed.scam_risk : "low",
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 8) : [],
      auto_reject: Boolean(parsed.auto_reject),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 6) : [],
    };
  });

