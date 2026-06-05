import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

// <datalist> holds <option> autocomplete data that browsers never render, so it
// must not leak into the Markdown (spec-inert, like <template>/<script>).
describe.each(engines)('datalist tag handling $name', (engineConfig) => {
  it('drops datalist option content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>a</p><datalist><option value="V">HiddenLabel</option></datalist><p>b</p>'
    expect(htmlToMarkdown(html, { engine })).toBe('a\n\nb')
  })

  it('drops multiple options', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>a</p><datalist id="x"><option>One</option><option>Two</option></datalist><p>b</p>'
    expect(htmlToMarkdown(html, { engine })).toBe('a\n\nb')
  })

  it('still renders the associated input', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>before</p><datalist><option>x</option></datalist><p>after</p>'
    expect(htmlToMarkdown(html, { engine })).toBe('before\n\nafter')
  })
})
