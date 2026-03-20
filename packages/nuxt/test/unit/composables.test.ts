import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useHtmlToMarkdown } from '../../src/runtime/nuxt/composables/useHtmlToMarkdown'

vi.mock('mdream', () => ({
  htmlToMarkdown: vi.fn((html: string, _opts?: any) => `# ${html}`),
}))

describe('useHtmlToMarkdown', () => {
  it('should return reactive state', () => {
    const { markdown, error, pending, convert } = useHtmlToMarkdown()

    expect(markdown.value).toBe('')
    expect(error.value).toBeNull()
    expect(pending.value).toBe(false)
    expect(typeof convert).toBe('function')
  })

  it('should auto-convert when html string is provided', async () => {
    const { markdown, pending } = useHtmlToMarkdown('<h1>Hello</h1>')

    await vi.waitFor(() => {
      expect(pending.value).toBe(false)
      expect(markdown.value).toContain('Hello')
    })
  })

  it('should accept a ref and react to changes', async () => {
    const html = ref('<h1>First</h1>')
    const { markdown } = useHtmlToMarkdown(html)

    await vi.waitFor(() => {
      expect(markdown.value).toContain('First')
    })

    html.value = '<h1>Second</h1>'

    await vi.waitFor(() => {
      expect(markdown.value).toContain('Second')
    })
  })

  it('should accept a getter', async () => {
    const html = ref('<p>Getter</p>')
    const { markdown } = useHtmlToMarkdown(() => html.value)

    await vi.waitFor(() => {
      expect(markdown.value).toContain('Getter')
    })
  })

  it('should clear markdown when ref becomes undefined', async () => {
    const html = ref<string | undefined>('<h1>Hello</h1>')
    const { markdown } = useHtmlToMarkdown(html)

    await vi.waitFor(() => {
      expect(markdown.value).toContain('Hello')
    })

    html.value = undefined

    await vi.waitFor(() => {
      expect(markdown.value).toBe('')
    })
  })

  it('should convert on demand via convert()', async () => {
    const { markdown, convert } = useHtmlToMarkdown()

    const result = await convert('<p>Test</p>')

    expect(result).toContain('Test')
    expect(markdown.value).toContain('Test')
  })

  it('should accept options', async () => {
    const mdream = await import('mdream')
    const { convert } = useHtmlToMarkdown(undefined, { origin: 'https://example.com' })

    await convert('<a href="/page">Link</a>')

    expect(mdream.htmlToMarkdown).toHaveBeenCalledWith(
      '<a href="/page">Link</a>',
      expect.objectContaining({ origin: 'https://example.com' }),
    )
  })

  it('should merge per-call overrides with base options', async () => {
    const mdream = await import('mdream')
    const { convert } = useHtmlToMarkdown(undefined, { origin: 'https://example.com' })

    await convert('<p>Test</p>', { clean: true })

    expect(mdream.htmlToMarkdown).toHaveBeenCalledWith(
      '<p>Test</p>',
      expect.objectContaining({ origin: 'https://example.com', clean: true }),
    )
  })

  it('should return empty string for empty input', async () => {
    const { convert, markdown } = useHtmlToMarkdown()

    const result = await convert()
    expect(result).toBe('')
    expect(markdown.value).toBe('')
  })

  it('should set error on failure', async () => {
    const mdream = await import('mdream')
    vi.mocked(mdream.htmlToMarkdown).mockImplementationOnce(() => {
      throw new Error('conversion failed')
    })

    const { error, pending } = useHtmlToMarkdown('<bad>')

    await vi.waitFor(() => {
      expect(pending.value).toBe(false)
      expect(error.value).toBeInstanceOf(Error)
      expect(error.value!.message).toBe('conversion failed')
    })
  })
})
