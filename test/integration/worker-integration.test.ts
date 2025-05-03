import fs from 'node:fs/promises'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { beforeAll, describe, expect, it } from 'vitest'
import { asyncHtmlToMarkdown } from '../../src/index.ts'

// Explicitly control worker usage in tests
// We're testing workers so we need to enable them
process.env.NODE_ENV = 'worker-test'

const FIXTURES_DIR = join(process.cwd(), 'test', 'fixtures')

describe('worker Integration Tests', () => {
  let smallWikiHtml: string
  let largeWikiHtml: string

  beforeAll(async () => {
    // Load test HTML fixtures
    smallWikiHtml = await fs.readFile(join(FIXTURES_DIR, 'wikipedia-small.html'), 'utf-8')
    largeWikiHtml = await fs.readFile(join(FIXTURES_DIR, 'wikipedia-largest.html'), 'utf-8')
  })

  it('produces identical output with and without workers', async () => {
    // Convert using workers
    const withWorkers = await asyncHtmlToMarkdown(smallWikiHtml, {
      useWorkers: true,
      workerCount: 2,
      origin: 'https://en.wikipedia.org',
    })

    // Convert without workers
    const withoutWorkers = await asyncHtmlToMarkdown(smallWikiHtml, {
      useWorkers: false,
      origin: 'https://en.wikipedia.org',
    })

    // Compare results - they should be identical
    expect(withWorkers).toBe(withoutWorkers)
  })

  it('correctly processes HTML chunks in order', async () => {
    // Create a repeating HTML pattern that can be split into chunks
    const repeatedHtml = Array.from({ length: 10 }).fill('<h1>Section</h1><p>This is a test paragraph.</p>').join('')

    // Process with workers
    const result = await asyncHtmlToMarkdown(repeatedHtml, {
      useWorkers: true,
      workerCount: 2,
      chunkSize: 50, // Small chunk size to ensure multiple chunks
    })

    // Count how many complete sections we have (should be 10)
    const sectionCount = (result.match(/# Section/g) || []).length
    const paragraphCount = (result.match(/This is a test paragraph./g) || []).length

    expect(sectionCount).toBe(10)
    expect(paragraphCount).toBe(10)
  })

  it('performance comparison between worker and single-threaded mode', async () => {
    // Skip this test if we need faster CI runs
    if (process.env.SKIP_PERF_TESTS) {
      return
    }

    // Function to measure processing time
    const measureProcessingTime = async (useWorkers: boolean, workerCount?: number) => {
      const start = performance.now()
      await asyncHtmlToMarkdown(largeWikiHtml, {
        useWorkers,
        workerCount,
        origin: 'https://en.wikipedia.org',
      })
      return performance.now() - start
    }

    // Measure single-threaded performance
    const singleThreadedTime = await measureProcessingTime(false)

    // Measure multi-threaded performance
    const multiThreadedTime = await measureProcessingTime(true, 4)

    console.log(`Single-threaded: ${singleThreadedTime.toFixed(2)}ms`)
    console.log(`Multi-threaded: ${multiThreadedTime.toFixed(2)}ms`)
    console.log(`Speedup: ${(singleThreadedTime / multiThreadedTime).toFixed(2)}x`)

    // We expect multi-threaded to be at least as fast as single-threaded
    // For large documents, we expect significant speedup
    expect(multiThreadedTime).toBeLessThanOrEqual(singleThreadedTime * 1.1) // Allow for some overhead in small tests
  })

  it('gracefully handles invalid HTML in worker mode', async () => {
    const invalidHtml = '<div><p>Unclosed paragraph tag<span>Unclosed span element</span></p></div>'

    // This should not throw an error
    const result = await asyncHtmlToMarkdown(invalidHtml, {
      useWorkers: true,
      workerCount: 2,
    })

    // Should still produce markdown output
    expect(result).toContain('Unclosed paragraph tag')
    expect(result).toContain('Unclosed span element')
  })
})
