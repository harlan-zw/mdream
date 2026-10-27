import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('horizontal Rules $name', (engineConfig) => {
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
