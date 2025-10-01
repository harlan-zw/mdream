export interface MdreamPage {
  url: string
  title: string
  markdown: string
  html?: string
  description?: string
}

/**
 * Hook context for markdown processing
 */
export interface MdreamMarkdownContext {
  /** The original HTML content */
  html: string
  /** The generated markdown content */
  markdown: string
  /** The route being processed */
  route: string
  /** The page title extracted from HTML */
  title: string
  /** Page description extracted from meta tags or content */
  description: string
  /** Whether this is during prerendering */
  isPrerender: boolean
  /** The H3 event object for accessing request/response */
  event: import('h3').H3Event
}
