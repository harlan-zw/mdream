import type { HTMLToMarkdownOptions } from 'mdream'
import type { MdreamMarkdownContext, ModuleRuntimeConfig } from '../../../types'
import { withSiteUrl } from '#site-config/server/composables/utils'
import { consola } from 'consola'
import { createError, defineEventHandler, setHeader } from 'h3'
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
  let path = event.path

  // Early check: only process .md requests
  if (!path.endsWith('.md')) {
    return
  }

  const config = useRuntimeConfig(event).mdream as ModuleRuntimeConfig

  path = path.slice(0, -3) // Remove .md

  // Special handling for index.md -> /
  if (path === '/index') {
    path = '/'
  }

  let html: string

  // Fetch the HTML page
  try {
    html = await globalThis.$fetch(path)
  }
  catch (e) {
    logger.error(`Failed to fetch HTML for ${path}`, e)
    return createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: `Failed to fetch HTML for ${path}`,
    })
  }
  // Convert to markdown
  const markdown = await convertHtmlToMarkdown(
    html,
    withSiteUrl(event, path),
    config,
    path,
  )

  // Set appropriate headers and return markdown
  setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
  return markdown
})
