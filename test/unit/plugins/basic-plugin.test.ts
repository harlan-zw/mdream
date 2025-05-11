import type { ElementNode, TextNode } from '../../../src/types.ts'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE } from '../../../src/const.ts'
import { syncHtmlToMarkdown } from '../../../src/index.ts'
import { createPlugin } from '../../../src/plugins.ts'

describe('plugin System', () => {
  it('basic plugin works and processes attributes', () => {
    // Create a plugin that adds custom attributes processing
    const testPlugin = createPlugin({
      name: 'test-plugin',
      processTextNode: (node: TextNode) => {
        if (node.parent?.attributes?.id === 'test') {
          return {
            content: `[PROCESSED] ${node.value} [/PROCESSED]`,
            skip: false,
          }
        }
      },
    })

    const input = '<div id="test">Test content</div>'
    const output = syncHtmlToMarkdown(input, {
      plugins: [testPlugin],
    })

    expect(output).toContain('[PROCESSED]')
    expect(output).toContain('Test content')
    expect(output).toContain('[/PROCESSED]')
  })

  it('filters out content using plugin filters', () => {
    // Create a plugin that filters out div elements with specific class
    const filterPlugin = createPlugin({
      name: 'filter-plugin',
      beforeNodeProcess(node: ElementNode): boolean {
        if (node.type === ELEMENT_NODE && node.name === 'div' && node.attributes?.class === 'filtered') {
          return false
        }
        return true
      },
    })

    const input = `
    <div>Normal content</div>
    <div class="filtered" id="remove-me">This should be filtered out</div>
    <p>Regular paragraph</p>
    `
    const output = syncHtmlToMarkdown(input, { plugins: [filterPlugin] })

    expect(output).toContain('Normal content')
    expect(output).not.toContain('remove-me')
    expect(output).toContain('Regular paragraph')
  })

  it('runs node enter/exit hooks properly', () => {
    // Create a plugin that adds text at node enter/exit
    const hooksPlugin = createPlugin({
      name: 'hooks-plugin',
      onNodeEnter: (event) => {
        if (event.node.type === ELEMENT_NODE && event.node.name === 'h1') {
          return '🔥 '
        }
        return undefined
      },
      onNodeExit: (event) => {
        if (event.node.type === ELEMENT_NODE && event.node.name === 'h1') {
          return ' 🔥'
        }
        return undefined
      },
    })

    const input = '<h1>Hook test</h1>'
    const output = syncHtmlToMarkdown(input, { plugins: [hooksPlugin] })

    expect(output).toBe('🔥 # Hook test 🔥')
  })

  it('handles multiple plugins in sequence', () => {
    const firstPlugin = createPlugin({
      name: 'first-plugin',
      onNodeEnter: (event) => {
        if (event.node.type === ELEMENT_NODE && event.node.name === 'p') {
          return 'FIRST: '
        }
        return undefined
      },
    })

    const secondPlugin = createPlugin({
      name: 'second-plugin',
      onNodeExit: (event) => {
        if (event.node.type === ELEMENT_NODE && event.node.name === 'p') {
          return ' :SECOND'
        }
        return undefined
      },
    })

    const input = '<p>This is a test</p>'
    const output = syncHtmlToMarkdown(input, { plugins: [firstPlugin, secondPlugin] })

    expect(output).toContain('FIRST: ')
    expect(output).toContain('This is a test')
    expect(output).toContain(' :SECOND')
  })
})
