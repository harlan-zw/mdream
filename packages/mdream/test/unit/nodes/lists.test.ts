import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('lists $name', (engineConfig) => {
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
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ol><li>Level 1<ol><li>Level 1.1</li></ol></li><li>Level 2</li></ol>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. Level 1\n  1. Level 1.1\n2. Level 2')
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
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ol><li><p>text</p><pre><code class="language-bash"># comment
echo test
</code></pre><p>text</p></li></ol>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. text\n\n  ```bash\n  # comment\n  echo test\n  ```\n\n  text')
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
    expect(markdown).toBe('1. text `# comment` text')
  })

  it('code block with blank lines inside list item preserves them', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ol><li><p>x</p><pre><code>line1

line2</code></pre></li></ol>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. x\n\n  ```\n  line1\n\n  line2\n  ```')
  })

  it('code block with pre-indented content inside list item preserves existing indentation', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<ol><li><p>x</p><pre><code>function() {
  return 1;
}</code></pre></li></ol>`
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('1. x\n\n  ```\n  function() {\n  return 1;\n  }\n  ```')
  })

  // https://github.com/harlan-zw/mdream/issues/76
  it('inline code inside inline formatting inside list item has no leading space', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><strong><code>text</code></strong></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- **`text`**')
  })

  it('inline code inside non-delimiter wrapper inside list item keeps separator space', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li>prefix<span><code>x</code></span></li></ul>'
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
