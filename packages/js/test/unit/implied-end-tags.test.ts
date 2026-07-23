import type { ElementNode } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ELEMENT_NODE, TAG_BLOCKQUOTE } from '../../src/const'
import { htmlToMarkdown, NodeEventEnter, streamHtmlToMarkdown } from '../../src/index'
import { parseHtml } from '../../src/parse'

// Browser recovery: implied end tags (HTML §13.1.2.4 optional tags +
// tree-construction). Malformed-but-valid markup that omits end tags must
// recover the same way browsers do, so the missing close does not nest or drop
// content. Mirrors the Rust engine's `implied_end_tags.rs`.

async function streamConvert(chunks: string[]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const c of chunks)
        controller.enqueue(c)
      controller.close()
    },
  })
  let out = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    out += chunk
  return out
}

describe('<p> implied end tags', () => {
  it('keeps both paragraphs when the first <p> is unclosed', () => {
    // Regression: the second <p> used to nest inside the first, dropping "two".
    expect(htmlToMarkdown('<p>one<p>two')).toBe('one\n\ntwo')
    expect(htmlToMarkdown('<p>a<p>b<p>c')).toBe('a\n\nb\n\nc')
  })

  it('still closes an unclosed <p> on other block elements', () => {
    expect(htmlToMarkdown('<p>one<div>two</div>')).toBe('one\n\ntwo')
    expect(htmlToMarkdown('<p>one<ul><li>x</li></ul>')).toBe('one\n\n- x')
    expect(htmlToMarkdown('<p>a<h2>b</h2>')).toBe('a\n\n## b')
    expect(htmlToMarkdown('<p>a<blockquote>b</blockquote>')).toBe('a\n\n> b')
  })

  it('leaves well-formed paragraphs unchanged', () => {
    expect(htmlToMarkdown('<p>one</p><p>two</p>')).toBe('one\n\ntwo')
  })
})

describe('<li> implied end tags', () => {
  it('treats unclosed <li> as siblings', () => {
    // Regression: the second <li> used to wrongly nest under the first.
    expect(htmlToMarkdown('<ul><li>one<li>two</ul>')).toBe('- one\n- two')
    expect(htmlToMarkdown('<ol><li>one<li>two<li>three</ol>')).toBe('1. one\n2. two\n3. three')
  })

  it('keeps a trailing unclosed <li> at EOF', () => {
    expect(htmlToMarkdown('<ul><li>one<li>two')).toBe('- one\n- two')
  })

  it('preserves nested-list structure with unclosed <li>', () => {
    expect(htmlToMarkdown('<ul><li>a<ul><li>b<li>c</ul><li>d</ul>')).toBe('- a\n  - b\n  - c\n- d')
  })

  it('leaves a well-formed list unchanged', () => {
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two')
  })
})

describe('table implied end tags', () => {
  it('builds a clean table from implicit cell/row ends', () => {
    // Regression: a bare <tr>/<td> used to leak into the cell output.
    expect(htmlToMarkdown('<table><tr><td>a<td>b<tr><td>c<td>d</table>'))
      .toBe('| a | b |\n| --- | --- |\n| c | d |')
  })

  it('builds a clean table from implicit section ends', () => {
    expect(htmlToMarkdown('<table><thead><tr><th>H<tbody><tr><td>D</table>'))
      .toBe('| H |\n| --- |\n| D |')
  })

  it('leaves a well-formed table unchanged', () => {
    expect(htmlToMarkdown('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>'))
      .toBe('| a | b |\n| --- | --- |\n| c | d |')
  })
})

// <dl>/<dt>/<dd> keep their raw-HTML passthrough (valid inline markup for
// GitHub-flavoured Markdown); the recovery only fixes the implied nesting.
describe('definition list implied end tags', () => {
  it('recovers unclosed <dt>/<dd> to clean raw tags', () => {
    // Regression: <dt>/<dd> used to nest endlessly (e.g. `…</dd></dt></dd></dt>`).
    expect(htmlToMarkdown('<dl><dt>Coffee<dd>Black hot drink</dl>'))
      .toBe('<dl><dt>Coffee</dt>\n<dd>Black hot drink</dd>\n</dl>')
  })

  it('closes alternating <dt>/<dd>', () => {
    expect(htmlToMarkdown('<dl><dt>Coffee<dd>Hot drink<dt>Milk<dd>Cold drink</dl>'))
      .toBe('<dl><dt>Coffee</dt>\n<dd>Hot drink</dd>\n<dt>Milk</dt>\n<dd>Cold drink</dd>\n</dl>')
  })

  it('supports multiple definitions per term', () => {
    expect(htmlToMarkdown('<dl><dt>Term<dd>Def 1<dd>Def 2</dl>'))
      .toBe('<dl><dt>Term</dt>\n<dd>Def 1</dd>\n<dd>Def 2</dd>\n</dl>')
  })

  it('makes a malformed list match its well-formed equivalent', () => {
    expect(htmlToMarkdown('<dl><dt>Coffee<dd>Hot drink</dl>'))
      .toBe(htmlToMarkdown('<dl><dt>Coffee</dt><dd>Hot drink</dd></dl>'))
  })
})

describe('nested anchors', () => {
  it('closes the open <a> when another opens', () => {
    // Regression: nested <a> produced invalid nested markdown `[one [two](/2)](/1)`.
    expect(htmlToMarkdown('<a href=/1>one<a href=/2>two</a>')).toBe('[one](/1) [two](/2)')
    expect(htmlToMarkdown('<a href=/1>one<b>bold<a href=/2>two</a>')).toBe('[one**bold**](/1) [two](/2)')
  })

  it('leaves well-formed and cross-block anchors unchanged', () => {
    expect(htmlToMarkdown('<a href=/1>one</a><a href=/2>two</a>')).toBe('[one](/1) [two](/2)')
    expect(htmlToMarkdown('<div><a href=/1>one</div><a href=/2>two</a>')).toBe('[one](/1)\n\n[two](/2)')
  })
})

describe('headings', () => {
  it('closes an open heading when another opens', () => {
    // Regression: `<h1>a<h2>b` rendered "# a ## b" on one invalid line.
    expect(htmlToMarkdown('<h1>a<h2>b</h2>')).toBe('# a\n\n## b')
    expect(htmlToMarkdown('<h2>a<h2>b')).toBe('## a\n\n## b')
  })

  it('leaves well-formed headings unchanged', () => {
    expect(htmlToMarkdown('<h1>a</h1><h2>b</h2>')).toBe('# a\n\n## b')
    expect(htmlToMarkdown('<h1><em>a</em></h1>')).toBe('# *a*')
  })
})

describe('trailing content at EOF', () => {
  it('does not drop trailing text', () => {
    expect(htmlToMarkdown('<p>hello')).toBe('hello')
    expect(htmlToMarkdown('hello')).toBe('hello')
    expect(htmlToMarkdown('<b>bold')).toBe('**bold**')
  })
})

describe('explicit end tags', () => {
  it('accepts trailing whitespace before the closing bracket', () => {
    expect(htmlToMarkdown('<script>hidden</script\n><p>shown</p>')).toBe('shown')
    expect(htmlToMarkdown('<script>hidden</script\f><p>shown</p>')).toBe('shown')
    expect(htmlToMarkdown('<blockquote><p>one</p ><p>two</p></blockquote>'))
      .toBe('> one\n>\n> two')
  })

  it('ignores a closing bracket inside a quoted end-tag attribute', () => {
    expect(htmlToMarkdown('<script>hidden</script x=">"><p>shown</p>')).toBe('shown')
  })

  it('accepts a whitespace-padded end tag across stream chunks', async () => {
    expect((await streamConvert(['<script>hidden</script\n', '><p>shown</p>'])).trimEnd())
      .toBe('shown')
    expect((await streamConvert(['<script>hidden</script\f', '><p>shown</p>'])).trimEnd())
      .toBe('shown')
    expect((await streamConvert(['<script>hidden</script x="', '>"><p>shown</p>'])).trimEnd())
      .toBe('shown')
  })
})

describe('tag nesting depth', () => {
  it('does not reset same-tag depth for elements with an id', () => {
    const depths = parseHtml('<blockquote><blockquote id="nested">text</blockquote></blockquote>')
      .events
      .filter(event => event.type === NodeEventEnter && event.node.type === ELEMENT_NODE && (event.node as ElementNode).name === 'blockquote')
      .map(event => (event.node as ElementNode).depthMap[TAG_BLOCKQUOTE])

    expect(depths).toEqual([1, 2])
    expect(htmlToMarkdown('<blockquote><blockquote id="nested">text</blockquote></blockquote>'))
      .toBe('> > text')
  })

  it('matches distinct custom elements by name', () => {
    const inline = (enter: string, exit: string) => ({ enter, exit, spacing: [0, 0] as [number, number], isInline: true })
    const plugins = { tagOverrides: { 'x-a': inline('[', ']'), 'x-b': inline('(', ')') } }
    expect(htmlToMarkdown('<x-a><x-b>X</x-a>Y</x-b>', { plugins }))
      .toBe('[(X)]Y')
  })
})

describe('streaming: recovery runs only after a complete start tag', () => {
  it('matches whole-document output when the trigger tag is split across chunks', async () => {
    for (const [chunks, whole] of [
      [['<p>one<p', '>two'], '<p>one<p>two'],
      [['<ul><li>one<l', 'i>two</ul>'], '<ul><li>one<li>two</ul>'],
      [['<table><tr><td>a<t', 'd>b<tr><td>c<td>d</table>'], '<table><tr><td>a<td>b<tr><td>c<td>d</table>'],
      [['<dl><dt>Coffee<d', 'd>Hot drink</dl>'], '<dl><dt>Coffee<dd>Hot drink</dl>'],
    ] as [string[], string][]) {
      const streamedSplit = await streamConvert(chunks)
      const streamedWhole = await streamConvert([whole])
      // Exact (no trim): splitting the trigger tag across chunks must not change
      // a single byte of the streamed output — catches boundary regressions.
      expect(streamedSplit).toBe(streamedWhole)
      // Content matches the batch conversion (streaming keeps the trailing
      // newlines that the one-shot getMarkdown trims).
      expect(streamedSplit.trim()).toBe(htmlToMarkdown(whole))
    }
  })
})
