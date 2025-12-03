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

  it('should write incrementally without buffering', async () => {
    await mkdir(streamTestDir, { recursive: true })

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      outputDir: streamTestDir,
    })

    const writer = stream.getWriter()

    await writer.write({ title: 'Page 1', content: '# Page 1', url: '/page1' })

    // Read file immediately after first write to verify streaming
    let llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
    expect(llmsTxtContent).toContain('[Page 1](/page1)')

    await writer.write({ title: 'Page 2', content: '# Page 2', url: '/page2' })

    llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
    expect(llmsTxtContent).toContain('[Page 2](/page2)')

    await writer.close()

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
})
