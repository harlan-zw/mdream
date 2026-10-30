import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../../utils/engines'

function chunkedStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const chunk of stream)
    out += chunk
  return out
}

async function collectChunks(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of stream)
    chunks.push(chunk)
  return chunks
}

describe.each(engines)('text Formatting $name', (engineConfig) => {
  it('converts bold text with <strong>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <strong>bold</strong> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts bold text with <b>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <b>bold</b> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts italic text with <em>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <em>italic</em> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is *italic* text')
  })

  it('converts italic text with <i>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <i>italic</i> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is *italic* text')
  })

  it('handles nested formatting', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <strong><em>bold and italic</em></strong> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is ***bold and italic*** text')
  })
})

// Top-level text nodes (no block ancestor) used to be dropped (issue #93).
describe.each(engines)('top-level inline text $name', (engineConfig) => {
  it('keeps text before a top-level inline tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('foo <em>bar</em>', { engine })).toBe('foo *bar*')
  })

  it('keeps text between top-level inline tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<strong>a</strong> and <em>b</em>', { engine })).toBe('**a** and *b*')
  })

  it('keeps text between repeated top-level inline tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('a<strong>b</strong>c<strong>d</strong>', { engine })).toBe('a**b**c**d**')
  })
})

// Empty inline emphasis used to leak its markers into the output
// (<i class="icon"></i> → __, <b></b> → ****).
describe.each(engines)('empty inline emphasis $name', (engineConfig) => {
  it('drops markers for empty emphasis elements', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><b></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><strong></strong>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><i></i>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><em></em>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><del></del>x</p>', { engine })).toBe('x')
  })

  it('drops markers for whitespace-only emphasis', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><strong> </strong>x</p>', { engine })).toBe('x')
  })

  it('drops an empty icon <i> before text', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p class="rc-scout__text"><i class="rc-scout__logo"></i>You might also like the Recurse Center</p>'
    expect(htmlToMarkdown(html, { engine })).toBe('You might also like the Recurse Center')
  })

  it('drops empty emphasis inside headings and list items', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<h2><i class="icon"></i>Title</h2>', { engine })).toBe('## Title')
    expect(htmlToMarkdown('<ul><li><b></b>x</li></ul>', { engine })).toBe('- x')
  })

  it('drops nested empty emphasis entirely', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><b><i></i></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><b><b></b></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><b><i><del></del></i></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><b><i></i><i></i></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><del><del></del></del>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><strong><b></b></strong>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><strong><em><b></b></em></strong>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><strong><x-unknown></x-unknown></strong>x</p>', { engine })).toBe('x')
  })

  it('drops markers for an empty figcaption', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<figure><figcaption></figcaption></figure>', { engine })).toBe('')
  })

  it('drops stray markers for other empty symmetric inline tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p>a<cite></cite>b</p>', { engine })).toBe('ab')
    expect(htmlToMarkdown('<p>a<dfn></dfn>b</p>', { engine })).toBe('ab')
    expect(htmlToMarkdown('<p>a<kbd></kbd>b</p>', { engine })).toBe('ab')
    expect(htmlToMarkdown('<p>a<code></code>b</p>', { engine })).toBe('ab')
    expect(htmlToMarkdown('<p>a<samp></samp>b</p>', { engine })).toBe('ab')
    expect(htmlToMarkdown('<p>a<var></var>b</p>', { engine })).toBe('ab')
    // <q> drops its quote markers but keeps its surrounding spacing, like <del>.
    expect(htmlToMarkdown('<p>a<q></q>b</p>', { engine })).toBe('a b')
  })

  it('lets a hard break absorb the spacing an emptied element keeps', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p>a<q></q><br>x</p>', { engine })).toBe('a  \nx')
    expect(htmlToMarkdown('<p>a<q> </q><br>x</p>', { engine })).toBe('a  \nx')
    expect(htmlToMarkdown('<p>a<del></del><br>x</p>', { engine })).toBe('a  \nx')
    expect(htmlToMarkdown('<p>a<q> </q><b><span></span><q> </q></b><br>x</p>', { engine })).toBe('a  \nx')
    for (const br of [{ spacing: [0, 0] as [number, number] }, 'br'])
      expect(htmlToMarkdown('<p>a<q></q><br>x</p>', { engine, plugins: { tagOverrides: { br } } })).toBe('a  \nx')
  })

  it('separates raw inline HTML after a pipe outside tables', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p>a|<mark>x</mark></p>', { engine })).toBe('a| <mark>x</mark>')
    expect(htmlToMarkdown('<p>a|<code>x</code></p>', { engine })).toBe('a|`x`')
    expect(htmlToMarkdown('<h2>a|<br>b</h2>', { engine })).toBe('## a| <br>b')
    expect(htmlToMarkdown('<h2>a|<br>b</h2>', { engine, plugins: { tagOverrides: { br: { spacing: [0, 0] } } } })).toBe('## a| <br>b')
  })

  it('drops the separator owned by empty inline code in a list', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<ul><li>x<code></code>y</li></ul>', { engine })).toBe('- xy')
  })

  it('keeps non-empty markers for other symmetric inline tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p>a<cite>x</cite>b</p>', { engine })).toBe('a*x*b')
    expect(htmlToMarkdown('<p>a<dfn>x</dfn>b</p>', { engine })).toBe('a**x**b')
    expect(htmlToMarkdown('<p>a<code>x</code>b</p>', { engine })).toBe('a`x`b')
    expect(htmlToMarkdown('<p>a<kbd>x</kbd>b</p>', { engine })).toBe('a`x`b')
    expect(htmlToMarkdown('<p>a<samp>x</samp>b</p>', { engine })).toBe('a`x`b')
    expect(htmlToMarkdown('<p>a<var>x</var>b</p>', { engine })).toBe('a`x`b')
    expect(htmlToMarkdown('<p>a<q>x</q>b</p>', { engine })).toBe('a "x"b')
  })

  it('keeps non-empty emphasis untouched', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><b>hi</b></p>', { engine })).toBe('**hi**')
    expect(htmlToMarkdown('<p><b><em>x</em></b></p>', { engine })).toBe('***x***')
    expect(htmlToMarkdown('<p><b><img src="x.png" alt="y"></b></p>', { engine })).toBe('**![y](x.png)**')
  })

  it('does not mistake literal marker text at the tail for an empty pair', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><b>x<span>**</span></b></p>', { engine })).toBe('**x\\*\\***')
  })

  it('drops empty emphasis at every stream split point', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>before <b></b><i class="icon"></i>after</p>'
    for (let i = 1; i < html.length; i++) {
      const result = await collect(streamHtmlToMarkdown(chunkedStream([html.slice(0, i), html.slice(i)]), { engine }))
      expect(result.trim(), `split at ${i}`).toBe('before after')
    }
  })

  it('keeps override emphasis markers on empty elements', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    // An override emitting the built-in marker opts out of empty-pair cleanup.
    const markdown = htmlToMarkdown('<p><b></b>x</p>', {
      plugins: { tagOverrides: { b: { enter: '**', exit: '**' } } },
      engine,
    })
    expect(markdown).toBe('****x')
  })

  it('releases non-text content inside open emphasis while streaming', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    // The <img> makes <b> non-empty, so its markdown must be yielded before </b>
    // arrives instead of staying buffered until the emphasis closes.
    const chunks = await collectChunks(streamHtmlToMarkdown(
      chunkedStream(['<p><b><img src="x.png" alt="y"><span>', 'more</span></b></p>']),
      { engine },
    ))
    expect(chunks.slice(0, -1).join(''), 'image held until close').toContain('![y](x.png)')
    expect(chunks.join('').trim()).toBe('**![y](x.png)more**')
  })

  it('releases a literal exit override without waiting for later text', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const chunks = await collectChunks(streamHtmlToMarkdown(
      chunkedStream(['<p><b></b><span>', 'later</span></p>']),
      {
        plugins: { tagOverrides: { b: { exit: '' } } },
        engine,
      },
    ))
    expect(chunks.slice(0, -1).join(''), 'literal exit held until finish').toContain('**')
    expect(chunks.join('').trim()).toBe('**later')
  })

  it('holds a block code fence until its delimiter is known', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const chunks = await collectChunks(streamHtmlToMarkdown(
      chunkedStream(['<pre><code><span>', 'x</span></code></pre>']),
      { engine },
    ))
    expect(chunks.join('').trim()).toBe('```\nx\n```')
  })
})

describe.each(engines)('gfm inline code delimiters $name', (engineConfig) => {
  it('widens around backticks and applies required padding', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<code>a `b` c</code>', { engine })).toBe('``a `b` c``')
    expect(htmlToMarkdown('<code>`edge`</code>', { engine })).toBe('`` `edge` ``')
  })

  it('matches batch output at every stream split', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>before <code>a `b` c</code> after</p>'
    const expected = htmlToMarkdown(html, { engine })
    for (let split = 1; split < html.length; split++) {
      const actual = await collect(streamHtmlToMarkdown(
        chunkedStream([html.slice(0, split), html.slice(split)]),
        { engine },
      ))
      expect(actual, `split at ${split}`).toBe(expected)
    }
  })
})

describe.each(engines)('setext equals escaping $name', (engineConfig) => {
  it.each([
    ['<ul><li>x<ul><li>a<br># b</li></ul></li></ul>', '- x\n  - a  \n    \\# b'],
    ['<ul><li>x<ul><li>a<br>- b</li></ul></li></ul>', '- x\n  - a  \n    \\- b'],
    ['<ul><li>x<ul><li>a<br>+ b</li></ul></li></ul>', '- x\n  - a  \n    \\+ b'],
    ['<ul><li>x<ul><li>a<br>1. b</li></ul></li></ul>', '- x\n  - a  \n    1\\. b'],
    ['<ul><li>x<ul><li>a<br>&gt; b</li></ul></li></ul>', '- x\n  - a  \n    \\> b'],
    ['<p>aaaaa<br>===</p>', 'aaaaa  \n\\==='],
    ['<p>aaaaa<br><span>=</span><span>==</span></p>', 'aaaaa  \n\\==='],
    ['<p>aaaaa<br> <span></span>===</p>', 'aaaaa  \n\\==='],
    ['<p>aaaaa<br>=</p>', 'aaaaa  \n\\='],
    ['<p>aaaaa<br>==</p>', 'aaaaa  \n\\=='],
    ['<p>=SUM(A1:A3)</p>', '=SUM(A1:A3)'],
    ['<p>aaaaa<br>= b</p>', 'aaaaa  \n= b'],
    ['<p>aaaaa<br>=b</p>', 'aaaaa  \n=b'],
    ['<p>aaaaa<br>== =</p>', 'aaaaa  \n== ='],
    ['<p>aaaaa<br>=== x</p>', 'aaaaa  \n=== x'],
    ['<p>aaaaa<br>=== </p>', 'aaaaa  \n\\==='],
    ['<ul><li>x<ul><li>a<br>= b</li></ul></li></ul>', '- x\n  - a  \n    = b'],
    ['<blockquote><p>x<br>= b</p></blockquote>', '> x  \n> = b'],
    ['<blockquote><p>x<br>==</p></blockquote>', '> x  \n> \\=='],
    ['<p>aaaaa<br><span></span></p>', 'aaaaa'],
    ['<p>a = b and x===y</p>', 'a = b and x===y'],
    ['<p>a<span>=</span><span>==</span>b</p>', 'a===b'],
    ['<p><code>===</code></p>', '`===`'],
    ['<p></p>', ''],
    ['<ul><li><p>aaaaa<br><span>=</span><span>==</span></p></li></ul>', '- aaaaa  \n  \\==='],
    ['<ul><li>x<ul><li><p>aaaaa<br><span>=</span><span>==</span></p></li></ul></li></ul>', '- x\n  - aaaaa  \n    \\==='],
    ['<ul><li>x<ul><li>x<ul><li><p>aaaaa<br><span>=</span><span>==</span></p></li></ul></li></ul></li></ul>', '- x\n  - x\n    - aaaaa  \n      \\==='],
    ['<ul><li>x<ul><li>x<ul><li>x<ul><li><p>aaaaa<br><span>=</span><span>==</span></p></li></ul></li></ul></li></ul></li></ul>', '- x\n  - x\n    - x\n      - aaaaa  \n        \\==='],
    ['<ul><li>x<ul><li>x<ul><li>x<ul><li>x<ul><li><p>aaaaa<br><span>=</span><span>==</span></p></li></ul></li></ul></li></ul></li></ul></li></ul>', '- x\n  - x\n    - x\n      - x\n        - aaaaa  \n          \\==='],
    ['<ul><li>x<ul><li>x<ul><li>x<ul><li>x<ul><li>x<ul><li><p>aaaaa<br><span>=</span><span>==</span></p></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>', '- x\n  - x\n    - x\n      - x\n        - x\n          - aaaaa  \n            \\==='],
  ])('preserves paragraph text: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })
})

describe.each(engines)('setext dash escaping $name', (engineConfig) => {
  it.each([
    ['<p>aaaaa<br>--</p>', 'aaaaa  \n\\--'],
    ['<p>aaaaa<br>-- </p>', 'aaaaa  \n\\--'],
    ['<p>aaaaa<br>--\t</p>', 'aaaaa  \n\\--'],
    ['<p>aaaaa<br>--<br>b</p>', 'aaaaa  \n\\--  \nb'],
    ['<p>aaaaa<br>-<span>-</span></p>', 'aaaaa  \n\\--'],
    ['<p>aaaaa<br>- -</p>', 'aaaaa  \n\\- -'],
    ['<p>aaaaa<br>-- -</p>', 'aaaaa  \n\\-- -'],
    ['<p>aaaaa<br>---</p>', 'aaaaa  \n\\---'],
    ['<ul><li>x<br>--</li></ul>', '- x  \n  \\--'],
    ['<ul><li>x<ul><li>y<br>--</li></ul></li></ul>', '- x\n  - y  \n    \\--'],
    ['<blockquote><p>x<br>--</p></blockquote>', '> x  \n> \\--'],
    ['<p>aaaaa<br>-- a</p>', 'aaaaa  \n-- a'],
    ['<p>aaaaa<br>--a</p>', 'aaaaa  \n--a'],
    ['<p>aaaaa --</p>', 'aaaaa --'],
    ['<p>x<br><b>--</b></p>', 'x  \n**--**'],
  ])('preserves paragraph text: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, wrapWidth: 20 })).toBe(expected)
    for (let i = 1; i < html.length; i++) {
      const streamed = await collect(streamHtmlToMarkdown(chunkedStream([html.slice(0, i), html.slice(i)]), { engine, wrapWidth: 20 }))
      expect(streamed, `split at ${i}`).toBe(expected)
    }
  })
})

describe.each(engines)('wrapped setext markers after an escaped line start $name', (engineConfig) => {
  it.each([
    ['<p>===<span> --</span></p>', 4, '\\=== --'],
    ['<p><span>===</span> --</p>', 5, '\\=== --'],
    ['<p><span>--</span> --</p>', 5, '\\-- --'],
    ['<p>a<br><span>--</span> --</p>', 5, 'a  \n\\-- --'],
  ] as const)('keeps the marker on the escaped line: %s', async (html, wrapWidth, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, wrapWidth })).toBe(expected)
    for (let i = 1; i < html.length; i++) {
      const streamed = await collect(streamHtmlToMarkdown(chunkedStream([html.slice(0, i), html.slice(i)]), { engine, wrapWidth }))
      expect(streamed, `split at ${i}`).toBe(expected)
    }
  })
})

describe.each(engines)('wrapped setext markers before a decoded line ending $name', (engineConfig) => {
  it.each([
    ['<p>aaaaaaaaaa ===&#10;foo</p>', 'aaaaaaaaaa ===\nfoo'],
    ['<p>aaaaaaaaaa ===&#13;foo</p>', 'aaaaaaaaaa ===\rfoo'],
    ['<p>aaaaaaaaaa ---&#10;foo</p>', 'aaaaaaaaaa ---\nfoo'],
    ['<p>aaaaaaaaaa ---&#13;foo</p>', 'aaaaaaaaaa ---\rfoo'],
    ['<p>aaaaaaaaaa ===&#9;&#10;foo</p>', 'aaaaaaaaaa ===\t\nfoo'],
    ['<p>aaaaaaaaaa ---&#9;&#13;foo</p>', 'aaaaaaaaaa ---\t\rfoo'],
    ['<p>aaaaaaaaaa -&#9;-&#9;-</p>', 'aaaaaaaaaa -\t-\t-'],
    ['<p>aaaaaaaaaa ===&#9;foo</p>', 'aaaaaaaaaa\n===\tfoo'],
    ['<p>aaaaaaaaaa ==x&#10;foo</p>', 'aaaaaaaaaa\n==x\nfoo'],
  ])('breaks only before a word that is no marker line: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, wrapWidth: 10 })).toBe(expected)
    for (let i = 1; i < html.length; i++) {
      const streamed = await collect(streamHtmlToMarkdown(chunkedStream([html.slice(0, i), html.slice(i)]), { engine, wrapWidth: 10 }))
      expect(streamed, `split at ${i}`).toBe(expected)
    }
  })
})

describe.each(engines)('block markers after a decoded bare CR $name', (engineConfig) => {
  it.each([
    ['<p>abc&#13;===</p>', 'abc\r\\==='],
    ['<p>abc&#13;---</p>', 'abc\r\\---'],
    ['<p>abc&#13;# x</p>', 'abc\r\\# x'],
    ['<p>abc&#13;- x</p>', 'abc\r\\- x'],
    ['<p>abc&#13;1. x</p>', 'abc\r1\\. x'],
    ['<p>abc&#13;<span>===</span></p>', 'abc\r\\==='],
    ['<p><span>abc&#13;</span>===</p>', 'abc\r\\==='],
    ['<p>abc&#13;=SUM(A1)</p>', 'abc\r=SUM(A1)'],
    ['<p>abc&#13;x === y</p>', 'abc\rx === y'],
    ['<b>a&#13;<ul><li># heading</li></ul></b>', '**a\r - \\# heading**'],
    ['<b>a&#13;<ol><li># heading</li></ol></b>', '**a\r 1. \\# heading**'],
    ['<a href="/x">a&#13;<ul><li># heading</li></ul></a>', '[a\r - \\# heading](/x)'],
    ['<b>a&#13;<ul><li>- x</li></ul></b>', '**a\r - \\- x**'],
    ['<b>a&#13;<ul><li>1. x</li></ul></b>', '**a\r - 1\\. x**'],
    ['<b>a&#13;<ul><li>===</li></ul></b>', '**a\r - \\===**'],
    ['<b>a&#13;<ul><li>&gt; x</li></ul></b>', '**a\r - \\> x**'],
    ['<b>a&#13;<ul><li><table><tr><th>x</th></tr><tr><td>1</td></tr></table></li></ul></b>', '**a\r - | x |\n  | --- |\n  | 1 |**'],
    ['<b>a&#13;<ul><li><pre>x</pre></li></ul></b>', '**a\r - ```\n  x\n  ```\n\n  **'],
    ['<small>a&#13;<ul><li># heading</li></ul></small>', 'a\r - \\# heading'],
    ['<small>a&#13;<ol><li># heading</li></ol></small>', 'a\r 1. \\# heading'],
    ['<small>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&#13;<ul><li><table><tr><th>x</th></tr><tr><td>1</td></tr></table></li></ul></small>', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\r - | x |\n  | --- |\n  | 1 |'],
    ['<small>|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&#13;<ul><li><table><tr><th>x</th></tr><tr><td>1</td></tr></table></li></ul></small>', '|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\r - | x |\n  | --- |\n  | 1 |'],
    ['<b>a<ul><li># heading</li></ul></b>', '**a - # heading**'],
  ])('escapes like after a newline: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    for (let i = 1; i < html.length; i++) {
      const streamed = await collect(streamHtmlToMarkdown(chunkedStream([html.slice(0, i), html.slice(i)]), { engine }))
      expect(streamed, `split at ${i}`).toBe(expected)
    }
  })
})
