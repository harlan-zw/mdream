import type { ParseState } from '../../src/parse'
import type { MdreamOptions, TransformPlugin } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { createMarkdownProcessor, noteListTailRewrite } from '../../src/markdown-processor'
import { createMarkdownDrain } from '../../src/markdown-stream'
import { finalizeParse, parseHtmlStream } from '../../src/parse'
import { processPluginsForEvent } from '../../src/plugin-processor'
import { createPlugin, filterPlugin } from '../../src/plugins'
import { tagHandlers } from '../../src/tags'
import * as markerUtils from '../../src/utils'

function chunkedStream(html: string, chunkSize: number): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < html.length; offset += chunkSize)
        controller.enqueue(html.slice(offset, offset + chunkSize))
      controller.close()
    },
  })
}

async function streamConvert(html: string, chunkSize: number, options?: MdreamOptions): Promise<string> {
  let markdown = ''
  for await (const chunk of streamHtmlToMarkdown(chunkedStream(html, chunkSize), options))
    markdown += chunk
  return markdown
}

function hashChunk(hash: number, chunk: string): number {
  for (let i = 0; i < chunk.length; i++)
    hash = Math.imul(hash ^ chunk.charCodeAt(i), 16777619)
  return hash >>> 0
}

const BLOCK_NEWLINE_HTML = [
  '<div class="wrap">\n\t\t\t\t        ',
  '<form action="https://ex.example/act?x=1&amp;id=42" class="foo bar wrap" data-flag method="post">',
  '<a aria-controls="dd"\n aria-expanded="false"\n class="btn menu-btn"\n data-dropdown="dd"\n href="#">\n ',
  '<span>Alpha Beta Gamma</a>\n<li>\n </li>\n</form>',
  '<div class="badges"><a href="/other-link/" target="_blank" class="bp"> Delta</a></div></div>',
].join('')

describe('streaming drain parity', () => {
  it.each([
    '<p>before</p><script>é漢🎉 &amp; if (a < b) x()</script><p>after</p>',
    '<p>before</p><script><!--<script>nested</script>--></script><p>after</p>',
    '<p>before</p><script>x</scriptx>y</SCRIPT ><p>after</p>',
    '<p>before</p><script>unterminated </scr',
    '<details><script>x</script><a href="/x">link</a></details>',
    '<table><tr><td>before<script>x</script>after</td></tr></table>',
  ])('preserves excluded script boundaries: %s', async (html) => {
    const expected = htmlToMarkdown(html)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
    const bytes = new TextEncoder().encode(html)
    let output = ''
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes)
          controller.enqueue(new Uint8Array([byte]))
        controller.close()
      },
    })
    for await (const chunk of streamHtmlToMarkdown(stream))
      output += chunk
    expect(output).toBe(expected)
  })

  it('preserves script text events for streaming plugins', async () => {
    const body = 'é漢🎉 if (a < b) x(); '.repeat(2048)
    const html = `<p>before</p><script>${body}</script><p>after</p>`
    const seen: string[] = []
    const plugins = [createPlugin({
      processTextNode(node) {
        seen.push(node.value)
      },
    })]
    expect(await streamConvert(html, 127, { plugins })).toBe(htmlToMarkdown(html))
    expect(seen).toEqual(['before', body, 'after'])
  })

  it('discards a long excluded script without changing following Markdown', async () => {
    const html = `<p>before</p><script>${'x<&amp;é漢🎉 '.repeat(32768)}</script><p><a href="/end">after</a></p>`
    expect(await streamConvert(html, 4096)).toBe('before\n\n[after](/end)')
  })

  it.each([
    '<b>*<li><li><ul>#</b></li></dl>',
    '\uFEFF<em></dl>#</blockquote><p>&nbsp;</a><li>#',
    '<b>prefix</b><ol start="999999999"><li>#</li></ol>',
    '<ol start="999999999"><li>#</li></ol>',
  ])('keeps list-marker escape context across compaction: %s', async (html) => {
    const plugins = [createPlugin({ processTextNode() {} })]
    for (const options of [{}, { plugins }, { wrapWidth: 20 }]) {
      const expected = htmlToMarkdown(html, options)
      for (const chunkSize of [1, 2, 3, 7, html.length])
        expect(await streamConvert(html, chunkSize, options), `chunkSize=${chunkSize}`).toBe(expected)
    }
  })
  it.each(['<li><li><br><ol><li>', '_<li><br><ol><li>', '<dl><li><blockquote><ol><li>'])('preserves malformed list spacing after drained markers: %s', async (html) => {
    const expected = htmlToMarkdown(html)
    for (const chunkSize of [1, 3, 7])
      expect(await streamConvert(html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
  })
  it.each(['*<details>_', '<br><details>[', '<details><ol><br>['])('keeps raw HTML line openers across compaction: %s', async (html) => {
    const expected = htmlToMarkdown(html)
    for (const chunkSize of [1, 3, 7])
      expect(await streamConvert(html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
  })
  it('keeps raw HTML Markdown context across drained empty list boundaries', async () => {
    const html = '<dd><ol><i><ol>_'
    const expected = '<dd>\n\n*\\_*\n\n</dd>'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const chunkSize of [1, 3, 7])
      expect(await streamConvert(html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
  })
  it('does not repeat a BOM-prefixed paragraph during finalization', async () => {
    const html = '\uFEFF<p>x</p>'
    const expected = '\uFEFF\n\nx'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(html, chunkSize)).toBe(expected)
  })

  it.each(['\uFEFF', '\u00A0', '\u2003', '\u2028', ' \uFEFF\u00A0\n'])('emits content once after leading whitespace %j', async (leading) => {
    for (const body of [
      '<p>first</p><p>before\uFEFFafter and more words</p>',
      '<h2>first #</h2><p><a href="/x">before\uFEFFafter</a> and more words</p>',
      '<pre><code>first\n  second</code></pre><p>before\uFEFFafter</p>',
    ]) {
      const html = leading + body
      for (const options of [
        {},
        { wrapWidth: 12 },
        { plugins: [createPlugin({ processTextNode: node => ({ content: node.value, skip: false }) })] },
      ]) {
        const expected = htmlToMarkdown(html, options)
        for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
          expect(await streamConvert(html, chunkSize, options), `chunkSize=${chunkSize}`).toBe(expected)
      }
    }
  })

  it('keeps interleaved drain cursors independent of one-shot conversions', async () => {
    const inputs = [
      '<p>left</p><figure><figcaption>caption <em>one</em></figcaption></figure><p>end</p>',
      '<h2>right #</h2><p><a href="/right">link <strong>two</strong></a></p>',
    ]
    const expected = inputs.map(html => htmlToMarkdown(html))
    const outputs = ['', '']
    const iterators = inputs.map(html => streamHtmlToMarkdown(chunkedStream(html, 7))[Symbol.asyncIterator]())
    while (true) {
      const chunks = await Promise.all(iterators.map(iterator => iterator.next()))
      for (let index = 0; index < chunks.length; index++) {
        if (!chunks[index]!.done)
          outputs[index] += chunks[index]!.value
      }
      if (chunks.every(chunk => chunk.done))
        break
      expect(htmlToMarkdown('<p>between <code>a`b</code></p>')).toBe('between ``a`b``')
    }
    expect(outputs).toEqual(expected)
  })
  it.each([
    ['&nbsp;<b></b>#', '#'],
    ['<br>x<p>y</p>', 'x\n\ny'],
    ['<br>x<blockquote>y</blockquote>', 'x\n\n> y'],
    ['&nbsp;<p>x</p>y', 'x\n\ny'],
    ['a<li><q></q></li>b', 'a\n\n- b'],
  ])('preserves semantic context at every chunk width: %s', async (html, expected) => {
    for (const options of [{}, { plugins: [filterPlugin({ exclude: ['nav'] })] }]) {
      expect(htmlToMarkdown(html, options)).toBe(expected)
      for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
        expect(await streamConvert(html, chunkSize, options), `chunkSize=${chunkSize}`).toBe(expected)
    }
  })

  it.each([
    '<div>Alpha</div>',
    '<div>Alpha</div><div>Beta</div>',
    '<div>Alpha</div><em></em>',
    '<div>Alpha</div><em></em><div>Beta</div>',
    '<div>Alpha</div><em></em> tail',
    '<p>before <strong></strong><em>after</em></p>',
    '<blockquote><p>quote</p></blockquote><p>after</p>',
    '<ul><li>alpha</li><li>beta</li></ul>',
    '<ul><li><a href="/t">Schedule</a> New<br> <div>Domain Services</div></li></ul>',
    '<p>before<br></p>',
    '<details><summary>Title</summary><p>Body</p></details>',
    '<pre><code>alpha\n\n</code></pre>',
    '<pre><code>const x = `hi $' + '{y}`;</code></pre>',
    '<p>use <code>a`b</code> here</p>',
    '<table><tr><td>a`b</td><td>c\\d</td></tr></table>',
    '<p>text with <a href="/x">a [bracket] link</a> end</p>',
    '<ol><li>one<pre><code>cmd</code></pre></li><li>two</li></ol>',
    '<ul><li>one<pre><code>cmd</code></pre></li><li>two</li></ul>',
    '<ul><li><pre><li><blockquote>x<code>',
    '<li><blockquote><l></li><blockquote><v><blockquote>',
    '<br><blockquote>',
    '<summary>text <svg></svg></summary>',
    '<details><summary>text <svg><polyline points="1 2"></polyline></svg></summary><p>b</p></details>',
    '<h3>Set priority</h3><a class="anchor-link" href="#x"></a><p>The value.</p>',
    '<h2>Section</h2><a href="/x"><svg></svg></a><p>Body text.</p>',
    '<a href="https://example.com">https://example.com</a>',
    '<dl><dt>MPN:</dt><dd>D100</dd><dt>Availability:</dt><dd>Ships</dd></dl>',
    '<address><p>One</p><p>Two</p></address>',
    '<p>before</p><script>var x = 1; if (a < b) { y(); }</script><p>after</p>',
    '<script>a()</script><script>b()</script><p>ok</p>',
    '<p>x</p><script>let s = "</scr" + "ipt>end";</script><p>y</p>',
    '<p>one</p><script>\n  line1\n  line2\n</script><p>two</p>',
    '<p>answered on <span>03 Apr 2013,&nbsp;</span><span>09:53 AM</span></p>',
  ])('matches one-shot bytes at every chunk width: %s', async (html) => {
    const expected = htmlToMarkdown(html)

    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++) {
      expect(await streamConvert(html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
    }
  })

  it('keeps block newline context across drained chunks', async () => {
    const expected = htmlToMarkdown(BLOCK_NEWLINE_HTML)

    for (const chunkSize of [1, 3, 7, 16, 40])
      expect(await streamConvert(BLOCK_NEWLINE_HTML, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
  })

  it('streams a malformed quote list without throwing when compaction drops hold fragments', async () => {
    const html = '<li><blockquote><l></li><blockquote><v><blockquote>'
    const expected = htmlToMarkdown(html)
    expect(await streamConvert(html, 1)).toBe(expected)
  })

  it('drops an empty quote whose prefix context was already streamed', async () => {
    const html = '<br><blockquote>'
    const expected = htmlToMarkdown(html)
    expect(expected).toBe('')
    expect(await streamConvert(html, 1)).toBe(expected)
  })

  it('bounds retained output while streaming a raw HTML anchor body', () => {
    const processor = createMarkdownProcessor({}, context => createMarkdownDrain(context, false))
    const parseState: ParseState = {
      depthMap: processor.state.depthMap,
      depth: 0,
      resolvedPlugins: [],
      tagHandlers,
      plainText: false,
    }
    const text = '0123456789abcdef'
    const repetitions = 32 * 1024
    const html = `<details><a href="/x">${`<span>${text}</span>`.repeat(repetitions)}</a></details>`
    const expectedLength = '<details><a href="/x">'.length + text.length * repetitions + '</a></details>'.length
    const chunkSize = 4 * 1024
    let remainingHtml = ''
    let emittedLength = 0
    let emittedHash = 2166136261
    let peakRetainedLength = 0

    for (let offset = 0; offset < html.length; offset += chunkSize) {
      remainingHtml = parseHtmlStream(remainingHtml + html.slice(offset, offset + chunkSize), parseState, processor.processEvent)
      const chunk = processor.getMarkdownChunk()
      emittedLength += chunk.length
      emittedHash = hashChunk(emittedHash, chunk)

      let retainedLength = 0
      for (let i = 0; i < processor.state.buffer.length; i++)
        retainedLength += processor.state.buffer[i]!.length
      if (retainedLength > peakRetainedLength)
        peakRetainedLength = retainedLength
    }

    finalizeParse(remainingHtml, parseState, processor.processEvent)
    const finalChunk = processor.getMarkdownChunk(true)
    emittedLength += finalChunk.length
    emittedHash = hashChunk(emittedHash, finalChunk)

    let expectedHash = hashChunk(2166136261, '<details><a href="/x">')
    for (let i = 0; i < repetitions; i++)
      expectedHash = hashChunk(expectedHash, text)
    expectedHash = hashChunk(expectedHash, '</a></details>')

    expect(emittedLength).toBe(expectedLength)
    expect(emittedHash).toBe(expectedHash)
    expect(peakRetainedLength).toBeLessThan(chunkSize)
  })

  // A yielded chunk is a slice of the joined buffer, and a slice keeps its
  // whole parent string alive. If the buffer is never drained, a caller that
  // holds the chunks holds one copy of the output per chunk.
  it.each<[string, { wrapWidth?: number }, TransformPlugin[]]>([
    ['a plugin', {}, [filterPlugin({ exclude: ['nav'] })]],
    ['wrapWidth', { wrapWidth: 40 }, []],
  ])('bounds retained output with %s', (_, options, plugins) => {
    const html = '<p>A paragraph of words that runs well past forty columns before it ends.</p>'.repeat(2048)
    const processor = createMarkdownProcessor(options, context => createMarkdownDrain(context, plugins.length > 0), plugins.length > 0)
    const parseState: ParseState = {
      depthMap: processor.state.depthMap,
      depth: 0,
      resolvedPlugins: plugins,
      tagHandlers,
      plainText: false,
    }
    const handleEvent = plugins.length
      ? (event: Parameters<typeof processor.processEvent>[0]) => processPluginsForEvent(event, plugins, processor.state, processor.processEvent)
      : processor.processEvent
    const chunkSize = 4 * 1024
    let remainingHtml = ''
    let markdown = ''
    let peakRetainedLength = 0

    for (let offset = 0; offset < html.length; offset += chunkSize) {
      remainingHtml = parseHtmlStream(remainingHtml + html.slice(offset, offset + chunkSize), parseState, handleEvent)
      markdown += processor.getMarkdownChunk()
      let retainedLength = 0
      for (let i = 0; i < processor.state.buffer.length; i++)
        retainedLength += processor.state.buffer[i]!.length
      if (retainedLength > peakRetainedLength)
        peakRetainedLength = retainedLength
    }
    finalizeParse(remainingHtml, parseState, handleEvent)
    markdown += processor.getMarkdownChunk(true)

    expect(markdown).toBe(htmlToMarkdown(html, { ...options, plugins }))
    expect(peakRetainedLength).toBeLessThan(chunkSize)
  })
})

it.each(['<img src="/x">', '<br><img src="/x">', '<hr>', '<span></span>'])('releases an empty item marker for non-text output: %s', (content) => {
  const plugins = content === '<span></span>'
    ? [createPlugin({ onNodeEnter: node => node.name === 'span' ? 'X'.repeat(32) : undefined })]
    : []
  const processor = createMarkdownProcessor({}, context => createMarkdownDrain(context, plugins.length > 0), plugins.length > 0)
  const parseState: ParseState = { depthMap: processor.state.depthMap, depth: 0, resolvedPlugins: plugins, tagHandlers, plainText: false }
  const handleEvent = plugins.length
    ? (event: Parameters<typeof processor.processEvent>[0]) => processPluginsForEvent(event, plugins, processor.state, processor.processEvent)
    : processor.processEvent
  let remaining = parseHtmlStream('<ul><li>', parseState, handleEvent)
  let markdown = processor.getMarkdownChunk()
  let peakRetained = 0
  const body = content.repeat(32)
  for (let index = 0; index < 256; index++) {
    remaining = parseHtmlStream(remaining + body, parseState, handleEvent)
    markdown += processor.getMarkdownChunk()
    peakRetained = Math.max(peakRetained, processor.state.buffer.reduce((size, fragment) => size + fragment.length, 0))
    expect(processor.state.emptyListMarkerFragment).toBeUndefined()
  }
  expect(markdown.length).toBeGreaterThan(32 * 1024)
  expect(peakRetained).toBeLessThan(4096)
  remaining = parseHtmlStream(`${remaining}</li></ul>`, parseState, handleEvent)
  finalizeParse(remaining, parseState, handleEvent)
  markdown += processor.getMarkdownChunk(true)
  expect(markdown).toBe(htmlToMarkdown(`<ul><li>${content.repeat(8192)}</li></ul>`, { plugins }))
})

it.each([
  ['', '-\n  -\n- next'],
  ['text', '-\n  -\n\n  text\n- next'],
])('streams a pending empty list tail without allocating tail arrays: %s', (tail, expected) => {
  let settling = false
  let reads = 0
  const processor = createMarkdownProcessor({}, (context) => {
    const settle = context.settleItemMarker
    context.settleItemMarker = () => {
      settling = true
      settle()
      settling = false
    }
    return createMarkdownDrain(context, false)
  })
  processor.state.buffer = new Proxy(processor.state.buffer, {
    get(target, key, receiver) {
      if (settling && typeof key === 'string' && key.length > 0 && key.charCodeAt(0) >= 48 && key.charCodeAt(0) <= 57)
        reads++
      return Reflect.get(target, key, receiver)
    },
  })
  const parseState: ParseState = { depthMap: processor.state.depthMap, depth: 0, resolvedPlugins: [], tagHandlers, plainText: false }
  const buffer = processor.state.buffer
  const originalSlice = buffer.slice
  let tailArrayCopies = 0
  buffer.slice = (start, end) => {
    if (start !== undefined && start > 0 && end === undefined)
      tailArrayCopies++
    return originalSlice.call(buffer, start, end)
  }
  const prefix = '<ul><li><ul><li></li></ul>'
  const emptyChunk = '<div></div><p></p><em></em><span> </span>'
  let remaining = ''
  let markdown = ''
  for (const character of prefix) {
    remaining = parseHtmlStream(remaining + character, parseState, processor.processEvent)
    markdown += processor.getMarkdownChunk()
  }
  for (let index = 0; index < 256; index++) {
    remaining = parseHtmlStream(remaining + emptyChunk, parseState, processor.processEvent)
    markdown += processor.getMarkdownChunk()
  }
  const close = `${tail}</li><li>next</li></ul>`
  for (const character of close) {
    remaining = parseHtmlStream(remaining + character, parseState, processor.processEvent)
    markdown += processor.getMarkdownChunk()
  }
  finalizeParse(remaining, parseState, processor.processEvent)
  markdown += processor.getMarkdownChunk(true)
  expect(markdown).toBe(expected)
  expect(markdown).toBe(htmlToMarkdown(prefix + emptyChunk.repeat(256) + close))
  expect(tailArrayCopies).toBe(0)
  expect(reads).toBeLessThan(256 * 20)
})

it.each([false, true])('bounds settlement reads as retained whitespace grows, visible=%s', (visible) => {
  let settle = () => {}
  const processor = createMarkdownProcessor({}, (context) => {
    settle = context.settleItemMarker
    return createMarkdownDrain(context, false)
  })
  let reads = 0
  processor.state.buffer = new Proxy(['- ', '\n\n  '], {
    get(target, key, receiver) {
      if (typeof key === 'string' && key.length > 0 && key.charCodeAt(0) >= 48 && key.charCodeAt(0) <= 57)
        reads++
      return Reflect.get(target, key, receiver)
    },
  })
  processor.state.emptyListMarkerFragment = 0
  processor.state.listTailStart = 1
  for (let index = 0; index < 256; index++) {
    processor.state.buffer.push('\n  ')
    settle()
  }
  const scanned = reads
  // A writer can append to the existing last fragment instead of pushing one.
  if (visible)
    processor.state.buffer[processor.state.buffer.length - 1] += 'x'
  settle()
  expect(processor.state.listTailStart).toBe(visible ? undefined : 1)
  expect(processor.state.emptyListMarkerFragment).toBe(visible ? undefined : 0)
  expect(scanned).toBeLessThan(256 * 8)
})

it.each(['rewrite', 'truncate', 'compact'])('rescans retained list tails after %s', (mutation) => {
  let settle = () => {}
  const processor = createMarkdownProcessor({}, (context) => {
    settle = context.settleItemMarker
    return createMarkdownDrain(context, false)
  })
  const state = processor.state
  state.buffer.push('- ', '\n  ', ' ', ' ')
  state.emptyListMarkerFragment = 0
  state.listTailStart = 1
  settle()
  if (mutation === 'rewrite') {
    noteListTailRewrite(state, 1)
    state.buffer[1] = 'x'
  }
  else if (mutation === 'truncate') {
    noteListTailRewrite(state, 2)
    state.buffer.length = 2
    state.buffer.push('x')
  }
  else {
    noteListTailRewrite(state, 0)
    state.buffer.splice(0, 1)
    expect(state.listTailStart).toBeUndefined()
    expect(state.emptyListMarkerFragment).toBeUndefined()
    state.buffer.push('- ', '\n ', ' ')
    state.emptyListMarkerFragment = state.buffer.length - 3
    state.emptyListMarkerScanFrom = state.buffer.length - 2
    state.listTailStart = state.buffer.length - 2
    state.listTailScanFrom = state.listTailStart
    settle()
    state.buffer.push('x')
  }
  settle()
  expect(state.listTailStart).toBeUndefined()
  expect(state.emptyListMarkerFragment).toBeUndefined()
})

describe('recorded parent markers', () => {
  it.each(['text-', 'text.'])('keeps plugin prose ending in a marker separate: %s', async (value) => {
    const html = '<ul><li><ul><li></li></ul></li></ul>'
    const options = { plugins: [createPlugin({
      onNodeEnter(node) {
        if (node.name === 'li' && !node.parent?.parent)
          return value
      },
    })] }
    const expected = `${value}\n\n  -`
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let width = 1; width <= html.length; width++)
      expect(await streamConvert(html, width, options), `width=${width}`).toBe(expected)
    for (let split = 0; split <= html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let actual = ''
      for await (const chunk of streamHtmlToMarkdown(input, options)) actual += chunk
      expect(actual, `split=${split}`).toBe(expected)
    }
    const prefix = `<p>${'lead '.repeat(2000)}</p>`
    const longExpected = `${'lead '.repeat(2000).trim()}\n\n${expected}`
    for (const width of [1, 7, 4096])
      expect(await streamConvert(prefix + html, width, options)).toBe(longExpected)
  })
  it.each(['- ', '10. '])('recognizes a genuine marker supplied by a plugin: %s', async (value) => {
    const html = '<ul><li><ul><li></li></ul></li></ul>'
    const options = { plugins: [createPlugin({
      onNodeEnter(node) {
        if (node.name === 'li' && !node.parent?.parent)
          return value
      },
    })] }
    const expected = `${value.trimEnd()}\n  -`
    expect(htmlToMarkdown(html, options)).toBe(expected)
    expect(await streamConvert(html, 1, options)).toBe(expected)
  })

  it('skips repeated parent-indent recognition at depth 50 and 200', () => {
    const spy = vi.spyOn(markerUtils, 'listMarkerLineStart')
    try {
      for (const depth of [50, 200]) {
        spy.mockClear()
        htmlToMarkdown('<ul><li>'.repeat(depth))
        expect(spy.mock.calls.length, `depth=${depth}`).toBeLessThanOrEqual(1)
      }
    }
    finally {
      spy.mockRestore()
    }
  })
  it('asserts expected nested Markdown for every chunk width and split', async () => {
    const cases = [
      ['<ul><li><ul><li><ul><li># h</li></ul></li></ul></li></ul>', '-\n  -\n    - \\# h'],
      ['<ul><li><ul><li><ul><li><table><tr><td>a</td></tr></table></li></ul></li></ul></li></ul>', '-\n  -\n    - | a |\n      | --- |'],
      ['<ul><li><ul><li><ul><li><hr></li></ul></li></ul></li></ul>', '-\n  -\n    - ***'],
      ['<ul><li><ul><li></li></ul></li></ul>', '-\n  -'],
      ['<ul><li><ul><li><blockquote>q</blockquote></li></ul></li></ul>', '-\n  - \n    > q'],
    ] as const
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let width = 1; width <= html.length; width++)
        expect(await streamConvert(html, width)).toBe(expected)
      for (let split = 0; split <= html.length; split++) {
        const stream = new ReadableStream<string>({
          start(controller) {
            controller.enqueue(html.slice(0, split))
            controller.enqueue(html.slice(split))
            controller.close()
          },
        })
        let output = ''
        for await (const chunk of streamHtmlToMarkdown(stream)) output += chunk
        expect(output, `split=${split}`).toBe(expected)
      }
    }
  })
  it('preserves deep marker bytes in ancestor contexts', async () => {
    for (const depth of [50, 200]) {
      for (const [open, close, marker] of [['<ul><li>', '</li></ul>', '-'], ['<ol start="10"><li>', '</li></ol>', '10.']] as const) {
        const body = `${open.repeat(depth)}# h${close.repeat(depth)}`
        const expected = `${Array.from({ length: depth }, (_, level) => ' '.repeat(level * (marker.length + 1)) + marker).join('\n')} \\# h`
        for (const [prefix, suffix, rendered] of [
          ['', '', expected],
          ['<div>', '</div>', expected],
          ['<blockquote>', '</blockquote>', expected.split('\n').map(line => `> ${line}`).join('\n')],
          [`<p>${'x'.repeat(9000)}</p>`, '', `${'x'.repeat(9000)}\n\n${expected}`],
        ]) {
          const html = prefix + body + suffix
          expect(htmlToMarkdown(html), `depth=${depth}`).toBe(rendered)
          for (const width of [1, 7, 64, 4096])
            expect(await streamConvert(html, width), `depth=${depth}, width=${width}`).toBe(rendered)
        }
      }
    }
  })
})

it.each(['<br>', '<br> ', '<br>\n'])('bounds whitespace retained behind an open empty list marker with %j', (breaks) => {
  const processor = createMarkdownProcessor({}, context => createMarkdownDrain(context, false))
  const parseState: ParseState = {
    depthMap: processor.state.depthMap,
    depth: 0,
    resolvedPlugins: [],
    tagHandlers,
    plainText: false,
  }
  let remaining = parseHtmlStream('<ul><li>', parseState, processor.processEvent)
  for (let index = 0; index < 1024; index++) {
    remaining = parseHtmlStream(remaining + breaks, parseState, processor.processEvent)
    processor.getMarkdownChunk()
  }
  expect(processor.state.buffer.join('').length).toBeLessThan(128)
  remaining = parseHtmlStream(`${remaining}parent</li></ul>`, parseState, processor.processEvent)
  finalizeParse(remaining, parseState, processor.processEvent)
  expect(processor.getMarkdownChunk(true)).toBe(htmlToMarkdown(`<ul><li>${breaks.repeat(1024)}parent</li></ul>`))
})

it('does not rescan an unchanged whitespace fragment on every settlement', () => {
  let settle = () => {}
  const processor = createMarkdownProcessor({}, (context) => {
    settle = context.settleItemMarker
    return createMarkdownDrain(context, false)
  })
  const state = processor.state
  state.buffer.push('- ', ' '.repeat(8192))
  state.emptyListMarkerFragment = 0
  state.listTailStart = 1
  settle()
  const reads = vi.spyOn(String.prototype, 'charCodeAt')
  try {
    for (let index = 0; index < 32; index++)
      settle()
    expect(reads.mock.calls.length).toBeLessThan(128)
  }
  finally {
    reads.mockRestore()
  }
  state.buffer[1] += 'x'
  settle()
  expect(state.emptyListMarkerFragment).toBeUndefined()
  expect(state.listTailStart).toBeUndefined()
})
