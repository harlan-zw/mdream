import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('lists $name', (engineConfig) => {
  it.each([
    ['<ul><li>a</li></ul><a href="x"></a><ul><li>b</li></ul>', '- a\n\n* b'],
    ['<ol><li>a</li></ol><a href="x"></a><ol><li>b</li></ol>', '1. a\n\n1) b'],
  ])('keeps lists separate when clean removes an empty link: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, clean: { emptyLinkText: true } })).toBe(expected)
  })

  it('converts unordered lists', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- Item 1\n- Item 2')
  })

  it('converts ordered lists', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ol><li>First</li><li>Second</li></ol>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. First\n2. Second')
  })

  it.each([
    ['<ul><li>a</li></ul><b></b><ul><li>b</li></ul>', '- a\n\n* b'],
    ['<ul><li>a</li></ul><code></code><ul><li>b</li></ul>', '- a\n\n* b'],
    ['<ul><li>a</li></ul><b><code></code></b><ul><li>b</li></ul>', '- a\n\n* b'],
    ['<ul><li>a</li></ul><template><blockquote>x</blockquote></template><ul><li>b</li></ul>', '- a\n\n* b'],
    ['<ol><li>a</li></ol><b></b><ol><li>b</li></ol>', '1. a\n\n1) b'],
    ['<ol><li>a</li></ol><code></code><ol><li>b</li></ol>', '1. a\n\n1) b'],
    ['<ol><li>a</li></ol><b><code></code></b><ol><li>b</li></ol>', '1. a\n\n1) b'],
    ['<ol><li>a</li></ol><template><blockquote>x</blockquote></template><ol><li>b</li></ol>', '1. a\n\n1) b'],
    ['<ul><li>a</li></ul><b>x</b><ul><li>b</li></ul>', '- a\n\n**x**\n\n- b'],
    ['<ol><li>a</li></ol><code>x</code><ol><li>b</li></ol>', '1. a\n\n`x`\n\n1. b'],
  ])('preserves adjacent list markers through removable output: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  // CommonMark joins a list into the one before it when both use the same
  // marker character, blank line or not. A sibling list switches characters.
  it.each([
    ['<ul><li>a</li></ul><ul><li>b</li></ul><ul><li>c</li></ul>', '- a\n\n* b\n\n- c'],
    ['<ol><li>a</li></ol><ol start="3"><li>b</li></ol><ol><li>c</li></ol>', '1. a\n\n3) b\n\n1. c'],
    ['<ul><li>a</li></ul><div><!-- c --><ul></ul><ul><li>b</li></ul></div>', '- a\n\n* b'],
    ['<ul><li>a<ul><li>b</li></ul><ul><li>c</li></ul></li></ul>', '- a\n  - b\n  * c'],
    ['<ul><li>x<ul><li>a</li></ul></li></ul><ul><li>b</li></ul>', '- x\n  - a\n\n* b'],
    ['<blockquote><ul><li>a</li></ul><ul><li>b</li></ul></blockquote>', '> - a\n>\n> * b'],
    ['<ul><li>a</li></ul><ul><li><hr></li><li>* * *</li></ul>', '- a\n\n* ---\n* \\* \\* \\*'],
    // A block makes the enclosing opener permanent without visible output.
    ['<ol><li>a</li></ol><em><div></div><ol><li>b</li></ol></em>', '1. a\n\n*1) b*'],
    ['<ol><li>a</li></ol><strong><p></p><ol><li>b</li></ol></strong><ol><li>c</li></ol>', '1. a\n\n**1) b**\n\n1. c'],
    // A quote that writes nothing leaves the lists around it adjacent.
    ['<ul><li>a</li></ul><blockquote></blockquote><ul><li>b</li></ul>', '- a\n\n* b'],
    ['<ol><li>a</li></ol><blockquote> </blockquote><ol><li>b</li></ol>', '1. a\n\n1) b'],
    ['<ul><li>a</li></ul><blockquote><p></p></blockquote><ul><li>b</li></ul>', '- a\n\n* b'],
    ['<ul><li>a</li></ul><blockquote><blockquote></blockquote></blockquote><ul><li>b</li></ul>', '- a\n\n* b'],
    ['<blockquote><ul><li>a</li></ul><blockquote></blockquote><ul><li>b</li></ul></blockquote>', '> - a\n>\n> * b'],
  ])('alternates the marker of an adjacent same-type list: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li>a</li></ul><p>x</p><ul><li>b</li></ul>', '- a\n\nx\n\n- b'],
    ['<ul><li>a</li></ul><ol><li>b</li></ol>', '- a\n\n1. b'],
    ['<blockquote><ul><li>a</li></ul></blockquote><blockquote><ul><li>b</li></ul></blockquote>', '> - a\n\n> - b'],
    ['<ul><li>a</li></ul><blockquote><ul><li>b</li></ul></blockquote>', '- a\n\n> - b'],
    ['<ul><li>a</li></ul><blockquote>x</blockquote><ul><li>b</li></ul>', '- a\n\n> x\n\n- b'],
    ['<ul><li>a</li></ul><blockquote><ul><li>b</li></ul></blockquote><ul><li>c</li></ul>', '- a\n\n> - b\n\n- c'],
  ])('keeps the default marker when content separates the lists: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li>a</li></ul><blockquote><ul><li>b</li></ul></blockquote>', { blockquote: { enter: '', exit: '' } }, '- a\n\n* b'],
    ['<ul><li>a</li></ul><em><blockquote></blockquote><ul><li>b</li></ul></em>', { ul: { isInline: true }, blockquote: { isInline: true } }, '- a\n\n*>- b*'],
  ])('follows the quote prefixes an override writes: %s', async (html, tagOverrides, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, plugins: { tagOverrides } })).toBe(expected)
  })

  // An item whose override writes nothing visible has no marker for the next
  // list to join, so that list keeps the default character.
  it.each([
    ['<ul><li>a</li></ul><ul><x-li>b</x-li></ul>', { 'li': { enter: '' }, 'x-li': 'li' }, 'a\n\n- b'],
    ['<ol><li>a</li></ol><ol><x-li>b</x-li></ol>', { 'li': { enter: ' ' }, 'x-li': 'li' }, 'a\n\n1. b'],
    ['<ul><li>a</li></ul><ul><x-li>b</x-li></ul>', { 'li': { enter: '+ ' }, 'x-li': 'li' }, '+ a\n\n* b'],
  ])('starts a run only from an item that wrote its marker: %s', async (html, tagOverrides, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, plugins: { tagOverrides } })).toBe(expected)
  })

  // A list's exit output continues its last item, so it separates nothing:
  // `- aEND` then `- bEND` would read as one list.
  it.each([
    ['<ul><li>a</li></ul><ul><li>b</li></ul>', { ul: { exit: 'END' } }, '- aEND\n\n* bEND'],
    ['<ol><li>a</li></ol><ol><li>b</li></ol>', { ol: { exit: 'END' } }, '1. aEND\n\n1) bEND'],
  ])('alternates after a list whose exit writes output: %s', async (html, tagOverrides, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, plugins: { tagOverrides } })).toBe(expected)
  })

  it('handles nested unordered lists', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li>Level 1<ul><li>Level 2</li></ul></li><li>Another Level 1</li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- Level 1\n  - Level 2\n- Another Level 1')
  })

  it('handles nested ordered lists', async () => {
    // Nested ordered lists need 3-space continuation indent (length of the
    // outer "1. " marker) so CommonMark recognizes the inner list as nested.
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ol><li>Level 1<ol><li>Level 1.1</li></ol></li><li>Level 2</li></ol>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. Level 1\n   1. Level 1.1\n2. Level 2')
  })

  it('handles mixed nested lists', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li>Unordered<ol><li>Ordered</li></ol></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- Unordered\n  1. Ordered')
  })

  it('complex list github nav', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<div class="mr-auto width-full" data-search="breadcrumbs"><nav data-testid="breadcrumbs-header" class="f5 breadcrumbs Breadcrumbs_breadcrumbs__xAC4i" aria-label="Breadcrumb" data-container="breadcrumbs"><ul><li class="d-inline-block"><a rel="" data-testid="breadcrumb-link" title="Get started" class="Link--primary mr-2 color-fg-muted" href="/en/get-started">Get started</a><span class="color-fg-muted pr-2">/</span></li><li class="d-inline-block"><a rel="" data-testid="breadcrumb-link" title="Writing on GitHub" class="Link--primary mr-2 color-fg-muted" href="/en/get-started/writing-on-github">Writing on GitHub</a><span class="color-fg-muted pr-2">/</span></li><li class="d-inline-block"><a rel="" data-testid="breadcrumb-link" title="Start writing on GitHub" class="Link--primary mr-2 color-fg-muted" href="/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github">Start writing on GitHub</a><span class="color-fg-muted pr-2">/</span></li><li class="d-inline-block"><a rel="" data-testid="breadcrumb-link" title="Basic formatting syntax" class="Link--primary mr-2 color-fg-muted" href="/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax">Basic formatting syntax</a></li></ul></nav></div>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- [Get started](/en/get-started)/\n- [Writing on GitHub](/en/get-started/writing-on-github)/\n- [Start writing on GitHub](/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github)/\n- [Basic formatting syntax](/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)')
  })

  // https://github.com/harlan-zw/mdream/issues/73
  it('code block inside ordered list item', async () => {
    // Ordered-list continuation uses 3-space indent (marker "1. " is 3 cols).
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ol><li><p>text</p><pre><code class="language-bash"># comment
echo test
</code></pre><p>text</p></li></ol>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. text\n\n   ```bash\n   # comment\n   echo test\n   ```\n\n   text')
  })

  it('code block inside unordered list item', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ul><li><p>text</p><pre><code class="language-bash"># comment
echo test
</code></pre><p>text</p></li></ul>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- text\n\n  ```bash\n  # comment\n  echo test\n  ```\n\n  text')
  })

  it('inline code between paragraphs inside list item has spacing', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ol><li><p>text</p><code># comment</code><p>text</p></li></ol>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. text `# comment`\n\n   text')
  })

  it('multiple paragraphs in list item inside table cell stay inline', async () => {
    // Lists inside table cells are preserved as raw HTML, so paragraph breaks
    // must not inject blank markdown lines that would split the table row.
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<table><tr><td><ul><li><p>a</p><p>b</p></li></ul></td></tr></table>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toContain('<ul><li>')
    expect(markdown).not.toContain('\n\n')
  })

  it('code block with blank lines inside list item preserves them', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ol><li><p>x</p><pre><code>line1

line2</code></pre></li></ol>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. x\n\n   ```\n   line1\n\n   line2\n   ```')
  })

  it('code block with pre-indented content inside list item preserves existing indentation', async () => {
    // The list-item indent is prepended on top of any in-source indentation so
    // every line stays inside the item's content column. Here "  return 1;"
    // becomes "     return 1;" (3 list + 2 source).
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ol><li><p>x</p><pre><code>function() {
  return 1;
}</code></pre></li></ol>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. x\n\n   ```\n   function() {\n     return 1;\n   }\n   ```')
  })

  // https://github.com/harlan-zw/mdream/issues/76
  it('inline code inside inline formatting inside list item has no leading space', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><strong><code>text</code></strong></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- **`text`**')
  })

  it('adjacent inline code spans in list item separated with a space', async () => {
    // Without a separator, ` `a``b` ` parses as a single code span containing
    // literal ``a``b``. A space keeps them as two distinct spans.
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<li><code>a</code><code>b</code></li>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- `a` `b`')
  })

  it('inline code inside non-delimiter wrapper inside list item keeps separator space', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li>prefix<span><code>x</code></span></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- prefix `x`')
  })

  it('inline code after existing whitespace does not duplicate separator', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li>prefix <span><code>x</code></span></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- prefix `x`')
  })

  it('inline code inside strikethrough wrapper inside list item has no leading space', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><del><code>x</code></del></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- ~~`x`~~')
  })

  it('inline code inside link inside list item has no leading space', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><a href="#"><code>x</code></a></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- [`x`](#)')
  })

  it('inline code inside html-passthrough wrapper inside list item has no leading space', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><mark><code>x</code></mark></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- <mark>`x`</mark>')
  })

  it('self closing tags in lists', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ul class="hds-term-items"></li>

<li class='hds-term-item mission-terms-10828 hds-term-depth-0'><div class="hds-term-item-inner">
\t\t\t\t\t<label class="hds-term-item-checkbox selectit hds-term-depth-0">
\t\t\t\t\t<input
\t\t\t\t\t\tvalue="10828"
\t\t\t\t\t\ttype="checkbox"
\t\t\t\t\t\tname="mission-terms[]"
\t\t\t\t\t\tid="in-mission-terms-10828" /> Active</label></div></li>

<li class='hds-term-item mission-terms-10873 hds-term-depth-0'><div class="hds-term-item-inner">
\t\t\t\t\t<label class="hds-term-item-checkbox selectit hds-term-depth-0">
\t\t\t\t\t<input
\t\t\t\t\t\tvalue="10873"
\t\t\t\t\t\ttype="checkbox"
\t\t\t\t\t\tname="mission-terms[]"
\t\t\t\t\t\tid="in-mission-terms-10873" /> Future</label></div></li>
`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- Active\n- Future')
  })
})

describe.each(engines)('scout9_wrap_setext_boundary $name', (engineConfig) => {
  it.each([
    [
      '<p>aaaaaaaaaa --</p>',
      'aaaaaaaaaa --',
    ],
    [
      '<p>aaaaaaaaaa ==</p>',
      'aaaaaaaaaa ==',
    ],
    [
      '<p>aaaaaaaaaa -</p>',
      'aaaaaaaaaa -',
    ],
    [
      '<p>aaaaaaaaaa ---</p>',
      'aaaaaaaaaa ---',
    ],
    [
      '<p>aaaaaaaaaa =</p>',
      'aaaaaaaaaa =',
    ],
    [
      '<p>aaaaaaaaaa --word</p>',
      'aaaaaaaaaa\n--word',
    ],
    [
      '<p>aaaaaaaaaa ==word</p>',
      'aaaaaaaaaa\n==word',
    ],
  ])('preserves structure: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, wrapWidth: 10 })).toBe(expected)
  })
})

describe.each(engines)('scout9_excluded_list_spacing $name', (engineConfig) => {
  it.each([
    [
      '<ul><li>a</li><script>hidden</script><li>b</li></ul>',
      '- a\n- b',
    ],
    [
      '<ul><li>a</li><style>hidden</style><li>b</li></ul>',
      '- a\n- b',
    ],
    [
      '<ul><li>a</li><noscript>hidden</noscript><li>b</li></ul>',
      '- a\n- b',
    ],
    [
      '<ul><li>a</li><template>hidden</template><li>b</li></ul>',
      '- a\n- b',
    ],
  ])('preserves structure: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })
})

describe.each(engines)('scout9_excluded_list_spacing options $name', (engineConfig) => {
  it('preserves visible aliases while respecting filters and explicit spacing', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<ul><li>a</li><x-text>visible</x-text><li>b</li></ul>', { engine, plugins: { tagOverrides: { 'x-text': 'em' } } })).toBe('- a*visible*\n- b')
    expect(htmlToMarkdown('<ul><li>a</li><div class=hide>hidden</div><li>b</li></ul>', { engine, plugins: { filter: { exclude: ['.hide'] } } })).toBe('- a\n- b')
    expect(htmlToMarkdown('<ul><li>a</li><script>hidden</script><li>b</li></ul>', { engine, plugins: { tagOverrides: { script: { spacing: [2, 2] } } } })).toBe('- a\n\n- b')
  })
})
