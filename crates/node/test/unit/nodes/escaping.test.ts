// <h1>1. Hello world</h1>

import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../index.js'

describe('escaping', () => {
  it('bold & Italic: Supports bold and italic—even within single words.', () => {
    expect(htmlToMarkdown('<h1>1. Hello world</h1>')).toBe('# 1. Hello world')
  })
})
