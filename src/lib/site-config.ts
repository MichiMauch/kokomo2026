export const siteConfig = {
  title: 'KOKOMO House',
  author: 'Sibylle & Michi',
  headerTitle: 'KOKOMO House',
  description: 'Der Tiny House Blog',
  language: 'de-CH',
  locale: 'de-CH',
  siteUrl: 'https://www.kokomo.house',
  siteLogo: '/static/images/kokomo-bildmarke.svg',
  socialBanner: '/static/images/logo.png',
  email: 'michi.mauch@gmail.com',
  facebook: 'https://www.facebook.com/groups/tinyhousecommunityschweiz',
  linkedin: 'https://www.linkedin.com/in/michimauch/',
  instagram: 'https://www.instagram.com/kokomo.house',
  postsPerPage: 9,
  theme: 'system' as 'system' | 'dark' | 'light',
  analytics: {
    matomo: {
      siteId: '1',
      url: '//matomo.kokomo.house/',
    },
  },
} as const
