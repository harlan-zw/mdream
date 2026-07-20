#!/usr/bin/env node
import { Readable } from 'node:stream'
import { streamHtmlToMarkdown } from 'mdream'

const args = process.argv.slice(2)
let origin
let preset
let wrapWidth
let format
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--origin' && args[i + 1]) {
    origin = args[++i]
  }
  else if (args[i] === '--preset' && args[i + 1]) {
    preset = args[++i]
  }
  else if (args[i] === '--wrap-width' && args[i + 1]) {
    wrapWidth = Number.parseInt(args[++i], 10) || undefined
  }
  else if (args[i] === '--format') {
    const value = args[++i]
    if (!value) {
      process.stderr.write('--format requires a value: markdown or text\n')
      process.exit(1)
    }
    if (value !== 'markdown' && value !== 'text') {
      process.stderr.write(`Unknown format: ${value}\n`)
      process.exit(1)
    }
    format = value
  }
  else if (args[i] === '--text') {
    format = 'text'
  }
  else if (args[i] === '-h' || args[i] === '--help') {
    process.stdout.write('Usage: mdream [--origin <url>] [--preset minimal] [--wrap-width <n>] [--format markdown|text] [--text]\nPipe HTML via stdin, outputs Markdown or plain text to stdout.\n')
    process.exit(0)
  }
}

const options = { origin, minimal: preset === 'minimal', wrapWidth, format }
const stream = Readable.toWeb(process.stdin)
for await (const chunk of streamHtmlToMarkdown(stream, options)) {
  if (chunk?.length)
    process.stdout.write(chunk)
}
