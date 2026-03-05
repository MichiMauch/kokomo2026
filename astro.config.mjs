// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'

export default defineConfig({
  site: 'https://www.kokomo.house',
  output: 'server',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/admin'),
      serialize: (item) => {
        // Set lastmod for all pages to build date
        item.lastmod = new Date().toISOString()
        // Higher priority for main pages
        if (item.url === 'https://www.kokomo.house/') {
          item.priority = 1.0
          item.changefreq = 'daily'
        } else if (item.url.includes('/tiny-house/') && !item.url.includes('/page/')) {
          item.priority = 0.8
          item.changefreq = 'weekly'
        } else {
          item.priority = 0.6
          item.changefreq = 'monthly'
        }
        return item
      },
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
