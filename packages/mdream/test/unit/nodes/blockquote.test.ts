import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('blockquotes $name', (engineConfig) => {
  it('converts blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>This is a quote</blockquote>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('> This is a quote')
  })

  it('handles nested blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>Outer quote<blockquote>Inner quote</blockquote></blockquote>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('> Outer quote\n> > Inner quote')
  })

  it('handles blockquotes with paragraphs', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote><p>First paragraph</p><p>Second paragraph</p></blockquote>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('> First paragraph\n>\n> Second paragraph')
  })

  it('handles complex nested blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote><p>Outer paragraph</p><blockquote><p>Inner paragraph</p></blockquote></blockquote>'
    const markdown = htmlToMarkdown(html, { engine })

    expect(markdown).toBe('> Outer paragraph\n> > Inner paragraph')
  })
  // test for > A quote with an ![image](image.jpg) inside.
  it('handles blockquotes with images', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>This is a quote with an <img src="image.jpg" alt="image"></blockquote>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('> This is a quote with an ![image](image.jpg)')
  })

  it.each([
    [
      'unordered lists',
      '<blockquote><ul><li>one</li><li>two</li></ul></blockquote>',
      '> - one\n> - two',
    ],
    [
      'ordered lists',
      '<blockquote><ol><li>one</li><li>two</li></ol></blockquote>',
      '> 1. one\n> 2. two',
    ],
    [
      'paragraphs followed by lists',
      '<blockquote><p>intro</p><ul><li>one</li></ul></blockquote>',
      '> intro\n>\n> - one',
    ],
    [
      'text followed by headings',
      '<blockquote>text<h2>H</h2></blockquote>',
      '> text\n>\n> ## H',
    ],
    [
      'horizontal rules',
      '<blockquote>a<hr>b</blockquote>',
      '> a\n>\n> ---\n> b',
    ],
    [
      'sibling divs',
      '<blockquote><div>a</div><div>b</div></blockquote>',
      '> a\n>\n> b',
    ],
    [
      'tables surrounded by text',
      '<blockquote>lead<table><tr><td>a</td></tr></table>tail</blockquote>',
      '> lead\n>\n> | a |\n> | --- |\n>\n> tail',
    ],
    [
      'section surrounded by text',
      '<blockquote>lead<section>x</section>tail</blockquote>',
      '> lead\n>\n> x\n> tail',
    ],
    [
      'article surrounded by text',
      '<blockquote>lead<article>x</article>tail</blockquote>',
      '> lead\n>\n> x\n> tail',
    ],
    [
      'nav surrounded by text',
      '<blockquote>lead<nav>x</nav>tail</blockquote>',
      '> lead\n>\n> x\n> tail',
    ],
    [
      'figure surrounded by text',
      '<blockquote>lead<figure>x</figure>tail</blockquote>',
      '> lead\n>\n> x\n> tail',
    ],
    [
      'nested lists',
      '<blockquote><ul><li>one<ul><li>sub</li></ul></li></ul></blockquote>',
      '> - one\n>   - sub',
    ],
    [
      'blockquotes nested in list items',
      '<ul><li><blockquote><ul><li>x</li><li>y</li></ul></blockquote></li></ul>',
      '- \n  > - x\n  > - y',
    ],
  ])('keeps %s inside the quote', async (_name, html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it('keeps representative quote structure across every stream split', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><blockquote><ul><li>x</li><li>y</li></ul></blockquote></li></ul>'
    const expected = htmlToMarkdown(html, { engine })

    for (let split = 0; split <= html.length; split++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(stream))
        actual += chunk
      expect(actual, `split ${split}`).toBe(expected)
    }
  })
})
