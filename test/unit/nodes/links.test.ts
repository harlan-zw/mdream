import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('links', () => {
  it('converts simple links', () => {
    const html = '<a href="https://example.com">Example</a>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('[Example](https://example.com)')
  })

  it('handles links with titles', () => {
    const html = '<a href="https://example.com" title="Example Site">Example</a>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('[Example](https://example.com "Example Site")')
  })

  it('handles links in paragraphs', () => {
    const html = '<p>Visit <a href="https://example.com">Example</a> for more info.</p>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('Visit [Example](https://example.com) for more info.')
  })

  it('handles links with only aria-label', () => {
    const html = `<a href="https://nuxt.new/s/v3" tabindex="-1" rel="noopener noreferrer" target="_blank" aria-label="Open on StackBlitz" class="focus:outline-none"><!--[--><!--[--><span class="absolute inset-0" aria-hidden="true"></span><!--]--><!--]--></a>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('[Open on StackBlitz](https://nuxt.new/s/v3)')
  })

  it('breaking title link', () => {
    const html = `<h2 id="new-project" class="relative text-2xl text-highlighted font-bold mt-12 mb-6 scroll-mt-[calc(48px+45px+var(--ui-header-height))] lg:scroll-mt-[calc(48px+var(--ui-header-height))] [&amp;>a]:focus-visible:outline-primary [&amp;>a>code]:border-dashed hover:[&amp;>a>code]:border-primary hover:[&amp;>a>code]:text-primary [&amp;>a>code]:text-xl/7 [&amp;>a>code]:font-bold [&amp;>a>code]:transition-colors"><a href="#new-project" class="group lg:ps-2 lg:-ms-2"><span class="absolute -ms-8 top-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 p-1 bg-elevated hover:text-primary rounded-md hidden lg:flex text-muted transition"><span class="iconify i-lucide:hash size-4 shrink-0" aria-hidden="true" style=""></span></span><!--[-->New Project<!--]--></a></h2>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`"## [New Project](#new-project)"`)
  })
})
