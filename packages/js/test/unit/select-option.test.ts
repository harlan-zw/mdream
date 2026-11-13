import type { ElementNode } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, TAG_OPTGROUP, TAG_OPTION, TAG_P, TAG_SELECT, TAG_TEMPLATE } from '../../src/const'
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
  let out = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    out += chunk
  return out
}

function enteredElements(html: string): ElementNode[] {
  return parseHtml(html).events.filter(event => event.type === NodeEventEnter && event.node.type === ELEMENT_NODE).map(event => event.node as ElementNode)
}

describe('select option tree construction', () => {
  it('closes an option when the next option start tag omits its end tag', () => {
    const html = '<select><option>one<option>two</select><p>after</p>'
    expect(htmlToMarkdown(html)).toBe('one two\n\nafter')

    const elements = enteredElements(html)
    const options = elements.filter(node => node.tagId === TAG_OPTION)
    expect(options).toHaveLength(2)
    expect(options.map(node => node.parent?.tagId)).toEqual([TAG_SELECT, TAG_SELECT])
    expect(elements.find(node => node.tagId === TAG_P)?.parent).toBeUndefined()
  })

  it('supports explicit option end tags without changing output', () => {
    const malformed = '<select><option>one<option>two</select><p>after</p>'
    const wellFormed = '<select><option>one</option><option>two</option></select><p>after</p>'
    expect(htmlToMarkdown(malformed)).toBe(htmlToMarkdown(wellFormed))
  })

  it('closes the current option and optgroup when their end tags are omitted', () => {
    const html = '<select><optgroup label=a><option>one<option>two<optgroup label=b><option>three</select><p>after</p>'
    expect(htmlToMarkdown(html)).toBe('one two three\n\nafter')

    const elements = enteredElements(html)
    const groups = elements.filter(node => node.tagId === TAG_OPTGROUP)
    const options = elements.filter(node => node.tagId === TAG_OPTION)
    expect(groups.map(node => node.parent?.tagId)).toEqual([TAG_SELECT, TAG_SELECT])
    expect(options.map(node => node.parent?.attributes.label)).toEqual(['a', 'a', 'b'])
  })

  it('leaves a well-formed optgroup/select tree unchanged', () => {
    const html = '<select><optgroup label=a><option>one</option><option>two</option></optgroup><option>three</option></select><p>after</p>'
    expect(htmlToMarkdown(html)).toBe('one two three\n\nafter')
  })

  it('treats a nested select start tag as the end of the open select', () => {
    expect(htmlToMarkdown('<select><option>one<select><option>two</select><p>after</p>'))
      .toBe('one two\n\nafter')
  })

  it.each([
    ['<p>h<select></select>B</p>', 'h B'],
    ['<p>h <select><option>o</option></select> B</p>', 'h o B'],
    ['<p>h<select><option>o<option>p</select>B</p>', 'h o p B'],
    ['<p>h<em>x<select></select>y</em>B</p>', 'h*x y*B'],
    ['<p>h<a href="/u"><select><option>o</option></select></a>B</p>', 'h [o](/u)B'],
    ['<p>h<optgroup><option>o</option></optgroup>B</p>', 'h o B'],
    ['<blockquote><p>h<select></select>B</p></blockquote>', '> h B'],
    ['<p>h<select><option>o</p>B', 'h o\n\nB'],
    ['<p>h<select><div>d</div></select>B</p>', 'h\n\nd\n\nB'],
  ])('keeps an open paragraph across a select or a stray optgroup: %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it('parents a select and a stray optgroup to the open paragraph', () => {
    for (const [html, tagId] of [['<p>h<select></select>B</p>', TAG_SELECT], ['<p>h<optgroup></optgroup>B</p>', TAG_OPTGROUP]] as [string, number][])
      expect(enteredElements(html).find(node => node.tagId === tagId)?.parent?.tagId).toBe(TAG_P)
  })

  it('does not recover through a template boundary', () => {
    const html = '<select><option>outer<template><option>hidden</template><option>after</select>'
    expect(htmlToMarkdown(html)).toBe('outer after')

    const nestedSelect = enteredElements('<select><option>outer<template><select><option>hidden</select></template><option>after</select>')
      .filter(node => node.tagId === TAG_SELECT)
    expect(nestedSelect).toHaveLength(2)
    expect(nestedSelect[1]?.parent?.tagId).toBe(TAG_TEMPLATE)
  })
})

describe('streaming select recovery', () => {
  it('matches batch parsing when recovery tags are split across chunks', async () => {
    for (const [chunks, whole] of [
      [
        ['<select><option>one<op', 'tion>two</select><p>after</p>'],
        '<select><option>one<option>two</select><p>after</p>',
      ],
      [
        ['<select><optgroup label=a><option>one<option>two<opt', 'group label=b><option>three</sel', 'ect><p>after</p>'],
        '<select><optgroup label=a><option>one<option>two<optgroup label=b><option>three</select><p>after</p>',
      ],
      [
        ['<p>h <sel', 'ect><option>o</opt', 'ion></select> B</p><p>after</p>'],
        '<p>h <select><option>o</option></select> B</p><p>after</p>',
      ],
    ] as [string[], string][]) {
      const split = await streamConvert(chunks)
      expect(split).toBe(await streamConvert([whole]))
      expect(split.trim()).toBe(htmlToMarkdown(whole))
    }
  })
})
