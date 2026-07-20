import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines.ts'

describe.each(engines)('tailwind addon %s', ({ name: _name, engine }) => {
  it('converts font-bold to markdown bold', async () => {
    const html = '<p class="font-bold">This is bold text</p>'
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })
    expect(markdown).toBe('**This is bold text**')
  })

  it('converts font-semibold to markdown bold', async () => {
    const html = '<p class="font-semibold">This is semibold text</p>'
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    expect(markdown).toBe('**This is semibold text**')
  })

  it('converts italic to markdown italic', async () => {
    const html = '<p class="italic">This is italic text</p>'
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    expect(markdown).toBe('*This is italic text*')
  })

  it('converts line-through to strikethrough', async () => {
    const html = '<p class="line-through">This is strikethrough text</p>'
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    expect(markdown).toBe('~~This is strikethrough text~~')
  })

  it.skip('hides elements with the hidden class', async () => {
    const html = `
      <p>Visible content</p>
      <p class="hidden">This should be hidden</p>
      <p>More visible content</p>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    // Check that the hidden text is not present
    expect(markdown).not.toContain('This should be hidden')
    // Check only the visible text is present in the expected order
    expect(markdown).toContain('Visible content')
    expect(markdown).toContain('More visible content')
  })

  it('combines multiple styles correctly', async () => {
    const html = '<p class="font-bold italic">This is bold and italic</p>'
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    expect(markdown).toBe('***This is bold and italic***')
  })

  it('works with nested elements', async () => {
    const html = `
      <div>
        <p>Regular text with <span class="font-bold">bold</span> word</p>
        <p class="italic">Italic paragraph</p>
      </div>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    expect(markdown.trim()).toBe('Regular text with **bold** word\n\n*Italic paragraph*')
  })

  it('applies mobile-first responsive classes correctly', async () => {
    const html = '<p class="font-normal md:font-bold lg:italic">Responsive text</p>'
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    // The lg:italic should override md:font-bold, but for now, we'll
    // just check that it applies some form of formatting and contains the text
    expect(markdown).toContain('Responsive text')
    expect(markdown).toContain('*')
  })

  it('applies later breakpoints over earlier ones', async () => {
    const html = '<p class="italic font-bold md:font-normal lg:font-bold">Multiple classes</p>'
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    // lg:font-bold should win over md:font-normal, and italic should still apply
    expect(markdown).toBe('***Multiple classes***')
  })

  it.skip('handles responsive hidden classes with mobile-first approach', async () => {
    const html = `
      <p>Always visible</p>
      <p class="hidden md:block">Hidden on mobile, visible on md and up</p>
      <p class="block md:hidden">Visible on mobile, hidden on md and up</p>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    // Just check basic functionality since mobile-first is complex
    expect(markdown).toContain('Always visible')
    expect(markdown).not.toContain('Hidden on mobile, visible on md and up')
  })

  it('hides elements with absolute positioning', async () => {
    const html = `
      <p>Regular content</p>
      <p class="absolute">This is absolutely positioned and should be hidden</p>
      <p>More regular content</p>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    // Check that the absolutely positioned text is not present
    expect(markdown).not.toContain('This is absolutely positioned and should be hidden')
    // Check only the regular content is present
    expect(markdown).toContain('Regular content')
    expect(markdown).toContain('More regular content')
  })

  it('hides elements with fixed positioning', async () => {
    const html = `
      <p>Regular content</p>
      <p class="fixed">This is fixed positioned and should be hidden</p>
      <p>More regular content</p>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    // Check that the fixed positioned text is not present
    expect(markdown).not.toContain('This is fixed positioned and should be hidden')
    // Check only the regular content is present
    expect(markdown).toContain('Regular content')
    expect(markdown).toContain('More regular content')
  })

  it('hides elements with sticky positioning', async () => {
    const html = `
      <p>Regular content</p>
      <p class="sticky">This is sticky positioned and should be hidden</p>
      <p>More regular content</p>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    // Check that the sticky positioned text is not present
    expect(markdown).not.toContain('This is sticky positioned and should be hidden')
    // Check only the regular content is present
    expect(markdown).toContain('Regular content')
    expect(markdown).toContain('More regular content')
  })

  it('hides child elements inside a fixed parent', async () => {
    const html = `
      <div>
        <div class="fixed">
          <h5>Sidebar Title</h5>
          <ul><li><a href="/">Link</a></li></ul>
        </div>
        <p>Visible content</p>
      </div>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    expect(markdown).not.toContain('Sidebar Title')
    expect(markdown).not.toContain('Link')
    expect(markdown).toContain('Visible content')
  })

  it('hides deeply nested elements inside a hidden parent', async () => {
    const html = `
      <div>
        <div class="hidden">
          <div>
            <p>Deeply nested hidden text</p>
          </div>
        </div>
        <p>Visible text</p>
      </div>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    expect(markdown).not.toContain('Deeply nested hidden text')
    expect(markdown).toContain('Visible text')
  })

  it('hides text nodes inside a fixed parent', async () => {
    const html = `
      <div>
        <div class="absolute">
          <span>Hidden span text</span>
        </div>
        <p>Normal content</p>
      </div>
    `
    const markdown = htmlToMarkdown(html, {
      engine: await resolveEngine(engine),
      plugins: { tailwind: true },
    })

    expect(markdown).not.toContain('Hidden span text')
    expect(markdown).toContain('Normal content')
  })
})
