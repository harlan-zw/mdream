import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'
import { streamHtmlToMarkdown } from '../../src/stream'

const wrap = (html: string, width: number) => htmlToMarkdown(html, { wrapWidth: width })
const HARD_BREAK = '  \n'

describe('wrap width (issue #106)', () => {
  it('is a no-op when unset or zero', () => {
    const html = '<p>The quick brown fox jumps over the lazy dog and then keeps on running well past the edge.</p>'
    expect(wrap(html, 0)).toBe(htmlToMarkdown(html))
    expect(htmlToMarkdown(html, {})).toBe(htmlToMarkdown(html))
  })

  it('breaks prose on word boundaries within the width', () => {
    const out = wrap('<p>The quick brown fox jumps over the lazy dog and then keeps on running well past the edge.</p>', 40)
    expect(out).toBe('The quick brown fox jumps over the lazy\ndog and then keeps on running well past\nthe edge.')
    for (const line of out.split('\n'))
      expect([...line].length).toBeLessThanOrEqual(40)
  })

  it('preserves inline spacing around emphasis', () => {
    expect(wrap('<p>see <em>this</em> word and more words after the emphasis here please now</p>', 40))
      .toBe('see *this* word and more words after the\nemphasis here please now')
  })

  it('preserves br as a line break with and without wrapping (issue #128)', () => {
    const html = '<div>abc def ghi jkl mno<br/>111 222 333 444 555 666 777 888 999 000 abc</div>'

    expect(htmlToMarkdown(html))
      .toBe(`abc def ghi jkl mno${HARD_BREAK}111 222 333 444 555 666 777 888 999 000 abc`)
    expect(wrap(html, 40))
      .toBe(`abc def ghi jkl mno${HARD_BREAK}111 222 333 444 555 666 777 888 999 000\nabc`)
    expect(htmlToMarkdown('<p>first <br>second</p>'))
      .toBe(`first${HARD_BREAK}second`)
  })

  it('keeps nested block continuation prefixes after br', () => {
    expect(htmlToMarkdown('<ul><li>first<br>second</li></ul>'))
      .toBe(`- first${HARD_BREAK}  second`)
    expect(htmlToMarkdown('<blockquote><p>first<br>second</p></blockquote>'))
      .toBe(`> first${HARD_BREAK}> second`)
    expect(htmlToMarkdown('<address>first<br>second</address>'))
      .toBe('<address>first<br>second</address>')
    expect(htmlToMarkdown('<h1>first<br>second</h1>'))
      .toBe('# first<br>second')
    expect(htmlToMarkdown('<pre>first  <br>second</pre>'))
      .toBe('```\nfirst  \nsecond\n```')
  })

  it('never splits an oversized token', () => {
    const out = wrap('<p>A superlongunbreakabletokenthatislongerthanthewrapwidthsoitoverflows end.</p>', 40)
    expect(out).toContain('superlongunbreakabletokenthatislongerthanthewrapwidthsoitoverflows')
  })

  it('does not wrap code blocks, tables, or headings', () => {
    expect(wrap('<pre><code>the quick brown fox jumps over the lazy dog keeps going forever no wrap here</code></pre>', 40))
      .toContain('the quick brown fox jumps over the lazy dog keeps going forever no wrap here')
    expect(wrap('<h1>The quick brown fox jumps over the lazy dog and never stops</h1>', 40))
      .toBe('# The quick brown fox jumps over the lazy dog and never stops')
    expect(wrap('<table><tr><th>The quick brown fox jumps over the lazy dog header</th></tr></table>', 40).split('\n')[0])
      .toBe('| The quick brown fox jumps over the lazy dog header |')
  })

  it('indents blockquote and list continuation lines', () => {
    for (const line of wrap('<blockquote><p>The quick brown fox jumps over the lazy dog and runs further still each day.</p></blockquote>', 40).split('\n'))
      expect(line.startsWith('> ')).toBe(true)
    const list = wrap('<ul><li>The quick brown fox jumps over the lazy dog repeatedly without ever getting tired</li></ul>', 40).split('\n')
    expect(list[0]!.startsWith('- ')).toBe(true)
    for (const line of list.slice(1))
      expect(line.startsWith('  ')).toBe(true)
  })

  it('keeps nested blockquote-in-list structure when wrapping', () => {
    // Continuation prefix must follow real nesting order: indent (list) then
    // quote (`  > `), keeping quoted content inside the list item.
    const out = wrap('<ul><li><blockquote><p>The quick brown fox jumps over the lazy dog every day</p></blockquote></li></ul>', 30)
    for (const line of out.split('\n')) {
      if (line.trim() === '')
        continue
      expect(line.startsWith('- ') || line.startsWith('  > ')).toBe(true)
    }
  })

  it('keeps nested list-in-blockquote structure when wrapping', () => {
    const lines = wrap('<blockquote><ul><li>The quick brown fox jumps over the lazy dog every day</li></ul></blockquote>', 30).split('\n')
    expect(lines[0]!.startsWith('> - ')).toBe(true)
    for (const line of lines.slice(1))
      expect(line.startsWith('>   ')).toBe(true)
  })

  it('wraps identically across streaming chunks', async () => {
    const html = '<p>The quick brown fox jumps over the lazy dog and then keeps on running well past the edge of the field.</p>'
    const oneshot = wrap(html, 40)
    const mid = Math.floor(html.length / 2)
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html.slice(0, mid))
        controller.enqueue(html.slice(mid))
        controller.close()
      },
    })
    let out = ''
    for await (const chunk of streamHtmlToMarkdown(stream, { wrapWidth: 40 }))
      out += chunk
    expect(out.trimEnd()).toBe(oneshot)
  })
})
