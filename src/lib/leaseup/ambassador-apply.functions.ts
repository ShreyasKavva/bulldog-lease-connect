import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

/**
 * Fire-and-forget: notify shreykavva@gmail.com (locked in the template's `to`)
 * about a new ambassador application via the existing transactional email
 * route. Called with the service-role key (system caller); a failed email
 * never fails the application itself.
 */
async function notifyAmbassadorApplication(applicationId: string, data: {
  name: string; school: string; email: string; reason: string; committed_to_post: boolean;
}) {
  try {
    const origin = new URL(getRequest().url).origin;
    await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        templateName: "ambassador-application",
        idempotencyKey: `ambassador-application-${applicationId}`,
        templateData: {
          name: data.name,
          school: data.school,
          email: data.email,
          reason: data.reason,
          committedToPost: data.committed_to_post,
        },
      }),
    });
  } catch (err) {
    console.warn("[ambassador-apply] notification email failed", err);
  }
}

export const submitAmbassadorApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ApplySchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: inserted, error } = await supabase
      .from("ambassador_applications")
      .insert({
        name: data.name,
        school: data.school,
        email: data.email,
        reason: data.reason,
        committed_to_post: data.committed_to_post,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await notifyAmbassadorApplication(inserted.id, data);
    return { ok: true as const };
  });
