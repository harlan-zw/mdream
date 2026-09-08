import type { ElementNode } from '../../src/types'
import { htmlToMarkdown, streamHtmlToMarkdown } from '@mdream/js'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '@mdream/js/html'
import { filterPlugin, frontmatterPlugin } from '@mdream/js/plugins'
import { htmlToText, streamHtmlToText } from '@mdream/js/text'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, NodeEventEnter } from '../../src/const'
import { parseHtml } from '../../src/parse'

describe('package entry points', () => {
  it('keeps the full conversion names at the package root', () => {
    expect(htmlToMarkdown).toBeTypeOf('function')
    expect(streamHtmlToMarkdown).toBeTypeOf('function')
  })

  it('exposes each output format from its own entry point', () => {
    expect(htmlToText('<strong>plain</strong>')).toBe('plain')
    expect(htmlToSafeHtml('<strong>safe</strong>')).toBe('<strong>safe</strong>')
    expect(streamHtmlToText).toBeTypeOf('function')
    expect(streamHtmlToSafeHtml).toBeTypeOf('function')
  })

  it('keeps Markdown-producing plugins out of safe HTML', () => {
    expect(htmlToSafeHtml('<head><title>Title</title></head><p>Body</p>', {
      plugins: [frontmatterPlugin()],
    })).toBe('<p>Body</p>')
  })

  it('composes explicitly imported plugins at the package root', () => {
    expect(htmlToMarkdown('<nav>hidden</nav><p>shown</p>', {
      plugins: [filterPlugin({ exclude: ['nav'] })],
    })).toBe('shown')
  })

  it('treats prototype-named elements as unknown tags', () => {
    const html = '<toString>one</toString><constructor>two</constructor>'
    const tagIds = parseHtml(html).events.flatMap((event) => {
      if (event.type !== NodeEventEnter || event.node.type !== ELEMENT_NODE)
        return []
      return [(event.node as ElementNode).tagId]
    })

    expect(tagIds).toEqual([-1, -1])
    expect(htmlToMarkdown(html)).toBe('one two')
  })
})
