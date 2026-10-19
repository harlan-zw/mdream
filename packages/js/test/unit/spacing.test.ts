import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { createPlugin, htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { filterPlugin } from '../../src/plugins/filter'
import { tailwindPlugin } from '../../src/plugins/tailwind'

async function streamConvert(chunks: string[], options?: Parameters<typeof streamHtmlToMarkdown>[1]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream, options))
    output += chunk
  return output
}

describe('inline whitespace', () => {
  it('preserves whitespace between root-level inline siblings', () => {
    expect(htmlToMarkdown('<span>One</span> <span>Two</span>')).toBe('One Two')
    expect(htmlToMarkdown('<strong>One</strong>\n<strong>Two</strong>')).toBe('**One** **Two**')
    expect(htmlToMarkdown('<span>One</span> </bogus> <span>Two</span>')).toBe('One Two')
    expect(htmlToMarkdown('  <span>One</span>  ')).toBe('One')
    expect(htmlToMarkdown('<div>One</div> <div>Two</div>')).toBe('One\n\nTwo')
  })

  it('moves trailing whitespace outside inline delimiters', () => {
    expect(htmlToMarkdown('<div><strong><a href="http://xxx.yyy/">abc</a> </strong>def</div>'))
      .toBe('**[abc](http://xxx.yyy/)** def')
    expect(htmlToMarkdown('<p><strong><em>abc </em></strong>def</p>'))
      .toBe('***abc*** def')
  })

  it('preserves the separator when a closing tag is split across chunks', async () => {
    const html = '<div><strong><a href="http://xxx.yyy/">abc</a> </strong>def</div>'
    for (let split = 0; split <= html.length; split++) {
      const output = await streamConvert([html.slice(0, split), html.slice(split)])
      expect(output.trimEnd(), `split at byte ${split}`).toBe('**[abc](http://xxx.yyy/)** def')
    }
  })

  it('keeps the space after removed content outside the opening delimiter', async () => {
    const expected = 'Install. **Warning:** read'
    for (const html of [
      '<p>Install. <strong><svg><path d="M0"/></svg> Warning:</strong> read</p>',
      '<p>Install. <strong><script>x</script> Warning:</strong> read</p>',
      '<p>Install. <strong><span></span> Warning:</strong> read</p>',
      // With nothing to merge into, the space moves in front of the delimiter.
      '<p>Install.<strong><svg></svg> Warning:</strong> read</p>',
      '<p>Install.<strong> Warning:</strong> read</p>',
    ]) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let split = 0; split <= html.length; split++) {
        const output = await streamConvert([html.slice(0, split), html.slice(split)])
        expect(output.trimEnd(), `${html} split at byte ${split}`).toBe(expected)
      }
    }
    expect(htmlToMarkdown('<p>Install. <strong><span hidden>!</span> Warning:</strong> read</p>', { plugins: [filterPlugin()] }))
      .toBe(expected)
    expect(htmlToMarkdown('<p>Install. <em><svg></svg> Warning:</em> read</p>')).toBe('Install. *Warning:* read')
    expect(htmlToMarkdown('<p>a <strong><svg></svg></strong> b</p>')).toBe(htmlToMarkdown('<p>a <strong></strong> b</p>'))
  })

  it('keeps the moved space out of the start of link text', async () => {
    const cases: [string, string][] = [
      ['<p><a href="/x"><strong><svg></svg> now</strong></a></p>', '[**now**](/x)'],
      ['<p>Go<a href="/x"><strong> now</strong></a></p>', 'Go [**now**](/x)'],
      // Nothing else parts the words, so the space stays after the bracket.
      ['<p><em>x</em><a href="/x"><strong> now</strong></a></p>', '*x*[ **now**](/x)'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let split = 0; split <= html.length; split++) {
        const output = await streamConvert([html.slice(0, split), html.slice(split)])
        expect(output.trimEnd(), `${html} split at byte ${split}`).toBe(expected)
      }
    }
  })

  it('keeps the word separator when emphasis starts with a blank', async () => {
    const cases: [string, string][] = [
      ['<p>a<strong> <span>b</span></strong></p>', 'a **b**'],
      ['<p>a<strong> </strong>b</p>', 'a b'],
      ['<p>a<em> <span>b</span></em></p>', 'a *b*'],
      ['<p>a<b>\n<span>b</span></b></p>', 'a **b**'],
      ['<p>a<i>\t <span>b</span></i></p>', 'a *b*'],
      ['<p>a<strong> <svg></svg>b</strong></p>', 'a **b**'],
      ['<p>a<strong> <em>b</em></strong></p>', 'a ***b***'],
      ['<p><em>x</em><strong> <span>b</span></strong></p>', '*x* **b**'],
      // Already parted, or at the start of the line: nothing to add.
      ['<p>a <strong> <span>b</span></strong></p>', 'a **b**'],
      ['<p><strong> <span>b</span></strong></p>', '**b**'],
      ['<p>a<br><strong> <span>b</span></strong></p>', 'a  \n**b**'],
      // An empty pair owes its separator to what follows it, once.
      ['<p>a<strong> </strong> b</p>', 'a b'],
      ['<p>a<em> </em><strong> </strong>b</p>', 'a b'],
      ['<p>a<strong> </strong><em></em> b</p>', 'a b'],
      ['<p><a href="/x"><span>x</span><strong> </strong><em></em></a></p>', '[x](/x)'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
    expect(htmlToMarkdown('<p>x<em><span hidden>h</span> </em>y</p>', { plugins: [filterPlugin()] })).toBe('x y')
    expect(htmlToMarkdown('<ul><li>a<strong> <span>b</span></strong></li></ul>')).toBe('- a **b**')
    expect(htmlToMarkdown('<h2>a<strong> </strong>b</h2>')).toBe('## a b')
    expect(htmlToMarkdown('<p><a href="/x">a<strong> <span>b</span></strong></a></p>')).toBe('[a **b**](/x)')
  })

  it('places a blank kept inside emphasis without writing it as text', async () => {
    const cases: [string, string][] = [
      // Elements that write nothing sit between the opener and the blank.
      ['<p>Click<strong><span class="w"> <a href="/x">here</a></span></strong> now</p>', 'Click **[here](/x)** now'],
      ['<p>a<strong><span> <span>b</span></span></strong></p>', 'a **b**'],
      ['<p>a<strong><span> </span></strong>b</p>', 'a b'],
      ['<p>a<em><span> <strong>b</strong></span></em></p>', 'a ***b***'],
      // An emptied quote around the moved separator is dropped with it.
      ['<p>a<q><em> </em></q>b</p>', 'a b'],
      ['<p>a<strong><q><em> </em></q>c</strong>b</p>', 'a **c**b'],
      ['<p>a<strong><q><em> </em></q><em>c</em></strong>b</p>', 'a ***c***b'],
      // With no opener to part, it is owed to later text: a line break or the
      // end of the block drops it, later text that brings its own space needs
      // no other, and code keeps its content as written.
      ['<p><i>x<i> <svg></svg></i></i></p>', '*x*'],
      ['<p><i>a<i> <svg></svg> x</i></i></p>', '*a x*'],
      ['<p>x<b>y<b> <strong></strong><br>z</b></b></p>', 'x**y  \nz**'],
      ['<p><code>a<del> </del></code>z</p>', '`a `z'],
      ['<p><code>a<strong> <svg></svg> b</strong></code></p>', '`a** b**`'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
    const noStrongDelimiters = { tagOverrides: { strong: { enter: '', exit: '' } } }
    expect(htmlToMarkdown('<p>a<strong> <svg></svg> b</strong></p>', noStrongDelimiters)).toBe('a b')
    expect(htmlToMarkdown('a<strong> <svg></svg> b</strong>', noStrongDelimiters)).toBe('a b')
    expect(htmlToMarkdown('<p>a<b>x<b> <a href="#"></a></b></b></p>', { clean: clean() })).toBe('a**x**')
    expect(htmlToMarkdown('<p><i>x<i> <a href="#"></a></i></i>z</p>', { clean: clean() })).toBe('*x* z')
  })

  it('keeps the word separator when an inline wrapper starts with a blank', async () => {
    const cases: [string, string][] = [
      ['<p>a<span> <span>b</span></span></p>', 'a b'],
      ['<p>a<span> <strong>b</strong></span></p>', 'a **b**'],
      ['<p>a<font> <b>x</b></font></p>', 'a **x**'],
      ['<p>a<label> <span>b</span></label></p>', 'a b'],
      ['<p>a<abbr> <span>b</span></abbr></p>', 'a b'],
      ['<p>a<small> <span>b</span></small></p>', 'a b'],
      ['<p>a<u> <span>b</span></u></p>', 'a<u> b</u>'],
      ['<p>a<span><span> <span>b</span></span></span></p>', 'a b'],
      ['<p>a<font><small> <label><b>x</b></label></small></font></p>', 'a **x**'],
      ['<p>a<span>\n  <span>b</span></span>c</p>', 'a bc'],
      ['<p>a<span> </span>b</p>', 'a b'],
      ['<p>a<span> <strong></strong></span>b</p>', 'a b'],
      ['<p>a<strong>x<span> <span>b</span></span></strong></p>', 'a**x b**'],
      ['<p><strong>a<span> </span></strong>b</p>', '**a** b'],
      ['<p>a<span> <img src="/i.png" alt="i"></span></p>', 'a ![i](/i.png)'],
      // Already parted, or at the start of the line: nothing to add.
      ['<p>a <span> <span>b</span></span></p>', 'a b'],
      ['<p><span> <strong>b</strong></span></p>', '**b**'],
      ['<p>a<br><span> <span>b</span></span></p>', 'a  \nb'],
      ['<p>a<span> </span></p>', 'a'],
      // A link or quote opener already parts it from a word, and code keeps
      // its content as written.
      ['<p>a<a href="/x"> <span>b</span></a></p>', 'a [b](/x)'],
      ['<p>a<q> <span>b</span></q></p>', 'a "b"'],
      ['<p>a<code> <span>b</span></code></p>', 'a`b`'],
      ['<p><code>a<span> <span>b</span></span></code></p>', '`ab`'],
      // A raw line break ends the line the separator would trail.
      ['<h2>w<span> <br>b</span></h2>', '## w<br>b'],
      ['<h2>w<strong>a </strong><br>b</h2>', '## w**a**<br>b'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
    expect(htmlToMarkdown('<ul><li>a<span> <span>b</span></span></li></ul>')).toBe('- a b')
    expect(htmlToMarkdown('<h2>a<span> <span>b</span></span></h2>')).toBe('## a b')
    expect(htmlToMarkdown('<blockquote><p>a<span> <span>b</span></span></p></blockquote>')).toBe('> a b')
    expect(htmlToMarkdown('<table><tr><th>h</th></tr><tr><td>a<span> <span>b</span></span></td></tr></table>')).toBe('| h |\n| --- |\n| a b |')
    expect(htmlToMarkdown('a<span> <span>b</span></span>')).toBe('a b')
  })

  it('writes an owed separator before the text it parts', async () => {
    const tailwind = () => ({ plugins: [tailwindPlugin()] })
    const cases: [string, string, Parameters<typeof htmlToMarkdown>[1]][] = [
      // A line break may not take its place and set the text at a line start.
      ['<p>aaaa<span> <span>1. b</span></span></p>', 'aaaa 1.\nb', { wrapWidth: 6 }],
      ['<p>aaaa<span>x </span><span>1. b</span></p>', 'aaaax 1.\nb', { wrapWidth: 6 }],
      ['<p>aaaa<span> <span>- b</span></span></p>', 'aaaa -\nb', { wrapWidth: 6 }],
      ['<p>aaaaaa<span> <span>b</span></span></p>', 'aaaaaa b', { wrapWidth: 6 }],
      ['<ul><li>aaaa<span> <span>1. b</span></span></li></ul>', '- aaaa 1.\n  b', { wrapWidth: 8 }],
      [
        '<p><a href="https://example.com/docs/getting-started/installation/index.html">Read the docs</a><span> <span>1. Install the CLI</span></span></p>',
        '[Read the docs](https://example.com/docs/getting-started/installation/index.html) 1.\nInstall the CLI',
        { wrapWidth: 80 },
      ],
      // Delimiters a plugin generates around the text stay tight around it.
      ['<p>Read<label> <span class="font-bold">new</span></label> now</p>', 'Read **new** now', tailwind()],
      ['<p>Price<span>: </span><span class="font-bold">$5</span></p>', 'Price: **$5**', tailwind()],
      ['<p>a<span> <span class="italic">b</span></span>c</p>', 'a *b*c', tailwind()],
      ['<ol><li>-<span class="font-bold"> <span> </span>b</span> z</li></ol>', '1. \\- **b** z', tailwind()],
      ['<p>aaaa<span> <span class="font-bold">bb cc</span></span></p>', 'aaaa **bb\ncc**', { ...tailwind(), wrapWidth: 8 }],
    ]
    for (const [html, expected, options] of cases) {
      expect(htmlToMarkdown(html, options), html).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks, options), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
  })

  it('leaves code-like content as written', () => {
    expect(htmlToMarkdown('<p><kbd>a<strong> x</strong></kbd></p>')).toBe('`a** x**`')
    expect(htmlToMarkdown('<p><samp>a<em> x</em></samp></p>')).toBe('`a* x*`')
    expect(htmlToMarkdown('<p><var>a<b><svg></svg> x</b></var></p>')).toBe('`a** x**`')
    expect(htmlToMarkdown('<p><code>a<strong> x</strong></code></p>')).toBe('`a** x**`')
  })
})

describe('block element followed by inline sibling (#148)', () => {
  it.each(['```', '~~~'])('keeps normal block spacing for plugin output ending in %s', async (marker) => {
    const html = '<p>x<br></p><span>after</span>'
    const options = {
      plugins: [createPlugin({
        onNodeExit(node) {
          if (node.name === 'p')
            return marker
        },
      })],
    }
    const expected = `x  \n${marker}\nafter`
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let split = 1; split < html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `split at ${split}`).toBe(expected)
    }
  })

  it('closes a trailing-blank <pre> fence before an inline link', () => {
    expect(htmlToMarkdown('<div><pre>a\nb\n\n</pre><a href="#x">link</a></div>'))
      .toBe('```\na\nb\n\n\n```\n\n[link](#x)')
  })

  it('does not glue the closing fence to a pilcrow link (xml2rfc case)', () => {
    const out = htmlToMarkdown('<div><pre>GET /hello.txt HTTP/1.1\n\n</pre><a href="#s" class="pilcrow">P</a></div>')
    expect(out).toContain('```\n\n[P](#s)')
  })

  it('separates a trailing-blank <pre> from following text', () => {
    expect(htmlToMarkdown('<div><pre>a\nb\n\n</pre>after</div>'))
      .toBe('```\na\nb\n\n\n```\n\nafter')
  })

  it('matches across every streaming chunk boundary', async () => {
    const html = '<div><pre>a\nb\n\n</pre><a href="#x">link</a></div>'
    const expected = htmlToMarkdown(html)
    for (let split = 0; split <= html.length; split++) {
      const output = await streamConvert([html.slice(0, split), html.slice(split)])
      expect(output.trimEnd(), `split at byte ${split}`).toBe(expected)
    }
  })
})

describe('unknown tags', () => {
  // Unknown elements are inline, as in the Rust engine: adjacent ones must not
  // gain a space between them.
  it('keeps adjacent unknown elements joined', async () => {
    const cases: [string, string][] = [
      ['<x-a>X</x-a><x-h>H</x-h><x-c>C</x-c>', 'XHC'],
      ['<p><foo>X</foo><bar>H</bar><baz>C</baz></p>', 'XHC'],
      ['<p>before <ex>foo</ex> after</p>', 'before foo after'],
      ['<p><ex>foo</ex>, bar</p>', 'foo, bar'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html), html).toBe(expected)
      expect(await streamConvert([html]), html).toBe(expected)
    }
  })
})
