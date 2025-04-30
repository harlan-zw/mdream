import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('lists', () => {
  it('converts unordered lists', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('- Item 1\n- Item 2')
  })

  it('converts ordered lists', async () => {
    const html = '<ol><li>First</li><li>Second</li></ol>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('1. First\n2. Second')
  })

  it('handles nested unordered lists', async () => {
    const html = '<ul><li>Level 1<ul><li>Level 2</li></ul></li><li>Another Level 1</li></ul>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('- Level 1\n  - Level 2\n- Another Level 1')
  })

  it('handles nested ordered lists', async () => {
    const html = '<ol><li>Level 1<ol><li>Level 1.1</li></ol></li><li>Level 2</li></ol>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('1. Level 1\n  1. Level 1.1\n2. Level 2')
  })

  it('handles mixed nested lists', async () => {
    const html = '<ul><li>Unordered<ol><li>Ordered</li></ol></li></ul>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('- Unordered\n  1. Ordered')
  })

  it('complex list github nav', () => {
    const html = `<div class="mr-auto width-full" data-search="breadcrumbs"><nav data-testid="breadcrumbs-header" class="f5 breadcrumbs Breadcrumbs_breadcrumbs__xAC4i" aria-label="Breadcrumb" data-container="breadcrumbs"><ul><li class="d-inline-block"><a rel="" data-testid="breadcrumb-link" title="Get started" class="Link--primary mr-2 color-fg-muted" href="/en/get-started">Get started</a><span class="color-fg-muted pr-2">/</span></li><li class="d-inline-block"><a rel="" data-testid="breadcrumb-link" title="Writing on GitHub" class="Link--primary mr-2 color-fg-muted" href="/en/get-started/writing-on-github">Writing on GitHub</a><span class="color-fg-muted pr-2">/</span></li><li class="d-inline-block"><a rel="" data-testid="breadcrumb-link" title="Start writing on GitHub" class="Link--primary mr-2 color-fg-muted" href="/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github">Start writing on GitHub</a><span class="color-fg-muted pr-2">/</span></li><li class="d-inline-block"><a rel="" data-testid="breadcrumb-link" title="Basic formatting syntax" class="Link--primary mr-2 color-fg-muted" href="/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax">Basic formatting syntax</a></li></ul></nav></div>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "- [Get started](/en/get-started)/
      - [Writing on GitHub](/en/get-started/writing-on-github)/
      - [Start writing on GitHub](/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github)/
      - [Basic formatting syntax](/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)"
    `)
  })
})
