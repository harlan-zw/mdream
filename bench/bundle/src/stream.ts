import { createReadStream, createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { streamHtmlToMarkdown } from '../../../src/stream'

async function run() {
  // read times to run it from command line argument
  const times = Number.parseInt(process.argv[2], 10) || 1
  const start = performance.now()
  // extend the timings
  for (let i = 0; i < times; i++) {
    logMemoryUsage('before stream creation')
    // create a read stream for ../elon.html
    const write = createWriteStream(resolve(import.meta.dirname, '../dist/wiki.md'), { encoding: 'utf-8' })
    const read = createReadStream(resolve(import.meta.dirname, '../wiki.html'), { encoding: 'utf-8' })
    read.pipe(write)
    let len = 0
    for await (const _ of streamHtmlToMarkdown(Readable.toWeb(read))) {
      len += _.length
      write.write(_)
    }
    write.close()
    logMemoryUsage('after stream processing')
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
