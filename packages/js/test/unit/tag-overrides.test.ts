import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

const LIST = '<br><ul><li>a<h3>x</h3></li></ul>'

describe('open void tag overrides', () => {
  // The list keeps its block spacing under the open void, so the void's own
  // output sits outside the list and pairs nothing across the heading.
  it.each([
    [LIST, { br: { isSelfClosing: false, enter: '[', exit: ']' } }, '[\n\n- a\n\n  ### x\n\n]'],
    [LIST, { br: { isSelfClosing: false, enter: '[' } }, '[\n\n- a\n\n  ### x'],
    [LIST, { br: { isSelfClosing: false, exit: ']' } }, '- a\n\n  ### x\n\n]'],
    [LIST, { br: { isSelfClosing: false, enter: '**', exit: '**' } }, '**\n\n- a\n\n  ### x\n\n**'],
    ['<img src="/i"><ul><li>a<h3>x</h3></li></ul>', { img: { isSelfClosing: false, enter: '<', exit: '>' } }, '<\n\n- a\n\n  ### x\n\n>'],
    // A heading the open void wraps directly still stays inline.
    ['<ul><li>a<br><h3>x</h3></br>b</li></ul>', { br: { isSelfClosing: false, enter: '[', exit: ']' } }, '- a[### x]b'],
  ])('keeps the list item heading of %s with %j', async (html, tagOverrides, expected) => {
    expect(htmlToMarkdown(html, { tagOverrides })).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let i = 0; i < html.length; i += width)
            controller.enqueue(html.slice(i, i + width))
          controller.close()
        },
      })
      let streamed = ''
      for await (const chunk of streamHtmlToMarkdown(input, { tagOverrides }))
        streamed += chunk
      expect(streamed, `width ${width}`).toBe(expected)
    }
  })
})
