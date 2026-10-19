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
