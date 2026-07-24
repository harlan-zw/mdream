import type { MdreamOptions, TextNode } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { createPlugin, htmlToMarkdown, NodeEventEnter, streamHtmlToMarkdown, TEXT_NODE } from '../../src/index'

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
      .toBe('## # Heading #\n\n#hashtag\n\nJust a - dash')
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

    expect(htmlToMarkdown('<p>safe</p>', { hooks: [replaceText] }))
      .toBe('\\# plugin \\*text\\*')
    expect(htmlToMarkdown('<p>safe</p>', { hooks: [mutateText] }))
      .toBe('1\\. plugin item')
    expect(await streamConvert('<p>safe</p>', 1, { hooks: [replaceText] }))
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
      .toBe('~~~~js`x\n~~~\ncode\n~~~~')
    expect(htmlToMarkdown('<div><pre class="language-js`x">a\nb\n\n</pre><a href="#x">link</a></div>'))
      .toBe('~~~js`x\na\nb\n\n\n~~~\n\n[link](#x)')
  })

  it('does not double escape parser-protected link and table text', () => {
    expect(htmlToMarkdown('<a href="/x">a[b] *c*</a>'))
      .toBe('[a\\[b\\] \\*c\\*](/x)')
    expect(htmlToMarkdown('<table><tr><td>a|b</td></tr></table>'))
      .toBe('| a\\|b |\n| --- |')
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
      .toContain('[a&#91;b&#93;](/x)')
    expect(htmlToMarkdown('<details><a href="/x">&#92;&#91;</a></details>'))
      .toContain('[\\&#91;](/x)')
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
