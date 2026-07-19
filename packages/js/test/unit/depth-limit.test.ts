import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

const LIMIT = 512

async function streamConvert(chunks: string[]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    output += chunk
  return output
}

describe('element depth limit', () => {
  it('leaves content at the limit unchanged', () => {
    const html = `${'<div>'.repeat(LIMIT)}deep${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toBe('deep')
  })

  it('stops conversion when nesting exceeds the limit', () => {
    const html = `<p>before</p>${'<div>'.repeat(100_000)}discarded`
    expect(htmlToMarkdown(html)).toBe('before')
  })

  it('does not count self-closing elements at the limit', () => {
    const html = `${'<div>'.repeat(LIMIT)}<br>kept${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toContain('kept')
  })

  it('applies implied-end recovery before checking the limit', () => {
    const output = htmlToMarkdown('<p>item'.repeat(1_000))
    expect(output.match(/item/g)).toHaveLength(1_000)
  })

  it('stops consuming streamed chunks after reaching the limit', async () => {
    const chunks = ['<p>before</p>']
    for (let i = 0; i < 10_000; i++)
      chunks.push('<div>')
    chunks.push('discarded')
    expect((await streamConvert(chunks)).trimEnd()).toBe('before')
  })

  it('does not leak content hidden at the limit', () => {
    const html = `${'<div>'.repeat(LIMIT - 1)}<template><strong>hidden</strong></template><p>discarded</p>`
    expect(htmlToMarkdown(html)).toBe('')
  })

  it('does not emit or pop a parent for a skipped CDATA override', () => {
    const html = `${'<div>'.repeat(LIMIT)}<![CDATA[hidden]]><p>discarded</p>`
    expect(htmlToMarkdown(html, {
      plugins: {
        tagOverrides: {
          '#cdata-section': { enter: '[', exit: ']', isInline: true, spacing: [0, 0] },
        },
      },
    })).toBe('')
  })
})
