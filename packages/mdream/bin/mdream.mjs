#!/usr/bin/env node
import { Readable } from 'node:stream'
import { streamHtmlToMarkdown } from 'mdream'

const args = process.argv.slice(2)
let origin
let preset
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--origin' && args[i + 1]) {
    origin = args[++i]
  }
  else if (args[i] === '--preset' && args[i + 1]) {
    preset = args[++i]
  }
  else if (args[i] === '-h' || args[i] === '--help') {
    process.stdout.write('Usage: mdream [--origin <url>] [--preset minimal]\nPipe HTML via stdin, outputs Markdown to stdout.\n')
    process.exit(0)
  }
}

const options = { origin, minimal: preset === 'minimal' }
const stream = Readable.toWeb(process.stdin)
for await (const chunk of streamHtmlToMarkdown(stream, options)) {
  if (chunk?.length)
    process.stdout.write(chunk)
}
