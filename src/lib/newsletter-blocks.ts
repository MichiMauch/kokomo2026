/**
 * Shared types for the newsletter block editor
 */

export interface PostRef {
  slug: string
  title: string
  summary: string
  image: string | null
  date: string
}

export interface HeroBlock {
  id: string
  type: 'hero'
  slug: string
}

export interface SingleArticleBlock {
  id: string
  type: 'article'
  slug: string
}

export interface TwoColumnBlock {
  id: string
  type: 'two-column'
  slugLeft: string
  slugRight: string
}

export interface TextBlock {
  id: string
  type: 'text'
  content: string
}

export type NewsletterBlock = HeroBlock | SingleArticleBlock | TwoColumnBlock | TextBlock

export interface NewsletterTemplate {
  id: string
  name: string
  slots: { type: NewsletterBlock['type'] }[]
  builtIn?: boolean
}

export const BUILT_IN_TEMPLATES: NewsletterTemplate[] = [
  {
    id: 'hero-text',
    name: 'Hero + Freitext',
    builtIn: true,
    slots: [{ type: 'hero' }, { type: 'text' }],
  },
  {
    id: 'hero-2col',
    name: 'Hero + 2 Artikel',
    builtIn: true,
    slots: [{ type: 'hero' }, { type: 'two-column' }],
  },
  {
    id: 'full',
    name: 'Komplett',
    builtIn: true,
    slots: [
      { type: 'hero' },
      { type: 'article' },
      { type: 'two-column' },
      { type: 'text' },
    ],
  },
]
