#!/usr/bin/env node
import { Readable } from 'node:stream'
import { streamHtmlToMarkdown } from 'mdream'

const USAGE = 'Usage: mdream [--origin <url>] [--preset minimal] [--wrap-width <n>] [--format markdown|text|html] [--text]\nPipe HTML via stdin, outputs Markdown, plain text, or safe HTML to stdout.\n'

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const args = process.argv.slice(2)
let origin
let preset
let wrapWidth
let format
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  // `--flag=value` and `--flag value` both work.
  const eq = arg.startsWith('--') ? arg.indexOf('=') : -1
  const flag = eq === -1 ? arg : arg.slice(0, eq)
  const takeValue = () => {
    const value = eq === -1 ? args[++i] : arg.slice(eq + 1)
    // A following flag, such as `--text` or `-h`, is not a value.
    if (!value || (eq === -1 && (value.startsWith('--') || value === '-h')))
      fail(`The ${flag} option needs a value.`)
    return value
  }
  if (flag === '--origin') {
    origin = takeValue()
  }
  else if (flag === '--preset') {
    preset = takeValue()
    if (preset !== 'minimal')
      fail(`Unknown preset: ${preset}. Use --preset minimal.`)
  }
  else if (flag === '--wrap-width') {
    wrapWidth = Number.parseInt(takeValue(), 10) || undefined
  }
  else if (flag === '--format') {
    format = takeValue()
    if (format !== 'markdown' && format !== 'text' && format !== 'html')
      fail(`Unknown format: ${format}. Use markdown, text, or html.`)
  }
  else if (flag === '--text') {
    if (eq !== -1)
      fail('The --text option takes no value.')
    format = 'text'
  }
  else if (arg === '-h' || arg === '--help') {
    process.stdout.write(USAGE)
    process.exit(0)
  }
  else if (arg.startsWith('-')) {
    fail(`Unknown option: ${flag}. Run mdream --help to list the options.`)
  }
  else {
    fail(`Unknown argument: ${arg}. Pipe the HTML to mdream on stdin.`)
  }
}

const options = { origin, minimal: preset === 'minimal', wrapWidth, format }
const stream = Readable.toWeb(process.stdin)
for await (const chunk of streamHtmlToMarkdown(stream, options)) {
  if (chunk?.length)
    process.stdout.write(chunk)
}
