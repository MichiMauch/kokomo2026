// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'

export default defineConfig({
  site: 'https://www.kokomo.house',
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
    react(),
  ],

  adapter: vercel(),

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },

  image: {
    service: passthroughImageService(),
  },
})
