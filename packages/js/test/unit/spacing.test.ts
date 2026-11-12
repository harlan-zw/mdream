import type { MarkdownState } from '../../src/markdown-processor'
import type { HandlerContext } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { clean } from '../../src/clean'
import { MAX_TAG_ID, TAG_DIV, TAG_LI } from '../../src/const'
import { createPlugin, htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { extractionPlugin } from '../../src/plugins/extraction'
import { filterPlugin } from '../../src/plugins/filter'
import { tailwindPlugin } from '../../src/plugins/tailwind'
import { htmlToMarkdownSplitChunks } from '../../src/splitter'
import { tagHandlers } from '../../src/tags'

async function streamConvert(chunks: string[], options?: Parameters<typeof streamHtmlToMarkdown>[1]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream, options))
    output += chunk
  return output
}

describe('inline whitespace', () => {
  it.each([
    ['<ul><li><ul></ul>text</li></ul>', '- text'],
    ['<ul><li><ol></ol>text</li></ul>', '- text'],
    ['<ul><li>before<ul></ul>text</li></ul>', '- before text'],
    ['<ul><li><ul><template><li></li></template></ul>text</li></ul>', '- text'],
    ['<ul><li><ul><span></span></ul>text</li></ul>', '- text'],
    ['<ul><li><ul> \n </ul>text</li></ul>', '- text'],
    ['<ul><li><ul></ul><strong>text</strong></li></ul>', '- **text**'],
    ['<ul><li><ul><li></li></ul><ul></ul>text</li></ul>', '-\n  -\n\n  text'],
    ['<ol start="10"><li><ul><li>child</li></ul># h</li></ol>', '10.\n    - child\n\n    \\# h'],
    ['<ol start="10"><li><ul><li>child</li></ul>1. x</li></ol>', '10.\n    - child\n\n    1\\. x'],
    ['<ol start="10"><li><ul><li>child</li></ul>---<br>1) x<br>+ x<br>&gt; q</li></ol>', '10.\n    - child\n\n    \\---  \n    1\\) x  \n    \\+ x  \n    \\> q'],
    ['<ul><li><ol><li></li></ol>text</li></ul>', '-\n  1.\n\n  text'],
    ['<blockquote><ul><li><ol><li></li></ol>text</li></ul></blockquote>', '> -\n>   1.\n>\n>   text'],
    ['<ul><li><blockquote><ol><li></li></ol>text</blockquote></li></ul>', '- \n  >\n  > 1.\n  >\n  > text'],
    ['<ul><li><ul><li></li></ul>text</li></ul>', '-\n  -\n\n  text'],
    ['<ol start="10"><li><ul><li></li></ul>text</li></ol>', '10.\n    -\n\n    text'],
    ['<ul><li><ol><li>child</li></ol>text</li></ul>', '-\n  1. child\n\n  text'],
    ['<ul><li><ol><li></li></ol><strong>text</strong></li></ul>', '-\n  1.\n\n  **text**'],
    ['<ul><li><ol><li></li></ol><script>hidden</script> text</li></ul>', '-\n  1.\n\n  text'],
    ['<ul><li><ol><li></li></ol></li><li>next</li></ul>', '-\n  1.\n- next'],
    ['<ul><li><pre><ul></ul>x</pre></li></ul>', '- ```\n  x\n  ```'],
    ['<ul><li>x<ul><li><blockquote><br></blockquote></li></ul><p>y</p></li></ul>', '- x\n\n  - \n  \n\n  y'],
    ['<table><tr><td><ul><li><ol><li></li></ol>text</li></ul></td></tr></table>', '| <ul><li><ol><li></li></ol>text</li></ul> |\n| --- |'],
    ['<ul><li><a href="/w" title="W"><pre><hr></pre></a></li></ul>', '- [\n\n  ```\n  \n\n  ---\n  ```\n\n  \n\n  W](/w)'],
    ['<ul><li><a href="x"><ul><li></li></ul></a><ul><li># h</li></ul></li></ul>', '- [  -](x)\n  - \\# h'],
  ])('preserves list content boundaries: %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })

  // Only visible parent text needs its own paragraph after a nested list. An
  // element that stays empty, or a list its inline wrapper wrote inline, must
  // not leave a blank line that turns the list loose.
  it.each([
    ['<ul><li>x<ul><li>a</li></ul><span></span></li><li>next</li></ul>', '- x\n  - a\n- next'],
    ['<ul><li>x<ul><li>a</li></ul><a id="anchor"></a></li><li>next</li></ul>', '- x\n  - a\n- next'],
    ['<ul><li><ul><li>a</li></ul><span></span> </li><li>next</li></ul>', '-\n  - a\n- next'],
    ['<ol><li>x<ol><li>a</li></ol><span></span><em></em></li><li>next</li></ol>', '1. x\n   1. a\n2. next'],
    ['<blockquote><ul><li>x<ul><li>a</li></ul><span></span></li><li>next</li></ul></blockquote>', '> - x\n>   - a\n> - next'],
    ['<ul><li><em><ul><li>a</li></ul></em>t</li></ul>', '- *  - a*t'],
    ['<ul><li><a href="/x"><ul><li>a</li></ul></a>t</li></ul>', '- [  - a](/x)t'],
    ['<ul><li>x<ul><li>a</li></ul><span></span>tail</li><li>next</li></ul>', '- x\n  - a\n\n  tail\n- next'],
  ])('keeps a list tight when nothing visible follows its nested list: %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
    expect(await streamConvert([...html]), 'one char per chunk').toBe(expected)
  })

  // The parser counts open inline wrappers, so a wrapper only stops the
  // separator while it is open: once closed, explicitly or implicitly, a later
  // nested list gets its blank line back. Template content never counts.
  it.each([
    ['<ul><li><em>e</em><ul><li>a</li></ul>t</li></ul>', '- *e*\n  - a\n\n  t'],
    ['<p><em>x</p><ul><li>y<ul><li>a</li></ul>t</li></ul>', '*x*\n\n- y\n  - a\n\n  t'],
    ['<ul><li><em>x<ul><li>a</li></ul></em>t</li></ul><ul><li>y<ul><li>b</li></ul>u</li></ul>', '- *x  - a*t\n\n- y\n  - b\n\n  u'],
    ['<template><em></template><ul><li>y<ul><li>a</li></ul>t</li></ul>', '- y\n  - a\n\n  t'],
    ['<ul><li><em><ul><li>a</li></ul>t', '- *  - a t*'],
  ])('only lets an open inline wrapper hold back the separator: %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
    expect(await streamConvert([...html]), 'one char per chunk').toBe(expected)
  })

  // A processAttributes hook may replace the handler, so the count follows the
  // handler the element kept after its enter event, and closing the element
  // undoes exactly that count, whether the flag was dropped or added.
  const dropFlag = createPlugin({
    processAttributes(node) {
      if (node.name === 'em')
        node.tagHandler = { enter: () => '_', exit: () => '_', isInline: true }
    },
  })
  const addFlag = createPlugin({
    processAttributes(node) {
      if (node.name === 'x-em')
        node.tagHandler = { enter: () => '*', exit: () => '*', isInline: true, collapsesInnerWhiteSpace: true }
    },
  })
  const nested = '<ul><li>y<ul><li>a</li></ul>t</li></ul>'
  it.each([
    [`<p><em>x</em></p>${nested}`, dropFlag, '_x_\n\n- y\n  - a\n\n  t'],
    [`<ul><li><em>x<ul><li>a</li></ul></em>t</li></ul>${nested}`, dropFlag, '- _x\n  - a_\n\n  t\n\n- y\n  - a\n\n  t'],
    [`<p><x-em>x</x-em></p>${nested}`, addFlag, '*x*\n\n- y\n  - a\n\n  t'],
    [`<ul><li><x-em>x<ul><li>a</li></ul></x-em>t</li></ul>${nested}`, addFlag, '- *x  - a*t\n\n- y\n  - a\n\n  t'],
  ])('counts the wrapper handler a plugin kept: %s', async (html, plugin, expected) => {
    const options = { plugins: [plugin] }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)], options), `split=${split}`).toBe(expected)
    expect(await streamConvert([...html], options), 'one char per chunk').toBe(expected)
  })

  it('restores a heading break when whitespace precedes an empty opener', async () => {
    const html = '<ul><li><h3>T</h3><strong></strong>x</li></ul>'
    const options = {
      plugins: [createPlugin({
        onNodeExit(element, state) {
          if (element.name === 'strong') {
            // Move whitespace before the opener, including its heading separator.
            const { buffer } = state as MarkdownState
            const index = buffer.length - 1
            buffer[index] = ` ${buffer[index]}`
          }
        },
      })],
    }
    const expected = '- ### T\n\n  x'
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
      expect(output, `chunkSize=${width}`).toBe(expected)
    }
  })

  it('preserves whitespace between root-level inline siblings', () => {
    expect(htmlToMarkdown('<span>One</span> <span>Two</span>')).toBe('One Two')
    expect(htmlToMarkdown('<strong>One</strong>\n<strong>Two</strong>')).toBe('**One** **Two**')
    expect(htmlToMarkdown('<span>One</span> </bogus> <span>Two</span>')).toBe('One Two')
    expect(htmlToMarkdown('  <span>One</span>  ')).toBe('One')
    expect(htmlToMarkdown('<div>One</div> <div>Two</div>')).toBe('One\n\nTwo')
  })

  it('moves trailing whitespace outside inline delimiters', () => {
    expect(htmlToMarkdown('<div><strong><a href="http://xxx.yyy/">abc</a> </strong>def</div>'))
      .toBe('**[abc](http://xxx.yyy/)** def')
    expect(htmlToMarkdown('<p><strong><em>abc </em></strong>def</p>'))
      .toBe('***abc*** def')
  })

  it('preserves the separator when a closing tag is split across chunks', async () => {
    const html = '<div><strong><a href="http://xxx.yyy/">abc</a> </strong>def</div>'
    for (let split = 0; split <= html.length; split++) {
      const output = await streamConvert([html.slice(0, split), html.slice(split)])
      expect(output.trimEnd(), `split at byte ${split}`).toBe('**[abc](http://xxx.yyy/)** def')
    }
  })

  it('keeps the space after removed content outside the opening delimiter', async () => {
    const expected = 'Install. **Warning:** read'
    for (const html of [
      '<p>Install. <strong><svg><path d="M0"/></svg> Warning:</strong> read</p>',
      '<p>Install. <strong><script>x</script> Warning:</strong> read</p>',
      '<p>Install. <strong><span></span> Warning:</strong> read</p>',
      // With nothing to merge into, the space moves in front of the delimiter.
      '<p>Install.<strong><svg></svg> Warning:</strong> read</p>',
      '<p>Install.<strong> Warning:</strong> read</p>',
    ]) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let split = 0; split <= html.length; split++) {
        const output = await streamConvert([html.slice(0, split), html.slice(split)])
        expect(output.trimEnd(), `${html} split at byte ${split}`).toBe(expected)
      }
    }
    expect(htmlToMarkdown('<p>Install. <strong><span hidden>!</span> Warning:</strong> read</p>', { plugins: [filterPlugin()] }))
      .toBe(expected)
    expect(htmlToMarkdown('<p>Install. <em><svg></svg> Warning:</em> read</p>')).toBe('Install. *Warning:* read')
    expect(htmlToMarkdown('<p>a <strong><svg></svg></strong> b</p>')).toBe(htmlToMarkdown('<p>a <strong></strong> b</p>'))
  })

  it('keeps the moved space out of the start of link text', async () => {
    const cases: [string, string][] = [
      ['<p><a href="/x"><strong><svg></svg> now</strong></a></p>', '[**now**](/x)'],
      ['<p>Go<a href="/x"><strong> now</strong></a></p>', 'Go [**now**](/x)'],
      // Nothing else parts the words, so the space stays after the bracket.
      ['<p><em>x</em><a href="/x"><strong> now</strong></a></p>', '*x*[ **now**](/x)'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let split = 0; split <= html.length; split++) {
        const output = await streamConvert([html.slice(0, split), html.slice(split)])
        expect(output.trimEnd(), `${html} split at byte ${split}`).toBe(expected)
      }
    }
  })

  it('keeps the word separator when emphasis starts with a blank', async () => {
    const cases: [string, string][] = [
      ['<p>a<strong> <span>b</span></strong></p>', 'a **b**'],
      ['<p>a<strong> </strong>b</p>', 'a b'],
      ['<p>a<em> <span>b</span></em></p>', 'a *b*'],
      ['<p>a<b>\n<span>b</span></b></p>', 'a **b**'],
      ['<p>a<i>\t <span>b</span></i></p>', 'a *b*'],
      ['<p>a<strong> <svg></svg>b</strong></p>', 'a **b**'],
      ['<p>a<strong> <em>b</em></strong></p>', 'a ***b***'],
      ['<p><em>x</em><strong> <span>b</span></strong></p>', '*x* **b**'],
      // Already parted, or at the start of the line: nothing to add.
      ['<p>a <strong> <span>b</span></strong></p>', 'a **b**'],
      ['<p><strong> <span>b</span></strong></p>', '**b**'],
      ['<p>a<br><strong> <span>b</span></strong></p>', 'a  \n**b**'],
      // An empty pair owes its separator to what follows it, once.
      ['<p>a<strong> </strong> b</p>', 'a b'],
      ['<p>a<em> </em><strong> </strong>b</p>', 'a b'],
      ['<p>a<strong> </strong><em></em> b</p>', 'a b'],
      ['<p><a href="/x"><span>x</span><strong> </strong><em></em></a></p>', '[x](/x)'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
    expect(htmlToMarkdown('<p>x<em><span hidden>h</span> </em>y</p>', { plugins: [filterPlugin()] })).toBe('x y')
    expect(htmlToMarkdown('<ul><li>a<strong> <span>b</span></strong></li></ul>')).toBe('- a **b**')
    expect(htmlToMarkdown('<h2>a<strong> </strong>b</h2>')).toBe('## a b')
    expect(htmlToMarkdown('<p><a href="/x">a<strong> <span>b</span></strong></a></p>')).toBe('[a **b**](/x)')
  })

  it('places a blank kept inside emphasis without writing it as text', async () => {
    const cases: [string, string][] = [
      // Elements that write nothing sit between the opener and the blank.
      ['<p>Click<strong><span class="w"> <a href="/x">here</a></span></strong> now</p>', 'Click **[here](/x)** now'],
      ['<p>a<strong><span> <span>b</span></span></strong></p>', 'a **b**'],
      ['<p>a<strong><span> </span></strong>b</p>', 'a b'],
      ['<p>a<em><span> <strong>b</strong></span></em></p>', 'a ***b***'],
      // An emptied quote around the moved separator is dropped with it.
      ['<p>a<q><em> </em></q>b</p>', 'a b'],
      ['<p>a<strong><q><em> </em></q>c</strong>b</p>', 'a **c**b'],
      ['<p>a<strong><q><em> </em></q><em>c</em></strong>b</p>', 'a ***c***b'],
      // With no opener to part, it is owed to later text: a line break or the
      // end of the block drops it, later text that brings its own space needs
      // no other, and code keeps its content as written.
      ['<p><i>x<i> <svg></svg></i></i></p>', '*x*'],
      ['<p><i>a<i> <svg></svg> x</i></i></p>', '*a x*'],
      ['<p>x<b>y<b> <strong></strong><br>z</b></b></p>', 'x**y  \nz**'],
      ['<p><code>a<del> </del></code>z</p>', '`a `z'],
      ['<p><code>a<strong> <svg></svg> b</strong></code></p>', '`a** b**`'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
    const noStrongDelimiters = { tagOverrides: { strong: { enter: '', exit: '' } } }
    expect(htmlToMarkdown('<p>a<strong> <svg></svg> b</strong></p>', noStrongDelimiters)).toBe('a b')
    expect(htmlToMarkdown('a<strong> <svg></svg> b</strong>', noStrongDelimiters)).toBe('a b')
    expect(htmlToMarkdown('<p>a<b>x<b> <a href="#"></a></b></b></p>', { clean: clean() })).toBe('a**x**')
    expect(htmlToMarkdown('<p><i>x<i> <a href="#"></a></i></i>z</p>', { clean: clean() })).toBe('*x* z')
  })

  it('keeps the word separator when an inline wrapper starts with a blank', async () => {
    const cases: [string, string][] = [
      ['<p>a<span> <span>b</span></span></p>', 'a b'],
      ['<p>a<span> <strong>b</strong></span></p>', 'a **b**'],
      ['<p>a<font> <b>x</b></font></p>', 'a **x**'],
      ['<p>a<label> <span>b</span></label></p>', 'a b'],
      ['<p>a<abbr> <span>b</span></abbr></p>', 'a b'],
      ['<p>a<small> <span>b</span></small></p>', 'a b'],
      ['<p>a<u> <span>b</span></u></p>', 'a<u> b</u>'],
      ['<p>a<span><span> <span>b</span></span></span></p>', 'a b'],
      ['<p>a<font><small> <label><b>x</b></label></small></font></p>', 'a **x**'],
      ['<p>a<span>\n  <span>b</span></span>c</p>', 'a bc'],
      ['<p>a<span> </span>b</p>', 'a b'],
      ['<p>a<span> <strong></strong></span>b</p>', 'a b'],
      ['<p>a<strong>x<span> <span>b</span></span></strong></p>', 'a**x b**'],
      ['<p><strong>a<span> </span></strong>b</p>', '**a** b'],
      ['<p>a<span> <img src="/i.png" alt="i"></span></p>', 'a ![i](/i.png)'],
      // Already parted, or at the start of the line: nothing to add.
      ['<p>a <span> <span>b</span></span></p>', 'a b'],
      ['<p><span> <strong>b</strong></span></p>', '**b**'],
      ['<p>a<br><span> <span>b</span></span></p>', 'a  \nb'],
      ['<p>a<span> </span></p>', 'a'],
      // A link or quote opener already parts it from a word, and code keeps
      // its content as written.
      ['<p>a<a href="/x"> <span>b</span></a></p>', 'a [b](/x)'],
      ['<p>a<q> <span>b</span></q></p>', 'a "b"'],
      ['<p>a<code> <span>b</span></code></p>', 'a`b`'],
      ['<p><code>a<span> <span>b</span></span></code></p>', '`ab`'],
      // A raw line break ends the line the separator would trail.
      ['<h2>w<span> <br>b</span></h2>', '## w <br>b'],
      ['<h2>w<strong>a </strong><br>b</h2>', '## w**a** <br>b'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
    expect(htmlToMarkdown('<ul><li>a<span> <span>b</span></span></li></ul>')).toBe('- a b')
    expect(htmlToMarkdown('<h2>a<span> <span>b</span></span></h2>')).toBe('## a b')
    expect(htmlToMarkdown('<blockquote><p>a<span> <span>b</span></span></p></blockquote>')).toBe('> a b')
    expect(htmlToMarkdown('<table><tr><th>h</th></tr><tr><td>a<span> <span>b</span></span></td></tr></table>')).toBe('| h |\n| --- |\n| a b |')
    expect(htmlToMarkdown('a<span> <span>b</span></span>')).toBe('a b')
  })

  it('writes an owed separator before the text it parts', async () => {
    const tailwind = () => ({ plugins: [tailwindPlugin()] })
    const cases: [string, string, Parameters<typeof htmlToMarkdown>[1]][] = [
      // A line break may not take its place and set the text at a line start.
      ['<p>aaaa<span> <span>1. b</span></span></p>', 'aaaa 1.\nb', { wrapWidth: 6 }],
      ['<p>aaaa<span> <span>- b</span></span></p>', 'aaaa -\nb', { wrapWidth: 6 }],
      ['<p>aaaaaa<span> <span>b</span></span></p>', 'aaaaaa b', { wrapWidth: 6 }],
      ['<ul><li>aaaa<span> <span>1. b</span></span></li></ul>', '- aaaa 1.\n  b', { wrapWidth: 8 }],
      [
        '<p><a href="https://example.com/docs/getting-started/installation/index.html">Read the docs</a><span> <span>1. Install the CLI</span></span></p>',
        '[Read the docs](https://example.com/docs/getting-started/installation/index.html) 1.\nInstall the CLI',
        { wrapWidth: 80 },
      ],
      // Nor at one an empty pair took along and gave back.
      ['<p>aaaa<span> <strong></strong><span>1. b</span></span></p>', 'aaaa 1.\nb', { wrapWidth: 6 }],
      ['<p>aaaa<span> <strong><svg></svg></strong><span>1. b</span></span></p>', 'aaaa 1.\nb', { wrapWidth: 6 }],
      ['<p>aaaa<strong> </strong>1. b</p>', 'aaaa 1.\nb', { wrapWidth: 6 }],
      ['<p>aaaa<b>x </b><strong></strong>1. b</p>', 'aaaa**x** 1.\nb', { wrapWidth: 6 }],
      // A separator trimmed from a closed element joins the text, where it
      // stays a wrap boundary.
      ['<p>aaaa<span>x </span><span>bb</span></p>', 'aaaax\nbb', { wrapWidth: 6 }],
      // A marker that would open a list keeps its space and overflows.
      ['<p>aaaa<span>x </span><span>1. b</span></p>', 'aaaax 1.\nb', { wrapWidth: 6 }],
      // Delimiters a plugin generates around the text stay tight around it.
      ['<p>Read<label> <span class="font-bold">new</span></label> now</p>', 'Read **new** now', tailwind()],
      ['<p>Price<span>: </span><span class="font-bold">$5</span></p>', 'Price: **$5**', tailwind()],
      ['<p>a<span> <span class="italic">b</span></span>c</p>', 'a *b*c', tailwind()],
      ['<ol><li>-<span class="font-bold"> <span> </span>b</span> z</li></ol>', '1. \\- **b** z', tailwind()],
      ['<p>aaaa<span> <span class="font-bold">bb cc</span></span></p>', 'aaaa **bb\ncc**', { ...tailwind(), wrapWidth: 8 }],
      // A no-break space is content, written after the separator.
      ['<p>Total:<span> </span>&nbsp;<b>5</b></p>', 'Total:  **5**', {}],
      ['<p>a<span>x </span>&nbsp;<span>b</span></p>', 'ax  b', {}],
      ['<p>a<span> <span>&nbsp;</span></span>b</p>', 'a  b', {}],
      ['<p>a<span> </span>&nbsp;</p>', 'a  ', {}],
      ['<table><tr><td>a<span> </span><span>&nbsp;</span>b</td></tr></table>', '| a  b |\n| --- |', {}],
    ]
    for (const [html, expected, options] of cases) {
      expect(htmlToMarkdown(html, options), html).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks, options), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
  })

  it('drops a blank after a literal tag override opener', async () => {
    const span = { tagOverrides: { span: { enter: '**', exit: '**' } } }
    // The opener may already be streamed, so the blank cannot move in front of
    // it, and after it the blank would split it from the content.
    const cases: [string, string, Parameters<typeof htmlToMarkdown>[1]][] = [
      ['<p>a<span> <i>x</i></span>z</p>', 'a***x***z', span],
      ['<p>a<span> <b>x</b></span></p>', 'a****x****', span],
      ['<p>a<span> <span>x</span></span>z</p>', 'a****x****z', span],
      ['<p>a<span> </span>z</p>', 'a****z', span],
      ['<p>a<b><span> <i>x</i></span></b>z</p>', 'a*****x*****z', span],
      ['<p>a<u> <i>x</i></u>z</p>', 'a__*x*__z', { tagOverrides: { u: { enter: '__', exit: '__' } } }],
      ['<p>a<sup> <span>2</span></sup>z</p>', 'a^2^z', { tagOverrides: { sup: { enter: '^', exit: '^' } } }],
      ['<p>a<b> <i>x</i></b>z</p>', 'a<B>*x*</B>z', { tagOverrides: { b: { enter: '<B>', exit: '</B>' } } }],
      // An override that writes no opener keeps the separator.
      ['<p>a<span> <i>x</i></span>z</p>', 'a *x*z', { tagOverrides: { span: { enter: '', exit: '' } } }],
      ['<p>a<span> <i>x</i></span>z</p>', 'a *x*!z', { tagOverrides: { span: { exit: '!' } } }],
    ]
    for (const [html, expected, options] of cases) {
      expect(htmlToMarkdown(html, options), html).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks, options), `${html} in chunks of ${width}`).toBe(expected)
      }
    }
  })

  it('gives an empty link its label only when hooks leave its retained blank unwritten', async () => {
    const html = '<p>a<a href="/x" title="fallback"> </a></p>'
    const toNbsp = createPlugin({
      processTextNode: node => node.value.trim() ? undefined : { content: ' ', skip: false },
    })
    const toVisible = createPlugin({
      processTextNode: node => node.value.trim() ? undefined : { content: 'visible', skip: false },
    })
    const skipVisible = createPlugin({
      processTextNode: node => node.value === 'visible' ? { content: '', skip: true } : undefined,
    })
    const cases: [Parameters<typeof htmlToMarkdown>[1], string][] = [
      // A no-break space is written as text, so the link has content.
      [{ plugins: [toNbsp] }, 'a [ ](/x "fallback")'],
      // Text a later hook skips is never written, so the link stays empty.
      [{ plugins: [toVisible, skipVisible] }, htmlToMarkdown(html)],
    ]
    expect(cases[1]![1]).toBe('a [fallback](/x)')
    for (const [options, expected] of cases) {
      expect(htmlToMarkdown(html, options)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks: string[] = []
        for (let offset = 0; offset < html.length; offset += width)
          chunks.push(html.slice(offset, offset + width))
        expect(await streamConvert(chunks, options), `${expected} in chunks of ${width}`).toBe(expected)
      }
    }
  })

  it('leaves code-like content as written', () => {
    expect(htmlToMarkdown('<p><kbd>a<strong> x</strong></kbd></p>')).toBe('`a** x**`')
    expect(htmlToMarkdown('<p><samp>a<em> x</em></samp></p>')).toBe('`a* x*`')
    expect(htmlToMarkdown('<p><var>a<b><svg></svg> x</b></var></p>')).toBe('`a** x**`')
    expect(htmlToMarkdown('<p><code>a<strong> x</strong></code></p>')).toBe('`a** x**`')
  })
})

describe('block element followed by inline sibling (#148)', () => {
  it.each(['```', '~~~'])('keeps normal block spacing for plugin output ending in %s', async (marker) => {
    const html = '<p>x<br></p><span>after</span>'
    const options = {
      plugins: [createPlugin({
        onNodeExit(node) {
          if (node.name === 'p')
            return marker
        },
      })],
    }
    const expected = `x  \n${marker}\nafter`
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let split = 1; split < html.length; split++) {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(html.slice(0, split))
          controller.enqueue(html.slice(split))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `split at ${split}`).toBe(expected)
    }
  })

  it('closes a trailing-blank <pre> fence before an inline link', () => {
    expect(htmlToMarkdown('<div><pre>a\nb\n\n</pre><a href="#x">link</a></div>'))
      .toBe('```\na\nb\n\n\n```\n\n[link](#x)')
  })

  it('does not glue the closing fence to a pilcrow link (xml2rfc case)', () => {
    const out = htmlToMarkdown('<div><pre>GET /hello.txt HTTP/1.1\n\n</pre><a href="#s" class="pilcrow">P</a></div>')
    expect(out).toContain('```\n\n[P](#s)')
  })

  it('separates a trailing-blank <pre> from following text', () => {
    expect(htmlToMarkdown('<div><pre>a\nb\n\n</pre>after</div>'))
      .toBe('```\na\nb\n\n\n```\n\nafter')
  })

  it('matches across every streaming chunk boundary', async () => {
    const html = '<div><pre>a\nb\n\n</pre><a href="#x">link</a></div>'
    const expected = htmlToMarkdown(html)
    for (let split = 0; split <= html.length; split++) {
      const output = await streamConvert([html.slice(0, split), html.slice(split)])
      expect(output.trimEnd(), `split at byte ${split}`).toBe(expected)
    }
  })
})

describe('unknown tags', () => {
  // Unknown elements are inline, as in the Rust engine: adjacent ones must not
  // gain a space between them.
  it('keeps adjacent unknown elements joined', async () => {
    const cases: [string, string][] = [
      ['<x-a>X</x-a><x-h>H</x-h><x-c>C</x-c>', 'XHC'],
      ['<p><foo>X</foo><bar>H</bar><baz>C</baz></p>', 'XHC'],
      ['<p>before <ex>foo</ex> after</p>', 'before foo after'],
      ['<p><ex>foo</ex>, bar</p>', 'foo, bar'],
    ]
    for (const [html, expected] of cases) {
      expect(htmlToMarkdown(html), html).toBe(expected)
      expect(await streamConvert([html]), html).toBe(expected)
    }
  })
})

describe('div after a hash run in a list item', () => {
  it('reads at most seven hashes back from the end of the buffer', () => {
    // Only one to six hashes can be a bare heading marker, so a long retained
    // run must not be rescanned at every div.
    let reads = 0
    const run = {
      length: 100_000,
      charCodeAt: () => {
        reads++
        return 35
      },
    } as unknown as string
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- ', run], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    expect(tagHandlers[TAG_DIV]!.enter!(context)).toBeUndefined()
    expect(reads).toBeLessThanOrEqual(7)
  })

  it('reads the line before the marker once while divs leave it unchanged', () => {
    // The spaces before the marker must not be read again at every div.
    let reads = 0
    const text = `x${' '.repeat(10_000)}#`
    const entry = {
      length: text.length,
      charCodeAt: (index: number) => {
        reads++
        return text.charCodeAt(index)
      },
    } as unknown as string
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- ', entry], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    for (let i = 0; i < 100; i++)
      expect(tagHandlers[TAG_DIV]!.enter!(context)).toBeUndefined()
    expect(reads).toBeLessThanOrEqual(3 * text.length)
  })

  it('reads a line split across entries once while divs leave it unchanged', () => {
    let reads = 0
    const spaces = {
      length: 10_000,
      charCodeAt: () => {
        reads++
        return 32
      },
    } as unknown as string
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- x', spaces, '#'], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    for (let i = 0; i < 100; i++)
      expect(tagHandlers[TAG_DIV]!.enter!(context)).toBeUndefined()
    expect(reads).toBeLessThanOrEqual(3 * spaces.length)
  })

  it('reads a lead that reaches the buffer start once while divs leave it unchanged', () => {
    let reads = 0
    const text = `${'1'.repeat(10_000)}#`
    const entry = {
      length: text.length,
      charCodeAt: (index: number) => {
        reads++
        return text.charCodeAt(index)
      },
    } as unknown as string
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- ', entry], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    for (let i = 0; i < 100; i++)
      expect(tagHandlers[TAG_DIV]!.enter!(context)).toBeUndefined()
    expect(reads).toBeLessThanOrEqual(3 * text.length)
  })

  it.each([
    ['without cleanup', undefined],
    ['with cleanup', { clean: clean() }],
  ])('keeps divs after empty inline fragments linear %s', (_, options) => {
    // Each `<span> </span>` leaves an empty fragment behind. Keying the check on
    // the buffer length would miss every div and rescan the lead each time, and
    // so would dropping the check at every element exit of the clean pass.
    const html = `<ul><li><pre>${'1'.repeat(2000)}#${'<span> </span><div></div>'.repeat(200)}</pre></li></ul>`
    const charCodeAt = vi.spyOn(String.prototype, 'charCodeAt')
    let reads = 0
    try {
      htmlToMarkdown(html, options)
      reads = charCodeAt.mock.calls.length
    }
    finally {
      charCodeAt.mockRestore()
    }
    expect(reads).toBeLessThan(4 * html.length)
  })

  it('keeps one trailing empty fragment however many spaces a run trims', () => {
    // Every backward scan steps over trailing empty fragments, so letting each
    // trimmed `<span> </span>` keep one made a long run of them quadratic.
    const html = `<ul><li><pre>1#${'<span> </span><div></div>'.repeat(50)}</pre></li></ul>`
    let mostEmpty = 0
    const options = {
      plugins: [createPlugin({
        onNodeExit(element, state) {
          if (element.name !== 'div')
            return
          const { buffer } = state as MarkdownState
          let empty = 0
          while (empty < buffer.length && buffer[buffer.length - 1 - empty] === '')
            empty++
          mostEmpty = Math.max(mostEmpty, empty)
        },
      })],
    }
    expect(htmlToMarkdown(html, options)).toBe(htmlToMarkdown(html))
    expect(mostEmpty).toBe(1)
  })

  it('separates a div after a list-item heading marker', () => {
    const depthMap = new Uint16Array(MAX_TAG_ID)
    depthMap[TAG_LI] = 1
    const state = { depthMap, buffer: ['- ', '#'], listIndent: '  ' } as unknown as MarkdownState
    const context = { node: {}, state } as unknown as HandlerContext
    expect(tagHandlers[TAG_DIV]!.enter!(context)).toBe('\n\n  ')
  })
})

describe('div heading marker after buffer rewrites', () => {
  it.each([
    [
      '<ul><li><dl><blockquote><ul><li><h1></h1><div></div></li></ul></blockquote><span>#</span><div>y</div></dl></li></ul>',
      '- <dl>\n  > - #\n\n  \\# y</dl>',
    ],
    [
      '<ul><li><blockquote><ul><li><span>1</span><span>#</span><div></div></li></ul></blockquote><span><h1></h1><div></div><br>y</span></li></ul>',
      '- \n  > - 1#\n\n  #\n\n    \n  y',
    ],
  ])('keeps one-shot and streamed spacing correct after rewriting a line', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    expect(await streamConvert(Array.from(html))).toBe(expected)
  })
})

describe('empty captions after a heading in a list item', () => {
  it.each([
    ['<figcaption></figcaption>', ''],
    ['<figure><figcaption></figcaption></figure>', ''],
    // An empty inline splits the run across fragments.
    ['<figcaption></figcaption>', '<b></b>&#32;'],
    // A marker after the run sends the check through the spaces before it.
    ['<figcaption></figcaption>', '-&#32;'],
  ])('reads the heading line once past %s with %j after the run', (caption, tail) => {
    // Each empty caption hands the heading break back and checks the heading's
    // line again; the spaces ending that line must not be read at every exit.
    const html = `<ul><li><h3>T${'&#32;'.repeat(2000)}${tail}</h3>${caption.repeat(200)}x</li></ul>`
    const charCodeAt = vi.spyOn(String.prototype, 'charCodeAt')
    let output = ''
    let reads = 0
    try {
      output = htmlToMarkdown(html)
      reads = charCodeAt.mock.calls.length
    }
    finally {
      charCodeAt.mockRestore()
    }
    expect(output.endsWith('\n\n  x')).toBe(true)
    expect(reads).toBeLessThan(html.length * 4)
  })
})

// Review regressions: word boundaries, caption delimiters and link titles.
describe('excluded-content review regressions', () => {
  it('div-empty', async () => {
    const html = '<ul><li><span>Aa </span><i></i><div><span>Bb</span></div></li></ul>'
    const expected = '- Aa Bb'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('div-icons', async () => {
    const html = '<ul><li><span>Aa </span><i><svg></svg></i><div><i><svg></svg></i>Bb</div></li></ul>'
    const expected = '- Aa Bb'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('div-buttons', async () => {
    const html = '<button><div>Aa</div> </button> <button><div><span>Bb</span></div></button>'
    const expected = 'Aa Bb'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('div-main', async () => {
    const html = '<ul><li><span>Aa </span><div><i></i>Bb</div></li></ul>'
    const expected = '- Aa Bb'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('caption-icon', async () => {
    const html = '<figure><img src="/a.png"><button><svg></svg> </button><figcaption>Caption text</figcaption></figure>'
    const expected = '![](/a.png)\n\n*Caption text*'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('caption-em', async () => {
    const html = '<figure><img src="/a.png"><button><svg></svg> </button><figcaption><em>The x.</em></figcaption></figure>'
    const expected = '![](/a.png)\n\n**The x.**'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('caption-main', async () => {
    const html = '<button><span>x</span> </button><figcaption>Caption text</figcaption>'
    const expected = 'x\n\n*Caption text*'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it.each([
    ['<figure><button>A </button><figcaption><code>B</code></figcaption></figure>', '| A *`B`* |\n| --- |'],
    ['<figure><button>A </button><figcaption><em>B</em></figcaption></figure>', '| A **B** |\n| --- |'],
    ['<img src="/a.png"><button><svg></svg> </button><figcaption><em>B</em></figcaption>', '| ![](/a.png) **B** |\n| --- |'],
    ['<img src="/a.png"><button><svg></svg> </button><figcaption><code>B</code></figcaption>', '| ![](/a.png) *`B`* |\n| --- |'],
  ])('keeps the owed separator before a table caption opener: %s', async (content, expected) => {
    const html = `<table><tr><td>${content}</td></tr></table>`
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it.each([
    [
      '<strong><button>A </button><figcaption><em></em></figcaption></strong>',
      '**A**',
    ],
    [
      '<strong><span>A </span><figcaption><code></code></figcaption></strong>',
      '**A**',
    ],
    [
      '<em><button>A </button><figcaption><em></em></figcaption></em>',
      '*A*',
    ],
    [
      '<strong><button>A </button><figcaption></figcaption></strong>',
      '**A**',
    ],
    [
      '<strong><button>A </button><figcaption><em></em></figcaption>B</strong>',
      '**A B**',
    ],
    [
      '<table><tr><td><button>A </button><figcaption><b><svg></svg></b>B</figcaption></td></tr></table>',
      '| A *B* |\n| --- |',
    ],
    [
      '<ol><li><button>A<i></i> </button><figcaption><code>B</code></figcaption></li></ol>',
      '1. A\n\n   *`B`*',
    ],
    [
      '<ul><li><button>A<i></i> </button><figcaption><code>B</code></figcaption></li></ul>',
      '- A\n\n  *`B`*',
    ],
    [
      '<ol><li><button>A </button><figcaption><code>B</code></figcaption></li></ol>',
      '1. A\n\n   *`B`*',
    ],
    [
      '<ul><li><button>A </button><figcaption><em> </em><code>B</code></figcaption></li></ul>',
      '- A\n\n  *`B`*',
    ],
  ])('caption separator lifecycle: %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it.each([
    ['<kbd><a href="/f" title="Lima "></a><figcaption><a href="/f" title="Lima "><br></a></figcaption></kbd>', '`[Lima](/f) *[  \nLima](/f)*`'],
    ['<a href="/f" title="Lima "></a><figcaption><samp><br></samp><mark></mark></figcaption>', '[Lima](/f) *<mark></mark>*'],
    ['<figcaption><s>1. Lima </s><figcaption><svg></svg> Lima</figcaption></figcaption>', '*~~1. Lima~~ *Lima**'],
    ['<code><a href="/f" title="Lima "></a></code>', '`[Lima ](/f "Lima ")`'],
    // Text the exit trims repeats the title, as outside a code span.
    ['<code><a href="/f" title="Lima "><span>Lima </span></a></code>', '`[Lima](/f)`'],
    ['<code>x<a href="/f" title="Lima ">Lima </a>y</code>', '`x [Lima](/f) y`'],
    ['<button>A </button><figcaption><em><br>B</em></figcaption>', 'A\n\n  \n**B**'],
  ])('caption separator rollback and link fallback: %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks)).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)])).toBe(expected)
  })

  it.each([
    [
      '<q><kbd>1. Lima\n</kbd><figcaption><samp><script></script><img src="/n"></samp></figcaption></q>',
      '"`1. Lima` *`![](/n)`*"',
      {
        tagOverrides: {
          'x-q': 'blockquote',
        },
      },
    ],
    [
      '<var><a href="/f" title="Lima "></a><figcaption><strong><style></style></strong>1. Lima</figcaption></var>',
      '`[Lima](/f) *1. Lima*%',
      {
        tagOverrides: {
          var: {
            exit: '%',
          },
        },
      },
    ],
    [
      '<q><kbd><code><li><script>x</script><script>x</script></li><svg></svg></code><figcaption>1. Lima\n</figcaption></kbd><figcaption><samp><cite><script>x</script><img src="/n"></cite><button>\n Lima</button></samp><samp>\n<strong><script>x</script> </strong></samp></figcaption></q>',
      '"``- `*1. Lima*` *`*![](/n)* Lima`*"',
      {
        tagOverrides: {
          'x-q': 'blockquote',
        },
      },
    ],
    [
      '<var><strong><samp><li><i></i> </li><a href="/f" title="Lima ">  </a></samp><figcaption><strong> <style></style></strong><cite><svg></svg>1. Lima</cite></figcaption></strong><s><var><blockquote><style></style>Kilo</blockquote><div> Lima Lima</div></var><script>x</script></s></var>',
      '`**`- [Lima](/f)` **1. Lima****~~`>  Kilo Lima Lima%~~%',
      {
        tagOverrides: {
          var: {
            exit: '%',
          },
        },
      },
    ],
  ])('keeps caption separators across excluded wrappers: %s', async (html, expected, options) => {
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks, options), `width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)], options), `split=${split}`).toBe(expected)
  })

  it.each([
    [
      '<figcaption><cite><kbd><svg></svg></kbd><br>Kilo</cite></figcaption>',
      '**Kilo**',
    ],
    [
      '<figcaption><cite><kbd><svg></svg></kbd><br><br>Kilo</cite></figcaption>',
      '**Kilo**',
    ],
    [
      '<figcaption><cite><kbd><svg></svg></kbd><br></cite></figcaption>',
      '',
    ],
    [
      '<figcaption><cite><kbd><svg></svg></kbd><br>Kilo</cite> Lima</figcaption>',
      '**Kilo* Lima*',
    ],
    ['<kbd><samp><var><span><i></i>Kilo</span><ul><img src="/n">Kilo</ul></var><q><a href="/f" title="Lima "><svg></svg><style></style></a><strong><svg></svg><script>x</script></strong></q></samp><figcaption><cite><kbd> <svg></svg></kbd><em><br>Kilo</em></cite><a href="/f" title="Lima "><ul>\n<br></ul> </a></figcaption></kbd>', '```Kilo![](/n)Kilo`" [Lima](/f)"`   \n***Kilo**[  \nLima](/f)*`'],
  ])('keeps caption emphasis after a leading break: %s', async (html, expected) => {
    const options = { tagOverrides: { code: { enter: '^', exit: '^' } } }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks, options), `width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)], options), `split=${split}`).toBe(expected)
  })
  it('link-raw', async () => {
    const html = '<p>D<span> <a href="/x" title="7"><mark></mark>7</a></span></p>'
    const expected = 'D [<mark></mark>7](/x)'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('title-read', async () => {
    const html = '<p><a href="/x" title="Read more "><span>Read more </span></a></p>'
    const expected = '[Read more](/x)'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('title-e', async () => {
    for (const [html, expected] of [
      ['<a href="/x" title="e ">e</a>', '[e](/x)'],
      ['<a title="e ">e</a>', 'e'],
    ] as const) {
      expect(htmlToMarkdown(html)).toBe(expected)
      for (const width of [1, 2, 3, 7]) {
        const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
        expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
      }
      for (let split = 0; split <= html.length; split++)
        expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
    }
  })
  it('raw-script', async () => {
    const html = '<p>a<span> <script>s</script><span> <b>D</b></span></span></p>'
    const expected = 'a **D**'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
  it('raw-style', async () => {
    const html = '<p>a<span> <style>s</style><span> <b>D</b></span></span></p>'
    const expected = 'a **D**'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `chunk width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  })
})

it('exposes retained leading blanks to hooks, extraction and header metadata', async () => {
  const html = '<h2>Aa<span> <span>Bb</span></span></h2><p>body</p>'
  const blanks: string[] = []
  const extracted: string[] = []
  const options = {
    plugins: [
      createPlugin({
        processTextNode(node) {
          if (node.leadingBlank)
            blanks.push(node.value)
        },
      }),
      extractionPlugin({ h2: node => extracted.push(node.textContent) }),
    ],
  }
  const check = () => {
    expect(blanks).toEqual([' '])
    expect(extracted).toEqual(['Aa Bb'])
    blanks.length = 0
    extracted.length = 0
  }
  expect(htmlToMarkdown(html, options)).toBe('## Aa Bb\n\nbody')
  check()
  for (const width of [1, 2, 3, 7]) {
    const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
    expect(await streamConvert(chunks, options)).toBe('## Aa Bb\n\nbody')
    check()
  }
  for (let split = 0; split <= html.length; split++) {
    expect(await streamConvert([html.slice(0, split), html.slice(split)], options)).toBe('## Aa Bb\n\nbody')
    check()
  }
  expect(htmlToMarkdownSplitChunks(html)[0]?.metadata.headers).toEqual({ h2: 'Aa Bb' })
})

it('reuses an opener run across repeated blanks without leaking it to siblings', async () => {
  for (const depth of [2, 8, 254]) {
    const html = `<p>a${'<s><cite>'.repeat(depth)}${' <svg></svg>'.repeat(32)
    }b${'</cite></s>'.repeat(depth)}<span> </span>c</p><p><span> <b>d</b></span></p>`
    const expected = `a ${'~~*'.repeat(depth)}b${'*~~'.repeat(depth)} c\n\n**d**`
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `depth=${depth}, width=${width}`).toBe(expected)
    }
    if (depth <= 8) {
      for (let split = 0; split <= html.length; split++)
        expect(await streamConvert([html.slice(0, split), html.slice(split)]), `depth=${depth}, split=${split}`).toBe(expected)
    }
  }
})

it('ends the whitespace run after an unread raw-text body of blanks', async () => {
  for (const tag of ['style', 'iframe', 'noscript', 'noembed', 'datalist', 'noframes']) {
    for (const [body, expected] of [[' ', 'a **D**'], ['\n\t', 'a **D**'], ['s ', 'a **D**'], ['', 'a**D**']]) {
      const html = `<p>a<span> <${tag}>${body}</${tag}><span> <b>D</b></span></span></p>`
      expect(htmlToMarkdown(html), html).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
        expect(await streamConvert(chunks), `${html}, width=${width}`).toBe(expected)
      }
      for (let split = 0; split <= html.length; split++)
        expect(await streamConvert([html.slice(0, split), html.slice(split)]), `${html}, split=${split}`).toBe(expected)
    }
  }
  // `<title>` text is metadata the parser reads, so its blanks still collapse.
  const title = '<p>a<span> <title> </title><span> <b>D</b></span></span></p>'
  expect(htmlToMarkdown(title)).toBe('a**D**')
  for (let split = 0; split <= title.length; split++)
    expect(await streamConvert([title.slice(0, split), title.slice(split)]), `split=${split}`).toBe('a**D**')
})

it('ends the whitespace run after dropped raw text when plugins read it', async () => {
  const modes = [
    () => [filterPlugin({ exclude: ['nav'] })],
    () => [tailwindPlugin()],
    () => [extractionPlugin({ 'a[href]': () => {} })],
    () => [extractionPlugin({ span: () => {} })],
  ]
  for (const plugins of modes) {
    for (const tag of ['style', 'iframe', 'noscript', 'noembed', 'datalist', 'noframes']) {
      for (const [body, expected] of [[' ', 'a **D**'], ['s ', 'a **D**'], ['', 'a**D**']] as [string, string][]) {
        const html = `<p>a<span> <${tag}>${body}</${tag}><span> <b>D</b></span></span></p>`
        expect(htmlToMarkdown(html, { plugins: plugins() }), html).toBe(expected)
        // With plugins, a split end tag of an empty body still reads as text.
        if (!body)
          continue
        for (let split = 0; split <= html.length; split++)
          expect(await streamConvert([html.slice(0, split), html.slice(split)], { plugins: plugins() }), `${html}, split=${split}`).toBe(expected)
      }
    }
  }
})

it('does not count a split empty raw-text closer as body text', async () => {
  for (const tag of ['script', 'style']) {
    const html = `<p>a<span> <${tag}></${tag}><span> <b>D</b></span></span></p>`
    const expected = 'a**D**'
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 2, 3, 7]) {
      const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
      expect(await streamConvert(chunks), `${tag}, width=${width}`).toBe(expected)
    }
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert([html.slice(0, split), html.slice(split)]), `${tag}, split=${split}`).toBe(expected)
  }
})

it.each([
  [
    '<code>A<br><figcaption><em><br>B</em></figcaption></code>',
    '`A\n**\nB**`',
  ],
  [
    '<code><figcaption><em><br></em><em><br>B</em></figcaption>C</code>',
    '`**\nB**C`',
  ],
  [
    '<figure><button>A </button><figcaption><em><br></em><em><br>B</em></figcaption></figure>',
    'A   \n**B**',
  ],
  [
    'A<figcaption><br><em><br>B</em></figcaption>',
    'A  \n  \n**B**',
  ],
  // A child that renders nothing leaves the separator to the caption.
  [
    '<button>A </button><figcaption><script></script></figcaption>B',
    'A B',
  ],
  [
    '<h2><button>A </button><figcaption><style>s</style><code>B</code></figcaption></h2>',
    '## A *`B`*',
  ],
  [
    '<table><tr><td><button>A </button><figcaption><script>s</script><em>B</em></figcaption></td></tr></table>',
    '| A **B** |\n| --- |',
  ],
  // So does a block inside a delimiter the caption already opened with.
  [
    '<a href="/r"><em>A </em><figcaption><s><p>N</p></s></figcaption></a>',
    '[*A* *~~N~~*](/r)',
  ],
  [
    '<h3><em>A </em><figcaption><s><ul><em>N</em></ul></s></figcaption></h3>',
    '### *A* *~~*N*~~*',
  ],
])('preserves caption delimiter context: %s', async (html, expected) => {
  expect(htmlToMarkdown(html)).toBe(expected)
  for (const width of [1, 2, 3, 7]) {
    const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
    expect(await streamConvert(chunks), `width=${width}`).toBe(expected)
  }
  for (let split = 0; split <= html.length; split++)
    expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
})

it.each([
  ['<ul><li><div><span>Aa </span><i></i></div><span>Bb</span></li></ul>', '- Aa Bb'],
  ['<ul><li><a href="/x">Aa </a><i></i><div></div><span>Bb</span></li></ul>', '- [Aa](/x) Bb'],
  ['<h2><span>Aa </span><b><i></i></b><section></section><span>Bb</span></h2>', '## Aa Bb'],
  ['<table><tr><td><span>Aa </span><i></i><div></div><b>Bb</b></td></tr></table>', '| Aa **Bb** |\n| --- |'],
  ['<table><tr><td><span>Aa </span><q></q><ul><b>Bb</b></ul> Cc</td></tr></table>', '| Aa <ul>**Bb**</ul> Cc |\n| --- |'],
  ['<strong><button><span>Aa</span> </button><b><svg></svg></b><span><script>s</script><code></code></span>Bb</strong>', '**Aa Bb**'],
  // A line end still takes it.
  ['<ul><li><span>Aa </span><i></i><div></div></li><li>x</li></ul>', '- Aa\n- x'],
  ['<ul><li><span>Aa </span><i></i><hr>Bb</li></ul>', '- Aa\n\n  ---\n\n  Bb'],
  // So does the block when no pair took the separator along, or when the
  // separator is a blank that opened an inline element.
  ['<ul><li><span>Aa </span><div></div><span>Bb</span></li></ul>', '- AaBb'],
  ['<ul><li>Aa<span> <div></div></span>Bb</li></ul>', '- AaBb'],
  ['<ul><li>Aa<span> <i></i><div></div></span>Bb</li></ul>', '- AaBb'],
])('keeps a trimmed separator across an empty pair before a block on the same line: %s', async (html, expected) => {
  expect(htmlToMarkdown(html)).toBe(expected)
  for (const width of [1, 2, 3, 11]) {
    const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
    expect(await streamConvert(chunks), `width=${width}`).toBe(expected)
  }
  for (let split = 0; split <= html.length; split++)
    expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
})

it.each([
  ['<p>h<kbd>&#32;<svg></svg></kbd>B</p>', 'h` `B'],
  ['<p>h<code><svg></svg>&#32;</code>B</p>', 'h` `B'],
  ['<p>h<q>&#32;<svg></svg></q>B</p>', 'h " "B'],
  ['<p><code><script>x</script>&#32;</code></p>', '` `'],
  ['<ul><li><kbd>&#32;<svg></svg></kbd>B</li></ul>', '- ` `B'],
  ['<p><b><kbd><svg></svg>&#32;</kbd></b>B</p>', '**` `**B'],
  ['<p>h<kbd>&#32;<b><svg></svg></b></kbd>B</p>', 'h` `B'],
  // No text, literal whitespace, or an emphasis pair still leave it empty.
  ['<p>a<code><svg></svg></code>b</p>', 'ab'],
  ['<p>a<kbd><svg></svg> </kbd>b</p>', 'ab'],
  ['<p><code>&#32;</code></p>', ''],
  ['<p>x <code>&#32;</code> y</p>', 'x  y'],
  ['<p>h<kbd>&#32;</kbd>B</p>', 'hB'],
  ['<p>h<q>&#9;</q>B</p>', 'h B'],
  ['<p>h<em>&#32;<svg></svg></em>B</p>', 'h B'],
])('keeps a code span whose decoded blank sits beside a dropped element: %s', async (html, expected) => {
  expect(htmlToMarkdown(html)).toBe(expected)
  for (const width of [1, 2, 3, 11]) {
    const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
    expect(await streamConvert(chunks), `width=${width}`).toBe(expected)
  }
  for (let split = 0; split <= html.length; split++)
    expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
})

it.each([
  ['<em><strong><blockquote>L</blockquote></strong></em>', '***>  L***'],
  ['<cite><cite><blockquote>K</blockquote></cite></cite>', '**>  K**'],
  ['<s><b><blockquote>x</blockquote></b></s>', '~~**>  x**~~'],
  ['<em><blockquote>L</blockquote></em>', '*>  L*'],
  ['<a href="/f" title="Lima ">Lima<i></i></a>', '[Lima](/f "Lima ")'],
  ['<a href="/f" title="Lima ">Lima<var></var></a>', '[Lima](/f "Lima ")'],
  ['<a href="/f" title="Lima"><span>Lima </span><svg></svg></a>', '[Lima](/f)'],
])('matches Rust after an opener run and after a dropped empty pair: %s', async (html, expected) => {
  expect(htmlToMarkdown(html)).toBe(expected)
  for (const width of [1, 2, 3, 11]) {
    const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
    expect(await streamConvert(chunks), `width=${width}`).toBe(expected)
  }
})

it.each([
  ['Aa<span> </span> <form><span>Bb</span></form>', 'Aa Bb'],
  ['Aa<span> </span> <fieldset><span>Bb</span></fieldset>', 'Aa Bb'],
  ['Aa<span> </span> <select><span>Bb</span></select>', 'Aa Bb'],
  ['Aa<span> </span>\n<form><span>Bb</span></form>', 'Aa Bb'],
  ['Aa<span> </span> <form></form><span>Bb</span>', 'Aa Bb'],
  ['Aa<strong> </strong> <form><span>Bb</span></form>', 'Aa Bb'],
  ['Aa<span> </span> <address>Bb</address>', 'Aa <address>Bb</address>'],
  ['<ul><li>Aa<span> </span> <form><span>Bb</span></form></li></ul>', '- Aa Bb'],
  ['<table><tr><td>Aa<span> </span> <blockquote>Bb</blockquote></td></tr></table>', '| Aa > Bb |\n| --- |'],
  ['<a href="/x">Aa<span> </span> <form><span>Bb</span></form></a>', '[Aa Bb](/x)'],
  ['<strong>Aa<span> </span> <form><span>Bb</span></form></strong>', '**Aa Bb**'],
  // The blank alone writes nothing there, and a decoded one stays owed.
  ['Aa<span> </span><form><span>Bb</span></form>', 'AaBb'],
  ['<strong>h<span> </span>&#32;</strong>x', '**h** x'],
])('keeps a written space after a blank that opened an inline element: %s', async (html, expected) => {
  expect(htmlToMarkdown(html)).toBe(expected)
  for (let split = 0; split <= html.length; split++)
    expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
})

it.each([
  ['<ul><li><span><span>Aa</span> </span><p>Bb</p></li></ul>', '- Aa\n\n  Bb'],
  ['<ul><li><span><span>Aa</span> </span><i></i> <p>Bb</p></li></ul>', '- Aa\n\n  Bb'],
  ['<ol><li><span><span>Aa</span> </span><i></i><p>Bb</p><p>Cc</p></li></ol>', '1. Aa\n\n   Bb\n\n   Cc'],
  ['<blockquote><br><em>h</em><i></i></blockquote><a href="/x" title="x">x</a>', '>   \n> *h*\n\n[x](/x)'],
  ['<blockquote><br><em>x</em><i></i></blockquote><a href="/x" title="x">x</a>', '>   \n> *x*\n\n[x](/x)'],
  ['<ul><li><code>Aa</code> <table></table><code>Bb</code></li></ul>', '- `Aa` `Bb`'],
  ['<ul><li>Aa<span> </span> <p><code>Bb</code></p></li></ul>', '- Aa `Bb`'],
  ['<ul><li>Aa<span> </span> <section><code>Bb</code></section></li></ul>', '- Aa `Bb`'],
])('converts in one shot as it streams once a trim or a dropped pair rewrote the buffer: %s', async (html, expected) => {
  expect(htmlToMarkdown(html)).toBe(expected)
  for (let split = 0; split <= html.length; split++)
    expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
  for (const width of [1, 2, 3, 11]) {
    const chunks = Array.from({ length: Math.ceil(html.length / width) }, (_, i) => html.slice(i * width, (i + 1) * width))
    expect(await streamConvert(chunks), `width=${width}`).toBe(expected)
  }
})

it.each([
  ['Aa<span> </span>&#32;<form><span>Bb</span></form>', 'Aa Bb'],
  ['Aa<span> </span>&#32; <form><span>Bb</span></form>', 'Aa Bb'],
  ['Aa<span> </span>&#9;<form><span>Bb</span></form>', 'Aa Bb'],
  ['Aa<span> </span>&#32;<form></form><span>Bb</span>', 'Aa Bb'],
  ['<b>Aa</b><i> </i>&#32;<form><span>Bb</span></form>', '**Aa** Bb'],
  ['Aa<span> </span>&#32;<address>Bb</address>', 'Aa <address>Bb</address>'],
  ['<ul><li>Aa<span> </span>&#32;<form><span>Bb</span></form></li></ul>', '- Aa Bb'],
  ['<table><tr><td>Aa<span> </span>&#32;<form><span>Bb</span></form></td></tr></table>', '| Aa Bb |\n| --- |'],
  // An emphasis closer still leaves it outside, and a line end takes it.
  ['<strong>h<span> </span>&#32;</strong>x', '**h** x'],
  ['Aa<span> </span>&#32;<p>Bb</p>', 'Aa\n\nBb'],
  // A space written after it is still output like any other.
  ['<strong>Aa<span> </span>&#32;<i></i> <blockquote></blockquote>Bb</strong>', '**Aa Bb**'],
  ['Aa<span> </span>&#32;<blockquote>Bb</blockquote>', 'Aa\n\n> Bb'],
  ['<ul><li>Aa<span> </span>&#32;<pre>Bb</pre></li></ul>', '- Aa\n\n  ```\n  Bb\n  ```'],
  ['<ul><li><span>Aa </span><i></i><pre>Bb</pre></li></ul>', '- Aa\n\n  ```\n  Bb\n  ```'],
])('keeps a decoded blank after a blank that opened an inline element: %s', async (html, expected) => {
  expect(htmlToMarkdown(html)).toBe(expected)
  for (let split = 0; split <= html.length; split++)
    expect(await streamConvert([html.slice(0, split), html.slice(split)]), `split=${split}`).toBe(expected)
})
