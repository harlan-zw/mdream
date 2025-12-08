import type { ProcessedFile } from '../../src/llms-txt.ts'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createLlmsTxtStream, generateLlmsTxtArtifacts } from '../../src/llms-txt.ts'

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

it('should support sections and notes in generateLlmsTxtArtifacts', async () => {
  const processedFiles = [
    {
      title: 'Home Page',
      content: '# Welcome\n\nThis is the home page.',
      url: '/',
    },
  ]

  const result = await generateLlmsTxtArtifacts({
    files: processedFiles,
    siteName: 'Test Site',
    sections: [
      {
        title: 'Quick Links',
        description: 'Essential resources',
        links: [
          { title: 'Docs', href: '/docs', description: 'Documentation' },
          { title: 'API', href: '/api' },
        ],
      },
    ],
    notes: ['Note line 1', 'Note line 2'],
    generateFull: true,
  })

  // Check llms.txt
  expect(result.llmsTxt).toContain('## Quick Links')
  expect(result.llmsTxt).toContain('Essential resources')
  expect(result.llmsTxt).toContain('[Docs](/docs): Documentation')
  expect(result.llmsTxt).toContain('[API](/api)')
  expect(result.llmsTxt).toContain('Note line 1')
  expect(result.llmsTxt).toContain('Note line 2')

  // Verify order: sections -> pages -> notes
  const quickLinksIdx = result.llmsTxt.indexOf('## Quick Links')
  const pagesIdx = result.llmsTxt.indexOf('## Pages')
  const noteIdx = result.llmsTxt.indexOf('Note line 1')
  expect(quickLinksIdx).toBeLessThan(pagesIdx)
  expect(pagesIdx).toBeLessThan(noteIdx)

  // Check llms-full.txt
  expect(result.llmsFullTxt).toContain('## Quick Links')
  expect(result.llmsFullTxt).toContain('Note line 1')
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

describe('createLlmsTxtStream', () => {
  const streamTestDir = join(tmpdir(), 'mdream-stream-test')

  it('should write llms.txt to file', async () => {
    await mkdir(streamTestDir, { recursive: true })

    const processedFiles: ProcessedFile[] = [
      {
        title: 'Home Page',
        content: '# Welcome\n\nThis is the home page.',
        url: '/',
        metadata: {
          description: 'Welcome to our site',
        },
      },
      {
        title: 'About Page',
        content: '# About\n\nAbout our company.',
        url: '/about',
        metadata: {
          description: 'Learn about us',
        },
      },
    ]

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      description: 'A test site',
      origin: 'https://example.com',
      outputDir: streamTestDir,
    })

    const writer = stream.getWriter()
    for (const page of processedFiles) {
      await writer.write(page)
    }
    await writer.close()

    const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')

    expect(llmsTxtContent).toContain('# Test Site')
    expect(llmsTxtContent).toContain('> A test site')
    expect(llmsTxtContent).toContain('## Pages')
    expect(llmsTxtContent).toContain('[Home Page](https://example.com/)')
    expect(llmsTxtContent).toContain('[About Page](https://example.com/about)')

    await rm(streamTestDir, { recursive: true, force: true })
  })

  it('should write llms-full.txt to file when generateFull is true', async () => {
    await mkdir(streamTestDir, { recursive: true })

    const processedFiles: ProcessedFile[] = [
      {
        title: 'Test Page',
        content: '# Content\n\nThis is the content.',
        url: '/test',
        metadata: {
          description: 'A test page',
        },
      },
    ]

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      origin: 'https://example.com',
      generateFull: true,
      outputDir: streamTestDir,
    })

    const writer = stream.getWriter()
    for (const page of processedFiles) {
      await writer.write(page)
    }
    await writer.close()

    const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
    const llmsFullTxtContent = await readFile(join(streamTestDir, 'llms-full.txt'), 'utf-8')

    expect(llmsTxtContent).toContain('# Test Site')
    expect(llmsFullTxtContent).toContain('# Test Site')
    expect(llmsFullTxtContent).toContain('title: Test Page')
    expect(llmsFullTxtContent).toContain('url: https://example.com/test')
    expect(llmsFullTxtContent).toContain('description: A test page')
    expect(llmsFullTxtContent).toContain('# Content')

    await rm(streamTestDir, { recursive: true, force: true })
  })

  it('should handle files with frontmatter', async () => {
    await mkdir(streamTestDir, { recursive: true })

    const filesWithFrontmatter: ProcessedFile[] = [{
      title: 'Test Page',
      content: `---
existingKey: existingValue
---

# Content`,
      url: '/test',
      metadata: {
        description: 'A test page',
      },
    }]

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      origin: 'https://example.com',
      generateFull: true,
      outputDir: streamTestDir,
    })

    const writer = stream.getWriter()
    for (const page of filesWithFrontmatter) {
      await writer.write(page)
    }
    await writer.close()

    const llmsFullTxtContent = await readFile(join(streamTestDir, 'llms-full.txt'), 'utf-8')

    expect(llmsFullTxtContent).toContain('title: Test Page')
    expect(llmsFullTxtContent).toContain('url: https://example.com/test')
    expect(llmsFullTxtContent).toContain('existingKey: existingValue')
    expect(llmsFullTxtContent).toContain('description: A test page')

    await rm(streamTestDir, { recursive: true, force: true })
  })

  it('should buffer pages and write sorted on close', async () => {
    await mkdir(streamTestDir, { recursive: true })

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      outputDir: streamTestDir,
    })

    const writer = stream.getWriter()

    await writer.write({ title: 'Page 1', content: '# Page 1', url: '/page1' })

    // Pages are buffered, not written immediately
    let llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
    expect(llmsTxtContent).not.toContain('[Page 1](/page1)')

    await writer.write({ title: 'Page 2', content: '# Page 2', url: '/page2' })
    await writer.close()

    // After close, pages should be written in sorted order
    llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
    expect(llmsTxtContent).toContain('[Page 1](/page1)')
    expect(llmsTxtContent).toContain('[Page 2](/page2)')

    await rm(streamTestDir, { recursive: true, force: true })
  })

  it('should create output directory if it does not exist', async () => {
    const nestedDir = join(streamTestDir, 'nested', 'output', 'dir')

    // Ensure directory doesn't exist
    await rm(streamTestDir, { recursive: true, force: true })

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      outputDir: nestedDir,
    })

    const writer = stream.getWriter()
    await writer.write({ title: 'Page 1', content: '# Page 1', url: '/page1' })
    await writer.close()

    // Verify file was created in the nested directory
    const llmsTxtContent = await readFile(join(nestedDir, 'llms.txt'), 'utf-8')
    expect(llmsTxtContent).toContain('[Page 1](/page1)')

    await rm(streamTestDir, { recursive: true, force: true })
  })

  it('should write config sections before pages', async () => {
    await mkdir(streamTestDir, { recursive: true })

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      description: 'A test site',
      outputDir: streamTestDir,
      sections: [
        {
          title: 'Getting Started',
          description: 'Learn the basics',
          links: [
            { title: 'Installation', href: '/install', description: 'How to install' },
            { title: 'Quick Start', href: '/quickstart' },
          ],
        },
        {
          title: 'API Reference',
          description: ['Complete API documentation', 'For all public APIs'],
          links: [
            { title: 'Core API', href: '/api/core' },
          ],
        },
      ],
    })

    const writer = stream.getWriter()
    await writer.write({ title: 'Page 1', content: '# Page 1', url: '/page1' })
    await writer.close()

    const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')

    // Check sections are present and in order
    expect(llmsTxtContent).toContain('## Getting Started')
    expect(llmsTxtContent).toContain('Learn the basics')
    expect(llmsTxtContent).toContain('[Installation](/install): How to install')
    expect(llmsTxtContent).toContain('[Quick Start](/quickstart)')
    expect(llmsTxtContent).toContain('## API Reference')
    expect(llmsTxtContent).toContain('Complete API documentation')
    expect(llmsTxtContent).toContain('For all public APIs')
    expect(llmsTxtContent).toContain('[Core API](/api/core)')
    expect(llmsTxtContent).toContain('## Pages')
    expect(llmsTxtContent).toContain('[Page 1](/page1)')

    // Verify sections come before pages
    const gettingStartedIdx = llmsTxtContent.indexOf('## Getting Started')
    const pagesIdx = llmsTxtContent.indexOf('## Pages')
    const page1Idx = llmsTxtContent.indexOf('[Page 1]')
    expect(gettingStartedIdx).toBeLessThan(pagesIdx)
    expect(pagesIdx).toBeLessThan(page1Idx)

    await rm(streamTestDir, { recursive: true, force: true })
  })

  it('should write notes at the end without title', async () => {
    await mkdir(streamTestDir, { recursive: true })

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      outputDir: streamTestDir,
      notes: ['This is a note', 'This is another note'],
    })

    const writer = stream.getWriter()
    await writer.write({ title: 'Page 1', content: '# Page 1', url: '/page1' })
    await writer.close()

    const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')

    // Check notes are present
    expect(llmsTxtContent).toContain('This is a note')
    expect(llmsTxtContent).toContain('This is another note')

    // Verify notes come after pages
    const pagesIdx = llmsTxtContent.indexOf('[Page 1]')
    const note1Idx = llmsTxtContent.indexOf('This is a note')
    expect(pagesIdx).toBeLessThan(note1Idx)

    // Verify no "## Notes" title
    expect(llmsTxtContent).not.toContain('## Notes')

    await rm(streamTestDir, { recursive: true, force: true })
  })

  it('should write config to llms-full.txt when generateFull is true', async () => {
    await mkdir(streamTestDir, { recursive: true })

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      outputDir: streamTestDir,
      generateFull: true,
      sections: [
        {
          title: 'Resources',
          links: [{ title: 'Docs', href: '/docs' }],
        },
      ],
      notes: 'Footer note',
    })

    const writer = stream.getWriter()
    await writer.write({ title: 'Page 1', content: '# Page 1', url: '/page1' })
    await writer.close()

    const llmsFullTxtContent = await readFile(join(streamTestDir, 'llms-full.txt'), 'utf-8')

    expect(llmsFullTxtContent).toContain('## Resources')
    expect(llmsFullTxtContent).toContain('[Docs](/docs)')
    expect(llmsFullTxtContent).toContain('Footer note')

    await rm(streamTestDir, { recursive: true, force: true })
  })

  describe('hierarchical sorting and blank lines', () => {
    it('should sort pages hierarchically by path segments', async () => {
      await mkdir(streamTestDir, { recursive: true })

      const processedFiles: ProcessedFile[] = [
        { title: 'API Reference', content: '# API', url: '/api/reference' },
        { title: 'About', content: '# About', url: '/about' },
        { title: 'Home', content: '# Home', url: '/' },
        { title: 'API Core', content: '# Core', url: '/api/core' },
        { title: 'Docs Guide', content: '# Guide', url: '/docs/guide' },
        { title: 'Docs Intro', content: '# Intro', url: '/docs/intro' },
        { title: 'Blog', content: '# Blog', url: '/blog' },
      ]

      const stream = createLlmsTxtStream({
        siteName: 'Test Site',
        outputDir: streamTestDir,
      })

      const writer = stream.getWriter()
      for (const page of processedFiles) {
        await writer.write(page)
      }
      await writer.close()

      const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
      const lines = llmsTxtContent.split('\n').filter(line => line.startsWith('- ['))

      // With new grouping: root-level pages without nesting come first
      // /about and /blog are root-level with no nesting, so grouped with /
      // /api/* and /docs/* have nesting, so separate groups
      // Expected order: /, /about, /blog, /api/core, /api/reference, /docs/guide, /docs/intro
      expect(lines[0]).toContain('Home')
      expect(lines[1]).toContain('About')
      expect(lines[2]).toContain('Blog')
      expect(lines[3]).toContain('API Core')
      expect(lines[4]).toContain('API Reference')
      expect(lines[5]).toContain('Docs Guide')
      expect(lines[6]).toContain('Docs Intro')

      await rm(streamTestDir, { recursive: true, force: true })
    })

    it('should add blank line after first segment group always', async () => {
      await mkdir(streamTestDir, { recursive: true })

      const processedFiles: ProcessedFile[] = [
        { title: 'Home', content: '# Home', url: '/' },
        { title: 'About', content: '# About', url: '/about' },
        { title: 'API Core', content: '# Core', url: '/api/core' },
      ]

      const stream = createLlmsTxtStream({
        siteName: 'Test Site',
        outputDir: streamTestDir,
      })

      const writer = stream.getWriter()
      for (const page of processedFiles) {
        await writer.write(page)
      }
      await writer.close()

      const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')

      // With new grouping: /about is root-level without nesting, so grouped with /
      // Blank line after root group (/, /about) before /api group
      // Expected: /, /about, [blank], /api/core
      expect(llmsTxtContent).toMatch(/\[About\].*\n\n.*\[API Core\]/s)

      await rm(streamTestDir, { recursive: true, force: true })
    })

    it('should add blank line after segment group 2 if more than 1 URL', async () => {
      await mkdir(streamTestDir, { recursive: true })

      const processedFiles: ProcessedFile[] = [
        { title: 'Home', content: '# Home', url: '/' },
        { title: 'Docs 1', content: '# Docs 1', url: '/docs/page1' },
        { title: 'Docs 2', content: '# Docs 2', url: '/docs/page2' },
        { title: 'Learn 1', content: '# Learn 1', url: '/learn/page1' },
      ]

      const stream = createLlmsTxtStream({
        siteName: 'Test Site',
        outputDir: streamTestDir,
      })

      const writer = stream.getWriter()
      for (const page of processedFiles) {
        await writer.write(page)
      }
      await writer.close()

      const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')

      // Should have blank line after /docs group (2 URLs > 1)
      expect(llmsTxtContent).toMatch(/\[Docs 2\].*\n\n.*\[Learn 1\]/s)

      await rm(streamTestDir, { recursive: true, force: true })
    })

    it('should NOT add blank line after segment group 2 if only 1 URL', async () => {
      await mkdir(streamTestDir, { recursive: true })

      const processedFiles: ProcessedFile[] = [
        { title: 'Home', content: '# Home', url: '/' },
        { title: 'Docs 1', content: '# Docs 1', url: '/docs/page1' },
        { title: 'Learn 1', content: '# Learn 1', url: '/learn/page1' },
      ]

      const stream = createLlmsTxtStream({
        siteName: 'Test Site',
        outputDir: streamTestDir,
      })

      const writer = stream.getWriter()
      for (const page of processedFiles) {
        await writer.write(page)
      }
      await writer.close()

      const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')

      // Should NOT have blank line after /docs group (only 1 URL)
      expect(llmsTxtContent).not.toMatch(/\[Docs 1\].*\n\n.*\[Learn 1\]/s)
      expect(llmsTxtContent).toMatch(/\[Docs 1\].*\n- \[Learn 1\]/s)

      await rm(streamTestDir, { recursive: true, force: true })
    })

    it('should NOT add blank line after segment group 3 regardless of URL count', async () => {
      await mkdir(streamTestDir, { recursive: true })

      const processedFiles: ProcessedFile[] = [
        { title: 'Home', content: '# Home', url: '/' },
        { title: 'API 1', content: '# API 1', url: '/api/page1' },
        { title: 'API 2', content: '# API 2', url: '/api/page2' },
        { title: 'Blog 1', content: '# Blog 1', url: '/blog/page1' },
        { title: 'Blog 2', content: '# Blog 2', url: '/blog/page2' },
        { title: 'Docs 1', content: '# Docs 1', url: '/docs/page1' },
        { title: 'Docs 2', content: '# Docs 2', url: '/docs/page2' },
        { title: 'Learn 1', content: '# Learn 1', url: '/learn/page1' },
      ]

      const stream = createLlmsTxtStream({
        siteName: 'Test Site',
        outputDir: streamTestDir,
      })

      const writer = stream.getWriter()
      for (const page of processedFiles) {
        await writer.write(page)
      }
      await writer.close()

      const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')

      // Should NOT have blank line after /docs group (group 3, even with multiple URLs)
      expect(llmsTxtContent).not.toMatch(/\[Docs 2\].*\n\n.*\[Learn 1\]/s)
      expect(llmsTxtContent).toMatch(/\[Docs 2\].*\n- \[Learn 1\]/s)

      await rm(streamTestDir, { recursive: true, force: true })
    })

    it('should NOT add blank line after segment group 4+', async () => {
      await mkdir(streamTestDir, { recursive: true })

      const processedFiles: ProcessedFile[] = [
        { title: 'Home', content: '# Home', url: '/' },
        { title: 'About', content: '# About', url: '/about' },
        { title: 'API 1', content: '# API 1', url: '/api/page1' },
        { title: 'Docs 1', content: '# Docs 1', url: '/docs/page1' },
        { title: 'Guide 1', content: '# Guide 1', url: '/guide/page1' },
        { title: 'Guide 2', content: '# Guide 2', url: '/guide/page2' },
        { title: 'Guide 3', content: '# Guide 3', url: '/guide/page3' },
        { title: 'Guide 4', content: '# Guide 4', url: '/guide/page4' },
        { title: 'Guide 5', content: '# Guide 5', url: '/guide/page5' },
        { title: 'Guide 6', content: '# Guide 6', url: '/guide/page6' },
        { title: 'Learn 1', content: '# Learn 1', url: '/learn/page1' },
      ]

      const stream = createLlmsTxtStream({
        siteName: 'Test Site',
        outputDir: streamTestDir,
      })

      const writer = stream.getWriter()
      for (const page of processedFiles) {
        await writer.write(page)
      }
      await writer.close()

      const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')

      // Should NOT have blank line after /guide group (group 4, even with 6 URLs)
      expect(llmsTxtContent).not.toMatch(/\[Guide 6\].*\n\n.*\[Learn 1\]/s)
      expect(llmsTxtContent).toMatch(/\[Guide 6\].*\n- \[Learn 1\]/s)

      await rm(streamTestDir, { recursive: true, force: true })
    })

    it('should handle complex real-world URL structure', async () => {
      await mkdir(streamTestDir, { recursive: true })

      const processedFiles: ProcessedFile[] = [
        { title: 'Home', content: '', url: '/' },
        { title: 'Releases', content: '', url: '/releases' },
        { title: 'Launch', content: '', url: '/learn/launch-and-listen' },
        { title: 'Routes', content: '', url: '/learn/routes-and-rendering' },
        { title: 'Crawlers', content: '', url: '/learn/controlling-crawlers' },
        { title: 'LC Intro', content: '', url: '/docs/link-checker/getting-started/introduction' },
        { title: 'LC Config', content: '', url: '/docs/link-checker/api/config' },
        { title: 'LC V4', content: '', url: '/docs/link-checker/releases/v4' },
        { title: 'LC Install', content: '', url: '/docs/link-checker/getting-started/installation' },
        { title: 'LC Rules', content: '', url: '/docs/link-checker/guides/rules' },
        { title: 'LC Trouble', content: '', url: '/docs/link-checker/getting-started/troubleshooting' },
        { title: 'LC Inspect', content: '', url: '/docs/link-checker/guides/live-inspections' },
        { title: 'LC Build', content: '', url: '/docs/link-checker/guides/build-scans' },
        { title: 'LC Exclude', content: '', url: '/docs/link-checker/guides/exclude-links' },
        { title: 'LC Reports', content: '', url: '/docs/link-checker/guides/generating-reports' },
      ]

      const stream = createLlmsTxtStream({
        siteName: 'Test Site',
        outputDir: streamTestDir,
      })

      const writer = stream.getWriter()
      for (const page of processedFiles) {
        await writer.write(page)
      }
      await writer.close()

      const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
      const lines = llmsTxtContent.split('\n')

      // Find indices of key URLs
      const homeIdx = lines.findIndex(l => l.includes('[Home]'))
      const releasesIdx = lines.findIndex(l => l.includes('[Releases]'))
      const lcIntroIdx = lines.findIndex(l => l.includes('[LC Intro]'))
      const launchIdx = lines.findIndex(l => l.includes('[Launch]'))

      // With new grouping: root-level pages without nesting grouped first
      // Group 0: /, /releases (root level, no nesting) - 2 URLs
      // Group 1: /docs/* (has nesting) - 10 URLs
      // Group 2: /learn/* (has nesting) - 3 URLs
      // Expected order: /, /releases, /docs/*, /learn/*
      expect(homeIdx).toBeLessThan(releasesIdx)
      expect(releasesIdx).toBeLessThan(lcIntroIdx)
      expect(lcIntroIdx).toBeLessThan(launchIdx)

      // Verify blank line after group 0 (root pages: / and /releases, 2 URLs)
      const afterReleases = lines[releasesIdx + 1]
      expect(afterReleases).toBe('')

      // Verify blank line after /docs group (group 1, 10 URLs > 5)
      // Last /docs item alphabetically is /docs/link-checker/releases/v4 (LC V4)
      const lcV4Idx = lines.findIndex(l => l.includes('[LC V4]'))
      const afterLcV4 = lines[lcV4Idx + 1]
      expect(afterLcV4).toBe('')

      // Verify NO blank line after /learn group (group 2, 3 URLs <= 5)
      const crawlersIdx = lines.findIndex(l => l.includes('[Crawlers]'))
      const afterCrawlers = lines[crawlersIdx + 1]
      expect(afterCrawlers).not.toBe('')

      await rm(streamTestDir, { recursive: true, force: true })
    })

    it('should correctly order real-world Nuxt SEO structure', async () => {
      await mkdir(streamTestDir, { recursive: true })

      const processedFiles: ProcessedFile[] = [
        { title: 'Nuxt SEO', content: '', url: '/' },
        { title: 'Launch & listen', content: '', url: '/learn/launch-and-listen' },
        { title: 'Mastering Meta', content: '', url: '/learn/mastering-meta' },
        { title: 'Routes & Rendering', content: '', url: '/learn/routes-and-rendering' },
        { title: 'Pro', content: '', url: '/pro' },
        { title: 'Releases', content: '', url: '/releases' },
        { title: 'Controlling Crawlers', content: '', url: '/learn/controlling-crawlers' },
        { title: 'Chat', content: '', url: '/chat' },
        { title: 'Announcement', content: '', url: '/announcement' },
        { title: 'Pro Feedback', content: '', url: '/pro/feedback' },
        { title: 'Trailing Slashes', content: '', url: '/learn/routes-and-rendering/trailing-slashes' },
        { title: 'Getting Indexed', content: '', url: '/learn/launch-and-listen/going-live' },
        { title: 'Nuxt OG Image', content: '', url: '/docs/og-image/getting-started/introduction' },
        { title: 'Nuxt Sitemap', content: '', url: '/docs/sitemap/getting-started/introduction' },
        { title: 'Nuxt Link Checker', content: '', url: '/docs/link-checker/getting-started/introduction' },
        { title: 'What Is Nuxt SEO?', content: '', url: '/docs/nuxt-seo/getting-started/introduction' },
        { title: 'Install Nuxt SEO', content: '', url: '/docs/nuxt-seo/getting-started/installation' },
      ]

      const stream = createLlmsTxtStream({
        siteName: 'Nuxt SEO',
        description: 'Nuxt SEO is a collection of hand-crafted Nuxt Modules to help you rank higher in search engines.',
        outputDir: streamTestDir,
        sections: [
          {
            title: 'LLM Resources',
            links: [
              { title: 'Pages Minimal', href: 'https://nuxtseo.com/llms.toon', description: 'Page-level metadata in TOON format' },
              { title: 'Page Chunks', href: 'https://nuxtseo.com/llms-full.toon', description: 'Individual content chunks in TOON format' },
            ],
          },
        ],
      })

      const writer = stream.getWriter()
      for (const page of processedFiles) {
        await writer.write(page)
      }
      await writer.close()

      const llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
      const lines = llmsTxtContent.split('\n')

      // Verify header
      expect(llmsTxtContent).toContain('# Nuxt SEO')
      expect(llmsTxtContent).toContain('> Nuxt SEO is a collection')

      // Verify LLM Resources section comes before Pages
      const llmResourcesIdx = llmsTxtContent.indexOf('## LLM Resources')
      const pagesIdx = llmsTxtContent.indexOf('## Pages')
      expect(llmResourcesIdx).toBeLessThan(pagesIdx)

      // Find indices of key URLs - should be alphabetically sorted
      const rootIdx = lines.findIndex(l => l.includes('[Nuxt SEO](/)'))
      const announcementIdx = lines.findIndex(l => l.includes('[Announcement]'))
      const chatIdx = lines.findIndex(l => l.includes('[Chat]'))
      const docsOgIdx = lines.findIndex(l => l.includes('[Nuxt OG Image]'))
      const learnLaunchIdx = lines.findIndex(l => l.includes('[Launch & listen]'))
      const proIdx = lines.findIndex(l => l.includes('[Pro](/pro)'))
      const releasesIdx = lines.findIndex(l => l.includes('[Releases]'))

      // Verify alphabetical order - root level pages grouped, then segments with nesting
      expect(rootIdx).toBeLessThan(announcementIdx)
      expect(announcementIdx).toBeLessThan(chatIdx)
      expect(chatIdx).toBeLessThan(releasesIdx)
      expect(releasesIdx).toBeLessThan(docsOgIdx)
      expect(docsOgIdx).toBeLessThan(learnLaunchIdx)
      expect(learnLaunchIdx).toBeLessThan(proIdx)

      // New grouping logic: root-level pages without nested paths are grouped together
      // With 2-segment grouping:
      // Group 0: /, /announcement, /chat, /releases (root-level, no nested paths) - 4 URLs
      // Groups are created for 2-segment prefixes with > 1 URL
      // Blank lines after groups 0-2 if > 1 URL

      // Verify blank line after group 0 (root level pages, 4 URLs)
      const afterReleases = lines[releasesIdx + 1]
      expect(afterReleases).toBe('')

      // Snapshot the full output
      expect(llmsTxtContent).toMatchSnapshot()

      await rm(streamTestDir, { recursive: true, force: true })
    })
  })
})
