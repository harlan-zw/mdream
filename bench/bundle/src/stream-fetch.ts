import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import { streamHtmlToMarkdown } from '../../../src'

async function run() {
  // read times to run it from command line argument
  const times = Number.parseInt(process.argv[2], 10) || 1
  const start = performance.now()
  // extend the timings
  for (let i = 0; i < times; i++) {
    const response = await fetch('https://en.wikipedia.org/wiki/List_of_chiropterans')
    // create a read stream for ../elon.html
    const write = createWriteStream(resolve(import.meta.dirname, '../dist/wiki.md'), { encoding: 'utf-8' })
    for await (const _ of streamHtmlToMarkdown(response.body)) {
      write.write(_)
    }
    write.close()
  }
  const end = performance.now()
  const duration = end - start
  console.log(`\n\nFetched and converted ${times} times in ${duration.toFixed(2)} ms`)
}

run()
