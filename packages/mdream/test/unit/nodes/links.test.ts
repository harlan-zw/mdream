import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('links $name', (engineConfig) => {
  it.each([
    [
      String.raw`<a href="x\" onclick=alert(1)">link</a>`,
      String.raw`[link](<x\\>)`,
    ],
    [
      String.raw`<a href="c:\path\" title=t>link</a>`,
      String.raw`[link](<c:\\path\\> "t")`,
    ],
    [
      `<a href=/a/b/>link</a>`,
      `[link](/a/b/)`,
    ],
  ])('keeps attribute tokenization browser-compatible for %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it('does not double escape protected link text', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<a href="/x">a[b] *c*</a>', { engine }))
      .toBe('[a\\[b\\] \\*c\\*](/x)')
  })

  it('converts simple links', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="https://example.com">Example</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Example](https://example.com)')
  })

  it('handles links with titles', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="https://example.com" title="Example Site">Example</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Example](https://example.com "Example Site")')
  })

  it('handles links in paragraphs', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Visit <a href="https://example.com">Example</a> for more info.</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('Visit [Example](https://example.com) for more info.')
  })

  it('handles links with only aria-label', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<a href="https://nuxt.new/s/v3" tabindex="-1" rel="noopener noreferrer" target="_blank" aria-label="Open on StackBlitz" class="focus:outline-none"><!--[--><!--[--><span class="absolute inset-0" aria-hidden="true"></span><!--]--><!--]--></a>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Open on StackBlitz](https://nuxt.new/s/v3)')
  })

  it('breaking title link', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<h2 id="new-project" class="relative text-2xl text-highlighted font-bold mt-12 mb-6 scroll-mt-[calc(48px+45px+var(--ui-header-height))] lg:scroll-mt-[calc(48px+var(--ui-header-height))] [&amp;>a]:focus-visible:outline-primary [&amp;>a>code]:border-dashed hover:[&amp;>a>code]:border-primary hover:[&amp;>a>code]:text-primary [&amp;>a>code]:text-xl/7 [&amp;>a>code]:font-bold [&amp;>a>code]:transition-colors"><a href="#new-project" class="group lg:ps-2 lg:-ms-2"><span class="absolute -ms-8 top-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 p-1 bg-elevated hover:text-primary rounded-md hidden lg:flex text-muted transition"><span class="iconify i-lucide:hash size-4 shrink-0" aria-hidden="true" style=""></span></span><!--[-->New Project<!--]--></a></h2>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('## [New Project](#new-project)')
  })

  it('handles same-document anchor links', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="#my-anchor">Jump to anchor</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Jump to anchor](#my-anchor)')
  })

  it('handles same-document anchor links with origin', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="#my-anchor">Jump to anchor</a>'
    const markdown = htmlToMarkdown(html, {
      origin: 'https://mydomain.com',
      engine,
    })
    expect(markdown).toBe('[Jump to anchor](#my-anchor)')
  })

  it('handles absolute URL with fragment', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="https://example.com/page#section">Link</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Link](https://example.com/page#section)')
  })

  it('handles relative path with fragment', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="/page#section">Link</a>'
    const markdown = htmlToMarkdown(html, {
      origin: 'https://example.com',
      engine,
    })
    expect(markdown).toBe('[Link](https://example.com/page#section)')
  })

  it('handles relative path with fragment without origin', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="/page#section">Link</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Link](/page#section)')
  })

  it.each([
    ['https://example.com', 'page.html', 'https://example.com/page.html'],
    ['https://example.com/', 'page.html', 'https://example.com/page.html'],
    ['https://example.com/docs/', 'page.html', 'https://example.com/docs/page.html'],
    ['https://example.com/docs/x.html?a=1#f', 'page.html', 'https://example.com/docs/page.html'],
    ['https://example.com', '../page.html', 'https://example.com/page.html'],
    // No scheme and authority to resolve against, so the origin is a prefix.
    ['docs', 'b.html', 'docs/b.html'],
  ])('resolves %s + %s', async (origin, href, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown(`<a href="${href}">Link</a>`, { origin, engine })
    expect(markdown).toBe(`[Link](${expected})`)
  })

  // RFC 3986 section 5.4, verbatim. The two references it resolves to the
  // base URI itself are left alone instead; see the test below.
  it.each([
    // 5.4.1 normal examples
    ['g:h', 'g:h'],
    ['g', 'http://a/b/c/g'],
    ['./g', 'http://a/b/c/g'],
    ['g/', 'http://a/b/c/g/'],
    ['/g', 'http://a/g'],
    ['//g', 'http://g'],
    ['?y', 'http://a/b/c/d;p?y'],
    ['g?y', 'http://a/b/c/g?y'],
    ['g#s', 'http://a/b/c/g#s'],
    ['g?y#s', 'http://a/b/c/g?y#s'],
    [';x', 'http://a/b/c/;x'],
    ['g;x', 'http://a/b/c/g;x'],
    ['g;x?y#s', 'http://a/b/c/g;x?y#s'],
    ['.', 'http://a/b/c/'],
    ['./', 'http://a/b/c/'],
    ['..', 'http://a/b/'],
    ['../', 'http://a/b/'],
    ['../g', 'http://a/b/g'],
    ['../..', 'http://a/'],
    ['../../', 'http://a/'],
    ['../../g', 'http://a/g'],
    // 5.4.2 abnormal examples
    ['../../../g', 'http://a/g'],
    ['../../../../g', 'http://a/g'],
    ['/./g', 'http://a/g'],
    ['/../g', 'http://a/g'],
    ['g.', 'http://a/b/c/g.'],
    ['.g', 'http://a/b/c/.g'],
    ['g..', 'http://a/b/c/g..'],
    ['..g', 'http://a/b/c/..g'],
    ['./../g', 'http://a/b/g'],
    ['./g/.', 'http://a/b/c/g/'],
    ['g/./h', 'http://a/b/c/g/h'],
    ['g/../h', 'http://a/b/c/h'],
    ['g;x=1/./y', 'http://a/b/c/g;x=1/y'],
    ['g;x=1/../y', 'http://a/b/c/y'],
    ['g?y/./x', 'http://a/b/c/g?y/./x'],
    ['g?y/../x', 'http://a/b/c/g?y/../x'],
    ['g#s/./x', 'http://a/b/c/g#s/./x'],
    ['g#s/../x', 'http://a/b/c/g#s/../x'],
    // Strict resolution: a scheme means absolute.
    ['http:g', 'http:g'],
  ])('resolves RFC 3986 reference %s', async (href, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown(`<a href="${href}">Link</a>`, {
      origin: 'http://a/b/c/d;p?q',
      engine,
    })
    expect(markdown).toBe(`[Link](${expected})`)
  })

  it.each([
    // A scheme opens with a letter, so these are relative references.
    ['3:16', 'http://a/b/c/3:16'],
    ['+x:y', 'http://a/b/c/+x:y'],
    ['a3:x', 'a3:x'],
  ])('resolves %s against its scheme rule', async (href, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown(`<a href="${href}">Link</a>`, {
      origin: 'http://a/b/c/d;p?q',
      engine,
    })
    expect(markdown).toBe(`[Link](${expected})`)
  })

  it('keeps an empty reference unresolved', async () => {
    // RFC 3986 resolves it to the base URI; the href stays as it is.
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<a href="">Link</a>', {
      origin: 'http://a/b/c/d;p?q',
      engine,
    })
    expect(markdown).toBe('[Link]()')
  })

  it('handles empty fragment', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="#">Link</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Link](#)')
  })

  it('handles fragment with special characters', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="#section-1_test">Link</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Link](#section-1_test)')
  })

  it('handles protocol-relative URL with fragment', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="//example.com/page#section">Link</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Link](https://example.com/page#section)')
  })

  it('handles anchor with title and fragment', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="#section" title="Go to section">Link</a>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Link](#section "Go to section")')
  })

  it('handles multiple links with text in paragraph', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p><a href="#top">Top</a> and <a href="#bottom">Bottom</a></p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[Top](#top) and [Bottom](#bottom)')
  })
})
