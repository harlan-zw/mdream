import type { PageMetadata } from './types.ts'
import { htmlToMarkdown } from 'mdream'

export function extractMetadata(html: string, url: string): PageMetadata {
  const links: string[] = []
  let title = ''
  let description = ''
  let keywords = ''
  let author = ''

  htmlToMarkdown(html, {
    origin: new URL(url).origin,
    extraction: {
      'a[href]': (el) => {
        const href = el.attributes.href
        if (href) {
          try {
            const absoluteUrl = new URL(href, url).href
            if (!links.includes(absoluteUrl)) {
              links.push(absoluteUrl)
            }
          }
          catch {
            // Invalid URL, skip
          }
        }
      },
      'title': (el) => {
        if (!title)
          title = el.textContent
      },
      'meta[name="description"]': (el) => {
        if (!description)
          description = el.attributes.content || ''
      },
      'meta[property="og:description"]': (el) => {
        if (!description)
          description = el.attributes.content || ''
      },
      'meta[name="keywords"]': (el) => {
        if (!keywords)
          keywords = el.attributes.content || ''
      },
      'meta[name="author"]': (el) => {
        if (!author)
          author = el.attributes.content || ''
      },
      'meta[property="og:title"]': (el) => {
        if (!title)
          title = el.attributes.content || ''
      },
    },
  })

  return {
    title: title.trim() || new URL(url).pathname,
    description: description.trim() || undefined,
    keywords: keywords.trim() || undefined,
    author: author.trim() || undefined,
    links: links.filter((link) => {
      try {
        const linkUrl = new URL(link)
        const baseUrl = new URL(url)
        return linkUrl.hostname === baseUrl.hostname
      }
      catch {
        return false
      }
    }),
  }
}
