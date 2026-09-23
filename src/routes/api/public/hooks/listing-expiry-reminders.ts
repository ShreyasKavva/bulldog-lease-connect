/**
 * Daily cron: send "your listing expires in 3 days" reminder to listers.
 *
 * Scheduled via pg_cron → pg_net POST to this route once per day.
 * Public route under /api/public/ so it bypasses site auth on published sites;
 * the handler itself requires `Authorization: Bearer <service role key>` and
 * fails closed (503) when that secret is absent.

 *
 * Finds listings where available_to = today + 3 days AND is_active AND
 * status = 'active', then renders + enqueues one listing-expiry email per
 * owner via the existing pgmq transactional queue (same infrastructure as
 * /lovable/email/transactional/send). Idempotency key is scoped per
 * (listing, day) so re-running the job the same day does not duplicate.
 */
import * as React from 'react'
import { render } from 'react-email'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { logEmailFailure } from '@/lib/email/observability'

const SITE_NAME = 'LeaseUp'
const SENDER_DOMAIN = 'notify.leasup.co'
const FROM_DOMAIN = 'leasup.co'
const SITE_URL = 'https://leasup.co'

function token32() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function ensureUnsubToken(
  supabase: any,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase()
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()
  if (existing && !existing.used_at) return existing.token as string
  if (existing && existing.used_at) return null // already unsubscribed
  const tok = token32()
  await supabase
    .from('email_unsubscribe_tokens')
    .upsert({ token: tok, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
  const { data: stored } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalized)
    .maybeSingle()
  return (stored?.token as string) ?? null
}

export const Route = createFileRoute('/api/public/hooks/listing-expiry-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        // Q217 — fail closed. Without the service-role secret we cannot
        // authenticate the caller, so we send nothing.
        if (!supabaseUrl || !serviceKey) {
          logEmailFailure({
            stage: 'expiry-cron:config',
            template: 'listing-expiry',
            cause: 'never_attempted',
            detail: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY',
          })
          return Response.json({ error: 'Service unavailable' }, { status: 503 })
        }

        // Caller must present the service-role key as a Bearer token
        // (same pattern as /lovable/email/queue/process). The publishable key
        // is public and must never gate this route.
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = authHeader.slice('Bearer '.length).trim()
        if (token !== serviceKey) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })


        // Compute target date = today + 3 days (UTC).
        const target = new Date()
        target.setUTCDate(target.getUTCDate() + 3)
        const targetIso = target.toISOString().slice(0, 10) // YYYY-MM-DD

        const { data: listings, error: listErr } = await supabase
          .from('listings')
          .select('id, title, available_to, user_id')
          .eq('is_active', true)
          .eq('status', 'active')
          .eq('available_to', targetIso)

        if (listErr) {
          console.error('[expiry-cron] listings query failed', listErr)
          return Response.json({ error: 'Query failed' }, { status: 500 })
        }
        if (!listings || listings.length === 0) {
          return Response.json({ ok: true, sent: 0, target: targetIso })
        }

        const ownerIds = Array.from(new Set(listings.map((l: any) => l.user_id).filter(Boolean)))
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, notification_preferences')
          .in('id', ownerIds)
        const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]))

        const template = TEMPLATES['listing-expiry']
        if (!template) {
          return Response.json({ error: 'Template missing' }, { status: 500 })
        }

        let sent = 0
        let skipped = 0
        const dayBucket = targetIso // one send per (listing, target date)

        for (const l of listings as any[]) {
          const owner = profileMap.get(l.user_id)
          if (!owner?.email) { skipped++; continue }

          // Suppression check
          const { data: suppressed } = await supabase
            .from('suppressed_emails')
            .select('id').eq('email', owner.email.toLowerCase()).maybeSingle()
          if (suppressed) { skipped++; continue }

          const unsub = await ensureUnsubToken(supabase, owner.email)
          if (!unsub) { skipped++; continue }

          const templateData = {
            title: l.title ?? 'Your listing',
            expiresOn: new Date(l.available_to).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            }),
            markRentedUrl: `${SITE_URL}/my-listings`,
            editUrl: `${SITE_URL}/my-listings`,
          }

          const element = React.createElement(template.component, templateData)
          const html = await render(element)
          const plainText = await render(element, { plainText: true })
          const subject = typeof template.subject === 'function'
            ? template.subject(templateData)
            : template.subject

          const messageId = crypto.randomUUID()
          const idempotencyKey = `listing-expiry-${l.id}-${dayBucket}`

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'listing-expiry',
            recipient_email: owner.email,
            status: 'pending',
          })

          const { error: enqErr } = await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: owner.email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text: plainText,
              purpose: 'transactional',
              label: 'listing-expiry',
              idempotency_key: idempotencyKey,
              unsubscribe_token: unsub,
              queued_at: new Date().toISOString(),
            },
          })

          if (enqErr) {
            logEmailFailure({
              stage: 'expiry-cron:enqueue',
              template: 'listing-expiry',
              recipient: owner.email,
              cause: 'queue_failure',
              detail: enqErr.message ?? enqErr,
              extra: { listing_id: l.id, sender_domain: SENDER_DOMAIN },
            })
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: 'listing-expiry',
              recipient_email: owner.email,
              status: 'failed',
              error_message: 'Failed to enqueue',
            })
            skipped++
            continue
          }
          sent++
        }

        return Response.json({ ok: true, target: targetIso, sent, skipped, total: listings.length })
      },
    },
  },
})
