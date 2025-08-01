import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.js'

describe('h1', () => {
  // <h1>1. Hello world</h1>
  it('avoids rendering as list', () => {
    const html = '<h1>1. Hello world</h1>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('# 1. Hello world')
  })
})
