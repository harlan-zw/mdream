import { describe, expect, it } from 'vitest'
import { createDensityTrackingPlugin } from '../src'
import { ELEMENT_NODE, TEXT_NODE } from '../src/const.ts'

describe('createDensityTrackingPlugin', () => {
  it('should export a function that returns a plugin', () => {
    const plugin = createDensityTrackingPlugin()
    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('density-tracking')
  })

  it('should track text density and provide streaming buffer control', () => {
    const plugin = createDensityTrackingPlugin({
      minDensityScore: 3.0,
    })

    // Initialize the plugin
    const state = {
      plugins: [plugin],
    }
    plugin.init?.(state as any)

    // Create a mock node structure to represent a document
    const mockNodes = [
      // Simulate entering a div
      { type: 'enter', node: { type: ELEMENT_NODE, name: 'div', attributes: {} } },

      // Simulate entering a nav
      { type: 'enter', node: { type: ELEMENT_NODE, name: 'nav', attributes: {} } },

      // Add some nav text nodes (low density)
      { type: 'text', node: { type: TEXT_NODE, value: 'Navigation item 1' } },
      { type: 'text', node: { type: TEXT_NODE, value: 'Navigation item 2' } },

      // Exit nav
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'nav' } },

      // Simulate entering a main content section
      { type: 'enter', node: { type: ELEMENT_NODE, name: 'main', attributes: {} } },

      // Enter a header
      { type: 'enter', node: { type: ELEMENT_NODE, name: 'h1', attributes: {} } },

      // Add title text
      { type: 'text', node: { type: TEXT_NODE, value: 'Main Article Title' } },

      // Exit header
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'h1' } },

      // Add several paragraphs (higher density)
      { type: 'enter', node: { type: ELEMENT_NODE, name: 'p', attributes: {} } },
      { type: 'text', node: { type: TEXT_NODE, value: 'This is paragraph 1 with real content.' } },
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'p' } },

      { type: 'enter', node: { type: ELEMENT_NODE, name: 'p', attributes: {} } },
      { type: 'text', node: { type: TEXT_NODE, value: 'This is paragraph 2 with more real content.' } },
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'p' } },

      { type: 'enter', node: { type: ELEMENT_NODE, name: 'p', attributes: {} } },
      { type: 'text', node: { type: TEXT_NODE, value: 'This is paragraph 3 with even more real content.' } },
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'p' } },

      // Exit main
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'main' } },

      // Exit div
      { type: 'exit', node: { type: ELEMENT_NODE, name: 'div' } },
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

    // Call finish to get the StreamBufferControl result
    const result = plugin.finish?.(state as any)

    // Validate the StreamBufferControl interface implementation
    expect(result).toBeDefined()
    expect(result?.streamBufferControl).toBeDefined()
    expect(result?.streamBufferControl.shouldBuffer).toBeDefined()
    expect(result?.streamBufferControl.score).toBeDefined()
    expect(result?.streamBufferControl.hasRelevantContent).toBeDefined()

    // With multiple text nodes in main section, density should be high
    expect(result?.streamBufferControl.score).toBeGreaterThan(2)

    // Since we have a high score, we should not buffer anymore
    expect(result?.streamBufferControl.shouldBuffer).toBe(false)

    // Since we have "content" and "article" keywords, should have relevant content
    expect(result?.streamBufferControl.hasRelevantContent).toBe(true)
  })

  it('should track content indicators like "article" and "content"', () => {
    const plugin = createDensityTrackingPlugin()

    // Initialize the plugin
    const state = { plugins: [plugin] }
    plugin.init?.(state as any)

    // Set up a mock node structure
    const mockMainElement = { type: ELEMENT_NODE, name: 'main', attributes: {} }
    const mockParagraph = { type: ELEMENT_NODE, name: 'p', attributes: {} }

    // Simulate entering elements
    plugin.onNodeEnter?.({ type: 0, node: mockMainElement }, state as any)
    plugin.onNodeEnter?.({ type: 0, node: mockParagraph }, state as any)

    // Process a text node with content indicators
    plugin.processTextNode?.({
      type: TEXT_NODE,
      value: 'This article contains important content.',
    } as any, state as any)

    // Simulate exiting elements
    plugin.onNodeExit?.({ type: 1, node: mockParagraph }, state as any)
    plugin.onNodeExit?.({ type: 1, node: mockMainElement }, state as any)

    // Get the final result
    const result = plugin.finish?.(state as any)

    // Should have detected relevant content based on keywords
    expect(result?.streamBufferControl.hasRelevantContent).toBe(true)
  })

  it('should respect minDensityScore option', () => {
    // Create plugin with a very high minimum density
    const plugin = createDensityTrackingPlugin({
      minDensityScore: 10.0, // Very high
    })

    // Initialize the plugin
    const state = { plugins: [plugin] }
    plugin.init?.(state as any)

    // Process a simple structure with moderate density
    const mockDiv = { type: ELEMENT_NODE, name: 'div', attributes: {} }
    plugin.onNodeEnter?.({ type: 0, node: mockDiv }, state as any)

    // Add a few text nodes
    plugin.processTextNode?.({ type: TEXT_NODE, value: 'Text 1' } as any, state as any)
    plugin.processTextNode?.({ type: TEXT_NODE, value: 'Text 2' } as any, state as any)
    plugin.processTextNode?.({ type: TEXT_NODE, value: 'Text 3' } as any, state as any)

    plugin.onNodeExit?.({ type: 1, node: mockDiv }, state as any)

    // Get the final result
    const result = plugin.finish?.(state as any)

    // The actual density is moderate (3 nodes at depth 1 -> density of 3)
    // But our minimum is 10, so should buffer
    expect(result?.streamBufferControl.score).toBeLessThan(10)
    expect(result?.streamBufferControl.shouldBuffer).toBe(true)
    expect(result?.streamBufferControl.minRequiredScore).toBe(10.0)
  })

  it('should reset state properly on init', () => {
    const plugin = createDensityTrackingPlugin()

    // Initialize the plugin with some state
    let state = { plugins: [plugin] }
    plugin.init?.(state as any)

    // Process some nodes to create density data
    const mockDiv = { type: ELEMENT_NODE, name: 'div', attributes: {} }
    plugin.onNodeEnter?.({ type: 0, node: mockDiv }, state as any)
    plugin.processTextNode?.({ type: TEXT_NODE, value: 'Some content' } as any, state as any)
    plugin.onNodeExit?.({ type: 1, node: mockDiv }, state as any)

    // Get first result
    const result1 = plugin.finish?.(state as any)
    expect(result1?.streamBufferControl.score).toBeDefined()

    // Reinitialize and check that state is reset
    state = { plugins: [plugin] }
    plugin.init?.(state as any)

    // Without processing any nodes, score should be reset to 0
    const result2 = plugin.finish?.(state as any)
    expect(result2?.streamBufferControl.score).toBe(0)
    expect(result2?.streamBufferControl.hasRelevantContent).toBe(false)
  })
})
