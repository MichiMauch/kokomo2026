import { useState, useEffect, type FormEvent } from 'react'

const STORAGE_KEY = 'newsletter-popup-dismissed'
const DISMISS_DAYS = 2
const SHOW_DELAY_MS = 30_000

export default function NewsletterPopup() {
  const [visible, setVisible] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return
    }

    const timer = setTimeout(() => {
      setVisible(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)))
    }, SHOW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [])

  function dismiss() {
    setAnimateIn(false)
    setTimeout(() => {
      setVisible(false)
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
    }, 300)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email) return

    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage(data.message || 'Bitte bestätige deine Anmeldung per E-Mail.')
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || 'Anmeldung fehlgeschlagen.')
      }
    } catch {
      setStatus('error')
      setMessage('Verbindung fehlgeschlagen. Bitte versuche es später erneut.')
    }
  }

  if (!visible) return null

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: animateIn ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        backdropFilter: animateIn ? 'blur(4px)' : 'blur(0px)',
        transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          transform: animateIn ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          opacity: animateIn ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
        }}
        className="dark:!bg-slate-800/90 dark:!border-slate-700/50"
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 10,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            color: 'white',
            transition: 'background 0.2s',
          }}
          aria-label="Schliessen"
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.4)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Photo */}
        <div style={{ width: '100%', height: '200px', overflow: 'hidden' }}>
          <img
            src="https://pub-29ede69a4da644b9b81fa3dd5f8e9d6a.r2.dev/TinyHouse_170722_21.webp"
            alt="Sibylle & Michi von KOKOMO"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
            loading="eager"
          />
        </div>

        {/* Content */}
        <div style={{ padding: '24px 28px 28px' }}>
          {status === 'success' ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#05DE66" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 600 }} className="text-slate-900 dark:text-white">
                Fast geschafft!
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: 1.6 }} className="text-slate-600 dark:text-slate-300">
                {message}
              </p>
            </div>
          ) : (
            <>
              <h3
                style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, lineHeight: 1.3 }}
                className="text-slate-900 dark:text-white"
              >
                Bleib auf dem Laufenden!
              </h3>
              <p
                style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.6 }}
                className="text-slate-600 dark:text-slate-300"
              >
                Wir sind Sibylle & Michi — Wir schreiben dir, wenn es etwas Neues gibt — sei es ein neuer Blogpost,
                eine spannende Erfahrung oder ein praktischer Tipp aus unserem Alltag im Tiny House.
                Du kannst dich jederzeit wieder abmelden.
              </p>

              {status === 'error' && (
                <div
                  style={{
                    marginBottom: '14px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                  }}
                >
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deine@email.ch"
                  required
                  disabled={status === 'loading'}
                  className="rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-700/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
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
                    'Newsletter abonnieren'
                  )}
                </button>
              </form>

            </>
          )}
        </div>
      </div>
    </div>
  )
}
