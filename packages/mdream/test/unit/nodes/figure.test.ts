import { withMinimalPreset } from '@mdream/js'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('figure $name', (engineConfig) => {
  it('converts figure with image and figcaption', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><img src="photo.jpg" alt="A photo"><figcaption>Photo caption</figcaption></figure>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toContain('![A photo](photo.jpg)')
    expect(markdown).toContain('_Photo caption_')
  })

  it('converts figure with only an image', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><img src="photo.jpg" alt="A photo"></figure>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('![A photo](photo.jpg)')
  })

  it('preserves figure content with minimal preset', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<html><body><main><figure><img src="photo.jpg" alt="A photo"><figcaption>Caption</figcaption></figure></main></body></html>'
    const markdown = htmlToMarkdown(html, { ...withMinimalPreset(), engine }).markdown
    expect(markdown).toContain('![A photo](photo.jpg)')
    expect(markdown).toContain('_Caption_')
  })
})
