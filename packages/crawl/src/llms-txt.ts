import type { LlmsTxtOptions } from './types.ts'
import { writeFile } from 'node:fs/promises'
import { basename, sep } from 'pathe'

export async function generateLlmsTxt(options: LlmsTxtOptions): Promise<void> {
  const { siteName, description, results, outputPath } = options

  // Build llms.txt content according to spec
  let content = `# ${siteName}\n\n`

  if (description) {
    content += `> ${description}\n\n`
  }

  // Add pages section
  if (results.length > 0) {
    content += `## Pages\n\n`

    for (const result of results) {
      let title: string
      try {
        title = result.title || new URL(result.url).pathname
      }
      catch {
        title = result.title || result.url
      }

      // If we have a local file path (meaning individual MD files were generated), link to it
      // Otherwise, link directly to the URL
      if (result.filePath) {
        // Get relative path from output directory
        // Check if the path contains 'md' directory separator
        const mdSeparator = `${sep}md${sep}`
        const mdIndex = result.filePath.indexOf(mdSeparator)
        const relativePath = mdIndex !== -1
          ? result.filePath.substring(mdIndex + mdSeparator.length)
          : basename(result.filePath)
        // Always use forward slashes in markdown links
        const linkPath = relativePath.split(sep).join('/')
        content += `- [${title}](md/${linkPath}): ${result.url}\n`
      }
      else {
        // No local file, link directly to URL
        const description = result.metadata?.description
          ? result.metadata.description.split('\n')[0].substring(0, 100) + (result.metadata.description.length > 100 ? '...' : '')
          : ''
        content += `- [${title}](${result.url})${description ? `: ${description}` : ''}\n`
      }
    }
  }

  // Write the llms.txt file
  await writeFile(outputPath, content, 'utf-8')
}

export function generateLlmsTxtContent(options: Omit<LlmsTxtOptions, 'outputPath'>): string {
  const { siteName, description, results } = options

  let content = `# ${siteName}\n\n`

  if (description) {
    content += `> ${description}\n\n`
  }

  if (results.length > 0) {
    content += `## Pages\n\n`

    for (const result of results) {
      let title: string
      try {
        title = result.title || new URL(result.url).pathname
      }
      catch {
        title = result.title || result.url
      }

      // If we have a local file path (meaning individual MD files were generated), link to it
      // Otherwise, link directly to the URL
      if (result.filePath) {
        // Get relative path from output directory
        // Check if the path contains 'md' directory separator
        const mdSeparator = `${sep}md${sep}`
        const mdIndex = result.filePath.indexOf(mdSeparator)
        const relativePath = mdIndex !== -1
          ? result.filePath.substring(mdIndex + mdSeparator.length)
          : basename(result.filePath)
        // Always use forward slashes in markdown links
        const linkPath = relativePath.split(sep).join('/')
        content += `- [${title}](md/${linkPath}): ${result.url}\n`
      }
      else {
        // No local file, link directly to URL
        const description = result.metadata?.description
          ? result.metadata.description.split('\n')[0].substring(0, 100) + (result.metadata.description.length > 100 ? '...' : '')
          : ''
        content += `- [${title}](${result.url})${description ? `: ${description}` : ''}\n`
      }
    }
  }

  return content
}

export async function generateLlmsFullTxt(options: LlmsTxtOptions): Promise<void> {
  const { siteName, description, results, outputPath } = options

  // Build llms-full.txt content with full page content
  let content = `# ${siteName}\n\n`

  if (description) {
    content += `> ${description}\n\n`
  }

  // Add table of contents
  if (results.length > 0) {
    content += `## Table of Contents\n\n`

    for (const result of results) {
      let title: string
      try {
        title = result.title || new URL(result.url).pathname
      }
      catch {
        title = result.title || result.url
      }
      const anchor = title.toLowerCase().replace(/[^a-z0-9]/g, '-')
      content += `- [${title}](#${anchor})\n`
    }

    content += `\n---\n\n`

    // Add full content for each page
    for (const result of results) {
      let title: string
      try {
        title = result.title || new URL(result.url).pathname
      }
      catch {
        title = result.title || result.url
      }
      content += `## ${title}\n\n`
      content += `**URL:** ${result.url}\n\n`
      content += `${result.content}\n\n---\n\n`
    }
  }

  // Write the llms-full.txt file
  await writeFile(outputPath, content, 'utf-8')
}
