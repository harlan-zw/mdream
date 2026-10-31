import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../../utils/engines'

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

  it.each([
    ['<h2>a<em>x </em><br>x</h2>', '## a*x* <br>x', undefined],
    ['<h2><em>x </em><br><br>x</h2>', '## *x* <br><br>x', undefined],
    ['<h2>a<a href="/l">x </a><br>x</h2>', '## a [x](/l) <br>x', undefined],
    ['<table><tr><td>a<em>x </em><br>x</td></tr></table>', '| a*x* <br>x |\n| --- |', undefined],
    ['<h2>a<em>x </em><br>x</h2>', '## a*x* <br>x', { br: 'br' }],
    ['<h2>a<em>x </em><br>x</h2>', '## a*x* <br>x', { br: { spacing: [0, 0] as [number, number] } }],
    // A Markdown hard break still subsumes the space.
    ['<p>a<em>x </em><br>x</p>', 'a*x*  \nx', undefined],
  ])('keeps an inline element\'s trailing space before a raw <br>: %s', async (html, expected, tagOverrides) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = { engine, plugins: tagOverrides && { tagOverrides } }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output).toBe(expected)
    }
  })
})
