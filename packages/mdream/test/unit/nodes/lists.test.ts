import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('lists $name', (engineConfig) => {
  it.each([
    ['<ul><li>x<ol start="10"><li>y</li></ol></li></ul>', '- x\n\n  10. y'],
    ['<ul><li><span>x</span><span>z</span><ol start="10"><li>y</li></ol></li></ul>', '- xz\n\n  10. y'],
    ['<ul><li><strong>x</strong><ol start="10"><li>y</li></ol></li></ul>', '- **x**\n\n  10. y'],
    ['<ol start="5"><li>x<ol start="20"><li>y</li><li>z</li></ol></li></ol>', '5. x\n\n   20. y\n   21. z'],
    ['<ul><li>x<ol start="0"><li>y</li></ol></li></ul>', '- x\n\n  0. y'],
    ['<ul><li>x<ol start="1"><li>y</li></ol></li></ul>', '- x\n  1. y'],
    ['<ul><li>x<ol start="-1"><li>y</li></ol></li></ul>', '- x\n  1. y'],
    ['<ul><li>x<ol start=""><li>y</li></ol></li></ul>', '- x\n  1. y'],
    ['<ul><li><ol start="10"><li>y</li></ol></li></ul>', '-\n  10. y'],
    ['<ul><li><span></span><ol start="10"><li>y</li></ol></li></ul>', '-\n  10. y'],
    ['<ul><li>x<ol start="10"></ol></li><li>z</li></ul>', '- x\n- z'],
    ['<ul><li>x<ol reversed start="10"><li value="20">y</li><li>z</li></ol></li></ul>', '- x\n\n  10. y\n  11. z'],
    ['<ul><li>x<ol reversed><li value="10">y</li></ol></li></ul>', '- x\n  1. y'],
    ['<blockquote><ul><li>x<ol start="10"><li>y</li></ol></li></ul></blockquote>', '> - x\n>\n>   10. y'],
    ['<ul><li>x<ul><li>z<ol start="10"><li>y</li></ol></li></ul></li></ul>', '- x\n  - z\n\n    10. y'],
    ['<ul><li><p>x</p><ol start="10"><li>y</li></ol></li></ul>', '- x\n\n  10. y'],
    ['<ul><li>x<ol start="10"><li>y</li></ol><ul><li>z</li></ul></li><li>after</li></ul>', '- x\n\n  10. y\n  - z\n- after'],
    ['<ul><li>x<br><ol start="10"><li>y</li></ol></li></ul>', '- x  \n\n  10. y'],
    ['<ul><li>x<ul><li>y</li></ul><ol start="10"><li>z</li></ol></li></ul>', '- x\n  - y\n\n  10. z'],
    ['<ol><li><ol start="10"><li>y</li></ol></li></ol>', '1.\n   10. y'],
    ['<ul><li>x<ol start="1000000000"><li>y</li></ol></li></ul>', '- x\n  1. y'],
    ['<ul><li>x<ol start="10"><li></li></ol></li></ul>', '- x\n\n  10.'],
    ['<ul><li>x<ol start="10"><li>y</li></ol><p>tail</p></li></ul>', '- x\n\n  10. y\n\n  tail'],
    ['<ul><li>x<ol start="10"><script>s</script><li>y</li></ol></li></ul>', '- x\n\n  10. y'],
    ['<ul><li>x<ol start="10"><style>a{}</style><li>y</li><li>z</li></ol></li></ul>', '- x\n\n  10. y\n  11. z'],
    ['<ul><li>x<ol start="10"><noscript>n</noscript><li>y</li></ol></li></ul>', '- x\n\n  10. y'],
    ['<ul><li>x<ol start="10"><template>t</template><li>y</li></ol></li></ul>', '- x\n\n  10. y'],
    ['<ul><li>x<ol start="10">t<li>y</li></ol></li></ul>', '- x t\n\n  10. y'],
  ])('separates nested ordered starts from parent paragraphs: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li>x<a href="u"><ol start="10"><li>y</li></ol></a></li></ul>', '- x [  10. y](u)'],
    ['<ul><li><a href="u">x<ol start="10"><li>y</li></ol></a></li></ul>', '- [x  10. y](u)'],
    ['<ul><li><a href="u">x<br><ol start="10"><li>y</li></ol></a></li></ul>', '- [x  \n    10. y](u)'],
    ['<a href="u"><ul><li>x<ol start="10"><li>y</li></ol></li></ul></a>', '[- x  10. y](u)'],
    ['<ul><li><a href="u"><small>x<ol start="10"><li>y</li></ol></small></a></li></ul>', '- [x  10. y](u)'],
    ['<ul><li><span><a href="u">x<ol start="10"><li>y</li></ol></a></span></li></ul>', '- [x  10. y](u)'],
    ['<ul><li><strong>x<ol start="10"><li>y</li></ol></strong></li></ul>', '- **x  10. y**'],
    ['<ul><li><em>x<ol start="10"><li>y</li></ol></em></li></ul>', '- *x  10. y*'],
    ['<ul><li><del>x<ol start="10"><li>y</li></ol></del></li></ul>', '- ~~x  10. y~~'],
    ['<ul><li><code>x<ol start="10"><li>y</li></ol></code></li></ul>', '- `x  10. y`'],
  ])('keeps a nested ordered start tight inside an open delimiter: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><a>x<ol start="10"><li>y</li></ol></a></li></ul>', '- x\n\n  10. y'],
    ['<ul><li><span>x<ol start="10"><li>y</li></ol></span></li></ul>', '- x\n\n  10. y'],
    ['<ul><li><small>x<ol start="10"><li>y</li></ol></small></li></ul>', '- x\n\n  10. y'],
    ['<ul><li><mark>x<ol start="10"><li>y</li></ol></mark></li></ul>', '- <mark>x\n\n  10. y</mark>'],
    ['<details><ul><li><a href="u">x<ol start="10"><li>y</li></ol></a></li></ul></details>', '<details>\n\n- <a href="u">x\n\n  10. y</a>\n\n</details>'],
  ])('separates a nested ordered start inside a wrapper a blank line cannot break: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ol><script>s</script><li>y</li></ol>', '1. y'],
    ['<ol start="3"><li>a</li><template>t</template><li>b</li></ol>', '3. a\n4. b'],
    ['<ul><li>a<ul><script>s</script><li></li></ul></li></ul>', '- a\n\n  -'],
    ['<ul><li>a<ol><template>t</template><li></li></ol></li></ul>', '- a\n\n  1.'],
  ])('positions items among their list items only: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it('wraps paragraphs around a nested ordered start at their content columns', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<ul><li>alpha beta gamma delta<ol start="10"><li>one two three four five</li></ol></li></ul>', { engine, wrapWidth: 12 })).toBe('- alpha beta\n  gamma\n  delta\n\n  10. one\n      two\n      three\n      four\n      five')
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

  it.each([
    ['<ul><li><ul><li><ul><li># h</li></ul></li></ul></li></ul>', '-\n  -\n    - \\# h'],
    ['<ul><li><ul><li><ul><li>1. x</li></ul></li></ul></li></ul>', '-\n  -\n    - 1\\. x'],
    ['<ol><li><ol><li><ol><li>&gt; q</li></ol></li></ol></li></ol>', '1.\n   1.\n      1. \\> q'],
    ['<ul><li><ul><li><ul><li><table><tr><td>a</td></tr></table></li></ul></li></ul></li></ul>', '-\n  -\n    - | a |\n      | --- |'],
    ['<ul><li><ul><li><ul><li><pre>code</pre></li></ul></li></ul></li></ul>', '-\n  -\n    - ```\n      code\n      ```'],
    ['<ul><li><ul><li><ul><li><hr></li></ul></li></ul></li></ul>', '-\n  -\n    - ***'],
    ['<ul><li><ul><li><ul><li><blockquote>q</blockquote></li></ul></li></ul></li></ul>', '-\n  -\n    - \n      > q'],
    ['<ol start="10"><li><ol start="10"><li><table><tr><td>a</td></tr></table></li></ol></li></ol>', '10.\n    10. | a |\n        | --- |'],
  ])('opens a block at a marker nested past three spaces: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><ul><li></li></ul></li></ul>', '-\n  -'],
    ['<ul><li><ul><li><blockquote>q</blockquote></li></ul></li></ul>', '-\n  - \n    > q'],
  ])('keeps a nested item under its parent\'s bare marker: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
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

describe.each(engines)('scout9_list_tail_quote_spacing $name', (engineConfig) => {
  it.each([
    [
      '<ul><li><ul><li>a<br></li></ul><blockquote>q</blockquote></li></ul>',
      '-\n  - a  \n\n  > q',
    ],
    [
      '<ol><li><ul><li>a<br></li></ul><blockquote>q</blockquote></li></ol>',
      '1.\n   - a  \n\n   > q',
    ],
  ])('preserves structure: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })
})

describe.each(engines)('parent heading after nested hard break $name', (engineConfig) => {
  it.each([
    ['<ul><li><p>a</p><h2>h</h2></li></ul>', '- a\n\n  ## h'],
    ['<ol start="10"><li><p>a</p><h2>h</h2></li></ol>', '10. a\n\n    ## h'],
    ['<ul><li>a<ul><li>b<br></li></ul><h2>h</h2></li></ul>', '- a\n  - b  \n\n  ## h'],
    ['<ol start="10"><li>a<ul><li>b<br></li></ul><h2>h</h2></li></ol>', '10. a\n    - b  \n\n    ## h'],
  ])('keeps the heading in its parent item: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })
})

describe.each(engines)('blocks opening a quote in an item $name', (engineConfig) => {
  it.each([
    [
      '<ul><li><blockquote><h1>h</h1></blockquote></li></ul>',
      '- \n  > # h',
    ],
    [
      '<ol><li><blockquote><h2>h</h2></blockquote></li></ol>',
      '1. \n   > ## h',
    ],
    [
      '<ol start="10"><li><blockquote><h3>h</h3></blockquote></li></ol>',
      '10. \n    > ### h',
    ],
    [
      '<ul><li>a<ul><li>b<blockquote><h2>h</h2></blockquote></li></ul></li></ul>',
      '- a\n  - b\n    > ## h',
    ],
    [
      '<ul><li>a<ul><li><blockquote><h2>h</h2></blockquote></li></ul></li></ul>',
      '- a\n\n  - \n    > ## h',
    ],
    [
      '<ul><li>a<blockquote><h2>h</h2></blockquote></li></ul>',
      '- a\n  > ## h',
    ],
    [
      '<ul><li><p>a</p><blockquote><h2>h</h2></blockquote></li></ul>',
      '- a\n  > ## h',
    ],
    [
      '<ul><li>a<br><blockquote><h2>h</h2></blockquote></li></ul>',
      '- a  \n  \n  > ## h',
    ],
    [
      '<ul><li>a<ul><li>b<br></li></ul><blockquote><h2>h</h2></blockquote></li></ul>',
      '- a\n  - b  \n\n  > ## h',
    ],
    [
      '<ul><li><blockquote><div><h2>h</h2></div></blockquote></li></ul>',
      '- \n  > ## h',
    ],
    [
      '<ul><li><blockquote><blockquote><h2>h</h2></blockquote></blockquote></li></ul>',
      '- \n  > > ## h',
    ],
    [
      '<ul><li><blockquote> <h2>h</h2></blockquote></li></ul>',
      '- \n  > ## h',
    ],
    [
      '<ul><li><blockquote><b></b><h2>h</h2></blockquote></li></ul>',
      '- \n  > ## h',
    ],
    [
      '<ul><li><blockquote><h2>h</h2><p>x</p></blockquote></li></ul>',
      '- \n  > ## h\n  >\n  > x',
    ],
    [
      '<ul><li><blockquote><p>x</p></blockquote></li></ul>',
      '- \n  > x',
    ],
    [
      '<ul><li><blockquote><pre>x</pre></blockquote></li></ul>',
      '- \n  > ```\n  > x\n  > ```',
    ],
    [
      '<ul><li><blockquote><hr></blockquote></li></ul>',
      '- \n  > ---',
    ],
    [
      '<ul><li><blockquote><ul><li>y</li></ul></blockquote></li></ul>',
      '- \n  > - y',
    ],
    [
      '<ul><li><blockquote><table><tr><th>t</th></tr><tr><td>c</td></tr></table></blockquote></li></ul>',
      '- \n  > | t |\n  > | --- |\n  > | c |',
    ],
    [
      '<ul><li><blockquote><ul><li>y<br></li></ul><h2>h</h2></blockquote></li></ul>',
      '- \n  > - y  \n  >\n  > ## h',
    ],
  ])('keeps the block on the first quote line: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })
})

describe.each(engines)('blocks around nested pending markers $name', (engineConfig) => {
  it.each([
    [
      '<ul><li>a<ul><li>a<ul><li><h2>h</h2></li></ul></li></ul></li></ul>',
      '- a\n  - a\n    - ## h',
    ],
    [
      '<ol><li>a<ol><li>a<ol><li><h2>h</h2></li></ol></li></ol></li></ol>',
      '1. a\n   1. a\n      1. ## h',
    ],
    [
      '<ol start="100"><li>a<ul><li><h2>h</h2></li></ul></li></ol>',
      '100. a\n     - ## h',
    ],
    [
      '<ul><li><ul><li><ul><li><h2>h</h2></li></ul></li></ul></li></ul>',
      '-\n  -\n    - ## h',
    ],
    [
      '<blockquote><ul><li>a<ul><li>a<ul><li><h2>h</h2></li></ul></li></ul></li></ul></blockquote>',
      '> - a\n>   - a\n>     - ## h',
    ],
    [
      '<ul><li>a<ul><li>a<ul><li><pre>x</pre></li></ul></li></ul></li></ul>',
      '- a\n  - a\n    - ```\n      x\n      ```',
    ],
    [
      '<ul><li>a<ul><li>a<ul><li><hr></li></ul></li></ul></li></ul>',
      '- a\n  - a\n    - ***',
    ],
    [
      '<ul><li>a<ul><li>a<ul><li><table><tr><th>t</th></tr><tr><td>c</td></tr></table></li></ul></li></ul></li></ul>',
      '- a\n  - a\n    - | t |\n      | --- |\n      | c |',
    ],
  ])('opens the block on the marker: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    [
      '<ul><li>a<ul><li></li></ul><h2>h</h2></li></ul>',
      '- a\n\n  -\n\n  ## h',
    ],
    [
      '<ul><li>a<ul><li>b<ul><li></li></ul><h2>h</h2></li></ul></li></ul>',
      '- a\n  - b\n\n    -\n\n    ## h',
    ],
    [
      '<ul><li>a<ul><li></li></ul><pre>x</pre></li></ul>',
      '- a\n\n  -\n\n  ```\n  x\n  ```',
    ],
    [
      '<ul><li>a<ul><li></li></ul><hr></li></ul>',
      '- a\n\n  -\n\n  ***',
    ],
    [
      '<ul><li>a<ul><li></li></ul><table><tr><th>t</th></tr><tr><td>c</td></tr></table></li></ul>',
      '- a\n\n  -\n\n  | t |\n  | --- |\n  | c |',
    ],
  ])('leaves the marker of a closed item: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it('keeps escaping text after a closed item', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<ul><li>a<ul><li></li></ul># t</li></ul>', { engine })).toBe('- a\n\n  -\n\n  \\# t')
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
