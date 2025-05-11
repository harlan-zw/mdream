import type { HTMLToMarkdownOptions, Plugin } from '../types.ts'
import { filterPlugin } from '../plugins.ts'

/**
 * Creates a configurable minimal preset with advanced options
 *
 * @param options HTML to Markdown options
 * @returns HTML to Markdown options with configured plugins
 */
export function withMinimalPreset(
  options: HTMLToMarkdownOptions & { fromFirstTag?: string } = {},
): HTMLToMarkdownOptions {
  // Create plugins array with necessary plugins
  const plugins: Plugin[] = [
    filterPlugin({
      exclude: [
        'nav',
        'footer',
        'aside',
        'form',
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
