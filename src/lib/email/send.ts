import { supabase } from '@/integrations/supabase/client'

export interface SendTransactionalEmailInput {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

/**
 * Send a transactional app email through the Lovable email queue.
 * Fire-and-forget from the UI: failures are logged but never thrown to the caller,
 * so they don't break the user flow that triggered them (e.g. sending a chat message).
 */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/lovable/email/transactional/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        templateName: input.templateName,
        recipientEmail: input.recipientEmail,
        idempotencyKey: input.idempotencyKey,
        templateData: input.templateData ?? {},
      }),
    })
    if (!res.ok) {
      console.warn('[email] send failed', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.warn('[email] send error', err)
  }
}
