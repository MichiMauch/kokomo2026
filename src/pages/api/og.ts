import type { APIRoute } from 'astro'
import { ImageResponse } from '@vercel/og'
import { siteConfig } from '../../lib/site-config'

export const prerender = false

// Kokomo Bildmarke SVG as base64 data URI
const LOGO_SVG = `data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNi4xOCIgaGVpZ2h0PSIyMC4zNyIgdmlld0JveD0iMCAwIDE2LjE4IDIwLjM3Ij4KICA8ZGVmcz4KICAgIDxzdHlsZT4KICAgICAgLmNscy0xIHsKICAgICAgICBmaWxsOiAjMmRjN2ZmOwogICAgICB9CgogICAgICAuY2xzLTIgewogICAgICAgIGZpbGw6ICNlYWJhNmI7CiAgICAgIH0KCiAgICAgIC5jbHMtMyB7CiAgICAgICAgZmlsbDogIzA1ZGQ2NjsKICAgICAgfQoKICAgICAgLmNscy00IHsKICAgICAgICBmaWxsOiAjMDBhYmU3OwogICAgICB9CiAgICA8L3N0eWxlPgogIDwvZGVmcz4KICA8ZyBpZD0iRWJlbmVfMSIgZGF0YS1uYW1lPSJFYmVuZSAxIi8+CiAgPGcgaWQ9IkViZW5lXzIiIGRhdGEtbmFtZT0iRWJlbmUgMiI+CiAgICA8ZyBpZD0iYmlsZG1hcmtlIj4KICAgICAgPGcgaWQ9ImNvbG9yX2ZpbGwiIGRhdGEtbmFtZT0iY29sb3IgZmlsbCI+CiAgICAgICAgPHBhdGggaWQ9Indhc3NlciIgY2xhc3M9ImNscy00IiBkPSJNMS4zNywxNS4yNXMtLjUzLS43My0uNjEtMi42YzAsMCwyLjY2LTIuOTUsNy43NSwuMTEsNC4yLDIuNTIsNi43NCwxLjE0LDYuNzQsMS4xNCwwLDAtLjE4LDEuNDItMS4wMywyLjQxLDAsMC0uOTQsMS4wNi02LjEyLTEuMi0yLjY4LTEuMTctNC44LTEuMDctNi43MiwuMTNaIi8+CiAgICAgICAgPHBhdGggaWQ9Indhc3Nlci0yIiBkYXRhLW5hbWU9Indhc3NlciIgY2xhc3M9ImNscy0xIiBkPSJNMi42OCwxNy4yNnMtLjE2LDAtLjk1LTEuMzRjMCwwLDIuMzgtMi42LDYuNTItLjMzLDIuMTEsMS4wOCwyLjcxLDEuMjcsNS4yNSwxLjY1LDAsMC0uODEsMS4wMS0yLjQ5LDEuNzgsMCwwLTQuOTgtMi45NC04LjMzLTEuNzZaIi8+CiAgICAgICAgPHBhdGggaWQ9InNhbmQiIGNsYXNzPSJjbHMtMiIgZD0iTTMuMjksMTcuODZzMi45LS45Niw2LjgxLDEuNDhjMCwwLTMuNjcsMS4zOC02LjgxLTEuNDhaIi8+CiAgICAgICAgPHBhdGggaWQ9ImJsYXR0IiBjbGFzcz0iY2xzLTMiIGQ9Ik0xMC41OCw0LjExcy40My0xLjk5LDMuMTEtMS43bC0zLjExLDEuN1oiLz4KICAgICAgICA8cGF0aCBpZD0iYmxhdHQtMiIgZGF0YS1uYW1lPSJibGF0dCIgY2xhc3M9ImNscy0zIiBkPSJNOS43OSwzLjY4cy0xLjI0LTEuOTYsLjIzLTIuNzJsLS4yMywyLjcyWiIvPgogICAgICAgIDxwYXRoIGlkPSJibGF0dC0zIiBkYXRhLW5hbWU9ImJsYXR0IiBjbGFzcz0iY2xzLTMiIGQ9Ik05LjMsOS4zcy0xLjQxLTEuMDEsLjI4LTMuMTVsLS4yOCwzLjE1WiIvPgogICAgICAgIDxwYXRoIGlkPSJibGF0dC00IiBkYXRhLW5hbWU9ImJsYXR0IiBjbGFzcz0iY2xzLTMiIGQ9Ik01Ljc4LDcuODhzLS40MS0yLjc0LDMuMzEtMi43NGwtMy4zMSwyLjc0WiIvPgogICAgICA8L2c+CiAgICAgIDxwYXRoIGlkPSJwYWxtX28iIGRhdGEtbmFtZT0icGFsbSBvIiBkPSJNOC4wOCwyMC4zN2MtMi4zOSwwLTQuNTItMS4wMi02LTIuNjUtLjAzLS4wMy0uMDYtLjA3LS4wOS0uMUMuOCwxNi4yNSwuMDYsMTQuNDgsMCwxMi41MmMwLS4wOSwuMDMtLjE4LC4wOS0uMjUsLjAzLS4wMywyLjkzLTMuMzcsOC42OS0uMjIsLjA3LC4wNCwzLjk0LDIuNjMsNi42MiwuOTIsLjAyLS4yNCwuMDMtLjQ3LC4wMy0uNzEsMC0zLjM1LTItNi4xLTUuMDMtNi45OGwtLjQyLDQuNzdjLS4wMSwuMTMtLjA5LC4yNC0uMjEsLjMtLjEyLC4wNi0uMjYsLjA1LS4zNy0uMDItLjc0LS40Ny0xLjE5LTEuMDctMS4zMS0xLjc3LS4xMi0uNjYsLjA1LTEuMzIsLjMzLTEuOTFsLTIuNzEsMi4yNWMtLjEsLjA5LS4yNCwuMTEtLjM3LC4wNi0uMTMtLjA1LS4yMi0uMTYtLjI0LS4yOS0uMjMtMS4zNCwuMDItMi40LC43NC0zLjE0LC45Ny0xLDIuNTItMS4xNiwzLjQ5LTEuMTUtLjQzLS43Mi0uOTgtMS45Mi0uNjYtMi45MywuMjItLjY5LC43Ny0xLjE4LDEuNjUtMS40NSwuMTItLjA0LC4yNS0uMDEsLjM0LC4wNywuMDksLjA4LC4xNSwuMiwuMTQsLjMybC0uMTksMi4yMmMuMDctLjA3LC4xNS0uMTUsLjI0LS4yMiwuOTMtLjc1LDIuMy0uOTQsNC4wNy0uNTcsLjE1LC4wMywuMjcsLjE2LC4yOSwuMzEsLjAyLC4xNS0uMDUsLjMxLS4xOSwuMzgtMi4wNSwxLjEyLTMuMjgsMS43OS00LjAzLDIuMTcsMy4xNCwxLjEsNS4xNyw0LjA0LDUuMTcsNy41NywwLC45My0uMTYsMS44My0uNDUsMi42Ni0uMjMsLjY4LS41NCwxLjMtLjk0LDEuODcsMCwuMDEtLjAyLC4wMy0uMDMsLjA0LS44OSwxLjMtMi4xNCwyLjMyLTMuNjIsMi45My0uMDIsLjAxLS4wNSwuMDItLjA3LC4wMy0uOTMsLjM3LTEuOTQsLjU3LTMsLjU3Wm0tNC43OS0yLjUxYzEuMjgsMS4xLDIuOTUsMS43Niw0Ljc5LDEuNzYsLjcsMCwxLjM4LS4xLDIuMDItLjI4LTMuMzYtMS45Ni01Ljc5LTEuNzMtNi44MS0xLjQ4Wm0xLjQ3LS45MmMxLjQ4LDAsMy42MiwuNDIsNi4yNSwyLjA4LC45NS0uNDEsMS44LTEuMDIsMi40OS0xLjc4LTEuMTUsLjAzLTMuMTEtLjM1LTUuMjgtMS40OS0zLjQ3LTEuODEtNS44LS4zOC02LjQ5LC4xNiwuMzIsLjU0LC41NiwuODgsLjc1LDEuMTEsLjA3LC4wOCwuMTMsLjE1LC4yLC4yMywuMzUtLjEzLDEuMDYtLjMyLDIuMDgtLjMyWm0uMTYtMi44MmMxLjA0LDAsMi4yNiwuMjUsMy42NCwuOTcsMi42NiwxLjM5LDQuODcsMS41NCw1LjQ1LDEuMzIsLjA5LS4wNCwuMTYtLjA3LC4yLS4wOSwuMzMtLjQ5LC42LTEuMDMsLjgtMS42LC4wOS0uMjYsLjE3LS41MywuMjMtLjgxLTMsMS4zNi02LjY4LTEuMTEtNi44NS0xLjIyLTQuNjctMi41NS03LjEzLS41NC03LjY0LS4wNCwuMDUsLjkzLC4yNiwxLjgsLjYxLDIuNiwuNTktLjQzLDEuODItMS4xMywzLjU1LTEuMTNabTQuNjYtNy45N2MtLjQ0LC42Ni0uODgsMS41Mi0uNzQsMi4yOCwuMDYsLjMyLC4yMSwuNjEsLjQ3LC44N2wuMjgtMy4xNVptLS40OS0xLjAxYy0uODIsLjAyLTIsLjE5LTIuNywuOTItLjQzLC40NC0uNjMsMS4wNS0uNjEsMS44MmwzLjMxLTIuNzRabTQuMjItMi43NGMtLjgyLDAtMS40OCwuMTktMS45NywuNTgtLjQyLC4zMy0uNjQsLjc3LS43NiwxLjEzLC44Mi0uNDQsMi4xOS0xLjE5LDMuMTEtMS43LS4xMywwLS4yNi0uMDEtLjM4LS4wMVptLTMuMjktMS40NWMtLjMzLC4xOS0uNTMsLjQzLS42MywuNzMtLjE5LC42LC4wOCwxLjM3LC40LDEuOTlsLjIzLTIuNzJaIi8+CiAgICA8L2c+CiAgPC9nPgo8L3N2Zz4=`

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())

    // Satori only supports PNG/JPEG – convert WebP via sharp
    let pngBuffer: Buffer
    try {
      const sharp = (await import('sharp')).default
      pngBuffer = await sharp(buffer).resize(504, null, { fit: 'inside' }).png({ quality: 85 }).toBuffer()
    } catch {
      // If sharp fails, try raw (works if already PNG/JPEG)
      pngBuffer = buffer
    }

    const base64 = pngBuffer.toString('base64')
    return `data:image/png;base64,${base64}`
  } catch {
    return null
  }
}

export const GET: APIRoute = async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || siteConfig.title
  const description = searchParams.get('description') || ''
  const imageUrl = searchParams.get('image') || ''

  // Fetch and encode the post image if provided
  let imageDataUri: string | null = null
  if (imageUrl) {
    imageDataUri = await fetchImageAsBase64(imageUrl)
  }

  const html = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #5eead4 0%, #a7f3d0 30%, #bef264 70%, #d9f99d 100%)',
        padding: 50,
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
              marginBottom: 30,
            },
            children: [
              {
                type: 'img',
                props: {
                  src: LOGO_SVG,
                  width: 44,
                  height: 55,
                  style: { marginRight: 14 },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 30,
                    fontWeight: 'bold',
                    color: '#0f172a',
                  },
                  children: 'KOKOMO House',
                },
              },
            ],
          },
        },
        // Main Card: Text left, Image right
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flex: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.88)',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            },
            children: [
              // Left: Title + Description
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '36px 44px',
                    flex: imageDataUri ? '1 1 58%' : '1 1 100%',
                    maxWidth: imageDataUri ? '58%' : '100%',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: title.length > 60 ? 36 : title.length > 40 ? 42 : 48,
                          fontWeight: 'bold',
                          color: '#0f172a',
                          lineHeight: 1.2,
                          letterSpacing: '-0.02em',
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
                                marginTop: 20,
                                fontSize: 20,
                                color: '#64748b',
                                lineHeight: 1.5,
                              },
                              children:
                                description.length > 130
                                  ? description.substring(0, 130) + '…'
                                  : description,
                            },
                          },
                        ]
                      : []),
                  ],
                },
              },
              // Right: Titelbild (only if successfully fetched)
              ...(imageDataUri
                ? [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flex: '1 1 42%',
                          maxWidth: '42%',
                        },
                        children: [
                          {
                            type: 'img',
                            props: {
                              src: imageDataUri,
                              style: {
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              },
                            },
                          },
                        ],
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
              marginTop: 24,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 19,
                    color: '#334155',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    padding: '8px 20px',
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
                    fontSize: 17,
                    color: '#0369a1',
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    padding: '8px 20px',
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
