import type { ExtractedElement, MdreamOptions } from 'mdream'
import { htmlToMarkdown } from 'mdream'
import { describe, expect, it } from 'vitest'
import { createConfigHookOptions, withPageMetadata } from '../../src/runtime/server/conversion-options'

type Handler = (element: ExtractedElement) => void
type ConfigHook = (options: MdreamOptions) => void

const HTML = '<html><head><title>Page title</title><meta name="description" content="Page description"></head><body><h1>Heading</h1><p>Body</p></body></html>'

// The same sequence as the middleware: assemble, run the `mdream:config` hook, add metadata, convert.
function convertPage(hook: ConfigHook) {
  const hookOptions = createConfigHookOptions('https://example.com', {})
  hook(hookOptions)
  const { options, metadata } = withPageMetadata(hookOptions)
  const markdown = htmlToMarkdown(HTML, options)
  return { markdown, metadata }
}

describe('page metadata extraction', () => {
  it.each<[string, (options: MdreamOptions, onHeading: Handler) => void]>([
    ['replaces extraction', (options, onHeading) => { options.extraction = { h1: onHeading } }],
    ['adds to extraction', (options, onHeading) => { options.extraction!.h1 = onHeading }],
    ['spreads extraction', (options, onHeading) => { options.extraction = { ...options.extraction, h1: onHeading } }],
  ])('keeps the title and description when the hook %s', (_, hook) => {
    const headings: string[] = []
    const onHeading: Handler = (el) => {
      headings.push(el.textContent)
    }

    const { metadata } = convertPage(options => hook(options, onHeading))

    expect(metadata).toEqual({ title: 'Page title', description: 'Page description' })
    expect(headings).toEqual(['Heading'])
  })

  it('runs the hook handlers for the title and description selectors too', () => {
    const seen: string[] = []

    const { metadata } = convertPage((options) => {
      options.extraction = {
        'title': (el) => { seen.push(`title:${el.textContent}`) },
        'meta[name="description"]': (el) => { seen.push(`description:${el.attributes.content}`) },
      }
    })

    expect(metadata).toEqual({ title: 'Page title', description: 'Page description' })
    expect(seen.sort()).toEqual(['description:Page description', 'title:Page title'])
  })

  it('applies the options that the hook sets', () => {
    const { markdown } = convertPage((options) => {
      options.filter = { exclude: ['p'] }
    })

    expect(markdown).toBe('# Heading')
  })
})
