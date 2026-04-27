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

  const handleClose = () => {
    setExiting(true)
    setTimeout(onClose, 300)
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isSuccess = type === 'success'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="newsletter-toast-title"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        opacity: visible && !exiting ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          border: '1px solid rgba(229,231,235,0.8)',
          maxWidth: '460px',
          width: '100%',
          transform: visible && !exiting ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            height: '6px',
            background: isSuccess
              ? 'linear-gradient(90deg, #05DE66, #01ABE7)'
              : 'linear-gradient(90deg, #ef4444, #f97316)',
          }}
        />
        <div style={{ padding: '32px 28px 28px', textAlign: 'center', position: 'relative' }}>
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              color: '#9ca3af',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Schliessen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: isSuccess ? '#ecfdf5' : '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            {isSuccess ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  stroke="#05DE66"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
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

          <h2
            id="newsletter-toast-title"
            style={{ margin: 0, fontWeight: 700, fontSize: '22px', color: '#111827', lineHeight: 1.3 }}
          >
            {isSuccess ? 'Bitte E-Mail-Postfach prüfen' : 'Hoppla!'}
          </h2>
          <p style={{ margin: '12px 0 0', fontSize: '16px', color: '#4b5563', lineHeight: 1.6 }}>
            {message}
          </p>

          <button
            onClick={handleClose}
            style={{
              marginTop: '24px',
              background: isSuccess ? '#03B352' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '999px',
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            Verstanden
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
        setMessage('Wir haben dir gerade einen Bestätigungslink gesendet. Bitte schau in dein E-Mail-Postfach (auch im Spam-Ordner) und klicke auf den Link, um deine Anmeldung abzuschliessen.')
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
