import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

const HARD_BREAK = '  \n'

async function streamConvert(chunks: string[]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })

  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    output += chunk
  return output
}

describe('gfm hard breaks', () => {
  it.each([
    ['plain paragraph', '<p>first<br>second</p>', `first${HARD_BREAK}second`],
    ['adjacent literal backslash', '<p>before\\<br>after</p>', `before${'\\'.repeat(2)}${HARD_BREAK}after`],
    ['multiple breaks', '<p>first<br><br>third</p>', `first${HARD_BREAK}${HARD_BREAK}third`],
    ['list item continuation', '<ul><li>first<br>second</li></ul>', `- first${HARD_BREAK}  second`],
    ['blockquote continuation', '<blockquote><p>first<br>second</p></blockquote>', `> first${HARD_BREAK}> second`],
  ])('serializes %s as an explicit hard break', (_name, html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it.each([
    ['table cell', '<table><tr><td>first<br>second</td></tr></table>', '| first<br>second |\n| --- |'],
    ['heading', '<h1>first<br>second</h1>', '# first<br>second'],
    ['raw HTML block', '<address>first<br>second</address>', '<address>first<br>second</address>'],
  ])('keeps <br> in a %s', (_name, html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it('does not emit a hard-break marker inside inline code', () => {
    expect(htmlToMarkdown('<code>first<br>second</code>'))
      .toBe('`first\nsecond`')
  })

  it('preserves plugin output in place of the built-in break', () => {
    expect(htmlToMarkdown('<p>first<br>second</p>', {
      hooks: [{
        onNodeEnter(node) {
          return node.name === 'br' ? '<plugin-break>' : undefined
        },
      }],
    })).toBe('first<plugin-break>second')
  })

  it('preserves literal tag overrides in place of the built-in break', () => {
    expect(htmlToMarkdown('<p>first<br>second</p>', {
      plugins: {
        tagOverrides: {
          br: { enter: '<literal-break>' },
        },
      },
    })).toBe('first<literal-break>second')
  })

  it('normalizes plain-text breaks while preserving pre newlines', () => {
    expect(htmlToMarkdown('<p>first<br><br><br>second</p>', { format: 'text' }))
      .toBe('first\n\nsecond')
    expect(htmlToMarkdown('<pre>first<br><br><br>second</pre>', { format: 'text' }))
      .toBe('first\n\n\nsecond')
  })

  it('matches one-shot output at every stream split', async () => {
    const cases = [
      '<p>first<br>second</p>',
      '<p>before\\<br>after<br><br>last</p>',
      '<ul><li>first<br>second</li></ul>',
      '<blockquote><p>first<br>second</p></blockquote>',
      '<table><tr><td>first<br>second</td></tr></table>',
      '<h1>first<br>second</h1>',
      '<address>first<br>second</address>',
      '<code>first<br>second</code>',
    ]

    for (const html of cases) {
      const expected = htmlToMarkdown(html)
      for (let split = 0; split <= html.length; split++) {
        expect(
          await streamConvert([html.slice(0, split), html.slice(split)]),
          `html=${html} split=${split}`,
        ).toBe(expected)
      }
    }
  })
})
