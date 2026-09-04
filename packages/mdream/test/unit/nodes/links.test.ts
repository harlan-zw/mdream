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

  it.each([
    [
      '<details><a href="/x">a[b]</a></details>',
      '<details><a href="/x">a&#91;b&#93;</a></details>',
    ],
    [
      '<dl><dt>Term <a href="/term">link</a></dt><dd>Definition</dd></dl>',
      '<dl><dt>Term <a href="/term">link</a></dt>\n<dd>Definition</dd>\n</dl>',
    ],
    [
      '<details><a href="/x?a=1&amp;b=2" title="say &quot;hi&quot; &amp; bye">link</a></details>',
      '<details><a href="/x?a=1&amp;b=2" title="say &quot;hi&quot; &amp; bye">link</a></details>',
    ],
    [
      '<details><a href="/&#91;x&#93;" title="[Title] &amp; &amp;#91;">link</a></details>',
      '<details><a href="/&#91;x&#93;" title="&#91;Title&#93; &amp; &amp;#91;">link</a></details>',
    ],
    [
      '<details><a href="javascript:alert(1)">a[b]</a></details>',
      '<details>a[b]</details>',
    ],
  ])('preserves safe raw HTML links for %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    [
      '<details><a href="/x?utm_source=test&amp;keep=1">Link</a></details>',
      { urls: true },
      '<details><a href="/x?keep=1">Link</a></details>',
    ],
    [
      '<details><a href="#">Link</a></details>',
      { emptyLinks: true },
      '<details>Link</details>',
    ],
    [
      '<details><a href="/x"></a></details>',
      { emptyLinkText: true },
      '<details><a href="/x"></a></details>',
    ],
    [
      '<details><a href="#missing">Link</a></details>',
      { fragments: true },
      '<details><a href="#missing">Link</a></details>',
    ],
    [
      '<details><a href="https://example.com">https://example.com</a></details>',
      { redundantLinks: true },
      '<details><a href="https://example.com">https://example.com</a></details>',
    ],
    [
      '<details><h2><a href="#section">Section</a></h2></details>',
      { selfLinkHeadings: true },
      '<details>\n\n## <a href="#section">Section</a>\n\n</details>',
    ],
  ])('keeps raw HTML link cleanup boundaries for %s', async (html, clean, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { clean, engine })).toBe(expected)
  })

  it('keeps a balanced visible raw HTML link with clean enabled', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<details><a href="/x">Visible</a></details>', { clean: true, engine }))
      .toBe('<details><a href="/x">Visible</a></details>')
  })

  it.each([
    [{ enter: '{', exit: '}' }, '<details>{Link}</details>'],
    [{ enter: '[' }, '<details>[Link](/x)</details>'],
    [{ exit: '}' }, '<details><a href="/x">Link}</details>'],
  ])('preserves raw HTML link tag override %o', async (override, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<details><a href="/x">Link</a></details>', {
      engine,
      plugins: {
        tagOverrides: {
          a: override,
        },
      },
    })).toBe(expected)
  })

  it('keeps bracket text literal when an override replaces the raw link tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<details><a href="/x">a[b]</a></details>', {
      engine,
      plugins: {
        tagOverrides: {
          a: { enter: '{', exit: '}' },
        },
      },
    })).toBe('<details>{a[b]}</details>')
  })

  it('keeps bracket text literal when an override resembles a raw link tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<details><a href="/x">a[b]</a></details>', {
      engine,
      plugins: {
        tagOverrides: {
          a: { enter: '<abbr>', exit: '</abbr>' },
        },
      },
    })).toBe('<details><abbr>a[b]</abbr></details>')
  })

  it('does not promote an escaped raw HTML link attribute to an executable URL', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<details>\\<a href="[javascript:alert(1)](#)">Click</a></details>', {
      engine,
      clean: true,
    })).toBe('<details>\\<a href="&#91;javascript:alert(1)&#93;(#)">Click</a></details>')
  })

  it.each([
    ['[javascript:alert(1)](#missing)', { fragments: true }],
    ['[javascript:alert(1)](#)', { emptyLinks: true }],
    ['[javascript:alert(1)](javascript:alert(1))', { redundantLinks: true }],
    ['java![](#)script:alert(1)', { emptyImages: true }],
    ['java[](#)script:alert(1)', { emptyLinkText: true }],
    ['line one\n## [Title](#title)', { selfLinkHeadings: true }],
  ])('keeps raw HTML href %s opaque to its cleaner', async (href, clean) => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<details>\\<a href="${href}">Click</a></details>`
    expect(htmlToMarkdown(html, { clean, engine }))
      .toBe(html.replaceAll('[', '&#91;').replaceAll(']', '&#93;'))
  })

  it('keeps fragment links to headings containing raw HTML links', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<details><h2><a href="#section">Section</a></h2></details><p><a href="#section">jump</a></p>', {
      engine,
      clean: { fragments: true },
    })
    expect(markdown).toContain('## <a href="#section">Section</a>')
    expect(markdown).toContain('[jump](#section)')

    expect(htmlToMarkdown('<h2>&lt;http://x&gt;</h2><p><a href="#httpx">jump</a></p>', {
      engine,
      clean: { fragments: true },
    })).toContain('[jump](#httpx)')

    for (const heading of ['&lt;span&gt;', '<code>&lt;span&gt;</code>']) {
      expect(htmlToMarkdown(`<h2>${heading}</h2><p><a href="#span">jump</a></p>`, {
        engine,
        clean: { fragments: true },
      })).toContain('[jump](#span)')
    }

    expect(htmlToMarkdown('<h2><b></b></h2><p><a href="#foobar">jump</a></p>', {
      engine,
      clean: { fragments: true },
      plugins: { tagOverrides: { b: { enter: '`foo_bar' } } },
    })).toContain('[jump](#foobar)')

    for (const [heading, fragment] of [
      ['`foo_bar<span title="`"></span>', 'foobar'],
      ['`foo_bar\\<span title="`"></span>', 'foo_barspan-title'],
      ['`foo_bar\\\\<span title="`"></span>', 'foobar'],
    ]) {
      expect(htmlToMarkdown(`<h2><b></b></h2><p><a href="#${fragment}">jump</a></p>`, {
        engine,
        clean: { fragments: true },
        plugins: {
          tagOverrides: {
            b: { enter: heading, exit: '' },
          },
        },
      })).toContain(`[jump](#${fragment})`)
    }

    const visibleTagText = htmlToMarkdown('&lt;a title=&quot;<a href="#missing">jump</a>&quot;&gt;', {
      engine,
      clean: { fragments: true },
    })
    expect(visibleTagText).toContain('jump')
    expect(visibleTagText).not.toContain('[jump]')
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
