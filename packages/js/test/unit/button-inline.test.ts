import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'

// <button> is inline but previously inherited block-default spacing, so it
// injected a paragraph break that stranded trailing text/punctuation and split
// adjacent buttons across lines (issue #133). Mirrors the Rust engine's
// `adjacent_buttons_stay_inline` regression.

describe('<button> inline spacing', () => {
  it('keeps adjacent buttons on one line', () => {
    expect(htmlToMarkdown('<button>One</button><button>Two</button>')).toBe('OneTwo')
  })

  it('does not strand trailing punctuation', () => {
    expect(htmlToMarkdown('<p>Click <button>Go</button>!</p>')).toBe('Click Go!')
  })
})
