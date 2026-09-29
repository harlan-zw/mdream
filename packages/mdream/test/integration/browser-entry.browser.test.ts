import { describe, expect, it } from 'vitest'

// Resolves the `browser` export condition of the built package.
describe('mdream browser entry', () => {
  it('converts synchronously and returns a string, like the Node entry', async () => {
    const { htmlToMarkdown } = await import('mdream')
    const markdown = htmlToMarkdown('<html><head><title>Page</title></head><body><nav>Menu</nav><main><h1>Hello</h1></main></body></html>', { minimal: true })
    expect(markdown).toBe('---\ntitle: Page\n---\n\n# Hello')
  })
})
