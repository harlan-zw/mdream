import { htmlToMarkdown as mdreamHtmlToMarkdown, streamHtmlToMarkdown as mdreamStreamHtmlToMarkdown } from 'mdream'

import { useRuntimeConfig } from 'nitropack/runtime'
import { describe, expect, it, vi } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/runtime/server/utils/mdream'

vi.mock('nitropack/runtime', () => ({
  useRuntimeConfig: vi.fn(),
}))

vi.mock('mdream', () => ({
  htmlToMarkdown: vi.fn((html: string, _opts?: any) => `# mocked\n\n${html}`),
  streamHtmlToMarkdown: vi.fn(async function* (_stream: any, _opts?: any) {
    yield '# streamed'
  }),
}))

describe('server utils', () => {
  describe('htmlToMarkdown', () => {
    it('should use module config as defaults when no options provided', () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({
        mdream: {
          enabled: true,
          mdreamOptions: { origin: 'https://example.com', minimal: true },
          cache: { maxAge: 3600, swr: true },
        },
      } as any)

      htmlToMarkdown('<h1>Hello</h1>')

      expect(mdreamHtmlToMarkdown).toHaveBeenCalledWith(
        '<h1>Hello</h1>',
        { origin: 'https://example.com', minimal: true },
      )
    })

    it('should merge per-call options over module config', () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({
        mdream: {
          enabled: true,
          mdreamOptions: { origin: 'https://example.com', minimal: true },
          cache: { maxAge: 3600, swr: true },
        },
      } as any)

      htmlToMarkdown('<h1>Hello</h1>', { origin: 'https://other.com' })

      expect(mdreamHtmlToMarkdown).toHaveBeenCalledWith(
        '<h1>Hello</h1>',
        { origin: 'https://other.com', minimal: true },
      )
    })

    it('should work when module has no mdreamOptions', () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({
        mdream: {
          enabled: true,
          cache: { maxAge: 3600, swr: true },
        },
      } as any)

      htmlToMarkdown('<h1>Hello</h1>', { origin: 'https://direct.com' })

      expect(mdreamHtmlToMarkdown).toHaveBeenCalledWith(
        '<h1>Hello</h1>',
        { origin: 'https://direct.com' },
      )
    })

    it('should use empty options when neither module config nor call options exist', () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({
        mdream: {
          enabled: true,
          cache: { maxAge: 3600, swr: true },
        },
      } as any)

      htmlToMarkdown('<h1>Hello</h1>')

      expect(mdreamHtmlToMarkdown).toHaveBeenCalledWith('<h1>Hello</h1>', {})
    })

    it('should return the conversion result', () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({
        mdream: { enabled: true, cache: { maxAge: 3600, swr: true } },
      } as any)

      const result = htmlToMarkdown('<h1>Hello</h1>')

      expect(result).toBe('# mocked\n\n<h1>Hello</h1>')
    })
  })

  describe('streamHtmlToMarkdown', () => {
    it('should pass resolved options to mdream stream', () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({
        mdream: {
          enabled: true,
          mdreamOptions: { origin: 'https://example.com' },
          cache: { maxAge: 3600, swr: true },
        },
      } as any)

      const mockStream = new ReadableStream()
      streamHtmlToMarkdown(mockStream, { clean: true })

      expect(mdreamStreamHtmlToMarkdown).toHaveBeenCalledWith(
        mockStream,
        { origin: 'https://example.com', clean: true },
      )
    })

    it('should return an async iterable', async () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({
        mdream: { enabled: true, cache: { maxAge: 3600, swr: true } },
      } as any)

      const result = streamHtmlToMarkdown(new ReadableStream())
      const chunks: string[] = []
      for await (const chunk of result) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['# streamed'])
    })
  })
})
