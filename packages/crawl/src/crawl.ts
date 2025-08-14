import type { HttpCrawlerOptions, PlaywrightCrawlerOptions } from 'crawlee'
import type { ProcessedFile } from 'mdream'
import type { CrawlOptions, CrawlResult } from './types.ts'
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import { HttpCrawler, log, PlaywrightCrawler, purgeDefaultStorages } from 'crawlee'
import { generateLlmsTxtArtifacts, htmlToMarkdown } from 'mdream'
import { withMinimalPreset } from 'mdream/preset/minimal'
import { dirname, join, normalize, resolve } from 'pathe'
import { withHttps } from 'ufo'
import { getStartingUrl, isUrlExcluded, matchesGlobPattern, parseUrlPattern } from './glob-utils.ts'
import { extractMetadata } from './metadata-extractor.ts'

// Helper function to load sitemap with no retries using direct fetch
async function loadSitemapWithoutRetries(sitemapUrl: string): Promise<string[]> {
  const response = await fetch(sitemapUrl)
  if (!response.ok) {
    throw new Error(`Sitemap not found: ${response.status}`)
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

  try {
    const response = await fetch(sitemapUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'mdream-crawler/1.0',
      },
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`Sitemap not found: ${response.status}`)
    }

  const xmlContent = await response.text()

  // Parse XML content to extract URLs
  const urls: string[] = []
  const urlRegex = /<loc>(.*?)<\/loc>/g
  let match
  while (true) {
    match = urlRegex.exec(xmlContent)
    if (match === null)
      break
    urls.push(match[1])
  }

  return urls
}

export interface CrawlProgress {
  sitemap: {
    status: 'discovering' | 'processing' | 'completed'
    found: number
    processed: number
  }
  crawling: {
    status: 'starting' | 'processing' | 'completed'
    total: number
    processed: number
    currentUrl?: string
  }
  generation: {
    status: 'idle' | 'generating' | 'completed'
    current?: string
  }
}

export async function crawlAndGenerate(options: CrawlOptions, onProgress?: (progress: CrawlProgress) => void): Promise<CrawlResult[]> {
  const {
    urls,
    outputDir: rawOutputDir,
    maxRequestsPerCrawl = Number.MAX_SAFE_INTEGER,
    generateLlmsTxt = true,
    generateLlmsFullTxt = false,
    generateIndividualMd = true,
    origin,
    driver = 'http',
    useChrome,
    followLinks = false,
    maxDepth = 1,
    globPatterns = [],
    crawlDelay,
    exclude = [],
    siteNameOverride,
    descriptionOverride,
    verbose = false,
    skipSitemap = false,
  } = options

  // Normalize and resolve the output directory
  const outputDir = resolve(normalize(rawOutputDir))

  // Set crawlee log level based on verbose flag
  if (verbose) {
    log.setLevel(log.LEVELS.INFO)
  }
  else {
    log.setLevel(log.LEVELS.OFF)
  }

  let patterns
  try {
    patterns = globPatterns.length > 0 ? globPatterns : urls.map(parseUrlPattern)
  }
  catch (error) {
    throw new Error(`Invalid URL pattern: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  let startingUrls = patterns.map(getStartingUrl)

  // Initialize progress tracking
  const progress: CrawlProgress = {
    sitemap: { status: 'discovering', found: 0, processed: 0 },
    crawling: { status: 'starting', total: 0, processed: 0 },
    generation: { status: 'idle' },
  }

  // Track sitemap discovery attempts
  const sitemapAttempts: { url: string, success: boolean, error?: string }[] = []

  if (startingUrls.length > 0 && !skipSitemap) {
    const baseUrl = new URL(startingUrls[0]).origin
    const homePageUrl = baseUrl

    onProgress?.(progress)

    const robotsUrl = new URL('/robots.txt', baseUrl).toString()
    const robotsResponse = await fetch(robotsUrl)
    if (robotsResponse.ok) {
      const robotsContent = await robotsResponse.text()
      const sitemapMatches = robotsContent.match(/Sitemap:\s*(.*)/gi)
      if (sitemapMatches && sitemapMatches.length > 0) {
        progress.sitemap.found = sitemapMatches.length
        progress.sitemap.status = 'processing'
        onProgress?.(progress)

        // Extract sitemap URLs from robots.txt and try using them
        const robotsSitemaps = sitemapMatches.map(match => match.replace(/Sitemap:\s*/i, '').trim())

        for (const sitemapUrl of robotsSitemaps) {
          try {
            const robotsUrls = await loadSitemapWithoutRetries(sitemapUrl)
            sitemapAttempts.push({ url: sitemapUrl, success: true })

            // Check if we have glob patterns to filter by
            const hasGlobPatterns = patterns.some(p => p.isGlob)

            if (hasGlobPatterns) {
              // Filter URLs through glob patterns and exclude patterns
              const filteredUrls = robotsUrls.filter((url) => {
                return !isUrlExcluded(url, exclude) && patterns.some(pattern => matchesGlobPattern(url, pattern))
              })

              // Always use filtered URLs when glob patterns are provided, even if empty
              startingUrls = filteredUrls
              progress.sitemap.processed = filteredUrls.length
              onProgress?.(progress)
              break
            }
            else {
              // No glob patterns - use all URLs except excluded ones
              const filteredUrls = robotsUrls.filter((url) => {
                return !isUrlExcluded(url, exclude)
              })
              if (filteredUrls.length > 0) {
                startingUrls = filteredUrls
                progress.sitemap.processed = filteredUrls.length
                onProgress?.(progress)
                break
              }
            }
          }
          catch (error) {
            sitemapAttempts.push({ url: sitemapUrl, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
          }
        }
      }
    }
    let mainSitemapProcessed = false
    const mainSitemapUrl = `${baseUrl}/sitemap.xml`
    try {
      const sitemapUrls = await loadSitemapWithoutRetries(mainSitemapUrl)
      sitemapAttempts.push({ url: mainSitemapUrl, success: true })

      // Check if we have glob patterns to filter by
      const hasGlobPatterns = patterns.some(p => p.isGlob)

      if (hasGlobPatterns) {
        // Filter URLs through glob patterns and exclude patterns
        const filteredUrls = sitemapUrls.filter((url) => {
          return !isUrlExcluded(url, exclude) && patterns.some(pattern => matchesGlobPattern(url, pattern))
        })

        // Always use filtered URLs when glob patterns are provided, even if empty
        startingUrls = filteredUrls
        progress.sitemap.found = sitemapUrls.length
        progress.sitemap.processed = filteredUrls.length
        onProgress?.(progress)
        mainSitemapProcessed = true
      }
      else {
        // No glob patterns - use all URLs except excluded ones
        const filteredUrls = sitemapUrls.filter((url) => {
          return !isUrlExcluded(url, exclude)
        })
        if (filteredUrls.length > 0) {
          startingUrls = filteredUrls
          progress.sitemap.found = sitemapUrls.length
          progress.sitemap.processed = filteredUrls.length
          onProgress?.(progress)
          mainSitemapProcessed = true
        }
      }
    }
    catch (error) {
      sitemapAttempts.push({ url: mainSitemapUrl, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
      // Main sitemap not found, try alternatives only if main sitemap wasn't processed
      if (!mainSitemapProcessed) {
        const commonSitemaps = [
          `${baseUrl}/sitemap_index.xml`,
          `${baseUrl}/sitemaps.xml`,
          `${baseUrl}/sitemap-index.xml`,
        ]

        for (const sitemapUrl of commonSitemaps) {
          try {
            const altUrls = await loadSitemapWithoutRetries(sitemapUrl)
            sitemapAttempts.push({ url: sitemapUrl, success: true })

            // Check if we have glob patterns to filter by
            const hasGlobPatterns = patterns.some(p => p.isGlob)

            if (hasGlobPatterns) {
            // Filter URLs through glob patterns and exclude patterns
              const filteredUrls = altUrls.filter((url) => {
                return !isUrlExcluded(url, exclude) && patterns.some(pattern => matchesGlobPattern(url, pattern))
              })

              // Always use filtered URLs when glob patterns are provided, even if empty
              startingUrls = filteredUrls
              progress.sitemap.found = altUrls.length
              progress.sitemap.processed = filteredUrls.length
              onProgress?.(progress)
              break
            }
            else {
            // No glob patterns - use all URLs except excluded ones
              const filteredUrls = altUrls.filter((url) => {
                return !isUrlExcluded(url, exclude)
              })
              if (filteredUrls.length > 0) {
                startingUrls = filteredUrls
                progress.sitemap.found = altUrls.length
                progress.sitemap.processed = filteredUrls.length
                onProgress?.(progress)
                break
              }
            }
          }
          catch (error) {
            sitemapAttempts.push({ url: sitemapUrl, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
          }
        }
      }
    }

    // Log sitemap discovery results (only once after all attempts)
    const successfulSitemaps = sitemapAttempts.filter(a => a.success)
    const failedSitemaps = sitemapAttempts.filter(a => !a.success)

    if (successfulSitemaps.length > 0) {
      // Found at least one sitemap
      const sitemapUrl = successfulSitemaps[0].url
      if (progress.sitemap.processed > 0) {
        p.note(`Found sitemap at ${sitemapUrl} with ${progress.sitemap.processed} URLs`, 'Sitemap Discovery')
      }
      else {
        p.note(`Found sitemap at ${sitemapUrl} but no URLs matched your search criteria`, 'Sitemap Discovery')
      }
    }
    else if (failedSitemaps.length > 0) {
      // No sitemaps found, show consolidated message
      const firstAttempt = failedSitemaps[0]
      if (firstAttempt.error?.includes('404')) {
        p.note(`No sitemap found, using crawler to discover pages`, 'Sitemap Discovery')
      }
      else {
        p.note(`Could not access sitemap: ${firstAttempt.error}`, 'Sitemap Discovery')
      }
    }

    // Always include home page for metadata extraction (site name, description)
    // even if it doesn't match glob pattern
    if (!startingUrls.includes(homePageUrl)) {
      startingUrls.unshift(homePageUrl)
    }

    // Mark sitemap discovery as completed
    progress.sitemap.status = 'completed'

    // Update crawling total with the actual number of URLs we'll process
    // This gives a better estimate than just the initial requests count
    progress.crawling.total = startingUrls.length
    onProgress?.(progress)
  }
  else if (skipSitemap && startingUrls.length > 0) {
    // When skipping sitemap discovery, immediately mark as completed
    progress.sitemap.status = 'completed'
    progress.sitemap.found = 0
    progress.sitemap.processed = 0
    progress.crawling.total = startingUrls.length
    onProgress?.(progress)
    // Don't show any sitemap discovery box when skipping
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
    return async ({ request, body, page, enqueueLinks, response }: any) => {
      const startTime = Date.now()

      // Update progress with current URL
      progress.crawling.currentUrl = request.loadedUrl
      onProgress?.(progress)

      // Skip processing for non-2xx responses
      if (response?.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
        return
      }

      // Determine home page URL for metadata extraction
      const homePageUrl = new URL(startingUrls[0]).origin

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
        // Convert URL path to OS-safe path by replacing forward slashes
        const pathSegments = urlPath.replace(/\/$/, '').split('/').filter(seg => seg.length > 0)
        const safeSegments = pathSegments.map(seg => seg.replace(/[^\w\-]/g, '-'))
        // Ensure we have a valid filename
        const filename = safeSegments.length > 0 ? safeSegments.join('/') : 'index'
        const safeFilename = normalize(`${filename}.md`)

        // Create full file path - store directly in outputDir to match public dir structure
        filePath = join(outputDir, safeFilename)

        // Write markdown file only if individual MD files are requested
        if (generateIndividualMd) {
          // Ensure the directory exists
          const fileDir = dirname(filePath)
          // Safety check: ensure directory path is not empty
          if (fileDir && !existsSync(fileDir)) {
            mkdirSync(fileDir, { recursive: true })
          }
          await writeFile(filePath, md, 'utf-8')
        }
      }

      // const processingTime = Date.now() - startTime

      // Always create results for home page (needed for metadata extraction)
      // and for URLs that match the glob pattern
      const normalizedUrl = request.loadedUrl.replace(/\/$/, '')
      const normalizedHomePageUrl = homePageUrl.replace(/\/$/, '')
      const isHomePage = normalizedUrl === normalizedHomePageUrl

      if (shouldProcessMarkdown || isHomePage) {
        const result: CrawlResult = {
          url: request.loadedUrl,
          title,
          content: md,
          filePath: shouldProcessMarkdown ? filePath : undefined,
          timestamp: startTime,
          success: true,
          metadata,
          depth: request.userData?.depth || 0,
        }

        results.push(result)

        // Update progress with actual processed count
        progress.crawling.processed = results.length
        onProgress?.(progress)
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
  const crawlerOptions: PlaywrightCrawlerOptions | HttpCrawlerOptions = {
    requestHandler: createRequestHandler(driver),
    errorHandler: async ({ request, response }: any) => {
      // Handle 4xx and 5xx status codes for HTTP crawler only (skip everything except timeouts)
      if (response?.statusCode && response?.statusCode >= 400) {
        request.noRetry = true
      }
    },
    maxRequestsPerCrawl,
    respectRobotsTxtFile: !skipSitemap,
  }

  // Add crawl delay if specified
  if (crawlDelay) {
    crawlerOptions.requestHandlerTimeoutSecs = crawlDelay
  }

  if (driver === 'playwright') {
    // PlaywrightCrawler - installation check should happen in CLI layer
    const playwrightOptions = crawlerOptions as PlaywrightCrawlerOptions

    // Add useChrome option if specified
    if (useChrome) {
      playwrightOptions.launchContext = {
        ...playwrightOptions.launchContext,
        useChrome,
      }
    }

    crawler = new PlaywrightCrawler(playwrightOptions)
  }
  else {
    crawler = new HttpCrawler(crawlerOptions as HttpCrawlerOptions)
  }

  // Start crawling with initial URLs (use starting URLs for glob patterns)
  const initialRequests = startingUrls.map(url => ({
    url,
    userData: { depth: 0 },
  }))

  // Initialize crawling progress with the final URL count after sitemap processing
  progress.crawling.status = 'processing'
  progress.crawling.total = startingUrls.length
  onProgress?.(progress)

  await crawler.run(initialRequests)

  // Mark crawling as completed
  progress.crawling.status = 'completed'
  onProgress?.(progress)

  // Generate output files if requested
  if (results.some(r => r.success)) {
    progress.generation.status = 'generating'
    onProgress?.(progress)

    const successfulResults = results.filter(r => r.success)

    // Extract site name and description from home page if available, otherwise first successful result
    const firstUrl = new URL(withHttps(urls[0]))
    const origin = firstUrl.origin
    const homePageResult = successfulResults.find((r) => {
      const resultUrl = new URL(withHttps(r.url))
      return resultUrl.href === origin || resultUrl.href === `${origin}/`
    })

    const siteName = siteNameOverride || homePageResult?.metadata?.title || homePageResult?.title || firstUrl.hostname
    const description = descriptionOverride || homePageResult?.metadata?.description || successfulResults[0]?.metadata?.description

    // Generate llms.txt and llms-full.txt if requested
    if (generateLlmsTxt || generateLlmsFullTxt) {
      progress.generation.current = 'Generating llms.txt files'
      onProgress?.(progress)

      // Only include results that have actual content (exclude redirect pages)
      // Redirect pages typically only have frontmatter (---) or very minimal content
      const contentResults = successfulResults.filter((result) => {
        if (!result.content)
          return false
        const trimmedContent = result.content.trim()
        // Filter out pages that only have frontmatter or are too short
        const contentWithoutFrontmatter = trimmedContent.replace(/^---\s*\n(?:.*\n)*?---\s*/, '').trim()
        return contentWithoutFrontmatter.length > 10 // Must have at least some meaningful content
      })

      // Deduplicate results by URL (in case of redirects creating duplicates)
      const seenUrls = new Set<string>()
      const deduplicatedResults = contentResults.filter((result) => {
        if (seenUrls.has(result.url)) {
          return false
        }
        seenUrls.add(result.url)
        return true
      })

      // Convert CrawlResult to ProcessedFile format
      const processedFiles: ProcessedFile[] = deduplicatedResults.map(result => ({
        filePath: result.filePath,
        title: result.title,
        content: result.content,
        url: result.url,
        metadata: result.metadata,
      }))

      const llmsResult = await generateLlmsTxtArtifacts({
        files: processedFiles,
        siteName,
        description,
        origin: origin || firstUrl.origin,
        generateFull: generateLlmsFullTxt,
        outputDir,
      })

      // Write llms.txt if requested
      if (generateLlmsTxt) {
        progress.generation.current = 'Writing llms.txt'
        onProgress?.(progress)
        await writeFile(join(outputDir, 'llms.txt'), llmsResult.llmsTxt, 'utf-8')
      }

      // Write llms-full.txt if requested
      if (generateLlmsFullTxt && llmsResult.llmsFullTxt) {
        progress.generation.current = 'Writing llms-full.txt'
        onProgress?.(progress)
        await writeFile(join(outputDir, 'llms-full.txt'), llmsResult.llmsFullTxt, 'utf-8')
      }
    }

    progress.generation.status = 'completed'
    onProgress?.(progress)
  }

  await purgeDefaultStorages()
  return results
}
