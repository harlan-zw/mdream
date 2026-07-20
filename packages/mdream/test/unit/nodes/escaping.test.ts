// <h1>1. Hello world</h1>

import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('escaping $name', (engineConfig) => {
  it('bold & Italic: Supports bold and italic—even within single words.', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<h1>1. Hello world</h1>', { engine })).toBe('# 1. Hello world')
  })
})
