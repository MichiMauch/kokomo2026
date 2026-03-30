import { useState, useEffect, useRef, type FormEvent } from 'react'
import { compressImage } from '../../lib/compress-image'

// ─── Types ──────────────────────────────────────────────────

type Phase = 'checking' | 'login' | 'ready'
type Tab = 'inhalt' | 'titelbild' | 'social'
type Platform = 'facebook_page' | 'facebook_group' | 'twitter' | 'telegram' | 'whatsapp'

interface PostDetail {
  slug: string
  title: string
  summary: string
  date: string
  imageUrl: string | null
  draft: boolean
  tags: string[]
  body: string
}

interface SocialText {
  id: number
  post_slug: string
  platform: Platform
  text: string
  generated_at: string
  updated_at: string
}

interface SocialShare {
  id: number
  post_slug: string
  platform: Platform
  external_id: string | null
  external_url: string | null
  shared_at: string
}

// ─── Platform Config ────────────────────────────────────────

const PLATFORMS: { key: Platform; label: string; color: string; maxChars: number }[] = [
  { key: 'facebook_page', label: 'Facebook', color: '#1877F2', maxChars: 1200 },
  { key: 'twitter', label: 'X / Twitter', color: '#000000', maxChars: 280 },
  { key: 'telegram', label: 'Telegram', color: '#26A5E4', maxChars: 1000 },
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', maxChars: 700 },
]

// ─── Login Form ─────────────────────────────────────────────

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

// ─── Platform Panel ─────────────────────────────────────────

function PlatformPanel({
  platform,
  text,
  shares,
  slug,
  onTextSaved,
  onShared,
}: {
  platform: (typeof PLATFORMS)[number]
  text: string
  shares: SocialShare[]
  slug: string
  onTextSaved: (platform: Platform, newText: string) => void
  onShared: (share: SocialShare) => void
}) {
  const [editText, setEditText] = useState(text)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setEditText(text)
    setDirty(false)
    setMsg('')
  }, [text])

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', slug, platform: platform.key, text: editText }),
      })
      if (res.status === 401) { window.location.reload(); return }
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      setDirty(false)
      setMsg('Gespeichert!')
      onTextSaved(platform.key, editText)
      setTimeout(() => setMsg(''), 3000)
    } catch (err: any) {
      setMsg(`Fehler: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleShare() {
    setSharing(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/social-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, platform: platform.key, text: editText }),
      })
      if (res.status === 401) { window.location.reload(); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Teilen fehlgeschlagen')

      if (data.method === 'manual') {
        if (data.shareUrl) {
          window.open(data.shareUrl, '_blank')
          const openLabel = platform.key === 'facebook_page' ? 'Facebook' : 'X'
          setMsg(`${openLabel} geöffnet!`)
        } else if (data.copyUrl) {
          await navigator.clipboard.writeText(editText.replace(/\{url\}/g, `https://www.kokomo.house/tiny-house/${slug.replace(/\.md$/, '')}/`))
          window.open(data.copyUrl, '_blank')
          const label = platform.key === 'whatsapp' ? 'Kanal' : 'Facebook'
          setMsg(`Text kopiert! ${label} geöffnet.`)
        }
      } else {
        setMsg(data.external_url ? 'Gepostet!' : 'Gesendet!')
      }

      const newShare: SocialShare = {
        id: Date.now(),
        post_slug: slug,
        platform: platform.key,
        external_id: null,
        external_url: data.external_url || null,
        shared_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      }
      onShared(newShare)
      setTimeout(() => setMsg(''), 5000)
    } catch (err: any) {
      setMsg(`Fehler: ${err.message}`)
    } finally {
      setSharing(false)
    }
  }

  const charCount = editText.length
  const overLimit = charCount > platform.maxChars

  let shareLabel = 'Teilen'
  if (platform.key === 'facebook_page') shareLabel = 'Kopieren & auf Facebook teilen'
  else if (platform.key === 'twitter') shareLabel = 'Auf X öffnen'
  else if (platform.key === 'whatsapp') shareLabel = 'Kopieren & Kanal öffnen'

  const latestShare = shares.length > 0 ? shares[0] : null

  return (
    <div className="rounded-xl border border-slate-200/60 p-4 dark:border-slate-700/40">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: platform.color }} />
        <span className="text-sm font-semibold text-[var(--text)]">{platform.label}</span>
        <span className={`ml-auto text-xs ${overLimit ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
          {charCount} / {platform.maxChars}
        </span>
      </div>

      <textarea
        value={editText}
        onChange={(e) => { setEditText(e.target.value); setDirty(true); setMsg('') }}
        rows={platform.key === 'twitter' ? 3 : 5}
        placeholder={`${platform.label}-Text…`}
        className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        )}
        {editText.trim() && (
          <button
            onClick={handleShare}
            disabled={sharing || saving}
            className="rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: platform.color }}
          >
            {sharing ? 'Wird geteilt…' : shareLabel}
          </button>
        )}
        {msg && (
          <span className={`text-xs ${msg.startsWith('Fehler') ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {msg}
          </span>
        )}
      </div>

      {latestShare && (
        <div className="mt-2 text-xs text-[var(--text-secondary)]">
          Geteilt am {formatDate(latestShare.shared_at)}
          {latestShare.external_url && (
            <>
              {' — '}
              <a href={latestShare.external_url} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                Ansehen
              </a>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helper ─────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z')
    return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// ─── Tab: Inhalt ────────────────────────────────────────────

function TabInhalt({
  post,
  onPostChanged,
}: {
  post: PostDetail
  onPostChanged: (changes: Partial<PostDetail>) => void
}) {
  const [editTitle, setEditTitle] = useState(post.title)
  const [editSummary, setEditSummary] = useState(post.summary)
  const [editTags, setEditTags] = useState(post.tags.join(', '))
  const [editDraft, setEditDraft] = useState(post.draft)
  const [editBody, setEditBody] = useState(post.body)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const inlineFileRef = useRef<HTMLInputElement>(null)

  // Sync when post prop changes (e.g. after reload)
  useEffect(() => {
    setEditTitle(post.title)
    setEditSummary(post.summary)
    setEditTags(post.tags.join(', '))
    setEditDraft(post.draft)
    setEditBody(post.body)
    setDirty(false)
    setSaveMsg('')
  }, [post.slug])

  function markDirty() {
    setDirty(true)
    setSaveMsg('')
  }

  function isDirty() {
    return dirty
  }

  // Expose isDirty via window for unsaved-changes guard
  useEffect(() => {
    (window as any).__inhaltDirty = isDirty
    return () => { delete (window as any).__inhaltDirty }
  })

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    try {
      const tags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const res = await fetch('/api/admin/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: post.slug,
          title: editTitle,
          summary: editSummary,
          tags,
          draft: editDraft,
          body: editBody,
        }),
      })
      if (res.status === 401) { window.location.reload(); return }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Speichern fehlgeschlagen')
      }

      setDirty(false)
      setSaveMsg('Gespeichert!')
      setTimeout(() => setSaveMsg(''), 3000)
      onPostChanged({ title: editTitle, summary: editSummary, tags, draft: editDraft, body: editBody })
    } catch (err: any) {
      setSaveMsg(`Fehler: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleInlineImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploadingImage(true)
    try {
      const dataUrl = await compressImage(file)
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: post.slug, image_base64: dataUrl }),
      })
      if (res.status === 401) { window.location.reload(); return }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload fehlgeschlagen')
      }
      const data = await res.json()
      const markdown = `![](${data.url})`

      const textarea = bodyRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const before = editBody.slice(0, start)
        const after = editBody.slice(start)
        const newBody = before + (before.endsWith('\n') || before === '' ? '' : '\n') + markdown + '\n' + after
        setEditBody(newBody)
        markDirty()
        setTimeout(() => {
          textarea.focus()
          const pos = before.length + markdown.length + 2
          textarea.setSelectionRange(pos, pos)
        }, 50)
      } else {
        setEditBody((prev) => prev + '\n' + markdown + '\n')
        markDirty()
      }
    } catch (err: any) {
      alert(err.message || 'Bild-Upload fehlgeschlagen')
    } finally {
      setUploadingImage(false)
    }
  }

  const wordCount = editBody.trim() ? editBody.trim().split(/\s+/).length : 0
  const summaryLen = editSummary.length

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          Titel <span className="text-slate-400">({editTitle.length} Zeichen)</span>
        </label>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => { setEditTitle(e.target.value); markDirty() }}
          className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Summary */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          Summary{' '}
          <span className={summaryLen >= 160 && summaryLen <= 180 ? 'text-emerald-500' : summaryLen > 180 ? 'text-red-500' : 'text-slate-400'}>
            ({summaryLen} Zeichen, ideal: 160–180)
          </span>
        </label>
        <textarea
          value={editSummary}
          onChange={(e) => { setEditSummary(e.target.value); markDirty() }}
          rows={3}
          className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Tags (kommagetrennt)</label>
        <input
          type="text"
          value={editTags}
          onChange={(e) => { setEditTags(e.target.value); markDirty() }}
          placeholder="tiny-house, vanlife, reisen"
          className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Draft toggle */}
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={editDraft}
          onChange={(e) => { setEditDraft(e.target.checked); markDirty() }}
          className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-400"
        />
        Draft (nicht veröffentlicht)
      </label>

      {/* Body editor */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Body <span className="text-slate-400">({wordCount} Wörter)</span>
          </label>
          <label className="cursor-pointer rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">
            {uploadingImage ? 'Bild wird optimiert…' : 'Bild einfügen'}
            <input
              ref={inlineFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingImage}
              onChange={handleInlineImage}
            />
          </label>
        </div>
        <textarea
          ref={bodyRef}
          value={editBody}
          onChange={(e) => { setEditBody(e.target.value); markDirty() }}
          rows={20}
          className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 font-mono text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
      </div>

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-full bg-primary-700px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
        >
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
        {saveMsg && (
          <span className={`text-xs ${saveMsg.startsWith('Fehler') ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {saveMsg}
          </span>
        )}
        {dirty && !saveMsg && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Ungespeicherte Änderungen</span>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Titelbild ─────────────────────────────────────────

function TabTitelbild({
  post,
  onImageUpdated,
}: {
  post: PostDetail
  onImageUpdated: (newUrl: string) => void
}) {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [enhancePrompt, setEnhancePrompt] = useState('')
  const [imageStatus, setImageStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [imageError, setImageError] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressImage(file)
      setPhotoBase64(dataUrl)
      setImageStatus('idle')
      setImageError('')
    } catch (err: any) {
      alert(err.message || 'Foto konnte nicht geladen werden')
    }
    e.target.value = ''
  }

  async function handleEnhance() {
    if (!photoBase64) return
    setImageStatus('processing')
    setImageError('')
    try {
      const res = await fetch('/api/admin/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: post.slug,
          photo_base64: photoBase64,
          image_prompt: enhancePrompt || undefined,
        }),
      })
      if (res.status === 401) { window.location.reload(); return }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Verarbeitung fehlgeschlagen')
      }
      const data = await res.json()
      onImageUpdated(data.imageUrl)
      setPhotoBase64(null)
      setEnhancePrompt('')
      setImageStatus('done')
      setTimeout(() => setImageStatus('idle'), 3000)
    } catch (err: any) {
      setImageError(err.message)
      setImageStatus('error')
    }
  }

  return (
    <div className="space-y-4">
      {/* Current image */}
      {post.imageUrl && (
        <div className="overflow-hidden rounded-xl">
          <img src={post.imageUrl} alt="Titelbild" className="w-full max-w-xl rounded-xl" />
        </div>
      )}
      {!post.imageUrl && (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-600">
          Kein Titelbild vorhanden
        </div>
      )}

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">
          Foto hochladen
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={imageStatus === 'processing'}
            onChange={handleFileChange}
          />
        </label>

        {photoBase64 && (
          <>
            <img src={photoBase64} alt="Vorschau" className="h-12 w-20 rounded object-cover" />
            <button
              type="button"
              onClick={() => { setPhotoBase64(null); setImageStatus('idle') }}
              className="text-xs text-red-500 hover:underline"
            >
              Entfernen
            </button>
          </>
        )}
      </div>

      {photoBase64 && (
        <div className="space-y-2">
          <input
            type="text"
            value={enhancePrompt}
            onChange={(e) => setEnhancePrompt(e.target.value)}
            placeholder="Verbesserungsanweisungen (optional)"
            disabled={imageStatus === 'processing'}
            className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
          />
          <button
            onClick={handleEnhance}
            disabled={imageStatus === 'processing'}
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-600 disabled:opacity-50"
          >
            {imageStatus === 'processing' ? 'Foto wird veredelt…' : 'Veredeln & Speichern'}
          </button>
        </div>
      )}

      {imageStatus === 'done' && (
        <div className="text-sm text-emerald-600 dark:text-emerald-400">Titelbild aktualisiert!</div>
      )}
      {imageStatus === 'error' && imageError && (
        <div className="text-sm text-red-600 dark:text-red-400">{imageError}</div>
      )}
    </div>
  )
}

// ─── Tab: Social Media ──────────────────────────────────────

function TabSocial({
  slug,
  texts: initialTexts,
  shares: initialShares,
}: {
  slug: string
  texts: SocialText[]
  shares: SocialShare[]
}) {
  const [texts, setTexts] = useState(initialTexts)
  const [shares, setShares] = useState(initialShares)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  useEffect(() => {
    setTexts(initialTexts)
    setShares(initialShares)
  }, [initialTexts, initialShares])

  async function handleGenerate() {
    setGenerating(true)
    setGenError('')
    try {
      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', slug }),
      })
      if (res.status === 401) { window.location.reload(); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generierung fehlgeschlagen')
      setTexts(data.texts || [])
    } catch (err: any) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function handleTextSaved(platform: Platform, newText: string) {
    setTexts((prev) => prev.map((t) => (t.platform === platform ? { ...t, text: newText } : t)))
  }

  function handleShared(share: SocialShare) {
    setShares((prev) => [share, ...prev])
  }

  function getTextForPlatform(key: Platform): string {
    return texts.find((t) => t.platform === key)?.text ?? ''
  }

  function getSharesForPlatform(key: Platform): SocialShare[] {
    return shares.filter((s) => s.platform === key)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-full bg-primary-700px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
        >
          {generating ? 'Texte werden generiert…' : texts.length > 0 ? 'Neu generieren' : 'Texte generieren'}
        </button>
        {genError && (
          <span className="text-xs text-red-600 dark:text-red-400">{genError}</span>
        )}
      </div>

      {texts.length > 0 ? (
        <div className="space-y-3">
          {PLATFORMS.map((p) => (
            <PlatformPanel
              key={p.key}
              platform={p}
              text={getTextForPlatform(p.key)}
              shares={getSharesForPlatform(p.key)}
              slug={slug}
              onTextSaved={handleTextSaved}
              onShared={handleShared}
            />
          ))}
        </div>
      ) : !generating ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Noch keine Texte generiert. Klicke auf "Texte generieren" um loszulegen.
        </p>
      ) : null}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export default function AdminPostDetail({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [post, setPost] = useState<PostDetail | null>(null)
  const [socialTexts, setSocialTexts] = useState<SocialText[]>([])
  const [socialShares, setSocialShares] = useState<SocialShare[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Tab from hash
  function getTabFromHash(): Tab {
    if (typeof window === 'undefined') return 'inhalt'
    const hash = window.location.hash.replace('#', '')
    if (hash === 'titelbild' || hash === 'social') return hash
    return 'inhalt'
  }

  const [activeTab, setActiveTab] = useState<Tab>(getTabFromHash)

  // Listen for hash changes
  useEffect(() => {
    function onHashChange() {
      setActiveTab(getTabFromHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function switchTab(tab: Tab) {
    // Check for unsaved changes in Inhalt tab
    if (activeTab === 'inhalt' && tab !== 'inhalt') {
      const isDirty = (window as any).__inhaltDirty
      if (isDirty && isDirty() && !confirm('Ungespeicherte Änderungen verwerfen?')) return
    }
    setActiveTab(tab)
    window.history.replaceState(null, '', tab === 'inhalt' ? window.location.pathname : `#${tab}`)
  }

  // Auth check + data load
  useEffect(() => {
    fetch('/api/admin/comments')
      .then((res) => {
        if (res.status === 401) {
          setPhase('login')
        } else {
          setPhase('ready')
          loadData()
        }
      })
      .catch(() => setPhase('login'))
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [postRes, socialRes] = await Promise.all([
        fetch(`/api/admin/posts?slug=${slug}`),
        fetch(`/api/admin/social?slug=${slug}`),
      ])

      if (postRes.status === 401 || socialRes.status === 401) {
        setPhase('login')
        return
      }

      if (!postRes.ok) throw new Error('Post konnte nicht geladen werden')

      const postData: PostDetail = await postRes.json()
      setPost(postData)

      if (socialRes.ok) {
        const socialData = await socialRes.json()
        setSocialTexts(socialData.texts || [])
        setSocialShares(socialData.shares || [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleLogin() {
    setPhase('ready')
    loadData()
  }

  function handlePostChanged(changes: Partial<PostDetail>) {
    setPost((prev) => prev ? { ...prev, ...changes } : prev)
  }

  function handleImageUpdated(newUrl: string) {
    setPost((prev) => prev ? { ...prev, imageUrl: newUrl } : prev)
  }

  async function handleDelete() {
    if (!post) return
    if (!confirm(`Post "${post.title}" unwiderruflich löschen?`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: post.slug }),
      })
      if (res.status === 401) { window.location.reload(); return }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Löschen fehlgeschlagen')
      }
      window.location.href = '/admin/posts'
    } catch (err: any) {
      alert(err.message || 'Löschen fehlgeschlagen')
      setDeleting(false)
    }
  }

  if (phase === 'checking') {
    return <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Wird geladen…</div>
  }

  if (phase === 'login') {
    return <LoginForm onLogin={handleLogin} />
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
        <div className="mt-3 text-sm text-[var(--text-secondary)]">Post wird geladen…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
        <a href="/admin/posts" className="text-sm text-primary-500 hover:underline">
          ← Alle Posts
        </a>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="space-y-4">
        <div className="py-8 text-center text-sm text-[var(--text-secondary)]">Post nicht gefunden.</div>
        <a href="/admin/posts" className="text-sm text-primary-500 hover:underline">
          ← Alle Posts
        </a>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'inhalt', label: 'Inhalt' },
    { key: 'titelbild', label: 'Titelbild' },
    { key: 'social', label: 'Social Media' },
  ]

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="/admin/posts" className="mb-2 inline-block text-sm text-primary-500 hover:underline">
            ← Alle Posts
          </a>
          <h2 className="text-xl font-bold text-[var(--text)]">{post.title}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>{post.slug}</span>
            <span>·</span>
            <span>{post.date}</span>
            {post.draft && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Post löschen"
          className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-red-800/50 dark:hover:bg-red-900/20"
        >
          {deleting ? 'Wird gelöscht…' : 'Löschen'}
        </button>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 border-b border-slate-200/60 dark:border-slate-700/40">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}
      <div className="glass-card rounded-2xl p-6 shadow-sm">
        {activeTab === 'inhalt' && (
          <TabInhalt post={post} onPostChanged={handlePostChanged} />
        )}
        {activeTab === 'titelbild' && (
          <TabTitelbild post={post} onImageUpdated={handleImageUpdated} />
        )}
        {activeTab === 'social' && (
          <TabSocial slug={post.slug} texts={socialTexts} shares={socialShares} />
        )}
      </div>
    </div>
  )
}
