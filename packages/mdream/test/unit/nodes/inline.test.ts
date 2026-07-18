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

async function collectChunks(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of stream)
    chunks.push(chunk)
  return chunks
}

describe.each(engines)('text Formatting $name', (engineConfig) => {
  it('converts bold text with <strong>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <strong>bold</strong> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts bold text with <b>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <b>bold</b> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts italic text with <em>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <em>italic</em> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is _italic_ text')
  })

  it('converts italic text with <i>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <i>italic</i> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is _italic_ text')
  })

  it('handles nested formatting', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <strong><em>bold and italic</em></strong> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is **_bold and italic_** text')
  })
})

// Top-level text nodes (no block ancestor) used to be dropped (issue #93).
describe.each(engines)('top-level inline text $name', (engineConfig) => {
  it('keeps text before a top-level inline tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('foo <em>bar</em>', { engine })).toBe('foo _bar_')
  })

  it('keeps text between top-level inline tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<strong>a</strong> and <em>b</em>', { engine })).toBe('**a** and _b_')
  })

  it('keeps text between repeated top-level inline tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('a<strong>b</strong>c<strong>d</strong>', { engine })).toBe('a**b**c**d**')
  })
})

// Empty inline emphasis used to leak its markers into the output
// (<i class="icon"></i> → __, <b></b> → ****).
describe.each(engines)('empty inline emphasis $name', (engineConfig) => {
  it('drops markers for empty emphasis elements', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><b></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><strong></strong>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><i></i>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><em></em>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><del></del>x</p>', { engine })).toBe('x')
  })

  it('drops markers for whitespace-only emphasis', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><strong> </strong>x</p>', { engine })).toBe('x')
  })

  it('drops an empty icon <i> before text', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p class="rc-scout__text"><i class="rc-scout__logo"></i>You might also like the Recurse Center</p>'
    expect(htmlToMarkdown(html, { engine })).toBe('You might also like the Recurse Center')
  })

  it('drops empty emphasis inside headings and list items', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<h2><i class="icon"></i>Title</h2>', { engine })).toBe('## Title')
    expect(htmlToMarkdown('<ul><li><b></b>x</li></ul>', { engine })).toBe('- x')
  })

  it('drops nested empty emphasis entirely', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><b><i></i></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><b><b></b></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><b><i><del></del></i></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><b><i></i><i></i></b>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><del><del></del></del>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><strong><b></b></strong>x</p>', { engine })).toBe('x')
    expect(htmlToMarkdown('<p><strong><em><b></b></em></strong>x</p>', { engine })).toBe('x')
  })

  it('drops markers for an empty figcaption', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<figure><figcaption></figcaption></figure>', { engine })).toBe('')
  })

  it('keeps non-empty emphasis untouched', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><b>hi</b></p>', { engine })).toBe('**hi**')
    expect(htmlToMarkdown('<p><b><em>x</em></b></p>', { engine })).toBe('**_x_**')
    expect(htmlToMarkdown('<p><b><img src="x.png" alt="y"></b></p>', { engine })).toBe('**![y](x.png)**')
  })

  it('does not mistake literal marker text at the tail for an empty pair', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p><b>x<span>**</span></b></p>', { engine })).toBe('**x****')
  })

  it('drops empty emphasis at every stream split point', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>before <b></b><i class="icon"></i>after</p>'
    for (let i = 1; i < html.length; i++) {
      const result = await collect(streamHtmlToMarkdown(chunkedStream([html.slice(0, i), html.slice(i)]), { engine }))
      expect(result.trim(), `split at ${i}`).toBe('before after')
    }
  })

  it('keeps override emphasis markers on empty elements', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    // An override emitting the built-in marker opts out of empty-pair cleanup.
    const markdown = htmlToMarkdown('<p><b></b>x</p>', {
      plugins: { tagOverrides: { b: { enter: '**', exit: '**' } } },
      engine,
    })
    expect(markdown).toBe('****x')
  })

  it('releases non-text content inside open emphasis while streaming', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    // The <img> makes <b> non-empty, so its markdown must be yielded before </b>
    // arrives instead of staying buffered until the emphasis closes.
    const chunks = await collectChunks(streamHtmlToMarkdown(
      chunkedStream(['<p><b><img src="x.png" alt="y"><span>', 'more</span></b></p>']),
      { engine },
    ))
    expect(chunks.slice(0, -1).join(''), 'image held until close').toContain('![y](x.png)')
    expect(chunks.join('').trim()).toBe('**![y](x.png)more**')
  })
})
