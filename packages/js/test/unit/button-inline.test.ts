import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

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
  return output.trimEnd()
}

// <button> is inline but previously inherited block-default spacing, so it
// injected a paragraph break that stranded trailing text/punctuation and split
// adjacent buttons across lines (issue #133). Mirrors the Rust engine's
// `adjacent_buttons_stay_inline` regression.

describe('<button> inline spacing', () => {
  it('keeps adjacent buttons on one line', () => {
    expect(htmlToMarkdown('<button>One</button><button>Two</button>')).toBe('OneTwo')
  })

  it('does not strand trailing punctuation', () => {
    expect(htmlToMarkdown('<p>Click <button>Go</button>!</p>')).toBe('Click Go!')
  })

  it('preserves source whitespace between adjacent buttons', () => {
    expect(htmlToMarkdown('<button>One</button> <button>Two</button>')).toBe('One Two')
  })

  it('preserves the separator across stream boundaries', async () => {
    const html = '<button>One</button> <button>Two</button>'
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split at byte ${split}`).toBe('One Two')
  })
})
