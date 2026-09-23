import * as React from 'react'
import { render } from 'react-email'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { logEmailFailure } from '@/lib/email/observability'

// Configuration baked in at scaffold time
const SITE_NAME = "bulldog-lease-connect"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers. NEVER use the root domain.
const SENDER_DOMAIN = "notify.leasup.co"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// Can be the root domain when display_from_root is enabled — this is cosmetic only.
const FROM_DOMAIN = "leasup.co"

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}
// Q456 — what a non-admin, non-system caller is allowed to put in
// templateData, per template. Anything not listed here is dropped.
const MAX_TEXT_FIELD = 200
type FieldKind = 'text' | 'url' | 'number' | 'id'
const USER_TEMPLATE_FIELDS: Record<string, Record<string, FieldKind>> = {
  welcome: {
    firstName: 'text',
    campusName: 'text',
    campusUrl: 'url',
    postUrl: 'url',
    roommatesUrl: 'url',
  },
  'new-message': {
    senderName: 'text',
    preview: 'text',
    listingTitle: 'text',
    listingPrice: 'number',
    listingArea: 'text',
    conversationUrl: 'url',
    conversationId: 'id',
  },
}

// Accept only links on our own site; anything else is rewritten onto the
// canonical origin (path preserved) so no off-site link can ride our domain.
function safeSiteUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null
  let parsed: URL
  try {
    parsed = new URL(value, `https://${FROM_DOMAIN}`)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  const host = parsed.hostname.toLowerCase()
  const onSite = host === FROM_DOMAIN || host.endsWith(`.${FROM_DOMAIN}`) || host.endsWith('.lovable.app')
  if (onSite) return parsed.toString()
  return `https://${FROM_DOMAIN}${parsed.pathname}${parsed.search}`
}


// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const Route = createFileRoute("/lovable/email/transactional/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          logEmailFailure({
            stage: 'transactional-send:config',
            template: null,
            cause: 'never_attempted',
            detail: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY',
          })
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 }
          )
        }

        // Q217 — authorization. Accepted callers:
        //   1. System caller presenting the service-role key as a Bearer token
        //      (same pattern as /lovable/email/queue/process).
        //   2. An authenticated user who is an admin (public.is_admin).
        //   3. An authenticated user sending one of USER_TRIGGERED_TEMPLATES.
        //      Their recipient is always derived server-side (own address, or
        //      the verified counterpart of a conversation they belong to), so
        //      the request body can never aim our domain at a third party.
        // Everyone else is rejected. Fails closed: supabaseServiceKey is
        // required above, so a missing secret can never make a check pass.
        const USER_TRIGGERED_TEMPLATES = new Set(['welcome', 'new-message'])

        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.slice('Bearer '.length).trim()
        if (!token) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const isSystemCaller = token === supabaseServiceKey
        let callerEmail: string | null = null
        let callerUserId: string | null = null
        let isAdminCaller = false

        if (!isSystemCaller) {
          const { data: { user }, error: authError } = await supabase.auth.getUser(token)

          if (authError || !user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }

          const { data: isAdmin } = await supabase.rpc('is_admin', {
            _uid: user.id,
          })

          isAdminCaller = isAdmin === true
          callerUserId = user.id
          callerEmail = user.email ?? null
        }


        // Parse request body
        let templateName: string
        let recipientEmail: string
        let idempotencyKey: string
        let messageId: string
        let templateData: Record<string, any> = {}
        try {
          const body = await request.json()
          templateName = body.templateName || body.template_name
          recipientEmail = body.recipientEmail || body.recipient_email
          messageId = crypto.randomUUID()
          idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
          if (body.templateData && typeof body.templateData === 'object') {
            templateData = body.templateData
          }
        } catch {
          return Response.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 }
          )
        }

        if (!templateName) {
          return Response.json(
            { error: 'templateName is required' },
            { status: 400 }
          )
        }

        // 1. Look up template from registry (early — needed to resolve recipient)
        const template = TEMPLATES[templateName]

        if (!template) {
          console.error('Template not found in registry', { templateName })
          return Response.json(
            {
              error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
            },
            { status: 404 }
          )
        }

        // Non-admin users may only trigger the user-triggered templates.
        const isPrivilegedCaller = isSystemCaller || isAdminCaller
        if (!isPrivilegedCaller && !USER_TRIGGERED_TEMPLATES.has(templateName)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        // For a user-sent "new message" notification the recipient is the other
        // participant of the conversation — verified here, never trusted from
        // the body.
        let derivedRecipient: string | null = null
        if (!isPrivilegedCaller && templateName === 'new-message') {
          const conversationId = typeof templateData.conversationId === 'string'
            ? templateData.conversationId
            : null
          if (!conversationId) {
            return Response.json({ error: 'conversationId is required' }, { status: 400 })
          }
          const { data: conv } = await supabase
            .from('conversations')
            .select('participant_1_id,participant_2_id')
            .eq('id', conversationId)
            .maybeSingle()
          if (
            !conv ||
            (conv.participant_1_id !== callerUserId && conv.participant_2_id !== callerUserId)
          ) {
            return Response.json({ error: 'Forbidden' }, { status: 403 })
          }
          const otherId = conv.participant_1_id === callerUserId
            ? conv.participant_2_id
            : conv.participant_1_id
          const { data: otherProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', otherId)
            .maybeSingle()
          derivedRecipient = otherProfile?.email ?? null
          if (!derivedRecipient) {
            return Response.json({ error: 'Recipient not found' }, { status: 404 })
          }
        }

        // Resolve effective recipient: template-level `to` always wins. A
        // caller-supplied recipient is only honoured for the system (service
        // role) or admin caller; any other caller can only ever mail their own
        // address or a server-derived one, so the request body can never aim
        // our domain at a third party.
        const effectiveRecipient = template.to
          || (isPrivilegedCaller ? recipientEmail : (derivedRecipient ?? callerEmail))

        // Q456 — template data allowlist. A non-privileged caller can only
        // supply the fields its template actually renders; everything else is
        // dropped, strings are length-capped, and any link is rewritten onto
        // our own origin so the body can never smuggle arbitrary copy or an
        // off-site URL into mail from our domain.
        if (!isPrivilegedCaller) {
          const allowed = USER_TEMPLATE_FIELDS[templateName] ?? {}
          const safe: Record<string, any> = {}
          for (const [key, kind] of Object.entries(allowed)) {
            const value = templateData[key]
            if (value === undefined || value === null) continue
            if (kind === 'url') {
              const url = safeSiteUrl(value)
              if (url) safe[key] = url
            } else if (kind === 'number') {
              if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value
            } else if (kind === 'id') {
              if (typeof value === 'string') safe[key] = value.slice(0, 64)
            } else {
              if (typeof value === 'string') safe[key] = value.slice(0, MAX_TEXT_FIELD)
            }
          }
          templateData = safe
        }


        if (!effectiveRecipient) {
          return Response.json(
            {
              error: 'recipientEmail is required (unless the template defines a fixed recipient)',
            },
            { status: 400 }
          )
        }

        // 2. Check suppression list (fail-closed: if we can't verify, don't send)
        const { data: suppressed, error: suppressionError } = await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', effectiveRecipient.toLowerCase())
          .maybeSingle()

        if (suppressionError) {
          console.error('Suppression check failed — refusing to send', {
            error: suppressionError,
            recipient_redacted: redactEmail(effectiveRecipient),
          })
          return Response.json(
            { error: 'Failed to verify suppression status' },
            { status: 500 }
          )
        }

        if (suppressed) {
          // Log the suppressed attempt
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
          })

          console.log('Email suppressed', {
            templateName,
            recipient_redacted: redactEmail(effectiveRecipient),
          })
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // 3. Get or create unsubscribe token (one token per email address)
        const normalizedEmail = effectiveRecipient.toLowerCase()
        let unsubscribeToken: string

        // Check for existing token for this email
        const { data: existingToken, error: tokenLookupError } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (tokenLookupError) {
          console.error('Token lookup failed', {
            error: tokenLookupError,
            email_redacted: redactEmail(normalizedEmail),
          })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'failed',
            error_message: 'Failed to look up unsubscribe token',
          })
          return Response.json(
            { error: 'Failed to prepare email' },
            { status: 500 }
          )
        }

        if (existingToken && !existingToken.used_at) {
          // Reuse existing unused token
          unsubscribeToken = existingToken.token
        } else if (!existingToken) {
          // Create new token — upsert handles concurrent inserts gracefully
          unsubscribeToken = generateToken()
          const { error: tokenError } = await supabase
            .from('email_unsubscribe_tokens')
            .upsert(
              { token: unsubscribeToken, email: normalizedEmail },
              { onConflict: 'email', ignoreDuplicates: true }
            )

          if (tokenError) {
            console.error('Failed to create unsubscribe token', {
              error: tokenError,
            })
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: templateName,
              recipient_email: effectiveRecipient,
              status: 'failed',
              error_message: 'Failed to create unsubscribe token',
            })
            return Response.json(
              { error: 'Failed to prepare email' },
              { status: 500 }
            )
          }

          // If another request raced us, our upsert was silently ignored.
          // Re-read to get the actual stored token.
          const { data: storedToken, error: reReadError } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', normalizedEmail)
            .maybeSingle()

          if (reReadError || !storedToken) {
            console.error('Failed to read back unsubscribe token after upsert', {
              error: reReadError,
              email_redacted: redactEmail(normalizedEmail),
            })
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: templateName,
              recipient_email: effectiveRecipient,
              status: 'failed',
              error_message: 'Failed to confirm unsubscribe token storage',
            })
            return Response.json(
              { error: 'Failed to prepare email' },
              { status: 500 }
            )
          }
          unsubscribeToken = storedToken.token
        } else {
          // Token exists but is already used — email should have been caught by suppression check above.
          // This is a safety fallback; log and skip sending.
          console.warn('Unsubscribe token already used but email not suppressed', {
            email_redacted: redactEmail(normalizedEmail),
          })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
            error_message:
              'Unsubscribe token used but email missing from suppressed list',
          })
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // 4. Render React Email template to HTML and plain text
        const element = React.createElement(template.component, templateData)
        const html = await render(element)
        const plainText = await render(element, { plainText: true })

        // Resolve subject — supports static string or dynamic function
        const resolvedSubject =
          typeof template.subject === 'function'
            ? template.subject(templateData)
            : template.subject

        // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
        // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

        // Log pending BEFORE enqueue so we have a record even if enqueue crashes
        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: effectiveRecipient,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: effectiveRecipient,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: resolvedSubject,
            html,
            text: plainText,
            purpose: 'transactional',
            label: templateName,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          logEmailFailure({
            stage: 'transactional-send:enqueue',
            template: templateName,
            recipient: effectiveRecipient,
            cause: 'queue_failure',
            detail: enqueueError.message ?? enqueueError,
            extra: { sender_domain: SENDER_DOMAIN },
          })

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'failed',
            error_message: 'Failed to enqueue email',
          })

          return Response.json(
            { error: 'Failed to enqueue email' },
            { status: 500 }
          )
        }

        console.log('Transactional email enqueued', {
          templateName,
          recipient_redacted: redactEmail(effectiveRecipient),
        })

        return Response.json({ success: true, queued: true })
      },
    },
  },
})
