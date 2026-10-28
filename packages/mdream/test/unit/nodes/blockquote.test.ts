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
