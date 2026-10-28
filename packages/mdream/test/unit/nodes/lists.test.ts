import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('lists $name', (engineConfig) => {
  it.each([
    ['<ol><li>lead<ul><li><ol><li></li></ol></li></ul></li></ol>', '1. lead\n\n   -\n     1.'],
    ['<ul><li><blockquote><p>lead</p><ul><li><ul><li></li></ul></li></ul></blockquote></li></ul>', '- \n  > lead\n  >\n  > -\n  >   -'],
    ['<ul><li>lead<ul><li><ul><li>x</li></ul></li></ul></li></ul>', '- lead\n\n  -\n    - x'],
    ['<ul><li><ul><li><ul><li></li></ul></li></ul></li></ul>', '-\n  -\n    -'],
  ])('keeps empty ancestor markers below paragraphs: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><ol><li></li></ol>text</li></ul>', '-\n  1.\n\n  text'],
    ['<ul><li><ul><li></li></ul><a></a><script>hidden</script><abbr></abbr>text</li></ul>', '-\n  -\n\n  text'],
    ['<ul><li><ul><li></li></ul><a></a><script>hidden</script><abbr></abbr></li><li>next</li></ul>', '-\n  -\n- next'],
    [
      '<ul><li><ul><li></li></ul>text</li></ul>',
      '-\n  -\n\n  text',
    ],
    [
      '<ul><li><ul><li></li></ul><span>te</span><span>xt</span></li></ul>',
      '-\n  -\n\n  text',
    ],
    [
      '<ul><li><ul><li></li></ul><em>text</em></li></ul>',
      '-\n  -\n\n  *text*',
    ],
    [
      '<ol start="10"><li><ul><li></li></ul>text</li></ol>',
      '10.\n    -\n\n    text',
    ],
    [
      '<blockquote><ul><li><ul><li></li></ul>text</li></ul></blockquote>',
      '> -\n>   -\n>\n>   text',
    ],
    [
      '<ul><li><ul><li><ul><li></li></ul>text</li></ul></li></ul>',
      '-\n  -\n    -\n\n    text',
    ],
    [
      '<ul><li><ul><li></li></ul></li></ul>',
      '-\n  -',
    ],
    [
      '<ul><li><ul></ul>text</li></ul>',
      '- text',
    ],
    [
      '<ul><li><ul><li></li></ul><span></span> </li><li>next</li></ul>',
      '-\n  -\n- next',
    ],
    [
      '<ul><li><ul><li>inner</li></ul></li><li>next</li></ul>',
      '-\n  - inner\n- next',
    ],
  ])('keeps empty nested list tails in their parent: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><ul><li></li><li>a</li></ul>text</li></ul>', '-\n  -\n  - a\n\n  text'],
    ['<ul><li><ul><li>a</li></ul>text</li></ul>', '-\n  - a\n\n  text'],
    ['<ul><li>lead<ul><li>a</li></ul>text</li></ul>', '- lead\n  - a\n\n  text'],
    ['<ol><li><ol><li>a</li></ol>text</li></ol>', '1.\n   1. a\n\n   text'],
    ['<ul><li><ul><li>a</li></ul><em>text</em></li></ul>', '-\n  - a\n\n  *text*'],
    ['<ul><li><ul><li>a</li></ul><span>te</span><span>xt</span> more</li></ul>', '-\n  - a\n\n  text more'],
    ['<ul><li><ul><li>a<ul><li>b</li></ul>c</li></ul>d</li></ul>', '-\n  - a\n    - b\n\n    c\n\n  d'],
    ['<blockquote><ul><li><ul><li>a</li></ul>text</li></ul></blockquote>', '> -\n>   - a\n>\n>   text'],
    ['<ul><li><ul><li>a</li></ul>t<ul></ul>u</li></ul>', '-\n  - a\n\n  t u'],
    ['<ul><li><ul><li>a</li></ul><span></span> </li><li>next</li></ul>', '-\n  - a\n- next'],
    ['<ul><li><ul><li>a</li></ul>1. x</li></ul>', '-\n  - a\n\n  1\\. x'],
    ['<ul><li><div><ul><li>a</li></ul></div><ul></ul>t</li></ul>', '-\n  - a\n\n  t'],
    ['<ul><li><div><ul><li></li></ul></div><ul></ul><ul></ul></li><li>z</li></ul>', '-\n  -\n- z'],
  ])('keeps filled nested list tails in their parent: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([{ id: 'F1-1', html: '<ul><li>lead<ul><li></li></ul>text</li></ul>', expected: '- lead\n\n  -\n\n  text' }, { id: 'F1-2', html: '<ul><li><p>lead</p><ul><li></li></ul>text</li></ul>', expected: '- lead\n\n  -\n\n  text' }, { id: 'F1-3', html: '<ul><li><blockquote><ul><li></li></ul>text</blockquote></li></ul>', expected: '- \n  >\n  > -\n  >\n  > text' }, { id: 'F1-4', html: '<ul><li><ul><li></li></ul>a<ul><li></li></ul>b</li></ul>', expected: '-\n  -\n\n  a\n\n  -\n\n  b' }, { id: 'F2-1', html: '<ul><li><ul><li><ul><li><ul><li></li></ul></li></ul></li></ul>text</li></ul>', expected: '-\n  -\n    -\n      -\n\n  text' }, { id: 'F2-2', html: '<ol><li><ol><li><ol><li><ol><li></li></ol></li></ol></li></ol>t</li></ol>', expected: '1.\n   1.\n      1.\n         1.\n\n   t' }, { id: 'F3-1', html: '<ul><li><ul><li></li></ul><span>t</span></li></ul>', expected: '-\n  -\n\n  XtY', overrides: { span: { enter: 'X', exit: 'Y' } } }, { id: 'F3-2', html: '<ul><li><ul><li></li></ul><span></span></li><li>n</li></ul>', expected: '-\n  -\n\n  XY\n- n', overrides: { span: { enter: 'X', exit: 'Y' } } }, { id: 'F3-3', html: '<ul><li><ul><li></li></ul><em></em></li><li>n</li></ul>', expected: '-\n  -\n- n', overrides: { em: { enter: '', exit: '' } } }, { id: 'F4-1', html: '<ul><li><hr><br>text</li></ul>', expected: '- ***\n\n    \n  text' }, { id: 'F4-2', html: '<ul><li><ul><li></li></ul><br>text</li></ul>', expected: '-\n  -\n\n    \n  text' }, { id: 'F4-3', html: '<ul><li><ul><li></li></ul><br></li><li>n</li></ul>', expected: '-\n  -\n- n' }, { id: 'F5-1', html: '<ul><li><ul><li></li></ul><div></div></li><li>n</li></ul>', expected: '-\n  -\n- n' }, { id: 'F5-2', html: '<ul><li><ul><li></li></ul><p></p></li><li>n</li></ul>', expected: '-\n  -\n- n' }, { id: 'F5-3', html: '<ul><li><ul><li></li></ul><em></em></li><li>next</li></ul>', expected: '-\n  -\n- next' }, { id: 'F5-4', html: '<ul><li><ul><li></li></ul><code></code></li><li>n</li></ul>', expected: '-\n  -\n- n' }, { id: 'F6-1', html: '<ul><li><ul><li>a<br>-</li></ul>text</li></ul>', expected: '-\n  - a  \n    -\n\n  text' }, { id: 'F6-2', html: '<ul><li><ul><li>a<br>1.</li></ul>text</li></ul>', expected: '-\n  - a  \n    1.\n\n  text' }, { id: 'F7-1', html: '<ul><li><ul><li></li></ul><blockquote>q</blockquote></li></ul>', expected: '-\n  - \n  > q' }])('preserves empty list review case $id', async ({ html, expected, overrides }) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, plugins: overrides ? { tagOverrides: overrides } : undefined })).toBe(expected)
  })

  it.each([{ id: 'F8-1', html: '<ul><li>lead<br><ul><li></li></ul>text</li></ul>', expected: '- lead  \n\n  -\n\n  text' }, { id: 'F8-2', html: '<ul><li>lead<br><ol><li></li></ol>text</li></ul>', expected: '- lead  \n\n  1.\n\n  text' }, { id: 'F8-3', html: '<ul><li>lead<br><ul><li></li></ul></li></ul>', expected: '- lead  \n\n  -' }])('preserves hard-break empty list guard $id', async ({ html, expected }) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
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
