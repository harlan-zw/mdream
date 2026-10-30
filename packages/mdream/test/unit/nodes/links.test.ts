import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../../utils/engines'

describe.each(engines)('links $name', (engineConfig) => {
  it.each([
    [
      '<a href="x"><ul><li></li></ul></a>',
      '[-](x)',
    ],
    [
      '<ul><li><a href="x"><ul><li></li></ul></a><ul><li># h</li></ul></li></ul>',
      '- [  -](x)\n  - \\# h',
    ],
    [
      '<a href="x"><ul><li></li><li></li></ul></a>',
      '[- -](x)',
    ],
    [
      '<a href="x"><ol start="10"><li></li></ol></a>',
      '[10.](x)',
    ],
    [
      '<a href="x"><ul><li><ul><li></li></ul></li></ul></a>',
      '[-   -](x)',
    ],
    [
      '<a href="x"><ul><li>one</li><li>two</li></ul></a>',
      '[- one - two](x)',
    ],
    [
      '<a href="x">before<ul><li></li></ul>after</a>',
      '[before - after](x)',
    ],
    [
      '<a href="x">text <span></span></a>tail',
      '[text](x) tail',
    ],
    [
      '<a href="x" title="Title"><ul><li></li></ul></a>tail',
      '[- Title](x)tail',
    ],
    [
      '<a href="x"><ul><li></li></ul></a><em>tail</em>',
      '[-](x) *tail*',
    ],
    [
      '<a href="x"><img src="i" alt="A"> <span></span></a>tail',
      '[![A](i)](x) tail',
    ],
    [
      '<a href="x" title="text">text <span></span></a>',
      '[text](x)',
    ],
    [
      '<a href="x" title="Title">text <span></span></a>',
      '[text](x "Title")',
    ],
    [
      '<a href="x"> </a>tail',
      '[](x)tail',
    ],
    [
      '<code><a href="x"><ul><li></li></ul></a></code>',
      '`[- ](x)`',
    ],
    [
      '<a href="x"><ul><li><code>a </code></li></ul></a>',
      '[- `a`](x)',
    ],
    [
      '<details><a href="x"><ul><li></li></ul></a></details>',
      '<details><a href="x">- </a></details>',
    ],
  ])('trims trailing label spaces across empty elements: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

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

  // Text in a block nested in a link, such as the `<text>` of an `<svg>`, is
  // written like any link text, so the link takes no label.
  it.each([
    ['<p>Go <a href="/cart" aria-label="Cart"><svg><text>x</text></svg></a></p>', 'Go [x](/cart)'],
    ['<p>Go <a href="/cart" aria-label="Cart"><svg aria-hidden="true"><text>x</text></svg></a></p>', 'Go [x](/cart)'],
    ['<div><a href="/x" title="Title"><div>Text</div></a></div>', '[Text](/x "Title")'],
    ['<p><a href="/c"><svg><text>x</text></svg></a> now</p>', '[x](/c) now'],
    ['<div><a href="/x"><div>Text</div></a> now</div>', '[Text](/x) now'],
  ])('treats text in a block inside a link as link text in %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, plugins: { filter: {} } })).toBe(expected)
  })

  it('treats text in a block inside a link as link text in every format', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Go <a href="/cart" aria-label="Cart"><svg><text>x</text></svg></a></p>'
    expect(htmlToMarkdown(html, { engine, format: 'text' })).toBe('Go x')
    expect(htmlToMarkdown(html, { engine, format: 'html' })).toBe('<p>Go <a href="/cart">x</a></p>')
    // Hidden text in the block is still no link text.
    expect(htmlToMarkdown('<p>Go <a href="/cart" aria-label="Cart"><svg><text hidden>x</text></svg></a></p>', { engine, plugins: { filter: {} } }))
      .toBe('Go [Cart](/cart)')
  })

  // Text in a block nested in a link counts for the link around that block. A
  // block of the next link, or a link opened inside the block, counts for its
  // own link, so neither takes its label next to visible text.
  it.each([
    ['<a href="/a" title="A"><p>x</p></a><a href="/b" title="B"><p>y</p></a>', '[x](/a "A") [y](/b "B")'],
    ['<a href="/a"><div>x<a href="/b" title="B"><p>y</p></a></div></a>', '[x [y](/b "B")](/a)'],
    ['<a href="/a" title="A"><ul><li>x<ul><li>y<ul><li>z</li></ul></li></ul></li></ul></a>', '[- x  - y    - z](/a "A")'],
    ['<a href="/a" title="A"><div><p>x</p><p>y</p></div></a>', '[x y](/a "A")'],
    ['<a href="/a" title="A"><p>x</a><a href="/b" title="B"><p>y</a>', '[x](/a "A") [y](/b "B")'],
    ['<a href="/a" title="A"><div><a href="/b" title="B"><p>y</p>z</a>w</div></a>', '[[y z](/b "B")w](/a "A")'],
    ['<a href="/a" title="A"><div><a href="/b"><p>y</p></a></div><p>z</p></a>', '[[y](/b) z](/a "A")'],
    ['<a href="/a" title="A"><div><img src="/i" alt="I"></div></a><a href="/b" title="B"><div><img src="/i" alt="J"></div></a>', '[![I](/i)](/a "A") [![J](/i)](/b "B")'],
    ['<a href="/a" title="A"><div><img src="/i" alt="I"><a href="/b" title="B"><p>y</p></a></div></a>', '[![I](/i) [y](/b "B")](/a "A")'],
    ['<div><p><img src="/i" alt="I"></p><a href="/b" title="B"><p>y</p></a></div>', '![I](/i)\n\n[y](/b "B")'],
  ])('counts text in a nested block for its own link in %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let markdown = ''
      for await (const chunk of streamHtmlToMarkdown(input, { engine }))
        markdown += chunk
      expect(markdown, `width=${width}`).toBe(expected)
    }
  })

  // A link in a block of another link stays nested, as the parser only closes
  // an open link at a new one in the same block. Its content is content of the
  // outer link too, so the outer link takes no label.
  it.each([
    ['<a href="/a" title="A"><div><a href="/b"><p>y</p></a></div></a>', '[[y](/b)](/a "A")', 'y'],
    ['<a href="/a" title="A"><div><a href="/b">y</a></div></a>', '[[y](/b)](/a "A")', 'y'],
    ['<a href="/a" title="A"><div><a href="/b" title="B"></a></div></a>', '[[B](/b)](/a "A")', 'B'],
    ['<a href="/a" title="A"><div><a href="/b"><img src="/i" alt="I"></a></div></a>', '[[![I](/i)](/b)](/a "A")', 'I'],
    ['<a href="/a" title="A"><div><a href="/c" title="C"><div><a href="/b"><p>y</p></a></div></a></div></a>', '[[[y](/b)](/c "C")](/a "A")', 'y'],
    ['<div><a href="/a" title="A"><section><div><a href="/b">y</a></div></section></a> tail</div>', '[[y](/b)](/a "A") tail', 'y tail'],
  ])('counts a link nested in a block for the link around it in %s', async (html, expected, text) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, format: 'text' })).toBe(text)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let markdown = ''
      for await (const chunk of streamHtmlToMarkdown(input, { engine }))
        markdown += chunk
      expect(markdown, `width=${width}`).toBe(expected)
    }
  })

  // Whitespace in a `<pre>` nested in a link shows nothing, so the link keeps its label.
  it.each([
    ['<a href="/p" aria-label="L"><pre> </pre></a>', '[L](/p)'],
    ['<a href="/p" aria-label="L"><pre>&#32;</pre></a>', '[L](/p)'],
    ['<a href="/p" title="T"><pre> </pre></a>', '[T](/p)'],
    ['<a href="/p" aria-label="L"><div><pre> </pre></div></a>', '[L](/p)'],
    ['<pre>a <a href="/c" aria-label="Item"><svg><text> </text></svg></a> Next</pre>', '```\na Item Next\n```'],
  ])('keeps the label of a link holding a blank pre in %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, plugins: { filter: {} } })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, clean: true })).toBe(expected)
  })

  it('keeps the label of a link holding a blank pre in html output', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<a href="/p" aria-label="L"><pre> </pre></a>', { engine, format: 'html' }))
      .toBe('<a href="/p"><pre tabindex="0"><code> </code></pre>L</a>')
    expect(htmlToMarkdown('<pre>a <a href="/c" aria-label="Item"><svg><text> </text></svg></a> Next</pre>', { engine, format: 'text' }))
      .toBe('a Item Next')
  })

  // Text longer than the 64 KiB cut is read in pieces; a last piece that only
  // decodes to spaces does not make the whole link text blank.
  it.each([
    ['plain', (text: string) => `<p><a href="/c" aria-label="Item">${text}</a> next</p>`],
    ['span', (text: string) => `<p><a href="/c" aria-label="Item"><span>${text}</span></a> next</p>`],
    ['svg text', (text: string) => `<p><a href="/c" aria-label="Item"><svg><text>${text}</text></svg></a> next</p>`],
  ])('keeps long link text ending in encoded blanks as link text (%s)', async (_id, wrap) => {
    const engine = await resolveEngine(engineConfig.engine)
    const words = 'word '.repeat(13100)
    const html = wrap(`${words}${'&#32;'.repeat(20)}`)
    const expected = `[${words.trimEnd()}](/c) next`
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, plugins: { filter: {} } })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, format: 'html' })).not.toContain('Item')
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

  it('uses the link label in every format when a filter hides all link text', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<main><p><a href="/cart" aria-label="Cart"><span hidden>🛒</span></a></p></main>'
    const plugins = { filter: {} }
    expect(htmlToMarkdown(html, { engine, plugins })).toBe('[Cart](/cart)')
    expect(htmlToMarkdown(html, { engine, plugins, format: 'text' })).toBe('Cart')
    expect(htmlToMarkdown(html, { engine, plugins, format: 'html' })).toBe('<main><p><a href="/cart">Cart</a></p></main>')
    expect(htmlToMarkdown(html, { engine })).toBe('[🛒](/cart)')
  })

  it.each([
    ['<p><a href="/cart" title="Cart"><span style="display:none">x</span></a></p>', { filter: {} }, '[Cart](/cart)'],
    ['<p><a href="/cart" aria-label="Cart"><span class="icon">x</span></a></p>', { filter: { exclude: ['.icon'] } }, '[Cart](/cart)'],
    ['<div><a href="/cart" aria-label="Cart"><span>x</span></a></div>', { filter: { include: ['a'], processChildren: false } }, '[Cart](/cart)'],
    ['<p><a href="/cart" aria-label="Cart"><span class="hidden">x</span></a></p>', { tailwind: true }, '[Cart](/cart)'],
    // The space after excluded text moves past the link, as trailing link text space does.
    ['<p><a href="/cart" aria-label="Cart"><span hidden>x</span> </a></p>', { filter: {} }, '[Cart](/cart)'],
    ['<p><a href="/cart" aria-label="Cart">\n  <span hidden>x</span>\n</a></p>', { filter: {} }, '[Cart](/cart)'],
    ['<p>Go<a href="/cart" aria-label="Cart"><span hidden>x</span> </a>now</p>', { filter: {} }, 'Go [Cart](/cart) now'],
    ['<p><strong><a href="/cart" aria-label="Cart"><span hidden>x</span> </a></strong>B</p>', { filter: {} }, '**[Cart](/cart)** B'],
    ['<p><a href="/cart" aria-label="Cart"><b><span hidden>x</span> </b></a></p>', { filter: {} }, '[Cart](/cart)'],
    ['<p>Go <a href="/cart" aria-label="Cart"><span hidden>x</span></a> now</p>', { filter: {} }, 'Go [Cart](/cart) now'],
    ['<p><a href="/cart" aria-label="Cart"><span hidden>x</span>Go</a></p>', { filter: {} }, '[Go](/cart)'],
    ['<p><a href="/cart" aria-label="Cart"><span hidden>x</span> <b>Go</b></a></p>', { filter: {} }, '[ **Go**](/cart)'],
    ['<p><a href="/cart" aria-label="Cart"><span hidden>x</span><img src="/c.png" alt="C"></a></p>', { filter: {} }, '[![C](/c.png)](/cart)'],
  ])('uses the link label only when excluded content leaves no link text in %s', async (html, plugins, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, plugins })).toBe(expected)
  })

  it('moves a pending blank before the link label past the link', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    // Clean mode drops the image, so the blank before the label is still pending.
    const html = '<p>Go<a href="/cart" aria-label="Cart"><span hidden>x</span> <img src="/c.png" alt=""> </a>now</p>'
    expect(htmlToMarkdown(html, { engine, plugins: { filter: {} }, clean: true })).toBe('Go [Cart](/cart) now')
  })

  // A blank after link content the parser leaves out spaces that content like
  // the blank after hidden text, whether a plain space or a decoded `&#32;`.
  it.each([
    ['<p>Go <a href="/cart" aria-label="Cart"><style>.i{}</style>&#32;</a></p>', 'Go [Cart](/cart)'],
    ['<a href="/cart" aria-label="Cart"><svg></svg>&#32;</a>', '[Cart](/cart)'],
    ['<p><a href="/c" aria-label="Item"><svg></svg> </a>Next</p>', '[Item](/c) Next'],
    ['<p><a href="/c" aria-label="Item"><svg></svg>&#32;</a>Next</p>', '[Item](/c) Next'],
    ['<p><a href="/c" aria-label="Item">\n  <svg aria-hidden="true"></svg>\n</a>Next</p>', '[Item](/c) Next'],
    ['<p>Go<a href="/c" aria-label="Item"><style>.i{}</style> </a>now</p>', 'Go [Item](/c) now'],
    ['<ul><li><a href="/c" aria-label="Item"><svg></svg> </a>item</li></ul>', '- [Item](/c) item'],
    ['<p><a href="/c"><svg></svg> </a>Next</p>', '[](/c)Next'],
  ])('moves the blank after excluded link content past the label in %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, plugins: { filter: {} } })).toBe(expected)
  })

  it('uses the link label for an encoded blank after excluded content in every format', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>Go<a href="/cart" aria-label="Cart"><svg></svg>&#32;</a>now</p>'
    expect(htmlToMarkdown(html, { engine, clean: true })).toBe('Go [Cart](/cart) now')
    expect(htmlToMarkdown(html, { engine, format: 'text' })).toBe('Go Cartnow')
    expect(htmlToMarkdown(html, { engine, format: 'html' })).toBe('<p>Go<a href="/cart"> Cart</a>now</p>')
  })

  // A blank between two children of a link is part of the content the label
  // replaces; only a blank after the last child moves past the link.
  it.each([
    ['<p>Go<a href="/c" aria-label="Item"><svg></svg> <svg></svg></a>Next</p>', 'Go [Item](/c)Next'],
    ['<p>Go<a href="/c" aria-label="Item"><span></span> <svg></svg></a>Next</p>', 'Go [Item](/c)Next'],
    ['<p>Go<a href="/c" aria-label="Item"><svg></svg> <svg></svg> <svg></svg></a>Next</p>', 'Go [Item](/c)Next'],
    ['<p>Go<a href="/c" aria-label="Item"><svg></svg> <svg></svg> </a>Next</p>', 'Go [Item](/c) Next'],
    ['<p>Go <a href="/c" aria-label="A"><svg></svg> <!-- c --></a>Next</p>', 'Go [A](/c) Next'],
  ])('keeps a blank between excluded link content in the label in %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, plugins: { filter: {} } })).toBe(expected)
    expect(htmlToMarkdown(html, { engine, clean: true })).toBe(expected)
  })

  it('keeps the space after excluded link text in every format', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>See<a href="/x"><span class="icon">arrow</span> <span>docs</span></a></p>'
    const plugins = { filter: { exclude: ['.icon'] } }
    expect(htmlToMarkdown(html, { engine, plugins })).toBe('See [ docs](/x)')
    expect(htmlToMarkdown(html, { engine, plugins, format: 'text' })).toBe('See docs')
    expect(htmlToMarkdown(html, { engine, plugins, format: 'html' })).toBe('<p>See<a href="/x"> <span>docs</span></a></p>')
  })

  it('uses the link label of a heading link in every format', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h2>Title <a href="#t" aria-label="Permalink"><span hidden>#</span></a></h2><p>body</p>'
    const plugins = { filter: {} }
    expect(htmlToMarkdown(html, { engine, plugins })).toBe('## Title [Permalink](#t)\n\nbody')
    expect(htmlToMarkdown(html, { engine, plugins, format: 'text' })).toBe('Title Permalink\n\nbody')
    expect(htmlToMarkdown(html, { engine, plugins, format: 'html' })).toBe('<h2 id="title-permalink">Title <a href="#t">Permalink</a></h2><p>body</p>')
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

  it('uses the first href-bearing base', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<base target="_blank"><base href="../assets/"><base href="https://ignored.example/"><a href="page">Page</a> <img src="cover.png" alt="Cover">'

    expect(htmlToMarkdown(html, {
      engine,
      origin: 'https://example.com/article/current.html',
    })).toBe('[Page](https://example.com/assets/page) ![Cover](https://example.com/assets/cover.png)')
  })

  it('resolves URLs before the base against origin', async () => {
    const engine = await resolveEngine(engineConfig.engine)

    expect(htmlToMarkdown('<a href="before">Before</a> <base href="/docs/"><a href="after">After</a>', {
      engine,
      origin: 'https://example.com/article/current.html',
    })).toBe('[Before](https://example.com/article/before) [After](https://example.com/docs/after)')
  })

  it('ignores a base inside a link', async () => {
    const engine = await resolveEngine(engineConfig.engine)

    expect(htmlToMarkdown('<a href="page">Before<base href="https://cdn.example/docs/">after</a> <a href="next">Next</a>', {
      engine,
      origin: 'https://example.com/article/current.html',
    })).toBe('[Beforeafter](https://example.com/article/page) [Next](https://example.com/article/next)')
  })

  it('accepts an absolute base with an ASCII-case-insensitive HTTP scheme', async () => {
    const engine = await resolveEngine(engineConfig.engine)

    expect(htmlToMarkdown('<base href="HtTpS://cdn.example/docs/"><a href="page">Link</a>', { engine }))
      .toBe('[Link](HtTpS://cdn.example/docs/page)')
  })

  it('resolves a fragment-only base against origin', async () => {
    const engine = await resolveEngine(engineConfig.engine)

    expect(htmlToMarkdown('<base href="#section"><a href="page">Link</a>', {
      engine,
      origin: 'https://example.com/docs/current.html',
    })).toBe('[Link](https://example.com/docs/page)')
  })

  it.each([
    'javascript:alert(1)',
    'data:text/plain,ignored',
    'mailto:person@example.com',
    'file:///tmp/page',
    'ftp://cdn.example/docs/',
    'http:relative',
    'https:///no-host/',
    '',
    '   ',
  ])('ignores invalid first base href %s and keeps using origin', async (href) => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<base href="${href}"><base href="https://ignored.example/"><a href="page">Link</a>`

    expect(htmlToMarkdown(html, {
      engine,
      origin: 'https://example.com/article/current.html',
    })).toBe('[Link](https://example.com/article/page)')
  })

  it.each(['/relative/', 'relative/'])('does not resolve relative base href %s without origin', async (href) => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<base href="${href}"><base href="https://ignored.example/"><a href="page">Link</a>`

    expect(htmlToMarkdown(html, { engine })).toBe('[Link](page)')
  })

  it('ignores a base with an empty host or inside a template', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const origin = 'https://example.com/article/current.html'

    for (const href of ['https://:80/docs/', 'http://user@/docs/', 'http://@/docs/']) {
      expect(htmlToMarkdown(`<base href="${href}"><a href="page">Link</a>`, { engine, origin }))
        .toBe('[Link](https://example.com/article/page)')
    }
    expect(htmlToMarkdown('<template><base href="https://other.example/"></template><a href="page">Link</a>', { engine, origin }))
      .toBe('[Link](https://example.com/article/page)')
    expect(htmlToMarkdown('<base href="https://[::1]:8080/docs/"><a href="page">Link</a>', { engine, origin }))
      .toBe('[Link](https://[::1]:8080/docs/page)')
    // Elements flattened at the depth limit (an anchor, a div) must not set the base.
    const deep = '<div>'.repeat(600)
    const unwind = '</div>'.repeat(600)
    expect(htmlToMarkdown(`${deep}<a href="/start"><base href="https://other.example/">X</a>${unwind}<a href="page">Link</a>`, { engine, origin }))
      .toMatch(/\[Link\]\(https:\/\/example\.com\/article\/page\)$/)
    expect(htmlToMarkdown(`${deep}<base href="https://other.example/">X${unwind}<a href="page">Link</a>`, { engine, origin }))
      .toMatch(/\[Link\]\(https:\/\/example\.com\/article\/page\)$/)
    for (const href of ['http://@host.example/', 'http://:pw@host.example/']) {
      expect(htmlToMarkdown(`<base href="${href}"><a href="page">Link</a>`, { engine, origin }))
        .toBe(`[Link](${href}page)`)
    }
  })

  it('uses a base captured before filtering or main-content isolation', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<head><base href="/docs/"></head><main><a href="page">Link</a></main>'
    const options = { engine, origin: 'https://example.com/article/current.html' }

    expect(htmlToMarkdown(html, {
      ...options,
      plugins: { filter: { exclude: ['base'] } },
    })).toBe('[Link](https://example.com/docs/page)')
    expect(htmlToMarkdown(html, {
      ...options,
      plugins: { isolateMain: true },
    })).toBe('[Link](https://example.com/docs/page)')
  })

  it('resolves URLs against base in safe HTML and text formats', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const origin = 'https://example.com/article/current.html'

    expect(htmlToMarkdown('<base href="/docs/"><a href="guide">Guide</a><img src="cover.png">', {
      engine,
      format: 'html',
      origin,
    })).toBe('<a href="https://example.com/docs/guide">Guide</a><img src="https://example.com/docs/cover.png" alt="">')

    expect(htmlToMarkdown('<base href="/docs/"><img src="cover.png">', {
      engine,
      format: 'text',
      origin,
    })).toBe('https://example.com/docs/cover.png')

    expect(htmlToMarkdown('<a href="page">Before<base href="https://cdn.example/docs/">after</a>', {
      engine,
      format: 'html',
      origin: 'javascript:blocked',
    })).toBe('Beforeafter')
  })

  it('applies URL cleanup after resolving links and images against base', async () => {
    const engine = await resolveEngine(engineConfig.engine)

    expect(htmlToMarkdown('<base href="/docs/"><a href="page?utm_source=test&amp;keep=1">Link</a> <img src="cover.png?utm_campaign=drop&amp;keep=2" alt="Cover">', {
      engine,
      clean: { urls: true },
      origin: 'https://example.com/article/current.html',
    })).toBe('[Link](https://example.com/docs/page?keep=1) ![Cover](https://example.com/docs/cover.png?keep=2)')
  })

  it('compares redundant links with the base-resolved URL', async () => {
    const engine = await resolveEngine(engineConfig.engine)

    expect(htmlToMarkdown('<base href="https://example.com/docs/"><a href="page">https://example.com/docs/page</a>', {
      engine,
      clean: { redundantLinks: true },
    })).toBe('https://example.com/docs/page')
  })

  it('applies a split streamed base tag only to later links', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const input = new ReadableStream<Uint8Array | string>({
      start(controller) {
        controller.enqueue('<a href="before">Before</a><base hr')
        controller.enqueue('ef="/docs/"> | ')
        controller.enqueue('<a href="later">Later</a> and <img src="cover.png" alt="Cover">')
        controller.close()
      },
    })
    let markdown = ''

    for await (const chunk of streamHtmlToMarkdown(input, {
      engine,
      origin: 'https://example.com/article/current.html',
    })) {
      markdown += chunk
    }

    expect(markdown).toBe('[Before](https://example.com/article/before) | [Later](https://example.com/docs/later) and ![Cover](https://example.com/docs/cover.png)')
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
