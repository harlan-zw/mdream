import { exec } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const execAsync = promisify(exec)

const testOutputDir = join(process.cwd(), 'test-output')
const fixturesDir = join(process.cwd(), 'packages/mdream/test/fixtures/llms-cli')
const mdreamBin = join(process.cwd(), 'bin/mdream.mjs')

beforeEach(async () => {
  await mkdir(testOutputDir, { recursive: true })
})

afterEach(async () => {
  await rm(testOutputDir, { recursive: true, force: true })
})

describe.each(['JavaScript Engine', 'Rust Engine'])('CLI llms %s', (engineName) => {
  const engineFlag = engineName === 'Rust Engine' ? '--engine rust' : '--engine js'
  const engineSuffix = engineName === 'Rust Engine' ? '-rust' : '-js'
  const currentTestOutputDir = `${testOutputDir}${engineSuffix}`
  
  beforeEach(async () => {
     await mkdir(currentTestOutputDir, { recursive: true })
  })
  
  afterEach(async () => {
     await rm(currentTestOutputDir, { recursive: true, force: true })
  })
  
  it('should generate basic llms.txt from HTML files', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/**/*.html" --site-name "Test Site" --description "A comprehensive test site" --origin "https://example.com" --output "${currentTestOutputDir}" ${engineFlag}`,
    )

    // Check that the command outputs a success message
    expect(stdout).toContain('✅ Generated llms.txt artifacts in:')

    const content = await readFile(join(currentTestOutputDir, 'llms.txt'), 'utf-8')

    // Check header
    expect(content).toContain('# Test Site')
    expect(content).toContain('> A comprehensive test site')
    expect(content).toContain('## Pages')

    // Check pages are included
    expect(content).toContain('[Test Site - Welcome to Our Homepage](https://example.com/)')
    expect(content).toContain('[About Us - Test Site](https://example.com/about)')
    expect(content).toContain('[First Blog Post - Test Site Blog](https://example.com/blog/post1)')
    expect(content).toContain('[Contact Us - Test Site](https://example.com/contact)')

    // Check descriptions are included
    expect(content).toContain('This is the homepage of our test site')
    expect(content).toContain('Learn more about our test site')
    expect(content).toContain('Our inaugural blog post')
    expect(content).toContain('Get in touch with the Test Site team')
  })

  it('should generate llms-full.txt with complete content', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/**/*.html" --site-name "Test Site" --description "A test site" --output "${currentTestOutputDir}" --artifacts "llms.txt,llms-full.txt" ${engineFlag}`,
    )

    // Check that the command outputs a success message
    expect(stdout).toContain('✅ Generated llms.txt artifacts in:')

    const fullContent = await readFile(join(currentTestOutputDir, 'llms-full.txt'), 'utf-8')

    // Check structure
    expect(fullContent).toContain('# Test Site')
    expect(fullContent).toContain('> A test site')
    expect(fullContent).toContain('## Table of Contents')

    // Check all pages are linked in TOC
    expect(fullContent).toContain('- [Test Site - Welcome to Our Homepage](#test-site---welcome-to-our-homepage)')
    expect(fullContent).toContain('- [About Us - Test Site](#about-us---test-site)')

    // Check full content is included
    // Now using frontmatter format with title only in frontmatter
    expect(fullContent).toContain('---')
    expect(fullContent).toContain('title: Test Site - Welcome to Our Homepage')
    expect(fullContent).toContain('url: /')
    expect(fullContent).toContain('# Welcome to Test Site')
    expect(fullContent).toContain('Homepage Content')

    // Check blog post content
    expect(fullContent).toContain('title: First Blog Post - Test Site Blog')
    expect(fullContent).toContain('First Blog Post: Testing HTML to Markdown')
    expect(fullContent).toContain('function convertHtmlToMarkdown')
  })

  it('should generate individual markdown files', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/**/*.html" --site-name "Test Site" --output "${currentTestOutputDir}" --artifacts "llms.txt,markdown" ${engineFlag}`,
    )

    // Check that the command outputs a success message
    expect(stdout).toContain('✅ Generated llms.txt artifacts in:')

    // Check individual markdown files were created
    const indexMd = await readFile(join(currentTestOutputDir, 'md', 'index.md'), 'utf-8')
    const aboutMd = await readFile(join(currentTestOutputDir, 'md', 'about.md'), 'utf-8')
    const blogMd = await readFile(join(currentTestOutputDir, 'md', 'blog', 'post1.md'), 'utf-8')
    const contactMd = await readFile(join(currentTestOutputDir, 'md', 'contact.md'), 'utf-8')

    // Check content
    expect(indexMd).toContain('# Welcome to Test Site')
    expect(indexMd).toContain('Homepage Content')
    expect(indexMd).toContain('Feature 1: Comprehensive HTML to Markdown conversion')

    expect(aboutMd).toContain('# About Our Test Site')
    expect(aboutMd).toContain('Our Mission')

    expect(blogMd).toContain('# First Blog Post: Testing HTML to Markdown')
    expect(blogMd).toContain('\nfunction convertHtmlToMarkdown(html) {\n')

    expect(contactMd).toContain('# Contact Us')
    expect(contactMd).toContain('| Day | Hours |')
  })

  it('should work with glob patterns', async () => {
    // Test with specific pattern - only blog posts
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/blog/*.html" --site-name "Blog Only" --output "${currentTestOutputDir}" ${engineFlag}`,
    )

    // Check that the command outputs a success message
    expect(stdout).toContain('✅ Generated llms.txt artifacts in:')

    const content = await readFile(join(currentTestOutputDir, 'llms.txt'), 'utf-8')
    expect(content).toContain('# Blog Only')
    expect(content).toContain('[First Blog Post - Test Site Blog]')
    expect(content).not.toContain('About Us')
    expect(content).not.toContain('Contact Us')
  })

  it('should handle missing site name and description gracefully', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/index.html" --output "${currentTestOutputDir}" ${engineFlag}`,
    )

    // Check that the command outputs a success message
    expect(stdout).toContain('✅ Generated llms.txt artifacts in:')

    const content = await readFile(join(currentTestOutputDir, 'llms.txt'), 'utf-8')
    expect(content).toContain('# Site') // default site name
    expect(content).not.toContain('>') // no description block
    expect(content).toContain('## Pages')
  })

  it('should extract metadata from HTML properly', async () => {
    await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/blog/post1.html" --site-name "Blog Test" --origin "https://test.com" --output "${currentTestOutputDir}" ${engineFlag}`,
    )

    const content = await readFile(join(currentTestOutputDir, 'llms.txt'), 'utf-8')

    // Check that article metadata was extracted
    expect(content).toContain('[First Blog Post - Test Site Blog](https://test.com/post1)')
    expect(content).toContain('Our inaugural blog post discussing the implementation')
  })

  it('should handle origin parameter for relative paths', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/**/*.html" --site-name "Test Site" --origin "https://origin.com" --output "${currentTestOutputDir}" --artifacts "llms.txt,markdown" ${engineFlag}`,
    )

    // Check that the command outputs a success message
    expect(stdout).toContain('✅ Generated llms.txt artifacts in:')

    // The origin parameter should be used for processing relative URLs in the HTML
    const indexMd = await readFile(join(currentTestOutputDir, 'md', 'index.md'), 'utf-8')
    expect(indexMd).toContain('Welcome to Test Site')
  })
})
