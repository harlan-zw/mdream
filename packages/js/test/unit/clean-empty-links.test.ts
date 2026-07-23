import { describe, expect, it } from 'vitest'
import { cleanEmptyLinks } from '../../src/clean'
import { htmlToMarkdown } from '../../src/index'

const executableHrefs = [
  'JavaScript:void(0)',
  'DATA:text/html,payload',
  'VbScRiPt:msgbox(1)',
]

describe('clean.emptyLinks executable schemes', () => {
  it.each(executableHrefs)('strips %s while serializing', (href) => {
    expect(htmlToMarkdown(`<a href="${href}">Click</a>`, {
      clean: { emptyLinks: true },
    })).toBe('Click')
  })

  it.each(executableHrefs)('strips %s during post-processing', (href) => {
    expect(cleanEmptyLinks(`[Click](${href})`)).toBe('Click')
  })
})
