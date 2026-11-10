import type { ElementNode } from '@mdream/js'
import { ReadableStream } from 'node:stream/web'
import { createPlugin, htmlToMarkdown as jsHtmlToMarkdown, streamHtmlToMarkdown as jsStreamHtmlToMarkdown } from '@mdream/js'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../../utils/engines'

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
    '<ul><li>p<pre><caption>x</caption></pre></li></ul>',
    '- p\n\n  ```\n  \n\n  x\n  ```',
  ],
]

describe.each(engines)('horizontal Rules $name', (engineConfig) => {
  it.each([
    ['<ul><li><hr><blockquote><br></blockquote>tail</li></ul>', '- ***\n\n  \n  \n  \n  tail'],
    ['<blockquote><ul><li><hr><blockquote><p><br></p></blockquote><blockquote><p><br></p></blockquote>tail</li></ul></blockquote>', engineConfig.name === 'JavaScript Engine' ? '> - ***\n>\n>   \n>\n>     \n>   \n>     \n>   \n>   tail' : '> - ***\n>\n>   \n>   \n>   \n>\n>     \n>   \n>   tail'],
    ['<ul><li><hr><blockquote></blockquote><blockquote></blockquote>tail</li></ul>', '- ***\n\n  \n\n  tail'],
    ['<blockquote><ul><li><hr><blockquote></blockquote><blockquote></blockquote>tail</li></ul></blockquote>', '> - ***\n>\n>   \n>\n>   tail'],
    ['<blockquote><ul><li><blockquote>x<hr></blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - \n>   > x\n>   >\n>   > ---\n>\n>   > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote>q</blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n\n  > q'],
    ['<ul><li><hr><blockquote></blockquote><blockquote>q</blockquote></li></ul>', '- ***\n\n  \n\n  > q'],
    ['<blockquote><ul><li><blockquote>x<hr></blockquote><blockquote></blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - \n>   > x\n>   >\n>   > ---\n>   > q'],
  ])('preserves pending rule quote review boundaries: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><hr><blockquote></blockquote>tail</li></ul>', 'END', '- ***\n\n  \nEND tail'],
    ['<ul><li><hr><blockquote></blockquote></li></ul>', 'END', '- ***\n\n  \nEND'],
    ['<ul><li><hr><blockquote><p></p></blockquote><p>tail</p></li></ul>', 'END', engineConfig.name === 'JavaScript Engine' ? '- ***\n\n  \n\n  END\n\n  tail' : '- ***\n\n  \nEND\n\n  tail'],
    ['<ol><li><hr><blockquote></blockquote>tail</li></ol>', 'END', '1. ***\n\n   \nEND tail'],
    ['<ul><li><ul><li><hr><blockquote></blockquote>tail</li></ul></li></ul>', 'END', '-\n  - ***\n\n    \nEND tail'],
    ['<ul><li><hr><blockquote></blockquote><blockquote></blockquote>tail</li></ul>', 'END', '- ***\n\n  \nEND\nEND tail'],
    ['<ul><li><hr><blockquote>q</blockquote>tail</li></ul>', 'END', engineConfig.name === 'JavaScript Engine' ? '- ***\n\n  \nqEND tail' : '- ***\n\n  \n  > qEND tail'],
    ['<ul><li><hr><blockquote><blockquote></blockquote></blockquote>tail</li></ul>', 'END', engineConfig.name === 'JavaScript Engine' ? '- ***\n\n  \nENDEND tail' : '- ***\n\n  \n  > ENDEND tail'],
    ['<ul><li><hr><blockquote><blockquote>q</blockquote></blockquote>tail</li></ul>', 'END', engineConfig.name === 'JavaScript Engine' ? '- ***\n\n  \nqENDEND tail' : '- ***\n\n  \n  > > qENDEND tail'],
    ['<ul><li><hr><blockquote></blockquote>tail</li></ul>', '', '- ***\n\n  \ntail'],
    ['<ul><li><hr><blockquote></blockquote>tail</li></ul>', ' ', '- ***\n\n  \n tail'],
  ])('keeps the list separator before quote exit override output: %s with %j', async (html, exit, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = { engine, plugins: { tagOverrides: { blockquote: { exit } } } }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let split = 0; split <= html.length; split++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(stream, options))
        output += chunk
      expect(output, `split=${split}`).toBe(expected)
    }
  })

  it.each([
    ['<blockquote>text</blockquote>', 'X textY'],
    ['<ul><li><blockquote>text</blockquote></li></ul>', '- X textY'],
    ['<ul><li><blockquote><hr>text</blockquote></li></ul>', '- X\n\n  ---\n\n  textY'],
    ['<ul><li><hr><blockquote>q</blockquote></li></ul>', '- ***\n\n  X qY'],
    ['<blockquote><ol start="10000"><li><hr><blockquote>q</blockquote></li></ol></blockquote>', 'X\n\n10000. ***\n\n       X qY\n\nY'],
  ])('replaces quote markers with literal overrides around list rules: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = { engine, plugins: { tagOverrides: { blockquote: { enter: 'X', exit: 'Y' } } } }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let split = 0; split <= html.length; split++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(stream, options))
        output += chunk
      expect(output, `split=${split}`).toBe(expected)
    }
  })

  it.each([
    ['<ul><li><em><blockquote>-<hr></blockquote></em>tail</li></ul>', '- *\n  > \\-\n  >\n  > ---\n\n  *tail'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><div><blockquote></blockquote></div><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n  > > q'],
    ['<ul><li><hr><blockquote><blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote></blockquote></li></ul>', '- ***\n\n  \n  > > > q'],
    ['<ul><li><hr><blockquote><blockquote></blockquote><table><tr><td>a</td></tr></table></blockquote></li></ul>', '- ***\n\n  \n  >\n  >   | a |\n  > | --- |'],
    ['<ul><li><hr><blockquote><em>x<blockquote></blockquote></em>y</blockquote></li></ul>', '- ***\n\n  \n  > *x\n  >\n  > *y'],
    ['<ul><li><hr><blockquote><ul><li>q<blockquote></blockquote>tail</li></ul></blockquote></li></ul>', '- ***\n\n  \n  > - q\n  >\n  >   tail'],
    ['<ul><li><blockquote><hr></blockquote><blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > ---\n  > > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n  > > q'],
    ['<blockquote><ul><li><blockquote>x<hr></blockquote><blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote></li></ul></blockquote>', '> - \n>   > x\n>   >\n>   > ---\n>   > > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote></blockquote>q</blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n\n  > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote></blockquote><p>q</p></blockquote>tail</li></ul>', '- \n  > x\n  >\n  > ---\n\n  > q\n\n  tail'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n\n  > > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><p></p><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n\n  > > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote><p></p></blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n  > > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote>tail</li></ul>', '- \n  > x\n  >\n  > ---\n  > > q\n\n  tail'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote></blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n  > > q'],
    ['<ol><li><blockquote>x<hr></blockquote><blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote></li></ol>', '1. \n   > x\n   >\n   > ---\n   > > q'],
    ['<ul><li><hr><blockquote>x<blockquote></blockquote><hr></blockquote></li></ul>', '- ***\n\n  \n  > x\n  >\n  >   ---'],
    ['<ul><li><hr><blockquote><p>x</p><blockquote></blockquote><hr></blockquote></li></ul>', engineConfig.name === 'JavaScript Engine' ? '- ***\n\n  \n  >\n  > x\n  >\n  >   ---' : '- ***\n\n  \n  > x\n  >\n  >   ---'],
    ['<ul><li><hr><blockquote>x<blockquote></blockquote>y</blockquote></li></ul>', '- ***\n\n  \n  > x\n  >\n  > y'],
    ['<ul><li><hr><blockquote>x<blockquote></blockquote><p>y</p></blockquote></li></ul>', '- ***\n\n  \n  > x\n  >\n  > y'],
    ['<ul><li><hr><blockquote>x<blockquote><blockquote></blockquote></blockquote><hr></blockquote></li></ul>', '- ***\n\n  \n  > x\n  >\n  >   ---'],
    ['<ul><li><hr><blockquote><table><tr><td>x</td></tr></table><blockquote></blockquote><hr></blockquote></li></ul>', engineConfig.name === 'JavaScript Engine' ? '- ***\n\n  \n  >\n  > | x |\n  > | --- |\n  >\n  >   ---' : '- ***\n\n  \n  > | x |\n  > | --- |\n  >\n  >   ---'],
    ['<ul><li><hr><blockquote>x<blockquote></blockquote>===</blockquote></li></ul>', '- ***\n\n  \n  > x\n  >\n  > \\==='],
    ['<ol><li><hr><blockquote>x<blockquote></blockquote><hr></blockquote>tail</li></ol>', '1. ***\n\n   \n   > x\n   >\n   >    ---\n\n   tail'],
    ['<ul><li><hr><blockquote><blockquote>q</blockquote><blockquote>r</blockquote></blockquote></li></ul>', '- ***\n\n  \n  > > q\n  >\n  > > r'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote>q</blockquote><blockquote>r</blockquote></blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n\n  > > q\n  >\n  > > r'],
    ['<ul><li><hr><blockquote><p>x</p><hr></blockquote></li></ul>', engineConfig.name === 'JavaScript Engine' ? '- ***\n\n  \n  >\n  > x\n  >\n  > ---' : '- ***\n\n  \n  > x\n  >\n  > ---'],
  ])('preserves rule quote boundaries and nested content: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    const chunkings: string[][] = [[...html]]
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
      for await (const chunk of streamHtmlToMarkdown(stream, { engine }))
        output += chunk
      expect(output, `parts=${parts.length}`).toBe(expected)
    }
  })

  it('converts hr elements', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })

  it('restores list continuation after an empty quote following a rule', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const cases: [string, string][] = [
      ['<ul><li><hr><blockquote><p></p></blockquote>tail</li></ul>', '- ***\n\n  \n\n  tail'],
      ['<ol><li><hr><blockquote><p></p></blockquote>tail</li></ol>', '1. ***\n\n   \n\n   tail'],
      ['<ul><li><ul><li><hr><blockquote><p></p></blockquote>tail</li></ul></li></ul>', '-\n  - ***\n\n    \n\n    tail'],
      ['<blockquote><ul><li><hr><blockquote><p></p></blockquote>tail</li></ul></blockquote>', '> - ***\n>\n>   \n>\n>   tail'],
      ['<ul><li><hr><blockquote><p>q</p></blockquote><p>tail</p></li></ul>', engineConfig.name === 'JavaScript Engine' ? '- ***\n\n  \n  >\n  > q\n\n  tail' : '- ***\n\n  \n  > q\n\n  tail'],
    ]
    for (const [html, expected] of cases)
      expect(htmlToMarkdown(html, { engine }), html).toBe(expected)
  })

  it('opens a quote after a rule in a list item on its own line', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const cases: [string, string][] = [
      ['<ul><li><hr><blockquote>q</blockquote></li></ul>', '- ***\n\n  \n  > q'],
      ['<ol><li><hr><blockquote>q</blockquote></li></ol>', '1. ***\n\n   \n   > q'],
      ['<ul><li><ul><li><hr><blockquote>q</blockquote></li></ul></li></ul>', '-\n  - ***\n\n    \n    > q'],
      ['<ul><li>a<hr> <blockquote><p>q</p><p>r</p></blockquote></li></ul>', engineConfig.name === 'JavaScript Engine' ? '- a\n\n  ---\n\n  \n  >\n  > q\n  >\n  > r' : '- a\n\n  ---\n\n  \n  > q\n  >\n  > r'],
      ['<ul><li><hr><blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- ***\n\n  \n  > > q'],
      ['<blockquote><ul><li><hr><blockquote>q</blockquote></li></ul></blockquote>', '> - ***\n>\n>   \n>   > q'],
      ['<ul><li><blockquote>t<hr><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > t\n  >\n  > ---\n  >\n  >\n  > > q'],
      ['<ul><li><hr><blockquote></blockquote></li></ul>', '- ***'],
    ]
    for (const [html, expected] of cases)
      expect(htmlToMarkdown(html, { engine }), html).toBe(expected)
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

it.each([
  ['replaces quote enter', '<ul><li><hr><blockquote>q</blockquote></li></ul>', { onNodeEnter: (element: ElementNode) => element.name === 'blockquote' ? 'custom' : undefined }, '- ***\n\n  custom q'],
  ['replaces quote exit', '<ul><li><hr><blockquote></blockquote>tail</li></ul>', { onNodeExit: (element: ElementNode) => element.name === 'blockquote' ? 'custom' : undefined }, '- ***\n\n  \ncustom tail'],
])('preserves list indentation when plugin output %s', async (_name, html, hooks, expected) => {
  const options = { plugins: [createPlugin(hooks)] }
  expect(jsHtmlToMarkdown(html, options)).toBe(expected)
  for (let width = 1; width <= html.length; width++) {
    const input = new ReadableStream<string>({
      start(controller) {
        for (let offset = 0; offset < html.length; offset += width)
          controller.enqueue(html.slice(offset, offset + width))
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of jsStreamHtmlToMarkdown(input, options))
      output += chunk
    expect(output, `width=${width}`).toBe(expected)
  }
})
