import type { APIRoute } from 'astro'
import { ImageResponse } from '@vercel/og'
import { siteConfig } from '../../lib/site-config'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || siteConfig.title
  const description = searchParams.get('description') || ''

  const html = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #5eead4 0%, #a7f3d0 30%, #bef264 70%, #d9f99d 100%)',
        padding: 60,
        fontFamily: 'sans-serif',
      },
      children: [
        // Header: Logo + Site Name
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              marginBottom: 40,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                    fontSize: 28,
                    fontWeight: 'bold',
                    color: 'white',
                  },
                  children: 'K',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 32,
                    fontWeight: 'bold',
                    color: '#0f172a',
                  },
                  children: 'KOKOMO House',
                },
              },
            ],
          },
        },
        // Title Card
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderRadius: 24,
              padding: '40px 50px',
              justifyContent: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: title.length > 60 ? 40 : 52,
                    fontWeight: 'bold',
                    color: '#0f172a',
                    lineHeight: 1.2,
                  },
                  children: title,
                },
              },
              ...(description
                ? [
                    {
                      type: 'div',
                      props: {
                        style: {
                          marginTop: 24,
                          fontSize: 22,
                          color: '#64748b',
                          lineHeight: 1.4,
                        },
                        children:
                          description.length > 150
                            ? description.substring(0, 150) + '...'
                            : description,
                      },
                    },
                  ]
                : []),
            ],
          },
        },
        // Footer
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 30,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 20,
                    color: '#334155',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    padding: '10px 20px',
                    borderRadius: 30,
                    display: 'flex',
                    alignItems: 'center',
                  },
                  children: 'www.kokomo.house',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 18,
                    color: '#0369a1',
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    padding: '10px 20px',
                    borderRadius: 30,
                  },
                  children: 'Tiny House Blog',
                },
              },
            ],
          },
        },
      ],
    },
  }

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
  })
}
