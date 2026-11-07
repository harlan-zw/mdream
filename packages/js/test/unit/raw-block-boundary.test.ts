import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src'
import { createMarkdownProcessor } from '../../src/markdown-processor'
import { createMarkdownDrain } from '../../src/markdown-stream'

const cases: [string, string][] = [
  [
    '<ul><li><ul><li><ul><li><hr>tail</li></ul></li></ul></li></ul>',
    '-\n  -\n    - ***\n\n      tail',
  ],
  [
    '<ul><li><ul><li><ul><li><address>A</address><strong>B</strong></li></ul></li></ul></li></ul>',
    '-\n  -\n    - <address>A</address>\n\n      **B**',
  ],
  ['<dl><dd><details>X</details></dd></dl><strong>B</strong>', '<dl><dd>\n\n<details>X</details>\n\n\n\n</dd></dl>\n\n**B**'],
  [
    '<blockquote><address>A</address><blockquote><strong>B</strong></blockquote></blockquote>',
    '> <address>A</address>\n>\n> > **B**',
  ],
  [
    '<address>A</address><sup>Z</sup> tail',
    '<address>A</address>\n\n<sup>Z</sup> tail',
  ],
  ['<address>A</address> tail', '<address>A</address>\n\ntail'],
  ['<address>A</address>&#32;&#32;&#32;&#32;tail', '<address>A</address>\n\ntail'],
  ['<address>A</address>&#9;tail', '<address>A</address>\n\ntail'],
  ['<address>A</address>&#13;&#10;tail', '<address>A</address>\n\ntail'],
  ['<address>A</address>&nbsp;tail', '<address>A</address>\n\n tail'],
  ['<address>A</address>&#32;&#11;tail', '<address>A</address>\n\n\u000Btail'],
  ['<ul><li><address>A</address> tail</li></ul>', '- <address>A</address>\n\n  tail'],
  ['<blockquote><address>A</address> tail</blockquote>', '> <address>A</address>\n>\n> tail'],
  ['<address>A</address> <b>x</b>', '<address>A</address> \n\n**x**'],
  [
    '<ul><li><address>A</address><blockquote><strong>B</strong></blockquote></li></ul>',
    '- <address>A</address>\n\n  > **B**',
  ],
  [
    '<p>PPPPPPPPPPPPPPPPPP</p><blockquote><dl>A</dl><strong>B</strong></blockquote>',
    'PPPPPPPPPPPPPPPPPP\n\n> <dl>A</dl>\n>\n> **B**',
  ],
  [
    `${'<p>prefix</p>'.repeat(4)}<address>A</address><strong>B</strong>`,
    `${'prefix\n\n'.repeat(4)}<address>A</address>\n\n**B**`,
  ],
  [
    `${'<p>prefix</p>'.repeat(4)}<ul><li><dl><dt>T</dt><dd>D</dd></dl><strong>B</strong></li></ul>`,
    `${'prefix\n\n'.repeat(4)}- <dl><dt>T</dt><dd>D</dd></dl>\n\n  **B**`,
  ],
  [
    '<address>A</address><strong>B</strong>',
    '<address>A</address>\n\n**B**',
  ],
  [
    '<ul><li><address>A</address><strong>B</strong></li></ul>',
    '- <address>A</address>\n\n  **B**',
  ],
  [
    'prefix <address>A</address><strong>B</strong>',
    'prefix <address>A</address>**B**',
  ],
  [
    '<dl>A</dl><strong>B</strong>',
    '<dl>A</dl>\n\n**B**',
  ],
  [
    '<ul><li><dl>A</dl><strong>B</strong></li></ul>',
    '- <dl>A</dl>\n\n  **B**',
  ],
  [
    'prefix <dl>A</dl><strong>B</strong>',
    'prefix <dl>A</dl>**B**',
  ],
  [
    '<dt>A</dt><strong>B</strong>',
    '<dt>A</dt>\n\n**B**',
  ],
  [
    '<ul><li><dt>A</dt><strong>B</strong></li></ul>',
    '- <dt>A</dt>\n\n  **B**',
  ],
  [
    'prefix <dt>A</dt><strong>B</strong>',
    'prefix <dt>A</dt>\n**B**',
  ],
  [
    '<dd>A</dd><strong>B</strong>',
    '<dd>A</dd>\n\n**B**',
  ],
  [
    '<ul><li><dd>A</dd><strong>B</strong></li></ul>',
    '- <dd>A</dd>\n\n  **B**',
  ],
  [
    'prefix <dd>A</dd><strong>B</strong>',
    'prefix <dd>A</dd>\n**B**',
  ],
  [
    '<details>A</details><strong>B</strong>',
    '<details>A</details>\n\n\n\n**B**',
  ],
  [
    '<ul><li><details>A</details><strong>B</strong></li></ul>',
    '- <details>A</details>\n\n**B**',
  ],
  [
    'prefix <details>A</details><strong>B</strong>',
    'prefix\n\n<details>A</details>\n\n\n\n**B**',
  ],
  [
    '<summary>A</summary><strong>B</strong>',
    '<summary>A</summary>\n\n\n\n**B**',
  ],
  [
    '<ul><li><summary>A</summary><strong>B</strong></li></ul>',
    '- <summary>A</summary>\n\n**B**',
  ],
  [
    'prefix <summary>A</summary><strong>B</strong>',
    'prefix\n\n<summary>A</summary>\n\n\n\n**B**',
  ],
  [
    '<ul><li><dl><dt>T</dt><dd>D</dd></dl><strong>B</strong></li></ul>',
    '- <dl><dt>T</dt><dd>D</dd></dl>\n\n  **B**',
  ],
  [
    '<address>A</address><code>C</code>',
    '<address>A</address>\n\n`C`',
  ],
  [
    '<dd>D</dd><a href="/x">L</a>',
    '<dd>D</dd>\n\n[L](/x)',
  ],
  [
    '<blockquote><address>A</address><em>E</em></blockquote>',
    '> <address>A</address>\n>\n> *E*',
  ],
  [
    '<ol start="12"><li><address>A</address><em>E</em></li></ol>',
    '12. <address>A</address>\n\n    *E*',
  ],
  [
    '<ul><li>outer<ul><li><address>A</address><strong>B</strong></li></ul></li></ul>',
    '- outer\n  - <address>A</address>\n\n    **B**',
  ],
  [
    '<address>A</address><br><strong>B</strong>',
    '<address>A</address>  \n\n**B**',
  ],
  [
    '<dt>A</dt><br><strong>B</strong>',
    '<dt>A</dt>\n  \n**B**',
  ],
  [
    '<dt>A</dt><h2><a href="/x">Heading</a></h2>',
    '<dt>A</dt>\n\n## [Heading](/x)',
  ],
  [
    '<ul><li><address>A</address><pre>C</pre></li></ul>',
    '- <address>A</address>\n\n  ```\n  C\n  ```',
  ],
  [
    '<ul><li><address>A</address><ul><li>B</li></ul></li></ul>',
    '- <address>A</address>\n\n  - B',
  ],
  [
    '<address><p>A</p></address><strong>B</strong>',
    '<address>A</address>\n\n**B**',
  ],
  [
    '<address>A</address>&lt;literal&gt; *text*',
    '<address>A</address>\n\n\\<literal> \\*text\\*',
  ],
  [
    '<address>A</address><address>B</address><strong>B</strong>',
    '<address>A</address><address>B</address>\n\n**B**',
  ],
  [
    '<address>A</address>',
    '<address>A</address>',
  ],
  [
    '<ul><li><address>A</address></li><li><strong>B</strong></li></ul>',
    '- <address>A</address>\n- **B**',
  ],
  [
    '<table><tr><th>H</th></tr><tr><td><address>A</address><strong>B</strong></td></tr></table>',
    '| H |\n| --- |\n| <address>A</address>**B** |',
  ],
  [
    '<table><tr><th>H</th></tr><tr><td><dl>A</dl><strong>B</strong></td></tr></table>',
    '| H |\n| --- |\n| <dl>A</dl>**B** |',
  ],
  [
    '<table><tr><th>H</th></tr><tr><td><dt>A</dt><strong>B</strong></td></tr></table>',
    '| H |\n| --- |\n| <dt>A</dt>**B** |',
  ],
  [
    '<table><tr><th>H</th></tr><tr><td><dd>A</dd><strong>B</strong></td></tr></table>',
    '| H |\n| --- |\n| <dd>A</dd>**B** |',
  ],
  [
    '<table><tr><th>H</th></tr><tr><td><details>A</details><strong>B</strong></td></tr></table>',
    '| H |\n| --- |\n| <details>A</details>**B** |',
  ],
  [
    '<table><tr><th>H</th></tr><tr><td><summary>A</summary><strong>B</strong></td></tr></table>',
    '| H |\n| --- |\n| <summary>A</summary>**B** |',
  ],
]

describe('raw HTML block boundaries', () => {
  it.each(cases)('preserves the boundary after %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const stream = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(stream))
        output += chunk
      expect(output, `chunk width ${width}`).toBe(expected)
    }
  })
})

it('keeps unobserved blank lines in the mutable raw HTML scan tail', () => {
  const processor = createMarkdownProcessor({}, context => ({
    ...createMarkdownDrain(context, false),
    scan: context.bufferScan,
  }))
  processor.state.buffer.push('<address>X', '\n\n', ' ')
  expect(processor.getMarkdownChunk()).toBe('<address>X')
  const unobserved = processor.state.buffer.slice(processor.scan[1]).join('')
  expect(unobserved).toBe('\n\n ')
})
