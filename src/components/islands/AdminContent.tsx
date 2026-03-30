import React, { useState, useEffect, useRef, type FormEvent } from 'react'
import { compressImage } from '../../lib/compress-image'

// ─── Types ───────────────────────────────────────────────────

interface Suggestion {
  title: string
  description: string
  tags: string[]
  timing: string
  seo_keywords: string[]
  key_points: string[]
}

interface PostDraft {
  title: string
  summary: string
  tags: string[]
  body: string
  image_prompt: string
  photo_base64?: string
}

interface PublishResult {
  slug: string
  imageUrl: string | null
  githubUrl: string
  postUrl: string
  imageError?: string
}

type Phase = 'checking' | 'login' | 'idle' | 'suggesting' | 'suggestions' | 'generating' | 'editor' | 'publishing' | 'published'

// ─── Login Form ──────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        onLogin()
      } else {
        const data = await res.json()
        setError(data.error || 'Login fehlgeschlagen.')
      }
    } catch {
      setError('Verbindung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="glass-card rounded-2xl p-8 shadow-lg">
        <h2 className="mb-6 text-center text-xl font-semibold text-[var(--text)]">Admin Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail"
            required
            disabled={loading}
            className="w-full rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort"
            required
            disabled={loading}
            className="w-full rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary-700px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 hover:shadow-md disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
          >
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-center text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Suggestion Card ─────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onSelect,
  disabled,
}: {
  suggestion: Suggestion
  onSelect: () => void
  disabled: boolean
}) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <h3 className="mb-2 text-base font-semibold text-[var(--text)]">{suggestion.title}</h3>
      <p className="mb-3 text-sm leading-relaxed text-[var(--text-secondary)]">{suggestion.description}</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {suggestion.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          >
            {tag}
          </span>
        ))}
      </div>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">{suggestion.timing}</p>
      <button
        onClick={onSelect}
        disabled={disabled}
        className="rounded-full bg-primary-700px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
      >
        Ausarbeiten
      </button>
    </div>
  )
}

// ─── Editor ──────────────────────────────────────────────────

function PostEditor({
  draft,
  onChange,
  onPublish,
  onBack,
  publishing,
  targetWordCount,
}: {
  draft: PostDraft
  onChange: (d: PostDraft) => void
  onPublish: () => void
  onBack: () => void
  publishing: boolean
  targetWordCount: number
}) {
  const wordCount = draft.body.trim().split(/\s+/).filter(Boolean).length
  const summaryLen = draft.summary.length
  const isInRange = wordCount >= targetWordCount * 0.9 && wordCount <= targetWordCount * 1.1

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          disabled={publishing}
          className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          Zurück
        </button>
        <h2 className="text-lg font-semibold text-[var(--text)]">Post bearbeiten</h2>
      </div>

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          Titel ({draft.title.length}/60)
        </label>
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          disabled={publishing}
          className="w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Summary */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          Summary ({summaryLen}/180)
          {summaryLen < 160 && <span className="ml-2 text-amber-500">zu kurz</span>}
          {summaryLen > 180 && <span className="ml-2 text-red-500">zu lang</span>}
        </label>
        <textarea
          value={draft.summary}
          onChange={(e) => onChange({ ...draft, summary: e.target.value })}
          rows={2}
          disabled={publishing}
          className="w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          Tags (kommagetrennt)
        </label>
        <input
          value={draft.tags.join(', ')}
          onChange={(e) =>
            onChange({
              ...draft,
              tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
            })
          }
          disabled={publishing}
          className="w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Body */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          Body (<span className={isInRange ? 'text-emerald-500' : 'text-amber-500'}>{wordCount}</span> / {targetWordCount} Wörter)
        </label>
        <textarea
          value={draft.body}
          onChange={(e) => onChange({ ...draft, body: e.target.value })}
          rows={18}
          disabled={publishing}
          className="w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 font-mono text-sm leading-relaxed text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Photo Upload */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          Eigenes Foto hochladen (optional)
        </label>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">
            Foto wählen
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={publishing}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const dataUrl = await compressImage(file)
                  onChange({ ...draft, photo_base64: dataUrl })
                } catch (err: any) {
                  alert(err.message || 'Foto konnte nicht geladen werden')
                }
                e.target.value = ''
              }}
            />
          </label>
          {draft.photo_base64 && (
            <>
              <img
                src={draft.photo_base64}
                alt="Vorschau"
                className="h-16 w-24 rounded-lg object-cover shadow-sm"
              />
              <button
                type="button"
                onClick={() => onChange({ ...draft, photo_base64: undefined })}
                className="text-xs text-red-500 hover:underline"
              >
                Entfernen
              </button>
            </>
          )}
        </div>
      </div>

      {/* Image Prompt */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          {draft.photo_base64 ? 'Verbesserungsanweisungen (optional)' : 'Bild-Prompt (leer lassen = kein Bild)'}
        </label>
        <textarea
          value={draft.image_prompt}
          onChange={(e) => onChange({ ...draft, image_prompt: e.target.value })}
          rows={2}
          disabled={publishing}
          placeholder={draft.photo_base64 ? 'z.B. "Mehr Wärme, Bokeh verstärken"' : 'Szene beschreiben…'}
          className="w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Publish */}
      <div className="flex gap-3">
        <button
          onClick={onPublish}
          disabled={publishing || !draft.title || !draft.summary || !draft.body || draft.tags.length === 0}
          className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-600 hover:shadow-md disabled:opacity-50"
        >
          {publishing ? 'Wird publiziert…' : 'Publizieren'}
        </button>
        <button
          onClick={() => onPublish()}
          disabled={publishing || !draft.title || !draft.summary || !draft.body || draft.tags.length === 0 || !draft.image_prompt}
          className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          style={{ display: 'none' }}
        >
          Ohne Bild publizieren
        </button>
      </div>
    </div>
  )
}

// ─── Word Count Selector ─────────────────────────────────────

const WORD_COUNT_OPTIONS = [350, 700, 1200] as const
type WordCountOption = typeof WORD_COUNT_OPTIONS[number]

function WordCountSelector({ value, onChange }: { value: WordCountOption; onChange: (v: WordCountOption) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-[var(--text-secondary)]">Wortanzahl:</span>
      <div className="flex gap-1">
        {WORD_COUNT_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value === opt
                ? 'bg-primary-700text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Post Type Selector ──────────────────────────────────────

const POST_TYPES = [
  { value: 'erzaehlung', label: 'Erzählung', icon: '📖' },
  { value: 'listenpost', label: 'Listen-Post', icon: '📋' },
  { value: 'anleitung', label: 'Anleitung', icon: '🔧' },
  { value: 'erfahrungsbericht', label: 'Erfahrungsbericht', icon: '💡' },
] as const
type PostType = typeof POST_TYPES[number]['value']

function PostTypeSelector({ value, onChange }: { value: PostType; onChange: (v: PostType) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-[var(--text-secondary)]">Post-Typ:</span>
      <div className="flex flex-wrap gap-1">
        {POST_TYPES.map((pt) => (
          <button
            key={pt.value}
            onClick={() => onChange(pt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value === pt.value
                ? 'bg-primary-700text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {pt.icon} {pt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────

export default function AdminContent() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [draft, setDraft] = useState<PostDraft>({ title: '', summary: '', tags: [], body: '', image_prompt: '' })
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [customTopic, setCustomTopic] = useState('')
  const [wordCount, setWordCount] = useState<WordCountOption>(700)
  const [postType, setPostType] = useState<PostType>('erzaehlung')
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [customInstructions, setCustomInstructions] = useState('')
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const speechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = 'de-DE'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim()
          if (transcript) {
            setCustomTopic((prev) => (prev ? prev + ' ' : '') + transcript)
          }
        }
      }
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // Check auth on mount
  useEffect(() => {
    fetch('/api/admin/comments')
      .then((res) => {
        setPhase(res.status === 401 ? 'login' : 'idle')
      })
      .catch(() => setPhase('login'))
  }, [])

  function handleLogin() {
    setPhase('idle')
  }

  async function handleSuggest() {
    setPhase('suggesting')
    setError('')
    try {
      const res = await fetch('/api/admin/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.status === 401) {
        setPhase('login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Fehler beim Laden der Vorschläge')
      }
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setPhase('suggestions')
    } catch (err: any) {
      setError(err.message)
      setPhase('idle')
    }
  }

  async function handleGenerate(suggestion?: Suggestion) {
    setPhase('generating')
    setError('')
    try {
      const payload = suggestion
        ? {
            title: suggestion.title,
            description: suggestion.description,
            tags: suggestion.tags,
            key_points: suggestion.key_points,
            word_count: wordCount,
            post_type: postType,
            ...(customInstructions.trim() && { custom_instructions: customInstructions.trim() }),
          }
        : {
            title: customTopic,
            description: customTopic,
            tags: [],
            word_count: wordCount,
            post_type: postType,
          }

      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) {
        setPhase('login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Fehler beim Generieren')
      }
      const data = await res.json()
      setDraft({
        title: data.title || '',
        summary: data.summary || '',
        tags: data.tags || [],
        body: data.body || '',
        image_prompt: data.image_prompt || '',
      })
      setPhase('editor')
    } catch (err: any) {
      setError(err.message)
      setPhase('suggestions')
    }
  }

  async function handlePublish() {
    setPhase('publishing')
    setError('')
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          summary: draft.summary,
          tags: draft.tags,
          body: draft.body,
          image_prompt: draft.image_prompt || undefined,
          photo_base64: draft.photo_base64 || undefined,
        }),
      })
      if (res.status === 401) {
        setPhase('login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Publizierung fehlgeschlagen')
      }
      const data: PublishResult = await res.json()
      setPublishResult(data)
      setPhase('published')
    } catch (err: any) {
      setError(err.message)
      setPhase('editor')
    }
  }

  function handleReset() {
    setPhase('idle')
    setSuggestions([])
    setDraft({ title: '', summary: '', tags: [], body: '', image_prompt: '', photo_base64: undefined })
    setPublishResult(null)
    setCustomTopic('')
    setPostType('erzaehlung')
    setSelectedSuggestion(null)
    setCustomInstructions('')
    setError('')
  }

  // ─── Render ────────────────────────────────────────────────

  if (phase === 'checking') {
    return <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Wird geladen…</div>
  }

  if (phase === 'login') {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">
            schliessen
          </button>
        </div>
      )}

      {/* ── Idle ── */}
      {phase === 'idle' && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">Neuen Blogpost erstellen</h2>
            <button
              onClick={handleSuggest}
              className="rounded-full bg-primary-700px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 hover:shadow-md"
            >
              Themen vorschlagen
            </button>
          </div>

          <div className="glass-card rounded-2xl p-6 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-[var(--text)]">Eigenes Thema</h3>
            <div className="relative mb-3">
              <textarea
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Beschreibe das gewünschte Thema…"
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 pr-12 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
                  className={`absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                    isListening
                      ? 'animate-pulse bg-red-500 text-white shadow-md'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
                  }`}
                >
                  {isListening ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2Z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <div className="mb-3 space-y-3">
              <WordCountSelector value={wordCount} onChange={setWordCount} />
              <PostTypeSelector value={postType} onChange={setPostType} />
            </div>
            <button
              onClick={() => handleGenerate()}
              disabled={!customTopic.trim()}
              className="rounded-full bg-primary-700px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 hover:shadow-md disabled:opacity-50"
            >
              Post generieren
            </button>
          </div>
        </div>
      )}

      {/* ── Suggesting ── */}
      {phase === 'suggesting' && (
        <div className="py-12 text-center">
          <div className="mb-3 text-sm text-[var(--text-secondary)]">Themen werden analysiert…</div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
        </div>
      )}

      {/* ── Suggestions ── */}
      {phase === 'suggestions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Zurück
            </button>
            <h2 className="text-lg font-semibold text-[var(--text)]">Themen-Vorschläge</h2>
            <button
              onClick={handleSuggest}
              className="ml-auto rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Neu generieren
            </button>
          </div>
          {suggestions.map((s, i) => (
            <React.Fragment key={i}>
              <SuggestionCard
                suggestion={s}
                onSelect={() => { setSelectedSuggestion(s); setCustomInstructions('') }}
                disabled={phase !== 'suggestions'}
              />
              {selectedSuggestion === s && (
                <div className="glass-card rounded-2xl p-6 shadow-sm">
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Eigene Erfahrungen, Stichworte oder Anweisungen…"
                    rows={3}
                    className="mb-4 w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
                  />
                  <div className="mb-4 space-y-3">
                    <WordCountSelector value={wordCount} onChange={setWordCount} />
                    <PostTypeSelector value={postType} onChange={setPostType} />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleGenerate(selectedSuggestion)}
                      className="rounded-full bg-primary-700px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 hover:shadow-md"
                    >
                      Post generieren
                    </button>
                    <button
                      onClick={() => setSelectedSuggestion(null)}
                      className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── Generating ── */}
      {phase === 'generating' && (
        <div className="py-12 text-center">
          <div className="mb-3 text-sm text-[var(--text-secondary)]">Post wird generiert…</div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
        </div>
      )}

      {/* ── Editor ── */}
      {phase === 'editor' && (
        <PostEditor
          draft={draft}
          onChange={setDraft}
          onPublish={handlePublish}
          onBack={() => setPhase(suggestions.length > 0 ? 'suggestions' : 'idle')}
          publishing={false}
          targetWordCount={wordCount}
        />
      )}

      {/* ── Publishing ── */}
      {phase === 'publishing' && (
        <div className="py-12 text-center">
          <div className="mb-3 text-sm text-[var(--text-secondary)]">
            {draft.photo_base64
              ? 'Foto wird veredelt & Post wird publiziert…'
              : draft.image_prompt
                ? 'Bild wird generiert & Post wird publiziert…'
                : 'Post wird publiziert…'}
          </div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-500" />
          <p className="mt-4 text-xs text-[var(--text-secondary)]">
            Das kann bis zu 60 Sekunden dauern.
          </p>
        </div>
      )}

      {/* ── Published ── */}
      {phase === 'published' && publishResult && (
        <div className="glass-card mx-auto max-w-lg rounded-2xl p-8 text-center shadow-lg">
          <div className="mb-4 text-4xl">✅</div>
          <h2 className="mb-2 text-xl font-semibold text-[var(--text)]">Post publiziert!</h2>
          <p className="mb-6 text-sm text-[var(--text-secondary)]">
            Der Post wurde auf GitHub committed. Vercel deployt automatisch.
          </p>
          {publishResult.imageUrl && (
            <div className="mb-4">
              <img
                src={publishResult.imageUrl}
                alt="Header"
                className="mx-auto rounded-xl shadow-md"
                style={{ maxWidth: '100%', maxHeight: 300 }}
              />
            </div>
          )}
          {publishResult.imageError && (
            <div className="mb-4 rounded-xl border border-amber-200/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
              {publishResult.imageError}
            </div>
          )}
          <div className="mb-6 space-y-2 text-sm">
            <a
              href={publishResult.githubUrl}
              target="_blank"
              rel="noopener"
              className="block text-primary-500 hover:underline"
            >
              GitHub ansehen
            </a>
            <a
              href={publishResult.postUrl}
              target="_blank"
              rel="noopener"
              className="block text-primary-500 hover:underline"
            >
              {publishResult.postUrl}
            </a>
          </div>
          <button
            onClick={handleReset}
            className="rounded-full bg-primary-700px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 hover:shadow-md"
          >
            Neuen Post erstellen
          </button>
        </div>
      )}
    </div>
  )
}
