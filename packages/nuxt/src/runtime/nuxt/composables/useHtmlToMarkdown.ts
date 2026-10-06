import type { MdreamOptions } from 'mdream'
import type { MaybeRefOrGetter } from 'vue'
import { ref, shallowRef, toValue, watch } from 'vue'

export function useHtmlToMarkdown(html?: MaybeRefOrGetter<string | undefined>, options?: Partial<MdreamOptions>) {
  const markdown = ref('')
  const error = shallowRef<Error | null>(null)
  const pending = ref(false)

  async function convert(input?: string, overrides?: Partial<MdreamOptions>) {
    const src = input ?? toValue(html)
    if (!src) {
      markdown.value = ''
      return ''
    }
    pending.value = true
    error.value = null
    // The browser entry returns Promise<string>; the Node entry returns a string.
    const { htmlToMarkdown } = import.meta.client ? await import('mdream/browser') : await import('mdream')
    const resolved = await htmlToMarkdown(src, { ...options, ...overrides })
    markdown.value = resolved
    pending.value = false
    return resolved
  }

  watch(() => toValue(html), (v) => {
    if (v) {
      convert().catch((e) => {
        error.value = e instanceof Error ? e : new Error(String(e))
        pending.value = false
      })
    }
    else {
      markdown.value = ''
    }
  }, { immediate: true })

  return { markdown, error, pending, convert }
}
