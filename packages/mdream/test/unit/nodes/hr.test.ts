import type { ElementNode } from '@mdream/js'
import { createPlugin, htmlToMarkdown as jsHtmlToMarkdown, streamHtmlToMarkdown as jsStreamHtmlToMarkdown } from '@mdream/js'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('horizontal Rules $name', (engineConfig) => {
  it.each([
    ['<ul><li><hr><blockquote><br></blockquote>tail</li></ul>', '- ***\n\n  tail'],
    ['<blockquote><ul><li><hr><blockquote><p><br></p></blockquote><blockquote><p><br></p></blockquote>tail</li></ul></blockquote>', '> - ***\n>\n>   tail'],
    ['<ul><li><hr><blockquote></blockquote><blockquote></blockquote>tail</li></ul>', '- ***\n\n  tail'],
    ['<blockquote><ul><li><hr><blockquote></blockquote><blockquote></blockquote>tail</li></ul></blockquote>', '> - ***\n>\n>   tail'],
    ['<blockquote><ul><li><blockquote>x<hr></blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - \n>   > x\n>   >\n>   > ---\n>\n>   > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote>q</blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n\n  > q'],
    ['<ul><li><hr><blockquote></blockquote><blockquote>q</blockquote></li></ul>', '- ***\n\n  > q'],
    ['<blockquote><ul><li><blockquote>x<hr></blockquote><blockquote></blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - \n>   > x\n>   >\n>   > ---\n>\n>   > q'],
  ])('preserves pending rule quote review boundaries: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><hr><blockquote></blockquote>tail</li></ul>', 'END', '- ***\n\n  END tail'],
    ['<ul><li><hr><blockquote></blockquote></li></ul>', 'END', '- ***\n\n  END'],
    ['<ul><li><hr><blockquote><p></p></blockquote><p>tail</p></li></ul>', 'END', '- ***\n\n  END\n\n  tail'],
    ['<ol><li><hr><blockquote></blockquote>tail</li></ol>', 'END', '1. ***\n\n   END tail'],
    ['<ul><li><ul><li><hr><blockquote></blockquote>tail</li></ul></li></ul>', 'END', '-\n  - ***\n\n    END tail'],
    ['<ul><li><hr><blockquote></blockquote><blockquote></blockquote>tail</li></ul>', 'END', '- ***\n\n  END\nEND tail'],
    ['<ul><li><hr><blockquote>q</blockquote>tail</li></ul>', 'END', '- ***\n\n  > qEND tail'],
    ['<ul><li><hr><blockquote><blockquote></blockquote></blockquote>tail</li></ul>', 'END', '- ***\n\n  > ENDEND tail'],
    ['<ul><li><hr><blockquote><blockquote>q</blockquote></blockquote>tail</li></ul>', 'END', '- ***\n\n  > > qENDEND tail'],
    ['<ul><li><hr><blockquote></blockquote>tail</li></ul>', '', '- ***\n\n  tail'],
    ['<ul><li><hr><blockquote></blockquote>tail</li></ul>', ' ', '- ***\n\n tail'],
  ])('keeps the list separator before quote exit override output: %s with %j', async (html, exit, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, plugins: { tagOverrides: { blockquote: { exit } } } })).toBe(expected)
  })

  it('converts hr elements', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })

  it('restores list continuation after an empty quote following a rule', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const cases: [string, string][] = [
      ['<ul><li><hr><blockquote><p></p></blockquote>tail</li></ul>', '- ***\n\n  tail'],
      ['<ol><li><hr><blockquote><p></p></blockquote>tail</li></ol>', '1. ***\n\n   tail'],
      ['<ul><li><ul><li><hr><blockquote><p></p></blockquote>tail</li></ul></li></ul>', '-\n  - ***\n\n    tail'],
      ['<blockquote><ul><li><hr><blockquote><p></p></blockquote>tail</li></ul></blockquote>', '> - ***\n>\n>   tail'],
      ['<ul><li><hr><blockquote><p>q</p></blockquote><p>tail</p></li></ul>', '- ***\n\n  > q\n\n  tail'],
    ]
    for (const [html, expected] of cases)
      expect(htmlToMarkdown(html, { engine }), html).toBe(expected)
  })

  it('opens a quote after a rule in a list item on its own line', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const cases: [string, string][] = [
      ['<ul><li><hr><blockquote>q</blockquote></li></ul>', '- ***\n\n  > q'],
      ['<ol><li><hr><blockquote>q</blockquote></li></ol>', '1. ***\n\n   > q'],
      ['<ul><li><ul><li><hr><blockquote>q</blockquote></li></ul></li></ul>', '-\n  - ***\n\n    > q'],
      ['<ul><li>a<hr> <blockquote><p>q</p><p>r</p></blockquote></li></ul>', '- a\n\n  ---\n\n  > q\n  >\n  > r'],
      ['<ul><li><hr><blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- ***\n\n  > > q'],
      ['<blockquote><ul><li><hr><blockquote>q</blockquote></li></ul></blockquote>', '> - ***\n>   > q'],
      ['<ul><li><blockquote>t<hr><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > t\n  >\n  > ---\n  > > q'],
      ['<ul><li><hr><blockquote></blockquote></li></ul>', '- ***'],
    ]
    for (const [html, expected] of cases)
      expect(htmlToMarkdown(html, { engine }), html).toBe(expected)
  })
})

it.each([
  ['replaces quote enter', '<ul><li><hr><blockquote>q</blockquote></li></ul>', { onNodeEnter: (element: ElementNode) => element.name === 'blockquote' ? 'custom' : undefined }, '- ***\n\n  custom q'],
  ['replaces quote exit', '<ul><li><hr><blockquote></blockquote>tail</li></ul>', { onNodeExit: (element: ElementNode) => element.name === 'blockquote' ? 'custom' : undefined }, '- ***\n\n  custom tail'],
])('preserves list indentation when plugin output %s', async (_name, html, hooks, expected) => {
  const options = { plugins: [createPlugin(hooks)] }
  expect(jsHtmlToMarkdown(html, options)).toBe(expected)
  for (let width = 1; width <= html.length; width++) {
    const input = new ReadableStream<string>({
      start(controller) {
        for (let offset = 0; offset < html.length; offset += width)
          controller.enqueue(html.slice(offset, offset + width))
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of jsStreamHtmlToMarkdown(input, options))
      output += chunk
    expect(output, `width=${width}`).toBe(expected)
  }
})
