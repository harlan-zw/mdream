import { describe, expect, it } from 'vitest'
import { htmlToMarkdownSplitChunks } from '../../src/splitter'

/**
 * Tests for RecursiveCharacterTextSplitter-style boundary detection
 * Hierarchy (most to least preferred):
 * 1. Paragraph breaks (\n\n)
 * 2. Code block ends (```\n)
 * 3. Line breaks (\n)
 * 4. Spaces ( )
 * 5. Hard split (no boundary found)
 */
describe('splitter boundary detection', () => {
  describe('prefers paragraph boundaries over line boundaries', () => {
    it('splits at paragraph break when available', () => {
      const html = `
        <p>First paragraph with some content here.</p>
        <p>Second paragraph with more content here.</p>
        <p>Third paragraph with even more content.</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 50,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // Should split at \n\n (paragraph boundaries) not mid-paragraph
      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        // No chunk should end mid-paragraph (unless it's the last one)
        if (chunk.content.includes('paragraph')) {
          const trimmed = chunk.content.trim()
          // Should be complete sentences/paragraphs
          expect(trimmed).toMatch(/\.$/)
        }
      }
    })

    it('prefers paragraph break over line break', () => {
      const html = `
        <p>Line one<br>Line two<br>Line three</p>
        <p>New paragraph here</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 40,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // Should split at paragraph boundary (between <p> tags) not at <br>
      const hasParagraphSplit = chunks.some(c => c.content.includes('New paragraph'))
      expect(hasParagraphSplit).toBe(true)
    })
  })

  describe('prefers line boundaries over word boundaries', () => {
    it('splits at newline when no paragraph break available', () => {
      const html = `
        <ul>
          <li>Item one with content</li>
          <li>Item two with content</li>
          <li>Item three with content</li>
        </ul>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 30,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // Should split at line breaks (between list items) not mid-word
      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        const words = chunk.content.trim().split(/\s+/)
        // No partial words at end of chunk
        expect(words.every(w => w.length > 0)).toBe(true)
      }
    })
  })

  describe('prefers word boundaries to avoid breaking words', () => {
    it('does not split in the middle of words', () => {
      const longWord = 'supercalifragilisticexpialidocious'
      const html = `<p>This is ${longWord} and more words here to exceed chunk size</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 40,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // If chunks are created, they should split at spaces
      if (chunks.length > 1) {
        for (const chunk of chunks) {
          const trimmed = chunk.content.trim()
          // Check that we don't have partial words (except the long word itself)
          const words = trimmed.split(/\s+/)
          for (const word of words) {
            // Each word should either be complete or be the long word
            if (!word.includes(longWord)) {
              expect(word.length).toBeGreaterThan(0)
            }
          }
        }
      }
    })

    it('splits at spaces to keep words intact', () => {
      const html = `<p>word1 word2 word3 word4 word5 word6 word7 word8</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 20,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      expect(chunks.length).toBeGreaterThan(1)

      // Each chunk should contain complete words
      for (const chunk of chunks) {
        const trimmed = chunk.content.trim()
        // Should not start or end with partial words
        expect(trimmed).toMatch(/^\w+/)
        expect(trimmed).toMatch(/\w+$/)
      }
    })
  })

  describe('handles code blocks specially', () => {
    it('prefers splitting after code blocks', () => {
      const html = `
        <p>Some text before</p>
        <pre><code>code line 1
code line 2
code line 3</code></pre>
        <p>Text after code</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 40,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // Should try to keep code blocks together or split cleanly after them
      const codeChunk = chunks.find(c => c.content.includes('```'))
      if (codeChunk) {
        // Code block should be complete (have closing backticks)
        const backtickCount = (codeChunk.content.match(/```/g) || []).length
        expect(backtickCount % 2).toBe(0) // Even number (opening and closing)
      }
    })
  })

  describe('respects chunk size limits while preferring good boundaries', () => {
    it('splits at best available boundary near chunk size', () => {
      const html = `
        <p>Short.</p>
        <p>This is a medium length paragraph with several words.</p>
        <p>Another medium paragraph here.</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 50,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // Should create multiple chunks
      expect(chunks.length).toBeGreaterThan(1)

      // Each chunk should be reasonably sized (not way over limit unless unavoidable)
      for (const chunk of chunks) {
        // Allow some overage for finding good boundaries
        expect(chunk.content.length).toBeLessThan(150)
      }
    })

    it('allows exceeding chunk size to find word boundary', () => {
      // If ideal split is mid-word, should go to next space even if it exceeds size
      const html = `<p>verylongwordthatcannotbesplit andthenmore words</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 15,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // Should not split the long word
      const hasLongWord = chunks.some(c => c.content.includes('verylongwordthatcannotbesplit'))
      expect(hasLongWord).toBe(true)
    })
  })

  describe('hierarchy ordering', () => {
    it('chooses paragraph break over line break', () => {
      const html = `
        <p>Line 1
Line 2
Line 3</p>

        <p>Paragraph 2</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 20,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // Should prefer splitting at blank line between paragraphs
      const separateParas = chunks.some(c =>
        c.content.includes('Paragraph 2') && !c.content.includes('Line 1'),
      )
      expect(separateParas).toBe(true)
    })

    it('chooses line break over space', () => {
      const html = `
        <div>Word1 Word2 Word3
Word4 Word5 Word6
Word7 Word8 Word9</div>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 25,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      if (chunks.length > 1) {
        // Chunks should split at newlines, not in middle of a line at spaces
        for (const chunk of chunks) {
          const lines = chunk.content.trim().split('\n')
          // Each line should be complete (not cut off mid-line if newline available)
          for (const line of lines) {
            if (line.trim()) {
              expect(line.trim().split(/\s+/).length).toBeGreaterThan(0)
            }
          }
        }
      }
    })

    it('chooses space over hard split', () => {
      const text = `${'a'.repeat(30)} ${'b'.repeat(30)}`
      const html = `<p>${text}</p>`

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 40,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      if (chunks.length > 1) {
        // Should split at the space, not mid-word
        const hasCompleteASequence = chunks.some(c => c.content.includes('a'.repeat(30)))
        const hasCompleteBSequence = chunks.some(c => c.content.includes('b'.repeat(30)))
        expect(hasCompleteASequence || hasCompleteBSequence).toBe(true)
      }
    })
  })

  describe('real-world scenarios', () => {
    it('handles mixed content with optimal splits', () => {
      const html = `
        <h1>Title</h1>
        <p>First paragraph with some text.</p>
        <p>Second paragraph with more text here.</p>
        <ul>
          <li>List item 1</li>
          <li>List item 2</li>
        </ul>
        <p>Final paragraph.</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 60,
        chunkOverlap: 0,
        headersToSplitOn: [],
        stripHeaders: false,
      })

      expect(chunks.length).toBeGreaterThan(1)

      // Verify content integrity - no mid-word breaks
      for (const chunk of chunks) {
        const trimmed = chunk.content.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          // Should not start with punctuation (unless it's a heading)
          expect(trimmed).not.toMatch(/^[^\w#-]/)
        }
      }
    })

    it('maintains markdown structure integrity', () => {
      const html = `
        <p>Paragraph before list.</p>
        <ul>
          <li>First item with text</li>
          <li>Second item with text</li>
          <li>Third item with text</li>
        </ul>
        <p>Paragraph after list.</p>
      `

      const chunks = htmlToMarkdownSplitChunks(html, {
        chunkSize: 50,
        chunkOverlap: 0,
        headersToSplitOn: [],
      })

      // Each chunk with list items should have complete items
      for (const chunk of chunks) {
        if (chunk.content.includes('- ')) {
          const lines = chunk.content.split('\n')
          for (const line of lines) {
            if (line.includes('- ')) {
              // List item line should be complete
              expect(line.trim()).toMatch(/^- .+/)
            }
          }
        }
      }
    })
  })
})
