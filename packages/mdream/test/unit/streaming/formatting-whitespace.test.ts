import { createPlugin, htmlToMarkdown as jsMarkdown, streamHtmlToMarkdown as jsMarkdownStream } from '@mdream/js'
import { htmlToSafeHtml as jsHtml, streamHtmlToSafeHtml as jsHtmlStream } from '@mdream/js/html'
import { htmlToText as jsText, streamHtmlToText as jsTextStream } from '@mdream/js/text'
import { htmlToMarkdown as rustMarkdown, streamHtmlToMarkdown as rustStream } from 'mdream'
import { describe, expect, it } from 'vitest'

const engines = [
  {
    name: 'JavaScript',
    markdown: jsMarkdown,
    markdownStream: jsMarkdownStream,
    text: jsText,
    textStream: jsTextStream,
    html: jsHtml,
    htmlStream: jsHtmlStream,
    literalText: (html: string) => jsText(html, { tagOverrides: { br: { enter: 'L\n' } } }),
    literalTextStream: (stream: ReadableStream<string>) => jsTextStream(stream, { tagOverrides: { br: { enter: 'L\n' } } }),
    literalExit: (html: string, tag: string, exit: string) => jsMarkdown(html, { tagOverrides: { [tag]: { exit } } }),
    literalExitStream: (stream: ReadableStream<string>, tag: string, exit: string) => jsMarkdownStream(stream, { tagOverrides: { [tag]: { exit } } }),
  },
  {
    name: 'Rust',
    markdown: (html: string) => rustMarkdown(html),
    markdownStream: (stream: ReadableStream<string>) => rustStream(stream),
    text: (html: string) => rustMarkdown(html, { format: 'text' }),
    textStream: (stream: ReadableStream<string>) => rustStream(stream, { format: 'text' }),
    html: (html: string) => rustMarkdown(html, { format: 'html' }),
    htmlStream: (stream: ReadableStream<string>) => rustStream(stream, { format: 'html' }),
    literalText: (html: string) => rustMarkdown(html, { format: 'text', tagOverrides: { br: { enter: 'L\n' } } }),
    literalTextStream: (stream: ReadableStream<string>) => rustStream(stream, { format: 'text', tagOverrides: { br: { enter: 'L\n' } } }),
    literalExit: (html: string, tag: string, exit: string) => rustMarkdown(html, { tagOverrides: { [tag]: { exit } } }),
    literalExitStream: (stream: ReadableStream<string>, tag: string, exit: string) => rustStream(stream, { tagOverrides: { [tag]: { exit } } }),
  },
]

async function assertChunkings(
  html: string,
  convert: (stream: ReadableStream<string>) => AsyncIterable<string>,
  expected: string,
): Promise<void> {
  const chunkings: string[][] = []
  for (let width = 1; width <= html.length; width++) {
    const parts: string[] = []
    for (let offset = 0; offset < html.length; offset += width)
      parts.push(html.slice(offset, offset + width))
    chunkings.push(parts)
  }
  for (let split = 1; split < html.length; split++)
    chunkings.push([html.slice(0, split), html.slice(split)])
  for (const parts of chunkings) {
    const stream = new ReadableStream<string>({
      start(controller) {
        for (const part of parts)
          controller.enqueue(part)
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of convert(stream))
      output += chunk
    expect(output, JSON.stringify(parts)).toBe(expected)
  }
}

describe('javascript plugin hard breaks', () => {
  const options = {
    plugins: [createPlugin({
      onNodeEnter(node) {
        if (node.name === 'br')
          return '  \n'
      },
    })],
  }

  describe.each([
    ['<p>x y&#10;<br>b</p>', 'x y  \nb'],
    ['<p>x y&#13;&#10;<br>b</p>', 'x y  \nb'],
    ['<p>x y&#10;<i></i><br>b</p>', 'x y\n  \nb'],
    ['<p>x y<br>&#10;<br>b</p>', 'x y  \n\n  \nb'],
    ['<p>x y</p>&#10;<br>b', 'x y\n\n\n  \nb'],
    ['<ul><li>x y&#10;<br>b</li></ul>', '- x y  \nb'],
    ['<pre>a\n</pre><br>x', '```\na\n\n```\n\n  \nx'],
  ])('preserves source and structural spacing: %s', (html, expected) => {
    it('converts through the package export', () => {
      expect(jsMarkdown(html, options)).toBe(expected)
    })

    it('streams across every chunk width and split', async () => {
      await assertChunkings(html, stream => jsMarkdownStream(stream, options), expected)
    })
  })

  it.each(['L\n', '  \n'])('preserves source line feeds before literal breaks: %j', async (enter) => {
    const html = '<p>x y&#10;<br>b</p>'
    const literalOptions = { tagOverrides: { br: { enter } } }
    const expected = `x y\n${enter}b`
    expect(jsMarkdown(html, literalOptions)).toBe(expected)
    await assertChunkings(html, stream => jsMarkdownStream(stream, literalOptions), expected)
  })

  it.each([
    ['<pre>a\n</pre><br>x', 'a\n\nx'],
    ['<pre>a\n </pre><br>x', 'a\n\nx'],
    ['<table><tr><td><pre>a&#10; </pre><br>x</td></tr></table>', 'a\n  \nx'],
    ['<table><tr><td><pre>a&#10;&#9;</pre><br>x</td></tr></table>', 'a\n  \nx'],
    ['<table><tr><td><pre>a&#10; </pre><span></span><br>x</td></tr></table>', 'a\n  \nx'],
  ])('preserves closed preformatted text before plugin breaks: %s', async (html, expected) => {
    expect(jsText(html, options)).toBe(expected)
    await assertChunkings(html, stream => jsTextStream(stream, options), expected)
  })
})

describe.each(engines)('$name formatting whitespace', (engine) => {
  it.each([
    ['<p><em><span>a &#10;&#11;</span> </em>x</p>', '*a* x'],
    ['<p><strong><span>a &#10;&#11;</span> </strong>x</p>', '**a** x'],
    ['<ul><li><em><span>a &#10;&#11;</span> </em>x</li></ul>', '- *a* x'],
    ['<p><em>a<br><span>&#11;</span> </em>x</p>', '*a  \n\u000B* x'],
  ])('keeps delimiter-owned source tails separate from structural output: %s', async (html, expected) => {
    expect(engine.markdown(html)).toBe(expected)
    await assertChunkings(html, engine.markdownStream, expected)
  })

  it.each([
    { tag: 'em', marker: '*', wrappers: 0, depth: 1, tail: '&#10;&#11;  ' },
    { tag: 'em', marker: '*', wrappers: 1, depth: 1, tail: '&#10;&#11;  ' },
    { tag: 'em', marker: '*', wrappers: 1, depth: 1, tail: '&#11;&#10;  ' },
    { tag: 'strong', marker: '**', wrappers: 1, depth: 1, tail: '&#10;&#11;  ' },
    { tag: 'strong', marker: '**', wrappers: 1, depth: 1, tail: '&#11;&#10;  ' },
    { tag: 'del', marker: '~~', wrappers: 1, depth: 1, tail: '&#10;&#11;  ' },
    { tag: 'em', marker: '*', wrappers: 2, depth: 2, tail: ' &#10;&#11;' },
    { tag: 'strong', marker: '**', wrappers: 2, depth: 2, tail: ' &#11;&#10;' },
  ])('keeps quoted $tag tails mutable through $wrappers wrappers at depth $depth: $tail', async ({ tag, marker, wrappers, depth, tail }) => {
    const text = 'a'.repeat(8200)
    const first = `${'<blockquote>'.repeat(depth)}<${tag}>${'<span>'.repeat(wrappers)}${text}${tail}${'</span>'.repeat(wrappers)}`
    const last = ` </${tag}>x${'</blockquote>'.repeat(depth)}`
    const html = first + last
    const expected = `${'> '.repeat(depth)}${marker}${text}${marker} x`
    expect(engine.markdown(first + last)).toBe(expected)
    const chunkings = [[first, last]]
    for (const width of [7, 127, 8191]) {
      const parts: string[] = []
      for (let offset = 0; offset < html.length; offset += width)
        parts.push(html.slice(offset, offset + width))
      chunkings.push(parts)
    }
    for (const parts of chunkings) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (const part of parts)
            controller.enqueue(part)
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of engine.markdownStream(input))
        output += chunk
      expect(output).toBe(expected)
    }
  })

  it.each([false, true])('preserves quoted vertical-tab content with literal=%s exits', async (literal) => {
    const text = 'a'.repeat(8200)
    const first = `<blockquote><em><span>${text}${literal ? '&#10;&#11; ' : '&#11;'}</span>`
    const last = '</em>x</blockquote>'
    const expected = literal ? `> *${text}\n> \u000B* x` : `> *${text}\u000B*x`
    const convert = literal ? (html: string) => engine.literalExit(html, 'em', '*') : engine.markdown
    expect(convert(first + last)).toBe(expected)
    const input = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(first)
        controller.enqueue(last)
        controller.close()
      },
    })
    let output = ''
    const stream = literal ? engine.literalExitStream(input, 'em', '*') : engine.markdownStream(input)
    for await (const chunk of stream)
      output += chunk
    expect(output).toBe(expected)
  })

  it('preserves preformatted newlines and vertical tabs in a long quote', async () => {
    const text = 'a'.repeat(8200)
    const first = `<blockquote><pre><code>${text}\n\u000B  </code>`
    const last = '</pre></blockquote>'
    const expected = `> \`\`\`\n> ${text}\n> \u000B\n> \`\`\``
    expect(engine.markdown(first + last)).toBe(expected)
    const input = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(first)
        controller.enqueue(last)
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of engine.markdownStream(input))
      output += chunk
    expect(output).toBe(expected)
  })

  it.each([
    ['<p><em><span>T&#11; </span></em>x</p>', '*T* x'],
    ['<p><em><span>T &#11;</span></em>x</p>', '*T* x'],
    ['<p><strong><span>T&#11; </span></strong>x</p>', '**T** x'],
    ['<p><strong><span>T &#11;</span></strong>x</p>', '**T** x'],
    ['<p><em><span><span>T&#11; </span></span></em>x</p>', '*T* x'],
    ['<p><em><span>T&#11;</span></em>x</p>', '*T\u000B*x'],
    ['<p><strong><span>T&#11;</span></strong>x</p>', '**T\u000B**x'],
    ['<p><span>T&#11; </span>x</p>', 'T\u000B x'],
    ['<pre><code><em><span>T&#11; </span></em></code></pre>', '```\nT\u000B\n```'],
  ])('settles formatting whitespace through transparent wrappers: %s', async (html, expected) => {
    expect(engine.markdown(html)).toBe(expected)
    await assertChunkings(html, engine.markdownStream, expected)
  })

  it.each([
    ['em', '*', '</em>'],
    ['strong', '**', '</strong>'],
    ['em', '*', '*'],
    ['strong', '**', '**'],
  ])('preserves wrapped vertical tabs before a literal %s exit %s %s', async (tag, enter, exit) => {
    const html = `<p><${tag}><span>T&#11; </span></${tag}>x</p>`
    const expected = `${enter}T\u000B${exit} x`
    expect(engine.literalExit(html, tag, exit)).toBe(expected)
    await assertChunkings(html, stream => engine.literalExitStream(stream, tag, exit), expected)
  })

  it.each([
    ['<p><em>T&#11; </em>x</p>', '*T* x'],
    ['<p><em>a &#11;</em>b</p>', '*a* b'],
    ['<p><strong>T&#11; </strong>x</p>', '**T** x'],
    ['<p><strong>a &#11;</strong>b</p>', '**a** b'],
    ['<p><em>T&#11;</em>x</p>', '*T\u000B*x'],
    ['<p><strong>T&#11;</strong>x</p>', '**T\u000B**x'],
    ['<p>T&#11; x</p>', 'T\u000B x'],
    ['<pre><code>T&#11; </code></pre>', '```\nT\u000B\n```'],
    ['<code>T&#11; </code>', '`T\u000B`'],
  ])('keeps inline-close trimming local: %s', async (html, expected) => {
    expect(engine.markdown(html)).toBe(expected)
    await assertChunkings(html, engine.markdownStream, expected)
  })

  it.each([
    ['em', '*', '</em>'],
    ['strong', '**', '</strong>'],
    ['em', '*', '*'],
    ['strong', '**', '**'],
  ])('preserves vertical tabs before a literal %s exit %s %s', async (tag, enter, exit) => {
    const html = `<p><${tag}>a &#11; </${tag}>b</p>`
    const expected = `${enter}a \u000B${exit} b`
    expect(engine.literalExit(html, tag, exit)).toBe(expected)
    await assertChunkings(html, stream => engine.literalExitStream(stream, tag, exit), expected)
  })

  it.each([
    ['<p><em>T&#11; </em>x</p>', 'T\u000B x'],
    ['<p><em>a &#11;</em>b</p>', 'a \u000Bb'],
  ])('preserves vertical tabs in text output: %s', async (html, expected) => {
    expect(engine.text(html)).toBe(expected)
    await assertChunkings(html, engine.textStream, expected)
  })

  it.each([
    ['<table><tr><td><pre>a\n</pre><br>x</td></tr></table>', 'a\n\nx'],
    ['<table><tr><td>a</td><td><br>b</td></tr></table>', 'a\t\nb'],
    ['<table><tr><th>a</th><th><br>b</th></tr></table>', 'a\t\nb'],
    ['<table><tr><td>a</td><td>&#9;<i></i><br>b</td></tr></table>', 'a\t\nb'],
    [`<table><tr><td>${'a'.repeat(64)}</td><td>&#9;<i></i><br>b</td></tr></table>`, `${'a'.repeat(64)}\t\nb`],
    ['<p>x y&#10;&#9;<br>b</p>', 'x y\nb'],
    ['<p>x y&#10; <br>b</p>', 'x y\nb'],
    ['<p>€ a</p><br>b', '€ a\n\nb'],
    ['<p>a b</p><br>c', 'a b\n\nc'],
  ])('preserves source and generated text boundaries before breaks: %s', async (html, expected) => {
    expect(engine.text(html)).toBe(expected)
    await assertChunkings(html, engine.textStream, expected)
  })

  it('preserves mixed source whitespace before a literal text break', async () => {
    const html = '<p>x y&#10;&#9;<br>b</p>'
    const expected = 'x y\n\tL\nb'
    expect(engine.literalText(html)).toBe(expected)
    await assertChunkings(html, engine.literalTextStream, expected)
  })

  it.each([
    ['<p><em>T&#11; </em>x</p>', '<p><em>T\u000B </em>x</p>'],
    ['<p><strong>a &#11;</strong>b</p>', '<p><strong>a \u000B</strong>b</p>'],
  ])('preserves vertical tabs before raw HTML closers: %s', async (html, expected) => {
    expect(engine.html(html)).toBe(expected)
    await assertChunkings(html, engine.htmlStream, expected)
  })

  it.each([
    ['<p>x y&#10;<br>b</p>', 'x y  \nb'],
    ['<p>x y&#13;&#10;<br>b</p>', 'x y  \nb'],
  ])('keeps source line feeds out of paragraph spacing: %s', async (html, expected) => {
    expect(engine.markdown(html)).toBe(expected)
    await assertChunkings(html, engine.markdownStream, expected)
  })

  it.each([
    ['<p>x y&#10;<i></i><br>b</p>', 'x y\n  \nb'],
    ['<p>x y<br>&#10;<br>b</p>', 'x y  \n\n  \nb'],
    ['<p>x y</p>&#10;<br>b', 'x y\n\n\n  \nb'],
    ['<ul><li>x y&#10;<br>b</li></ul>', '- x y\n  \n  b'],
    ['<pre>x y\n<br>b</pre>', '```\nx y\n\nb\n```'],
  ])('preserves existing structural spacing: %s', async (html, expected) => {
    expect(engine.markdown(html)).toBe(expected)
    await assertChunkings(html, engine.markdownStream, expected)
  })

  it('keeps long vertical-tab tails consistent across chunks', async () => {
    const html = `<p><em>T${' &#11;'.repeat(2048)}</em>x</p>`
    expect(engine.markdown(html)).toBe('*T* x')
    for (const width of [1, 7, 1024]) {
      const stream = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of engine.markdownStream(stream))
        output += chunk
      expect(output, `width=${width}`).toBe('*T* x')
    }
  })

  it('preserves source form feeds before a literal text break', async () => {
    const html = '<p>a&#12;<br>b</p>'
    expect(engine.literalText(html)).toBe('a\fL\nb')
    await assertChunkings(html, engine.literalTextStream, 'a\fL\nb')
    expect(engine.text(html)).toBe('a\nb')
    await assertChunkings(html, engine.textStream, 'a\nb')
  })
})
