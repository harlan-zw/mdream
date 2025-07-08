import type { PageMetadata } from './types.ts'
import { htmlToMarkdown } from 'mdream'
import { extractionPlugin } from 'mdream/plugins'

export function extractMetadata(html: string, url: string): PageMetadata {
  const links: string[] = []
  let title = ''
  let description = ''
  let keywords = ''
  let author = ''

  // Use mdream extraction plugin to extract links and metadata
  const extractionPluginInstance = extractionPlugin({
    'a[href]': (element) => {
      const href = element.attributes?.href
      if (href) {
        try {
          // Resolve relative URLs
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
    'title': (element) => {
      if (!title && element.textContent) {
        title = element.textContent.trim()
      }
    },
    'meta[name="description"]': (element) => {
      if (!description && element.attributes?.content) {
        description = element.attributes.content.trim()
      }
    },
    'meta[property="og:description"]': (element) => {
      if (!description && element.attributes?.content) {
        description = element.attributes.content.trim()
      }
    },
    'meta[name="keywords"]': (element) => {
      if (!keywords && element.attributes?.content) {
        keywords = element.attributes.content.trim()
      }
    },
    'meta[name="author"]': (element) => {
      if (!author && element.attributes?.content) {
        author = element.attributes.content.trim()
      }
    },
    'meta[property="og:title"]': (element) => {
      if (!title && element.attributes?.content) {
        title = element.attributes.content.trim()
      }
    },
  })

  // Process HTML to extract metadata
  htmlToMarkdown(html, {
    plugins: [extractionPluginInstance],
    origin: new URL(url).origin,
  })

  return {
    title: title || new URL(url).pathname,
    description: description || undefined,
    keywords: keywords || undefined,
    author: author || undefined,
    links: links.filter((link) => {
      try {
        const linkUrl = new URL(link)
        const baseUrl = new URL(url)
        // Only include links from same domain by default
        return linkUrl.hostname === baseUrl.hostname
      }
      catch {
        return false
      }
    }),
  }
}
