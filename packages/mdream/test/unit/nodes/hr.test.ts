import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('horizontal Rules $name', (engineConfig) => {
  it('converts hr elements', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })
})
