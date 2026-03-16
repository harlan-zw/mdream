import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('headings $name', (engineConfig) => {
  it('converts h1', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h1>Heading 1</h1>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('# Heading 1')
  })

  it('converts h2', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h2>Heading 2</h2>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('## Heading 2')
  })

  it('converts h3', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h3>Heading 3</h3>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('### Heading 3')
  })

  it('converts h4', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h4>Heading 4</h4>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('#### Heading 4')
  })

  it('converts h5', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h5>Heading 5</h5>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('##### Heading 5')
  })

  it('converts h6', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h6>Heading 6</h6>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('###### Heading 6')
  })

  it('nested headers', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="/test"><h1>Heading 1</h1></a><ul><li><h2>Heading 2</h2></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[<h1>Heading 1</h1>](/test)\n\n- ## Heading 2')
  })
})
