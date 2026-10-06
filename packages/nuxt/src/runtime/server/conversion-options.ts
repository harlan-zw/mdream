import type { ExtractedElement, MdreamOptions } from 'mdream'
import type { ModuleRuntimeConfig } from '../types.js'

/** The page title and description that the module reads during a conversion. */
export interface PageMetadata {
  title: string
  description: string
}

const TITLE_SELECTOR = 'title'
const DESCRIPTION_SELECTOR = 'meta[name="description"]'

/**
 * Creates the options that the `mdream:config` hook receives.
 * `extraction` is always an object, so a hook can add a handler to it directly.
 */
export function createConfigHookOptions(origin: string, moduleOptions: ModuleRuntimeConfig['mdreamOptions']): MdreamOptions {
  return { origin, ...moduleOptions, extraction: { ...moduleOptions?.extraction } }
}

/**
 * Adds the title and description handlers after the `mdream:config` hook ran.
 * A hook can replace `extraction`, so these handlers merge with the hook's handlers.
 * If the hook also handles the title or description selector, both handlers run.
 * The returned metadata gets its values during the conversion.
 */
export function withPageMetadata(options: MdreamOptions): { options: MdreamOptions, metadata: PageMetadata } {
  const metadata: PageMetadata = { title: '', description: '' }
  const extraction = options.extraction
  const onTitle = extraction?.[TITLE_SELECTOR]
  const onDescription = extraction?.[DESCRIPTION_SELECTOR]
  return {
    metadata,
    options: {
      ...options,
      extraction: {
        ...extraction,
        [TITLE_SELECTOR]: (element: ExtractedElement) => {
          metadata.title = element.textContent
          onTitle?.(element)
        },
        [DESCRIPTION_SELECTOR]: (element: ExtractedElement) => {
          metadata.description = element.attributes.content || ''
          onDescription?.(element)
        },
      },
    },
  }
}
