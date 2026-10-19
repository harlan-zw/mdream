import type { MdreamOptions } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown as streamWithOptions } from '../../src/index'
import { streamHtmlToMarkdown } from '../../src/stream'

const wrap = (html: string, width: number) => htmlToMarkdown(html, { wrapWidth: width })
const HARD_BREAK = '  \n'

async function expectEveryChunking(html: string, options: Partial<MdreamOptions>, expected: string): Promise<void> {
  expect(htmlToMarkdown(html, options)).toBe(expected)
  for (let size = 1; size <= html.length; size++) {
    const stream = new ReadableStream<string>({
      start(controller) {
        for (let offset = 0; offset < html.length; offset += size)
          controller.enqueue(html.slice(offset, offset + size))
        controller.close()
      },
    })
    let out = ''
    for await (const chunk of streamWithOptions(stream, options))
      out += chunk
    expect(out, `chunk size ${size}`).toBe(expected)
  }
}

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

  it.each([
    ['<p><span>aaaaa </span>bbbb</p>', 6, 'aaaaa\nbbbb'],
    ['<p><em>aaaaaaaaaaa </em>b</p>', 12, '*aaaaaaaaaaa*\nb'],
    ['<p><a href="/x">aaaaa </a>bbbb cc</p>', 12, '[aaaaa](/x)\nbbbb cc'],
    ['<p><code>aaaaa </code>bbbb cc</p>', 6, '`aaaaa`\nbbbb\ncc'],
    ['<ul><li><em>aaaaaaa </em>bbbb cc dddd</li></ul>', 12, '- *aaaaaaa*\n  bbbb cc\n  dddd'],
    ['<blockquote><p><em>aaaaaaa </em>bbbb cc dddd</p></blockquote>', 12, '> *aaaaaaa*\n> bbbb cc dddd'],
    ['<p><strong>aaaaa </strong>bbbb cc</p>', 80, '**aaaaa** bbbb cc'],
  ] as const)('breaks at a separator trimmed from an inline element: %s', async (html, width, expected) => {
    expect(wrap(html, width)).toBe(expected)
    for (let size = 1; size <= html.length; size++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += size)
            controller.enqueue(html.slice(offset, offset + size))
          controller.close()
        },
      })
      let out = ''
      for await (const chunk of streamHtmlToMarkdown(stream, { wrapWidth: width }))
        out += chunk
      expect(out, `chunk size ${size}`).toBe(expected)
    }
  })

  // Text escaped mid-line leaves these markers bare, so a break before one
  // would open a list, quote, heading or fence. The marker overflows instead.
  it.each([
    ['<p>The configuration guide explains each option in detail, so read it first <b>Price </b>- 5 dollars per month for every user seat.</p>', 80, 'The configuration guide explains each option in detail, so read it first **Price** -\n5 dollars per month for every user seat.'],
    ['<p>The configuration guide explains each option in detail, so read it before <code>count </code>&gt; 5 triggers the warning in the log.</p>', 80, 'The configuration guide explains each option in detail, so read it before `count` >\n5 triggers the warning in the log.'],
    ['<p>The configuration guide explains each option in detail, so read it to see <a href="/issues">Issue </a># 42 for the full discussion.</p>', 80, 'The configuration guide explains each option in detail, so read it to see [Issue](/issues) #\n42 for the full discussion.'],
    ['<p>The configuration guide explains each option in detail, so read it until the <em>end </em>---</p><p>Next paragraph.</p>', 80, 'The configuration guide explains each option in detail, so read it until the *end* ---\n\nNext paragraph.'],
    ['<p><span>aaaaa </span>- bbbb</p>', 6, 'aaaaa -\nbbbb'],
    ['<p>aaaaa - bbbb</p>', 6, 'aaaaa -\nbbbb'],
    ['<p>aaaaa &gt;b</p>', 6, 'aaaaa >b'],
    ['<p>aaaaa ## b</p>', 6, 'aaaaa ##\nb'],
    ['<p>aaaaa 1) bb</p>', 6, 'aaaaa 1)\nbb'],
    ['<p>aaaaa ===</p>', 6, 'aaaaa ==='],
    ['<ul><li>aaaaa - bbbb</li></ul>', 8, '- aaaaa -\n  bbbb'],
    ['<details><summary>S</summary><code>aaaaaaaa </code>~~~</details><p>After.</p>', 12, '<details>\n\n<summary>S</summary>\n\n\n\n<code>aaaaaaaa</code> ~~~</details>\n\n\n\nAfter.'],
    ['<details><summary>S</summary><code>aaaaaaaa</code> - x</details><p>After.</p>', 12, '<details>\n\n<summary>S</summary>\n\n\n\n<code>aaaaaaaa</code> -\nx</details>\n\n\n\nAfter.'],
    ['<p>aaaaa * bbbb</p>', 6, 'aaaaa\n\\*\nbbbb'],
    ['<p>aaaaa 1.5 bb</p>', 6, 'aaaaa\n1.5 bb'],
    ['<p>aaaaa ####### b</p>', 6, 'aaaaa\n#######\nb'],
  ] as const)('never breaks before a block marker: %s', async (html, width, expected) => {
    await expectEveryChunking(html, { wrapWidth: width }, expected)
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
