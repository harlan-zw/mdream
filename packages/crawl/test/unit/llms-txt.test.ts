import type { CrawlResult } from '../../src/types.ts'
import { expect, it } from 'vitest'
import { generateLlmsTxtContent } from '../../src/llms-txt.ts'

it('generateLlmsTxtContent creates basic structure', () => {
  const results: CrawlResult[] = [
    {
      url: 'https://example.com/page1',
      title: 'Page 1',
      content: '# Page 1\n\nContent here',
      filePath: '/output/md/page1.md',
      timestamp: Date.now(),
      success: true,
    },
    {
      url: 'https://example.com/page2',
      title: 'Page 2',
      content: '# Page 2\n\nMore content',
      filePath: '/output/md/page2.md',
      timestamp: Date.now(),
      success: true,
    },
  ]

  const content = generateLlmsTxtContent({
    siteName: 'Example Site',
    description: 'This is a test site',
    results,
  })

  expect(content).toContain('# Example Site')
  expect(content).toContain('> This is a test site')
  expect(content).toContain('## Pages')
  expect(content).toContain('- [Page 1](./md/page1.md): https://example.com/page1')
  expect(content).toContain('- [Page 2](./md/page2.md): https://example.com/page2')
})

it('generateLlmsTxtContent works without description', () => {
  const results: CrawlResult[] = [
    {
      url: 'https://example.com/page1',
      title: 'Page 1',
      content: '# Page 1\n\nContent here',
      filePath: '/output/md/page1.md',
      timestamp: Date.now(),
      success: true,
    },
  ]

  const content = generateLlmsTxtContent({
    siteName: 'Example Site',
    results,
  })

  expect(content).toContain('# Example Site')
  expect(content).not.toContain('>')
  expect(content).toContain('## Pages')
  expect(content).toContain('- [Page 1](./md/page1.md): https://example.com/page1')
})

it('generateLlmsTxtContent handles empty results', () => {
  const content = generateLlmsTxtContent({
    siteName: 'Empty Site',
    results: [],
  })

  expect(content).toContain('# Empty Site')
  expect(content).not.toContain('## Pages')
})

it('generateLlmsTxtContent fallback to URLs when no local files', () => {
  const results: CrawlResult[] = [
    {
      url: 'https://example.com/page1',
      title: 'Page 1',
      content: '# Page 1\n\nContent here',
      filePath: '', // No local file
      timestamp: Date.now(),
      success: true,
      metadata: {
        description: 'This is page 1 with a very long description that should be truncated',
      },
    },
    {
      url: 'https://example.com/page2',
      title: 'Page 2',
      content: '# Page 2\n\nMore content',
      filePath: undefined, // No local file
      timestamp: Date.now(),
      success: true,
    },
  ]

  const content = generateLlmsTxtContent({
    siteName: 'Example Site',
    results,
  })

  expect(content).toContain('# Example Site')
  expect(content).toContain('## Pages')
  expect(content).toContain('- [Page 1](https://example.com/page1): This is page 1 with a very long description that should be truncated')
  expect(content).toContain('- [Page 2](https://example.com/page2)')
  expect(content).not.toContain('md/')
})
