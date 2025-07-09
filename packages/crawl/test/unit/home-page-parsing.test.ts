import type { CrawlResult } from '../../src/types.ts'
import { expect, it } from 'vitest'
import { generateLlmsTxtContent } from '../../src/llms-txt.ts'

it('should use home page title as site name when available', () => {
  const homePageResult: CrawlResult = {
    url: 'https://example.com',
    title: 'Example Site - Official Homepage',
    content: '# Welcome to Example Site',
    filePath: '/output/md/index.md',
    timestamp: Date.now(),
    success: true,
    metadata: {
      title: 'Example Site - Official Homepage',
      description: 'This is the official homepage description',
    },
  }

  const otherPageResult: CrawlResult = {
    url: 'https://example.com/about',
    title: 'About Us',
    content: '# About Us',
    filePath: '/output/md/about.md',
    timestamp: Date.now(),
    success: true,
    metadata: {
      title: 'About Us',
      description: 'About page description',
    },
  }

  const content = generateLlmsTxtContent({
    siteName: homePageResult.metadata?.title || 'example.com',
    description: homePageResult.metadata?.description,
    results: [homePageResult, otherPageResult],
  })

  expect(content).toContain('# Example Site - Official Homepage')
  expect(content).toContain('> This is the official homepage description')
  expect(content).toContain('- [Example Site - Official Homepage](md/index.md): https://example.com')
  expect(content).toContain('- [About Us](md/about.md): https://example.com/about')
})

it('should fallback to hostname when home page title is not available', () => {
  const homePageResult: CrawlResult = {
    url: 'https://example.com',
    title: 'https://example.com/', // fallback from URL pathname
    content: '# Welcome',
    filePath: '/output/md/index.md',
    timestamp: Date.now(),
    success: true,
    metadata: {
      title: 'https://example.com/',
      description: 'Home page description',
    },
  }

  const content = generateLlmsTxtContent({
    siteName: 'example.com', // fallback to hostname
    description: homePageResult.metadata?.description,
    results: [homePageResult],
  })

  expect(content).toContain('# example.com')
  expect(content).toContain('> Home page description')
})

it('should prioritize home page description over other pages', () => {
  const homePageResult: CrawlResult = {
    url: 'https://example.com',
    title: 'Example Site',
    content: '# Welcome',
    filePath: '/output/md/index.md',
    timestamp: Date.now(),
    success: true,
    metadata: {
      title: 'Example Site',
      description: 'Official home page description',
    },
  }

  const otherPageResult: CrawlResult = {
    url: 'https://example.com/about',
    title: 'About Us',
    content: '# About Us',
    filePath: '/output/md/about.md',
    timestamp: Date.now(),
    success: true,
    metadata: {
      title: 'About Us',
      description: 'Some other page description',
    },
  }

  const content = generateLlmsTxtContent({
    siteName: homePageResult.metadata?.title || 'example.com',
    description: homePageResult.metadata?.description,
    results: [otherPageResult, homePageResult], // home page not first in results
  })

  expect(content).toContain('# Example Site')
  expect(content).toContain('> Official home page description')
})

it('should handle missing home page metadata gracefully', () => {
  const homePageResult: CrawlResult = {
    url: 'https://example.com',
    title: 'example.com',
    content: '# Welcome',
    filePath: '/output/md/index.md',
    timestamp: Date.now(),
    success: true,
    metadata: {
      title: 'example.com',
      // no description
    },
  }

  const otherPageResult: CrawlResult = {
    url: 'https://example.com/about',
    title: 'About Us',
    content: '# About Us',
    filePath: '/output/md/about.md',
    timestamp: Date.now(),
    success: true,
    metadata: {
      title: 'About Us',
      description: 'Fallback description from other page',
    },
  }

  const content = generateLlmsTxtContent({
    siteName: homePageResult.metadata?.title || 'example.com',
    description: homePageResult.metadata?.description || otherPageResult.metadata?.description,
    results: [homePageResult, otherPageResult],
  })

  expect(content).toContain('# example.com')
  expect(content).toContain('> Fallback description from other page')
})
