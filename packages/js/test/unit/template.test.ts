import type { ElementNode, ExtractedElement } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, TAG_TEMPLATE } from '../../src/const'
import { htmlToMarkdown, NodeEventEnter, streamHtmlToMarkdown } from '../../src/index'
import { parseHtml } from '../../src/parse'

async function streamConvert(chunks: string[]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    output += chunk
  return output
}

describe('template parsing', () => {
  it('keeps a well-formed template subtree out of Markdown', () => {
    expect(htmlToMarkdown('<p>Before</p><template><h1>Hidden</h1><p>Also hidden</p></template><p>After</p>'))
      .toBe('Before\n\nAfter')
  })

  it('contains content after a nested template close', () => {
    const html = '<template><template>x</template><p>leak</p></template><p>after</p>'
    expect(htmlToMarkdown(html)).toBe('after')
  })

  it('does not let template contents close outer document nodes', () => {
    expect(htmlToMarkdown('<p>before<template></p><strong>hidden</strong></template>after</p>'))
      .toBe('before after')
  })

  it('does not auto-close an outer head for flow content inside a template', () => {
    expect(htmlToMarkdown('<head><template><p>hidden</p></template></head><p>after</p>'))
      .toBe('after')
  })

  it('emits a coherent nested event tree while marking template text inert', () => {
    const { events, remainingHtml } = parseHtml('<template><template>x</template><p>hidden</p></template><p>after</p>')
    expect(remainingHtml).toBe('')

    const elementEvents = events
      .filter(event => event.node.type === ELEMENT_NODE)
      .map(event => `${event.type === NodeEventEnter ? 'enter' : 'exit'}:${(event.node as ElementNode).name}`)
    expect(elementEvents).toEqual([
      'enter:template',
      'enter:template',
      'exit:template',
      'enter:p',
      'exit:p',
      'exit:template',
      'enter:p',
      'exit:p',
    ])

    const hiddenParagraph = events.find(event =>
      event.type === NodeEventEnter
      && event.node.type === ELEMENT_NODE
      && (event.node as ElementNode).name === 'p'
      && (event.node as ElementNode).depthMap[TAG_TEMPLATE] === 1,
    )!.node as ElementNode
    expect(hiddenParagraph.parent?.name).toBe('template')
    expect(hiddenParagraph.parent?.parent).toBeUndefined()

    const hiddenText = events.find(event => event.type === NodeEventEnter && event.node.type !== ELEMENT_NODE && 'value' in event.node && event.node.value === 'hidden')!.node
    expect('excludedFromMarkdown' in hiddenText && hiddenText.excludedFromMarkdown).toBe(true)
  })

  it('exposes parsed template nodes to hooks and extraction without rendering hook output', () => {
    const seen: string[] = []
    const extracted: ExtractedElement[] = []
    const markdown = htmlToMarkdown('<template><strong class="target">hidden</strong></template><p>after</p>', {
      hooks: [{
        onNodeEnter(node) {
          seen.push(node.name)
          return node.name === 'strong' ? 'HOOK-LEAK' : undefined
        },
      }],
      plugins: {
        extraction: {
          '.target': element => extracted.push(element),
        },
      },
    })

    expect(markdown).toBe('after')
    expect(seen).toContain('strong')
    expect(extracted).toHaveLength(1)
    expect(extracted[0]?.textContent).toBe('hidden')
  })

  it('does not let inert content affect isolate-main or frontmatter state', () => {
    const html = '<head><template><title>Hidden</title><meta name="description" content="Hidden description"></template><title>Visible</title></head><template><main>Hidden main</main></template><main><p>Visible body</p></main>'
    expect(htmlToMarkdown(html, {
      plugins: {
        frontmatter: true,
        isolateMain: true,
      },
    })).toBe('---\ntitle: Visible\n---\n\nVisible body')
  })

  it('matches whole-stream output at every chunk boundary', async () => {
    const html = '<p>before</p><template><template><strong>hidden</strong></template><p>still hidden</p></template><p>after</p>'
    const expected = await streamConvert([html])
    expect(expected.trim()).toBe('before\n\nafter')

    for (let split = 0; split <= html.length; split++) {
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split at ${split}`)
        .toBe(expected)
    }
  })
})
