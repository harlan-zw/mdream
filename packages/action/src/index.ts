import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getInput, info, setFailed, setOutput } from '@actions/core'
import { exec } from '@actions/exec'

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

    // Build the command
    const cmd = 'npx'
    const args = [
      'mdream',
      'llms',
      glob,
      '--site-name',
      siteName,
      '--description',
      description,
      '--origin',
      origin,
      '--output',
      output,
      '--chunk-size',
      chunkSize,
    ]

    if (verbose) {
      args.push('--verbose')
    }

    // Execute the command
    info(`Running: ${cmd} ${args.join(' ')}`)
    await exec(cmd, args)

    // Set outputs
    const llmsTxtPath = join(output, 'llms.txt')
    const llmsFullTxtPath = join(output, 'llms-full.txt')

    if (existsSync(llmsTxtPath)) {
      setOutput('llms-txt-path', llmsTxtPath)
    }

    if (existsSync(llmsFullTxtPath)) {
      setOutput('llms-full-txt-path', llmsFullTxtPath)
    }

    // Find generated markdown files
    const markdownFiles = []
    if (existsSync(output)) {
      const files = readdirSync(output)
      for (const file of files) {
        if (file.endsWith('.md') && file !== 'README.md') {
          markdownFiles.push(join(output, file))
        }
      }
    }

    if (markdownFiles.length > 0) {
      setOutput('markdown-files', JSON.stringify(markdownFiles))
    }

    info('✅ llms.txt artifacts generated successfully')
  }
  catch (error) {
    setFailed(`Action failed with error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

main().catch((error) => {
  console.error(error)
  setFailed(error)
})
