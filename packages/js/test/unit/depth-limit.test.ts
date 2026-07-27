import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, htmlToMarkdown, NodeEventEnter, streamHtmlToMarkdown } from '../../src/index'
import { parseHtml } from '../../src/parse'

const LIMIT = 512
const LOGICAL_LIMIT = 4096
const NAME_MEMORY_LIMIT = 64 * 1024
const NAME_COUNT_LIMIT = LOGICAL_LIMIT - LIMIT

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

describe('element depth limit', () => {
  it('leaves content at the limit unchanged', () => {
    const html = `${'<div>'.repeat(LIMIT)}deep${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toBe('deep')
  })

  it('retains the full public parent chain through the materialized limit', () => {
    const deepest = parseHtml('<div>'.repeat(LIMIT)).events.at(-1)
    expect(deepest?.type).toBe(NodeEventEnter)
    expect(deepest?.node.type).toBe(ELEMENT_NODE)
    let parentCount = 0
    let node = deepest?.node
    while (node?.parent) {
      parentCount++
      node = node.parent
    }
    expect(parentCount).toBe(LIMIT - 1)
  })

  it('preserves content within and after a subtree at the materialized limit', () => {
    const html = `<p>before</p>${'<div>'.repeat(LIMIT)}<p>inside</p>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('before\n\ninside\n\nafter')
  })

  it('throws a tagged error when logical nesting exceeds the hard limit', () => {
    const html = `<p>before</p>${'<div>'.repeat(100_000)}discarded`
    expect(() => htmlToMarkdown(html)).toThrowError(expect.objectContaining({
      _tag: 'ElementDepthLimitExceeded',
      code: 'ELEMENT_DEPTH_LIMIT',
      maxDepth: 4096,
    }))
  })

  it('uses the final compact stack and name index slots safely', () => {
    const customDepth = LOGICAL_LIMIT - LIMIT
    const names = Array.from({ length: customDepth }, (_, index) => `z-${index.toString(36)}`)
    const html = `${'<div>'.repeat(LIMIT)}${names.map(name => `<${name}>`).join('')}inside${names.toReversed().map(name => `</${name}>`).join('')}${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('inside\n\nafter')
  })

  it('rejects the first element beyond the logical limit', () => {
    const html = `${'<div>'.repeat(LOGICAL_LIMIT)}<span>too deep`
    expect(() => htmlToMarkdown(html)).toThrowError(expect.objectContaining({
      _tag: 'ElementDepthLimitExceeded',
      code: 'ELEMENT_DEPTH_LIMIT',
      maxDepth: LOGICAL_LIMIT,
    }))
  })

  it('rejects a self-closing element beyond the logical limit', () => {
    const html = `${'<div>'.repeat(LOGICAL_LIMIT)}<br>`
    expect(() => htmlToMarkdown(html)).toThrowError(expect.objectContaining({
      _tag: 'ElementDepthLimitExceeded',
      code: 'ELEMENT_DEPTH_LIMIT',
      maxDepth: LOGICAL_LIMIT,
      attemptedDepth: LOGICAL_LIMIT + 1,
    }))
  })

  it('does not count self-closing elements at the limit', () => {
    const html = `${'<div>'.repeat(LIMIT)}<br>kept${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toContain('kept')
  })

  it('applies implied-end recovery before checking the limit', () => {
    const output = htmlToMarkdown('<p>item'.repeat(1_000))
    expect(output.match(/item/g)).toHaveLength(1_000)
  })

  it('throws a tagged error after streamed input exceeds the hard limit', async () => {
    const chunks = ['<p>before</p>']
    for (let i = 0; i < 10_000; i++)
      chunks.push('<div>')
    chunks.push('discarded')
    await expect(streamConvert(chunks)).rejects.toMatchObject({
      _tag: 'ElementDepthLimitExceeded',
      code: 'ELEMENT_DEPTH_LIMIT',
      maxDepth: 4096,
    })
  })

  it('does not leak content hidden at the limit', () => {
    const html = `${'<div>'.repeat(LIMIT)}<template><strong>hidden</strong></template><p>visible</p>${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toBe('visible')
  })

  it('does not emit or pop a parent for a suppressed CDATA override', () => {
    const html = `${'<div>'.repeat(LIMIT)}<![CDATA[hidden]]><p>visible</p>${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html, {
      plugins: {
        tagOverrides: {
          '#cdata-section': { enter: '[', exit: ']', isInline: true, spacing: [0, 0] },
        },
      },
    })).toBe('visible')
  })

  it('does not consume the hard depth budget for a suppressed CDATA override', () => {
    const html = `${'<div>'.repeat(LIMIT)}<![CDATA[hidden]]>${'<div>'.repeat(LOGICAL_LIMIT - LIMIT)}kept${'</div>'.repeat(LOGICAL_LIMIT)}`
    expect(htmlToMarkdown(html, {
      plugins: {
        tagOverrides: {
          '#cdata-section': { enter: '[', exit: ']', isInline: true, spacing: [0, 0] },
        },
      },
    })).toBe('kept')
  })

  it('matches custom and mismatched closing tags in the compact stack', () => {
    const html = `${'<div>'.repeat(LIMIT)}<x-one><x-two>inside</x-one><p>after</p>${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toBe('inside after')
  })

  it('matches aliased compact tags by their original name', () => {
    const html = `${'<div>'.repeat(LIMIT)}<x-template><strong>hidden</strong></template><p>also hidden</p></x-template><p>visible</p>${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html, {
      plugins: {
        tagOverrides: {
          'x-template': 'template',
        },
      },
    })).toBe('visible')
  })

  it('applies implied-end recovery within the compact stack', () => {
    const html = `${'<div>'.repeat(LIMIT)}<p>one<p>two</p>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('one two\n\nafter')
  })

  it('applies implied-end recovery from the compact stack into the rich stack', () => {
    const html = `<p>A${'<span>'.repeat(LIMIT - 1)}<em>B<div>C`
    expect(htmlToMarkdown(html)).toBe('AB\n\nC')
  })

  it('keeps rich ancestors when recovering a compact head', () => {
    const html = `<blockquote><blockquote>ALPHA${'<div>'.repeat(LIMIT)}<head><p>X</p>${'</div>'.repeat(LIMIT)}OMEGA</blockquote></blockquote>ZED`
    expect(htmlToMarkdown(html)).toBe('> > ALPHA\n> >\n> > X\n> >\n> > OMEGA\n\nZED')
  })

  it.each(['script', 'style'])('keeps suppressed <%s> content inert without closing outer nodes', (tag) => {
    const html = `${'<div>'.repeat(LIMIT)}<${tag}></div><p>hidden</p></${tag}><p>visible</p>${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toBe('visible')
  })

  it.each([255, 256, 511, 512])('retains contextual escaping across the %i-depth counter boundary', (depth) => {
    const html = `${'<blockquote>'.repeat(depth)}${'</blockquote>'.repeat(depth - 1)}x > y</blockquote>`
    expect(htmlToMarkdown(html)).toContain('x \\> y')
  })

  it.each(['script', 'style'])('recovers a streamed suppressed <%s> closing tag split across chunks', async (tag) => {
    const open = '<div>'.repeat(LIMIT)
    const close = '</div>'.repeat(LIMIT)
    expect(await streamConvert([
      `${open}<${tag}>hidden</`,
      `${tag}><p>visible</p>${close}<p>tail</p>`,
    ])).toBe('visible\n\ntail')
  })

  it('bounds retained custom tag identities', () => {
    const acceptedTag = `x-${'a'.repeat(NAME_MEMORY_LIMIT - 2)}`
    expect(() => htmlToMarkdown(`${'<div>'.repeat(LIMIT)}<${acceptedTag}>`)).not.toThrow()

    const rejectedTag = `x-${'a'.repeat(NAME_MEMORY_LIMIT - 1)}`
    expect(() => htmlToMarkdown(`${'<div>'.repeat(LIMIT)}<${rejectedTag}>`)).toThrowError(expect.objectContaining({
      _tag: 'ElementNameMemoryLimitExceeded',
      code: 'ELEMENT_NAME_MEMORY_LIMIT',
      maxBytes: NAME_MEMORY_LIMIT,
    }))
  })

  it('reports the distinct compact-name limit accurately', () => {
    const tags = Array.from(
      { length: NAME_COUNT_LIMIT + 1 },
      (_, index) => `<x-${index.toString(36)}></x-${index.toString(36)}>`,
    ).join('')
    const html = `${'<div>'.repeat(LIMIT + 1)}${tags}`
    expect(() => htmlToMarkdown(html)).toThrowError(expect.objectContaining({
      _tag: 'ElementNameCountLimitExceeded',
      code: 'ELEMENT_NAME_COUNT_LIMIT',
      maxNames: NAME_COUNT_LIMIT,
    }))
  })

  it('propagates the name memory error from streaming input', async () => {
    const tag = `x-${'a'.repeat(NAME_MEMORY_LIMIT - 1)}`
    await expect(streamConvert([
      '<div>'.repeat(LIMIT),
      `<${tag}>`,
    ])).rejects.toMatchObject({
      _tag: 'ElementNameMemoryLimitExceeded',
      code: 'ELEMENT_NAME_MEMORY_LIMIT',
      maxBytes: NAME_MEMORY_LIMIT,
    })
  })

  it('rejects repeated closes blocked by a compact template in constant time', () => {
    const html = `${'<div>'.repeat(LIMIT)}<template>${'<span>'.repeat(3_000)}${'</div>'.repeat(100_000)}`
    expect(htmlToMarkdown(html)).toBe('')
  })

  it('recovers across streaming chunk boundaries above the materialized limit', async () => {
    const chunks = [
      '<p>before</p>',
      ...Array.from<string>({ length: LIMIT }).fill('<div>'),
      '<x-one><x-two>in',
      'side</x-one><p>after</p>',
      ...Array.from<string>({ length: LIMIT }).fill('</div>'),
      '<p>tail</p>',
    ]
    expect(await streamConvert(chunks)).toBe('before\n\ninside after\n\ntail')
  })
})
