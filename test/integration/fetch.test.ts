import { describe, expect, it } from 'vitest'
import { streamHtmlToMarkdown } from '../../src'

describe('fetch', () => {
  it('wiki', async () => {
    try {
      const response = await fetch('https://en.wikipedia.org/wiki/Markdown', {
        // Add a reasonable timeout
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`)
      }

      const htmlStream = response.body
      if (!htmlStream) {
        throw new Error('Response body stream is null')
      }

      const markdownStream = streamHtmlToMarkdown(htmlStream, {
        chunkSize: 20000, // less files
      })

      let chunkIndex = 0
      let final = ''
      for await (const chunk of markdownStream) {
        if (chunk.trim()) {
          await expect(chunk).toMatchFileSnapshot(`__snapshots__/wiki-chunk-${chunkIndex}.md`)
          chunkIndex++
          final += chunk
        }
      }

      await expect(final).toMatchFileSnapshot(`__snapshots__/wiki-chunk-final.md`)

      // Verify we received at least one chunk
      expect(chunkIndex).toBeGreaterThan(0)
    }
    catch (error) {
      console.error('Test failed:', error)
      throw error
    }
  }, 15000) // Increase timeout for the entire test
})
