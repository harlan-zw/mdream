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

describe('cLI llms', () => {
  it('should generate basic llms.txt from HTML files', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/**/*.html" --site-name "Test Site" --description "A comprehensive test site" --origin "https://example.com" --output "${testOutputDir}"`,
    )

    expect(stdout).toContain('Generated llms.txt artifacts in:')

    const content = await readFile(join(testOutputDir, 'llms.txt'), 'utf-8')

    expect(content).toContain('# Test Site')
    expect(content).toContain('> A comprehensive test site')
    expect(content).toContain('## Pages')

    expect(content).toContain('[Test Site - Welcome to Our Homepage](https://example.com/)')
    expect(content).toContain('[About Us - Test Site](https://example.com/about)')
    expect(content).toContain('[First Blog Post - Test Site Blog](https://example.com/blog/post1)')
    expect(content).toContain('[Contact Us - Test Site](https://example.com/contact)')

    expect(content).toContain('This is the homepage of our test site')
    expect(content).toContain('Learn more about our test site')
    expect(content).toContain('Our inaugural blog post')
    expect(content).toContain('Get in touch with the Test Site team')
  })

  it('should generate llms-full.txt with complete content', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/**/*.html" --site-name "Test Site" --description "A test site" --output "${testOutputDir}" --artifacts "llms.txt,llms-full.txt"`,
    )

    expect(stdout).toContain('Generated llms.txt artifacts in:')

    const fullContent = await readFile(join(testOutputDir, 'llms-full.txt'), 'utf-8')

    expect(fullContent).toContain('# Test Site')
    expect(fullContent).toContain('> A test site')
    expect(fullContent).toContain('## Table of Contents')

    expect(fullContent).toContain('- [Test Site - Welcome to Our Homepage](#test-site---welcome-to-our-homepage)')
    expect(fullContent).toContain('- [About Us - Test Site](#about-us---test-site)')

    expect(fullContent).toContain('---')
    expect(fullContent).toContain('title: Test Site - Welcome to Our Homepage')
    expect(fullContent).toContain('url: /')
    expect(fullContent).toContain('# Welcome to Test Site')
    expect(fullContent).toContain('Homepage Content')

    expect(fullContent).toContain('title: First Blog Post - Test Site Blog')
    expect(fullContent).toContain('First Blog Post: Testing HTML to Markdown')
    expect(fullContent).toContain('function convertHtmlToMarkdown')
  })

  it('should generate individual markdown files', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/**/*.html" --site-name "Test Site" --output "${testOutputDir}" --artifacts "llms.txt,markdown"`,
    )

    expect(stdout).toContain('Generated llms.txt artifacts in:')

    const indexMd = await readFile(join(testOutputDir, 'md', 'index.md'), 'utf-8')
    const aboutMd = await readFile(join(testOutputDir, 'md', 'about.md'), 'utf-8')
    const blogMd = await readFile(join(testOutputDir, 'md', 'blog', 'post1.md'), 'utf-8')
    const contactMd = await readFile(join(testOutputDir, 'md', 'contact.md'), 'utf-8')

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
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/blog/*.html" --site-name "Blog Only" --output "${testOutputDir}"`,
    )

    expect(stdout).toContain('Generated llms.txt artifacts in:')

    const content = await readFile(join(testOutputDir, 'llms.txt'), 'utf-8')
    expect(content).toContain('# Blog Only')
    expect(content).toContain('[First Blog Post - Test Site Blog]')
    expect(content).not.toContain('About Us')
    expect(content).not.toContain('Contact Us')
  })

  it('should handle missing site name and description gracefully', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/index.html" --output "${testOutputDir}"`,
    )

    expect(stdout).toContain('Generated llms.txt artifacts in:')

    const content = await readFile(join(testOutputDir, 'llms.txt'), 'utf-8')
    expect(content).toContain('# Site') // default site name
    expect(content).not.toContain('>') // no description block
    expect(content).toContain('## Pages')
  })

  it('should extract metadata from HTML properly', async () => {
    await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/blog/post1.html" --site-name "Blog Test" --origin "https://test.com" --output "${testOutputDir}"`,
    )

    const content = await readFile(join(testOutputDir, 'llms.txt'), 'utf-8')

    expect(content).toContain('[First Blog Post - Test Site Blog](https://test.com/post1)')
    expect(content).toContain('Our inaugural blog post discussing the implementation')
  })

  it('should handle origin parameter for relative paths', async () => {
    const { stdout } = await execAsync(
      `node "${mdreamBin}" llms "${fixturesDir}/**/*.html" --site-name "Test Site" --origin "https://origin.com" --output "${testOutputDir}" --artifacts "llms.txt,markdown"`,
    )

    expect(stdout).toContain('Generated llms.txt artifacts in:')

    const indexMd = await readFile(join(testOutputDir, 'md', 'index.md'), 'utf-8')
    expect(indexMd).toContain('Welcome to Test Site')
  })
})
