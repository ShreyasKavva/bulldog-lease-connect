import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ApplySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  school: z.string().trim().min(1, "School is required").max(160),
  email: z.string().trim().email("Enter a valid email").max(255),
  reason: z.string().trim().min(1, "Tell us why").max(300),
  committed_to_post: z.boolean().default(false),
});

export const submitAmbassadorApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ApplySchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await supabase.from("ambassador_applications").insert({
      name: data.name,
      school: data.school,
      email: data.email,
      reason: data.reason,
      committed_to_post: data.committed_to_post,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
