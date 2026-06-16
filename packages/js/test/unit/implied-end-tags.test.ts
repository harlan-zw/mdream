import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

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

describe('trailing content at EOF', () => {
  it('does not drop trailing text', () => {
    expect(htmlToMarkdown('<p>hello')).toBe('hello')
    expect(htmlToMarkdown('hello')).toBe('hello')
    expect(htmlToMarkdown('<b>bold')).toBe('**bold**')
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
