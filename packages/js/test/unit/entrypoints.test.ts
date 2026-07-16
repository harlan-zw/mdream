import type { ElementNode } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, NodeEventEnter } from '../../src/const'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { parseHtml } from '../../src/parse'

describe('package entry points', () => {
  it('keeps the full conversion names at the package root', () => {
    expect(htmlToMarkdown).toBeTypeOf('function')
    expect(streamHtmlToMarkdown).toBeTypeOf('function')
  })

  it('retains declarative plugin behavior at the package root', () => {
    expect(htmlToMarkdown('<nav>hidden</nav><p>shown</p>', {
      plugins: { filter: { exclude: ['nav'] } },
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
