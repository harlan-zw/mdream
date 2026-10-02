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

const MINIMAL_EXCLUDE = [
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
]

/**
 * Creates a configurable minimal preset with advanced options.
 * Returns declarative plugin config that works with both JS and Rust engines.
 */
export function withMinimalPreset<T extends EngineOptions>(
  options: T = {} as T,
): T {
  // A filter adds to the preset's excludes rather than replacing them.
  // `filter: false` turns filtering off.
  const filter = options.plugins?.filter
  return {
    // Default clean: true unless explicitly overridden
    clean: options.clean !== undefined ? options.clean : true,
    ...options,
    plugins: {
      frontmatter: true,
      isolateMain: true,
      tailwind: true,
      // Allow user overrides
      ...options.plugins,
      filter: filter === false
        ? false
        : { ...filter, exclude: [...MINIMAL_EXCLUDE, ...(filter?.exclude ?? [])] },
    },
  }
}
