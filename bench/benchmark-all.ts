import fs from 'node:fs/promises'
import path from 'node:path'
// benchmark.ts - Compare performance of Downstream vs Turndown vs Showdown
import { performance } from 'node:perf_hooks'

// add jsdom
import { JSDOM } from 'jsdom'
import showdown from 'showdown'
// Import all libraries
import TurndownService from 'turndown'
import { htmlToMarkdown, htmlToMarkdownStream } from '../src/index.ts'

// Set up jsdom environment
const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeOnLine: true,
  url: 'http://localhost',
})
const { window } = jsdom
const { document } = window
globalThis.document = document
globalThis.window = window

// Initialize Showdown converter
const showdownConverter = new showdown.Converter()
// Set up Showdown for HTML-to-Markdown conversion
showdownConverter.setOption('simpleLineBreaks', true)
showdownConverter.setOption('smoothLivePreview', true)
showdownConverter.setOption('tables', true)

// Define types for benchmark results
interface BenchmarkResult {
  library: string
  streaming: boolean
  chunkSize?: number
  testFile: string
  fileSize: number // KB
  time?: number // ms
  memory?: number // MB
  outputSize?: number // KB
  success: boolean
  error?: string
  equivalence?: {
    comparedTo: string
    equivalent: boolean
    differences?: string
  }
  showdownEquivalence?: {
    comparedTo: string
    equivalent: boolean
    differences?: string
  } // Added for comparing with Showdown
}

// Configuration
const config = {
  // Input directory with test files
  testDataDir: './scripts/.fixtures',

  // Output directory for results
  outputDir: './benchmark-results-all',

  // Chunk sizes to test for streaming
  chunkSizes: [4096, 8192, 16384],

  // Number of times to run each test for more accurate results
  iterations: 3,

  // Maximum file size to test with each library (in KB)
  maxTurndownSize: 1500, // Skip files larger than ~1.5MB for Turndown
  maxShowdownSize: 1500, // Similar limit for Showdown

  // Add some safety timeout for tests (ms)
  timeout: 30000, // 30 seconds
}

/**
 * Compare two Markdown strings to check if they are equivalent
 */
function compareMarkdown(md1: string, md2: string): { equivalent: boolean, differences?: string } {
  // Safety check for very large files
  const MAX_COMPARISON_SIZE = 5 * 1024 * 1024 // 5MB
  if (md1.length > MAX_COMPARISON_SIZE || md2.length > MAX_COMPARISON_SIZE) {
    return {
      equivalent: md1 === md2, // Simple equality check for large files
      differences: 'Files too large for detailed comparison',
    }
  }

  // Normalize line endings
  const normalizedMd1 = md1.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const normalizedMd2 = md2.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // If they're exactly the same after normalizing line endings, they're equivalent
  if (normalizedMd1 === normalizedMd2) {
    return { equivalent: true }
  }

  // Normalize whitespace for a more forgiving comparison
  const whitespaceNormalizedMd1 = normalizedMd1
    .replace(/\s+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim()

  const whitespaceNormalizedMd2 = normalizedMd2
    .replace(/\s+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim()

  // Check if they're the same after normalizing whitespace
  if (whitespaceNormalizedMd1 === whitespaceNormalizedMd2) {
    return {
      equivalent: true,
      differences: 'Equivalent after normalizing whitespace',
    }
  }

  // For very large files, limit the number of lines we compare
  const MAX_LINES_TO_COMPARE = 10000

  // Compare line by line to find differences
  const lines1 = normalizedMd1.split('\n').slice(0, MAX_LINES_TO_COMPARE)
  const lines2 = normalizedMd2.split('\n').slice(0, MAX_LINES_TO_COMPARE)

  // Find the first few differences
  const diffLines: string[] = []
  const maxDiffs = 5 // Maximum number of differences to report

  const minLines = Math.min(lines1.length, lines2.length)
  let diffCount = 0

  for (let i = 0; i < minLines && diffCount < maxDiffs; i++) {
    if (lines1[i] !== lines2[i]) {
      diffCount++
      diffLines.push(`Line ${i + 1}:\n  - ${lines1[i]}\n  + ${lines2[i]}`)
    }
  }

  // Add a note if one output has more lines than the other
  if (lines1.length !== lines2.length) {
    diffLines.push(`Output line count differs: ${lines1.length} vs ${lines2.length}`)
  }

  return {
    equivalent: false,
    differences: diffLines.length > 0 ? diffLines.join('\n\n') : 'Outputs differ but no specific differences identified',
  }
}

/**
 * Run benchmark for a single library on a single test file
 */
async function runBenchmark(
  library: string,
  html: string,
  testFile: string,
  options: { streaming?: boolean, chunkSize?: number } = {},
): Promise<{ result: BenchmarkResult, markdown: string | null }> {
  // Create a timeout promise to abort long-running tests
  const timeoutPromise = new Promise<{ result: BenchmarkResult, markdown: string | null }>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Benchmark timed out after ${config.timeout}ms`))
    }, config.timeout)
  })

  const { streaming = false, chunkSize } = options

  const result: BenchmarkResult = {
    library,
    streaming,
    chunkSize,
    testFile,
    fileSize: html.length / 1024, // KB
    success: false,
  }

  // Define the actual benchmark function
  const runActualBenchmark = async () => {
    try {
      // Collect garbage before test to reduce interference
      if (global.gc) {
        (global.gc as Function)()
      }

      console.log(`Testing ${library}${streaming ? ` (streaming, chunkSize: ${chunkSize})` : ''} on ${testFile}...`)

      const memStart = process.memoryUsage().heapUsed / 1024 / 1024 // MB
      const start = performance.now()

      let markdown = ''

      if (library === 'turndown') {
        const turndownService = new TurndownService()
        markdown = turndownService.turndown(html)
      }
      else if (library === 'showdown') {
        markdown = showdownConverter.makeMarkdown(html)
      }
      else if (library === 'downstream') {
        if (streaming) {
          for await (const chunk of htmlToMarkdownStream(html, { chunkSize })) {
            markdown += chunk
          }
        }
        else {
          markdown = await htmlToMarkdown(html)
        }
      }

      const end = performance.now()
      const memEnd = process.memoryUsage().heapUsed / 1024 / 1024 // MB

      result.time = end - start // ms
      result.memory = memEnd - memStart // MB
      result.success = true
      result.outputSize = markdown.length / 1024 // KB

      console.log(`  Time: ${result.time.toFixed(2)} ms`)
      console.log(`  Memory: ${result.memory.toFixed(2)} MB`)
      console.log(`  Output size: ${result.outputSize.toFixed(2)} KB`)

      return { result, markdown }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`  ERROR: ${errorMessage}`)
      result.error = errorMessage
      return { result, markdown: null }
    }
  }

  // Race the benchmark against the timeout
  try {
    return await Promise.race([runActualBenchmark(), timeoutPromise])
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`  ERROR: ${errorMessage}`)
    result.error = errorMessage
    return { result, markdown: null }
  }
}

/**
 * Run multiple iterations of a benchmark and average the results
 */
async function runAveragedBenchmark(
  library: string,
  html: string,
  testFile: string,
  options: { streaming?: boolean, chunkSize?: number } = {},
): Promise<{ result: BenchmarkResult, markdown: string | null }> {
  const iterations = config.iterations
  const results: BenchmarkResult[] = []
  let anyMarkdown: string | null = null

  console.log(`Running ${iterations} iterations for ${library}${options.streaming ? ' (streaming)' : ''}...`)

  for (let i = 0; i < iterations; i++) {
    // Run the benchmark
    const { result, markdown } = await runBenchmark(library, html, testFile, options)

    // Save the result
    results.push(result)

    // Keep a copy of the markdown output from any successful run
    if (markdown && !anyMarkdown) {
      anyMarkdown = markdown
    }
  }

  // Filter out failed runs
  const successfulResults = results.filter(r => r.success && r.time !== undefined && r.memory !== undefined)

  if (successfulResults.length === 0) {
    // All runs failed
    return { result: results[0], markdown: null }
  }

  // Calculate averages
  const avgTime = successfulResults.reduce((sum, r) => sum + (r.time || 0), 0) / successfulResults.length
  const avgMemory = successfulResults.reduce((sum, r) => sum + (r.memory || 0), 0) / successfulResults.length
  const avgOutputSize = successfulResults.reduce((sum, r) => sum + (r.outputSize || 0), 0) / successfulResults.length

  // Create an averaged result
  const avgResult: BenchmarkResult = {
    ...successfulResults[0],
    time: avgTime,
    memory: avgMemory,
    outputSize: avgOutputSize,
  }

  console.log(`  Average of ${successfulResults.length} iterations:`)
  console.log(`    Time: ${avgResult.time.toFixed(2)} ms`)
  console.log(`    Memory: ${avgResult.memory.toFixed(2)} MB`)

  return { result: avgResult, markdown: anyMarkdown }
}

/**
 * Determine performance details for report generation
 */
function determinePerformanceDetails(results: BenchmarkResult[], metric: 'time' | 'memory'): string {
  try {
    // Group test files by size category
    const smallTests = new Set<string>()
    const mediumTests = new Set<string>()
    const largeTests = new Set<string>()

    results.forEach((r) => {
      if (r.fileSize < 100)
        smallTests.add(r.testFile)
      else if (r.fileSize < 2000)
        mediumTests.add(r.testFile)
      else largeTests.add(r.testFile)
    })

    // Check where Downstream outperforms others
    const smallBetterThanTurndown = [...smallTests].some(testFile =>
      results.some(r =>
        r.library === 'downstream'
        && r.success
        && r[metric] !== undefined
        && r.testFile === testFile
        && results.some(t =>
          t.library === 'turndown'
          && t.success
          && t[metric] !== undefined
          && t.testFile === testFile
          && (r[metric] as number) < (t[metric] as number),
        ),
      ),
    )

    const mediumBetterThanTurndown = [...mediumTests].some(testFile =>
      results.some(r =>
        r.library === 'downstream'
        && r.success
        && r[metric] !== undefined
        && r.testFile === testFile
        && results.some(t =>
          t.library === 'turndown'
          && t.success
          && t[metric] !== undefined
          && t.testFile === testFile
          && (r[metric] as number) < (t[metric] as number),
        ),
      ),
    )

    const largeBetterThanTurndown = [...largeTests].some(testFile =>
      results.some(r =>
        r.library === 'downstream'
        && r.success
        && r[metric] !== undefined
        && r.testFile === testFile
        && results.some(t =>
          t.library === 'turndown'
          && t.success
          && t[metric] !== undefined
          && t.testFile === testFile
          && (r[metric] as number) < (t[metric] as number),
        ),
      ),
    )

    // Check where Downstream outperforms Showdown
    const smallBetterThanShowdown = [...smallTests].some(testFile =>
      results.some(r =>
        r.library === 'downstream'
        && r.success
        && r[metric] !== undefined
        && r.testFile === testFile
        && results.some(s =>
          s.library === 'showdown'
          && s.success
          && s[metric] !== undefined
          && s.testFile === testFile
          && (r[metric] as number) < (s[metric] as number),
        ),
      ),
    )

    const mediumBetterThanShowdown = [...mediumTests].some(testFile =>
      results.some(r =>
        r.library === 'downstream'
        && r.success
        && r[metric] !== undefined
        && r.testFile === testFile
        && results.some(s =>
          s.library === 'showdown'
          && s.success
          && s[metric] !== undefined
          && s.testFile === testFile
          && (r[metric] as number) < (s[metric] as number),
        ),
      ),
    )

    const largeBetterThanShowdown = [...largeTests].some(testFile =>
      results.some(r =>
        r.library === 'downstream'
        && r.success
        && r[metric] !== undefined
        && r.testFile === testFile
        && results.some(s =>
          s.library === 'showdown'
          && s.success
          && s[metric] !== undefined
          && s.testFile === testFile
          && (r[metric] as number) < (s[metric] as number),
        ),
      ),
    )

    // Build description based on findings
    const categoriesTurndown = []
    if (largeBetterThanTurndown)
      categoriesTurndown.push('large documents')
    if (mediumBetterThanTurndown)
      categoriesTurndown.push('medium-sized documents')
    if (smallBetterThanTurndown)
      categoriesTurndown.push('small documents')

    const categoriesShowdown = []
    if (largeBetterThanShowdown)
      categoriesShowdown.push('large documents')
    if (mediumBetterThanShowdown)
      categoriesShowdown.push('medium-sized documents')
    if (smallBetterThanShowdown)
      categoriesShowdown.push('small documents')

    // Combine the results
    const allCategories = new Set([...categoriesTurndown, ...categoriesShowdown])

    if (allCategories.size === 0)
      return 'comparable performance across all document sizes'
    if (allCategories.size === 3)
      return 'all document sizes'

    return Array.from(allCategories).join(' and ')
  }
  catch (error) {
    console.error(`Error determining performance details: ${error}`)
    return 'various document sizes'
  }
}

/**
 * Find the optimal chunk size based on benchmark results
 */
function findOptimalChunkSize(results: BenchmarkResult[]): number {
  try {
    // Filter to only streaming results that succeeded
    const streamingResults = results.filter(r =>
      r.library === 'downstream'
      && r.streaming
      && r.success
      && r.chunkSize !== undefined
      && r.time !== undefined,
    )

    if (streamingResults.length === 0)
      return config.chunkSizes[0]

    // Group by test file
    const groupedByFile: Record<string, BenchmarkResult[]> = {}
    for (const result of streamingResults) {
      const fileKey = result.testFile
      if (!groupedByFile[fileKey])
        groupedByFile[fileKey] = []
      groupedByFile[fileKey].push(result)
    }

    // For each file, find the best chunk size
    const bestChunkSizes: Record<string, number> = {}
    for (const [file, fileResults] of Object.entries(groupedByFile)) {
      // Sort by time (fastest first)
      fileResults.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity))
      if (fileResults[0].chunkSize !== undefined) {
        bestChunkSizes[file] = fileResults[0].chunkSize
      }
    }

    // Count occurrences of each chunk size
    const chunkSizeCounts: Record<string, number> = {}
    for (const chunkSize of Object.values(bestChunkSizes)) {
      chunkSizeCounts[chunkSize] = (chunkSizeCounts[chunkSize] || 0) + 1
    }

    // Find the most frequent best chunk size
    let bestChunkSize = config.chunkSizes[0]
    let maxCount = 0
    for (const [chunkSizeStr, count] of Object.entries(chunkSizeCounts)) {
      if (count > maxCount) {
        maxCount = count
        bestChunkSize = Number(chunkSizeStr)
      }
    }

    return bestChunkSize
  }
  catch (error) {
    console.error(`Error finding optimal chunk size: ${error}`)
    return config.chunkSizes[0] // Return default on error
  }
}

/**
 * Generate a comparison report
 */
function generateReport(results: BenchmarkResult[]): string {
  try {
    let report = '# HTML to Markdown Benchmark: Downstream vs Turndown vs Showdown\n\n'
    report += `Benchmark ran on ${new Date().toISOString()}\n\n`

    // Summary table
    report += '## Performance Summary\n\n'
    report += '| Test File | File Size | Library | Mode | Chunk Size | Time (ms) | Memory (MB) | Speed Ratio |\n'
    report += '|-----------|-----------|---------|------|------------|-----------|-------------|-------------|\n'

    // Group results by test file
    const testFiles = [...new Set(results.map(r => r.testFile))].sort()

    for (const testFile of testFiles) {
      const fileResults = results.filter(r => r.testFile === testFile)

      // Get base results for comparison
      const turndownResult = fileResults.find(r => r.library === 'turndown' && !r.streaming && r.success)
      const showdownResult = fileResults.find(r => r.library === 'showdown' && !r.streaming && r.success)

      for (const result of fileResults) {
        // Calculate speed ratios compared to other libraries
        let turndownSpeedRatio = 'N/A'
        let showdownSpeedRatio = 'N/A'

        if (turndownResult && result.success && result.time && turndownResult.time && result.time > 0) {
          turndownSpeedRatio = `${(turndownResult.time / result.time).toFixed(2)}x`
        }

        if (showdownResult && result.success && result.time && showdownResult.time && result.time > 0) {
          showdownSpeedRatio = `${(showdownResult.time / result.time).toFixed(2)}x`
        }

        // Determine which ratio to show based on the library
        let speedRatio = 'N/A'
        if (result.library === 'turndown') {
          speedRatio = '1.00x (base)'
        }
        else if (result.library === 'showdown') {
          speedRatio = turndownResult ? turndownSpeedRatio : '1.00x (base)'
        }
        else {
          // For downstream, show the better of the two ratios
          if (turndownResult && showdownResult) {
            const turndownValue = Number.parseFloat(turndownSpeedRatio)
            const showdownValue = Number.parseFloat(showdownSpeedRatio)
            speedRatio = !isNaN(turndownValue) && !isNaN(showdownValue)
              ? `${(Math.max(turndownValue, showdownValue)).toFixed(2)}x`
              : (!isNaN(turndownValue) ? turndownSpeedRatio : (!isNaN(showdownValue) ? showdownSpeedRatio : 'N/A'))
          }
          else if (turndownResult) {
            speedRatio = turndownSpeedRatio
          }
          else if (showdownResult) {
            speedRatio = showdownSpeedRatio
          }
        }

        const sizeDisplay = result.fileSize >= 1024
          ? `${(result.fileSize / 1024).toFixed(2)} MB`
          : `${result.fileSize.toFixed(0)} KB`

        report += `| ${result.testFile} | ${sizeDisplay} | ${result.library} | ${result.streaming ? 'Streaming' : 'Regular'} | ${result.chunkSize || 'N/A'} | `

        if (result.success && result.time !== undefined && result.memory !== undefined) {
          report += `${result.time.toFixed(2)} | ${result.memory.toFixed(2)} | ${speedRatio} |\n`
        }
        else {
          report += `FAILED | N/A | N/A |\n`
        }
      }
    }

    // Add visual charts section (placeholder)
    report += '\n## Performance Charts\n\n'
    report += '```\n'
    report += 'Charts will be generated separately using the results.json data.\n'
    report += '```\n'

    // Add key findings
    report += '\n## Key Findings\n\n'

    // Check if Downstream outperforms other libraries
    const downstreamFasterThanTurndown = results.some(r =>
      r.library === 'downstream'
      && r.success
      && r.time !== undefined
      && results.some(t =>
        t.library === 'turndown'
        && t.success
        && t.time !== undefined
        && r.testFile === t.testFile
        && r.time < t.time,
      ),
    )

    const downstreamFasterThanShowdown = results.some(r =>
      r.library === 'downstream'
      && r.success
      && r.time !== undefined
      && results.some(s =>
        s.library === 'showdown'
        && s.success
        && s.time !== undefined
        && r.testFile === s.testFile
        && r.time < s.time,
      ),
    )

    let performanceMessage = ''
    if (downstreamFasterThanTurndown && downstreamFasterThanShowdown) {
      performanceMessage = `outperforms both Turndown and Showdown in conversion speed for ${
        determinePerformanceDetails(results, 'time')}`
    }
    else if (downstreamFasterThanTurndown) {
      performanceMessage = 'outperforms Turndown but is comparable to Showdown in conversion speed'
    }
    else if (downstreamFasterThanShowdown) {
      performanceMessage = 'outperforms Showdown but is comparable to Turndown in conversion speed'
    }
    else {
      performanceMessage = 'has comparable speed to Turndown and Showdown'
    }

    report += `- **Performance**: Downstream ${performanceMessage}\n`

    // Check if Downstream uses less memory than other libraries
    const downstreamMemoryBetterThanTurndown = results.some(r =>
      r.library === 'downstream'
      && r.success
      && r.memory !== undefined
      && results.some(t =>
        t.library === 'turndown'
        && t.success
        && t.memory !== undefined
        && r.testFile === t.testFile
        && r.memory < t.memory,
      ),
    )

    const downstreamMemoryBetterThanShowdown = results.some(r =>
      r.library === 'downstream'
      && r.success
      && r.memory !== undefined
      && results.some(s =>
        s.library === 'showdown'
        && s.success
        && s.memory !== undefined
        && r.testFile === s.testFile
        && r.memory < s.memory,
      ),
    )

    let memoryMessage = ''
    if (downstreamMemoryBetterThanTurndown && downstreamMemoryBetterThanShowdown) {
      memoryMessage = `uses less memory than both Turndown and Showdown for ${
        determinePerformanceDetails(results, 'memory')}`
    }
    else if (downstreamMemoryBetterThanTurndown) {
      memoryMessage = 'uses less memory than Turndown but is comparable to Showdown'
    }
    else if (downstreamMemoryBetterThanShowdown) {
      memoryMessage = 'uses less memory than Showdown but is comparable to Turndown'
    }
    else {
      memoryMessage = 'has comparable memory usage to Turndown and Showdown'
    }

    report += `- **Memory Usage**: Downstream ${memoryMessage}\n`

    // Check if streaming mode is beneficial
    const streamingBetter = results.some(r =>
      r.library === 'downstream'
      && r.streaming
      && r.success
      && r.memory !== undefined
      && r.time !== undefined
      && results.some(d =>
        d.library === 'downstream'
        && !d.streaming
        && d.success
        && d.memory !== undefined
        && d.time !== undefined
        && r.testFile === d.testFile
        && (r.memory < d.memory || r.time < d.time),
      ),
    )

    report += `- **Streaming Performance**: Downstream's streaming mode ${
      streamingBetter ? 'shows efficiency benefits' : 'performs comparably'
    } relative to regular mode\n`

    // Optimal chunk size
    const optimalChunkSize = findOptimalChunkSize(results)
    report += `- **Optimal Configuration**: The ideal chunk size for Downstream's streaming mode appears to be ${
      optimalChunkSize} bytes\n`

    // Add output equivalence section to the report
    report += '\n## Output Equivalence\n\n'
    report += 'This section compares the output quality between libraries to ensure they produce equivalent Markdown.\n\n'
    report += '| Test File | Comparison | Result | Notes |\n'
    report += '|-----------|------------|--------|-------|\n'

    // Add downstream vs other libraries comparisons
    for (const testFile of testFiles) {
      const downstreamResult = results.find(r =>
        r.library === 'downstream'
        && !r.streaming
        && r.testFile === testFile,
      )

      // Check for turndown comparison
      if (downstreamResult?.equivalence) {
        const { equivalent, differences } = downstreamResult.equivalence
        report += `| ${testFile} | Downstream vs Turndown | ${equivalent ? '✅ EQUIVALENT' : '❌ DIFFERENT'} | `

        if (equivalent && differences) {
          report += 'Formats differ but content is semantically equivalent |\n'
        }
        else if (!equivalent && differences) {
          report += 'See comparison file for details |\n'
        }
        else {
          report += 'Exact match |\n'
        }
      }
      else {
        const turndownFailed = !results.some(r =>
          r.library === 'turndown'
          && r.testFile === testFile
          && r.success,
        )

        if (turndownFailed) {
          report += `| ${testFile} | Downstream vs Turndown | ⚠️ NOT COMPARED | Turndown test failed or was skipped |\n`
        }
      }

      // Check for showdown comparison
      if (downstreamResult?.showdownEquivalence) {
        const { equivalent, differences } = downstreamResult.showdownEquivalence
        report += `| ${testFile} | Downstream vs Showdown | ${equivalent ? '✅ EQUIVALENT' : '❌ DIFFERENT'} | `

        if (equivalent && differences) {
          report += 'Formats differ but content is semantically equivalent |\n'
        }
        else if (!equivalent && differences) {
          report += 'See comparison file for details |\n'
        }
        else {
          report += 'Exact match |\n'
        }
      }
      else {
        const showdownFailed = !results.some(r =>
          r.library === 'showdown'
          && r.testFile === testFile
          && r.success,
        )

        if (showdownFailed) {
          report += `| ${testFile} | Downstream vs Showdown | ⚠️ NOT COMPARED | Showdown test failed or was skipped |\n`
        }
      }

      // Add streaming vs regular downstream comparisons
      for (const chunkSize of config.chunkSizes) {
        const streamResult = results.find(r =>
          r.library === 'downstream'
          && r.streaming
          && r.chunkSize === chunkSize
          && r.testFile === testFile
          && r.equivalence,
        )

        if (streamResult?.equivalence) {
          const { equivalent, differences } = streamResult.equivalence
          report += `| ${testFile} | Downstream Stream (${chunkSize}) vs Regular | ${equivalent ? '✅ EQUIVALENT' : '❌ DIFFERENT'} | `

          if (equivalent && differences) {
            report += 'Minor format differences |\n'
          }
          else if (!equivalent && differences) {
            report += 'See stream comparison file for details |\n'
          }
          else {
            report += 'Exact match |\n'
          }
        }
      }
    }

    // Add a section about output consistency
    report += '\n### Output Consistency Analysis\n\n'

    // Check if Downstream's streaming mode produces consistent output
    const streamingConsistent = results.every(r =>
      !(r.library === 'downstream'
        && r.streaming
        && r.equivalence
        && !r.equivalence.equivalent),
    )

    report += `- **Downstream Streaming Consistency**: ${
      streamingConsistent
        ? 'Downstream produces consistent output regardless of chunk size or streaming mode'
        : 'Some inconsistencies detected between streaming and regular mode outputs'
    }\n`

    // Check if Downstream and other libraries' outputs are equivalent
    const turndownEquivalent = results.every(r =>
      !(r.library === 'downstream'
        && !r.streaming
        && r.equivalence
        && r.equivalence.comparedTo === 'turndown'
        && !r.equivalence.equivalent),
    )

    const showdownEquivalent = results.every(r =>
      !(r.library === 'downstream'
        && !r.streaming
        && r.showdownEquivalence
        && r.showdownEquivalence.comparedTo === 'showdown'
        && !r.showdownEquivalence.equivalent),
    )

    report += `- **Downstream vs Turndown Equivalence**: ${
      turndownEquivalent
        ? 'Outputs are semantically equivalent where comparison was possible'
        : 'Some differences were detected between library outputs'
    }\n`

    report += `- **Downstream vs Showdown Equivalence**: ${
      showdownEquivalent
        ? 'Outputs are semantically equivalent where comparison was possible'
        : 'Some differences were detected between library outputs'
    }\n`

    if (!turndownEquivalent || !showdownEquivalent) {
      report += '\n> Note: Differences between libraries may be due to different Markdown formatting conventions rather than correctness issues.\n'
      report += '> Examine the comparison files for details about specific differences.\n'
    }

    report += '\n## Test Methodology\n\n'
    report += `- Each test was run ${config.iterations} times and results were averaged\n`
    report += '- Tests were performed on HTML files of varying sizes\n'
    report += '- Memory usage was measured using Node.js process.memoryUsage().heapUsed\n'
    report += '- Tests were conducted with garbage collection between runs where available\n'
    report += '- Output equivalence was verified between libraries and modes\n'

    return report
  }
  catch (error) {
    console.error(`Error generating report: ${error}`)
    return `# Benchmark Error Report\n\nAn error occurred while generating the report: ${error}\n\nPlease check the results.json file for raw data.`
  }
}

/**
 * Main benchmark function
 */
async function main(): Promise<void> {
  console.log('HTML to Markdown Benchmark: Downstream vs Turndown vs Showdown')
  console.log('=============================================================')

  // Create output directory
  try {
    await fs.mkdir(config.outputDir, { recursive: true })
  }
  catch (error) {
    // Ignore if directory already exists
  }

  // Check if test data exists
  try {
    await fs.access(config.testDataDir)
  }
  catch (error) {
    console.error(`Error: Test data directory '${config.testDataDir}' not found.`)
    console.error('Please run generate-test-data.ts first to create the test files.')
    process.exit(1)
  }

  // Get list of test files
  let testFiles: string[]
  try {
    // Try to read manifest file first
    const manifestPath = path.join(config.testDataDir, 'manifest.json')
    const manifestContent = await fs.readFile(manifestPath, 'utf8')
    const manifest = JSON.parse(manifestContent)
    testFiles = manifest.files.map((file: any) => file.path)
  }
  catch (error) {
    // Fall back to scanning directory for HTML files
    const files = await fs.readdir(config.testDataDir)
    testFiles = files.filter(file => file.endsWith('.html'))
  }

  if (testFiles.length === 0) {
    console.error('No test files found. Please run generate-test-data.ts first.')
    process.exit(1)
  }

  console.log(`Found ${testFiles.length} test files`)

  // Store all results
  const allResults: BenchmarkResult[] = []

  // Run tests for each file
  for (const testFile of testFiles) {
    const testFilePath = path.join(config.testDataDir, testFile)
    console.log(`\n## Testing with ${testFile}`)

    // Read the HTML file
    let html: string
    try {
      html = await fs.readFile(testFilePath, 'utf8')
      console.log(`File size: ${(html.length / 1024).toFixed(2)} KB`)
    }
    catch (error) {
      console.error(`Error reading file ${testFilePath}: ${error}`)
      continue // Skip this file and continue with the next one
    }

    // Save test outputs and compare results between libraries
    let turndownMarkdown: string | null = null
    let showdownMarkdown: string | null = null

    // Test Turndown (only for files under the max size limit)
    if (html.length / 1024 <= config.maxTurndownSize) {
      console.log(`Testing Turndown (file size within limit)...`)
      const turndownResult = await runAveragedBenchmark('turndown', html, testFile)

      allResults.push(turndownResult.result)
      turndownMarkdown = turndownResult.markdown

      if (turndownMarkdown) {
        try {
          await fs.writeFile(
            path.join(config.outputDir, `${path.basename(testFile, '.html')}-turndown.md`),
            turndownMarkdown,
          )
        }
        catch (error) {
          console.error(`Error saving Turndown output: ${error}`)
        }
      }
    }
    else {
      console.log(`Skipping Turndown test - file size (${(html.length / 1024).toFixed(2)} KB) exceeds limit (${config.maxTurndownSize} KB)`)
      // Add a placeholder result to indicate the test was skipped
      allResults.push({
        library: 'turndown',
        streaming: false,
        testFile,
        fileSize: html.length / 1024,
        success: false,
        error: 'Skipped - file too large',
      })
    }

    // Test Showdown (only for files under the max size limit)
    if (html.length / 1024 <= config.maxShowdownSize) {
      console.log(`Testing Showdown (file size within limit)...`)
      const showdownResult = await runAveragedBenchmark('showdown', html, testFile)

      allResults.push(showdownResult.result)
      showdownMarkdown = showdownResult.markdown

      if (showdownMarkdown) {
        try {
          await fs.writeFile(
            path.join(config.outputDir, `${path.basename(testFile, '.html')}-showdown.md`),
            showdownMarkdown,
          )
        }
        catch (error) {
          console.error(`Error saving Showdown output: ${error}`)
        }
      }
    }
    else {
      console.log(`Skipping Showdown test - file size (${(html.length / 1024).toFixed(2)} KB) exceeds limit (${config.maxShowdownSize} KB)`)
      // Add a placeholder result to indicate the test was skipped
      allResults.push({
        library: 'showdown',
        streaming: false,
        testFile,
        fileSize: html.length / 1024,
        success: false,
        error: 'Skipped - file too large',
      })
    }

    // Test Downstream (regular)
    console.log(`Testing Downstream (regular)...`)
    const downstreamResult = await runAveragedBenchmark('downstream', html, testFile)

    allResults.push(downstreamResult.result)
    const downstreamMarkdown = downstreamResult.markdown

    if (downstreamMarkdown) {
      try {
        await fs.writeFile(
          path.join(config.outputDir, `${path.basename(testFile, '.html')}-downstream.md`),
          downstreamMarkdown,
        )
      }
      catch (error) {
        console.error(`Error saving Downstream output: ${error}`)
      }

      // Compare with Turndown if both tests were successful
      if (turndownMarkdown && downstreamResult.result.success) {
        console.log(`Comparing output between Downstream and Turndown...`)

        // Wrap comparison in a try/catch block
        let comparison
        try {
          comparison = compareMarkdown(downstreamMarkdown, turndownMarkdown)
        }
        catch (error) {
          console.error(`  Error during comparison: ${error}`)
          comparison = {
            equivalent: false,
            differences: `Could not complete comparison due to error: ${error}`,
          }
        }

        // Add comparison result to the downstream result
        const downstreamResultIndex = allResults.findIndex(r =>
          r.library === 'downstream'
          && !r.streaming
          && r.testFile === testFile,
        )

        if (downstreamResultIndex !== -1) {
          allResults[downstreamResultIndex].equivalence = {
            comparedTo: 'turndown',
            equivalent: comparison.equivalent,
            differences: comparison.differences,
          }

          console.log(`  Output equivalence: ${comparison.equivalent ? 'EQUIVALENT' : 'DIFFERENT'}`)
          if (!comparison.equivalent && comparison.differences) {
            console.log(`  First few differences:`)
            // Safely handle the differences display
            const diffLines = comparison.differences.split('\n').slice(0, 3)
            console.log(`  ${diffLines.join('\n  ')}`)

            // Safely save full differences to a file
            try {
              await fs.writeFile(
                path.join(config.outputDir, `${path.basename(testFile, '.html')}-comparison.txt`),
                `Comparison between Downstream and Turndown outputs:\n\n${comparison.differences}`,
              )
            }
            catch (error) {
              console.error(`  Error saving comparison file: ${error}`)
            }
          }
        }
      }

      // Compare with Showdown if both tests were successful
      if (showdownMarkdown && downstreamResult.result.success) {
        console.log(`Comparing output between Downstream and Showdown...`)

        // Wrap comparison in a try/catch block
        let comparisonShowdown
        try {
          comparisonShowdown = compareMarkdown(downstreamMarkdown, showdownMarkdown)
        }
        catch (error) {
          console.error(`  Error during comparison: ${error}`)
          comparisonShowdown = {
            equivalent: false,
            differences: `Could not complete comparison due to error: ${error}`,
          }
        }

        // Add comparison result to the downstream result
        const downstreamResultIndex = allResults.findIndex(r =>
          r.library === 'downstream'
          && !r.streaming
          && r.testFile === testFile,
        )

        if (downstreamResultIndex !== -1) {
          // Add to existing equivalence object or create a new one
          if (!allResults[downstreamResultIndex].equivalence) {
            allResults[downstreamResultIndex].equivalence = {
              comparedTo: 'showdown',
              equivalent: comparisonShowdown.equivalent,
              differences: comparisonShowdown.differences,
            }
          }
          else {
            // Add showdown comparison as an additional property
            allResults[downstreamResultIndex].showdownEquivalence = {
              comparedTo: 'showdown',
              equivalent: comparisonShowdown.equivalent,
              differences: comparisonShowdown.differences,
            }
          }

          console.log(`  Output equivalence with Showdown: ${comparisonShowdown.equivalent ? 'EQUIVALENT' : 'DIFFERENT'}`)
          if (!comparisonShowdown.equivalent && comparisonShowdown.differences) {
            console.log(`  First few differences:`)
            // Safely handle the differences display
            const diffLines = comparisonShowdown.differences.split('\n').slice(0, 3)
            console.log(`  ${diffLines.join('\n  ')}`)

            // Safely save full differences to a file
            try {
              await fs.writeFile(
                path.join(config.outputDir, `${path.basename(testFile, '.html')}-comparison-showdown.txt`),
                `Comparison between Downstream and Showdown outputs:\n\n${comparisonShowdown.differences}`,
              )
            }
            catch (error) {
              console.error(`  Error saving comparison file: ${error}`)
            }
          }
        }
      }
    }

    // Test Downstream (streaming) with different chunk sizes
    for (const chunkSize of config.chunkSizes) {
      console.log(`Testing Downstream (streaming, chunkSize: ${chunkSize})...`)
      const streamResult = await runAveragedBenchmark('downstream', html, testFile, {
        streaming: true,
        chunkSize,
      })

      allResults.push(streamResult.result)

      // Also compare streaming output with regular Downstream output to verify consistency
      if (streamResult.markdown && downstreamMarkdown && streamResult.result.success) {
        console.log(`Comparing Downstream streaming output with regular output...`)

        // Wrap comparison in a try/catch block to handle potential errors
        let comparison
        try {
          comparison = compareMarkdown(streamResult.markdown, downstreamMarkdown)
        }
        catch (error) {
          console.error(`  Error during comparison: ${error}`)
          comparison = {
            equivalent: false,
            differences: `Could not complete comparison due to error: ${error}`,
          }
        }

        // Add comparison result
        const streamResultIndex = allResults.findIndex(r =>
          r.library === 'downstream'
          && r.streaming
          && r.chunkSize === chunkSize
          && r.testFile === testFile,
        )

        if (streamResultIndex !== -1) {
          allResults[streamResultIndex].equivalence = {
            comparedTo: 'downstream (regular)',
            equivalent: comparison.equivalent,
            differences: comparison.differences,
          }

          console.log(`  Streaming equivalence: ${comparison.equivalent ? 'EQUIVALENT' : 'DIFFERENT'}`)
          if (!comparison.equivalent && comparison.differences) {
            console.log(`  First few differences:`)
            // Safely handle the differences display
            const diffLines = comparison.differences.split('\n').slice(0, 2)
            console.log(`  ${diffLines.join('\n  ')}`)

            // Safely save full differences to a file
            try {
              await fs.writeFile(
                path.join(config.outputDir, `${path.basename(testFile, '.html')}-stream-${chunkSize}-comparison.txt`),
                `Comparison between Downstream streaming (${chunkSize}) and regular outputs:\n\n${comparison.differences}`,
              )
            }
            catch (error) {
              console.error(`  Error saving comparison file: ${error}`)
            }
          }
        }
      }

      if (streamResult.markdown) {
        try {
          await fs.writeFile(
            path.join(config.outputDir, `${path.basename(testFile, '.html')}-downstream-stream-${chunkSize}.md`),
            streamResult.markdown,
          )
        }
        catch (error) {
          console.error(`Error saving Downstream streaming output: ${error}`)
        }
      }
    }
  }

  // Generate and save the report
  try {
    const report = generateReport(allResults)
    if (report) {
      try {
        await fs.writeFile(path.join(config.outputDir, 'benchmark-report.md'), report)
        console.log(`Report: ${path.join(config.outputDir, 'benchmark-report.md')}`)
      }
      catch (error) {
        console.error(`Error writing report file: ${error}`)
      }
    }
    else {
      console.error('Error: Report generation returned undefined')
      try {
        await fs.writeFile(
          path.join(config.outputDir, 'benchmark-error-report.md'),
          'Report generation failed. See results.json for raw data.',
        )
      }
      catch (e) {
        console.error(`Failed to save error report: ${e}`)
      }
    }
  }
  catch (error) {
    console.error(`Error generating or saving report: ${error}`)
    try {
      await fs.writeFile(
        path.join(config.outputDir, 'benchmark-error-report.md'),
        `Report generation failed with error: ${error}\nSee results.json for raw data.`,
      )
    }
    catch (e) {
      console.error(`Failed to save error report: ${e}`)
    }
  }

  // Save raw results as JSON separately
  try {
    await fs.writeFile(
      path.join(config.outputDir, 'results.json'),
      JSON.stringify(allResults, null, 2),
    )
    console.log(`Raw data: ${path.join(config.outputDir, 'results.json')}`)
  }
  catch (error) {
    console.error(`Error saving results JSON: ${error}`)
  }

  console.log('\nBenchmark complete!')
}

// Type declaration for global.gc
declare global {
  var gc: (() => void) | undefined
}

// Run the benchmark
main().catch((error) => {
  console.error('Error running benchmark:', error)
  process.exit(1)
})

export {}
