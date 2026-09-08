import type { MdreamOptions } from './types'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { cac } from 'cac'
import { dirname, join } from 'pathe'
import { streamHtmlToSafeHtml } from './html'
import { streamHtmlToMarkdown } from './index'
import { withMinimalPreset } from './preset/minimal'
import { streamHtmlToText } from './text'

interface CliOptions {
  origin?: string
  preset?: string
  wrapWidth?: number
  format?: 'markdown' | 'text' | 'html'
  text?: boolean
}

async function streamingConvert(options: CliOptions = {}) {
  const format = options.text ? 'text' : options.format
  if (format && format !== 'markdown' && format !== 'text' && format !== 'html') {
    process.stderr.write(`Unknown format: ${format}\n`)
    process.exitCode = 1
    return
  }

  let conversionOptions: Partial<MdreamOptions> = {
    origin: options.origin,
    wrapWidth: options.wrapWidth ? Number(options.wrapWidth) || undefined : undefined,
  }

  if (options.preset === 'minimal') {
    conversionOptions = withMinimalPreset(conversionOptions)
  }

  const convert = format === 'text'
    ? streamHtmlToText
    : format === 'html'
      ? streamHtmlToSafeHtml
      : streamHtmlToMarkdown
  const output = convert(Readable.toWeb(process.stdin) as any, conversionOptions)

  for await (const chunk of output) {
    if (chunk && chunk.length > 0) {
      process.stdout.write(chunk)
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

const cli = cac()

cli.command('[options]', 'Convert HTML from stdin to Markdown on stdout (JS engine)')
  .option('--origin <url>', 'Origin URL for resolving relative image paths')
  .option('--preset <preset>', 'Conversion presets: minimal')
  .option('--wrap-width <n>', 'Hard-wrap prose at <n> characters on word boundaries')
  .option('--format <format>', 'Output format: markdown, text, html')
  .option('--text', 'Alias for --format text')
  .action(async (_, opts) => {
    await streamingConvert(opts)
  })

cli
  .help()
  .version(packageJson.version)
  .parse()
