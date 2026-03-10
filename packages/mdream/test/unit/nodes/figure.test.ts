import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.ts'
import { withMinimalPreset } from '../../../src/preset/minimal.ts'

describe('figure', () => {
  it('converts figure with image and figcaption', () => {
    const html = '<figure><img src="photo.jpg" alt="A photo"><figcaption>Photo caption</figcaption></figure>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toContain('![A photo](photo.jpg)')
    expect(markdown).toContain('_Photo caption_')
  })

  it('converts figure with only an image', () => {
    const html = '<figure><img src="photo.jpg" alt="A photo"></figure>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('![A photo](photo.jpg)')
  })

  it('preserves figure content with minimal preset', () => {
    const html = '<html><body><main><figure><img src="photo.jpg" alt="A photo"><figcaption>Caption</figcaption></figure></main></body></html>'
    const markdown = htmlToMarkdown(html, withMinimalPreset())
    expect(markdown).toContain('![A photo](photo.jpg)')
    expect(markdown).toContain('_Caption_')
  })
})
