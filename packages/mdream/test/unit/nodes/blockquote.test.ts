import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('blockquotes $name', (engineConfig) => {
  it('converts blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>This is a quote</blockquote>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('> This is a quote')
  })

  it('handles nested blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>Outer quote<blockquote>Inner quote</blockquote></blockquote>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('> Outer quote\n> > Inner quote')
  })

  it('handles blockquotes with paragraphs', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote><p>First paragraph</p><p>Second paragraph</p></blockquote>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('> First paragraph Second paragraph')
  })

  it('handles complex nested blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote><p>Outer paragraph</p><blockquote><p>Inner paragraph</p></blockquote></blockquote>'
    const markdown = htmlToMarkdown(html, { engine }).markdown

    expect(markdown).toBe('> Outer paragraph\n> > Inner paragraph')
  })
  // test for > A quote with an ![image](image.jpg) inside.
  it('handles blockquotes with images', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>This is a quote with an <img src="image.jpg" alt="image"></blockquote>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('> This is a quote with an ![image](image.jpg)')
  })
})
