import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('headings $name', (engineConfig) => {
  it('converts h1', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h1>Heading 1</h1>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('# Heading 1')
  })

  it('converts h2', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h2>Heading 2</h2>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('## Heading 2')
  })

  it('converts h3', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h3>Heading 3</h3>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('### Heading 3')
  })

  it('converts h4', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h4>Heading 4</h4>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('#### Heading 4')
  })

  it('converts h5', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h5>Heading 5</h5>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('##### Heading 5')
  })

  it('converts h6', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h6>Heading 6</h6>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('###### Heading 6')
  })

  it('nested headers', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="/test"><h1>Heading 1</h1></a><ul><li><h2>Heading 2</h2></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[<h1>Heading 1</h1>](/test)\n\n- ## Heading 2')
  })

  // In a list item the heading's own `#` marker follows the item marker or the
  // continuation indent: it is no closing sequence to escape, and the next block
  // still opens its own line, as it does at the root.
  it.each([
    ['<ul><li><pre>Intro<span><h3>T</h3></span></pre></li></ul>', '- ```\n  Intro ### T\n  ```', { span: 'strong' }],
    ['<ul><li><code><h6>\n</h6><h3></h3>x</code></li></ul>', '- `###### ### x`', { h3: { enter: '### ', exit: '' } }],
  ] as const)('preserves heading overrides inside list code: %s', async (html, expected, tagOverrides) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine, plugins: { tagOverrides } })).toBe(expected)
  })

  it.each([
    ['<ul><li><figure><figcaption><q><h3>T</h3></q>s</figcaption></figure></li></ul>', '- *"### T"s*'],
    ['<ul><li><figure><figcaption><q><h3></h3></q>s</figcaption></figure></li></ul>', '- *"### "s*'],
    ['<ul><li><figure><figcaption><a href="/l"></a><h3>T</h3></figcaption></figure></li></ul>', '- *[](/l)### T*'],
    ['<ul><li><figure><figcaption><del><h3>T</h3></del></figcaption></figure></li></ul>', '- *~~### T~~*'],
  ])('keeps a heading opening a list caption inline: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<main><ul><li><h3></h3><p>Partner description</p></li></ul></main>', '- ###\n\n  Partner description'],
    ['<ol><li><h3></h3><p>Partner description</p></li></ol>', '1. ###\n\n   Partner description'],
    ['<ol start="10"><li><h1></h1><p>b</p></li></ol>', '10. #\n\n    b'],
    ['<ul><li><h3></h3></li><li>b</li></ul>', '- ###\n- b'],
    ['<ul><li>a<ul><li>b<ul><li><h3></h3><p>c</p></li></ul></li></ul></li></ul>', '- a\n  - b\n    - ###\n\n      c'],
    ['<ol><li>a<ol><li>b<ol><li><h3></h3><p>c</p></li></ol></li></ol></li></ol>', '1. a\n   1. b\n      1. ###\n\n         c'],
    ['<ul><li><pre>x</pre><h3></h3><p>b</p></li></ul>', '- ```\n  x\n  ```\n\n  ###\n\n  b'],
    ['<ul><li><hr><h3></h3><p>b</p></li></ul>', '- ***\n\n  ###\n\n  b'],
    ['<ul><li><h2></h2><pre>code</pre></li></ul>', '- ##\n\n  ```\n  code\n  ```'],
    ['<ul><li><h2></h2><table><tr><td>x</td></tr></table></li></ul>', '- ##\n\n  | x |\n  | --- |'],
    ['<ul><li><h2></h2><ul><li>b</li></ul></li></ul>', '- ##\n  - b'],
    ['<blockquote><ul><li><h3></h3><p>b</p></li></ul></blockquote>', '> - ###\n>\n>   b'],
    ['<blockquote><ol><li><h3></h3><p>b</p></li></ol></blockquote>', '> 1. ###\n>\n>    b'],
    ['<ul><li><blockquote><h3></h3><p>b</p></blockquote></li></ul>', '- \n  > ###\n  >\n  > b'],
    ['<h3></h3><p>Partner description</p>', '###\n\nPartner description'],
    ['<blockquote><h3></h3><p>b</p></blockquote>', '> ###\n>\n> b'],
  ])('closes an empty heading in a list item: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><h3>#</h3><p>b</p></li></ul>', '- ### \\#\n\n  b'],
    ['<ul><li><h3>###</h3><p>b</p></li></ul>', '- ### \\###\n\n  b'],
    ['<ol><li><h3>a #</h3></li></ol>', '1. ### a \\#'],
    ['<ul><li><pre>x</pre><h3>#</h3></li></ul>', '- ```\n  x\n  ```\n\n  ### \\#'],
    // The escaped run keeps the heading's trailing space trimmable.
    ['<ul><li><h3> # </h3><p>b</p></li></ul>', '- ### \\#\n\n  b'],
  ])('escapes a closing hash run in a list item: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  // Text before the heading on the item's line, past a space too, and text
  // after it each get a block of their own, as at the root (#388).
  it.each([
    ['<ul><li>Intro <h3>Title</h3><p>Body</p></li></ul>', '- Intro\n\n  ### Title\n\n  Body'],
    ['<ul><li>Intro\n    <h3>Title</h3><p>Body</p></li></ul>', '- Intro\n\n  ### Title\n\n  Body'],
    ['<ul><li><strong>Intro</strong> <h3>Title</h3></li></ul>', '- **Intro**\n\n  ### Title'],
    ['<ul><li>Intro <h3></h3><p>Body</p></li></ul>', '- Intro\n\n  ###\n\n  Body'],
    ['<ul><li><h3></h3>Text</li></ul>', '- ###\n\n  Text'],
    ['<ol><li><h1>T</h1>\nx</li><li>y</li></ol>', '1. # T\n\n   x\n2. y'],
    ['<ol start="10"><li><h3>T</h3>x</li></ol>', '10. ### T\n\n    x'],
    ['<ul><li><h3>Title</h3><strong>Text</strong></li></ul>', '- ### Title\n\n  **Text**'],
    ['<ul><li><h3>T</h3># x</li></ul>', '- ### T\n\n  \\# x'],
    ['<ul><li><span><h3>T</h3>more</span></li></ul>', '- ### T\n\n  more'],
    // These already leave the heading its line.
    ['<ul><li> <h3>Title</h3></li></ul>', '- ### Title'],
    ['<ul><li><h3>T</h3><br>more</li></ul>', '- ### T  \n  more'],
    ['<ul><li><h3>T</h3><ul><li>x</li></ul></li></ul>', '- ### T\n  - x'],
    ['<ul><li><h3>T</h3><i class="icon"></i></li><li>b</li></ul>', '- ### T\n- b'],
    // An inline wrapper keeps the heading inline, as at the root.
    ['<ul><li><strong><h3>T</h3>more</strong></li></ul>', '- **### T more**'],
    ['<ul><li><strong>Intro <h3>T</h3></strong></li></ul>', '- **Intro ### T**'],
    // Code and caption emphasis would be split.
    ['<ul><li><pre><h3>T</h3>b</pre></li></ul>', '- ```\n  ### T b\n  ```'],
    ['<ul><li><figure><figcaption><h3>T</h3>b</figcaption></figure></li></ul>', '- *### T b*'],
  ])('gives a heading in a list item its own line: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  // An override that writes no `#` prefix leaves nothing to take in the text.
  it.each([
    ['<ul><li><h3>T</h3>x</li></ul>', '- T x'],
    ['<ul><li>a<ul><li>b<ul><li><h3></h3><p>c</p></li></ul></li></ul></li></ul>', '- a\n  - b\n    - c'],
  ])('keeps the text after a heading without an ATX prefix: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const plugins = { tagOverrides: { h3: { enter: '', exit: '' } } }
    expect(htmlToMarkdown(html, { engine, plugins })).toBe(expected)
  })

  // A raw tag or a wrapper that writes nothing reads the same on either side of
  // a block break, so the heading still gets its own block.
  it.each([
    ['<ul><li>Intro <u><h4>T</h4></u></li></ul>', '- Intro <u>\n\n  #### T</u>'],
    ['<ul><li><em>E</em><label><h6>T</h6></label></li></ul>', '- *E*\n\n  ###### T'],
    ['<ul><li><button>Intro<h3>T</h3></button></li></ul>', '- Intro\n\n  ### T'],
    ['<ul><li><label>Intro<h3>T</h3>more</label></li></ul>', '- Intro\n\n  ### T\n\n  more'],
    ['<ul><li><small><abbr><h3>A</h3><h3>B</h3></abbr></small></li></ul>', '- ### A\n\n  ### B'],
    ['<ul><li><small><abbr><h3>T</h3></abbr></small>x</li></ul>', '- ### T\n\n  x'],
    ['<ul><li>x <address><h4>T</h4></address>more</li></ul>', '- x <address>\n\n  #### T</address>\n\n  more'],
    // Delimiters that pair across the wrapper keep it inline.
    ['<ul><li><q><h3>T</h3>more</q></li></ul>', '- " ### T more"'],
    ['<ul><li><small><strong><h3>T</h3></strong>more</small></li></ul>', '- **### T**more'],
  ])('breaks a heading in a list item out of a wrapper without delimiters: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  // An override's own markers pair like delimiters; one without output does not.
  it.each([
    [{ label: { enter: '**', exit: '**' } }, '- Intro **### T**more'],
    [{ label: { exit: '!' } }, '- Intro ### T!more'],
    [{ label: { enter: '' } }, '- Intro\n\n  ### T\n\n  more'],
  ])('keeps a heading in a list item inline only in a wrapper override with output: %o', async (tagOverrides, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li>Intro <label><h3>T</h3></label>more</li></ul>'
    expect(htmlToMarkdown(html, { engine, plugins: { tagOverrides } })).toBe(expected)
  })

  // A `<p>` or `<div>` that opens the fence of a `<pre>` after the heading
  // leaves its separator to the fence.
  it.each([
    ['<ul><li><h1></h1><pre><div>x</div></pre></li></ul>', '- #\n\n  ```\n  x\n  ```'],
    ['<ul><li><h1></h1><pre> <p>x</p></pre></li></ul>', '- #\n\n  ```\n  x\n  ```'],
    ['<ul><li>a<pre><p>x</p><p>y</p></pre></li></ul>', '- a\n\n  ```\n  x\n\n  y\n  ```'],
  ])('keeps a block that opens a code block in a list item out of the code: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  // The fence of a `<pre>` after the heading pays the break the heading owes,
  // even when the `<pre>`'s first child opens it, as highlighted code does.
  it.each([
    ['<ul><li><h3>T</h3><pre><span>x</span></pre></li></ul>', '- ### T\n\n  ```\n  x\n  ```'],
    ['<ol><li><h2>Install</h2><pre class="language-sh"><span class="token function">npm</span> install mdream</pre></li><li>b</li></ol>', '1. ## Install\n\n   ```sh\n   npm install mdream\n   ```\n\n2. b'],
    ['<ul><li><h3>T</h3><div class="highlight"><pre><span></span><span class="n">x</span></pre></div></li></ul>', '- ### T\n\n  ```\n  x\n  ```'],
    ['<ul><li>a<ul><li><h3>T</h3><pre><div>x</div></pre>y</li></ul></li></ul>', '- a\n  - ### T\n\n    ```\n    x\n    ```\n\n    y'],
  ])('keeps the code after a heading in a list item: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    const plugins = { tagOverrides: { span: 'strong' } }
    expect(htmlToMarkdown(html, { engine, plugins })).toBe(expected)
  })
})
