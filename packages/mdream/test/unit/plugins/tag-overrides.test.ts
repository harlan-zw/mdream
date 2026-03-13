import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('tagOverrides $name', (engineConfig) => {
  it('overrides enter/exit strings for existing tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown('<p><strong>bold</strong></p>', {
      plugins: {
        tagOverrides: {
          strong: { enter: '__', exit: '__' },
        },
      },
      engine,
    })
    expect(result.markdown).toBe('__bold__')
  })

  it('aliases custom element to known tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown('<p><x-heading>content</x-heading></p>', {
      plugins: {
        tagOverrides: {
          'x-heading': 'h2',
        },
      },
      engine,
    })
    expect(result.markdown).toBe('## content')
  })

  it('overrides spacing on a block element', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown('<div>first</div><div>second</div>', {
      plugins: {
        tagOverrides: {
          div: { spacing: [1, 1] },
        },
      },
      engine,
    })
    expect(result.markdown).toBe('first\nsecond')
  })

  it('makes a block element inline', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown('<p>before <span>middle</span> after</p>', {
      plugins: {
        tagOverrides: {
          span: { isInline: false, spacing: [2, 2] },
        },
      },
      engine,
    })
    // span is normally inline — overriding to block should add newlines
    expect(result.markdown).toContain('before')
    expect(result.markdown).toContain('middle')
    expect(result.markdown).toContain('after')
  })

  it('handles custom element with enter/exit', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown('<p><x-note>important</x-note></p>', {
      plugins: {
        tagOverrides: {
          'x-note': { enter: '> **Note:** ', exit: '', isInline: true, spacing: [0, 0], collapsesInnerWhiteSpace: true },
        },
      },
      engine,
    })
    expect(result.markdown).toBe('> **Note:** important')
  })

  it('aliases unknown tag to em', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown('<p><x-italic>text</x-italic></p>', {
      plugins: {
        tagOverrides: {
          'x-italic': 'em',
        },
      },
      engine,
    })
    expect(result.markdown).toBe('_text_')
  })

  it('works alongside extraction without interference', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const extracted: string[] = []
    const result = htmlToMarkdown('<p><strong>bold</strong><em>italic</em></p>', {
      plugins: {
        tagOverrides: {
          strong: { enter: '__', exit: '__' },
        },
        extraction: {
          em: el => extracted.push(el.textContent),
        },
      },
      engine,
    })
    expect(result.markdown).toBe('__bold___italic_')
    expect(extracted).toEqual(['italic'])
  })

  it('works alongside filter without interference', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown('<div><nav>skip</nav><p><strong>keep</strong></p></div>', {
      plugins: {
        tagOverrides: {
          strong: { enter: '__', exit: '__' },
        },
        filter: {
          exclude: ['nav'],
        },
      },
      engine,
    })
    expect(result.markdown).toBe('__keep__')
  })
})
