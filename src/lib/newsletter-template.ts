/**
 * Newsletter HTML template builder
 * Pure function — usable on both server and client
 */

import type { NewsletterBlock, PostRef } from './newsletter-blocks'

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildNewsletterHtml(data: {
  postTitle: string
  postUrl: string
  postImage: string | null
  postSummary: string
  postDate: string
  unsubscribeUrl: string
  siteUrl: string
}): string {
  const formattedDate = new Date(data.postDate).toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `
    <div style="font-family: 'Poppins', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      ${
        data.postImage
          ? `
        <div>
          <img src="${escapeHtml(data.postImage)}" alt="${escapeHtml(data.postTitle)}" width="600" style="width: 100%; display: block; max-height: 320px; object-fit: cover;" />
        </div>
      `
          : `
        <div style="background: linear-gradient(135deg, #017734, #01ABE7); padding: 32px; text-align: center;">
          <img src="${escapeHtml(data.siteUrl)}/static/images/kokomo-bildmarke.svg" alt="KOKOMO" width="48" height="48" />
          <h1 style="color: white; margin: 8px 0 0; font-size: 20px; font-weight: 600;">KOKOMO House</h1>
        </div>
      `
      }
      <div style="padding: 32px;">
        <p style="color: #05DE66; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px;">
          ${formattedDate}
        </p>
        <h2 style="color: #111827; margin: 0 0 16px; font-size: 24px; font-weight: 700; line-height: 1.3;">
          ${escapeHtml(data.postTitle)}
        </h2>
        <p style="color: #374151; line-height: 1.7; font-size: 15px; margin: 0 0 28px;">
          ${escapeHtml(data.postSummary)}
        </p>
        <p style="text-align: center; margin: 0 0 32px;">
          <a href="${escapeHtml(data.postUrl)}" style="display: inline-block; background: #05DE66; color: white; padding: 14px 36px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Weiterlesen
          </a>
        </p>
      </div>
      <div style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px;">
          Du erhältst diesen Newsletter, weil du dich auf <a href="${escapeHtml(data.siteUrl)}" style="color: #05DE66; text-decoration: none;">kokomo.house</a> angemeldet hast.
        </p>
        <p style="margin: 0;">
          <a href="${escapeHtml(data.unsubscribeUrl)}" style="color: #9ca3af; font-size: 12px; text-decoration: underline;">Newsletter abbestellen</a>
        </p>
      </div>
    </div>
  `
}

// ─── Responsive Styles ───────────────────────────────────────────────

function responsiveStyles(): string {
  return `
    <style>
      @media (max-width: 620px) {
        .nl-outer { width: 100% !important; }
        .nl-pad { padding-left: 16px !important; padding-right: 16px !important; }
        .nl-article-img { display: block !important; width: 100% !important; padding-right: 0 !important; padding-bottom: 16px !important; }
        .nl-article-img img { width: 100% !important; height: auto !important; }
        .nl-article-text { display: block !important; width: 100% !important; }
        .nl-twocol-left, .nl-twocol-right { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; padding-bottom: 24px !important; }
        .nl-hero-img img { max-height: none !important; height: auto !important; }
        .nl-btn { padding: 16px 36px !important; min-height: 44px !important; }
      }
    </style>
  `
}

// ─── Multi-Block Newsletter ──────────────────────────────────────────

function cleanSlug(slug: string): string {
  return slug.replace(/\.md$/, '')
}

function renderHeroBlock(post: PostRef, siteUrl: string): string {
  const postUrl = `${siteUrl}/tiny-house/${cleanSlug(post.slug)}/`
  const imageHtml = post.image
    ? `<tr><td class="nl-hero-img"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" width="600" style="width: 100%; display: block; max-height: 400px; object-fit: cover;" /></td></tr>`
    : ''

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${imageHtml}
      <tr>
        <td class="nl-pad" style="padding: 24px 32px 32px 32px;">
          <h2 style="color: #111827; margin: 0 0 16px; font-size: 24px; font-weight: 700; line-height: 1.3;">
            <a href="${escapeHtml(postUrl)}" style="color: #111827; text-decoration: none;">${escapeHtml(post.title)}</a>
          </h2>
          <p style="color: #374151; line-height: 1.7; font-size: 15px; margin: 0 0 24px;">
            ${escapeHtml(post.summary)}
          </p>
          <p style="text-align: center; margin: 0;">
            <a href="${escapeHtml(postUrl)}" class="nl-btn" style="display: inline-block; background: #05DE66; color: white; padding: 14px 36px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Weiterlesen
            </a>
          </p>
        </td>
      </tr>
    </table>
  `
}

function renderArticleBlock(post: PostRef, siteUrl: string): string {
  const postUrl = `${siteUrl}/tiny-house/${cleanSlug(post.slug)}/`
  const imageCell = post.image
    ? `<td class="nl-article-img" width="160" valign="top" style="padding-right: 20px;">
        <a href="${escapeHtml(postUrl)}">
          <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" width="160" style="width: 160px; display: block; border-radius: 8px; object-fit: cover; height: auto;" />
        </a>
      </td>`
    : ''

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="nl-pad" style="padding: 0 32px 32px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${imageCell}
              <td class="nl-article-text" valign="top">
                <h3 style="color: #111827; margin: 0 0 8px; font-size: 18px; font-weight: 700; line-height: 1.3;">
                  <a href="${escapeHtml(postUrl)}" style="color: #111827; text-decoration: none;">${escapeHtml(post.title)}</a>
                </h3>
                <p style="color: #374151; line-height: 1.6; font-size: 14px; margin: 0 0 12px;">
                  ${escapeHtml(post.summary)}
                </p>
                <a href="${escapeHtml(postUrl)}" style="color: #05DE66; font-size: 14px; font-weight: 600; text-decoration: none;">
                  Weiterlesen &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

function renderTwoColumnBlock(postLeft: PostRef, postRight: PostRef, siteUrl: string): string {
  function renderCol(post: PostRef): string {
    const postUrl = `${siteUrl}/tiny-house/${cleanSlug(post.slug)}/`
    const imageHtml = post.image
      ? `<a href="${escapeHtml(postUrl)}"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" width="236" style="width: 100%; height: 150px; display: block; border-radius: 8px; object-fit: cover;" /></a>`
      : ''

    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding-bottom: 12px;">${imageHtml}</td></tr>
        <tr><td>
          <h3 style="color: #111827; margin: 0 0 8px; font-size: 16px; font-weight: 700; line-height: 1.3;">
            <a href="${escapeHtml(postUrl)}" style="color: #111827; text-decoration: none;">${escapeHtml(post.title)}</a>
          </h3>
          <p style="color: #374151; line-height: 1.6; font-size: 14px; margin: 0 0 12px;">
            ${escapeHtml(post.summary)}
          </p>
          <a href="${escapeHtml(postUrl)}" style="color: #05DE66; font-size: 14px; font-weight: 600; text-decoration: none;">
            Weiterlesen &rarr;
          </a>
        </td></tr>
      </table>
    `
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="nl-pad" style="padding: 0 32px 32px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td class="nl-twocol-left" width="50%" valign="top" style="padding-right: 12px;">
                ${renderCol(postLeft)}
              </td>
              <td class="nl-twocol-right" width="50%" valign="top" style="padding-left: 12px;">
                ${renderCol(postRight)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

function renderTextBlock(content: string): string {
  const htmlContent = escapeHtml(content).replace(/\n/g, '<br />')
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="nl-pad" style="padding: 0 32px 32px 32px;">
          <p style="color: #374151; line-height: 1.7; font-size: 15px; margin: 0;">
            ${htmlContent}
          </p>
        </td>
      </tr>
    </table>
  `
}

function renderSocialLinks(): string {
  return `
    <p style="margin: 0 0 16px; font-size: 13px;">
      <a href="https://www.instagram.com/kokomo.house" style="color: #05DE66; text-decoration: none; font-weight: 500;">Instagram</a>
      <span style="color: #d1d5db; padding: 0 6px;">&middot;</span>
      <a href="https://www.facebook.com/groups/tinyhousecommunityschweiz" style="color: #05DE66; text-decoration: none; font-weight: 500;">Facebook</a>
      <span style="color: #d1d5db; padding: 0 6px;">&middot;</span>
      <a href="https://www.linkedin.com/in/michimauch/" style="color: #05DE66; text-decoration: none; font-weight: 500;">LinkedIn</a>
      <span style="color: #d1d5db; padding: 0 6px;">&middot;</span>
      <a href="mailto:michi.mauch@gmail.com" style="color: #05DE66; text-decoration: none; font-weight: 500;">E-Mail</a>
    </p>
  `
}

function renderSeparator(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="nl-pad" style="padding: 0 32px;">
          <div style="border-top: 1px solid #e5e7eb; margin: 0 0 32px 0;"></div>
        </td>
      </tr>
    </table>
  `
}

export function buildMultiBlockNewsletterHtml(
  blocks: NewsletterBlock[],
  postsMap: Record<string, PostRef>,
  siteUrl: string,
  unsubscribeUrl: string,
): string {
  const renderedBlocks = blocks
    .map((block) => {
      switch (block.type) {
        case 'hero': {
          const post = postsMap[block.slug]
          return post ? renderHeroBlock(post, siteUrl) : ''
        }
        case 'article': {
          const post = postsMap[block.slug]
          return post ? renderArticleBlock(post, siteUrl) : ''
        }
        case 'two-column': {
          const left = postsMap[block.slugLeft]
          const right = postsMap[block.slugRight]
          return left && right ? renderTwoColumnBlock(left, right, siteUrl) : ''
        }
        case 'text':
          return block.content ? renderTextBlock(block.content) : ''
      }
    })
    .filter(Boolean)

  const blocksHtml = renderedBlocks.join(renderSeparator())
  const firstBlockIsHero = blocks.length > 0 && blocks[0].type === 'hero'
  const contentPadding = firstBlockIsHero ? 'padding: 0;' : 'padding: 24px 0 0;'

  return `
    ${responsiveStyles()}
    <table class="nl-outer" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="table-layout: fixed; font-family: 'Poppins', system-ui, -apple-system, sans-serif; max-width: 600px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      <tr>
        <td class="nl-pad" style="background: linear-gradient(135deg, #017734, #03B352); padding: 14px 32px; text-align: center;">
          <img src="${escapeHtml(siteUrl)}/static/images/kokomo-bildmarke.svg" alt="KOKOMO" width="32" height="32" style="display: inline; width: 32px; height: 32px; vertical-align: middle; margin-right: 10px;" /><span style="color: white; font-size: 18px; font-weight: 600; vertical-align: middle;">KOKOMO House</span>
        </td>
      </tr>
      <tr>
        <td style="${contentPadding}">
          ${blocksHtml}
        </td>
      </tr>
      <tr>
        <td class="nl-pad" style="background: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
          ${renderSocialLinks()}
          <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px;">
            Du erhältst diesen Newsletter, weil du dich auf <a href="${escapeHtml(siteUrl)}" style="color: #05DE66; text-decoration: none;">kokomo.house</a> angemeldet hast.
          </p>
          <p style="margin: 0;">
            <a href="${escapeHtml(unsubscribeUrl)}" style="color: #9ca3af; font-size: 13px; text-decoration: underline;">Newsletter abbestellen</a>
          </p>
        </td>
      </tr>
    </table>
  `
}
