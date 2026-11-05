import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

const RULES_AROUND_DEFERRED_FENCE: [string, string][] = [
  [
    '<ul><li><a href="/w" title="W"><pre><hr></pre></a></li></ul>',
    '- [\n\n  ```\n  \n\n  ---\n  ```\n\n  \n\n  W](/w)',
  ],
  [
    '<li><a href="/w" title="W"><pre><hr>',
    '- [\n\n  ```\n  \n\n  ---\n  ```\n\n  \n\n  W](/w)',
  ],
  [
    '<ul><li><a href="/w" aria-label="W"><pre><hr></pre></a></li></ul>',
    '- [\n\n  ```\n  \n\n  ---\n  ```\n\n  \n\n  W](/w)',
  ],
  [
    '<ol><li><a href="/w" title="W"><pre><hr></pre></a></li></ol>',
    '1. [\n\n   ```\n   \n\n   ---\n   ```\n\n   \n\n   W](/w)',
  ],
  [
    '<ul><li><blockquote><a href="/w" title="W"><pre><hr></pre></a></blockquote></li></ul>',
    '- \n  > [\n  >\n  > ```\n  >\n  >\n  > ---\n  > ```\n  >\n  >\n  >\n  > W](/w)',
  ],
  [
    '<blockquote><ul><li><a href="/w" title="W"><pre><hr></pre></a></li></ul></blockquote>',
    '> - [\n>\n>   ```\n>   \n>\n>   ---\n>   ```\n>\n>   \n>\n>   W](/w)',
  ],
  [
    '<ul><li><a href="/w"><pre><hr></pre></a></li></ul>',
    '- [\n\n  ```\n  \n\n  ---\n  ```\n\n  ](/w)',
  ],
  [
    '<ul><li><pre><hr></pre>t</li></ul>',
    '- ```\n  ***\n  ```\n\n  \n\n  t',
  ],
  [
    '<ol><li><pre><hr></pre><b>x</b></li></ol>',
    '1. ```\n   ***\n   ```\n\n   \n\n   **x**',
  ],
  [
    '<ul><li><pre><hr></pre><hr></li></ul>',
    '- ```\n  ***\n  ```\n\n  \n\n  ***',
  ],
  [
    '<ul><li><pre>x<hr></pre>t</li></ul>',
    '- ```\n  x\n\n  ---\n  ```\n\n  \n\n  t',
  ],
  [
    '<ul><li><pre><code><hr></code></pre>t</li></ul>',
    '- ```\n  ***\n  ```\n\n  \n\n  t',
  ],
  [
    '<ul><li><pre><hr></pre><script>1</script></li><li>z</li></ul>',
    '- ```\n  ***\n  ```\n\n- z',
  ],
  [
    '<ul><li>a<hr><script>1</script></li><li>z</li></ul>',
    '- a\n\n  ---\n- z',
  ],
  [
    '<ul><li>p<pre><hr></pre></li></ul>',
    '- p\n\n  ```\n  \n\n  ---\n  ```',
  ],
  [
    '<ul><li>p<pre><p>x</p></pre></li></ul>',
    '- p\n\n  ```\n  \n\n  x\n  ```',
  ],
  [
    '<ul><li>p<pre><caption>x</caption></pre></li></ul>',
    '- p\n\n  ```\n  \n\n  x\n  ```',
  ],
  [
    '<ul><li><a href="/w" title="W"><pre><p>x</p></pre></a></li></ul>',
    '- [\n\n  ```\n  \n\n  x\n  ```\n\n  ](/w "W")',
  ],
  [
    '<ul><li><a href="/w" aria-label="W"><pre><p>x</p></pre></a></li></ul>',
    '- [\n\n  ```\n  \n\n  x\n  ```\n\n  ](/w)',
  ],
]

describe.each(engines)('horizontal Rules $name', (engineConfig) => {
  it('converts hr elements', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })

  it.each(RULES_AROUND_DEFERRED_FENCE)('resumes the item after a rule around a deferred fence: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each(RULES_AROUND_DEFERRED_FENCE)('streams a rule around a deferred fence at every split and chunk width: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const chunks: string[][] = []
    for (let width = 1; width <= html.length; width++) {
      const parts: string[] = []
      for (let offset = 0; offset < html.length; offset += width)
        parts.push(html.slice(offset, offset + width))
      chunks.push(parts)
    }
    for (let split = 1; split < html.length; split++)
      chunks.push([html.slice(0, split), html.slice(split)])
    for (const parts of chunks) {
      const stream = new ReadableStream<string>({ start(controller) {
        for (const part of parts)
          controller.enqueue(part)
        controller.close()
      } })
      let actual = ''
      for await (const part of engine.streamHtmlToMarkdown(stream))
        actual += part
      expect(actual, JSON.stringify(parts)).toBe(expected)
    }
  })
})
