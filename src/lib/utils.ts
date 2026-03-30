import GithubSlugger from 'github-slugger'

const slugger = new GithubSlugger()

/**
 * Format a date to a localized string (de-CH)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('de-CH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Generate URL-safe slug from text
 */
export function slugify(text: string): string {
  slugger.reset()
  return slugger.slug(text)
}

/**
 * Generate slug for a blog post URL
 * Handles German umlauts: ä→ae, ö→oe, ü→ue, ß→ss
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Calculate reading time for German text
 */
export function getReadingTime(text: string): string {
  const wordsPerMinute = 200
  const words = text.trim().split(/\s+/).length
  const minutes = Math.ceil(words / wordsPerMinute)
  return `${minutes} Min. Lesezeit`
}

/**
 * Get all unique tags from posts with counts
 */
export function getTagCounts(
  posts: Array<{ data: { tags: string[]; draft?: boolean } }>
): Record<string, number> {
  const counts: Record<string, number> = {}
  posts
    .filter((p) => !p.data.draft)
    .forEach((post) => {
      post.data.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1
      })
    })
  return counts
}

/**
 * Sort posts by date (newest first)
 */
export function sortPostsByDate<T extends { data: { date: Date } }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

/**
 * Get featured image URL from post data
 */
export function getPostImage(images: string | string[] | undefined): string | undefined {
  if (!images) return undefined
  if (Array.isArray(images)) return images[0]
  return images
}

/**
 * Get thumbnail URL for a post image (600px wide variant)
 */
export function getPostImageThumb(images: string | string[] | undefined): string | undefined {
  const url = getPostImage(images)
  if (!url) return undefined
  // Only titelbild images have thumbnails
  if (!url.includes('-titelbild.webp')) return url
  // Strip query params, add -thumb, re-add query
  const [base, query] = url.split('?')
  const thumbBase = base.replace('-titelbild.webp', '-titelbild-thumb.webp')
  return query ? `${thumbBase}?${query}` : thumbBase
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}
