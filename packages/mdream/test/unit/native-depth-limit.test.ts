import { describe, expect, it } from 'vitest'
import {
  htmlToMarkdown,
  htmlToMarkdownChunks,
  MarkdownStream,
} from '../../napi/index.mjs'

const LIMIT = 512
const HARD_LIMIT = 4096

describe('native bounded depth', () => {
  it('exposes structured one-shot errors', () => {
    expect(() => htmlToMarkdown('<div>'.repeat(HARD_LIMIT + 1))).toThrowError(expect.objectContaining({
      _tag: 'ElementDepthLimitExceeded',
      code: 'ELEMENT_DEPTH_LIMIT',
      maxDepth: HARD_LIMIT,
      attemptedDepth: HARD_LIMIT + 1,
    }))
  })

  it('exposes structured splitter errors', () => {
    expect(() => htmlToMarkdownChunks('<div>'.repeat(HARD_LIMIT + 1))).toThrowError(expect.objectContaining({
      _tag: 'ElementDepthLimitExceeded',
      code: 'ELEMENT_DEPTH_LIMIT',
      maxDepth: HARD_LIMIT,
      attemptedDepth: HARD_LIMIT + 1,
    }))
  })

  it('reports compact fallback on result and stream APIs', () => {
    expect(htmlToMarkdown(`${'<div>'.repeat(LIMIT)}<img>`).degraded).toBe(true)

    const stream = new MarkdownStream()
    stream.processChunk(`${'<div>'.repeat(LIMIT)}<img>`)
    expect(stream.degraded).toBe(true)
  })
})
