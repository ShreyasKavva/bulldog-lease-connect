import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  head: () => ({
    meta: [
      { title: 'Unsubscribe — LeaseUp' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
})

type State = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error'

function UnsubscribePage() {
  const { token } = Route.useSearch()
  const [state, setState] = useState<State>('loading')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          setState('invalid')
        } else if (data.valid === false) {
          setState('already')
        } else {
          setState('valid')
        }
      })
      .catch(() => setState('error'))
  }, [token])

  async function confirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) setState('success')
      else if (data.reason === 'already_unsubscribed') setState('already')
      else setState('error')
    } catch {
      setState('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5] px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="text-2xl font-bold text-[#0F172A] mb-2">LeaseUp</div>
        {state === 'loading' && <p className="text-slate-500">Checking your link…</p>}
        {state === 'valid' && (
          <>
            <h1 className="text-xl font-semibold text-[#0F172A] mt-4">Unsubscribe from LeaseUp emails?</h1>
            <p className="text-slate-500 mt-2 mb-6">You won't receive notification emails from us anymore.</p>
            <button
              onClick={confirm}
              disabled={submitting}
              className="w-full rounded-xl bg-[#2563EB] text-white font-semibold py-3 hover:bg-[#1d4ed8] disabled:opacity-60"
            >
              {submitting ? 'Unsubscribing…' : 'Confirm unsubscribe'}
            </button>
          </>
        )}
        {state === 'success' && (
          <>
            <h1 className="text-xl font-semibold text-[#0F172A] mt-4">You're unsubscribed</h1>
            <p className="text-slate-500 mt-2">You won't get any more notification emails from LeaseUp.</p>
          </>
        )}
        {state === 'already' && (
          <>
            <h1 className="text-xl font-semibold text-[#0F172A] mt-4">Already unsubscribed</h1>
            <p className="text-slate-500 mt-2">This email is already opted out.</p>
          </>
        )}
        {state === 'invalid' && (
          <>
            <h1 className="text-xl font-semibold text-[#0F172A] mt-4">Invalid or expired link</h1>
            <p className="text-slate-500 mt-2">Try the link from a more recent email, or contact support.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="text-xl font-semibold text-[#0F172A] mt-4">Something went wrong</h1>
            <p className="text-slate-500 mt-2">Please try again in a moment.</p>
          </>
        )}
      </div>
    </div>
  )
}
