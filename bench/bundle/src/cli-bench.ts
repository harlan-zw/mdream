import { Readable } from 'node:stream'
import { streamHtmlToMarkdown } from '../../../packages/mdream/src'

async function run() {
  for await (const chunk of streamHtmlToMarkdown(Readable.toWeb(process.stdin))) {
    process.stdout.write(chunk)
  }
}

run()
