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

// A bare <pre> (no <code> child) becomes a fenced code block (issue #97).
describe.each(engines)('pre as fenced code block $name', (engineConfig) => {
  it('fences a bare <pre>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre>const x = 1</pre>', { engine })).toBe('```\nconst x = 1\n```')
  })

  it('reads the language from the <pre> class', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre class="language-js">const x = 1</pre>', { engine })).toBe('```js\nconst x = 1\n```')
  })

  it('accepts only safe language class tokens', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    for (const [className, language] of [
      ['language-js', 'js'],
      ['language-c++', 'c++'],
      ['language-C#', 'C#'],
      ['language-objective-c', 'objective-c'],
      ['language-.net', '.net'],
      ['ignored&#9;language-js&#10;language-rust', 'js'],
      ['language-bad&#96; language-rust', 'rust'],
      ['language- language-C#', 'C#'],
      ['language-js&#11; language-rust', 'rust'],
      ['language-js&#160; language-rust', 'rust'],
      ['language-js_foo', ''],
      ['language-js&quot;x', ''],
      ['language-js&#1;x', ''],
      ['notlanguage-js', ''],
    ]) {
      const html = `<pre><code class="${className}">code</code></pre>`
      expect(htmlToMarkdown(html, { engine }), `class=${className}`)
        .toBe(`\`\`\`${language}\ncode\n\`\`\``)
    }

    expect(htmlToMarkdown('<pre class="language-bad&#96; language-.net">code</pre>', { engine }))
      .toBe('```.net\ncode\n```')
  })

  it('keeps rejected language metadata from changing the fence', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown(
      '<pre><code class="language-~~~&#96;">code</code></pre><p>after</p>',
      { engine },
    )

    expect(markdown).toBe('```\ncode\n```\n\nafter')
  })

  it('preserves multi-line whitespace inside the block', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre>line1\nline2\n  indented</pre>', { engine })).toBe('```\nline1\nline2\n  indented\n```')
  })

  it('widens fences only for line-leading matching runs', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre><code>Contains ```triple``` inside.</code></pre>', { engine }))
      .toBe('```\nContains ```triple``` inside.\n```')
    expect(htmlToMarkdown('<pre><code>before\n```line-leading\n````\nafter</code></pre>', { engine }))
      .toBe('`````\nbefore\n```line-leading\n````\nafter\n`````')
    expect(htmlToMarkdown('<pre>before\n```\nafter</pre>', { engine }))
      .toBe('````\nbefore\n```\nafter\n````')
    expect(htmlToMarkdown('<pre><code class="language-js`x">~~~\ncode</code></pre>', { engine }))
      .toBe('```\n~~~\ncode\n```')
    expect(htmlToMarkdown('<div><pre class="language-js`x">a\nb\n\n</pre><a href="#x">link</a></div>', { engine }))
      .toBe('```\na\nb\n\n\n```\n\n[link](#x)')
  })

  it('leaves the existing <pre><code> behaviour unchanged', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre><code>const x = 1</code></pre>', { engine })).toBe('```\nconst x = 1\n```')
    expect(htmlToMarkdown('<pre><code class="language-js">const x = 1</code></pre>', { engine })).toBe('```js\nconst x = 1\n```')
  })

  it('strips an empty <pre> (no fence)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre></pre>', { engine })).toBe('')
  })

  it('strips a whitespace-only <pre> (no fence)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre>   \n  </pre>', { engine })).toBe('')
  })

  it('does not leak a whitespace-only <pre> between surrounding blocks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p>a</p><pre>   \n  </pre><p>b</p>', { engine })).toBe('a\n\nb')
  })

  it('does not double-fence a <pre> with both text and a <code> child', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre>text<code>codepart</code>more</pre>', { engine })).toBe('```\ntextcodepartmore\n```')
  })

  it('lets a <code> child own the fence when surrounded by whitespace', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre> <code>spaced code</code> </pre>', { engine })).toBe('```\nspaced code\n```')
  })

  it('separates a bare <pre> from surrounding blocks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p>before</p><pre>x = 1</pre><p>after</p>', { engine })).toBe('before\n\n```\nx = 1\n```\n\nafter')
  })

  it('indents a bare <pre> inside a list item', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<ul><li>item<pre>code\nblock</pre></li></ul>', { engine })).toBe('- item\n\n  ```\n  code\n  block\n  ```')
  })

  it('fences a bare <pre> split across stream chunks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const chunks = ['<p>A</p><pre>line one\n', 'line two</pre><p>B</p>']
    const result = await collect(streamHtmlToMarkdown(chunkedStream(chunks), { engine }))
    expect(result.trim()).toBe('A\n\n```\nline one\nline two\n```\n\nB')
  })

  it('widens fences at every stream split', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre><code>before\n```line-leading\n````\nafter</code></pre>'
    const expected = htmlToMarkdown(html, { engine })
    for (let split = 1; split < html.length; split++) {
      const result = await collect(streamHtmlToMarkdown(
        chunkedStream([html.slice(0, split), html.slice(split)]),
        { engine },
      ))
      expect(result, `split at ${split}`).toBe(expected)
    }
  })

  it('validates language metadata at every stream split', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    for (const html of [
      '<pre><code class="language-~~~&#96;">code</code></pre><p>after</p>',
      '<pre><code class="language-js&#10;ignored">code</code></pre>',
      '<pre><code class="language-bad&#96; language-rust">code</code></pre>',
    ]) {
      const expected = htmlToMarkdown(html, { engine })
      for (let split = 1; split < html.length; split++) {
        const result = await collect(streamHtmlToMarkdown(
          chunkedStream([html.slice(0, split), html.slice(split)]),
          { engine },
        ))
        expect(result, `${html}: split at ${split}`).toBe(expected)
      }
    }
  })
})
