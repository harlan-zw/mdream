import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { syncHtmlToMarkdown } from '../../../src'

async function run() {
  // read times to run it from command line argument
  const times = Number.parseInt(process.argv[2], 10) || 1
  const start = performance.now()
  // extend the timings
  for (let i = 0; i < times; i++) {
    logMemoryUsage('before await creation')
    // create a read stream for ../elon.html
    const html = await readFile(resolve(import.meta.dirname, '../wiki.html'), { encoding: 'utf-8' })
    await writeFile(resolve(import.meta.dirname, '../dist/wiki.md'), syncHtmlToMarkdown(html), { encoding: 'utf-8' })
    logMemoryUsage('after await creation')
  }
  const end = performance.now()
  const duration = end - start
  console.log(`\n\nFetched and converted ${times} times in ${duration.toFixed(2)} ms`)
}

function logMemoryUsage(label) {
  const memUsage = process.memoryUsage()
  console.log(`Memory usage (${label}):
    RSS: ${Math.round(memUsage.rss / 1024 / 1024)} MB
    Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB
    Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB
    External: ${Math.round(memUsage.external / 1024 / 1024)} MB
    ArrayBuffers: ${Math.round(memUsage.arrayBuffers / 1024 / 1024)} MB`,
  )
}

run()
