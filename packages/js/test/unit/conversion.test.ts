import { describe, expect, it } from 'vitest'
import { TAG_NAV } from '../../src/const'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { createPlugin } from '../../src/pluggable/plugin'
import { filterPlugin } from '../../src/plugins/filter'
import { withMinimalPreset } from '../../src/preset/minimal'
import { htmlToText } from '../../src/text'

describe('root conversion', () => {
  it.each(['../../guide', '/../../guide', './../../../guide'])('clamps %s to the origin root', (href) => {
    expect(htmlToMarkdown(`<a href="${href}">Guide</a>`, {
      origin: 'https://example.com/docs/',
    })).toBe('[Guide](https://example.com/guide)')
  })

  it('converts without loading optional plugins', () => {
    const html = '<main><h1>Hello</h1><p>A <strong>small</strong> test.</p></main>'
    expect(htmlToMarkdown(html)).toBe('# Hello\n\nA **small** test.')
  })

  it('supports tag overrides', () => {
    expect(htmlToMarkdown('<x-title>Hello</x-title>', {
      tagOverrides: { 'x-title': 'h2' },
    })).toBe('## Hello')
  })

  it('applies explicit plugins', () => {
    expect(htmlToMarkdown('<nav>hidden</nav><p>shown</p>', {
      plugins: [filterPlugin({ exclude: [TAG_NAV] })],
    })).toBe('shown')
  })

  it('keeps root-relative parent traversal inside the origin', () => {
    expect(htmlToMarkdown('<a href="../guide">Guide</a>', {
      origin: 'https://example.com/',
    })).toBe('[Guide](https://example.com/guide)')
  })

  it('rejects clean rules that did not come from clean()', () => {
    expect(() => htmlToMarkdown('<p>x</p>', { clean: true as any })).toThrow('@mdream/js/clean')
  })

  it('streams without optional plugins', async () => {
    const html = '<h1>Hello</h1>'
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html)
        controller.close()
      },
    })
    let markdown = ''
    for await (const chunk of streamHtmlToMarkdown(stream))
      markdown += chunk
    expect(markdown).toBe(htmlToMarkdown(html))
  })
})

describe('text conversion', () => {
  it.each([
    ['keeps the separator before a trailing empty cell', '<table><tr><td>a</td><td></td></tr><tr><td>b</td><td>c</td></tr></table>', 'a\t\nb\tc'],
    ['adds no space before an underscore after a block element', '<p>snake<x-v>_case</x-v></p>', 'snake_case'],
    ['drops an empty quotation', '<p>a<q></q>b</p>', 'a b'],
    ['drops the space after an empty caption break', 'a<figcaption><br></figcaption> b', 'a\nb'],
    ['keeps the space after a break', '<p>a<br> b</p>', 'a\n b'],
  ])('%s', (_name, html, expected) => {
    expect(htmlToText(html)).toBe(expected)
  })
})

describe('plugin reuse', () => {
  const pages = [
    '<html><head><title>A</title><meta name="description" content="da"></head><body><header>x</header><h1>A</h1><p>a</p><footer>f</footer></body></html>',
    '<html><head><title>B</title></head><body><h1>B</h1><p>b</p></body></html>',
    '<html><head><title>A</title></head><body><main><h1>A</h1><p>a</p></main></body></html>',
    '<html><head><title>C</title></head><body><h1>C</h1><p>c</p></body></html>',
  ]

  it('gives a reused preset the same output as a fresh one', () => {
    const shared = withMinimalPreset()
    for (const page of pages)
      expect(htmlToMarkdown(page, shared)).toBe(htmlToMarkdown(page, withMinimalPreset()))
  })

  it('keeps concurrent streams that share plugins apart', async () => {
    const shared = withMinimalPreset()
    const stream = (html: string) => new ReadableStream<string>({
      start(controller) {
        for (let index = 0; index < html.length; index += 16)
          controller.enqueue(html.slice(index, index + 16))
        controller.close()
      },
    })
    const collect = async (html: string) => {
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(stream(html), shared))
        output += chunk
      return output
    }
    const outputs = await Promise.all(pages.map(collect))
    expect(outputs).toEqual(pages.map(page => htmlToMarkdown(page, withMinimalPreset({ clean: false }))))
  })
})

describe('writer ownership', () => {
  const cases: [string, string][] = [
    ['<table><tr></tr></table>', ''],
    ['<p>x</p><table><tr></tr></table><p>y</p>', 'x\n\ny'],
    ['<table><tr></tr><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>', '| a | b |\n| --- | --- |\n| c |'],
    ['<table><tr><b>x</b><td>a</td></tr></table>', '**x**\n\n| a |\n| --- |'],
    ['<p><code>a<code>b</code>c</code></p>', '`abc`'],
    ['<p><code>`a<code>`b`</code>c`</code></p>', '`` `a`b`c` ``'],
    ['<ul><li>x<code>a<code>b</code>c</code></li></ul>', '- x `abc`'],
    ['<table><tr><td><code>a|<code>b|</code>c</code></td></tr></table>', '| `a\\|b\\|c` |\n| --- |'],
    ['<p><code>a<code>b', '`ab`'],
    ['<pre><td><pre>', '```\n<pre></pre>\n```'],
    ['<pre>a<pre>b</pre>c</pre>d', '```\na\n\nb\n\nc\n```\n\nd'],
    ['<pre>a<table><tr><td><pre>b</pre></td></tr></table>c</pre>d', '```\na\n\n| <pre>b</pre> |\n| --- |\n\nc\n```\n\nd'],
    ['<label><h4>t</h4>x</label>', '#### t\n\nx'],
    ['<small><h4>t</h4>x</small>', '#### t\n\nx'],
    ['<a><h4>t</h4>x</a>', '<h4>t</h4>\n\nx'],
    ['<a href="/x"><h2>Title</h2></a><p>next</p>', '[<h2>Title</h2>](/x)\n\nnext'],
    ['<b><h4>t</h4></b>x', '**#### t**x'],
  ]

  it.each(cases)('serializes %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it.each(cases)('streams %s at every split', async (html, expected) => {
    for (let split = 0; split <= html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input))
        output += chunk
      expect(output, `split=${split}`).toBe(expected)
    }
  })

  it.each([
    [{ code: { enter: '{', exit: '}' } }, '{a{b}c}'],
    [{ code: { exit: '}' } }, '`ab}c}'],
    [{ 'x-code': 'code' }, '`abc`'],
  ])('preserves nested code overrides %j', async (tagOverrides, expected) => {
    const html = 'x-code' in tagOverrides
      ? '<p><code>a<x-code>b</x-code>c</code></p>'
      : '<p><code>a<code>b</code>c</code></p>'
    expect(htmlToMarkdown(html, { tagOverrides })).toBe(expected)
    for (const size of [1, 3, html.length]) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let index = 0; index < html.length; index += size)
            controller.enqueue(html.slice(index, index + size))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, { tagOverrides }))
        output += chunk
      expect(output, `size=${size}`).toBe(expected)
    }
  })

  it('keeps a first row deferred under a spacing-only override', () => {
    expect(htmlToMarkdown('<table><tr></tr><tr><td>a</td></tr></table>', {
      tagOverrides: { tr: { spacing: [0, 1] } },
    })).toBe('| a |\n| --- |')
  })

  it.each(['td', 'th'])('keeps the owning row when %s enter output is overridden', async (cell) => {
    const html = `<table><tr></tr><tr><${cell}>a</${cell}></tr></table>`
    for (const enter of ['', '[']) {
      const options = { tagOverrides: { [cell]: { enter } } }
      const expected = `| ${enter}a |\n| --- |`
      expect(htmlToMarkdown(html, options)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const input = new ReadableStream<string>({
          start(controller) {
            for (let offset = 0; offset < html.length; offset += width)
              controller.enqueue(html.slice(offset, offset + width))
            controller.close()
          },
        })
        let output = ''
        for await (const chunk of streamHtmlToMarkdown(input, options))
          output += chunk
        expect(output, `width=${width}`).toBe(expected)
      }
    }
  })

  it.each(['td', 'th'])('keeps the owning row when a plugin writes %s enter output', async (cell) => {
    let enters = 0
    const plugin = createPlugin({
      onNodeEnter(node) {
        if (node.name === cell) {
          enters++
          return '['
        }
      },
    })
    const html = `<table><tr><${cell}>a</${cell}></tr></table>`
    expect(htmlToMarkdown(html, { plugins: [plugin] }))
      .toBe('| [a |\n| --- |')
    expect(enters).toBe(1)
    for (let width = 1; width <= html.length; width++) {
      enters = 0
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, { plugins: [plugin] }))
        output += chunk
      expect(output, `width=${width}`).toBe('| [a |\n| --- |')
      expect(enters).toBe(1)
    }
  })

  it('gives sibling code spans separate owners under an exit-only override', () => {
    expect(htmlToMarkdown('<code>a</code><code>b</code>', {
      tagOverrides: { code: { exit: '}' } },
    })).toBe('`a}`b}')
  })

  it.each([
    ['<code>x</code>', '[x`'],
    ['<code>a<code>b</code>c</code>d', '[a[b`c`d'],
  ])('keeps default exits under an enter-only code override: %s', async (html, expected) => {
    const options = { tagOverrides: { code: { enter: '[' } } }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let size = 1; size <= html.length; size++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let index = 0; index < html.length; index += size)
            controller.enqueue(html.slice(index, index + size))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `size=${size}`).toBe(expected)
    }
  })

  it('calls literal wrapper handlers only on their matching events', () => {
    let enters = 0
    let exits = 0
    const output = htmlToMarkdown('<label><h2>T</h2>x</label>', {
      plugins: [{
        processAttributes(node) {
          if (node.name === 'label') {
            node.tagHandler = {
              ...node.tagHandler,
              literalEnter: true,
              literalExit: true,
              enter: () => {
                enters++
                return '['
              },
              exit: () => {
                exits++
                return ']'
              },
            }
          }
        },
      }],
    })
    expect(output).toBe('[## T x]')
    expect(enters).toBe(1)
    expect(exits).toBe(1)
  })

  it.each([
    ['<p><x-code>a<code>b</code>c</x-code></p>', '`abc`'],
    ['<p><code>a<x-code>b`c</x-code>d</code>e</p>', '``ab`cd``e'],
  ])('streams a code alias with one owner: %s', async (html, expected) => {
    const options = { tagOverrides: { 'x-code': 'code' } }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let size = 1; size <= html.length; size++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let index = 0; index < html.length; index += size)
            controller.enqueue(html.slice(index, index + size))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `size=${size}`).toBe(expected)
    }
  })

  it('keeps deeply nested code in one span across small stream chunks', async () => {
    const payload = 'x`'.repeat(128)
    const html = `<p>${'<code>'.repeat(508)}${payload}${'</code>'.repeat(508)}</p>`
    const expected = `\`\` ${payload} \`\``
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const size of [1, 7, 64, html.length]) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let index = 0; index < html.length; index += size)
            controller.enqueue(html.slice(index, index + size))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input))
        output += chunk
      expect(output, `size=${size}`).toBe(expected)
    }
  })
})
