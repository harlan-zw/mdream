import type { MdreamOptions } from './types'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { cac } from 'cac'
import { dirname, join } from 'pathe'
import { streamHtmlToMarkdown } from './index'

import { withMinimalPreset } from './preset/minimal'

interface CliOptions {
  origin?: string
  preset?: string
  wrapWidth?: number
  format?: 'markdown' | 'text'
  text?: boolean
}

async function streamingConvert(options: CliOptions = {}) {
  const format = options.text ? 'text' : options.format
  if (format && format !== 'markdown' && format !== 'text') {
    process.stderr.write(`Unknown format: ${format}\n`)
    process.exitCode = 1
    return
  }

  let conversionOptions: Partial<MdreamOptions> = {
    origin: options.origin,
    wrapWidth: options.wrapWidth ? Number(options.wrapWidth) || undefined : undefined,
    format,
  }

  if (options.preset === 'minimal') {
    conversionOptions = withMinimalPreset(conversionOptions)
  }

  const markdownGenerator = streamHtmlToMarkdown(Readable.toWeb(process.stdin) as any, conversionOptions)

  for await (const markdownChunk of markdownGenerator) {
    if (markdownChunk && markdownChunk.length > 0) {
      process.stdout.write(markdownChunk)
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
  .option('--format <format>', 'Output format: markdown, text')
  .option('--text', 'Alias for --format text')
  .action(async (_, opts) => {
    await streamingConvert(opts)
  })

cli
  .help()
  .version(packageJson.version)
  .parse()
