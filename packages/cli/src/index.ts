import type { MdreamOptions } from 'mdream'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { generateLlmsTxtArtifacts, processHtmlFiles } from '@mdream/llms-txt'
import { cac } from 'cac'
import { htmlToMarkdown, streamHtmlToMarkdown } from 'mdream'
import { dirname, join, resolve } from 'pathe'

interface CliOptions {
  origin?: string
  preset?: string
}

interface LlmsOptions {
  patterns: string[]
  siteName?: string
  description?: string
  output: string
  artifacts?: string
  origin?: string
}

async function streamingConvert(options: CliOptions = {}) {
  const conversionOptions: Partial<MdreamOptions> = {
    origin: options.origin,
  }

  const markdownGenerator = streamHtmlToMarkdown(Readable.toWeb(process.stdin) as any, conversionOptions)

  for await (const markdownChunk of markdownGenerator) {
    if (markdownChunk && markdownChunk.length > 0) {
      process.stdout.write(markdownChunk)
    }
  }
}

async function generateLlms(patterns: string[], options: LlmsOptions) {
  try {
    const artifacts = options.artifacts ? options.artifacts.split(',').map(a => a.trim()) : ['llms.txt', 'llms-full.txt', 'markdown']
    const outputDir = resolve(options.output)

    const files = await processHtmlFiles(patterns, (html, url) => {
      let title = ''
      let metaDescription = ''
      htmlToMarkdown(html, {
        origin: url,
        extraction: {
          'title': (el) => {
            if (!title)
              title = el.textContent
          },
          'meta[name="description"]': (el) => {
            if (!metaDescription)
              metaDescription = el.attributes.content || ''
          },
          'meta[property="og:description"]': (el) => {
            if (!metaDescription)
              metaDescription = el.attributes.content || ''
          },
          'meta[property="og:title"]': (el) => {
            if (!title)
              title = el.attributes.content || ''
          },
        },
      })
      const markdown = htmlToMarkdown(html, { origin: url }).markdown
      return {
        markdown,
        metadata: {
          title: title.trim() || undefined,
          description: metaDescription.trim() || undefined,
        },
      }
    }, { origin: options.origin })

    const result = await generateLlmsTxtArtifacts({
      files,
      siteName: options.siteName,
      description: options.description,
      origin: options.origin,
      generateFull: artifacts.includes('llms-full.txt'),
      generateMarkdown: artifacts.includes('markdown'),
    })

    await mkdir(outputDir, { recursive: true })

    const llmsPath = join(outputDir, 'llms.txt')
    await writeFile(llmsPath, result.llmsTxt, 'utf-8')

    if (artifacts.includes('llms-full.txt') && result.llmsFullTxt) {
      const fullPath = join(outputDir, 'llms-full.txt')
      await writeFile(fullPath, result.llmsFullTxt, 'utf-8')
    }

    if (artifacts.includes('markdown') && result.markdownFiles) {
      for (const mdFile of result.markdownFiles) {
        const fullPath = join(outputDir, mdFile.path)
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, mdFile.content, 'utf-8')
      }
    }

    console.log(`Generated llms.txt artifacts in: ${outputDir}`)
  }
  catch (error) {
    console.error('Error generating llms.txt:', error)
    process.exit(1)
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = packageJson.version

const cli = cac()

cli.command('[options]', 'Convert HTML from stdin to Markdown on stdout')
  .option('--origin <url>', 'Origin URL for resolving relative image paths')
  .option('--preset <preset>', 'Conversion presets: minimal')
  .action(async (_, opts) => {
    await streamingConvert(opts)
  })

cli.command('llms <patterns...>', 'Generate llms.txt artifacts from HTML files')
  .option('--site-name <name>', 'Name of the site for llms.txt header')
  .option('--description <desc>', 'Description of the site for llms.txt')
  .option('--origin <url>', 'Origin URL for resolving relative paths and generating absolute URLs')
  .option('-o, --output <dir>', 'Output directory for generated files', { default: process.cwd() })
  .option('--artifacts <list>', 'Comma-separated list of artifacts to generate: llms.txt,llms-full.txt,markdown', { default: 'llms.txt,llms-full.txt,markdown' })
  .action(async (patterns: string[], opts) => {
    await generateLlms(patterns, { patterns, ...opts })
  })

cli
  .help()
  .version(version)
  .parse()
