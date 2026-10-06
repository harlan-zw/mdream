import type { CAC } from 'cac'
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

  if (options.preset !== undefined) {
    if (options.preset !== 'minimal') {
      process.stderr.write(`Unknown preset: ${options.preset}. Use --preset minimal.\n`)
      process.exitCode = 1
      return
    }
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

const LEADING_DASHES_RE = /^-+/
const KEBAB_RE = /([a-z])-([a-z])/g

function camelcase(name: string): string {
  return name.replace(KEBAB_RE, (_, a: string, b: string) => a + b.toUpperCase())
}

// cac camelCases flag names, so `--clean-urls` arrives as `cleanUrls`.
// Find the flag as the user typed it.
function typedFlag(name: string, argv: readonly string[]): string {
  for (const arg of argv) {
    if (arg === '--')
      break
    if (arg.charCodeAt(0) !== 45)
      continue
    const flag = arg.split('=', 1)[0]!
    const bare = flag.replace(LEADING_DASHES_RE, '').split('.', 1)[0]!
    // `--no-x` sets `x` to false.
    if (camelcase(bare) === name || (bare.startsWith('no-') && camelcase(bare.slice(3)) === name))
      return flag
  }
  return name.length > 1 ? `--${name}` : `-${name}`
}

// cac throws a CACError with a stack trace and a camelCased flag name. Check
// the flags first, so the user gets one line that names the flag as typed.
function usageError(cli: CAC, argv: readonly string[]): string | undefined {
  const command = cli.matchedCommand
  if (!command)
    return
  for (const name in cli.options) {
    if (name !== '--' && !command.hasOption(name) && !cli.globalCommand.hasOption(name))
      return `Unknown option: ${typedFlag(name, argv)}. Run mdream-js --help to list the options.`
  }
  for (const option of command.options) {
    const value = cli.options[option.name]
    if (!option.required)
      continue
    // cac reads `--no-origin` as `origin: false`. A value option has no negated form.
    if (value === false)
      return `Unknown option: ${typedFlag(option.name, argv)}. Run mdream-js --help to list the options.`
    if (value === true || value === '')
      return `The ${typedFlag(option.name, argv)} option needs a value.`
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
  .parse(process.argv, { run: false })

const error = usageError(cli, process.argv.slice(2))
if (error) {
  process.stderr.write(`${error}\n`)
  process.exitCode = 1
}
else {
  await cli.runMatchedCommand()
}
