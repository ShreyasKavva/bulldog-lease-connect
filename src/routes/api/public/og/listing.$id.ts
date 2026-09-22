/**
 * Q366 — stable og:image endpoint for listing share previews.
 *
 * Share platforms (iMessage, Slack, X, Facebook, Google) cache the og:image
 * URL *string* and re-fetch it days or weeks later, so the meta tag must not
 * point at a short-lived signed storage URL. This route redirects to a FRESH
 * signed URL at request time (Cache-Control: public, max-age=3600 on the
 * redirect itself), and falls back to the static /og-image.png when the
 * listing has no photos, is not active, or the id does not resolve.
 *
 * No new data is exposed: these photos already render on the public listing
 * page. Route lives under /api/public/ so it bypasses site auth on published
 * sites.
 */
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

const FALLBACK_PATH = '/og-image.png'
const SIGNED_TTL_SECONDS = 3600
const CACHE_CONTROL = 'public, max-age=3600'

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': CACHE_CONTROL },
  })
}

export const Route = createFileRoute('/api/public/og/listing/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const origin = new URL(request.url).origin
        const fallback = () => redirectResponse(`${origin}${FALLBACK_PATH}`)

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) return fallback()

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        const { data: listing } = await supabase
          .from('listings')
          .select('photos')
          .eq('id', params.id)
          .eq('is_active', true)
          .eq('status', 'active')
          .maybeSingle()

        const firstPhoto = Array.isArray(listing?.photos) ? listing.photos[0] : null
        if (!firstPhoto) return fallback()

        const { data: signed } = await supabase.storage
          .from('listing-photos')
          .createSignedUrl(firstPhoto, SIGNED_TTL_SECONDS)
        if (!signed?.signedUrl) return fallback()

        const target = signed.signedUrl.startsWith('http')
          ? signed.signedUrl
          : `${supabaseUrl}${signed.signedUrl}`
        return redirectResponse(target)
      },
    },
  },
})
