import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { syncHtmlToMarkdown } from '../../../src'

async function run() {
  // read times to run it from command line argument
  const times = Number.parseInt(process.argv[2], 10) || 1
  const start = performance.now()
  // extend the timings
  for (let i = 0; i < times; i++) {
    const response = await fetch('https://en.wikipedia.org/wiki/List_of_chiropterans')
    // create a read stream for ../elon.html
    // create a read stream for ../elon.html
    const html = await response.text()
    await writeFile(resolve(import.meta.dirname, '../dist/wiki.md'), await syncHtmlToMarkdown(html), { encoding: 'utf-8' })
  }
  const end = performance.now()
  const duration = end - start
  console.log(`\n\nFetched and converted ${times} times in ${duration.toFixed(2)} ms`)
  // dump memory usage
  const memory = process.memoryUsage()
  console.log(`Memory usage: ${Math.round(memory.rss / 1024 / 1024)} MB`)
}

run()
