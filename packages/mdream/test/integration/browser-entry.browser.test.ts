import { describe, expect, it } from 'vitest'

// Resolves the built package with the `browser` export condition.
describe('mdream browser entry', () => {
  it('resolves options like the Node entry and returns a Promise of the string', async () => {
    const { htmlToMarkdown } = await import('mdream/browser')
    const markdown = await htmlToMarkdown('<html><head><title>Page</title></head><body><nav>Menu</nav><main><h1>Hello</h1></main></body></html>', { minimal: true })
    expect(markdown).toBe('---\ntitle: Page\n---\n\n# Hello')
  })

  it('throws a TypeError from the root entry that names mdream/browser', async () => {
    const { htmlToMarkdown } = await import('mdream')
    const call = () => htmlToMarkdown('<h1>Hello</h1>')
    expect(call).toThrow(TypeError)
    expect(call).toThrow('import htmlToMarkdown from \'mdream/browser\'')
  })
})
