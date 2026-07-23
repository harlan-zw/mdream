import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

const HARD_BREAK = '\\\n'

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

  it('matches one-shot output at every stream split', async () => {
    const cases = [
      '<p>first<br>second</p>',
      '<p>before\\<br>after<br><br>last</p>',
      '<ul><li>first<br>second</li></ul>',
      '<blockquote><p>first<br>second</p></blockquote>',
      '<table><tr><td>first<br>second</td></tr></table>',
      '<h1>first<br>second</h1>',
      '<address>first<br>second</address>',
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
