import type { MdreamRuntimeState } from '../../../src/types'
import { describe, expect, it } from 'vitest'
import { applyBufferMarkers } from '../../../src/utils'

describe('applyBufferMarkers for streaming integration', () => {
  it('should correctly apply buffer markers to filter content', () => {
    // Create a state with buffer markers
    const state: MdreamRuntimeState = {
      bufferMarkers: [
        { position: 0, pause: true },
        { position: 10, pause: false },
        { position: 30, pause: true },
        { position: 40, pause: false },
      ],
    }

    // Our test content - note that we start at position 0 with isPaused=true
    const content = '0123456789ABCDEFGHIJKLMNOPQRST0123456789ABCDEFGHIJKLMNOPQRST'

    // Apply buffer markers
    const result = applyBufferMarkers(state, content)

    // The result should contain only the content between positions 10-30 and 40+ (the unpaused sections)
    expect(result).toBe('ABCDEFGHIJKLMNOPQRSTABCDEFGHIJKLMNOPQRST')

    // Make sure the result doesn't include the first 10 chars (which should be paused)
    expect(result).not.toContain('0123456789')
  })

  it('should handle content with whitespace that might be trimmed', () => {
    // Create a state with buffer markers
    const state: MdreamRuntimeState = {
      bufferMarkers: [
        { position: 0, pause: false },
        { position: 20, pause: true },
        { position: 40, pause: false },
      ],
    }

    // Text that starts and ends with whitespace that might be trimmed during processing
    const content = '   First content here      Second content with whitespace   '

    // The content length is important for buffer positions, but if whitespace is trimmed
    // during processing elsewhere, the positions might point to the wrong locations
    expect(content.length).toBe(60)

    // Apply buffer markers
    const result = applyBufferMarkers(state, content)

    // Should include first 20 chars, then skip until position 40
    // First 20 chars: "   First content her"
    expect(result.startsWith('   First content her')).toBe(true)

    // Should not include the middle section that's paused
    // This is what would be paused: "e      Second content"
    expect(result).not.toContain('e      Second content')

    // Should include content after position 40
    // After position 40: " with whitespace   "
    expect(result.endsWith(' with whitespace   ')).toBe(true)
  })

  it('should handle edge cases with buffer markers', () => {
    // Case 1: Start with paused = false
    const state1: MdreamRuntimeState = {
      bufferMarkers: [
        { position: 0, pause: false },
        { position: 10, pause: true },
      ],
    }
    const content1 = 'ABCDEFGHIJKLMNOPQRST'
    const result1 = applyBufferMarkers(state1, content1)
    expect(result1).toBe('ABCDEFGHIJ')

    // Case 3: No markers
    const state3: MdreamRuntimeState = {
      bufferMarkers: [],
    }
    const content3 = 'This should show everything'
    const result3 = applyBufferMarkers(state3, content3)
    expect(result3).toBe('This should show everything')

    // Case 4: Empty string
    const state4: MdreamRuntimeState = {
      bufferMarkers: [
        { position: 0, pause: false },
      ],
    }
    const result4 = applyBufferMarkers(state4, '')
    expect(result4).toBe('')

    // Case 5: All paused
    const state5: MdreamRuntimeState = {
      bufferMarkers: [
        { position: 0, pause: true },
      ],
    }
    const result5 = applyBufferMarkers(state5, 'This should be filtered out completely')
    expect(result5).toBe('')
  })

  it('should demonstrate how buffer positions get mangled during streaming', () => {
    // This test demonstrates how buffer positions get misaligned during streaming,
    // causing unwanted truncation in the middle of words

    // Third chunk with the content that gets truncated in the real-world examples
    const thirdChunk = `### More Resources
- [Web Scraping Basics](/tutorials/web-scraping)
- [Natural Language Processing](/tutorials/nlp)`

    // The issue is that the buffer markers are using absolute positions
    // but when streaming in chunks, we lose track of our absolute position

    // Let's simulate what happens in real streaming scenario:
    // 1. Create a marker that should cut in the middle of "Basics" based on local position
    const localCutPosition = thirdChunk.indexOf('Basics') + 3 // Cut after "Bas"

    // Create a state that simulates the issue by using the incorrect position
    const finalState: MdreamRuntimeState = {
      bufferMarkers: [
        { position: 0, pause: false },
        // Position to cut in the middle of "Basics"
        { position: localCutPosition, pause: true },
      ],
    }

    // Process the third chunk with our marker
    const result = applyBufferMarkers(finalState, thirdChunk)

    // This test should fail with the issue we're trying to demonstrate:
    // The word "Basics" gets cut in the middle to "Bas"
    expect(result).toContain('[Web Scraping Bas')
    expect(result).not.toContain('ics')

    // Here's the key problem: When we parse the third chunk after streaming out
    // the first two chunks, the buffer marker positions are not adjusted to account
    // for the content that was already sent.
    //
    // If buffer positions were properly adjusted during streaming, we would either:
    // 1. Have the marker position adjusted to account for content already sent, or
    // 2. Cut at a more sensible position (like a word boundary)
    //
    // This test intentionally shows the failing behavior to demonstrate the issue
  })

  it('should correctly handle navigation links at the beginning of content', () => {
    // This test mimics the issue in the technical content test
    // where navigation elements should be excluded

    // First, let's look at the content and calculate exact positions
    const content = `---
title: "Test"
---

- [Home](/)
- [Tutorials](/tutorials)
- [Documentation](/docs)

# Main Article Content

This is the main content that should be visible.`

    // Find exact positions for our markers
    const frontmatterEndPos = content.indexOf('---\n\n') + 4 // End of frontmatter section
    const mainContentStartPos = content.indexOf('# Main') // Start of main content

    const state: MdreamRuntimeState = {
      bufferMarkers: [
        // Start with showing the frontmatter
        { position: 0, pause: false },
        // Pause right after frontmatter ends
        { position: frontmatterEndPos, pause: true },
        // Resume at the main content
        { position: mainContentStartPos, pause: false },
      ],
    }

    // Apply buffer markers
    const result = applyBufferMarkers(state, content)

    // Check result contains expected parts

    // Frontmatter should be shown
    expect(result.includes('---')).toBe(true)
    expect(result.includes('title: "Test"')).toBe(true)

    // Navigation links should be paused/filtered out
    const navigationLinks = '- [Home](/)'

    // This is the key test - navigation links should be excluded
    expect(result.includes(navigationLinks)).toBe(false)

    // Main content should be visible
    expect(result.includes('# Main Article Content')).toBe(true)
    expect(result.includes('This is the main content that should be visible.')).toBe(true)
  })
})
