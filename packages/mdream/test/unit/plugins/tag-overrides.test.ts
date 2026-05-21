import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('tagOverrides $name', (engineConfig) => {
  it('overrides enter/exit strings for existing tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p><strong>bold</strong></p>', {
      plugins: {
        tagOverrides: {
          strong: { enter: '__', exit: '__' },
        },
      },
      engine,
    })
    expect(markdown).toBe('__bold__')
  })

  it('aliases custom element to known tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p><x-heading>content</x-heading></p>', {
      plugins: {
        tagOverrides: {
          'x-heading': 'h2',
        },
      },
      engine,
    })
    expect(markdown).toBe('## content')
  })

  it('overrides spacing on a block element', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<div>first</div><div>second</div>', {
      plugins: {
        tagOverrides: {
          div: { spacing: [1, 1] },
        },
      },
      engine,
    })
    expect(markdown).toBe('first\nsecond')
  })

  it('makes a block element inline', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>before <span>middle</span> after</p>', {
      plugins: {
        tagOverrides: {
          span: { isInline: false, spacing: [2, 2] },
        },
      },
      engine,
    })
    // span is normally inline — overriding to block should add newlines
    expect(markdown).toContain('before')
    expect(markdown).toContain('middle')
    expect(markdown).toContain('after')
  })

  it('handles custom element with enter/exit', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p><x-note>important</x-note></p>', {
      plugins: {
        tagOverrides: {
          'x-note': { enter: '> **Note:** ', exit: '', isInline: true, spacing: [0, 0], collapsesInnerWhiteSpace: true },
        },
      },
      engine,
    })
    expect(markdown).toBe('> **Note:** important')
  })

  it('aliases unknown tag to em', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p><x-italic>text</x-italic></p>', {
      plugins: {
        tagOverrides: {
          'x-italic': 'em',
        },
      },
      engine,
    })
    expect(markdown).toBe('_text_')
  })

  it('converts sup/sub to extended markdown syntax (issue #93)', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>E = mc<sup>2</sup> and H<sub>2</sub>O</p>', {
      plugins: {
        tagOverrides: {
          sup: { enter: '^', exit: '^' },
          sub: { enter: '~', exit: '~' },
        },
      },
      engine,
    })
    expect(markdown).toBe('E = mc^2^ and H~2~O')
  })

  it('works alongside extraction without interference', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const extracted: string[] = []
    const markdown = htmlToMarkdown('<p><strong>bold</strong><em>italic</em></p>', {
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
    expect(markdown).toBe('__bold___italic_')
    expect(extracted).toEqual(['italic'])
  })

  it('drops CDATA sections by default', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>before<![CDATA[secret payload]]>after</p>', {
      engine,
    })
    expect(markdown).not.toContain('secret payload')
    expect(markdown).toContain('before')
    expect(markdown).toContain('after')
  })

  it('emits CDATA content via #cdata-section enter/exit override', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>a<![CDATA[hidden]]>b</p>', {
      plugins: {
        tagOverrides: {
          '#cdata-section': { enter: '[', exit: ']', isInline: true, spacing: [0, 0] },
        },
      },
      engine,
    })
    expect(markdown).toBe('a[hidden]b')
  })

  it('does not treat <![ conditional comments as CDATA', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<p>x<![if !IE]>y<![endif]>z</p>', {
      engine,
    })
    expect(markdown).toContain('x')
    expect(markdown).toContain('z')
  })

  it('works alongside filter without interference', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown('<div><nav>skip</nav><p><strong>keep</strong></p></div>', {
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
    expect(markdown).toBe('__keep__')
  })
})
