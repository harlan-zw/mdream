import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

async function stream(html: string, chunk: number): Promise<string> {
  const enc = new TextEncoder()
  const rs = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < html.length; i += chunk)
        controller.enqueue(enc.encode(html.slice(i, i + chunk)))
      controller.close()
    },
  })
  let out = ''
  for await (const c of streamHtmlToMarkdown(rs))
    out += c
  return out.trimEnd()
}

// issue #149: backslash escapes are inert inside GFM code, so backticks flow
// through literally and the code span / fence delimiter widens to contain them.
describe('code backtick escaping (issue #149)', () => {
  it('inline code widens the delimiter past an inner backtick run', () => {
    expect(htmlToMarkdown('<p>x: <code>a `b` c</code>.</p>')).toBe('x: `` a `b` c ``.')
  })

  it('inline code without backticks stays a single-backtick span', () => {
    expect(htmlToMarkdown('<p><code>plain()</code></p>')).toBe('`plain()`')
  })

  it('inline code touching a backtick pads and widens', () => {
    expect(htmlToMarkdown('<p><code>a`</code></p>')).toBe('`` a` ``')
    expect(htmlToMarkdown('<p><code>`b</code></p>')).toBe('`` `b ``')
  })

  it('fenced block widens the fence past a triple-backtick run', () => {
    expect(htmlToMarkdown('<pre><code>Contains ```triple``` inside.</code></pre>'))
      .toBe('````\nContains ```triple``` inside.\n````')
  })

  it('fenced block without backticks stays a triple-backtick fence', () => {
    expect(htmlToMarkdown('<pre><code>a\nb</code></pre>')).toBe('```\na\nb\n```')
  })

  it('streaming output matches one-shot at every chunk size', async () => {
    for (const html of [
      '<p>x: <code>a `b` c</code> done.</p>',
      '<pre><code>Contains ```triple``` inside.</code></pre>',
    ]) {
      const oneShot = htmlToMarkdown(html)
      for (let chunk = 1; chunk <= html.length; chunk++)
        expect(await stream(html, chunk)).toBe(oneShot)
    }
  })
})
