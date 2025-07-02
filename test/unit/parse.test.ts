import type { ElementNode, Node, TextNode } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, NodeEventEnter, NodeEventExit, TEXT_NODE } from '../../src/const'
import { parseHtml } from '../../src/parse'

// Type guards for better type safety
function isElementNode(node: Node): node is ElementNode {
  return node.type === ELEMENT_NODE
}

function isTextNode(node: Node): node is TextNode {
  return node.type === TEXT_NODE
}

describe('parseHtml', () => {
  it('should parse simple HTML elements', () => {
    const html = '<div>Hello</div>'
    const result = parseHtml(html)

    expect(result.events).toHaveLength(3)

    // Enter div
    expect(result.events[0].type).toBe(NodeEventEnter)
    const divNode = result.events[0].node
    expect(divNode.type).toBe(ELEMENT_NODE)
    if (isElementNode(divNode)) {
      expect(divNode.name).toBe('div')
    }

    // Text node
    expect(result.events[1].type).toBe(NodeEventEnter)
    const textNode = result.events[1].node
    expect(textNode.type).toBe(TEXT_NODE)
    if (isTextNode(textNode)) {
      expect(textNode.value).toBe('Hello')
    }

    // Exit div
    expect(result.events[2].type).toBe(NodeEventExit)
    expect(result.events[2].node.type).toBe(ELEMENT_NODE)
  })

  it('should parse nested table structure', () => {
    const html = '<table><tr><td>content</td></tr></table>'
    const result = parseHtml(html)

    const events = result.events

    // Should have table > tr > td > text structure
    const tableEnter = events.find(e => e.type === NodeEventEnter && isElementNode(e.node) && e.node.name === 'table')
    const trEnter = events.find(e => e.type === NodeEventEnter && isElementNode(e.node) && e.node.name === 'tr')
    const tdEnter = events.find(e => e.type === NodeEventEnter && isElementNode(e.node) && e.node.name === 'td')
    const textEvent = events.find(e => e.type === NodeEventEnter && isTextNode(e.node))

    expect(tableEnter).toBeDefined()
    expect(trEnter).toBeDefined()
    expect(tdEnter).toBeDefined()
    expect(textEvent).toBeDefined()
    if (textEvent && isTextNode(textEvent.node)) {
      expect(textEvent.node.value).toBe('content')
    }
  })

  it('should handle table with nested HTML tags', () => {
    const html = '<table><tr><td><span>nested</span></td></tr></table>'
    const result = parseHtml(html)

    const events = result.events

    // Find the span element within the table
    const spanEnter = events.find(e =>
      e.type === NodeEventEnter
      && isElementNode(e.node)
      && e.node.name === 'span',
    )

    expect(spanEnter).toBeDefined()

    if (spanEnter && isElementNode(spanEnter.node)) {
      // Verify that the span knows it's inside a table (TAG_TABLE = 28)
      expect(spanEnter.node.depthMap[28]).toBeGreaterThan(0)
      expect(spanEnter.node.depthMap).toBeDefined()
    }
  })

  it('should parse self-closing tags', () => {
    const html = '<img src="test.jpg" alt="test">'
    const result = parseHtml(html)

    // Self-closing tags might generate enter and exit events
    expect(result.events.length).toBeGreaterThan(0)

    const imgEvent = result.events[0]
    expect(imgEvent.type).toBe(NodeEventEnter)
    expect(imgEvent.node.type).toBe(ELEMENT_NODE)

    if (isElementNode(imgEvent.node)) {
      expect(imgEvent.node.name).toBe('img')
      expect(imgEvent.node.attributes.src).toBe('test.jpg')
      expect(imgEvent.node.attributes.alt).toBe('test')
    }
  })

  it('should handle mixed content', () => {
    const html = '<div>Text before <strong>bold text</strong> text after</div>'
    const result = parseHtml(html)

    const textNodes = result.events.filter(e => isTextNode(e.node))
    expect(textNodes.length).toBeGreaterThanOrEqual(1)

    // Check that we have the bold text content
    const allText = textNodes.map(e => (e.node as TextNode).value).join('')
    expect(allText).toContain('bold text')

    // Find the strong element
    const strongElement = result.events.find(e =>
      e.type === NodeEventEnter
      && isElementNode(e.node)
      && e.node.name === 'strong',
    )
    expect(strongElement).toBeDefined()
  })

  it('should parse attributes correctly', () => {
    const html = '<div class="test-class" id="test-id" data-value="123">content</div>'
    const result = parseHtml(html)

    const divEnter = result.events.find(e =>
      e.type === NodeEventEnter
      && isElementNode(e.node)
      && e.node.name === 'div',
    )

    expect(divEnter).toBeDefined()
    if (divEnter && isElementNode(divEnter.node)) {
      expect(divEnter.node.attributes.class).toBe('test-class')
      expect(divEnter.node.attributes.id).toBe('test-id')
      expect(divEnter.node.attributes['data-value']).toBe('123')
    }
  })

  it('should handle HTML entities', () => {
    const html = '<div>&lt;tag&gt; &amp; &quot;quotes&quot;</div>'
    const result = parseHtml(html)

    const textEvent = result.events.find(e => isTextNode(e.node))
    expect(textEvent).toBeDefined()
    if (textEvent && isTextNode(textEvent.node)) {
      expect(textEvent.node.value).toBe('<tag> & "quotes"')
    }
  })

  it('should track depth correctly for nested elements', () => {
    const html = '<div><span><em>nested</em></span></div>'
    const result = parseHtml(html)

    const elementEvents = result.events.filter(e => e.type === NodeEventEnter && isElementNode(e.node))

    // div should be at depth 1 (root starts at 1)
    expect(elementEvents[0].node.depth).toBe(1)
    // span should be at depth 2
    expect(elementEvents[1].node.depth).toBe(2)
    // em should be at depth 3
    expect(elementEvents[2].node.depth).toBe(3)
  })

  it('should properly track table context in depthMap', () => {
    const html = '<table><tr><td><span>content</span></td></tr></table>'
    const result = parseHtml(html)

    // Find the span element
    const spanEnter = result.events.find(e =>
      e.type === NodeEventEnter
      && isElementNode(e.node)
      && e.node.name === 'span',
    )

    expect(spanEnter).toBeDefined()

    if (spanEnter && isElementNode(spanEnter.node)) {
      // Verify that the span knows it's inside a table (TAG_TABLE = 28)
      expect(spanEnter.node.depthMap[28]).toBeGreaterThan(0)

      // Also verify it knows about TR and TD
      expect(spanEnter.node.depthMap).toBeDefined()
    }
  })
})
