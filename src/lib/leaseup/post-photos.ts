/**
 * Q470 — post-flow-only storage helper.
 *
 * When a student removes a photo in the wizard before publishing, the uploaded
 * object used to stay in the bucket forever. The `listing_photos_auth_delete`
 * policy already lets an owner delete objects under their own
 * `${userId}/` prefix, so this runs as the student's own session — no policy
 * change needed. Failures are swallowed on purpose: the thumbnail is already
 * gone from the form and an orphaned file is not worth an error message.
 */
import { supabase } from "@/integrations/supabase/client";

export async function deleteListingPhoto(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from("listing-photos").remove([path]);
    return !error;
  } catch {
    return false;
  }
}
