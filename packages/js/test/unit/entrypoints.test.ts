import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

describe('package entry points', () => {
  it('keeps the full conversion names at the package root', () => {
    expect(htmlToMarkdown).toBeTypeOf('function')
    expect(streamHtmlToMarkdown).toBeTypeOf('function')
  })

  it('retains declarative plugin behavior at the package root', () => {
    expect(htmlToMarkdown('<nav>hidden</nav><p>shown</p>', {
      plugins: { filter: { exclude: ['nav'] } },
    })).toBe('shown')
  })
})
