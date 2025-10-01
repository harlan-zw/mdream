import type { H3Event } from 'h3'
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
async function convertHtmlToMarkdown(html: string, url: string, config: ModuleRuntimeConfig, route: string, event: H3Event) {
  const nitroApp = useNitroApp()

  let title = ''
  let description = ''

  // Create extraction plugin first - must run before isolateMainPlugin
  const extractPlugin = extractionPlugin({
    title(el) {
      title = el.textContent
    },
    'meta[name="description"]': (el) => {
      description = el.attributes.content || ''
    },
  })

  let options: HTMLToMarkdownOptions = {
    origin: url,
    ...config.mdreamOptions,
  }

  // Apply preset if specified
  if (config.mdreamOptions?.preset === 'minimal') {
    options = withMinimalPreset(options)
    // Manually insert extraction plugin at the beginning, before all preset plugins
    options.plugins = [extractPlugin, ...(options.plugins || [])]
  }
  else {
    // For non-preset mode, just add extraction plugin to existing plugins
    options.plugins = [extractPlugin, ...(options.plugins || [])]
  }

  await nitroApp.hooks.callHook('mdream:config', options)
  let markdown = htmlToMarkdown(html, options)

  // Create hook context for mdream:markdown (Nitro hook)
  const context: MdreamMarkdownContext = {
    html,
    markdown,
    route,
    title,
    description,
    isPrerender: Boolean(import.meta.prerender),
    event,
  }

  // Call Nitro runtime hook if available
  await nitroApp.hooks.callHook('mdream:markdown', context)
  markdown = context.markdown // Use potentially modified markdown
  return { markdown, title, description }
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
  const result = await convertHtmlToMarkdown(
    html,
    withSiteUrl(event, path),
    config,
    path,
    event,
  )
  setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
  if (import.meta.prerender) {
    // return JSON which will be transformed by the build hooks
    return JSON.stringify(result)
  }
  // Set appropriate headers and return markdown
  return result.markdown
})
