import type { ProcessedFile } from 'mdream/llms-txt'
import type { Nitro, PrerenderRoute } from 'nitropack'
import type { MdreamPage } from './runtime/types.js'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { useNuxt } from '@nuxt/kit'
import { consola } from 'consola'
import { generateLlmsTxtArtifacts } from 'mdream/llms-txt'
import { useSiteConfig } from 'nuxt-site-config/kit'

const logger = consola.withTag('nuxt-mdream')

export function setupPrerenderHandler() {
  const nuxt = useNuxt()
  const pages: MdreamPage[] = []

  nuxt.hooks.hook('nitro:init', async (nitro: Nitro) => {
    nitro.hooks.hook('prerender:generate', async (route: any) => {
      // Skip non-HTML files
      if (route.fileName?.endsWith('.md')) {
        const markdown = route.contents as string
        // Extract title from frontmatter
        const titleMatch = markdown.match(/title:\s*(.+)/)
        const extractedTitle = titleMatch?.[1]?.replace(/"/g, '') || route.route

        // Store page data for llms.txt generation
        pages.push({
          url: route.route,
          title: extractedTitle,
          markdown,
        })
      }
    })

    nitro.hooks.hook('prerender:done', async () => {
      if (pages.length === 0) {
        return
      }

      // Convert MdreamPage to ProcessedFile format with .md URLs
      const processedFiles: ProcessedFile[] = pages.map(page => ({
        title: page.title,
        content: page.markdown,
        url: page.url === '/' ? '/index.md' : page.url.endsWith('.md') ? page.url : `${page.url}.md`,
      }))

      // Try to access site config from Nitro context
      const siteConfig = useSiteConfig()
      // Generate llms.txt artifacts
      const artifacts = await generateLlmsTxtArtifacts({
        origin: siteConfig.url,
        files: processedFiles,
        generateFull: true,
        siteName: siteConfig.name || siteConfig.url,
        description: siteConfig.description,
      })
      logger.success(`Generated markdown for ${pages.length} pages`)

      // Write llms.txt
      if (artifacts.llmsTxt) {
        const llmsTxtPath = join(nitro.options.output.publicDir, 'llms.txt')
        await writeFile(llmsTxtPath, artifacts.llmsTxt, 'utf-8')
        nitro._prerenderedRoutes!.push({
          route: '/llms.txt',
          fileName: llmsTxtPath,
          generateTimeMS: 0,
        } satisfies PrerenderRoute)
        logger.info('Generated llms.txt')
      }

      // Write llms-full.txt
      if (artifacts.llmsFullTxt) {
        const llmsFullTxtPath = join(nitro.options.output.publicDir, 'llms-full.txt')
        await writeFile(llmsFullTxtPath, artifacts.llmsFullTxt, 'utf-8')
        nitro._prerenderedRoutes!.push({
          route: '/llms-full.txt',
          fileName: llmsFullTxtPath,
          generateTimeMS: 0,
        } satisfies PrerenderRoute)
        logger.info('Generated llms-full.txt')
      }
    })
  })
}
