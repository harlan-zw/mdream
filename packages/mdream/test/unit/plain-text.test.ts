import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../utils/engines'

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let output = ''
  for await (const chunk of stream)
    output += chunk
  return output
}

describe.each(engines)('plain text output $name', (engineConfig) => {
  it('omits markdown markup from common document structure', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h1>Hello <em>World</em></h1><p>Visit <a href="https://example.com">Example</a> and <strong>read</strong>.</p><ul><li>One</li><li>Two</li></ul>'
    const text = htmlToMarkdown(html, { engine, format: 'text' })

    expect(text).toBe('Hello World\n\nVisit Example and read.\n\nOne\nTwo')
  })

  it('preserves readable separators without markdown tables or image syntax', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Line<br>Break</p><table><tr><th>Name</th><th>Role</th></tr><tr><td>Ada</td><td>Admin</td></tr></table><p><img src="/x.png" alt="Diagram"></p>'
    const text = htmlToMarkdown(html, { engine, format: 'text' })

    expect(text).toBe('Line\nBreak\n\nName\tRole\nAda\tAdmin\n\nDiagram')
  })

  it('matches streaming output', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h2>Title</h2><p>A <code>code</code> sample with <a href="/docs">docs</a>.</p>'
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html.slice(0, 20))
        controller.enqueue(html.slice(20))
        controller.close()
      },
    })

    const streamed = await collect(streamHtmlToMarkdown(stream, { engine, format: 'text' }))

    expect(streamed.trimEnd()).toBe('Title\n\nA code sample with docs.')
  })
})
