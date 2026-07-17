import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'

describe('end tag recovery', () => {
  it('treats a trailing solidus as an end-tag name delimiter', () => {
    expect(htmlToMarkdown('<p><strong>x</strong/>y</p>')).toBe('**x**y')
  })
})
