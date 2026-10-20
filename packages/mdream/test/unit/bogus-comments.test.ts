import { describe, expect, it } from 'vitest'
import { engines } from '../utils/engines'

const cases = [
  ['<p>a<!x>b</p>', 'ab'],
  ['<p>a<?x', 'a'],
  ['<p>a<!x', 'a'],
  ['<p>a</ x', 'a'],
  ['<p>a <?x?>b</p>', 'a b'],
  ['<p>a<?x?> b</p>', 'a b'],
  ['<p>a&amp;<?x?>b</p>', 'a&b'],
  ['<code>a<?x?>b</code>', '`ab`'],
  ['<pre>a<!x>b</pre>', '```\nab\n```'],
  ['<textarea>a</ x>b</textarea>', 'a\\</ x>b'],
  ['<textarea>a<!x', 'a\\<!x'],
  ['<p>a<!dud>b</p>', 'ab'],
  ['<p>a</ x>b</p>', 'ab'],
  ['<p>a<?x?>b</p>', 'ab'],
  ['<pre>a<?x?>b</pre>', '```\nab\n```'],
  ['<textarea>a<!x>b</textarea>', 'a\\<!x>b'],
  ['<p>a</>b</p>', 'ab'],
  ['<p>a</1x>b</p>', 'ab'],
  ['<p>a</?x>b</p>', 'ab'],
  ['<p>a<?x y=">">b</p>', 'a">b'],
  ['<p>a</ x y=">">b</p>', 'a">b'],
  [
    '<p><a href="/c">x<?x?> </a>Next</p>',
    '[x](/c) Next',
  ],
  [
    '<ol><li>a</li><?x?><li>b</li></ol>',
    '1. a\n2. b',
  ],
  [
    '<p><a href="/c">x<?x y?> </a>Next</p>',
    '[x](/c) Next',
  ],
  [
    '<ol><li>a</li><?x y?><li>b</li></ol>',
    '1. a\n2. b',
  ],
  [
    '<p><a href="/c">x<!x> </a>Next</p>',
    '[x](/c) Next',
  ],
  [
    '<ol><li>a</li><!x><li>b</li></ol>',
    '1. a\n2. b',
  ],
  [
    '<p><a href="/c">x</ x> </a>Next</p>',
    '[x](/c) Next',
  ],
  [
    '<ol><li>a</li></ x><li>b</li></ol>',
    '1. a\n2. b',
  ],
  [
    '<p>before<?x y=">after</p>',
    'beforeafter',
  ],
  [
    '<p>before<!x y=">after</p>',
    'beforeafter',
  ],
  [
    '<p>before</ x y=">after</p>',
    'beforeafter',
  ],
  [
    '<p>before<?--x>after</p>',
    'beforeafter',
  ],
  [
    '<p>before<?[CDATA[x>after</p>',
    'beforeafter',
  ],
  [
    '<p>before</p><?x',
    'before',
  ],
  [
    '<p>before</p><!x',
    'before',
  ],
  [
    '<p>before</p></ x',
    'before',
  ],
  [
    '<textarea>a<?x?>b</textarea>',
    'a\\<?x?>b',
  ],
]

describe.each(engines)('$name bogus comments', ({ engine }) => {
  it.each(cases)('discards the token without creating an element: %s', async (html, expected) => {
    expect(engine.htmlToMarkdown(html)).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input))
        output += chunk
      expect(output.trimEnd(), `chunk width ${width}`).toBe(expected)
    }
  })
})

// A discarded token ends the DOM text node before it, so no character reference
// spans it. Each input converts like the HTML that spells out its DOM text.
const referenceCases = [
  ['<p>a&<?x?>amp;b</p>', '<p>a&amp;amp;b</p>'],
  ['<p>a&</ x>amp;b</p>', '<p>a&amp;amp;b</p>'],
  ['<p>a&am<!x>p;b</p>', '<p>a&amp;amp;b</p>'],
  ['<p>a&lt<!x>;b</p>', '<p>a&lt;;b</p>'],
  ['<p>a&#65<?x?>66;b</p>', '<p>aA66;b</p>'],
  [`<p>a&#${'0'.repeat(100)}6<?x?>5;b</p>`, '<p>a&#6;5;b</p>'],
  ['<p>a&#x4<?x?>1;b</p>', '<p>a&#x4;1;b</p>'],
  ['<p>a&#<?x?>65;b</p>', '<p>a&amp;#65;b</p>'],
  ['<p>a&amp<?x?>amp;b</p>', '<p>a&amp;amp;b</p>'],
  ['<p>a&not<?x?>in;b</p>', '<p>a&not;in;b</p>'],
  ['<p>a&zz<?x?>z;b</p>', '<p>a&amp;zzz;b</p>'],
  ['<p>a&amp;<?x?>amp;b</p>', '<p>a&amp;amp;b</p>'],
  ['<p>a&<?x?>&<?x?>amp;b</p>', '<p>a&amp;&amp;amp;b</p>'],
  ['<p>a&<?x?><?y?>amp;b</p>', '<p>a&amp;amp;b</p>'],
  ['<p>&<?x?>amp; b</p>', '<p>&amp;amp; b</p>'],
  ['<pre>a&<?x?>amp;b</pre>', '<pre>a&amp;amp;b</pre>'],
]

describe.each(engines)('$name references at discarded tokens', ({ engine }) => {
  it.each(referenceCases)('ends the reference at the token: %s', async (html, domHtml) => {
    const expected = engine.htmlToMarkdown(domHtml)
    expect(engine.htmlToMarkdown(html)).toBe(expected)
    expect(engine.htmlToMarkdown(html, { format: 'text' })).toBe(engine.htmlToMarkdown(domHtml, { format: 'text' }))
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input))
        output += chunk
      expect(output.trimEnd(), `chunk width ${width}`).toBe(expected)
    }
  })

  it.each([
    ['<p>a&<?x?>amp;b</p>', 'a\\&amp;b'],
    ['<p>a&</ x>amp;b</p>', 'a\\&amp;b'],
    ['<p>a&am<!x>p;b</p>', 'a\\&amp;b'],
    ['<p>a&lt<!x>;b</p>', 'a<;b'],
  ])('keeps the source text the token splits: %s', (html, expected) => {
    expect(engine.htmlToMarkdown(html)).toBe(expected)
  })
})
