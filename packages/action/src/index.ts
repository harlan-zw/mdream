import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getInput, info, setFailed, setOutput } from '@actions/core'
import { generateLlmsTxtArtifacts } from 'mdream'

export async function main() {
  try {
    // Get inputs
    const glob = getInput('glob', { required: true })
    const siteName = getInput('site-name', { required: true })
    const description = getInput('description', { required: true })
    const origin = getInput('origin', { required: true })
    const output = getInput('output') || '.'
    const chunkSize = getInput('chunk-size') || '4096'
    const verbose = getInput('verbose') === 'true'

    if (verbose) {
      info(`Processing glob pattern: ${glob}`)
      info(`Site name: ${siteName}`)
      info(`Description: ${description}`)
      info(`Origin: ${origin}`)
      info(`Output directory: ${output}`)
      info(`Chunk size: ${chunkSize}`)
    }

    // Generate llms.txt artifacts using mdream API
    const result = await generateLlmsTxtArtifacts({
      patterns: glob,
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

    info(`✅ Generated llms.txt artifacts successfully`)
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
