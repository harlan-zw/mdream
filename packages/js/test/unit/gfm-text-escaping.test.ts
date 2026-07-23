import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

async function streamConvert(html: string, chunkSize: number): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (let index = 0; index < html.length; index += chunkSize)
        controller.enqueue(html.slice(index, index + chunkSize))
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
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

  it('matches one-shot output across stream boundaries', async () => {
    const html = '<p>&#35; heading [label](url) and *bar* ~~baz~~ `qux` &amp;copy;</p><p>> quote</p><p>1. item</p><p>---</p>'
    const expected = htmlToMarkdown(html)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(html, chunkSize), `chunk size ${chunkSize}`).toBe(expected)
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
