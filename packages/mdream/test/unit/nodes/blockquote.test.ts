import type { TagOverride } from '@mdream/js'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('blockquotes $name', (engineConfig) => {
  it('converts blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>This is a quote</blockquote>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('> This is a quote')
  })

  it('handles nested blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>Outer quote<blockquote>Inner quote</blockquote></blockquote>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('> Outer quote\n> > Inner quote')
  })

  it('handles blockquotes with paragraphs', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote><p>First paragraph</p><p>Second paragraph</p></blockquote>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('> First paragraph\n>\n> Second paragraph')
  })

  it('handles complex nested blockquotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote><p>Outer paragraph</p><blockquote><p>Inner paragraph</p></blockquote></blockquote>'
    const markdown = htmlToMarkdown(html, { engine })

    expect(markdown).toBe('> Outer paragraph\n> > Inner paragraph')
  })
  // test for > A quote with an ![image](image.jpg) inside.
  it('handles blockquotes with images', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<blockquote>This is a quote with an <img src="image.jpg" alt="image"></blockquote>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('> This is a quote with an ![image](image.jpg)')
  })

  it.each([
    [
      'unordered lists',
      '<blockquote><ul><li>one</li><li>two</li></ul></blockquote>',
      '> - one\n> - two',
    ],
    [
      'ordered lists',
      '<blockquote><ol><li>one</li><li>two</li></ol></blockquote>',
      '> 1. one\n> 2. two',
    ],
    [
      'paragraphs followed by lists',
      '<blockquote><p>intro</p><ul><li>one</li></ul></blockquote>',
      '> intro\n>\n> - one',
    ],
    [
      'text followed by headings',
      '<blockquote>text<h2>H</h2></blockquote>',
      '> text\n>\n> ## H',
    ],
    [
      'horizontal rules',
      '<blockquote>a<hr>b</blockquote>',
      '> a\n>\n> ---\n> b',
    ],
    [
      'sibling divs',
      '<blockquote><div>a</div><div>b</div></blockquote>',
      '> a\n>\n> b',
    ],
    [
      'tables surrounded by text',
      '<blockquote>lead<table><tr><td>a</td></tr></table>tail</blockquote>',
      '> lead\n>\n> | a |\n> | --- |\n>\n> tail',
    ],
    [
      'section surrounded by text',
      '<blockquote>lead<section>x</section>tail</blockquote>',
      '> lead\n>\n> x\n>\n> tail',
    ],
    [
      'article surrounded by text',
      '<blockquote>lead<article>x</article>tail</blockquote>',
      '> lead\n>\n> x\n>\n> tail',
    ],
    [
      'nav surrounded by text',
      '<blockquote>lead<nav>x</nav>tail</blockquote>',
      '> lead\n>\n> x\n>\n> tail',
    ],
    [
      'figure surrounded by text',
      '<blockquote>lead<figure>x</figure>tail</blockquote>',
      '> lead\n>\n> x\n>\n> tail',
    ],
    [
      'nested lists',
      '<blockquote><ul><li>one<ul><li>sub</li></ul></li></ul></blockquote>',
      '> - one\n>   - sub',
    ],
    [
      'blockquotes nested in list items',
      '<ul><li><blockquote><ul><li>x</li><li>y</li></ul></blockquote></li></ul>',
      '- \n  > - x\n  > - y',
    ],
  ])('keeps %s inside the quote', async (_name, html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    [
      'single-line siblings',
      '<blockquote>a</blockquote><blockquote>b</blockquote>',
      '> a\n\n> b',
    ],
    [
      'paragraph siblings',
      '<blockquote><p>a</p></blockquote><blockquote><p>b</p></blockquote>',
      '> a\n\n> b',
    ],
    [
      'nested quote followed by sibling',
      '<blockquote><p>Outer</p><blockquote><p>Nested</p></blockquote></blockquote><blockquote><p>After</p></blockquote>',
      '> Outer\n> > Nested\n\n> After',
    ],
    [
      'siblings with newline whitespace',
      '<blockquote>a</blockquote>\n<blockquote>b</blockquote>',
      '> a\n\n> b',
    ],
    [
      'bare-text quote then paragraph-child quote',
      '<blockquote>A quote.</blockquote>\n<blockquote><p>b</p></blockquote>',
      '> A quote.\n\n> b',
    ],
    [
      'bare-text quote then heading-child quote',
      '<blockquote>A quote.</blockquote>\n<blockquote><h2>H</h2></blockquote>',
      '> A quote.\n\n> ## H',
    ],
  ])('separates %s with a blank line', async (_name, html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><blockquote>q</blockquote>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['<ul><li><blockquote>q</blockquote><em>tail</em></li></ul>', '- \n  > q\n\n  *tail*'],
    ['<ul><li><blockquote>q</blockquote> <span></span><em></em><script>hidden</script>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['<ol start=\'10\'><li><blockquote>q</blockquote>tail</li></ol>', '10. \n    > q\n\n    tail'],
    ['<ul><li><blockquote>outer<blockquote>q</blockquote>tail</blockquote>after</li></ul>', '- \n  > outer\n  > > q\n  >\n  > tail\n\n  after'],
    ['<ul><li><blockquote></blockquote></li></ul>', '-'],
    ['<blockquote>q</blockquote>tail', '> q\n\ntail'],
    ['<ul><li><blockquote>q</blockquote><span> </span><em> </em><script>hidden</script>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['<ul><li><blockquote>q</blockquote><blockquote></blockquote>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['<ul><li><blockquote>q</blockquote></li><li>next</li></ul>', '- \n  > q\n- next'],
    ['<ul><li><blockquote>q</blockquote><blockquote>r</blockquote>tail</li></ul>', '- \n  > q\n\n  > r\n\n  tail'],
    ['<ul><li><blockquote>q</blockquote><code>tail</code></li></ul>', '- \n  > q\n\n  `tail`'],
    ['<ul><li><blockquote>q</blockquote><a href="x">tail</a></li></ul>', '- \n  > q\n\n  [tail](x)'],
    ['<ul><li><blockquote>q</blockquote><img src="x" alt="tail"></li></ul>', '- \n  > q\n\n  ![tail](x)'],
    ['<ul><li><blockquote>q</blockquote><ul><li>next</li></ul></li></ul>', '- \n  > q\n  - next'],
  ])('keeps blockquote parent continuation outside the quote: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    for (let split = 0; split <= html.length; split++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(stream))
        actual += chunk
      expect(actual, `split ${split}`).toBe(expected)
    }
  })

  it.each<[string, string, Record<string, TagOverride | string>, string]>([
    ['alias', '<ul><li><x-q>q</x-q>tail</li></ul>', { 'x-q': 'blockquote' }, '- \n  > q\n\n  tail'],
    ['literal', '<ul><li><blockquote>q</blockquote>tail</li></ul>', { blockquote: { enter: '[', exit: ']', spacing: [0, 0] } }, '- [q] tail'],
    ['spacing', '<ul><li><blockquote>q</blockquote>tail</li></ul>', { blockquote: { spacing: [0, 0] } }, '- \n  > q\n\n  tail'],
  ])('keeps blockquote parent continuation with %s overrides', async (_name, html, tagOverrides, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = { engine, plugins: { tagOverrides } }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let split = 0; split <= html.length; split++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(stream, { plugins: { tagOverrides } }))
        actual += chunk
      expect(actual, `split ${split}`).toBe(expected)
    }
  })

  it('keeps blockquote parent continuation after a list rule', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><hr><blockquote>q</blockquote>tail</li></ul>'
    // The pre-existing HR prefix differs between engines (tracked separately).
    const prefix = engineConfig.name === 'Rust Engine' ? '- ***\n\n  > \n  > q' : '- ***\n\n  \n  > q'
    const expected = `${prefix}\n\n  tail`
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(stream))
        actual += chunk
      expect(actual, `width ${width}`).toBe(expected)
    }
  })

  it('keeps blockquote parent continuation after streaming drains', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const body = '<p>streamed quote paragraph</p>'.repeat(512)
    const html = `<p>prefix</p><ul><li><blockquote>${body}</blockquote><em></em><span> </span>tail</li></ul>`
    const expected = htmlToMarkdown(html, { engine })
    expect(expected.endsWith('\n\n  tail')).toBe(true)
    for (const width of [1, 31, 8192]) {
      const stream = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(stream))
        actual += chunk
      expect(actual, `width ${width}`).toBe(expected)
    }
  })

  it.each<[string, string, string, Record<string, TagOverride | string>?]>([
    ['Q1-em-sibling', '<ul><li><blockquote>q</blockquote><em></em></li><li>x</li></ul>', '- \n  > q\n- x'],
    ['Q1-em-nested', '<ul><li><blockquote>q</blockquote><em></em><ul><li>x</li></ul></li></ul>', '- \n  > q\n  - x'],
    ['Q1-strong-sibling', '<ul><li><blockquote>q</blockquote><strong></strong></li><li>x</li></ul>', '- \n  > q\n- x'],
    ['Q1-strong-nested', '<ul><li><blockquote>q</blockquote><strong></strong><ul><li>x</li></ul></li></ul>', '- \n  > q\n  - x'],
    ['Q1-code-sibling', '<ul><li><blockquote>q</blockquote><code></code></li><li>x</li></ul>', '- \n  > q\n- x'],
    ['Q1-code-nested', '<ul><li><blockquote>q</blockquote><code></code><ul><li>x</li></ul></li></ul>', '- \n  > q\n  - x'],
    ['Q1-nested-empty', '<ul><li><blockquote>q</blockquote><em><strong> </strong></em></li><li>x</li></ul>', '- \n  > q\n- x'],
    ['Q1-nested-tail', '<ul><li><blockquote>q</blockquote><em><strong> </strong></em>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['Q2-literal', '<ul><li><x-first>q</x-first><blockquote>r</blockquote>tail</li></ul>', '- \n  > q\n\n  [r] tail', { 'x-first': 'blockquote', 'blockquote': { enter: '[', exit: ']', spacing: [0, 0] } }],
    ['Q3-ul-br1', '<ul><li><blockquote>q</blockquote><br>tail</li></ul>', '- \n  > q  \n  \n  tail'],
    ['Q3-ul-br2', '<ul><li><blockquote>q</blockquote><br><br>tail</li></ul>', '- \n  > q  \n    \n  \n  tail'],
    ['Q3-ul-br3', '<ul><li><blockquote>q</blockquote><br><br><br>tail</li></ul>', '- \n  > q  \n    \n    \n  \n  tail'],
    ['Q3-ol-br1', '<ol start="10"><li><blockquote>q</blockquote><br>tail</li></ol>', '10. \n    > q  \n    \n    tail'],
    ['Q3-ol-br2', '<ol start="10"><li><blockquote>q</blockquote><br><br>tail</li></ol>', '10. \n    > q  \n      \n    \n    tail'],
    ['Q3-ol-br3', '<ol start="10"><li><blockquote>q</blockquote><br><br><br>tail</li></ol>', '10. \n    > q  \n      \n      \n    \n    tail'],
    ['R1-empty-ul', '<ul><li><blockquote>q</blockquote><ul></ul>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['R1-empty-ol', '<ul><li><blockquote>q</blockquote><ol></ol>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['R1-empty-chain', '<ul><li><blockquote>q</blockquote><ul></ul><ol></ol><span> </span>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['R2-empty-caption', '<ul><li><blockquote>q</blockquote><figcaption></figcaption>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['R2-caption-br1', '<ul><li><blockquote>q</blockquote><figcaption><br></figcaption>tail</li></ul>', '- \n  > q  \n  \n  tail'],
    ['R2-caption-br2', '<ul><li><blockquote>q</blockquote><figcaption><br><br></figcaption>tail</li></ul>', '- \n  > q  \n    \n  \n  tail'],
    ['R2-caption-br3', '<ul><li><blockquote>q</blockquote><figcaption><br><br><br></figcaption>tail</li></ul>', '- \n  > q  \n    \n    \n  \n  tail'],
    ['R2-caption-empty-em', '<ul><li><blockquote>q</blockquote><figcaption><br><em></em></figcaption>tail</li></ul>', '- \n  > q  \n  \n  tail'],
    ['R2-figure-caption', '<ul><li><blockquote>q</blockquote><figure><figcaption><br></figcaption></figure>tail</li></ul>', '- \n  > q  \n  \n  tail'],
    ['R2-caption-sibling', '<ul><li><blockquote>q</blockquote><figcaption><br></figcaption></li><li>x</li></ul>', '- \n  > q  \n- x'],
    ['R2-caption-nested', '<ul><li><blockquote>q</blockquote><figcaption><br></figcaption><ul><li>x</li></ul></li></ul>', '- \n  > q  \n  - x'],
    ['S1-hr-sibling', '<blockquote><ul><li><blockquote>x<hr></blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - \n>   > x\n>   >\n>   > ---\n>\n>   > q'],
    ['S1-hr-sibling-tail', '<blockquote><ul><li><blockquote>x<hr></blockquote><blockquote>q</blockquote>tail</li></ul></blockquote>', '> - \n>   > x\n>   >\n>   > ---\n>\n>   > q\n>\n>   tail'],
    ['S1-sibling', '<blockquote><ul><li><blockquote>x</blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - \n>   > x\n>\n>   > q'],
    ['S1-nested-sibling', '<ul><li><blockquote><blockquote>x</blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > > x\n  >\n  > > q'],
    ['S1-empty-first', '<blockquote><ul><li><blockquote></blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - \n>   > q'],
    ['S1-text-empty-first', '<blockquote><ul><li>a<blockquote></blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - a\n>   > q'],
  ])('repairs quote boundary %s at every width and split', async (_id, html, expected, tagOverrides) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = tagOverrides ? { plugins: { tagOverrides } } : undefined
    expect(htmlToMarkdown(html, { ...options, engine })).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input, options))
        actual += chunk
      expect(actual, `width ${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input, options))
        actual += chunk
      expect(actual, `split ${split}`).toBe(expected)
    }
  })

  it.each<[string, string, string, { emptyLinks?: boolean, emptyLinkText?: boolean }?]>([
    ['Q4-sibling-default', '<ul><li><blockquote>q</blockquote><a href="x"></a></li><li>x</li></ul>', '- \n  > q\n\n  [](x)\n- x'],
    ['Q4-sibling-emptyLinks', '<ul><li><blockquote>q</blockquote><a href="x"></a></li><li>x</li></ul>', '- \n  > q\n\n  [](x)\n- x', { emptyLinks: true }],
    ['Q4-sibling-emptyLinkText', '<ul><li><blockquote>q</blockquote><a href="x"></a></li><li>x</li></ul>', '- \n  > q\n- x', { emptyLinkText: true }],
    ['control-code-sibling', '<ul><li><blockquote>q</blockquote><code></code></li><li>x</li></ul>', '- \n  > q\n- x'],
    ['control-strong-sibling', '<ul><li><blockquote>q</blockquote><strong></strong></li><li>x</li></ul>', '- \n  > q\n- x'],
    ['Q4-empty-wrapper-sibling', '<ul><li><blockquote>q</blockquote><strong></strong><a href="x"></a></li><li>x</li></ul>', '- \n  > q\n\n  [](x)\n- x'],
    ['Q4-child-default', '<ul><li><blockquote>q</blockquote><a href="x"></a><ul><li>x</li></ul></li></ul>', '- \n  > q\n\n  [](x)\n  - x'],
    ['Q4-child-emptyLinks', '<ul><li><blockquote>q</blockquote><a href="x"></a><ul><li>x</li></ul></li></ul>', '- \n  > q\n\n  [](x)\n  - x', { emptyLinks: true }],
    ['Q4-child-emptyLinkText', '<ul><li><blockquote>q</blockquote><a href="x"></a><ul><li>x</li></ul></li></ul>', '- \n  > q\n  - x', { emptyLinkText: true }],
    ['control-code-child', '<ul><li><blockquote>q</blockquote><code></code><ul><li>x</li></ul></li></ul>', '- \n  > q\n  - x'],
    ['control-strong-child', '<ul><li><blockquote>q</blockquote><strong></strong><ul><li>x</li></ul></li></ul>', '- \n  > q\n  - x'],
    ['Q4-empty-wrapper-child', '<ul><li><blockquote>q</blockquote><strong></strong><a href="x"></a><ul><li>x</li></ul></li></ul>', '- \n  > q\n\n  [](x)\n  - x'],
    ['quote-after-empty-link', '<ul><li><blockquote>q</blockquote><a href="/x"></a><blockquote>next</blockquote></li></ul>', '- \n  > q\n\n  [](/x)\n  > next'],
    ['quote-after-empty-link-tail', '<ul><li><blockquote>q</blockquote><a href="/x"></a><blockquote>next</blockquote>tail</li></ul>', '- \n  > q\n\n  [](/x)\n  > next\n\n  tail'],
    ['quote-after-link-with-empty-marker', '<ul><li><blockquote>q</blockquote><a href="/x"><em></em></a><blockquote>next</blockquote></li></ul>', '- \n  > q\n\n  [](/x)\n  > next'],
    ['quote-after-marker-with-empty-link', '<ul><li><blockquote>q</blockquote><em><a href="/x"></a></em><blockquote>next</blockquote></li></ul>', '- \n  > q\n\n  *[](/x)*\n  > next'],
    ['quote-after-empty-marker', '<ul><li><blockquote>q</blockquote><em></em><blockquote>next</blockquote></li></ul>', '- \n  > q\n\n  > next'],
    ['div-after-empty-link', '<ul><li><blockquote>q</blockquote><a href="/x"></a><div>d</div></li></ul>', '- \n  > q\n\n  [](/x) d'],
    ['quote-after-link-break', '<ul><li><blockquote>q</blockquote><a href="/x"></a><br><blockquote>next</blockquote></li></ul>', '- \n  > q\n\n  [](/x)  \n  \n  > next'],
    ['item-after-link-break', '<ul><li><blockquote>q</blockquote><a href="/x"></a><br></li><li>b</li></ul>', '- \n  > q\n\n  [](/x)  \n- b'],
    ['div-in-open-marker', '<ul><li><blockquote>q</blockquote><em><div>d</div></em></li></ul>', '- \n  > q\n\n  *d*'],
    ['quote-in-open-marker', '<ul><li><blockquote>q</blockquote><em><blockquote>next</blockquote></em></li></ul>', '- \n  > q\n\n  *\n  > next\n\n  *'],
    ['quote-after-bare-anchor', '<ul><li><blockquote>q</blockquote><a></a><blockquote>next</blockquote></li></ul>', '- \n  > q\n\n  > next'],
    ['tail-after-bare-anchor', '<ul><li><blockquote>q</blockquote><a></a>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['tail-in-bare-anchor', '<ul><li><blockquote>q</blockquote><a>tail</a></li></ul>', '- \n  > q\n\n  tail'],
    ['heading-after-bare-anchor', '<ul><li><blockquote>q</blockquote><a></a><h2>h</h2></li></ul>', '- \n  > q\n\n  ## h'],
    ['quote-after-link-emptyLinks', '<ul><li><blockquote>q</blockquote><a href="#"></a><blockquote>next</blockquote></li></ul>', '- \n  > q\n\n  > next', { emptyLinks: true }],
    ['quote-after-link-emptyLinkText', '<ul><li><blockquote>q</blockquote><a href="/x"></a><blockquote>next</blockquote></li></ul>', '- \n  > q\n\n  > next', { emptyLinkText: true }],
    ['caption-space-owner', '<figcaption>cap</figcaption><a href="x"></a> tail', '*cap*\n\n[](x)tail'],
    ['caption-strong-owner', '<figcaption>cap</figcaption><strong>tail</strong>', '*cap*\n\n**tail**'],
    ['caption-list-owner', '<ul><li><figcaption>cap</figcaption><a href="x"></a> tail</li><li>x</li></ul>', '- *cap*\n\n  [](x)tail\n- x'],
  ])('keeps preserved quote link transitions %s at every width and split', async (_id, html, expected, clean) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = clean ? { clean } : undefined
    expect(htmlToMarkdown(html, { ...options, engine })).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input, options))
        actual += chunk
      expect(actual, `width ${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input, options))
        actual += chunk
      expect(actual, `split ${split}`).toBe(expected)
    }
  })

  it.each<[string, string, string, Record<string, TagOverride | string>?]>([
    ['hr-only', '<ul><li><blockquote>q</blockquote><hr></li></ul>', '- \n  > q\n\n  ---'],
    ['hr-sibling', '<ul><li><blockquote>q</blockquote><hr></li><li>x</li></ul>', '- \n  > q\n\n  ---\n- x'],
    ['hr-child', '<ul><li><blockquote>q</blockquote><hr><ul><li>x</li></ul></li></ul>', '- \n  > q\n\n  ---\n\n  - x'],
    ['hr-tail', '<ul><li><blockquote>q</blockquote><hr>tail</li></ul>', '- \n  > q\n\n  ---\n\n  tail'],
    ['pre-code-only', '<ul><li><blockquote>q</blockquote><pre><code>x</code></pre></li></ul>', '- \n  > q\n\n  ```\n  x\n  ```'],
    ['pre-code-sibling', '<ul><li><blockquote>q</blockquote><pre><code>x</code></pre></li><li>x</li></ul>', '- \n  > q\n\n  ```\n  x\n  ```\n\n- x'],
    ['pre-code-child', '<ul><li><blockquote>q</blockquote><pre><code>x</code></pre><ul><li>x</li></ul></li></ul>', '- \n  > q\n\n  ```\n  x\n  ```\n\n  - x'],
    ['pre-code-tail', '<ul><li><blockquote>q</blockquote><pre><code>x</code></pre>tail</li></ul>', '- \n  > q\n\n  ```\n  x\n  ```\n\n  tail'],
    ['pre-only', '<ul><li><blockquote>q</blockquote><pre>x</pre></li></ul>', '- \n  > q\n\n  ```\n  x\n  ```'],
    ['pre-sibling', '<ul><li><blockquote>q</blockquote><pre>x</pre></li><li>x</li></ul>', '- \n  > q\n\n  ```\n  x\n  ```\n\n- x'],
    ['pre-child', '<ul><li><blockquote>q</blockquote><pre>x</pre><ul><li>x</li></ul></li></ul>', '- \n  > q\n\n  ```\n  x\n  ```\n\n  - x'],
    ['pre-tail', '<ul><li><blockquote>q</blockquote><pre>x</pre>tail</li></ul>', '- \n  > q\n\n  ```\n  x\n  ```\n\n  tail'],
    ['empty-em-hr-sibling', '<ul><li><blockquote>q</blockquote><em></em><hr></li><li>x</li></ul>', '- \n  > q\n\n  ---\n- x'],
    ['empty-strong-pre-code-child', '<ul><li><blockquote>q</blockquote><strong></strong><pre><code>x</code></pre><ul><li>x</li></ul></li></ul>', '- \n  > q\n\n  ```\n  x\n  ```\n\n  - x'],
    ['empty-pre-code-sibling', '<ul><li><blockquote>q</blockquote><pre><code></code></pre></li><li>x</li></ul>', '- \n  > q\n\n  ```\n\n  ```\n\n- x'],
    ['empty-pre-tail', '<ul><li><blockquote>q</blockquote><pre></pre>tail</li></ul>', '- \n  > q\n\n  tail'],
    ['empty-literal-hr-tail', '<ul><li><blockquote>q</blockquote><hr>tail</li></ul>', '- \n  > q\n\n  tail', { hr: { enter: '', exit: '', spacing: [0, 0] } }],
    ['literal-hr-sibling', '<ul><li><blockquote>q</blockquote><hr></li><li>x</li></ul>', '- \n  > q\n\n  [rule]\n- x', { hr: { enter: '[rule]', exit: '', spacing: [0, 0] } }],
    ['alias-hr-sibling', '<ul><li><blockquote>q</blockquote><x-rule></li><li>x</li></ul>', '- \n  > q\n\n  ---\n- x', { 'x-rule': 'hr' }],
    ['caption-owner-hr', '<figcaption>cap</figcaption><hr>', '*cap*\n\n---'],
  ])('writes one boundary for quote block fragment %s at every width and split', async (_id, html, expected, tagOverrides) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = tagOverrides ? { plugins: { tagOverrides } } : undefined
    expect(htmlToMarkdown(html, { ...options, engine })).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input, options))
        actual += chunk
      expect(actual, `width ${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input, options))
        actual += chunk
      expect(actual, `split ${split}`).toBe(expected)
    }
  })

  it('keeps representative quote structure across every stream split', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><blockquote><ul><li>x</li><li>y</li></ul></blockquote></li></ul>'
    const expected = htmlToMarkdown(html, { engine })

    for (let split = 0; split <= html.length; split++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of engine.streamHtmlToMarkdown(stream))
        actual += chunk
      expect(actual, `split ${split}`).toBe(expected)
    }
  })
})
