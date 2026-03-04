import { useState, type FormEvent } from 'react'

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

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
        setMessage(data.message)
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
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
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

      {status === 'success' && (
        <div className="mt-4 rounded-xl border border-green-200/50 bg-green-50/60 px-4 py-3 text-sm text-green-700 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-300">
          {message}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {message}
        </div>
      )}
    </div>
  )
}
