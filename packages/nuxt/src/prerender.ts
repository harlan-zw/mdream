import type { Nuxt } from '@nuxt/schema'
import type { ProcessedFile } from 'mdream'
import type { Nitro } from 'nitropack'
import type { MdreamPage } from './runtime/types.js'
import type { ModuleRuntimeConfig } from './types.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { useNuxt } from '@nuxt/kit'
import { consola } from 'consola'
import { generateLlmsTxtArtifacts, htmlToMarkdown } from 'mdream'
import { useSiteConfig } from 'nuxt-site-config/kit'

const logger = consola.withTag('nuxt-mdream')

// Check if HTML contains noindex robots meta tag
function isIndexable(html: string): boolean {
  const robotsMatch = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)
  if (robotsMatch) {
    const content = robotsMatch[1].toLowerCase()
    return !content.includes('noindex')
  }
  return true
}

export function setupPrerenderHandler(config: ModuleRuntimeConfig, nuxt: Nuxt = useNuxt()) {
  const pages: MdreamPage[] = []

  nuxt.hooks.hook('nitro:init', async (nitro: Nitro) => {
    nitro.hooks.hook('prerender:generate', async (route: any) => {
      // Skip non-HTML files
      if (!route.fileName?.endsWith('.html') || !route.contents) {
        return
      }

      // Skip special routes
      if (['/200.html', '/404.html'].includes(route.route)) {
        return
      }

      const html = route.contents as string

      // Check if page is indexable
      if (!isIndexable(html)) {
        return
      }

      try {
        // Convert HTML to Markdown
        const markdown = htmlToMarkdown(html, {
          origin: route.route,
          ...config.mdreamOptions,
        })

        // Extract title from HTML
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        const title = titleMatch ? titleMatch[1].trim() : route.route

        // Store page data for llms.txt generation
        pages.push({
          url: route.route,
          title,
          markdown,
        })

        // Write markdown file
        const mdPath = route.route === '/' ? '/index.md' : `${route.route}.md`
        const outputPath = join(nitro.options.output.publicDir, mdPath)

        await mkdir(dirname(outputPath), { recursive: true })
        await writeFile(outputPath, markdown, 'utf-8')
      }
      catch (error) {
        logger.warn(`Failed to convert ${route.route} to markdown:`, error)
      }
    })

    nitro.hooks.hook('prerender:done', async () => {
      if (pages.length === 0) {
        return
      }

      try {
        // Convert MdreamPage to ProcessedFile format with .md URLs
        const processedFiles: ProcessedFile[] = pages.map(page => ({
          title: page.title,
          content: page.markdown,
          url: page.url === '/' ? '/index.md' : `${page.url}.md`,
        }))

        // Try to access site config from Nitro context
        const siteConfig = useSiteConfig()
        // Generate llms.txt artifacts
        const artifacts = await generateLlmsTxtArtifacts({
          files: processedFiles,
          generateFull: true,
          siteName: siteConfig.name || siteConfig.url,
          description: siteConfig.description,
        })

        // Write llms.txt
        if (artifacts.llmsTxt) {
          const llmsTxtPath = join(nitro.options.output.publicDir, 'llms.txt')
          await writeFile(llmsTxtPath, artifacts.llmsTxt, 'utf-8')
        }

        // Write llms-full.txt
        if (artifacts.llmsFullTxt) {
          const llmsFullTxtPath = join(nitro.options.output.publicDir, 'llms-full.txt')
          await writeFile(llmsFullTxtPath, artifacts.llmsFullTxt, 'utf-8')
        }

        logger.success(`Generated markdown for ${pages.length} pages`)
        if (artifacts.llmsTxt) {
          logger.info('Generated llms.txt')
        }
        if (artifacts.llmsFullTxt) {
          logger.info('Generated llms-full.txt')
        }
      }
      catch (error) {
        logger.error('Failed to generate llms.txt artifacts:', error)
      }
    })
  })
}
