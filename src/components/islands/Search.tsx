import { useState, useEffect, useRef, useCallback } from 'react'

interface SearchItem {
  title: string
  slug: string
  summary?: string
  tags: string[]
  date: string
  image?: string
}

interface Props {
  posts: SearchItem[]
}

export default function Search({ posts }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = query.length >= 2
    ? posts.filter((post) => {
        const q = query.toLowerCase()
        return (
          post.title.toLowerCase().includes(q) ||
          post.summary?.toLowerCase().includes(q) ||
          post.tags.some((tag) => tag.toLowerCase().includes(q))
        )
      }).slice(0, 8)
    : []

  const open = useCallback(() => {
    setIsOpen(true)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) close()
        else open()
      }
      if (e.key === 'Escape' && isOpen) {
        close()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, open, close])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Arrow key navigation
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        window.location.href = `/tiny-house/${results[selectedIndex].slug}/`
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex])

  // Reset selected index on query change + Matomo tracking
  useEffect(() => {
    setSelectedIndex(0)

    if (query.length < 2) return
    const timer = setTimeout(() => {
      const paq = (window as any)._paq
      if (paq) {
        paq.push(['trackSiteSearch', query, 'Blog', results.length])
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-result-item]')
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen) {
    return (
      <button
        onClick={open}
        className="flex items-center gap-2 rounded-full bg-primary-500 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-500/20"
        aria-label="Suche öffnen"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">Suche</span>
        <kbd className="hidden rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-xs sm:inline">⌘K</kbd>
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Search Modal */}
      <div className="fixed inset-x-0 top-[15%] z-[70] mx-auto w-full max-w-xl px-4">
        <div
          className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
          style={{ animation: 'fade-in 0.15s ease-out' }}
        >
          {/* Input */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            <svg className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Blog durchsuchen..."
              className="flex-1 bg-transparent text-base text-[var(--text)] outline-none placeholder:text-[var(--text-secondary)]"
            />
            <kbd
              className="cursor-pointer rounded border border-[var(--border)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]"
              onClick={close}
            >
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto">
            {query.length < 2 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                Tippe mindestens 2 Zeichen ein...
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                Keine Ergebnisse für &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div className="py-2">
                {results.map((post, i) => (
                  <a
                    key={post.slug}
                    href={`/tiny-house/${post.slug}/`}
                    data-result-item
                    className={`flex flex-row items-center gap-3 px-4 py-3 transition-colors ${
                      i === selectedIndex
                        ? 'bg-[#05DE66]/10 text-[#05DE66]'
                        : 'text-[var(--text)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    {post.image && (
                      <img
                        src={post.image}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium leading-snug">{post.title}</span>
                      {post.summary && (
                        <span className="line-clamp-1 text-sm text-[var(--text-secondary)]">
                          {post.summary}
                        </span>
                      )}
                      {post.tags.length > 0 && (
                        <div className="flex gap-1.5">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs text-[var(--text-secondary)]">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[var(--border)] px-1">↑↓</kbd> navigieren
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[var(--border)] px-1">↵</kbd> öffnen
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
