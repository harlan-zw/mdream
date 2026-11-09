import type { ElementNode, MdreamOptions, TextNode } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { createPlugin, htmlToMarkdown, NodeEventEnter, streamHtmlToMarkdown, TEXT_NODE } from '../../src/index'
import { frontmatterPlugin } from '../../src/plugins/frontmatter'
import { tailwindPlugin } from '../../src/plugins/tailwind'

async function streamConvert(
  html: string,
  chunkSize: number,
  options: Partial<MdreamOptions> = {},
): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (let index = 0; index < html.length; index += chunkSize)
        controller.enqueue(html.slice(index, index + chunkSize))
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream, options))
    output += chunk
  return output
}

describe('gfm text escaping', () => {
  it.each([
    ['<p># heading</p>', '\\# heading'],
    ['<p>#</p>', '\\#'],
    ['<p>- item</p>', '\\- item'],
    ['<p>-</p>', '\\-'],
    ['<p>> quote</p>', '\\> quote'],
    ['<p>1. item</p>', '1\\. item'],
    ['<p>---</p>', '\\---'],
    ['<p>[label](url)</p>', '\\[label](url)'],
    ['<p>foo *bar* ~~baz~~ `qux`</p>', 'foo \\*bar\\* \\~\\~baz\\~\\~ \\`qux\\`'],
    ['<p>&#35; heading</p>', '\\# heading'],
    ['<p>&amp;copy;</p>', '\\&copy;'],
  ])('preserves literal text for %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it('only escapes syntax where plain text could activate it', () => {
    expect(htmlToMarkdown('<h2># Heading #</h2><p>#hashtag</p><p>Just a - dash</p>'))
      .toBe('## # Heading \\#\n\n#hashtag\n\nJust a - dash')
  })

  it('escapes syntax introduced by entity decoding', () => {
    expect(htmlToMarkdown('<p>&#42;x&#42;</p><p>foo&#10;# heading</p>'))
      .toBe('\\*x\\*\n\nfoo\n\\# heading')
  })

  it('escapes text replaced or mutated by plugins', async () => {
    const replaceText = createPlugin({
      processTextNode: () => ({
        content: '# plugin *text*',
        skip: false,
      }),
    })
    const mutateText = createPlugin({
      beforeNodeProcess(event) {
        if (event.type === NodeEventEnter && event.node.type === TEXT_NODE)
          (event.node as TextNode).value = '1. plugin item'
      },
    })

    expect(htmlToMarkdown('<p>safe</p>', { plugins: [replaceText] }))
      .toBe('\\# plugin \\*text\\*')
    expect(htmlToMarkdown('<p>safe</p>', { plugins: [mutateText] }))
      .toBe('1\\. plugin item')
    expect(await streamConvert('<p>safe</p>', 1, { plugins: [replaceText] }))
      .toBe('\\# plugin \\*text\\*')
  })

  it('detects block markers after generated output fragments', () => {
    expect(htmlToMarkdown('<p>before<br><span># heading</span></p>'))
      .toBe('before  \n\\# heading')
    expect(htmlToMarkdown('<p>before<br><span>1. item</span></p>'))
      .toBe('before  \n1\\. item')
  })

  it('handles terminal trigger characters safely', () => {
    expect(htmlToMarkdown('<p>&lt;</p><p>[</p><p>1</p>'))
      .toBe('<\n\n\\[\n\n1')
  })

  it('keeps generated markers and code content verbatim', () => {
    const html = '<p><strong>bold</strong> <del>gone</del> <code>*raw*</code></p><pre><code># raw</code></pre>'
    expect(htmlToMarkdown(html)).toBe('**bold** ~~gone~~ `*raw*`\n\n```\n# raw\n```')
  })

  it('widens code delimiters instead of backslash escaping code content', () => {
    expect(htmlToMarkdown('<code>a `b` c</code>')).toBe('``a `b` c``')
    expect(htmlToMarkdown('<code>`edge`</code>')).toBe('`` `edge` ``')
    expect(htmlToMarkdown('<pre><code>Contains ```triple``` inside.</code></pre>'))
      .toBe('```\nContains ```triple``` inside.\n```')
    expect(htmlToMarkdown('<pre><code>before\n```line-leading\n````\nafter</code></pre>'))
      .toBe('`````\nbefore\n```line-leading\n````\nafter\n`````')
    expect(htmlToMarkdown('<pre>before\n```\nafter</pre>'))
      .toBe('````\nbefore\n```\nafter\n````')
    expect(htmlToMarkdown('<pre><code class="language-js`x">~~~\ncode</code></pre>'))
      .toBe('```\n~~~\ncode\n```')
    expect(htmlToMarkdown('<div><pre class="language-js`x">a\nb\n\n</pre><a href="#x">link</a></div>'))
      .toBe('```\na\nb\n\n\n```\n\n[link](#x)')
  })

  it.each([
    ['<pre><h2>x #</h2></pre>', '```\n\n## x #\n\n\n```'],
    ['<pre><h2>x ##</h2></pre>', '```\n\n## x ##\n\n\n```'],
    ['<pre><h1>#</h1></pre>', '```\n\n# #\n\n\n```'],
    ['<pre><code><h2>x #</h2></code></pre>', '```\n## x #\n```'],
    ['<pre><h2>x <b>#</b></h2></pre>', '```\n\n## x #\n\n\n```'],
    ['<ul><li><pre><h2>x #</h2></pre></li></ul>', '- ```\n  ## x #\n  ```'],
    ['<blockquote><pre><h2>x #</h2></pre></blockquote>', '> ```\n>\n> ## x #\n>\n>\n> ```'],
  ])('keeps a heading\'s closing hashes literal in a code block for %s', async (html, expected) => {
    // Nothing in a fenced code block is parsed, so a backslash would show as code.
    expect(htmlToMarkdown(html)).toBe(expected)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(html, chunkSize), `chunk size ${chunkSize}`).toBe(expected)
  })

  it.each<[string, string, string, Partial<MdreamOptions>]>([
    ['a <pre> glued to inline text', '<span>a<pre><h2>x #</h2></pre></span>', 'a```\n\n## x \\#\n\n\n```', {}],
    ['a fence closed onto inline text', '<span><pre>x</pre>b</span><pre><h2>x #</h2></pre>', '```\nx\n``` b\n\n```\n\n## x \\#\n\n\n```', {}],
    ['a fence opened after emphasis', '<em>a<pre>x</pre></em><pre><h2>x #</h2></pre>', '*a```\nx\n```*\n\n```\n\n## x \\#\n\n\n```', {}],
    ['a literal tag override', '<pre><h2>x #</h2></pre>', '```\n\n## x \\#\n\n\n```', { tagOverrides: { sup: { enter: '^', exit: '^' } } }],
    ['a literal <pre> override', '<pre><h2>x #</h2></pre>', '## x \\#', { tagOverrides: { pre: { enter: '', exit: '' } } }],
  ])('keeps the closing-hash escape after %s', async (_, html, expected, options) => {
    // A parser may not read these fences as written, which can leave the heading a heading.
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(html, chunkSize, options), `chunk size ${chunkSize}`).toBe(expected)
  })

  it.each([
    ['<pre><code><h4>x y </h4><pre><i>z</i></pre></code></pre>', '```\n#### x y z\n```'],
    ['<pre><code><h4>x y   </h4><pre><i>z</i></pre></code></pre>', '```\n#### x y   z\n```'],
    ['<pre><code><h4>x # </h4><pre><i>z</i></pre></code></pre>', '```\n#### x # z\n```'],
    ['<pre><code><blockquote><h4>&nbsp;x # </h4><pre><i>z</i></pre></blockquote></code></pre>', '```\n> ####  x # z\n```'],
    ['<pre><code><blockquote><h4>x y </h4><pre><i>z</i></pre></blockquote></code></pre>', '```\n> #### x y z\n```'],
    ['<pre><code><ul><li>x y <pre><i>z</i></pre></li></ul></code></pre>', '```\n- x y z\n```'],
    ['<pre><code><ul><li><h4>x # </h4><pre><b>z</b></pre></li></ul></code></pre>', '```\n- #### x # z\n```'],
    ['<pre><code><h4>&nbsp;x y&nbsp; </h4><pre><span>z</span></pre></code></pre>', '```\n####  x y  z\n```'],
    ['<pre><code>x y <pre><code>z</code></pre></code></pre>', '```\nx y z\n```'],
    ['<span>a <pre>x</pre></span>', 'a```\nx\n```'],
  ])('keeps the whitespace before a nested <pre> in the code for %s', async (html, expected) => {
    // A <pre> in another one enters inside that one's code block; outside the
    // code, the space before a <pre> still goes.
    expect(htmlToMarkdown(html)).toBe(expected)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(html, chunkSize), `chunk size ${chunkSize}`).toBe(expected)
  })

  const blockBreakCases = [['\t', '\t'], ['&#9;', '\t'], ['&#13;', '\r'], ['&#12;', '\f']].flatMap(([ws, kept]) =>
    [['<span>', '</span>'], ['', '']].flatMap(([open, close]) => ['p', 'h4'].flatMap(block => [
      '<table><tr><td>x</td></tr></table>',
      '<figure><figcaption>x</figcaption></figure>',
      '<hr>',
      '<ul><li>x</li></ul>',
      '<ol><li>x</li></ol>',
    ].map(next => [`${open}<pre><${block}>a b${ws}</${block}>${next}</pre>${close}`, `a b${kept}`]))))

  it.each(blockBreakCases)('keeps the whitespace before a block break in code for %j', async (html, kept) => {
    // In a <pre> an inline wraps, a child block's exit writes a line break after
    // its text; the tab, CR or form feed before it is code.
    const out = htmlToMarkdown(html)
    expect(out).toContain(kept)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(html, chunkSize), `chunk size ${chunkSize}`).toBe(out)
  })

  it('keeps the tab before a table in a <pre> an inline wraps', () => {
    expect(htmlToMarkdown('<span><pre><p>a b\t</p><table><tr><td>x</td></tr></table></pre></span>'))
      .toBe('```\n\na b\t\n\n| x |\n| --- |\n```')
  })

  it('does not double escape parser-protected link and table text', () => {
    expect(htmlToMarkdown('<a href="/x">a[b] *c*</a>'))
      .toBe('[a\\[b\\] \\*c\\*](/x)')
    expect(htmlToMarkdown('<table><tr><td>a|b</td></tr></table>'))
      .toBe('| a\\|b |\n| --- |')
  })

  it('rejects malformed or out-of-range colspan', () => {
    expect(htmlToMarkdown('<table><tr><th colspan="2x">h</th></tr><tr><td>a</td><td>b</td></tr></table>'))
      .toBe('| h |\n| --- |\n| a b |')
    expect(htmlToMarkdown('<table><tr><th colspan="300">h</th></tr><tr><td>a</td><td>b</td></tr></table>'))
      .toBe('| h |\n| --- |\n| a b |')
  })

  it('keeps content after a list item rule in a separate block', () => {
    expect(htmlToMarkdown('<ul><li>text <hr>after</li></ul>'))
      .toBe('- text\n\n  ---\n\n  after')
    expect(htmlToMarkdown('<ul><li><blockquote>text<hr></blockquote>after</li></ul>'))
      .toBe('- \n  > text\n  >\n  > ---\n\n  after')
  })

  it('keeps a nested list structured inside a span', () => {
    expect(htmlToMarkdown('<ol><li><span>parent<ul><li>child</li><li>child 2</li></ul></span></li></ol>'))
      .toBe('1. parent\n   - child\n   - child 2')
  })

  it('serializes decoded text for its output context', () => {
    expect(htmlToMarkdown('<a href="/safe">x&#93;(/evil) [y</a>'))
      .toBe('[x\\](/evil) \\[y](/safe)')
    expect(htmlToMarkdown('<table><tr><td>a&#124;b</td><td>c&#10;d</td></tr></table>'))
      .toBe('| a\\|b | c&#10;d |\n| --- | --- |')

    const details = htmlToMarkdown('<details><summary>&lt;img src=x onerror=alert(1)&gt;</summary></details>')
    expect(details).toContain('<summary>&lt;img src=x onerror=alert(1)&gt;</summary>')
    expect(htmlToMarkdown('<details><summary><code>&lt;img src=x onerror=alert(1)&gt;</code></summary></details>'))
      .toContain('<code>&lt;img src=x onerror=alert(1)&gt;</code>')
    expect(htmlToMarkdown('<details><a href="/x">a[b]</a></details>'))
      .toContain('<a href="/x">a&#91;b&#93;</a>')
    expect(htmlToMarkdown('<details><a href="/x">&#92;&#91;</a></details>'))
      .toContain('<a href="/x">\\&#91;</a>')
    expect(htmlToMarkdown('<details><table><tr><td><pre>a|b&#124;c</pre></td><td>x</td></tr></table></details>'))
      .toContain('| <pre>a&#124;b&#124;c</pre> | x |')
    expect(htmlToMarkdown('<table><tr><td><pre>a|b&#124;c</pre></td><td>x</td></tr></table>'))
      .toBe('| <pre>a&#124;b&#124;c</pre> | x |\n| --- | --- |')
  })

  it('matches one-shot output across stream boundaries', async () => {
    for (const html of [
      '<p>&#35; heading [label](url) and *bar* ~~baz~~ `qux` &amp;copy;</p><p>> quote</p><p>1. item</p><p>---</p>',
      '<a href="/safe">x&#93;(/evil) [y</a>',
      '<table><tr><td>a&#124;b</td><td>c&#10;d</td></tr></table>',
      '<details><summary>&lt;img src=x onerror=alert(1)&gt;</summary></details>',
      '<details><summary><code>&lt;img src=x onerror=alert(1)&gt;</code></summary></details>',
      '<details><a href="/x">a[b]</a></details>',
      '<details><a href="/x">&#92;&#91;</a></details>',
      '<details><table><tr><td><pre>a|b&#124;c</pre></td><td>x</td></tr></table></details>',
      '<table><tr><td><pre>a|b&#124;c</pre></td><td>x</td></tr></table>',
    ]) {
      const expected = htmlToMarkdown(html)
      for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
        expect(await streamConvert(html, chunkSize), `${html}: chunk size ${chunkSize}`).toBe(expected)
    }
  })

  it('widens code delimiters across every stream boundary', async () => {
    for (const html of [
      '<p>before <code>a `b` c</code> after</p>',
      '<pre><code>before\n```line-leading\n````\nafter</code></pre>',
    ]) {
      const expected = htmlToMarkdown(html)
      for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
        expect(await streamConvert(html, chunkSize), `chunk size ${chunkSize}`).toBe(expected)
    }
  })
})

describe('heading fence reliability', () => {
  it.each(['', ' ', '\n', '<code></code>'])('marks inline pre only when emitting a fence: %j', async (body) => {
    const html = `<span><pre>${body}</pre></span><pre><h2>x #</h2></pre>`
    const expected = htmlToMarkdown(html)
    expect(expected).toContain(body.includes('code') ? '## x \\#' : '## x #')
    for (let size = 1; size <= html.length; size++)
      expect(await streamConvert(html, size)).toBe(expected)
  })

  it.each(['```', '~~~', '````', 'prefix```suffix', 'prefix~~~suffix', '`', '~', 'note'])('tracks raw plugin fences: %s', async (marker) => {
    for (const hook of ['onNodeEnter', 'onNodeExit'] as const) {
      const options = { plugins: [createPlugin({ [hook]: (node: ElementNode) => node.name === 'div' ? `${marker}\n` : undefined })] }
      const html = '<div>a</div><pre><h2>x #</h2></pre>'
      const expected = htmlToMarkdown(html, options)
      expect(expected).toContain(marker === 'note' ? '## x #' : '## x \\#')
      for (let size = 1; size <= html.length; size++)
        expect(await streamConvert(html, size, options)).toBe(expected)
    }
  })

  it('keeps reliable fences with frontmatter', () => {
    expect(htmlToMarkdown('<head><title>Title</title></head><pre><h2>x #</h2></pre>', { plugins: [frontmatterPlugin()] })).toContain('## x #')
  })

  it('tracks a fence split across plugin fragments and events', async () => {
    const cases: [string, Partial<MdreamOptions>][] = [
      ['<div>a</div><pre><h2>x #</h2></pre>', { plugins: [
        createPlugin({ onNodeEnter: (node: ElementNode) => node.name === 'div' ? '`' : undefined }),
        createPlugin({ onNodeEnter: (node: ElementNode) => node.name === 'div' ? '``\n' : undefined }),
      ] }],
      ['<x-a></x-a><x-b></x-b>a<pre><h2>x #</h2></pre>', { plugins: [
        createPlugin({ onNodeEnter: (node: ElementNode) => node.name === 'x-a' ? '`' : node.name === 'x-b' ? '``\n' : undefined }),
      ] }],
    ]
    for (const [html, options] of cases) {
      const expected = htmlToMarkdown(html, options)
      expect(expected).toContain('## x \\#')
      for (let size = 1; size <= html.length; size++)
        expect(await streamConvert(html, size, options)).toBe(expected)
    }
  })

  it.each(['```\n', '`', '~~~\n', '~~'])('tracks fences in generated text delimiters: %j', async (prefix) => {
    const options = { plugins: [createPlugin({ processTextNode(node: TextNode) {
      if (node.value === 'a')
        node.generatedMarkdown = { prefix, suffix: '' }
      return undefined
    } })] }
    const html = '<div>a</div><pre><h2>x #</h2></pre>'
    const expected = htmlToMarkdown(html, options)
    expect(expected).toContain(prefix === '~~' ? '## x #' : '## x \\#')
    for (let size = 1; size <= html.length; size++)
      expect(await streamConvert(html, size, options)).toBe(expected)
  })

  it.each([
    ['<pre><div>a</div><h2>x #</h2></pre>', '~\n'],
    ['<pre><div>a</div><h2>x #</h2></pre>', '```\n'],
    ['<pre><code><div>a</div><h2>x #</h2></code></pre>', '~\n'],
  ])('keeps reliable fences for plugin output inside an open fence: %s %j', async (html, marker) => {
    const options = { plugins: [createPlugin({ onNodeEnter: (node: ElementNode) => node.name === 'div' ? marker : undefined })] }
    const expected = htmlToMarkdown(html, options)
    expect(expected).toContain('## x #')
    for (let size = 1; size <= html.length; size++)
      expect(await streamConvert(html, size, options)).toBe(expected)
  })

  it.each(['`', '```\n'])('keeps reliable fences for generated delimiters inside an open fence: %j', async (prefix) => {
    const options = { plugins: [createPlugin({ processTextNode(node: TextNode) {
      if (node.value === 'a')
        node.generatedMarkdown = { prefix, suffix: '' }
      return undefined
    } })] }
    const html = '<pre><span>a</span><h2>x #</h2></pre>'
    const expected = htmlToMarkdown(html, options)
    expect(expected).toContain('## x #')
    for (let size = 1; size <= html.length; size++)
      expect(await streamConvert(html, size, options)).toBe(expected)
  })

  it('sizes code fences past runs after a CR', async () => {
    expect(htmlToMarkdown('<pre>a&#13;```&#13;b</pre><p>c</p>')).toBe('````\na\r```\rb\n````\n\nc')
    const plugin = { plugins: [createPlugin({ onNodeEnter: (node: ElementNode) => node.name === 'div' ? '\r```\r' : undefined })] }
    const cases: [string, Partial<MdreamOptions>][] = [
      ['<pre>a&#13;```&#13;<h2>x #</h2></pre>', {}],
      ['<pre><code>a&#13;```&#13;<h2>x #</h2></code></pre>', {}],
      ['<ul><li><pre>a&#13;```&#13;<h2>x #</h2></pre></li></ul>', {}],
      ['<pre><div>a</div><h2>x #</h2></pre>', plugin],
    ]
    for (const [html, options] of cases) {
      const expected = htmlToMarkdown(html, options)
      expect(expected).toContain('````')
      expect(expected).toContain('## x #')
      for (let size = 1; size <= html.length; size++)
        expect(await streamConvert(html, size, options)).toBe(expected)
    }
  })

  it('keeps reliable fences with Tailwind delimiters', () => {
    const html = '<p><span class="line-through font-bold italic">a</span></p><pre><h2>x #</h2></pre>'
    expect(htmlToMarkdown(html, { plugins: [tailwindPlugin()] })).toContain('## x #')
  })
})
