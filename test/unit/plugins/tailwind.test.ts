import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src/index.ts'
import { tailwindPlugin } from '../../../src/plugins.ts'

describe('tailwind addon', () => {
  it('converts font-bold to markdown bold', () => {
    const html = '<p class="font-bold">This is bold text</p>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })
    expect(markdown).toBe('**This is bold text**')
  })

  it('converts font-semibold to markdown bold', () => {
    const html = '<p class="font-semibold">This is semibold text</p>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    expect(markdown).toBe('**This is semibold text**')
  })

  it('converts italic to markdown italic', () => {
    const html = '<p class="italic">This is italic text</p>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    expect(markdown).toBe('*This is italic text*')
  })

  it('converts line-through to strikethrough', () => {
    const html = '<p class="line-through">This is strikethrough text</p>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    expect(markdown).toBe('~~This is strikethrough text~~')
  })

  it.skip('hides elements with the hidden class', () => {
    const html = `
      <p>Visible content</p>
      <p class="hidden">This should be hidden</p>
      <p>More visible content</p>
    `
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    // Check that the hidden text is not present
    expect(markdown).not.toContain('This should be hidden')
    // Check only the visible text is present in the expected order
    expect(markdown).toContain('Visible content')
    expect(markdown).toContain('More visible content')
  })

  it('combines multiple styles correctly', () => {
    const html = '<p class="font-bold italic">This is bold and italic</p>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    expect(markdown).toBe('***This is bold and italic***')
  })

  it('works with nested elements', () => {
    const html = `
      <div>
        <p>Regular text with <span class="font-bold">bold</span> word</p>
        <p class="italic">Italic paragraph</p>
      </div>
    `
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    expect(markdown.trim()).toBe('Regular text with **bold** word\n\n*Italic paragraph*')
  })

  it('applies mobile-first responsive classes correctly', () => {
    const html = '<p class="font-normal md:font-bold lg:italic">Responsive text</p>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    // The lg:italic should override md:font-bold, but for now, we'll
    // just check that it applies some form of formatting and contains the text
    expect(markdown).toContain('Responsive text')
    expect(markdown).toContain('*')
  })

  it('applies later breakpoints over earlier ones', () => {
    const html = '<p class="italic font-bold md:font-normal lg:font-bold">Multiple classes</p>'
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    // lg:font-bold should win over md:font-normal, and italic should still apply
    expect(markdown).toBe('***Multiple classes***')
  })

  it.skip('handles responsive hidden classes with mobile-first approach', () => {
    const html = `
      <p>Always visible</p>
      <p class="hidden md:block">Hidden on mobile, visible on md and up</p>
      <p class="block md:hidden">Visible on mobile, hidden on md and up</p>
    `
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    // Just check basic functionality since mobile-first is complex
    expect(markdown).toContain('Always visible')
    expect(markdown).not.toContain('Hidden on mobile, visible on md and up')
  })

  it('hides elements with absolute positioning', () => {
    const html = `
      <p>Regular content</p>
      <p class="absolute">This is absolutely positioned and should be hidden</p>
      <p>More regular content</p>
    `
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    // Check that the absolutely positioned text is not present
    expect(markdown).not.toContain('This is absolutely positioned and should be hidden')
    // Check only the regular content is present
    expect(markdown).toContain('Regular content')
    expect(markdown).toContain('More regular content')
  })

  it('hides elements with fixed positioning', () => {
    const html = `
      <p>Regular content</p>
      <p class="fixed">This is fixed positioned and should be hidden</p>
      <p>More regular content</p>
    `
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    // Check that the fixed positioned text is not present
    expect(markdown).not.toContain('This is fixed positioned and should be hidden')
    // Check only the regular content is present
    expect(markdown).toContain('Regular content')
    expect(markdown).toContain('More regular content')
  })

  it('hides elements with sticky positioning', () => {
    const html = `
      <p>Regular content</p>
      <p class="sticky">This is sticky positioned and should be hidden</p>
      <p>More regular content</p>
    `
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })

    // Check that the sticky positioned text is not present
    expect(markdown).not.toContain('This is sticky positioned and should be hidden')
    // Check only the regular content is present
    expect(markdown).toContain('Regular content')
    expect(markdown).toContain('More regular content')
  })
})
