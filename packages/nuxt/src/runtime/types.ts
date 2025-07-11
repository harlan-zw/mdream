export interface MdreamPage {
  url: string
  title: string
  markdown: string
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
  /** Whether this is during prerendering */
  isPrerender: boolean
}
