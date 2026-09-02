import type { MdreamOptions } from '../types'
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
import { filterPlugin } from '../plugins/filter'
import { frontmatterPlugin } from '../plugins/frontmatter'
import { isolateMainPlugin } from '../plugins/isolate-main'
import { tailwindPlugin } from '../plugins/tailwind'

/**
 * Compose the minimal plugin set with explicit user plugins.
 */
export function withMinimalPreset(options: MdreamOptions = {}): MdreamOptions {
  return {
    ...options,
    clean: options.clean ?? true,
    plugins: [
      frontmatterPlugin(),
      isolateMainPlugin(),
      tailwindPlugin(),
      filterPlugin({
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
      }),
      ...(options.plugins ?? []),
    ],
  }
}
