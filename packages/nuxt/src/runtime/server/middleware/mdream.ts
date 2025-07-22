import type { HTMLToMarkdownOptions } from 'mdream'
import type { MdreamMarkdownContext, ModuleRuntimeConfig } from '../../../types'
import { consola } from 'consola'
import { createError, defineEventHandler, getRequestURL, setHeader } from 'h3'
import { htmlToMarkdown } from 'mdream'
import { extractionPlugin } from 'mdream/plugins'
import { withMinimalPreset } from 'mdream/preset/minimal'
import { useNitroApp, useRuntimeConfig } from 'nitropack/runtime'

const logger = consola.withTag('nuxt-mdream')

// Convert HTML to Markdown
async function convertHtmlToMarkdown(html: string, url: string, config: ModuleRuntimeConfig, route: string) {
  let options: HTMLToMarkdownOptions = {
    origin: url,
    ...config.mdreamOptions,
  }

  // Apply preset if specified
  if (config.mdreamOptions?.preset === 'minimal') {
    options = withMinimalPreset(options)
  }

  let title = ''
  let markdown = htmlToMarkdown(html, {
    ...options,
    plugins: [
      ...(options.plugins || []),
      // Add any additional plugins here if needed
      extractionPlugin({
        title(html) {
          title = html.textContent
        },
      }),
    ],
  })

  // Create hook context
  const context: MdreamMarkdownContext = {
    html,
    markdown,
    route,
    title,
    isPrerender: Boolean(import.meta.prerender),
  }

  // Call Nitro runtime hook if available
  const nitroApp = useNitroApp()
  if (nitroApp?.hooks) {
    await nitroApp.hooks.callHook('mdream:markdown', context)
    markdown = context.markdown // Use potentially modified markdown
  }

  return markdown
}

export default defineEventHandler(async (event) => {
  const requestUrl = getRequestURL(event)
  let htmlPath = requestUrl.pathname

  // Early check: only process .md requests
  if (!htmlPath.endsWith('.md')) {
    return
  }

  const config = useRuntimeConfig(event).mdream as ModuleRuntimeConfig

  htmlPath = htmlPath.slice(0, -3) // Remove .md

  // Special handling for index.md -> /
  if (htmlPath === '/index') {
    htmlPath = '/'
  }

  try {
    // Construct the full URL for the HTML page
    const fullUrl = new URL(htmlPath, requestUrl.origin).toString()

    // Fetch the HTML page
    const response = await event.fetch(fullUrl)

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: response.statusText,
      })
    }

    const html = await response.text()

    // Convert to markdown
    const markdown = await convertHtmlToMarkdown(
      html,
      requestUrl.origin + htmlPath,
      config,
      htmlPath,
    )

    // Set appropriate headers and return markdown
    setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
    return markdown
  }
  catch (error: any) {
    // If already a proper error, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Handle fetch errors
    if (error.status === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Page not found',
      })
    }

    // Log error and return generic error
    logger.error('Failed to generate markdown for', htmlPath, error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to generate markdown: ${error.message || 'Unknown error'}`,
    })
  }
})
