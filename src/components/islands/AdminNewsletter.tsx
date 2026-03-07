import React, { useState, useEffect, type FormEvent } from 'react'
import { buildMultiBlockNewsletterHtml } from '../../lib/newsletter-template'
import {
  BUILT_IN_TEMPLATES,
  type NewsletterBlock,
  type NewsletterTemplate,
  type PostRef,
} from '../../lib/newsletter-blocks'

// ─── Types ─────────────────────────────────────────────────────────────

interface Subscriber {
  id: number
  email: string
  status: 'pending' | 'confirmed' | 'unsubscribed'
  created_at: string
  confirmed_at: string | null
  unsubscribed_at: string | null
}

interface NewsletterSend {
  id: number
  post_slug: string
  post_title: string
  subject: string
  sent_at: string
  recipient_count: number
}

interface Post {
  slug: string
  title: string
  summary: string
  image: string | null
  date: string
}

type Tab = 'compose' | 'subscribers' | 'history' | 'settings'
type ComposeMode = 'pick-template' | 'fill-slots' | 'build-template'

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  confirmed: {
    label: 'Bestätigt',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  },
  pending: {
    label: 'Ausstehend',
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  },
  unsubscribed: {
    label: 'Abgemeldet',
    cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
}

const blockTypeLabels: Record<NewsletterBlock['type'], string> = {
  hero: 'Hero',
  article: 'Artikel',
  'two-column': '2-Spaltig',
  text: 'Freitext',
}

function createBlock(type: NewsletterBlock['type']): NewsletterBlock {
  const id = crypto.randomUUID()
  switch (type) {
    case 'hero':
      return { id, type: 'hero', slug: '' }
    case 'article':
      return { id, type: 'article', slug: '' }
    case 'two-column':
      return { id, type: 'two-column', slugLeft: '', slugRight: '' }
    case 'text':
      return { id, type: 'text', content: '' }
  }
}

function blocksFromTemplate(template: NewsletterTemplate): NewsletterBlock[] {
  return template.slots.map((slot) => createBlock(slot.type))
}

function blocksAreValid(blocks: NewsletterBlock[]): boolean {
  if (blocks.length === 0) return false
  return blocks.every((block) => {
    switch (block.type) {
      case 'hero':
      case 'article':
        return block.slug !== ''
      case 'two-column':
        return block.slugLeft !== '' && block.slugRight !== ''
      case 'text':
        return block.content.trim() !== ''
    }
  })
}

function buildPostsMap(blocks: NewsletterBlock[], posts: Post[]): Record<string, PostRef> {
  const slugs = new Set<string>()
  for (const block of blocks) {
    if (block.type === 'hero' || block.type === 'article') slugs.add(block.slug)
    if (block.type === 'two-column') {
      slugs.add(block.slugLeft)
      slugs.add(block.slugRight)
    }
  }
  const map: Record<string, PostRef> = {}
  for (const slug of slugs) {
    const post = posts.find((p) => p.slug === slug)
    if (post) map[slug] = post
  }
  return map
}

const STORAGE_KEY = 'newsletter-templates'

function loadCustomTemplates(): NewsletterTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveCustomTemplates(templates: NewsletterTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

// ─── Helpers: used slugs ──────────────────────────────────────────────

function getUsedSlugs(blocks: NewsletterBlock[]): Set<string> {
  const slugs = new Set<string>()
  for (const block of blocks) {
    if (block.type === 'hero' || block.type === 'article') {
      if (block.slug) slugs.add(block.slug)
    }
    if (block.type === 'two-column') {
      if (block.slugLeft) slugs.add(block.slugLeft)
      if (block.slugRight) slugs.add(block.slugRight)
    }
  }
  return slugs
}

// ─── Reusable UI ──────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white'

// ─── Drag & Drop Components ──────────────────────────────────────────

function DraggablePostItem({
  post,
  isUsed,
}: {
  post: Post
  isUsed: boolean
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.slug)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className={`flex cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-white/60 px-3 py-2 transition-all active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800/60 ${
        isUsed
          ? 'opacity-40'
          : 'hover:border-primary-300 hover:shadow-sm dark:hover:border-primary-600'
      }`}
    >
      {post.image ? (
        <img
          src={post.image}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400 dark:bg-slate-700 dark:text-slate-500">
          Bild
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--text)]">{post.title}</div>
        <div className="text-xs text-[var(--text-secondary)]">{formatDateShort(post.date)}</div>
      </div>
    </div>
  )
}

function DropSlot({
  slug,
  posts,
  onDrop,
  onClear,
  label,
}: {
  slug: string
  posts: Post[]
  onDrop: (slug: string) => void
  onClear: () => void
  label?: string
}) {
  const [dragOver, setDragOver] = useState(false)
  const post = slug ? posts.find((p) => p.slug === slug) : null

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const droppedSlug = e.dataTransfer.getData('text/plain')
    if (droppedSlug) onDrop(droppedSlug)
  }

  if (post) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragEnter={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 transition-colors ${
          dragOver
            ? 'border-primary-400 bg-primary-50/50 dark:border-primary-500 dark:bg-primary-900/20'
            : 'border-slate-200 bg-white/50 dark:border-slate-700 dark:bg-slate-800/50'
        }`}
      >
        {label && (
          <div className="px-3 pt-2 text-xs font-medium text-[var(--text-secondary)]">{label}</div>
        )}
        <div className="flex items-center gap-3 p-3">
          {post.image ? (
            <img src={post.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 dark:bg-slate-700">
              Bild
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[var(--text)]">{post.title}</div>
            <div className="text-xs text-[var(--text-secondary)]">{formatDateShort(post.date)}</div>
          </div>
          <button
            onClick={onClear}
            className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title="Entfernen"
          >
            &times;
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragOver
          ? 'border-primary-400 bg-primary-50/50 text-primary-600 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-400'
          : 'border-slate-300 text-[var(--text-secondary)] dark:border-slate-600'
      }`}
    >
      {label && <div className="mb-1 text-xs font-medium">{label}</div>}
      <div className="text-sm">Artikel hierher ziehen</div>
    </div>
  )
}

// ─── Login Form ───────────────────────────────────────────────────────

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

// ─── Template Card (for picker grid) ──────────────────────────────────

const slotMiniIcons: Record<NewsletterBlock['type'], JSX.Element> = {
  hero: (
    <div className="mb-1 h-4 rounded bg-primary-200 dark:bg-primary-800" />
  ),
  article: (
    <div className="mb-1 flex gap-1">
      <div className="h-2 flex-1 rounded bg-slate-300 dark:bg-slate-600" />
    </div>
  ),
  'two-column': (
    <div className="mb-1 flex gap-1">
      <div className="h-3 flex-1 rounded bg-slate-300 dark:bg-slate-600" />
      <div className="h-3 flex-1 rounded bg-slate-300 dark:bg-slate-600" />
    </div>
  ),
  text: (
    <div className="mb-1 space-y-0.5">
      <div className="h-1 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-1 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  ),
}

function TemplateCard({
  template,
  onSelect,
  onDelete,
}: {
  template: NewsletterTemplate
  onSelect: () => void
  onDelete?: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="group relative flex flex-col rounded-xl border border-slate-200 bg-white/60 p-4 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-primary-500"
    >
      {onDelete && (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute right-2 top-2 hidden rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-500 group-hover:inline-block dark:bg-red-900/30"
        >
          &times;
        </span>
      )}
      <div className="mb-3 space-y-1 rounded-lg bg-slate-50 p-2 dark:bg-slate-900/50">
        {template.slots.map((slot, i) => (
          <div key={i}>{slotMiniIcons[slot.type]}</div>
        ))}
      </div>
      <span className="text-xs font-semibold text-[var(--text)]">{template.name}</span>
    </button>
  )
}

// ─── Insert Toolbar (between blocks) ──────────────────────────────────

function InsertToolbar({ onInsert, alwaysExpanded }: {
  onInsert: (type: NewsletterBlock['type']) => void
  alwaysExpanded?: boolean
}) {
  const [open, setOpen] = useState(false)

  const btnCls =
    'rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600 dark:border-slate-600 dark:hover:border-primary-500 dark:hover:bg-primary-900/20 dark:hover:text-primary-400'

  if (open || alwaysExpanded) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-1"
        onMouseLeave={alwaysExpanded ? undefined : () => setOpen(false)}
      >
        <button onClick={() => { onInsert('hero'); setOpen(false) }} className={btnCls}>+ Hero</button>
        <button onClick={() => { onInsert('article'); setOpen(false) }} className={btnCls}>+ Artikel</button>
        <button onClick={() => { onInsert('two-column'); setOpen(false) }} className={btnCls}>+ 2-Spaltig</button>
        <button onClick={() => { onInsert('text'); setOpen(false) }} className={btnCls}>+ Freitext</button>
      </div>
    )
  }

  return (
    <div className="group flex items-center justify-center py-1">
      <div className="h-px flex-1 border-t border-dashed border-slate-200 opacity-0 transition-opacity group-hover:opacity-100 dark:border-slate-700" />
      <button
        onClick={() => setOpen(true)}
        className="mx-2 flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400 opacity-40 transition-all hover:border-primary-400 hover:text-primary-500 group-hover:opacity-100 dark:border-slate-600 dark:text-slate-500"
        title="Block einfügen"
      >
        +
      </button>
      <div className="h-px flex-1 border-t border-dashed border-slate-200 opacity-0 transition-opacity group-hover:opacity-100 dark:border-slate-700" />
    </div>
  )
}

// ─── Slot Card (for fill-slots view) ──────────────────────────────────

function SlotCard({
  block,
  index,
  posts,
  onUpdate,
  onRemove,
  onMove,
}: {
  block: NewsletterBlock
  index: number
  posts: Post[]
  onUpdate: (updated: NewsletterBlock) => void
  onRemove?: () => void
  onMove: (from: number, to: number) => void
}) {
  const [dragOver, setDragOver] = useState<'above' | 'below' | null>(null)

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('application/x-block-index', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('application/x-block-index')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOver(e.clientY < midY ? 'above' : 'below')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(null)
    const fromStr = e.dataTransfer.getData('application/x-block-index')
    if (!fromStr) return
    const from = Number(fromStr)
    const to = dragOver === 'above' ? index : index + 1
    const adjustedTo = from < to ? to - 1 : to
    onMove(from, adjustedTo)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(null)}
      onDrop={handleDrop}
      className={`relative rounded-xl border bg-white/50 p-4 dark:bg-slate-800/50 ${
        dragOver === 'above'
          ? 'border-t-primary-500 border-t-4 border-x-slate-200 border-b-slate-200 bg-primary-50/30 dark:border-x-slate-700 dark:border-b-slate-700 dark:bg-primary-900/10'
          : dragOver === 'below'
            ? 'border-b-primary-500 border-b-4 border-x-slate-200 border-t-slate-200 bg-primary-50/30 dark:border-x-slate-700 dark:border-t-slate-700 dark:bg-primary-900/10'
            : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="cursor-grab text-slate-400 active:cursor-grabbing dark:text-slate-500" title="Ziehen zum Umsortieren">&#x2807;</span>
          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {blockTypeLabels[block.type]}
          </span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title="Block entfernen"
          >
            &times;
          </button>
        )}
      </div>

      {(block.type === 'hero' || block.type === 'article') && (
        <DropSlot
          slug={block.slug}
          posts={posts}
          onDrop={(slug) => onUpdate({ ...block, slug })}
          onClear={() => onUpdate({ ...block, slug: '' })}
        />
      )}

      {block.type === 'two-column' && (
        <div className="grid grid-cols-2 gap-3">
          <DropSlot
            slug={block.slugLeft}
            posts={posts}
            onDrop={(slug) => onUpdate({ ...block, slugLeft: slug })}
            onClear={() => onUpdate({ ...block, slugLeft: '' })}
            label="Links"
          />
          <DropSlot
            slug={block.slugRight}
            posts={posts}
            onDrop={(slug) => onUpdate({ ...block, slugRight: slug })}
            onClear={() => onUpdate({ ...block, slugRight: '' })}
            label="Rechts"
          />
        </div>
      )}

      {block.type === 'text' && (
        <textarea
          value={block.content}
          onChange={(e) => onUpdate({ ...block, content: e.target.value })}
          rows={4}
          placeholder="Freitext eingeben…"
          className={`${inputCls} resize-y`}
        />
      )}
    </div>
  )
}

// ─── Template Builder ─────────────────────────────────────────────────

function TemplateBuilder({
  onSave,
  onCancel,
}: {
  onSave: (template: NewsletterTemplate) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [slots, setSlots] = useState<{ type: NewsletterBlock['type'] }[]>([])

  function addSlot(type: NewsletterBlock['type']) {
    setSlots([...slots, { type }])
  }

  function removeSlot(index: number) {
    setSlots(slots.filter((_, i) => i !== index))
  }

  function moveSlot(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= slots.length) return
    const next = [...slots]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSlots(next)
  }

  function handleSave() {
    if (!name.trim() || slots.length === 0) return
    onSave({
      id: crypto.randomUUID(),
      name: name.trim(),
      slots,
    })
  }

  const toolbarBtnCls =
    'rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600 dark:border-slate-600 dark:hover:border-primary-500 dark:hover:bg-primary-900/20 dark:hover:text-primary-400'

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-[var(--text)]">Neues Template erstellen</h3>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--text)]">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mein Newsletter-Layout"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--text)]">Blöcke hinzufügen</label>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => addSlot('hero')} className={toolbarBtnCls}>+ Hero</button>
          <button onClick={() => addSlot('article')} className={toolbarBtnCls}>+ Artikel</button>
          <button onClick={() => addSlot('two-column')} className={toolbarBtnCls}>+ 2-Spaltig</button>
          <button onClick={() => addSlot('text')} className={toolbarBtnCls}>+ Freitext</button>
        </div>
      </div>

      {slots.length > 0 && (
        <div className="space-y-2">
          {slots.map((slot, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <span className="text-sm font-medium text-[var(--text)]">
                {i + 1}. {blockTypeLabels[slot.type]}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => moveSlot(i, -1)}
                  disabled={i === 0}
                  className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                >
                  &uarr;
                </button>
                <button
                  onClick={() => moveSlot(i, 1)}
                  disabled={i === slots.length - 1}
                  className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                >
                  &darr;
                </button>
                <button
                  onClick={() => removeSlot(i)}
                  className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {slots.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-6 text-center text-sm text-[var(--text-secondary)] dark:border-slate-600">
          Füge oben Block-Typen hinzu, um dein Template zu definieren.
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || slots.length === 0}
          className="rounded-full bg-primary-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md disabled:opacity-50"
        >
          Template speichern
        </button>
      </div>
    </div>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────

function PreviewModal({
  html,
  onClose,
}: {
  html: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)]">Vorschau</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Schliessen
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <div
            className="mx-auto max-w-[600px]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────

export default function AdminNewsletter() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'loaded'>('checking')
  const [tab, setTab] = useState<Tab>('compose')
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [sends, setSends] = useState<NewsletterSend[]>([])
  const [posts, setPosts] = useState<Post[]>([])

  // Compose state
  const [composeMode, setComposeMode] = useState<ComposeMode>('pick-template')
  const [selectedTemplate, setSelectedTemplate] = useState<NewsletterTemplate | null>(null)
  const [blocks, setBlocks] = useState<NewsletterBlock[]>([])
  const [subject, setSubject] = useState('')
  const [generatingSubject, setGeneratingSubject] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<NewsletterTemplate[]>([])

  // Settings state
  const [generatorPrompt, setGeneratorPrompt] = useState('')
  const [reviewerPrompt, setReviewerPrompt] = useState('')
  const [promptsLoaded, setPromptsLoaded] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [promptSaved, setPromptSaved] = useState(false)

  const confirmedCount = subscribers.filter((s) => s.status === 'confirmed').length
  const canSend = subject.trim() !== '' && blocksAreValid(blocks) && confirmedCount > 0

  useEffect(() => {
    setCustomTemplates(loadCustomTemplates())
  }, [])

  async function loadData() {
    try {
      const res = await fetch('/api/admin/newsletter?posts=1')
      if (res.status === 401) {
        setPhase('login')
        return
      }
      const data = await res.json()
      setSubscribers(data.subscribers || [])
      setSends(data.sends || [])
      setPosts(data.posts || [])
      setPhase('loaded')
    } catch {
      setPhase('login')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadPrompts() {
    try {
      const [genRes, revRes] = await Promise.all([
        fetch('/api/admin/settings?key=subject_prompt_generator'),
        fetch('/api/admin/settings?key=subject_prompt_reviewer'),
      ])
      if (genRes.ok) {
        const data = await genRes.json()
        setGeneratorPrompt(data.value || '')
      }
      if (revRes.ok) {
        const data = await revRes.json()
        setReviewerPrompt(data.value || '')
      }
    } catch { /* ignore */ }
    setPromptsLoaded(true)
  }

  async function savePrompts() {
    setSavingPrompt(true)
    setPromptSaved(false)
    try {
      const [genRes, revRes] = await Promise.all([
        fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'subject_prompt_generator', value: generatorPrompt }),
        }),
        fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'subject_prompt_reviewer', value: reviewerPrompt }),
        }),
      ])
      if (genRes.ok && revRes.ok) setPromptSaved(true)
    } catch { /* ignore */ }
    setSavingPrompt(false)
  }

  async function resetPrompts() {
    setGeneratorPrompt('')
    setReviewerPrompt('')
    setSavingPrompt(true)
    setPromptSaved(false)
    try {
      const [genRes, revRes] = await Promise.all([
        fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'subject_prompt_generator', value: '' }),
        }),
        fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'subject_prompt_reviewer', value: '' }),
        }),
      ])
      if (genRes.ok && revRes.ok) setPromptSaved(true)
    } catch { /* ignore */ }
    setSavingPrompt(false)
  }

  function selectTemplate(template: NewsletterTemplate) {
    setSelectedTemplate(template)
    setBlocks(blocksFromTemplate(template))
    setSubject('')
    setSendResult(null)
    setComposeMode('fill-slots')
  }

  function goBackToPicker() {
    setSelectedTemplate(null)
    setBlocks([])
    setSubject('')
    setSendResult(null)
    setComposeMode('pick-template')
  }

  async function generateSubject() {
    setGeneratingSubject(true)
    try {
      // Build posts map from blocks
      const postsMap: Record<string, { title: string; summary: string }> = {}
      for (const block of blocks) {
        const addPost = (slug: string) => {
          const post = posts.find((p) => p.slug === slug)
          if (post) postsMap[slug] = { title: post.title, summary: post.summary }
        }
        if ((block.type === 'hero' || block.type === 'article') && block.slug) addPost(block.slug)
        if (block.type === 'two-column') {
          if (block.slugLeft) addPost(block.slugLeft)
          if (block.slugRight) addPost(block.slugRight)
        }
      }
      const res = await fetch('/api/admin/suggest-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks, posts: postsMap }),
      })
      if (!res.ok) throw new Error('Fehler beim Generieren')
      const data = await res.json()
      if (data.subject) setSubject(data.subject)
    } catch (err) {
      console.error('[generateSubject]', err)
    } finally {
      setGeneratingSubject(false)
    }
  }

  function updateBlock(index: number, updated: NewsletterBlock) {
    const next = [...blocks]
    next[index] = updated
    setBlocks(next)
  }

  function removeBlock(index: number) {
    setBlocks(blocks.filter((_, i) => i !== index))
  }

  function moveBlock(from: number, to: number) {
    if (from === to) return
    const next = [...blocks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setBlocks(next)
  }

  function insertBlock(type: NewsletterBlock['type'], at: number) {
    const next = [...blocks]
    next.splice(at, 0, createBlock(type))
    setBlocks(next)
  }

  function handleSaveCustomTemplate(template: NewsletterTemplate) {
    const updated = [...customTemplates, template]
    setCustomTemplates(updated)
    saveCustomTemplates(updated)
    setComposeMode('pick-template')
  }

  function handleDeleteCustomTemplate(id: string) {
    if (!window.confirm('Template wirklich löschen?')) return
    const updated = customTemplates.filter((t) => t.id !== id)
    setCustomTemplates(updated)
    saveCustomTemplates(updated)
  }

  async function handleSend() {
    if (!canSend) return

    const confirmed = window.confirm(
      `Newsletter "${subject}" an ${confirmedCount} Abonnent${confirmedCount !== 1 ? 'en' : ''} senden?`,
    )
    if (!confirmed) return

    setSending(true)
    setSendResult(null)

    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', subject, blocks }),
      })
      const data = await res.json()
      if (res.ok) {
        setSendResult({ ok: true, message: `Erfolgreich an ${data.sent}/${data.total} versendet.` })
        goBackToPicker()
        loadData()
      } else {
        setSendResult({ ok: false, message: data.error || 'Fehler beim Versenden.' })
      }
    } catch {
      setSendResult({ ok: false, message: 'Verbindung fehlgeschlagen.' })
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteSubscriber(id: number) {
    if (!window.confirm('Abonnent wirklich löschen?')) return
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', subscriberId: id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendResult({ ok: false, message: data.error || 'Löschen fehlgeschlagen.' })
        return
      }
      loadData()
    } catch {
      setSendResult({ ok: false, message: 'Verbindung fehlgeschlagen.' })
    }
  }

  if (phase === 'checking') {
    return <div className="py-12 text-center text-[var(--text-secondary)]">Laden…</div>
  }

  if (phase === 'login') {
    return <LoginForm onLogin={loadData} />
  }

  const tabCls = (t: Tab) =>
    `rounded-full px-5 py-2 text-sm font-medium transition-colors ${
      tab === t
        ? 'bg-primary-500 text-white'
        : 'border border-slate-300 text-[var(--text-secondary)] hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
    }`

  const postsMap = buildPostsMap(blocks, posts)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 text-center">
          <div className="text-3xl font-bold text-primary-500">{confirmedCount}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">Bestätigt</div>
        </div>
        <div className="glass-card rounded-2xl p-5 text-center">
          <div className="text-3xl font-bold text-amber-500">
            {subscribers.filter((s) => s.status === 'pending').length}
          </div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">Ausstehend</div>
        </div>
        <div className="glass-card rounded-2xl p-5 text-center">
          <div className="text-3xl font-bold text-slate-400">{sends.length}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">Versendet</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('compose')} className={tabCls('compose')}>
          Newsletter erstellen
        </button>
        <button onClick={() => setTab('subscribers')} className={tabCls('subscribers')}>
          Abonnenten ({subscribers.length})
        </button>
        <button onClick={() => setTab('history')} className={tabCls('history')}>
          Versand-Historie
        </button>
        <button onClick={() => { setTab('settings'); if (!promptsLoaded) loadPrompts() }} className={tabCls('settings')}>
          Einstellungen
        </button>
      </div>

      {/* ─── Compose Tab ─────────────────────────────────────────── */}
      {tab === 'compose' && (
        <div className="glass-card space-y-5 rounded-2xl p-6">
          {/* Mode: Pick Template */}
          {composeMode === 'pick-template' && (
            <div className="space-y-6">
              <div>
                <label className="mb-3 block text-sm font-medium text-[var(--text)]">Template wählen</label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {BUILT_IN_TEMPLATES.map((t) => (
                    <TemplateCard key={t.id} template={t} onSelect={() => selectTemplate(t)} />
                  ))}
                </div>
              </div>

              {(customTemplates.length > 0) && (
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Eigene Templates</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {customTemplates.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onSelect={() => selectTemplate(t)}
                        onDelete={() => handleDeleteCustomTemplate(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setComposeMode('build-template')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-primary-400 hover:bg-primary-50/50 hover:text-primary-600 dark:border-slate-600 dark:hover:border-primary-500 dark:hover:bg-primary-900/20 dark:hover:text-primary-400"
              >
                <span className="text-lg">+</span> Neues Template erstellen
              </button>
            </div>
          )}

          {/* Mode: Build Template */}
          {composeMode === 'build-template' && (
            <TemplateBuilder
              onSave={handleSaveCustomTemplate}
              onCancel={() => setComposeMode('pick-template')}
            />
          )}

          {/* Mode: Fill Slots */}
          {composeMode === 'fill-slots' && selectedTemplate && (() => {
            const usedSlugs = getUsedSlugs(blocks)
            return (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-[var(--text)]">
                  Template: <span className="font-semibold">"{selectedTemplate.name}"</span>
                </h3>
                <button
                  onClick={goBackToPicker}
                  className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  &larr; Andere wählen
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text)]">Betreffzeile</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Newsletter-Betreff…"
                    className={inputCls + ' flex-1'}
                  />
                  <button
                    onClick={generateSubject}
                    disabled={generatingSubject || blocks.length === 0}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    {generatingSubject ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <span>✨</span>
                    )}
                    {generatingSubject ? 'Generiere…' : 'Mit AI ausfüllen'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
                {/* Left: Template slots */}
                <div className="space-y-1">
                  <InsertToolbar onInsert={(type) => insertBlock(type, 0)} alwaysExpanded={blocks.length === 0} />
                  {blocks.map((block, i) => (
                    <React.Fragment key={block.id}>
                      <SlotCard
                        block={block}
                        index={i}
                        posts={posts}
                        onUpdate={(updated) => updateBlock(i, updated)}
                        onRemove={() => removeBlock(i)}
                        onMove={moveBlock}
                      />
                      <InsertToolbar onInsert={(type) => insertBlock(type, i + 1)} alwaysExpanded={i === blocks.length - 1} />
                    </React.Fragment>
                  ))}
                </div>

                {/* Right: Draggable article list */}
                <div className="lg:sticky lg:top-4 lg:self-start">
                  <div className="rounded-xl border border-slate-200 bg-white/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <h4 className="mb-3 text-xs font-semibold text-[var(--text-secondary)]">
                      Artikel (Drag &amp; Drop)
                    </h4>
                    <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                      {posts.slice(0, 20).map((post) => (
                        <DraggablePostItem
                          key={post.slug}
                          post={post}
                          isUsed={usedSlugs.has(post.slug)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={!blocksAreValid(blocks)}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Vorschau
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !canSend}
                  className="flex-1 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md disabled:opacity-50"
                >
                  {sending
                    ? 'Wird versendet…'
                    : `An ${confirmedCount} Abonnent${confirmedCount !== 1 ? 'en' : ''} senden`}
                </button>
              </div>
            </div>
            )
          })()}

          {sendResult && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                sendResult.ok
                  ? 'border-emerald-200/50 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'border-red-200/50 bg-red-50/60 text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300'
              }`}
            >
              {sendResult.message}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && blocksAreValid(blocks) && (
        <PreviewModal
          html={buildMultiBlockNewsletterHtml(blocks, postsMap, 'https://www.kokomo.house', '#')}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ─── Subscribers Tab ─────────────────────────────────────── */}
      {tab === 'subscribers' && (
        <div className="glass-card overflow-hidden rounded-2xl">
          {subscribers.length === 0 ? (
            <div className="px-6 py-12 text-center text-[var(--text-secondary)]">
              Noch keine Abonnenten.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-3 font-medium text-[var(--text-secondary)]">E-Mail</th>
                  <th className="px-5 py-3 font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-5 py-3 font-medium text-[var(--text-secondary)]">Datum</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => {
                  const badge = statusBadge[s.status] || statusBadge.pending
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="px-5 py-3 text-[var(--text)]">{s.email}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteSubscriber(s.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── History Tab ─────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="glass-card overflow-hidden rounded-2xl">
          {sends.length === 0 ? (
            <div className="px-6 py-12 text-center text-[var(--text-secondary)]">
              Noch keine Newsletter versendet.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-3 font-medium text-[var(--text-secondary)]">Betreff</th>
                  <th className="px-5 py-3 font-medium text-[var(--text-secondary)]">Empfänger</th>
                  <th className="px-5 py-3 font-medium text-[var(--text-secondary)]">Datum</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-5 py-3 text-[var(--text)]">
                      <div className="font-medium">{s.subject}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{s.post_title}</div>
                    </td>
                    <td className="px-5 py-3 text-[var(--text)]">{s.recipient_count}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">
                      {formatDate(s.sent_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Settings Tab ──────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="space-y-6">
          {!promptsLoaded ? (
            <div className="glass-card rounded-2xl p-6">
              <div className="py-6 text-center text-[var(--text-secondary)]">Laden…</div>
            </div>
          ) : (
            <>
              {/* Generator Prompt */}
              <div className="glass-card space-y-4 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-[var(--text)]">Schritt 1: Generator-Prompt</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Generiert 10 Betreffzeilen-Vorschläge und markiert die besten 3.
                  Leer lassen für den Standard-Prompt.
                </p>
                <textarea
                  value={generatorPrompt}
                  onChange={(e) => { setGeneratorPrompt(e.target.value); setPromptSaved(false) }}
                  placeholder={`Du bist ein Newsletter-Betreff-Generator für "KOKOMO" — einen Tiny House Blog aus der Schweiz.\nDie Bewohner sind Sibylle und Michi, die seit September 2022 in ihrem Tiny House leben.\n\nDeine Aufgabe: Generiere genau 10 Newsletter-Betreffzeilen basierend auf den Inhalten.\nMarkiere die besten 3 als Top-Vorschläge.\n\nRegeln:\n- Maximal 60 Zeichen pro Betreffzeile\n- Persoenlich und authentisch, kein Clickbait\n- Macht neugierig und animiert zum Oeffnen\n- Verwende "ss" statt "ß"\n- Deutsch (Schweizer Stil)`}
                  rows={10}
                  className="w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-sm text-[var(--text)] placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800/80 dark:placeholder:text-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-800"
                />
                <p className="text-xs text-[var(--text-secondary)] opacity-75">
                  <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-slate-700">{'{{content}}'}</code> wird durch den Newsletter-Inhalt ersetzt (optional — der Inhalt wird auch als separate Nachricht gesendet).
                  Das JSON-Antwortformat wird automatisch angehängt.
                </p>
              </div>

              {/* Reviewer Prompt */}
              <div className="glass-card space-y-4 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-[var(--text)]">Schritt 2: Reviewer-Prompt</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Wählt die beste Betreffzeile aus oder formuliert eine bessere.
                  Leer lassen für den Standard-Prompt.
                </p>
                <textarea
                  value={reviewerPrompt}
                  onChange={(e) => { setReviewerPrompt(e.target.value); setPromptSaved(false) }}
                  placeholder={`Du bist ein erfahrener Newsletter-Redakteur für "KOKOMO" — einen Tiny House Blog aus der Schweiz.\n\nDu erhältst 10 Betreffzeilen-Vorschläge, davon 3 als Top-Vorschläge markiert.\nWähle die beste Betreffzeile aus oder formuliere eine noch bessere basierend auf den Vorschlägen.\n\nKriterien:\n- Maximal 60 Zeichen\n- Hohe Oeffnungsrate\n- Authentisch, nicht reisserisch\n- Verwende "ss" statt "ß"`}
                  rows={10}
                  className="w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-sm text-[var(--text)] placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800/80 dark:placeholder:text-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-800"
                />
                <p className="text-xs text-[var(--text-secondary)] opacity-75">
                  Erhält die Generator-Vorschläge als Eingabe.
                  Das JSON-Antwortformat wird automatisch angehängt.
                </p>
              </div>

              {/* Save / Reset Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={savePrompts}
                  disabled={savingPrompt}
                  className="rounded-full bg-primary-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {savingPrompt ? 'Speichern…' : 'Beide Prompts speichern'}
                </button>
                <button
                  onClick={() => { setGeneratorPrompt(''); setReviewerPrompt(''); setPromptSaved(false) }}
                  disabled={savingPrompt}
                  className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Zurücksetzen
                </button>
                {promptSaved && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">Gespeichert!</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
