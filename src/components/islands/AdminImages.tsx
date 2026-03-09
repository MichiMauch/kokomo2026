import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react'
import { compressImage } from '../../lib/compress-image'

interface PostInfo {
  slug: string
  title: string
  date: string
  imageUrl: string | null
  draft: boolean
  tags: string[]
}

interface PostDetail extends PostInfo {
  summary: string
  body: string
}

type Phase = 'checking' | 'login' | 'ready'

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
            className="w-full rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
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

// ─── Post Card ──────────────────────────────────────────────

function PostCard({
  post,
  onUpdated,
  onPostInfoChanged,
}: {
  post: PostInfo
  onUpdated: (slug: string, newUrl: string) => void
  onPostInfoChanged: (slug: string, changes: Partial<PostInfo>) => void
}) {
  // Titelbild state
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [enhancePrompt, setEnhancePrompt] = useState('')
  const [imageStatus, setImageStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [imageError, setImageError] = useState('')

  // Expanded editor state
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<PostDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Inline image upload
  const [uploadingImage, setUploadingImage] = useState(false)

  // Editor fields
  const [editTitle, setEditTitle] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editDraft, setEditDraft] = useState(false)
  const [editBody, setEditBody] = useState('')

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const inlineFileRef = useRef<HTMLInputElement>(null)

  async function handleExpand() {
    if (expanded) {
      if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return
      setExpanded(false)
      setDetail(null)
      setDirty(false)
      setSaveMsg('')
      return
    }

    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/posts?slug=${post.slug}`)
      if (res.status === 401) { window.location.reload(); return }
      if (!res.ok) throw new Error('Post konnte nicht geladen werden')
      const data: PostDetail = await res.json()
      setDetail(data)
      setEditTitle(data.title)
      setEditSummary(data.summary)
      setEditTags(data.tags.join(', '))
      setEditDraft(data.draft)
      setEditBody(data.body)
      setExpanded(true)
      setDirty(false)
      setSaveMsg('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingDetail(false)
    }
  }

  function markDirty() {
    setDirty(true)
    setSaveMsg('')
  }

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

      // Update list info
      onPostInfoChanged(post.slug, {
        title: editTitle,
        tags,
        draft: editDraft,
      })
    } catch (err: any) {
      setSaveMsg(`Fehler: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ─── Titelbild handlers (unchanged logic) ───

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
      onUpdated(post.slug, data.imageUrl)
      setPhotoBase64(null)
      setEnhancePrompt('')
      setImageStatus('done')
      setTimeout(() => setImageStatus('idle'), 3000)
    } catch (err: any) {
      setImageError(err.message)
      setImageStatus('error')
    }
  }

  // ─── Inline image upload ───

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

      // Insert at cursor position
      const textarea = bodyRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const before = editBody.slice(0, start)
        const after = editBody.slice(start)
        const newBody = before + (before.endsWith('\n') || before === '' ? '' : '\n') + markdown + '\n' + after
        setEditBody(newBody)
        markDirty()
        // Restore focus
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
    <div className="glass-card rounded-2xl shadow-sm">
      {/* ─── Collapsed view ─── */}
      <div className="flex items-center gap-4 p-5">
        {/* Thumbnail */}
        <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          {post.imageUrl ? (
            <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">Kein Bild</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--text)]">{post.title}</h3>
            {post.draft && (
              <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>
          <p className="mb-1 text-xs text-[var(--text-secondary)]">{post.slug}</p>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700/50 dark:text-slate-400"
                >
                  {tag}
                </span>
              ))}
              {post.tags.length > 5 && (
                <span className="text-[10px] text-slate-400">+{post.tags.length - 5}</span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleExpand}
          disabled={loadingDetail}
          className="flex-shrink-0 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          {loadingDetail ? 'Laden…' : expanded ? 'Zuklappen' : 'Bearbeiten'}
        </button>
      </div>

      {/* ─── Expanded editor ─── */}
      {expanded && detail && (
        <div className="border-t border-slate-200/60 px-5 pb-5 pt-4 dark:border-slate-700/40">
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

            {/* ─── Titelbild section ─── */}
            <div className="rounded-xl border border-slate-200/60 p-4 dark:border-slate-700/40">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Titelbild</h4>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">
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
                    <img src={photoBase64} alt="Vorschau" className="h-10 w-16 rounded object-cover" />
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
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={enhancePrompt}
                    onChange={(e) => setEnhancePrompt(e.target.value)}
                    placeholder="Verbesserungsanweisungen (optional)"
                    disabled={imageStatus === 'processing'}
                    className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-1.5 text-xs text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
                  />
                  <button
                    onClick={handleEnhance}
                    disabled={imageStatus === 'processing'}
                    className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {imageStatus === 'processing' ? 'Foto wird veredelt…' : 'Veredeln & Speichern'}
                  </button>
                </div>
              )}

              {imageStatus === 'done' && (
                <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Titelbild aktualisiert!</div>
              )}
              {imageStatus === 'error' && imageError && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">{imageError}</div>
              )}
            </div>

            {/* ─── Body editor ─── */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Body <span className="text-slate-400">({wordCount} Wörter)</span>
                </label>
                <div className="flex items-center gap-2">
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
              </div>
              <textarea
                ref={bodyRef}
                value={editBody}
                onChange={(e) => { setEditBody(e.target.value); markDirty() }}
                rows={20}
                className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-2 font-mono text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
              />
            </div>

            {/* ─── Save bar ─── */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="rounded-full bg-primary-500 px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
              >
                {saving ? 'Wird gespeichert…' : 'Speichern'}
              </button>
              <button
                onClick={handleExpand}
                disabled={saving}
                className="rounded-full border border-slate-300 px-6 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                Abbrechen
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
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────

export default function AdminImages() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [posts, setPosts] = useState<PostInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/comments')
      .then((res) => {
        if (res.status === 401) {
          setPhase('login')
        } else {
          setPhase('ready')
          loadPosts()
        }
      })
      .catch(() => setPhase('login'))
  }, [])

  async function loadPosts() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/images')
      if (res.status === 401) {
        setPhase('login')
        return
      }
      if (!res.ok) throw new Error('Posts konnten nicht geladen werden')
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleLogin() {
    setPhase('ready')
    loadPosts()
  }

  function handlePostUpdated(slug: string, newUrl: string) {
    setPosts((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, imageUrl: newUrl } : p))
    )
  }

  function handlePostInfoChanged(slug: string, changes: Partial<PostInfo>) {
    setPosts((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, ...changes } : p))
    )
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return posts
    const q = search.toLowerCase()
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [posts, search])

  if (phase === 'checking') {
    return <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Wird geladen…</div>
  }

  if (phase === 'login') {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">schliessen</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Posts durchsuchen…"
          className="flex-1 rounded-full border border-slate-300 bg-white/70 px-5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
        <span className="text-xs text-[var(--text-secondary)]">{filtered.length} Posts</span>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
          <div className="mt-3 text-sm text-[var(--text-secondary)]">Posts werden geladen…</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
              onUpdated={handlePostUpdated}
              onPostInfoChanged={handlePostInfoChanged}
            />
          ))}
          {filtered.length === 0 && !loading && (
            <div className="py-8 text-center text-sm text-[var(--text-secondary)]">Keine Posts gefunden.</div>
          )}
        </div>
      )}
    </div>
  )
}
