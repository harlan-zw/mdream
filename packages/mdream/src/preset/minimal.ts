import type { HTMLToMarkdownOptions, Plugin } from '../types.ts'
import {
  TAG_ASIDE,
  TAG_BUTTON,
  TAG_EMBED,
  TAG_FIELDSET,
  TAG_FOOTER,
  TAG_FORM,
  TAG_IFRAME,
  TAG_INPUT,
  TAG_NAV,
  TAG_OBJECT,
  TAG_SELECT,
  TAG_TEXTAREA,
} from '../const.ts'
import { filterPlugin, frontmatterPlugin, isolateMainPlugin, tailwindPlugin } from '../plugins.ts'

/**
 * Creates a configurable minimal preset with advanced options
 *
 * @param options HTML to Markdown options
 * @returns HTML to Markdown options with configured plugins
 */
export function withMinimalPreset(
  options: HTMLToMarkdownOptions = {},
): HTMLToMarkdownOptions {
  const filter = filterPlugin({
    exclude: [
      TAG_FORM,
      TAG_FIELDSET,
      TAG_OBJECT,
      TAG_EMBED,
      TAG_FOOTER,
      TAG_ASIDE,
      TAG_IFRAME,
      TAG_INPUT,
      TAG_TEXTAREA,
      TAG_SELECT,
      TAG_BUTTON,
      TAG_NAV,
    ],
  })

  // Create plugins array with necessary plugins
  // User plugins run before filter so they can override skip decisions via { skip: false }
  const plugins: Plugin[] = [
    // First extract frontmatter from head section
    frontmatterPlugin(),
    // Then isolate main content
    isolateMainPlugin(),
    tailwindPlugin(),
    // User plugins before filter - allows overriding exclusions
    ...(options.plugins || []),
    // Filter out unwanted tags last
    filter,
  ]

  return {
    ...options,
    plugins,
  }
}
