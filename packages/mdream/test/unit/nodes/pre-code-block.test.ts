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
      // Underscores and slashes are inert in an info string and appear in real
      // highlighter class names (Ace `c_cpp`, CodeMirror `text/x-csrc`).
      ['language-vim_script', 'vim_script'],
      ['language-c_cpp', 'c_cpp'],
      ['language-text/x-csrc', 'text/x-csrc'],
      ['ignored&#9;language-js&#10;language-rust', 'js'],
      ['language-bad&#96; language-rust', 'rust'],
      ['language- language-C#', 'C#'],
      ['language-js&#11; language-rust', 'rust'],
      // NBSP is not HTML ASCII whitespace, so it stays inside the token rather
      // than splitting it, and it cannot break the fence.
      ['language-js&#160; language-rust', 'js\u00A0'],
      ['language-js&quot;x', ''],
      ['language-js&#39;x', ''],
      ['language-js&lt;x', ''],
      ['language-js&amp;x', ''],
      ['language-js&#1;x', ''],
      ['language-js&#127;x', ''],
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

  it.each([
    [
      'after inline code',
      '<p>Run <code>a</code></p><pre><code>plain</code></pre><pre><code>last\n```\nend</code></pre>',
      'Run `a`\n\n```\nplain\n```\n\n````\nlast\n```\nend\n````',
    ],
    [
      'in a list item',
      '<p>Intro</p><pre><code>one</code></pre><ul><li>item<pre><code class="language-js">x\n```\ny</code></pre></li></ul>',
      'Intro\n\n```\none\n```\n\n- item\n\n  ````js\n  x\n  ```\n  y\n  ````',
    ],
    [
      'in a blockquote',
      '<pre><code>one</code></pre><blockquote><pre><code>before\n````\nafter</code></pre></blockquote>',
      '```\none\n```\n\n> `````\n> before\n> ````\n> after\n> `````',
    ],
  ])('widens a later fence %s and leaves earlier fences unchanged', async (_, html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    for (let split = 1; split < html.length; split++) {
      expect(await collect(streamHtmlToMarkdown(
        chunkedStream([html.slice(0, split), html.slice(split)]),
        { engine },
      )), `split at ${split}`).toBe(expected)
    }
  })

  it('leaves the existing <pre><code> behaviour unchanged', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre><code>const x = 1</code></pre>', { engine })).toBe('```\nconst x = 1\n```')
    expect(htmlToMarkdown('<pre><code class="language-js">const x = 1</code></pre>', { engine })).toBe('```js\nconst x = 1\n```')
    expect(htmlToMarkdown('<pre><code>x</code></pre>', {
      engine,
      plugins: { tagOverrides: { code: { enter: '^' } } },
    })).toBe('```\n^x\n```')
    expect(htmlToMarkdown('<pre><code class="language-js">x</code></pre>', {
      engine,
      plugins: { tagOverrides: { code: { enter: '^', exit: '$' } } },
    })).toBe('```js\n^x$\n```')
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

  it.each([
    ['<pre>line\n</pre>', 'line\n\n'],
    ['<pre><code>line\n</code></pre>', 'line\n'],
    ['<pre><code>line</code></pre>', 'line\n'],
  ])('separates list items after %s without moving code whitespace', async (pre, content) => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ul><li><p>item</p>${pre}\n    </li><li>next</li></ul><p>after</p>`
    const expected = `- item\n\n  \`\`\`\n  ${content}  \`\`\`\n\n- next\n\nafter`
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    for (let split = 1; split < html.length; split++) {
      expect(await collect(streamHtmlToMarkdown(
        chunkedStream([html.slice(0, split), html.slice(split)]),
        { engine },
      )), `split at ${split}`).toBe(expected)
    }
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

describe.each(engines)('code block language data attributes $name', (engineConfig) => {
  it.each([
    ['code data-language', '<pre><code data-language="TypeScript">code</code></pre>', 'TypeScript'],
    ['code data-lang', '<pre><code data-lang="bash">code</code></pre>', 'bash'],
    ['pre class with a code child', '<pre class="language-rust"><code>code</code></pre>', 'rust'],
    ['pre data-language', '<pre data-language="TypeScript"><code>code</code></pre>', 'TypeScript'],
    ['pre data-lang', '<pre data-lang="bash"><code>code</code></pre>', 'bash'],
    ['bare pre data-language', '<pre data-language="sh">code</pre>', 'sh'],
  ])('reads %s as the code block language', async (_, html, language) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(`\`\`\`${language}\ncode\n\`\`\``)
  })

  it.each([
    [
      'code class before pre data-language',
      '<pre data-language="Rust"><code class="language-TypeScript" data-language="bash">code</code></pre>',
      'TypeScript',
    ],
    [
      'code data-language before pre class',
      '<pre class="language-Rust"><code data-language="TypeScript">code</code></pre>',
      'TypeScript',
    ],
    [
      'code data-language before code data-lang',
      '<pre><code data-language="TypeScript" data-lang="bash">code</code></pre>',
      'TypeScript',
    ],
    [
      'pre class before pre data-language',
      '<pre class="language-Rust" data-language="TypeScript"><code>code</code></pre>',
      'Rust',
    ],
    [
      'pre data-language before pre data-lang',
      '<pre data-language="TypeScript" data-lang="bash"><code>code</code></pre>',
      'TypeScript',
    ],
  ])('honors %s', async (_, html, language) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(`\`\`\`${language}\ncode\n\`\`\``)
  })

  it('trims ASCII whitespace from data-language and preserves case', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre><code data-language="\t TypeScript \r\n">code</code></pre>'
    expect(htmlToMarkdown(html, { engine })).toBe('```TypeScript\ncode\n```')
  })

  it.each([
    ['a backtick', '<pre><code data-language="bad`value">code</code></pre>', ''],
    ['an interior space', '<pre><code data-language="two words">code</code></pre>', ''],
    [
      'an unsafe value before a valid data-lang',
      '<pre><code data-language="bad`value" data-lang="bash">code</code></pre>',
      'bash',
    ],
    [
      'an unsafe code value before the enclosing pre language',
      '<pre data-language="rust"><code data-language="two words">code</code></pre>',
      'rust',
    ],
  ])('rejects %s', async (_, html, language) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(`\`\`\`${language}\ncode\n\`\`\``)
  })

  it('ignores lang attributes and lang-* classes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre lang="rust" class="lang-rust"><code lang="js" class="lang-typescript">code</code></pre>'
    expect(htmlToMarkdown(html, { engine })).toBe('```\ncode\n```')
  })

  it('does not leak the previous pre language into an unlabelled code block', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre data-language="js">first</pre><pre><code>second</code></pre>'
    expect(htmlToMarkdown(html, { engine })).toBe('```js\nfirst\n```\n\n```\nsecond\n```')
  })

  it('keeps data-language on inline code from opening a fenced block', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><code data-language="js">inline</code></p>', { engine })).toBe('`inline`')
  })

  it('keeps code in a table cell as raw HTML with br line breaks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<table><tr><td><pre data-language="sh"><code data-language="js">echo\nhi</code></pre></td><td>ok</td></tr></table>'
    expect(htmlToMarkdown(html, { engine })).toBe(
      '| <pre><code>echo<br>hi</code></pre> | ok |\n| --- | --- |',
    )
  })

  it('keeps a nested pre from replacing its owning pre language', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre data-language="outer"><pre data-language="inner"></pre><code>code</code></pre>'
    expect(htmlToMarkdown(html, { engine })).toBe('```outer\ncode\n```')
  })

  it('matches one-shot language resolution across stream splits', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre data-language="TypeScript"><code>const value = 1</code></pre>'
    const expected = htmlToMarkdown(html, { engine })
    expect(expected).toBe('```TypeScript\nconst value = 1\n```')
    for (let split = 1; split < html.length; split++) {
      const streamed = await collect(streamHtmlToMarkdown(
        chunkedStream([html.slice(0, split), html.slice(split)]),
        { engine },
      ))
      expect(streamed, `split at ${split}`).toBe(expected)
    }
  })

  it('uses the same language resolution in HTML output', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<pre data-language="Rust"><code data-language="TypeScript">code</code></pre>'
    expect(htmlToMarkdown(html, { engine, format: 'html' }))
      .toBe('<pre tabindex="0"><code class="language-TypeScript">code</code></pre>')
  })
})
