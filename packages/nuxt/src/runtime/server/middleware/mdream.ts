import type { H3Event } from 'h3'
import type { MdreamOptions } from 'mdream'
import type { MdreamMarkdownContext, MdreamNegotiateContext, ModuleRuntimeConfig } from '../../types.js'
import { withSiteUrl } from '#site-config/server/composables/utils'
import { shouldServeMarkdown as _shouldServeMarkdown } from '@mdream/js/negotiate'
import { consola } from 'consola'
import { createError, defineEventHandler, getHeader, setHeader } from 'h3'
import { htmlToMarkdown } from 'mdream'
import { useNitroApp, useRuntimeConfig } from 'nitropack/runtime'

const logger = consola.withTag('nuxt-mdream')

function shouldServeMarkdown(event: H3Event): boolean {
  return _shouldServeMarkdown(
    getHeader(event, 'accept'),
    getHeader(event, 'sec-fetch-dest'),
  )
}

// Convert HTML to Markdown
async function convertHtmlToMarkdown(html: string, url: string, config: ModuleRuntimeConfig, route: string, event: H3Event) {
  const nitroApp = useNitroApp()

  let title = ''
  let description = ''

  let options: MdreamOptions = {
    origin: url,
    ...config.mdreamOptions,
  } as MdreamOptions

  // Add declarative extraction for title/description
  options.extraction = {
    'title': (el) => { title = el.textContent },
    'meta[name="description"]': (el) => { description = el.attributes.content || '' },
  }

  await nitroApp.hooks.callHook('mdream:config', options)
  let markdown = htmlToMarkdown(html, options).markdown

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

  await nitroApp.hooks.callHook('mdream:markdown', context)
  markdown = context.markdown // Use potentially modified markdown
  return { markdown, title, description }
}

export default defineEventHandler(async (event) => {
  let path = event.path
  const config = useRuntimeConfig(event).mdream as ModuleRuntimeConfig

  // never run on API routes or internal routes
  if (path.startsWith('/api') || path.startsWith('/_') || path.startsWith('/@')) {
    return
  }

  // Extract file extension from path (e.g., /file.js -> .js, /path/to/file.css -> .css)
  const lastSegment = path.split('/').pop() || ''
  const hasExtension = lastSegment.includes('.')
  const extension = hasExtension ? lastSegment.substring(lastSegment.lastIndexOf('.')) : ''

  // Only run on .md extension or no extension at all
  // Skip all other file extensions (.js, .css, .html, .json, etc.)
  if (hasExtension && extension !== '.md') {
    return
  }

  // Check if we should serve markdown based on Accept header or .md extension
  const hasMarkdownExtension = path.endsWith('.md')
  let clientPrefersMarkdown = shouldServeMarkdown(event)

  // Allow users to override the negotiate decision via hook
  const nitroApp = useNitroApp()
  const negotiateContext: MdreamNegotiateContext = { event, shouldServe: clientPrefersMarkdown }
  await nitroApp.hooks.callHook('mdream:negotiate', negotiateContext)
  clientPrefersMarkdown = negotiateContext.shouldServe

  // Early exit: skip if not requesting .md and client doesn't prefer markdown
  if (!hasMarkdownExtension && !clientPrefersMarkdown) {
    return
  }

  // Remove .md extension if present
  if (hasMarkdownExtension) {
    path = path.slice(0, -3)
  }

  // Special handling for index.md -> /
  if (path === '/index') {
    path = '/'
  }

  let html: string

  // Fetch the HTML page
  try {
    const response = await globalThis.$fetch.raw(path)

    // Check if response is successful
    if (!response.ok) {
      if (hasMarkdownExtension) {
        return createError({
          statusCode: response.status,
          statusMessage: response.statusText,
          message: `Failed to fetch HTML for ${path}`,
        })
      }
      return
    }

    // Check content-type is HTML
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      if (hasMarkdownExtension) {
        return createError({
          statusCode: 415,
          statusMessage: 'Unsupported Media Type',
          message: `Expected text/html but got ${contentType} for ${path}`,
        })
      }
      return
    }

    html = response._data as string
  }
  catch (e) {
    logger.error(`Failed to fetch HTML for ${path}`, e)
    if (hasMarkdownExtension) {
      return createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        message: `Failed to fetch HTML for ${path}`,
      })
    }
    return
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
