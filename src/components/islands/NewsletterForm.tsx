import { useState, useEffect, type FormEvent } from 'react'

function Toast({
  type,
  message,
  onClose,
}: {
  type: 'success' | 'error'
  message: string
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true))

    // Auto-dismiss after 6s
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(onClose, 400)
    }, 6000)

    return () => clearTimeout(timer)
  }, [onClose])

  const isSuccess = type === 'success'

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 300,
        transform: visible && !exiting ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
        opacity: visible && !exiting ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
        maxWidth: '420px',
        width: '100%',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          border: '1px solid rgba(229,231,235,0.8)',
        }}
      >
        {/* Green/red accent bar at top */}
        <div
          style={{
            height: '4px',
            background: isSuccess
              ? 'linear-gradient(90deg, #05DE66, #01ABE7)'
              : 'linear-gradient(90deg, #ef4444, #f97316)',
          }}
        />
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          {/* Icon */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: isSuccess ? '#ecfdf5' : '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isSuccess ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  stroke="#05DE66"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4.001c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001C2.57 17.334 3.532 19 5.072 19z"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: '#111827' }}>
              {isSuccess ? 'Fast geschafft! 🎉' : 'Hoppla!'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>
              {message}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={() => {
              setExiting(true)
              setTimeout(onClose, 400)
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#9ca3af',
              flexShrink: 0,
            }}
            aria-label="Schliessen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [showToast, setShowToast] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email) return

    setStatus('loading')
    setMessage('')
    setShowToast(false)

    try {
      const apiUrl = import.meta.env.PUBLIC_NEWSLETTER_API_URL || '/api/newsletter'
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, siteId: 'kokomo' }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage('Bitte bestätige deine Anmeldung per E-Mail.')
        setEmail('')
        setShowToast(true)
      } else {
        setStatus('error')
        setMessage(data.error || 'Anmeldung fehlgeschlagen.')
        setShowToast(true)
      }
    } catch {
      setStatus('error')
      setMessage('Verbindung fehlgeschlagen. Bitte versuche es später erneut.')
      setShowToast(true)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="deine@email.ch"
          required
          disabled={status === 'loading'}
          className="flex-1 rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-700 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 hover:shadow-md disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
        >
          {status === 'loading' ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Wird angemeldet…
            </>
          ) : (
            'Anmelden'
          )}
        </button>
      </form>

      {showToast && (
        <Toast
          type={status === 'success' ? 'success' : 'error'}
          message={message}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  )
}
