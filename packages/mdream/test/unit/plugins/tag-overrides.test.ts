import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../../utils/engines'

const MARKED = { enter: '[', exit: ']' }
const VOID_MARKED = { ...MARKED, isSelfClosing: true }
const OPEN_MARKED = { ...MARKED, isSelfClosing: false }

const SELF_CLOSING_CASES: [string, Record<string, any>, string][] = [
  ['<p>a <x-y> 2</p>', { 'x-y': { isSelfClosing: true } }, 'a  2'],
  ['<p>a <x-y>text</x-y> b</p>', { 'x-y': VOID_MARKED }, 'a []text b'],
  ['<p>a <x-y><x-y>in</x-y></x-y> b</p>', { 'x-y': VOID_MARKED }, 'a [][]in b'],
  ['<p>a <x-y title="1>2">text</x-y> b</p>', { 'x-y': VOID_MARKED }, 'a []text b'],
  ['<p>a <X-Y>text</X-Y> b</p>', { 'x-y': VOID_MARKED }, 'a []text b'],
  ['<p>a<em>b</em>c</p>', { em: VOID_MARKED }, 'a[]bc'],
  ['<p>a<EM>b</EM>c</p>', { em: VOID_MARKED }, 'a[]bc'],
  ['<p>a<br>b</br>c</p>', { br: OPEN_MARKED }, 'a[b]c'],
  ['<p>a<BR>b</BR>c</p>', { br: OPEN_MARKED }, 'a[b]c'],
  ['<p>a<br/>b</p>', { br: OPEN_MARKED }, 'a[]b'],
  ['<p>a<br>b</p>', { br: MARKED }, 'a[]b'],
  ['<p>a<x-y>b</x-y>c</p>', { 'x-y': 'br' }, 'a  \nbc'],
  ['<p>a<x-y>b</x-y>c</p>', { 'x-y': 'br', 'br': { isSelfClosing: false } }, 'a  \nbc'],
  ['<p>a <![CDATA[x]]> c</p><p>d</p>', { '#cdata-section': VOID_MARKED }, 'a [] c\n\nd'],
  ['<p>a <![CDATA[x]]> c</p><p>d</p>', { '#cdata-section': 'br' }, 'a  \n c\n\nd'],
  ['<ul><li><hr>x</hr></li></ul>', { hr: { isSelfClosing: false } }, '- ***\n\n  x'],
  ['<ul><li>a<hr>x</hr>b</li></ul>', { hr: { isSelfClosing: false } }, '- a\n\n  ---\n\n  x b'],
  ['<br><h1></h1></br>b c', { br: { isSelfClosing: false } }, '# b c'],
]

function streamInChunksOf(html: string, width: number, engine: any, tagOverrides: Record<string, any>, format?: 'text' | 'html') {
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < html.length; i += width)
        controller.enqueue(html.slice(i, i + width))
      controller.close()
    },
  })
  return streamHtmlToMarkdown(stream as any, { engine, format, plugins: { tagOverrides } })
}

async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let output = ''
  for await (const chunk of chunks)
    output += chunk
  return output
}

describe.each(engines)('tagOverrides $name', (engineConfig) => {
  it('overrides enter/exit strings for existing tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p><strong>bold</strong></p>', {
      plugins: {
        tagOverrides: {
          strong: { enter: '__', exit: '__' },
        },
      },
      engine,
    })
    expect(markdown).toBe('__bold__')
  })

  it('escapes link text brackets when only the anchor enter is overridden in a raw HTML block', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<details><a href="/x">a[b]</a></details>', {
      plugins: {
        tagOverrides: {
          a: { enter: '[' },
        },
      },
      engine,
    })
    expect(markdown).toBe('<details>[a&#91;b&#93;](/x)</details>')
  })

  it('aliases custom element to known tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p><x-heading>content</x-heading></p>', {
      plugins: {
        tagOverrides: {
          'x-heading': 'h2',
        },
      },
      engine,
    })
    expect(markdown).toBe('## content')
  })

  it('overrides spacing on a block element', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<div>first</div><div>second</div>', {
      plugins: {
        tagOverrides: {
          div: { spacing: [1, 1] },
        },
      },
      engine,
    })
    expect(markdown).toBe('first\nsecond')
  })

  it('makes a block element inline', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>before <span>middle</span> after</p>', {
      plugins: {
        tagOverrides: {
          span: { isInline: false, spacing: [2, 2] },
        },
      },
      engine,
    })
    // span is normally inline — overriding to block should add newlines
    expect(markdown).toContain('before')
    expect(markdown).toContain('middle')
    expect(markdown).toContain('after')
  })

  it('handles custom element with enter/exit', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p><x-note>important</x-note></p>', {
      plugins: {
        tagOverrides: {
          'x-note': { enter: '> **Note:** ', exit: '', isInline: true, spacing: [0, 0], collapsesInnerWhiteSpace: true },
        },
      },
      engine,
    })
    expect(markdown).toBe('> **Note:** important')
  })

  it.each([
    ['<p>a<x-y>2</x-y>z</p>', 'a**2**z', 'markdown'],
    ['<p>a <x-y>2</x-y> z</p>', 'a **2** z', 'markdown'],
    ['<p><em>a </em><x-y>2</x-y>z</p>', '*a* **2**z', 'markdown'],
    ['<p><em>a </em><x-y>2</x-y>z</p>', 'a **2**z', 'text'],
  ] as const)('keeps a custom element inline when its override leaves isInline unset: %s (%s)', async (html, expected, format) => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown(html, {
      plugins: { tagOverrides: { 'x-y': { enter: '**', exit: '**' } } },
      engine,
      format,
    })
    expect(markdown).toBe(expected)
  })

  it('aliases unknown tag to em', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p><x-italic>text</x-italic></p>', {
      plugins: {
        tagOverrides: {
          'x-italic': 'em',
        },
      },
      engine,
    })
    expect(markdown).toBe('*text*')
  })

  it('converts sup/sub to extended markdown syntax (issue #93)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>E = mc<sup>2</sup> and H<sub>2</sub>O</p>', {
      plugins: {
        tagOverrides: {
          sup: { enter: '^', exit: '^' },
          sub: { enter: '~', exit: '~' },
        },
      },
      engine,
    })
    expect(markdown).toBe('E = mc^2^ and H~2~O')
  })

  it('overrides a top-level inline tag with no block ancestor (issue #93)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    // The reported regression: the override worked inside a block but not
    // when the tag sat at the top level of the input.
    const markdown = htmlToMarkdown('foo <sup>bar</sup>', {
      plugins: {
        tagOverrides: {
          sup: { enter: '^', exit: '^' },
        },
      },
      engine,
    })
    expect(markdown).toBe('foo ^bar^')
  })

  it('works alongside extraction without interference', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const extracted: string[] = []
    const markdown = htmlToMarkdown('<p><strong>bold</strong><em>italic</em></p>', {
      plugins: {
        tagOverrides: {
          strong: { enter: '__', exit: '__' },
        },
        extraction: {
          em: el => extracted.push(el.textContent),
        },
      },
      engine,
    })
    expect(markdown).toBe('__bold__*italic*')
    expect(extracted).toEqual(['italic'])
  })

  it('drops CDATA sections by default', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>before<![CDATA[secret payload]]>after</p>', {
      engine,
    })
    expect(markdown).not.toContain('secret payload')
    expect(markdown).toContain('before')
    expect(markdown).toContain('after')
  })

  it('emits CDATA content via #cdata-section enter/exit override', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>a<![CDATA[hidden]]>b</p>', {
      plugins: {
        tagOverrides: {
          '#cdata-section': { enter: '[', exit: ']', isInline: true, spacing: [0, 0] },
        },
      },
      engine,
    })
    expect(markdown).toBe('a[hidden]b')
  })

  it('does not treat <![ conditional comments as CDATA', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>x<![if !IE]>y<![endif]>z</p>', {
      engine,
    })
    expect(markdown).toContain('x')
    expect(markdown).toContain('z')
  })

  it('works alongside filter without interference', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<div><nav>skip</nav><p><strong>keep</strong></p></div>', {
      plugins: {
        tagOverrides: {
          strong: { enter: '__', exit: '__' },
        },
        filter: {
          exclude: ['nav'],
        },
      },
      engine,
    })
    expect(markdown).toBe('__keep__')
  })
})

describe.each(engines)('tagOverrides isSelfClosing $name', (engineConfig) => {
  it.each(SELF_CLOSING_CASES)('%s %j', async (html, tagOverrides, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, plugins: { tagOverrides } })).toBe(expected)
    for (let width = 1; width <= html.length; width++)
      expect(await collect(streamInChunksOf(html, width, engine, tagOverrides)), `width ${width}`).toBe(expected)
  })

  it.each([
    ['text', 'a  2'],
    ['html', '<p>a  2</p>'],
  ] as const)('applies to %s output', async (format, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>a <x-y> 2</p>'
    const tagOverrides = { 'x-y': { isSelfClosing: true } }
    expect(htmlToMarkdown(html, { engine, format, plugins: { tagOverrides } })).toBe(expected)
    for (let width = 1; width <= html.length; width++)
      expect(await collect(streamInChunksOf(html, width, engine, tagOverrides, format)), `width ${width}`).toBe(expected)
  })

  it('closes a reopened void tag past the depth limit', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `${'<div>'.repeat(512)}<br>a</br><div>b</div><p>c</p>${'</div>'.repeat(512)}<p>d</p>`
    const markdown = htmlToMarkdown(html, { engine, plugins: { tagOverrides: { br: { isSelfClosing: false } } } })
    expect(markdown).toBe('a b c\n\nd')
  })
})
