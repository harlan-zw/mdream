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

  it('drops the datalist of an input[list] pairing, keeping the rest', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<label>Browser</label><input list="b"><datalist id="b"><option>Chrome</option><option>Firefox</option></datalist><p>done</p>'
    expect(htmlToMarkdown(html, { engine })).toBe('Browser\n\ndone')
  })
})
