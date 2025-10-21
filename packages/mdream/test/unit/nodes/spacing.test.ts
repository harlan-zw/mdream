import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src'

describe('spacing', () => {
  it('preserves new lines edge case', () => {
    const html = `<div class="group relative block px-4 py-3 rounded-md text-sm/6 my-5 last:mb-0 [&amp;_code]:text-xs/5 [&amp;_code]:bg-default [&amp;_pre]:bg-default [&amp;>div]:my-2.5 [&amp;_ul]:my-2.5 [&amp;_ol]:my-2.5 [&amp;>*]:last:!mb-0 [&amp;_ul]:ps-4.5 [&amp;_ol]:ps-4.5 [&amp;_li]:my-0 transition-colors border border-muted bg-muted text-default border-dashed hover:border-inverted"><a href="/docs/guide/concepts" tabindex="-1" aria-label="Nuxt Concepts" class="focus:outline-none"><!--[--><!--[--><span class="absolute inset-0" aria-hidden="true"></span><!--]--><!--]--></a><span class="iconify i-lucide:bookmark size-4 shrink-0 align-sub me-1.5 transition-colors text-highlighted" aria-hidden="true" style=""></span><!----><!--[--><!--[--> Read more in <span class="font-bold">Nuxt Concepts</span>. <!--]--><!--]--></div>`
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`"[Nuxt Concepts](/docs/guide/concepts) Read more in Nuxt Concepts."`)
  })
  it('spacing between block elements inside a', () => {
    const html = `<a href="/docs/getting-started/introduction" class="group block px-6 py-8 rounded-lg border border-default hover:bg-elevated/50 focus-visible:outline-primary transition-colors"><!--[--><!--[--><!--[--><div class="inline-flex items-center rounded-full p-1.5 bg-elevated group-hover:bg-primary/10 ring ring-accented mb-4 group-hover:ring-primary/50 transition"><!--[--><span class="iconify i-lucide:info size-5 shrink-0 text-highlighted group-hover:text-primary transition-[color,translate] group-active:-translate-x-0.5" aria-hidden="true" style=""></span><!--]--></div><p class="font-medium text-[15px] text-highlighted mb-1 truncate"><!--[-->Introduction<!--]--></p><p class="text-sm text-muted line-clamp-2"><!--[-->Nuxt's goal is to make web development intuitive and performant with a great Developer Experience in mind.<!--]--></p><!--]--><!--]--><!--]--></a>`
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`"[Introduction Nuxt's goal is to make web development intuitive and performant with a great Developer Experience in mind.](/docs/getting-started/introduction)"`)
  })
  it('misc pre code', () => {
    const html = `<div class="relative group [&amp;>pre]:rounded-t-none [&amp;>pre]:my-0 my-5" style="" tabindex="-1" id="reka-tabs-v-0-17-24-17-0-content-3" role="tabpanel" data-state="active" data-orientation="horizontal" aria-labelledby="reka-tabs-v-0-17-24-17-0-trigger-3"><!----><!--[--><!--[--><button type="button" aria-label="Copy code to clipboard" tabindex="-1" class="rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 text-xs gap-1.5 ring ring-inset ring-accented text-default bg-default hover:bg-elevated disabled:bg-default aria-disabled:bg-default focus:outline-none focus-visible:ring-2 focus-visible:ring-inverted p-1.5 absolute top-[11px] right-[11px] lg:opacity-0 lg:group-hover:opacity-100 transition"><!--[--><!--[--><span class="iconify i-lucide:copy shrink-0 size-4" aria-hidden="true" style=""></span><!--]--><!--[--><!----><!--]--><!--[--><!----><!--]--><!--]--></button><!--]--><!--]--><pre class="group font-mono text-sm/6 border border-muted bg-muted rounded-md px-4 py-3 whitespace-pre-wrap break-words overflow-x-auto focus:outline-none language-bash shiki shiki-themes material-theme-lighter material-theme-lighter material-theme-palenight" style="" tabindex="-1" id="reka-tabs-v-0-17-24-17-0-content-3" role="tabpanel" data-state="active" data-orientation="horizontal" aria-labelledby="reka-tabs-v-0-17-24-17-0-trigger-3"><!--[--><code><span class="line" line="1"><span class="s52Pk">bun</span><span class="sGFVr"> run</span><span class="sGFVr"> dev</span><span class="sGFVr"> -o
</span></span><span class="line" line="2"><span emptylineplaceholder="true">
</span></span><span class="line" line="3"><span class="sWuyu"># To use the Bun runtime during development
</span></span><span class="line" line="4"><span class="sWuyu"># bun --bun run dev -o
</span></span></code><!--]--></pre></div>`
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "\`\`\`
      bun run dev -o

      # To use the Bun runtime during development
      # bun --bun run dev -o
      \`\`\`"
    `)
  })

  it('comments between', () => {
    const html = `<div>Last updated on<!-- --> <!-- -->March 12, 2025</div>`
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`"Last updated on March 12, 2025"`)
  })

  it('adjacent links should have space between them', () => {
    const html = '<div><a href="b">a</a><a href="a">b</a></div>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`"[a](b) [b](a)"`)
  })

  it('block elements inside inline elements should have proper spacing', () => {
    const html = '<span><h4>Heading</h4><p>This is a paragraph with <strong>bold</strong> text.</p></span>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "#### Heading

      This is a paragraph with **bold** text."
    `)
  })
})
