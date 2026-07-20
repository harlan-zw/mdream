import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

// <template> content is inert: browsers never render it, so it must never leak
// into the Markdown output (issue #101 - "modern keyword stuffing").
describe.each(engines)('template tag handling $name', (engineConfig) => {
  it('excludes direct text content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Visible</p><template>Hidden keyword stuffing text</template><p>After</p>'
    expect(htmlToMarkdown(html, { engine })).toBe('Visible\n\nAfter')
  })

  it('excludes nested element content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Visible</p><template><p>Nested hidden</p><span>more</span></template><p>After</p>'
    expect(htmlToMarkdown(html, { engine })).toBe('Visible\n\nAfter')
  })

  it('is not confused by apostrophes or quotes in template content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<p>A</p><template>It's a "quoted" keyword</template><p>B</p>`
    expect(htmlToMarkdown(html, { engine })).toBe('A\n\nB')
  })

  it('closes correctly with an unbalanced quote inside', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<p>A</p><template>one ' unbalanced</template><p>B</p>`
    expect(htmlToMarkdown(html, { engine })).toBe('A\n\nB')
  })

  it('excludes content with attribute quotes in nested markup', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<p>A</p><template><a href="x">it's</a></template><p>B</p>`
    expect(htmlToMarkdown(html, { engine })).toBe('A\n\nB')
  })

  it('still renders script/style quote-aware content after a template', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<template>hidden</template><script>var x = "</p>"; var y = 'q';</script><p>B</p>`
    expect(htmlToMarkdown(html, { engine })).toBe('B')
  })
})
