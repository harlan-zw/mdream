import type { HTMLToMarkdownOptions, Plugin } from '../types.ts'
import {
  TAG_ASIDE,
  TAG_BUTTON,
  TAG_EMBED,
  TAG_FIELDSET,
  TAG_FIGURE,
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
  // Create plugins array with necessary plugins
  const plugins: Plugin[] = [
    isolateMainPlugin(),
    frontmatterPlugin(),
    tailwindPlugin(),
    // First apply readability plugin to extract main content
    // Then filter out unwanted tags
    filterPlugin({
      exclude: [
        TAG_FORM,
        TAG_FIELDSET,
        TAG_OBJECT,
        TAG_EMBED,
        TAG_FIGURE,
        TAG_FOOTER,
        TAG_ASIDE,
        TAG_IFRAME,
        TAG_INPUT,
        TAG_TEXTAREA,
        TAG_SELECT,
        TAG_BUTTON,
        TAG_NAV,
      ],
    }),
  ]
  // Include any existing plugins from options
  if (options.plugins) {
    plugins.push(...options.plugins)
  }

  return {
    ...options,
    plugins,
  }
}
