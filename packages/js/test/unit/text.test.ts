import { describe, expect, it } from 'vitest'
import { htmlToText, streamHtmlToText } from '../../src/text'

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let output = ''
  for await (const chunk of stream)
    output += chunk
  return output
}

describe('htmlToText', () => {
  it('omits markdown markup from common document structure', () => {
    const html = '<h1>Hello <em>World</em></h1><p>Visit <a href="https://example.com">Example</a> and <strong>read</strong>.</p><ul><li>One</li><li>Two</li></ul>'

    expect(htmlToText(html)).toBe('Hello World\n\nVisit Example and read.\n\nOne\nTwo')
  })

  it('preserves readable separators without markdown table or image syntax', () => {
    const html = '<p>Line<br>Break</p><table><tr><th>Name</th><th>Role</th></tr><tr><td>Ada</td><td>Admin</td></tr></table><p><img src="/x.png" alt="Diagram"></p>'

    expect(htmlToText(html)).toBe('Line\nBreak\n\nName\tRole\nAda\tAdmin\n\nDiagram')
  })

  it('skips inert content', () => {
    const html = '<p>Before</p><script>visible()</script><template>Hidden</template><style>.x{color:red}</style><p>After</p>'

    expect(htmlToText(html)).toBe('Before\n\nAfter')
  })

  it('wraps prose when requested', () => {
    const html = '<p>Alpha beta gamma delta epsilon</p>'

    expect(htmlToText(html, { wrapWidth: 16 })).toBe('Alpha beta gamma\ndelta epsilon')
  })

  it('matches streaming output', async () => {
    const html = '<h2>Title</h2><p>A <code>code</code> sample with <a href="/docs">docs</a>.</p>'
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html.slice(0, 20))
        controller.enqueue(html.slice(20))
        controller.close()
      },
    })

    const streamed = await collect(streamHtmlToText(stream))

    expect(streamed.trimEnd()).toBe('Title\n\nA code sample with docs.')
  })
})
