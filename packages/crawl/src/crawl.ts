import type { CrawlOptions, CrawlResult } from './types.ts'
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { HttpCrawler, purgeDefaultStorages, Sitemap } from 'crawlee'
import { htmlToMarkdown } from 'mdream'
import { withMinimalPreset } from 'mdream/preset/minimal'
import { withHttps } from 'ufo'
import { getStartingUrl, isUrlExcluded, matchesGlobPattern, parseUrlPattern } from './glob-utils.ts'
import { generateLlmsFullTxt as generateLlmsFullTxtFile, generateLlmsTxt as generateLlmsTxtFile } from './llms-txt.ts'
import { extractMetadata } from './metadata-extractor.ts'

export async function crawlAndGenerate(options: CrawlOptions): Promise<CrawlResult[]> {
  const {
    urls,
    outputDir,
    maxRequestsPerCrawl = Number.MAX_SAFE_INTEGER,
    generateLlmsTxt = true,
    generateLlmsFullTxt = false,
    generateIndividualMd = true,
    origin,
    driver = 'http',
    followLinks = false,
    maxDepth = 1,
    globPatterns = [],
    crawlDelay,
    exclude = [],
  } = options

  const patterns = globPatterns.length > 0 ? globPatterns : urls.map(parseUrlPattern)

  let startingUrls = patterns.map(getStartingUrl)

  if (startingUrls.length > 0) {
    const baseUrl = new URL(startingUrls[0]).origin
    const homePageUrl = baseUrl

    const robotsUrl = new URL('/robots.txt', baseUrl).toString()
    const robotsResponse = await fetch(robotsUrl)
    if (robotsResponse.ok) {
      const robotsContent = await robotsResponse.text()
      const sitemapMatches = robotsContent.match(/Sitemap:\s*(.*)/gi)
      if (sitemapMatches && sitemapMatches.length > 0) {
        // console.log(`✓ Found ${sitemapMatches.length} sitemap(s) in robots.txt`)
        // Extract sitemap URLs from robots.txt and try using them
        const robotsSitemaps = sitemapMatches.map(match => match.replace(/Sitemap:\s*/i, '').trim())

        for (const sitemapUrl of robotsSitemaps) {
          try {
            const { urls: robotsUrls } = await Sitemap.load(sitemapUrl)
            // Filter URLs through glob patterns and exclude patterns
            const filteredUrls = robotsUrls.filter((url) => {
              return !isUrlExcluded(url, exclude) && patterns.some(pattern => matchesGlobPattern(url, pattern))
            })
            if (filteredUrls.length > 0) {
              startingUrls = filteredUrls
              break
            }
          }
          catch {
            // Ignore sitemap load errors and try next one
            continue
          }
        }
      }
    }
    try {
      const { urls: sitemapUrls } = await Sitemap.load(`${baseUrl}/sitemap.xml`)
      // Filter URLs through glob patterns and exclude patterns
      const filteredUrls = sitemapUrls.filter((url) => {
        return !isUrlExcluded(url, exclude) && patterns.some(pattern => matchesGlobPattern(url, pattern))
      })
      if (filteredUrls.length > 0) {
        startingUrls = filteredUrls
      }
    }
    catch {
      // Main sitemap not found, try alternatives
      const commonSitemaps = [
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/sitemaps.xml`,
        `${baseUrl}/sitemap-index.xml`,
      ]

      for (const sitemapUrl of commonSitemaps) {
        try {
          const { urls: altUrls } = await Sitemap.load(sitemapUrl)
          // Filter URLs through glob patterns and exclude patterns
          const filteredUrls = altUrls.filter((url) => {
            return !isUrlExcluded(url, exclude) && patterns.some(pattern => matchesGlobPattern(url, pattern))
          })
          if (filteredUrls.length > 0) {
            startingUrls = filteredUrls
            break
          }
        }
        catch {
          // Ignore sitemap load errors and try next one
          continue
        }
      }
    }

    // Always include home page for link discovery, even if it doesn't match glob pattern
    if (!startingUrls.includes(homePageUrl)) {
      startingUrls.unshift(homePageUrl)
    }
  }

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const results: CrawlResult[] = []
  const processedUrls = new Set<string>()

  // Helper function to check if a URL should be crawled based on glob patterns and exclude patterns
  const shouldCrawlUrl = (url: string): boolean => {
    // First check if URL should be excluded
    if (isUrlExcluded(url, exclude)) {
      return false
    }

    // If no glob patterns, crawl everything from same domain
    if (!patterns.some(p => p.isGlob)) {
      return true
    }

    // Check if URL matches any glob pattern
    return patterns.some(pattern => matchesGlobPattern(url, pattern))
  }

  // Create request handler that works for both crawlers
  const createRequestHandler = (crawlerType: 'http' | 'playwright') => {
    return async ({ request, body, page, enqueueLinks }: any) => {
      const startTime = Date.now()

      let html: string
      let title: string

      if (crawlerType === 'playwright') {
        // Playwright crawler
        await page.waitForLoadState('networkidle')
        title = await page.title()
        html = await page.innerHTML('html')
      }
      else {
        // HTTP crawler
        html = typeof body === 'string' ? body : body.toString()
        title = '' // Will be extracted from HTML
      }

      // Extract metadata including links, title, description
      const metadata = extractMetadata(html, request.loadedUrl)

      // Use extracted title if we don't have one
      if (!title) {
        title = metadata.title
      }

      // Check if this URL matches the glob pattern for markdown processing
      const shouldProcessMarkdown = shouldCrawlUrl(request.loadedUrl)

      let md = ''
      if (shouldProcessMarkdown) {
        // Convert HTML to Markdown only for matching URLs
        md = htmlToMarkdown(html, withMinimalPreset({
          origin: origin || new URL(request.loadedUrl).origin,
        }))
      }

      let filePath: string | undefined

      // Only generate files for URLs that match the glob pattern
      if (shouldProcessMarkdown) {
        // Generate filename based on URL path
        const urlObj = new URL(request.loadedUrl)
        const urlPath = urlObj.pathname === '/' ? '/index' : urlObj.pathname
        const safeFilename = `${urlPath.replace(/\/$/, '').replace(/[^\w\-/]/g, '-')}.md`

        // Create full file path - always store in outputDir for result tracking
        filePath = join(outputDir, 'md', safeFilename)

        // Write markdown file only if individual MD files are requested
        if (generateIndividualMd) {
          // Ensure the directory exists
          const fileDir = filePath.substring(0, filePath.lastIndexOf('/'))
          if (!existsSync(fileDir)) {
            mkdirSync(fileDir, { recursive: true })
          }
          await writeFile(filePath, md, 'utf-8')
        }
      }

      // const processingTime = Date.now() - startTime

      // Only create results for URLs that match the glob pattern
      if (shouldProcessMarkdown) {
        const result: CrawlResult = {
          url: request.loadedUrl,
          title,
          content: md,
          filePath: generateIndividualMd ? filePath : undefined,
          timestamp: startTime,
          success: true,
          metadata,
          depth: request.userData?.depth || 0,
        }

        results.push(result)
      }
      // Follow links if enabled and within depth limit
      if (followLinks && (request.userData?.depth || 0) < maxDepth) {
        const currentDepth = (request.userData?.depth || 0) + 1

        // Filter links based on glob patterns and exclude patterns
        const filteredLinks = metadata.links.filter((link) => {
          return shouldCrawlUrl(link)
        })

        if (enqueueLinks) {
          // Use crawler's built-in link following for Playwright
          await enqueueLinks({
            urls: filteredLinks,
            userData: { depth: currentDepth },
          })
        }
        else {
          // Manual link following for HTTP crawler
          for (const link of filteredLinks) {
            if (!processedUrls.has(link)) {
              processedUrls.add(link)
            }
          }
        }
      }
    }
  }

  // Create appropriate crawler with crawl delay if specified
  let crawler: HttpCrawler<any> | any // PlaywrightCrawler type will be determined at runtime
  const crawlerOptions: any = {
    requestHandler: createRequestHandler(driver),
    maxRequestsPerCrawl,
    respectRobotsTxtFile: true,
  }

  // Add crawl delay if specified
  if (crawlDelay) {
    crawlerOptions.requestHandlerTimeoutMillis = crawlDelay * 1000
  }

  if (driver === 'playwright') {
    // Import PlaywrightCrawler - installation check should happen in CLI layer
    const { PlaywrightCrawler: PlaywrightCrawlerClass } = await import('crawlee')
    crawler = new PlaywrightCrawlerClass(crawlerOptions)
  }
  else {
    crawler = new HttpCrawler(crawlerOptions)
  }

  // Start crawling with initial URLs (use starting URLs for glob patterns)
  const initialRequests = startingUrls.map(url => ({
    url,
    userData: { depth: 0 },
  }))

  await crawler.run(initialRequests)

  // Generate output files if requested
  if (results.some(r => r.success)) {
    const successfulResults = results.filter(r => r.success)

    // Extract site name and description from home page if available, otherwise first successful result
    const firstUrl = new URL(withHttps(urls[0]))
    const homePageResult = successfulResults.find(r => {
      const resultUrl = new URL(withHttps(r.url))
      const homeUrl = new URL(withHttps(urls[0]))
      return resultUrl.href === homeUrl.href
    })
    
    const siteName = homePageResult?.metadata?.title || firstUrl.hostname
    const description = homePageResult?.metadata?.description || successfulResults[0]?.metadata?.description

    // Generate llms.txt if requested
    if (generateLlmsTxt) {
      await generateLlmsTxtFile({
        siteName,
        description,
        results: successfulResults,
        outputPath: join(outputDir, 'llms.txt'),
      })
    }

    // Generate llms-full.txt if requested
    if (generateLlmsFullTxt) {
      await generateLlmsFullTxtFile({
        siteName,
        description,
        results: successfulResults,
        outputPath: join(outputDir, 'llms-full.txt'),
      })
    }
  }

  await purgeDefaultStorages()
  return results
}
