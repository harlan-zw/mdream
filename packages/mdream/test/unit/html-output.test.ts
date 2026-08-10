import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../utils/engines'

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let output = ''
  for await (const chunk of stream)
    output += chunk
  return output
}

describe.each(engines)('safe HTML output $name', (engineConfig) => {
  it('renders semantic HTML without a Markdown round trip', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const input = [
      '<h1>Hello <em>world</em></h1>',
      '<p>Visit <a href="/docs?utm_source=test&section=api" title="Docs">docs</a>.</p>',
      '<ol start="3"><li><strong>First</strong></li><li>Second</li></ol>',
      '<pre><code class="language-ts">const value = 1 &lt; 2</code></pre>',
    ].join('')

    expect(htmlToMarkdown(input, {
      clean: { urls: true },
      engine,
      format: 'html',
      origin: 'https://mdream.dev/base/',
    })).toBe([
      '<h1 id="hello-world">Hello <em>world</em></h1>',
      '<p>Visit <a href="https://mdream.dev/base/docs?section=api" title="Docs">docs</a>.</p>',
      '<ol start="3"><li><strong>First</strong></li><li>Second</li></ol>',
      '<pre tabindex="0"><code class="language-ts">const value = 1 &lt; 2</code></pre>',
    ].join(''))
  })

  it('escapes text and attributes while removing active content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const input = [
      '<script>alert(1)</script>',
      '<p onclick="alert(1)">&lt;safe&gt; ',
      '<a href="java&#9;script:alert(1)" title="&quot;quoted&quot;">link</a>',
      '<a href="file:///etc/passwd">file</a>',
      '<img src="data:text/html,boom" alt="bad">',
      '<img src="blob:https://mdream.dev/id" alt="blob">',
      '<img src="/safe.png" alt="A &quot;quote&quot;">',
      '</p>',
    ].join('')

    expect(htmlToMarkdown(input, {
      engine,
      format: 'html',
      origin: 'https://mdream.dev/',
    })).toBe('<p>&lt;safe&gt; linkfile<img src="https://mdream.dev/safe.png" alt="A &quot;quote&quot;"></p>')
  })

  it('rejects relative URLs resolved against an unsafe origin', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><a href="/safe">link</a><img src="/safe"></p>', {
      engine,
      format: 'html',
      origin: 'javascript:alert(1)',
    })).toBe('<p>link</p>')
  })

  it('normalizes safe attributes and omits unsupported direction tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<table><tr><th align="CENTER">Value</th></tr></table><bdo>text</bdo>', {
      engine,
      format: 'html',
    })).toBe('<table><tr><th align="center">Value</th></tr></table>text')
  })

  it('omits unsigned attributes outside the u32 range', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const input = [
      '<ol start="4294967295"><li>max</li></ol>',
      '<ol start="4294967296"><li>overflow</li></ol>',
      '<table><tr><td colspan="999999999999999999999999999999999999999999999999999">huge</td></tr></table>',
    ].join('')

    expect(htmlToMarkdown(input, { engine, format: 'html' })).toBe([
      '<ol start="4294967295"><li>max</li></ol>',
      '<ol><li>overflow</li></ol>',
      '<table><tr><td>huge</td></tr></table>',
    ].join(''))
  })

  it('keeps nested pre content in the outer code block', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre>a<pre>b</pre>c</pre><p>d</p>', {
      engine,
      format: 'html',
    })).toBe('<pre tabindex="0"><code>abc</code></pre><p>d</p>')
  })

  it('matches batch output at every stream split', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const input = '<article><h2>Streaming</h2><p>A <code>small</code> example.</p></article>'
    const expected = htmlToMarkdown(input, { engine, format: 'html' })

    for (let split = 0; split <= input.length; split++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(input.slice(0, split))
          controller.enqueue(input.slice(split))
          controller.close()
        },
      })
      const streamed = await collect(streamHtmlToMarkdown(stream, { engine, format: 'html' }))
      expect(streamed, `split=${split}`).toBe(expected)
    }
  })
})
