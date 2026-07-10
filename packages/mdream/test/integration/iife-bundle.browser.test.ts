import { describe, expect, it } from 'vitest'

// The shipped browser global (dist/iife.js) is hand-assembled in
// build.config.ts's `end` hook (inlined WASM + inlined resolve-options). This
// end-to-end test guards that glue so the <script> global honours the same
// content-isolation options as the module builds. Requires `pnpm build` first
// (CI builds before running the browser project).
describe('iife browser global (dist/iife.js)', () => {
  it('exposes window.mdream and honours minimal/isolateMain/filter', async () => {
    // Importing the IIFE executes it and assigns window.mdream (auto-inits WASM).
    await import('../../dist/iife.js' as string)
    const mdream = (window as any).mdream
    expect(mdream, 'window.mdream should be defined by the IIFE bundle — did you run `pnpm build`?').toBeDefined()

    const html = `<!DOCTYPE html><html><head><title>Doc</title></head><body>`
      + `<header><nav>Site Nav - Home</nav></header>`
      + `<main><h1>Real Content</h1><p>Only this should survive.</p></main>`
      + `<footer><p>Footer junk</p></footer></body></html>`

    const raw = mdream.htmlToMarkdown(html, {}).markdown
    // Without options the chrome leaks through (baseline).
    expect(raw).toContain('Site Nav')

    const isolated = mdream.htmlToMarkdown(html, {
      minimal: true,
      isolateMain: true,
      filter: { exclude: ['header', 'footer', 'nav'] },
    }).markdown

    expect(isolated).toContain('# Real Content')
    expect(isolated).not.toContain('Site Nav')
    expect(isolated).not.toContain('Footer junk')
  })
})
