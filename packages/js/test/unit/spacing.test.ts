import type { MdreamOptions } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { createPlugin, htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

async function streamConvert(chunks: string[], options?: Partial<MdreamOptions>): Promise<string> {
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
