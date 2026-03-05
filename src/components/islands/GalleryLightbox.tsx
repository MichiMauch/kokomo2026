import { useState, useEffect, useCallback } from 'react'

export default function GalleryLightbox() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentSrc, setCurrentSrc] = useState('')
  const [currentAlt, setCurrentAlt] = useState('')
  const [allImages, setAllImages] = useState<{ src: string; alt: string }[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const open = useCallback((src: string, alt: string, images: { src: string; alt: string }[], index: number) => {
    setCurrentSrc(src)
    setCurrentAlt(alt)
    setAllImages(images)
    setCurrentIndex(index)
    setIsOpen(true)
    document.body.style.overflow = 'hidden'
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    document.body.style.overflow = ''
  }, [])

  const goNext = useCallback(() => {
    if (allImages.length <= 1) return
    const next = (currentIndex + 1) % allImages.length
    setCurrentIndex(next)
    setCurrentSrc(allImages[next].src)
    setCurrentAlt(allImages[next].alt)
  }, [allImages, currentIndex])

  const goPrev = useCallback(() => {
    if (allImages.length <= 1) return
    const prev = (currentIndex - 1 + allImages.length) % allImages.length
    setCurrentIndex(prev)
    setCurrentSrc(allImages[prev].src)
    setCurrentAlt(allImages[prev].alt)
  }, [allImages, currentIndex])

  // Attach click handlers to all prose images
  useEffect(() => {
    function handleClick(e: Event) {
      const target = e.target as HTMLElement
      if (target.tagName !== 'IMG') return

      const img = target as HTMLImageElement
      const prose = img.closest('.prose')
      if (!prose) return

      e.preventDefault()

      // Collect all images in the prose section
      const proseImages = Array.from(prose.querySelectorAll('img')).map((el) => ({
        src: (el as HTMLImageElement).src,
        alt: (el as HTMLImageElement).alt || '',
      }))

      const index = proseImages.findIndex((i) => i.src === img.src)
      open(img.src, img.alt || '', proseImages, Math.max(0, index))
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, close, goNext, goPrev])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      style={{ animation: 'fade-in 0.15s ease-out' }}
    >
      {/* Close Button */}
      <button
        onClick={close}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Schliessen"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Previous Button */}
      {allImages.length > 1 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          aria-label="Vorheriges Bild"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Polaroid Frame */}
      <div
        className="relative flex flex-col items-center"
        style={{
          background: 'rgba(255,255,255,0.95)',
          padding: '16px 16px 48px 16px',
          borderRadius: '8px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.2)',
          maxWidth: '90vw',
          maxHeight: '90vh',
        }}
      >
        <img
          src={currentSrc}
          alt={currentAlt}
          className="rounded object-contain"
          style={{ maxHeight: 'calc(85vh - 64px)', maxWidth: 'calc(90vw - 32px)' }}
          loading="eager"
        />
        {currentAlt && (
          <p
            className="absolute bottom-3 left-0 right-0 text-center text-sm text-gray-500"
            style={{ fontFamily: "'Caveat', 'Segoe Print', cursive", fontSize: '1rem' }}
          >
            {currentAlt}
          </p>
        )}
      </div>

      {/* Next Button */}
      {allImages.length > 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          aria-label="Nächstes Bild"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Counter */}
      {allImages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1 text-sm text-white backdrop-blur-sm">
          {currentIndex + 1} / {allImages.length}
        </div>
      )}
    </div>
  )
}
