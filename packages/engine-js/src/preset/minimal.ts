import type { EngineOptions } from '../types'
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
} from '../const'

/**
 * Creates a configurable minimal preset with advanced options.
 * Returns declarative plugin config that works with both JS and Rust engines.
 */
export function withMinimalPreset<T extends EngineOptions>(
  options: T = {} as T,
): T {
  return {
    ...options,
    plugins: {
      frontmatter: true,
      isolateMain: true,
      tailwind: true,
      filter: {
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
      },
      // Allow user overrides
      ...options.plugins,
    },
  }
}
