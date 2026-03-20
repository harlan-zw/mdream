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
    const mdream = await import('mdream')
    const result: any = mdream.htmlToMarkdown(src, { ...options, ...overrides } as any)
    // browser WASM build returns Promise<{ markdown }>, node NAPI returns string
    const resolved = typeof result === 'string' ? result : (await result).markdown
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
