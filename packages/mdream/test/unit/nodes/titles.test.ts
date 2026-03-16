import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('h1 $name', (engineConfig) => {
  // <h1>1. Hello world</h1>
  it('avoids rendering as list', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h1>1. Hello world</h1>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('# 1. Hello world')
  })
})
