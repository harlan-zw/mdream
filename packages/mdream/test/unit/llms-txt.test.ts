import type { ProcessedFile } from '../../src/llms-txt.ts'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateLlmsTxtArtifacts } from '../../src/llms-txt.ts'

const testDir = join(tmpdir(), 'mdream-llms-txt-test')

// Helper to create test HTML files
async function createTestFiles() {
  await mkdir(testDir, { recursive: true })

  // Create a home page
  await writeFile(join(testDir, 'index.html'), `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Site - Home</title>
      <meta name="description" content="This is a test site for mdream">
      <meta name="author" content="Test Author">
    </head>
    <body>
      <h1>Welcome to Test Site</h1>
      <p>This is the home page content.</p>
    </body>
    </html>
  `)

  // Create an about page
  await writeFile(join(testDir, 'about.html'), `
    <!DOCTYPE html>
    <html>
    <head>
      <title>About Us - Test Site</title>
      <meta name="description" content="Learn about our test site">
    </head>
    <body>
      <h1>About Us</h1>
      <p>This is the about page content.</p>
    </body>
    </html>
  `)

  // Create a subdirectory with a page
  await mkdir(join(testDir, 'blog'), { recursive: true })
  await writeFile(join(testDir, 'blog', 'post1.html'), `
    <!DOCTYPE html>
    <html>
    <head>
      <title>First Blog Post</title>
      <meta name="description" content="Our first blog post">
    </head>
    <body>
      <h1>First Blog Post</h1>
      <p>This is our first blog post content.</p>
    </body>
    </html>
  `)
}

// Cleanup
async function cleanup() {
  try {
    await rm(testDir, { recursive: true, force: true })
  }
  catch {
    // Ignore errors
  }
}

it('should generate llms.txt from HTML files', async () => {
  await createTestFiles()

  const result = await generateLlmsTxtArtifacts({
    patterns: join(testDir, '**/*.html'),
    siteName: 'Test Site',
    description: 'A test site for mdream',
    origin: 'https://example.com',
  })

  expect(result.processedFiles).toHaveLength(3)

  const homePage = result.processedFiles.find(f => f.title === 'Test Site - Home')
  expect(homePage).toBeDefined()
  expect(homePage?.url).toBe('/')
  expect(homePage?.metadata?.description).toBe('This is a test site for mdream')
  expect(homePage?.metadata?.author).toBe('Test Author')

  expect(result.llmsTxt).toContain('# Test Site')
  expect(result.llmsTxt).toContain('> A test site for mdream')
  expect(result.llmsTxt).toContain('## Pages')

  await cleanup()
})

it('should generate llms-full.txt when requested', async () => {
  await createTestFiles()

  const result = await generateLlmsTxtArtifacts({
    patterns: join(testDir, '**/*.html'),
    siteName: 'Test Site',
    description: 'A test site for mdream',
    origin: 'https://example.com',
    generateFull: true,
  })

  expect(result.llmsFullTxt).toBeDefined()
  expect(result.llmsFullTxt).toContain('# Test Site')
  expect(result.llmsFullTxt).toContain('> A test site for mdream')
  expect(result.llmsFullTxt).toContain('## Table of Contents')
  expect(result.llmsFullTxt).toContain('title: Test Site - Home')
  expect(result.llmsFullTxt).toContain('url: https://example.com/')
  expect(result.llmsFullTxt).toContain('# Welcome to Test Site')

  await cleanup()
})

it('should generate individual markdown files when requested', async () => {
  await createTestFiles()

  const result = await generateLlmsTxtArtifacts({
    patterns: join(testDir, '**/*.html'),
    siteName: 'Test Site',
    generateMarkdown: true,
  })

  expect(result.markdownFiles).toBeDefined()
  expect(result.markdownFiles).toHaveLength(3)

  const indexFile = result.markdownFiles?.find(f => f.path === 'md/index.md')
  const aboutFile = result.markdownFiles?.find(f => f.path === 'md/about.md')

  expect(indexFile).toBeDefined()
  expect(indexFile?.content).toContain('# Welcome to Test Site')
  expect(aboutFile).toBeDefined()
  expect(aboutFile?.content).toContain('# About Us')

  await cleanup()
})

it('should handle multiple glob patterns', async () => {
  await createTestFiles()

  const result = await generateLlmsTxtArtifacts({
    patterns: [
      join(testDir, '*.html'),
      join(testDir, 'blog/*.html'),
    ],
    siteName: 'Test Site',
  })

  expect(result.processedFiles).toHaveLength(3)
  expect(result.processedFiles.find(f => f.title === 'Test Site - Home')).toBeDefined()
  expect(result.processedFiles.find(f => f.title === 'About Us - Test Site')).toBeDefined()
  expect(result.processedFiles.find(f => f.title === 'First Blog Post')).toBeDefined()

  await cleanup()
})

it('should handle files without metadata gracefully', async () => {
  await mkdir(testDir, { recursive: true })

  await writeFile(join(testDir, 'minimal.html'), `
    <!DOCTYPE html>
    <html>
    <body>
      <h1>Minimal Page</h1>
      <p>Just content, no metadata.</p>
    </body>
    </html>
  `)

  const result = await generateLlmsTxtArtifacts({
    patterns: join(testDir, '*.html'),
    siteName: 'Test Site',
  })

  expect(result.processedFiles).toHaveLength(1)
  expect(result.processedFiles[0].title).toBe('minimal') // fallback to filename
  expect(result.processedFiles[0].metadata?.description).toBeUndefined()

  await cleanup()
})

it('should work with pre-processed files', async () => {
  const processedFiles: ProcessedFile[] = [
    {
      title: 'Home Page',
      content: '# Welcome\n\nThis is the home page.',
      url: '/',
      metadata: {
        title: 'Home Page',
        description: 'Welcome to our site',
      },
    },
    {
      title: 'About Page',
      content: '# About\n\nAbout our company.',
      url: '/about',
      metadata: {
        title: 'About Page',
        description: 'Learn about us',
      },
    },
  ]

  const result = await generateLlmsTxtArtifacts({
    files: processedFiles,
    siteName: 'Test Site',
    description: 'A test site',
    generateFull: true,
  })

  expect(result.processedFiles).toHaveLength(2)
  expect(result.llmsTxt).toContain('# Test Site')
  expect(result.llmsTxt).toContain('> A test site')
  expect(result.llmsTxt).toContain('[Home Page](/)')
  expect(result.llmsTxt).toContain('[About Page](/about)')

  expect(result.llmsFullTxt).toBeDefined()
  expect(result.llmsFullTxt).toContain('## Table of Contents')
  expect(result.llmsFullTxt).toContain('# Welcome')
  expect(result.llmsFullTxt).toContain('# About')
})

describe('llms-txt frontmatter handling', () => {
  it('should prepend metadata to existing frontmatter', async () => {
    const filesWithFrontmatter: ProcessedFile[] = [{
      title: 'Test Page',
      content: `---
existingKey: existingValue
tags: test, sample
---

# Content

This is the main content of the page.`,
      url: '/test-page',
      metadata: {
        description: 'A test page with frontmatter',
        author: 'Test Author',
      },
    }]

    const result = await generateLlmsTxtArtifacts({
      files: filesWithFrontmatter,
      siteName: 'Test Site',
      origin: 'https://example.com',
      generateFull: true,
    })

    expect(result.llmsFullTxt).toBeDefined()
    expect(result.llmsFullTxt).toContain('---')
    expect(result.llmsFullTxt).toContain('title: Test Page')
    expect(result.llmsFullTxt).toContain('url: https://example.com/test-page')
    expect(result.llmsFullTxt).toContain('existingKey: existingValue')
    expect(result.llmsFullTxt).toContain('tags: test, sample')
    expect(result.llmsFullTxt).toContain('description: A test page with frontmatter')
    expect(result.llmsFullTxt).toContain('author: Test Author')
    expect(result.llmsFullTxt).toContain('# Content')
  })

  it('should add frontmatter to content without existing frontmatter', async () => {
    const filesWithoutFrontmatter: ProcessedFile[] = [{
      title: 'Simple Page',
      content: `# Simple Content

This page has no frontmatter.`,
      url: '/simple-page',
    }]

    const result = await generateLlmsTxtArtifacts({
      files: filesWithoutFrontmatter,
      siteName: 'Test Site',
      origin: 'https://example.com',
      generateFull: true,
    })

    expect(result.llmsFullTxt).toBeDefined()
    // Should now always have frontmatter with title and url
    expect(result.llmsFullTxt).toContain('---')
    expect(result.llmsFullTxt).toContain('title: Simple Page')
    expect(result.llmsFullTxt).toContain('url: https://example.com/simple-page')
    expect(result.llmsFullTxt).toContain('# Simple Content')
    // Should not have section header
    expect(result.llmsFullTxt).not.toContain('## Simple Page')
  })

  it('should handle files with file paths and outputDir', async () => {
    const filesWithPaths: ProcessedFile[] = [{
      title: 'File Page',
      filePath: '/home/user/output/md/page.md',
      content: `---
category: documentation
---

# Documentation Page`,
      url: '/docs/page',
    }]

    const result = await generateLlmsTxtArtifacts({
      files: filesWithPaths,
      siteName: 'Test Site',
      origin: 'https://example.com',
      outputDir: '/home/user/output',
      generateFull: true,
    })

    expect(result.llmsFullTxt).toBeDefined()
    expect(result.llmsFullTxt).toContain('file: md/page.md')
    expect(result.llmsFullTxt).toContain('category: documentation')
  })

  it('should merge metadata correctly with existing frontmatter', async () => {
    const filesWithConflict: ProcessedFile[] = [{
      title: 'Conflict Test',
      content: `---
title: Original Title
url: /old-url
custom: value
---

Content here`,
      url: '/new-url',
      metadata: {
        description: 'New description',
      },
    }]

    const result = await generateLlmsTxtArtifacts({
      files: filesWithConflict,
      siteName: 'Test Site',
      origin: 'https://example.com',
      generateFull: true,
    })

    expect(result.llmsFullTxt).toBeDefined()
    // New metadata should be prepended, existing should be preserved
    expect(result.llmsFullTxt).toContain('title: Conflict Test')
    expect(result.llmsFullTxt).toContain('url: https://example.com/new-url')
    expect(result.llmsFullTxt).toContain('description: New description')
    expect(result.llmsFullTxt).toContain('custom: value')
    // Original values that conflict should be overwritten
    expect(result.llmsFullTxt).not.toContain('title: Original Title')
    expect(result.llmsFullTxt).not.toContain('url: /old-url')
  })
})
