import {describe, expect, it} from "vitest";
import {htmlToMarkdown} from "../../src/index.js";

describe('horizontal Rules', () => {
  it('converts hr elements', async () => {
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })
})
