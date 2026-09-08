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
      '<details><a href="/&#91;x&#93;" title="🙂[Title] &amp; &amp;#91; &lt;&gt;&quot;">link</a></details>',
      '<details><a href="/&#91;x&#93;" title="🙂&#91;Title&#93; &amp; &amp;#91; &lt;&gt;&quot;">link</a></details>',
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

  it.each([
    [
      '<a href="/edit" title="Edit"><img src="/edit.svg" alt="Edit"></a>',
      '[![Edit](/edit.svg)](/edit "Edit")',
    ],
    [
      '<a href="/x" title="Title"><img src="/i" alt="Alt"></a>',
      '[![Alt](/i)](/x "Title")',
    ],
    [
      '<a href="/x" aria-label="Open"><img src="/i" alt="Alt"></a>',
      '[![Alt](/i)](/x)',
    ],
    [
      '<a href="/x" title="Title"><span><span><img src="/i" alt="Alt"></span></span></a>',
      '[![Alt](/i)](/x "Title")',
    ],
    [
      '<div><a href="/x"><span><img src="/i" alt="Alt"> </span></a>Caption</div>',
      '[![Alt](/i)](/x) Caption',
    ],
    [
      '<div><a href="/x"><x-wrap><img src="/i" alt="A"></x-wrap></a> Caption</div>',
      '[![A](/i)](/x) Caption',
    ],
  ])('treats a rendered image as link content for %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it('marks block and anchor content scopes for linked images', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<a href="/x" title="Title"><div><img src="/i" alt="Alt"> after</div></a>', { engine }))
      .toBe('[![Alt](/i) after](/x "Title")')

    const plugins = {
      tagOverrides: {
        'x-block': { enter: '', exit: '', spacing: [0, 0] as [number, number], isInline: false },
      },
    }
    expect(htmlToMarkdown('<div><a href="/x" title="Title"><x-block><img src="/i" alt="Alt"> after</x-block></a></div>', { engine, plugins }))
      .toBe('[![Alt](/i) after](/x "Title")')
    expect(htmlToMarkdown('<div><a href="/x"><x-block><img src="/i" alt="Alt"></x-block></a> <span>after</span></div>', { engine, plugins }))
      .toBe('[![Alt](/i)](/x) after')

    const inheritedInline = {
      tagOverrides: {
        'x-wrap': { enter: '', exit: '', spacing: [0, 0] as [number, number] },
      },
    }
    expect(htmlToMarkdown('<div><a href="/x"><x-wrap><img src="/i" alt="A"></x-wrap></a> Caption</div>', { engine, plugins: inheritedInline }))
      .toBe('[![A](/i)](/x) Caption')
  })

  it('keeps whitespace after a linked image', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<a href="/x"><img src="/i" alt="A"> </a>Caption', { engine }))
      .toBe('[![A](/i)](/x) Caption')
  })

  it('preserves empty-image and empty-link fallback behavior', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="/file" title="File:Photo"><img src="/photo.jpg" alt=""></a>'

    expect(htmlToMarkdown('<a href="/x" aria-label="label"><span></span></a>', { engine }))
      .toBe('[label](/x)')
    expect(htmlToMarkdown(html, { clean: true, engine }))
      .toBe('[File:Photo](/file)')
    for (const alt of [' ', '\t', '\n', '\f', '\r', '\u00A0', '\uFEFF']) {
      expect(htmlToMarkdown(`<a href="/file" title="File:Photo"><img src="/photo.jpg" alt="${alt}"></a>`, { clean: true, engine }))
        .toBe('[File:Photo](/file)')
    }
    expect(htmlToMarkdown('<a href="/file" title="File:Photo"><img src="/photo.jpg" alt="\u0085"></a>', { clean: true, engine }))
      .toBe('[![\u0085](/photo.jpg)](/file "File:Photo")')
    expect(htmlToMarkdown(html, { clean: { emptyImages: false }, engine }))
      .toBe('[![](/photo.jpg)](/file "File:Photo")')
    expect(htmlToMarkdown('<a href="/file"><img src="/photo.jpg" alt=""></a>', { clean: true, engine }))
      .toBe('')
    expect(htmlToMarkdown('<a href="/file"><img src="/photo.jpg" alt="Photo"></a>', { clean: true, engine }))
      .toBe('[![Photo](/photo.jpg)](/file)')
  })

  it('drops images with whitespace-only alt from clean text output', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<p>Before</p><a href="/file" title="File:Photo"><img src="/photo.jpg" alt=" "></a>', { clean: true, engine, format: 'text' }))
      .toBe('Before\n\nFile:Photo')
  })

  it('aligns the clean empty-image text gate with the markdown gate', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    for (const alt of [' ', '\t', '\n', '\f', '\r', '\u00A0', '\uFEFF']) {
      expect(htmlToMarkdown(`<p>Before</p><a href="/file" title="File:Photo"><img src="/photo.jpg" alt="${alt}"></a>`, { clean: true, engine, format: 'text' }))
        .toBe('Before\n\nFile:Photo')
    }
    expect(htmlToMarkdown('<p>Before</p><a href="/file" title="File:Photo"><img src="/photo.jpg"></a>', { clean: true, engine, format: 'text' }))
      .toBe('Before\n\nFile:Photo')
    expect(htmlToMarkdown('<p>A</p><img src="/photo.jpg" alt=" "><p>B</p>', { clean: true, engine, format: 'text' }))
      .toBe('A\n\nB')
    expect(htmlToMarkdown('<img src="image.png" title="Title">', { clean: true, engine, format: 'text' }))
      .toBe('')
    expect(htmlToMarkdown('<img src="/image.png">', { clean: { emptyImages: true }, engine, format: 'text' }))
      .toBe('')
    expect(htmlToMarkdown('<img src="image.png" title="Title">', { clean: { urls: true }, engine, format: 'text' }))
      .toBe('Title')
    expect(htmlToMarkdown('<p>A</p><img src="/photo.jpg" alt="Photo"><p>B</p>', { clean: true, engine, format: 'text' }))
      .toBe('A\n\nPhoto\n\nB')
  })

  it('updates linked-image content only for built-in emitted output', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<a href="/x" title="Title"><img src="/i" alt="Alt"></a>', { engine, format: 'html' }))
      .toBe('<a href="/x" title="Title"><img src="/i" alt="Alt"></a>')
    expect(htmlToMarkdown('<a href="/x" title="Title"><img src="data:text/html,bad" alt="Alt"></a>', { engine, format: 'html' }))
      .toBe('<a href="/x" title="Title">Title</a>')
    expect(htmlToMarkdown('<a href="/x" title="Title"><img src="/i" alt="Alt"></a>', { engine, format: 'text' }))
      .toBe('Alt')
    expect(htmlToMarkdown('<a href="/x" title="Title"><img src="/i" alt=""></a>', { engine, format: 'text' }))
      .toBe('Title')
    expect(htmlToMarkdown('<div><a href="/x"><span><img src="/i" alt="Alt"> </span></a>Caption</div>', { engine, format: 'text' }))
      .toBe('Alt Caption')
    const imageSibling = '<div><a href="/x"><span><img src="/i" alt="Alt"> </span></a><img src="/caption" alt="Caption"></div>'
    expect(htmlToMarkdown(imageSibling, { engine }))
      .toBe('[![Alt](/i)](/x) ![Caption](/caption)')
    expect(htmlToMarkdown(imageSibling, { engine, format: 'text' }))
      .toBe('Alt Caption')
    for (const whitespace of [' ', '\t', '\n', '\f', '\r']) {
      expect(htmlToMarkdown(`<a href="/x" title="Title"><img src="/i" alt="${whitespace}"></a>`, { engine, format: 'text' }))
        .toBe('Title')
    }
    expect(htmlToMarkdown('before<a href="/x" title="Title"><img src="/i" alt="\u00A0"></a>after', { engine, format: 'text' }))
      .toBe('before \u00A0after')
    expect(htmlToMarkdown('before<img src="/i" alt=" ">after', { engine, format: 'text' }))
      .toBe('before after')

    const plugins = {
      tagOverrides: {
        img: { enter: 'custom', exit: '', spacing: [0, 0] as [number, number], isInline: true, isSelfClosing: true },
      },
    }
    expect(htmlToMarkdown('<a href="/x" title="Title"><img src="/i" alt="Alt"></a>', { engine, plugins }))
      .toBe('[customTitle](/x)')
  })

  it('marks the parent scope when an image is overridden as block', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<div><a href="/x"><img src="/i" alt="Alt"></a> Caption</div>'
    const plugins = {
      tagOverrides: {
        img: { spacing: [0, 0] as [number, number], isInline: false },
      },
    }

    expect(htmlToMarkdown(html, { engine, plugins })).toBe('[![Alt](/i)](/x) Caption')
    expect(htmlToMarkdown(html, { engine, plugins, format: 'text' })).toBe('Alt Caption')
    expect(htmlToMarkdown(html, { engine, plugins, format: 'html' }))
      .toBe('<div><a href="/x"><img src="/i" alt="Alt"></a> Caption</div>')
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
