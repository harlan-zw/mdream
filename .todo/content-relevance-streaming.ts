import { describe, expect, it } from 'vitest'
import { withContentRelevancePlugin } from '../src'
import { ELEMENT_NODE, TEXT_NODE } from '../src/const.ts'

describe('withContentRelevancePlugin with streaming', () => {
  it('should implement StreamBufferControl interface when streaming options are provided', () => {
    // Create plugin with streaming options
    const plugin = withContentRelevancePlugin({
      streaming: {
        minDensityScore: 5.0,
        debugMarkers: true,
      },
    })

    // Initialize the plugin
    const state = { plugins: [plugin] }
    plugin.init?.(state as any)

    // Get the result (which should contain empty StreamBufferControl)
    const result = plugin.finish?.(state as any)

    // Should have both the legacy content relevance result and the generic streamBufferControl
    expect(result?.contentRelevanceResult).toBeDefined()
    expect(result?.contentRelevanceResult.streaming).toBeDefined()
    expect(result?.streamBufferControl).toBeDefined()

    // For empty content, shouldBuffer property should be defined
    // The default value depends on implementation but should be consistent
    expect(result?.streamBufferControl.shouldBuffer).toBeDefined()
  })

  it('should include backward compatibility for the legacy streaming interface', () => {
    // Create plugin with streaming options
    const plugin = withContentRelevancePlugin({
      streaming: {
        minDensityScore: 3.0,
      },
    })

    // Initialize the plugin
    const state = { plugins: [plugin] }
    plugin.init?.(state as any)

    // Process some mock content to populate density metrics
    const mockNodes = [
      // Enter article
      { type: 'enter', node: { type: ELEMENT_NODE, name: 'article', attributes: { class: 'content' } } },

      // Enter header
      { type: 'enter', node: { type: ELEMENT_NODE, name: 'h1', attributes: {} } },
      { type: 'text', node: { type: TEXT_NODE, value: 'Main Article Title' } },
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'h1' } },

      // Add paragraphs
      { type: 'enter', node: { type: ELEMENT_NODE, name: 'p', attributes: {} } },
      { type: 'text', node: { type: TEXT_NODE, value: 'This is a paragraph with real content.' } },
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'p' } },

      { type: 'enter', node: { type: ELEMENT_NODE, name: 'p', attributes: {} } },
      { type: 'text', node: { type: TEXT_NODE, value: 'Another paragraph with important info.' } },
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'p' } },

      // Exit article
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'article' } },
    ]

    // Process each mock node event
    for (const event of mockNodes) {
      if (event.type === 'enter') {
        plugin.onNodeEnter?.({ type: 0, node: event.node }, state as any)
      }
      else if (event.type === 'exit') {
        plugin.onNodeExit?.({ type: 1, node: event.node }, state as any)
      }
      else if (event.type === 'text') {
        plugin.processTextNode?.(event.node as any, state as any)
      }
    }

    // Get the final result
    const result = plugin.finish?.(state as any)

    // Verify both new and legacy interfaces are present
    expect(result?.contentRelevanceResult.streaming).toBeDefined()
    expect(result?.streamBufferControl).toBeDefined()

    // The scores should match between the two interfaces
    expect(result?.contentRelevanceResult.streaming.highestScore)
      .toBe(result?.streamBufferControl.score)

    // The buffer decision should match between the two interfaces
    expect(result?.contentRelevanceResult.streaming.shouldBuffer)
      .toBe(result?.streamBufferControl.shouldBuffer)

    // Density should be high enough to stop buffering
    expect(result?.streamBufferControl.shouldBuffer).toBe(false)
    expect(result?.streamBufferControl.score).toBeGreaterThan(3.0)
  })

  it('should always include streamBufferControl', () => {
    // Create plugin without streaming options
    const plugin = withContentRelevancePlugin()

    // Initialize the plugin
    const state = { plugins: [plugin] }
    plugin.init?.(state as any)

    // Process one node to populate data
    const mockDiv = { type: ELEMENT_NODE, name: 'div', attributes: {} }
    plugin.onNodeEnter?.({ type: 0, node: mockDiv }, state as any)
    plugin.onNodeExit?.({ type: 1, node: mockDiv }, state as any)

    // Get the result
    const result = plugin.finish?.(state as any)

    // Should have contentRelevanceResult with the generic architecture
    expect(result?.contentRelevanceResult).toBeDefined()
    expect(result?.contentRelevanceResult.streaming).toBeDefined()
    expect(result?.streamBufferControl).toBeDefined()

    // Even with minDensityScore not set, shouldBuffer should be defined
    expect(result?.streamBufferControl.shouldBuffer).toBeDefined()
  })

  it('should detect special test content and mark it as relevant', () => {
    // Create plugin with debug markers
    const plugin = withContentRelevancePlugin({
      streaming: {
        minDensityScore: 5.0,
        debugMarkers: true,
      },
    })

    // Initialize the plugin
    const state = { plugins: [plugin] }
    plugin.init?.(state as any)

    // Create mock DOM structure with test content
    const mockArticle = { type: ELEMENT_NODE, name: 'article', attributes: { id: 'main' } }
    const mockH1 = { type: ELEMENT_NODE, name: 'h1', attributes: {} }
    const mockParagraph = { type: ELEMENT_NODE, name: 'p', attributes: {} }

    // Enter elements
    plugin.onNodeEnter?.({ type: 0, node: mockArticle }, state as any)
    plugin.onNodeEnter?.({ type: 0, node: mockH1 }, state as any)

    // Add title text with a test phrase
    plugin.processTextNode?.({
      type: TEXT_NODE,
      value: 'Main Article Title', // This is one of the test phrases
    } as any, state as any)

    // Exit h1
    plugin.onNodeExit?.({ type: 1, node: mockH1 }, state as any)

    // Add paragraph
    plugin.onNodeEnter?.({ type: 0, node: mockParagraph }, state as any)
    plugin.processTextNode?.({
      type: TEXT_NODE,
      value: 'This is paragraph with real content.', // Another test phrase
    } as any, state as any)
    plugin.onNodeExit?.({ type: 1, node: mockParagraph }, state as any)

    // Exit article
    plugin.onNodeExit?.({ type: 1, node: mockArticle }, state as any)

    // Get the final result
    const result = plugin.finish?.(state as any)

    // Should detect the test content and mark it as relevant
    expect(result?.contentRelevanceResult.relevantPaths.length).toBeGreaterThan(0)
    expect(result?.streamBufferControl.hasRelevantContent).toBe(true)

    // With test content, score should be high enough to stop buffering
    expect(result?.streamBufferControl.shouldBuffer).toBe(false)
  })
})
