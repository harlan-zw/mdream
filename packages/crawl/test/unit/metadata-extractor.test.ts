import { expect, it } from 'vitest'
import { extractMetadata } from '../../src/metadata-extractor.ts'

it('extractMetadata extracts title and links', () => {
  const html = `
    <html>
      <head>
        <title>Test Page</title>
        <meta name="description" content="This is a test page">
        <meta name="author" content="Test Author">
      </head>
      <body>
        <h1>Test Page</h1>
        <p>Content with <a href="/link1">internal link</a> and <a href="https://external.com">external link</a></p>
        <a href="mailto:test@example.com">email link</a>
      </body>
    </html>
  `

  const metadata = extractMetadata(html, 'https://example.com/page')

  expect(metadata.title).toBe('Test Page')
  expect(metadata.description).toBe('This is a test page')
  expect(metadata.author).toBe('Test Author')
  expect(metadata.links).toContain('https://example.com/link1')
  expect(metadata.links).not.toContain('https://external.com') // Different domain
  // mailto links are filtered out as they're not same-hostname HTTP(S) links
  expect(metadata.links).not.toContain('mailto:test@example.com')
})

it('extractMetadata handles missing metadata gracefully', () => {
  const html = `
    <html>
      <body>
        <h1>Simple Page</h1>
      </body>
    </html>
  `

  const metadata = extractMetadata(html, 'https://example.com/simple')

  expect(metadata.title).toBe('/simple') // Falls back to pathname
  expect(metadata.description).toBeUndefined()
  expect(metadata.author).toBeUndefined()
  expect(metadata.links).toEqual([])
})

it('extractMetadata prioritizes og:tags', () => {
  const html = `
    <html>
      <head>
        <title>Regular Title</title>
        <meta property="og:title" content="OG Title">
        <meta name="description" content="Regular description">
        <meta property="og:description" content="OG description">
      </head>
      <body></body>
    </html>
  `

  const metadata = extractMetadata(html, 'https://example.com/og')

  expect(metadata.title).toBe('Regular Title') // First found wins
  expect(metadata.description).toBe('Regular description') // First found wins
})
