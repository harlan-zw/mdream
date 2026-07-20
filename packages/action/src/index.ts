import type { ProcessedFile } from '@mdream/js/llms-txt'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { getInput, info, setFailed, setOutput } from '@actions/core'
import { generateLlmsTxtArtifacts } from '@mdream/js/llms-txt'
import { htmlToMarkdown } from 'mdream'
import { glob } from 'tinyglobby'
import { pathToUrl } from './utils'

type HtmlFileConverter = (html: string, url: string) => {
  markdown: string
  metadata?: ProcessedFile['metadata']
}

async function processHtmlFiles(
  patterns: string | string[],
  converter: HtmlFileConverter,
  options?: { origin?: string },
): Promise<ProcessedFile[]> {
  const allPatterns = Array.isArray(patterns) ? patterns : [patterns]
  const allFiles: string[] = []

  for (const pattern of allPatterns) {
    const files = await glob(pattern)
    allFiles.push(...files)
  }

  const uniqueFiles = [...new Set(allFiles)]
  const results: ProcessedFile[] = []
  const baseDir = uniqueFiles.length > 0 ? dirname(uniqueFiles[0]!) : '.'

  for (const filePath of uniqueFiles) {
    const html = await readFile(filePath, 'utf-8')
    const url = options?.origin || filePath
    const { markdown, metadata } = converter(html, url)
    const urlPath = pathToUrl(filePath, baseDir)

    results.push({
      filePath,
      title: metadata?.title || basename(filePath, '.html'),
      content: markdown,
      url: urlPath,
      metadata,
    })
  }

  return results
}

export async function main() {
  try {
    // Get inputs
    const globPattern = getInput('glob', { required: true })
    const siteName = getInput('site-name', { required: true })
    const description = getInput('description', { required: true })
    const origin = getInput('origin', { required: true })
    const output = getInput('output') || '.'
    const chunkSize = getInput('chunk-size') || '4096'
    const verbose = getInput('verbose') === 'true'

    if (verbose) {
      info(`Processing glob pattern: ${globPattern}`)
      info(`Site name: ${siteName}`)
      info(`Description: ${description}`)
      info(`Origin: ${origin}`)
      info(`Output directory: ${output}`)
      info(`Chunk size: ${chunkSize}`)
    }

    // Process HTML files into markdown using mdream engine
    const files = await processHtmlFiles(globPattern, (html, url) => {
      let title = ''
      let metaDescription = ''
      // Extract metadata
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
      const markdown = htmlToMarkdown(html, { origin: url })
      return {
        markdown,
        metadata: {
          title: title.trim() || undefined,
          description: metaDescription.trim() || undefined,
        },
      }
    }, { origin })

    // Generate llms.txt artifacts
    const result = await generateLlmsTxtArtifacts({
      files,
      siteName,
      description,
      origin,
      generateFull: true,
      generateMarkdown: true,
    })

    // Ensure output directory exists
    await mkdir(output, { recursive: true })

    // Write llms.txt file
    const llmsTxtPath = join(output, 'llms.txt')
    await writeFile(llmsTxtPath, result.llmsTxt, 'utf-8')
    setOutput('llms-txt-path', llmsTxtPath)

    // Write llms-full.txt file
    if (result.llmsFullTxt) {
      const llmsFullTxtPath = join(output, 'llms-full.txt')
      await writeFile(llmsFullTxtPath, result.llmsFullTxt, 'utf-8')
      setOutput('llms-full-txt-path', llmsFullTxtPath)
    }

    // Write individual markdown files
    const markdownFiles = []
    if (result.markdownFiles) {
      for (const mdFile of result.markdownFiles) {
        const fullPath = join(output, mdFile.path)
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, mdFile.content, 'utf-8')
        markdownFiles.push(fullPath)
      }
    }

    if (markdownFiles.length > 0) {
      setOutput('markdown-files', JSON.stringify(markdownFiles))
    }

    info(`Generated llms.txt artifacts successfully`)
    info(`   - Processed ${result.processedFiles.length} files`)
    info(`   - Created llms.txt (${result.llmsTxt.length} characters)`)
    if (result.llmsFullTxt) {
      info(`   - Created llms-full.txt (${result.llmsFullTxt.length} characters)`)
    }
    if (markdownFiles.length > 0) {
      info(`   - Created ${markdownFiles.length} markdown files`)
    }
  }
  catch (error) {
    setFailed(`Action failed with error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

main().catch((error) => {
  console.error(error)
  setFailed(error)
})
