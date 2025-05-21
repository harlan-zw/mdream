// <h1>1. Hello world</h1>

import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src/index.js'

describe('escaping', () => {
  it('bold & Italic: Supports bold and italic—even within single words.', () => {
    expect(syncHtmlToMarkdown('<h1>1. Hello world</h1>')).toBe('# 1. Hello world')
  })
})
