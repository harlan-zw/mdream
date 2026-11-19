// Type checked with the Markdown condition for both the browser and Worker.
import type { CleanOptions, ExtractedElement, FrontmatterConfig, MdreamOptions, TagOverride } from 'mdream'
import type {
  CleanOptions as BrowserCleanOptions,
  ExtractedElement as BrowserExtractedElement,
  FrontmatterConfig as BrowserFrontmatterConfig,
  MdreamOptions as BrowserOptions,
  TagOverride as BrowserTagOverride,
} from 'mdream/browser'
import { htmlToMarkdown } from 'mdream'
import { htmlToMarkdown as browserHtmlToMarkdown } from 'mdream/browser'

export type EdgeFeatureTypes = CleanOptions | ExtractedElement | FrontmatterConfig | TagOverride
export type BrowserFeatureTypes = BrowserCleanOptions | BrowserExtractedElement | BrowserFrontmatterConfig | BrowserTagOverride

const options: MdreamOptions & BrowserOptions = { origin: 'https://example.com', format: 'markdown' }
export const edgeMarkdown: string = htmlToMarkdown('<h1>Hi</h1>', options)
export const browserMarkdown: Promise<string> = browserHtmlToMarkdown('<h1>Hi</h1>', options)

// @ts-expect-error Text requires the full build.
htmlToMarkdown('<h1>Hi</h1>', { format: 'text' })
// @ts-expect-error Cleanup requires the full build.
browserHtmlToMarkdown('<h1>Hi</h1>', { clean: true })
