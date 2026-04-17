import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    lastmod: z.coerce.date().optional(),
    summary: z.string().max(300).optional(),
    tags: z.array(z.string()).default([]),
    authors: z.array(z.string()).default(['default']),
    images: z.union([z.string(), z.array(z.string())]).optional(),
    draft: z.boolean().default(false),
    canonicalUrl: z.string().url().optional(),
    youtube: z.string().optional(),
    postType: z.enum(['article', 'howto', 'faq']).optional(),
  }),
})

const authors = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    avatar: z.string().optional(),
    occupation: z.string().optional(),
    company: z.string().optional(),
    email: z.string().email().optional(),
    linkedin: z.string().url().optional(),
    instagram: z.string().url().optional(),
    facebook: z.string().url().optional(),
  }),
})

const briefs = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/briefs' }),
  schema: z.object({
    topic: z.string().optional(),
    angle: z.string().optional(),
    mood: z.string().optional(),
    key_points: z.array(z.string()).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    status: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
    body: z.string().optional(),
    image_prompt: z.string().optional(),
    image_url: z.string().optional(),
    youtube: z.string().optional(),
    date: z.string().optional(),
    draft: z.boolean().optional(),
  }),
})

export const collections = { posts, authors, briefs }
