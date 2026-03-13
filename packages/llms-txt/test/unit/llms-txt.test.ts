import type { ProcessedFile } from '../../src/index.js'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createLlmsTxtStream, generateLlmsTxtArtifacts, processHtmlFiles } from '../../src/index.js'

const testDir = join(tmpdir(), 'mdream-llms-txt-test')

const RE_ABOUT_THEN_API_CORE = /\[About\].*\n\n.*\[API Core\]/s
const RE_DOCS2_THEN_LEARN1_WITH_BLANK = /\[Docs 2\].*\n\n.*\[Learn 1\]/s
const RE_DOCS1_THEN_LEARN1_WITH_BLANK = /\[Docs 1\].*\n\n.*\[Learn 1\]/s
const RE_DOCS1_THEN_LEARN1_NO_BLANK = /\[Docs 1\].*\n- \[Learn 1\]/s
const RE_DOCS2_THEN_LEARN1_NO_BLANK = /\[Docs 2\].*\n- \[Learn 1\]/s
const RE_GUIDE6_THEN_LEARN1_WITH_BLANK = /\[Guide 6\].*\n\n.*\[Learn 1\]/s
const RE_GUIDE6_THEN_LEARN1_NO_BLANK = /\[Guide 6\].*\n- \[Learn 1\]/s

// Simple converter that extracts title from <title> and converts HTML to basic markdown
function simpleConverter(html: string, _url: string) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/)
  const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/)
  const authorMatch = html.match(/<meta\s+name="author"\s+content="(.*?)"/)
  // Very basic HTML to markdown: extract body text content
  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/)
  let markdown = ''
  if (bodyMatch) {
    markdown = bodyMatch[1]!
      .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
      .replace(/<p>(.*?)<\/p>/g, '$1\n')
      .replace(/<[^>]+>/g, '')
      .trim()
  }
  return {
    markdown,
    metadata: {
      title: titleMatch?.[1]?.trim() || undefined,
      description: descMatch?.[1]?.trim() || undefined,
      author: authorMatch?.[1]?.trim() || undefined,
    },
  }
}

// Helper to create test HTML files
async function createTestFiles() {
  await mkdir(testDir, { recursive: true })

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

async function cleanup() {
  try {
    await rm(testDir, { recursive: true, force: true })
  }
  catch {}
}

describe('processHtmlFiles', () => {
  it('should process HTML files with a converter', async () => {
    await createTestFiles()

    const files = await processHtmlFiles(
      join(testDir, '**/*.html'),
      simpleConverter,
      { origin: 'https://example.com' },
    )

    expect(files).toHaveLength(3)

    const homePage = files.find(f => f.metadata?.title === 'Test Site - Home')
    expect(homePage).toBeDefined()
    expect(homePage?.url).toBe('/')
    expect(homePage?.metadata?.description).toBe('This is a test site for mdream')
    expect(homePage?.metadata?.author).toBe('Test Author')

    await cleanup()
  })

  it('should handle multiple glob patterns', async () => {
    await createTestFiles()

    const files = await processHtmlFiles(
      [join(testDir, '*.html'), join(testDir, 'blog/*.html')],
      simpleConverter,
    )

    expect(files).toHaveLength(3)
    await cleanup()
  })
})

it('should generate llms.txt from pre-processed files', async () => {
  await createTestFiles()

  const files = await processHtmlFiles(join(testDir, '**/*.html'), simpleConverter, { origin: 'https://example.com' })

  const result = await generateLlmsTxtArtifacts({
    files,
    siteName: 'Test Site',
    description: 'A test site for mdream',
    origin: 'https://example.com',
  })

  expect(result.processedFiles).toHaveLength(3)
  expect(result.llmsTxt).toContain('# Test Site')
  expect(result.llmsTxt).toContain('> A test site for mdream')
  expect(result.llmsTxt).toContain('## Pages')

  await cleanup()
})

it('should generate llms-full.txt when requested', async () => {
  await createTestFiles()

  const files = await processHtmlFiles(join(testDir, '**/*.html'), simpleConverter, { origin: 'https://example.com' })

  const result = await generateLlmsTxtArtifacts({
    files,
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

  await cleanup()
})

it('should generate individual markdown files when requested', async () => {
  await createTestFiles()

  const files = await processHtmlFiles(join(testDir, '**/*.html'), simpleConverter)

  const result = await generateLlmsTxtArtifacts({
    files,
    siteName: 'Test Site',
    generateMarkdown: true,
  })

  expect(result.markdownFiles).toBeDefined()
  expect(result.markdownFiles).toHaveLength(3)

  const indexFile = result.markdownFiles?.find(f => f.path === 'md/index.md')
  const aboutFile = result.markdownFiles?.find(f => f.path === 'md/about.md')

  expect(indexFile).toBeDefined()
  expect(aboutFile).toBeDefined()

  await cleanup()
})

it('should work with pre-processed files directly', async () => {
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
    expect(result.llmsFullTxt).toContain('---')
    expect(result.llmsFullTxt).toContain('title: Simple Page')
    expect(result.llmsFullTxt).toContain('url: https://example.com/simple-page')
    expect(result.llmsFullTxt).toContain('# Simple Content')
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
    expect(result.llmsFullTxt).toContain('title: Conflict Test')
    expect(result.llmsFullTxt).toContain('url: https://example.com/new-url')
    expect(result.llmsFullTxt).toContain('description: New description')
    expect(result.llmsFullTxt).toContain('custom: value')
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
        metadata: { description: 'Welcome to our site' },
      },
      {
        title: 'About Page',
        content: '# About\n\nAbout our company.',
        url: '/about',
        metadata: { description: 'Learn about us' },
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
        metadata: { description: 'A test page' },
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
      metadata: { description: 'A test page' },
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

    let llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
    expect(llmsTxtContent).not.toContain('[Page 1](/page1)')

    await writer.write({ title: 'Page 2', content: '# Page 2', url: '/page2' })
    await writer.close()

    llmsTxtContent = await readFile(join(streamTestDir, 'llms.txt'), 'utf-8')
    expect(llmsTxtContent).toContain('[Page 1](/page1)')
    expect(llmsTxtContent).toContain('[Page 2](/page2)')

    await rm(streamTestDir, { recursive: true, force: true })
  })

  it('should create output directory if it does not exist', async () => {
    const nestedDir = join(streamTestDir, 'nested', 'output', 'dir')

    await rm(streamTestDir, { recursive: true, force: true })

    const stream = createLlmsTxtStream({
      siteName: 'Test Site',
      outputDir: nestedDir,
    })

    const writer = stream.getWriter()
    await writer.write({ title: 'Page 1', content: '# Page 1', url: '/page1' })
    await writer.close()

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

    expect(llmsTxtContent).toContain('This is a note')
    expect(llmsTxtContent).toContain('This is another note')

    const pagesIdx = llmsTxtContent.indexOf('[Page 1]')
    const note1Idx = llmsTxtContent.indexOf('This is a note')
    expect(pagesIdx).toBeLessThan(note1Idx)

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

      expect(llmsTxtContent).toMatch(RE_ABOUT_THEN_API_CORE)

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

      expect(llmsTxtContent).toMatch(RE_DOCS2_THEN_LEARN1_WITH_BLANK)

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

      expect(llmsTxtContent).not.toMatch(RE_DOCS1_THEN_LEARN1_WITH_BLANK)
      expect(llmsTxtContent).toMatch(RE_DOCS1_THEN_LEARN1_NO_BLANK)

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

      expect(llmsTxtContent).not.toMatch(RE_DOCS2_THEN_LEARN1_WITH_BLANK)
      expect(llmsTxtContent).toMatch(RE_DOCS2_THEN_LEARN1_NO_BLANK)

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

      expect(llmsTxtContent).not.toMatch(RE_GUIDE6_THEN_LEARN1_WITH_BLANK)
      expect(llmsTxtContent).toMatch(RE_GUIDE6_THEN_LEARN1_NO_BLANK)

      await rm(streamTestDir, { recursive: true, force: true })
    })
  })
})
