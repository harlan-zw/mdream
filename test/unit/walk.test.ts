import type { MdreamProcessingState, NodeEvent } from '../../src/types.js'
import { describe, expect, it } from 'vitest'
import { MAX_TAG_ID, NodeEventEnter } from '../../src/const.js'
import { htmlToMarkdown } from '../../src/index.js'
import { parseHTML } from '../../src/parser.js'

describe('hTML walking', () => {
  it('correctly tracks element depth in nested structures', () => {
    const html = '<div><p>Text in paragraph <span>inside span</span> more text</p></div>'
    const depthLog: { tagName: string, depth: number, event: string }[] = []

    const state: Partial<MdreamProcessingState> = {
      depthMap: new Uint8Array(MAX_TAG_ID),
      depth: 0,
      currentNode: null,
    }

    function handleEvent(event: NodeEvent) {
      const node = event.node
      const eventType = event.type === NodeEventEnter ? 'enter' : 'exit'

      if (node.type === 1) { // ELEMENT_NODE
        depthLog.push({
          tagName: node.name || '',
          depth: node.depth,
          event: eventType,
        })
      }
    }

    parseHTML(html, state as MdreamProcessingState, handleEvent)

    expect(depthLog).toEqual([
      { tagName: 'div', depth: 1, event: 'enter' },
      { tagName: 'p', depth: 2, event: 'enter' },
      { tagName: 'span', depth: 3, event: 'enter' },
      { tagName: 'span', depth: 3, event: 'exit' },
      { tagName: 'p', depth: 2, event: 'exit' },
      { tagName: 'div', depth: 1, event: 'exit' },
    ])
  })

  it('maintains correct depth when handling self-closing tags', () => {
    const html = '<div><p>Text with <img src="image.jpg" alt="image"> and <br> tags</p></div>'
    const depthLog: { tagName: string, depth: number, event: string }[] = []

    const state: Partial<MdreamProcessingState> = {
      depthMap: new Uint8Array(MAX_TAG_ID),
      depth: 0,
      currentNode: null,
    }

    function handleEvent(event: NodeEvent) {
      const node = event.node
      const eventType = event.type === NodeEventEnter ? 'enter' : 'exit'

      if (node.type === 1) { // ELEMENT_NODE
        depthLog.push({
          tagName: node.name || '',
          depth: node.depth,
          event: eventType,
        })
      }
    }

    parseHTML(html, state as MdreamProcessingState, handleEvent)

    expect(depthLog).toEqual([
      { tagName: 'div', depth: 1, event: 'enter' },
      { tagName: 'p', depth: 2, event: 'enter' },
      { tagName: 'img', depth: 3, event: 'enter' },
      { tagName: 'img', depth: 3, event: 'exit' },
      { tagName: 'br', depth: 3, event: 'enter' },
      { tagName: 'br', depth: 3, event: 'exit' },
      { tagName: 'p', depth: 2, event: 'exit' },
      { tagName: 'div', depth: 1, event: 'exit' },
    ])
  })

  it('tracks depthMap correctly for multiple levels of nested elements', () => {
    const html = '<div><ul><li><a href="#">Link <strong>with bold</strong> text</a></li></ul></div>'
    const depthMapLog: { tagName: string, depthMap: Uint8Array }[] = []

    const state: Partial<MdreamProcessingState> = {
      depthMap: new Uint8Array(MAX_TAG_ID),
      depth: 0,
      currentNode: null,
    }

    function handleEvent(event: NodeEvent) {
      const node = event.node

      if (event.type === NodeEventEnter && node.type === 1) { // ELEMENT_NODE enter
        depthMapLog.push({
          tagName: node.name || '',
          depthMap: new Uint8Array(node.depthMap), // Copy to avoid reference issues in test
        })
      }
    }

    parseHTML(html, state as MdreamProcessingState, handleEvent)

    // Note: depthMap uses numeric tag IDs, so we check for the presence and values
    // rather than exact objects
    expect(depthMapLog[0].tagName).toBe('div')
    expect(depthMapLog[1].tagName).toBe('ul')
    expect(depthMapLog[2].tagName).toBe('li')
    expect(depthMapLog[3].tagName).toBe('a')
    expect(depthMapLog[4].tagName).toBe('strong')

    // Each node should have a depthMap that includes itself and its ancestors
    // Check that the values in the Uint8Array for the corresponding tag IDs
    // are all greater than 0 for the expected elements
    const depthMap = depthMapLog[4].depthMap
    // Import these constants in a real implementation
    const divId = 36 // TAG_DIV
    const ulId = 24 // TAG_UL
    const liId = 25 // TAG_LI
    const aId = 26 // TAG_A
    const strongId = 14 // TAG_STRONG

    expect(depthMap[divId]).toBeGreaterThan(0)
    expect(depthMap[ulId]).toBeGreaterThan(0)
    expect(depthMap[liId]).toBeGreaterThan(0)
    expect(depthMap[aId]).toBeGreaterThan(0)
    expect(depthMap[strongId]).toBeGreaterThan(0)
  })

  it('handles complex nested elements with text nodes', () => {
    const html = `
      <article>
        <div>
          <h1>Title</h1>
          <p>Subtitle with <em>emphasis</em></p>
        </div>
        <section>
          <p>First paragraph</p>
          <blockquote>
            <p>Quote text</p>
          </blockquote>
        </section>
      </article>
    `

    // Rather than tracking every node event, let's verify the markdown output
    // which indirectly confirms that walking and depth tracking worked properly
    const markdown = htmlToMarkdown(html)

    expect(markdown).toContain('# Title')
    expect(markdown).toContain('Subtitle with _emphasis_')
    expect(markdown).toContain('First paragraph')
    expect(markdown).toContain('> Quote text')
  })

  it('handles malformed HTML by attempting to maintain proper nesting', () => {
    // Unclosed tags and improperly nested elements
    const html = '<div><p>Unclosed paragraph <span>Unclosed span <em>Emphasis</div>'
    const markdown = htmlToMarkdown(html)

    // The parser should handle this gracefully, closing tags when parent closes
    expect(markdown).toContain('Unclosed paragraph Unclosed span _Emphasis_')
  })

  it('handles deeply nested unclosed tags correctly', () => {
    const html = '<div><ul><li>First item <strong>with bold<ul><li>Nested unclosed item</div>'
    const markdown = htmlToMarkdown(html)

    // The parser should close all unclosed tags when the div closes
    expect(markdown).toContain('- First item **with bold')
    expect(markdown).toContain('- Nested unclosed item')
  })

  it('handles interleaved malformed and valid markup', () => {
    const html = `
      <h1>Title</h1>
      <p>Valid paragraph</p>
      <div><span>This div never closes
      <h2>Subtitle</h2>
      <ul><li>List item 1<li>List item 2</ul>
    `
    const markdown = htmlToMarkdown(html)

    // The parser should handle both the valid and invalid parts
    expect(markdown).toContain('# Title')
    expect(markdown).toContain('Valid paragraph')
    expect(markdown).toContain('This div never closes')
    expect(markdown).toContain('## Subtitle')
    expect(markdown).toContain('- List item 1')
    expect(markdown).toContain('- List item 2')
  })

  it('maintains correct element context when tags are deeply nested', () => {
    const html = `
      <div class="outer">
        <div class="inner">
          <ul>
            <li>Item 1</li>
            <li>Item 2 <a href="#"><em>Important</em> link</a></li>
            <li>Item 3</li>
          </ul>
        </div>
      </div>
    `

    const markdown = htmlToMarkdown(html)

    expect(markdown).toContain('- Item 1')
    expect(markdown).toContain('- Item 2 [_Important_ link](#)')
    expect(markdown).toContain('- Item 3')
  })
})
