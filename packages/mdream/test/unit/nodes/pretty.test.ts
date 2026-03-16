import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('pretty $name', (engineConfig) => {
  it.skip('subsequent a', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<div><a href="b">a</a><a href="a">b</a></div>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[a](b) [b](a)')
  })
})
