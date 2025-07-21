import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRepository } from '../src/drizzle-repository.ts'

describe('llmsRepository', () => {
  let testDbPath: string
  let repository: ReturnType<typeof createRepository>

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `test-${Date.now()}.db`)
    repository = createRepository({ dbPath: testDbPath })
    await repository.ensureDbDirectory()
  })

  afterEach(async () => {
    repository.close()
    try {
      await rm(testDbPath, { force: true })
    }
    catch {
      // Ignore cleanup errors
    }
  })

  it('should create a new entry', async () => {
    const entry = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
      description: 'Test site',
      crawlDepth: 2,
    })

    expect(entry.id).toBeDefined()
    expect(entry.name).toBe('test-site')
    expect(entry.url).toBe('https://example.com')
    expect(entry.description).toBe('Test site')
    expect(entry.crawlDepth).toBe(2)
    expect(entry.status).toBe('pending')
  })

  it('should retrieve entry by ID', async () => {
    const created = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
    })

    const retrieved = await repository.getEntry(created.id)
    expect(retrieved).toEqual(created)
  })

  it('should retrieve entry by name', async () => {
    const created = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
    })

    const retrieved = await repository.getEntryByName('test-site')
    expect(retrieved).toEqual(created)
  })

  it('should update entry status', async () => {
    const entry = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
    })

    await repository.updateEntryStatus(entry.id, 'completed')

    const updated = await repository.getEntry(entry.id)
    expect(updated?.status).toBe('completed')
  })

  it('should add crawled pages', async () => {
    const entry = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
    })

    await repository.addCrawledPage(entry.id, 'https://example.com/page1', 'Page 1', 1000)
    await repository.addCrawledPage(entry.id, 'https://example.com/page2', 'Page 2', 2000)

    const pages = await repository.getCrawledPages(entry.id)
    expect(pages).toHaveLength(2)

    const urls = pages.map(p => p.url)
    expect(urls).toContain('https://example.com/page1')
    expect(urls).toContain('https://example.com/page2')

    const page1 = pages.find(p => p.url === 'https://example.com/page1')
    const page2 = pages.find(p => p.url === 'https://example.com/page2')

    expect(page1?.title).toBe('Page 1')
    expect(page1?.contentLength).toBe(1000)
    expect(page2?.title).toBe('Page 2')
    expect(page2?.contentLength).toBe(2000)
  })

  it('should add artifacts', async () => {
    const entry = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
    })

    await repository.addArtifact(entry.id, 'llms.txt', '/path/to/llms.txt', 1024)
    await repository.addArtifact(entry.id, 'archive', '/path/to/archive.tar.gz', 2048)

    const artifacts = await repository.getArtifacts(entry.id)
    expect(artifacts).toHaveLength(2)
    expect(artifacts.some(a => a.type === 'llms.txt')).toBe(true)
    expect(artifacts.some(a => a.type === 'archive')).toBe(true)
  })

  it('should generate llms.txt content', async () => {
    // Create a completed entry
    const entry = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
      description: 'A test site',
      siteName: 'Test Site',
    })

    await repository.updateEntryStatus(entry.id, 'completed')
    await repository.updateEntryArtifacts(entry.id, '/path/to/archive.tar.gz', 1024, 5)

    const llmsTxt = await repository.generateLlmsTxt()

    expect(llmsTxt).toContain('# Open Source Project Documentation')
    expect(llmsTxt).toContain('## Test Site')
    expect(llmsTxt).toContain('A test site')
    expect(llmsTxt).toContain('- URL: https://example.com')
    expect(llmsTxt).toContain('- Pages: 5')
  })

  it('should handle exclude patterns', async () => {
    const entry = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
      excludePatterns: ['*/admin/*', '*/api/*'],
    })

    const retrieved = await repository.getEntry(entry.id)
    expect(retrieved?.excludePatterns).toEqual(['*/admin/*', '*/api/*'])
  })

  it('should delete entry and cascading data', async () => {
    const entry = await repository.createEntry({
      name: 'test-site',
      url: 'https://example.com',
    })

    await repository.addCrawledPage(entry.id, 'https://example.com/page1', 'Page 1')
    await repository.addArtifact(entry.id, 'llms.txt', '/path/to/llms.txt')

    // Verify data exists
    expect(await repository.getCrawledPages(entry.id)).toHaveLength(1)
    expect(await repository.getArtifacts(entry.id)).toHaveLength(1)

    // Delete entry
    await repository.deleteEntry(entry.id)

    // Verify entry and cascading data are gone
    expect(await repository.getEntry(entry.id)).toBeUndefined()
    expect(await repository.getCrawledPages(entry.id)).toHaveLength(0)
    expect(await repository.getArtifacts(entry.id)).toHaveLength(0)
  })
})
