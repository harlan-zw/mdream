import type { ProcessedFile } from '@mdream/js/llms-txt'
import type { PlaywrightCrawlerOptions } from 'crawlee'
import type { CrawlOptions, CrawlResult, PageData, PageMetadata } from './types.ts'
import { mkdirSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import { generateLlmsTxtArtifacts } from '@mdream/js/llms-txt'
import { htmlToMarkdown } from 'mdream'
import { ofetch } from 'ofetch'
import { dirname, join, normalize, resolve } from 'pathe'
import { withHttps } from 'ufo'
import { getStartingUrl, isUrlExcluded, isValidSitemapXml, matchesGlobPattern, parseUrlPattern } from './glob-utils.js'

const SITEMAP_INDEX_LOC_RE = /<sitemap[^>]*>.*?<loc>(.*?)<\/loc>.*?<\/sitemap>/gs
const SITEMAP_URL_LOC_RE = /<url[^>]*>.*?<loc>(.*?)<\/loc>.*?<\/url>/gs
const ROBOTS_SITEMAP_RE = /Sitemap:\s*(.*)/gi
const ROBOTS_SITEMAP_PREFIX_RE = /Sitemap:\s*/i
const ROBOTS_CRAWL_DELAY_RE = /Crawl-delay:\s*(\d+(?:\.\d+)?)/i
const URL_TRAILING_SLASH_RE = /\/$/
const URL_PATH_UNSAFE_CHARS_RE = /[^\w\-]/g
const FRONTMATTER_BLOCK_RE = /^---[^\n]*\n[\s\S]*?\n---[^\n]*\n?/

const FETCH_HEADERS = { 'User-Agent': 'mdream-crawler/1.0', 'Accept': 'text/html,application/xhtml+xml,text/markdown' }
const DEFAULT_CONCURRENCY = 20

function extractCdataUrl(url: string): string {
  if (url.startsWith('<![CDATA[') && url.endsWith(']]>'))
    return url.slice(9, -3)
  return url
}

async function loadSitemap(sitemapUrl: string): Promise<string[]> {
  const xmlContent = await ofetch(sitemapUrl, {
    headers: FETCH_HEADERS,
    timeout: 10000,
    responseType: 'text' as const,
    retry: 0,
  })

  if (!isValidSitemapXml(xmlContent))
    throw new Error('Response is not a valid sitemap XML')

  // Sitemap index: load all child sitemaps in parallel
  if (xmlContent.includes('<sitemapindex')) {
    SITEMAP_INDEX_LOC_RE.lastIndex = 0
    const childSitemaps: string[] = []
    let match
    while (true) {
      match = SITEMAP_INDEX_LOC_RE.exec(xmlContent)
      if (match === null)
        break
      childSitemaps.push(extractCdataUrl(match[1]))
    }

    const childResults = await Promise.allSettled(
      childSitemaps.map(url => loadSitemap(url)),
    )

    const allUrls: string[] = []
    for (const result of childResults) {
      if (result.status === 'fulfilled')
        allUrls.push(...result.value)
    }
    return allUrls
  }

  // Regular sitemap: extract URLs
  const urls: string[] = []
  SITEMAP_URL_LOC_RE.lastIndex = 0
  let match
  while (true) {
    match = SITEMAP_URL_LOC_RE.exec(xmlContent)
    if (match === null)
      break
    urls.push(extractCdataUrl(match[1]))
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
    failed: number
    currentUrl?: string
    /** Page fetch latency stats in ms */
    latency: { total: number, min: number, max: number, count: number }
  }
  generation: {
    status: 'idle' | 'generating' | 'completed'
    current?: string
  }
}

// Metadata extraction merged into htmlToMarkdown call
function extractMetadataInline(parsedUrl: URL): {
  extraction: Record<string, (el: { textContent: string, attributes: Record<string, string> }) => void>
  getMetadata: () => PageMetadata
} {
  const links = new Set<string>()
  let title = ''
  let description = ''
  let keywords = ''
  let author = ''
  const url = parsedUrl.href
  const originPrefix = `${parsedUrl.origin}/`

  const extraction: Record<string, (el: { textContent: string, attributes: Record<string, string> }) => void> = {
    'a[href]': (el) => {
      const href = el.attributes.href
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).href
          // Same-domain check via origin prefix (avoids parsing URL again)
          if (absoluteUrl.startsWith(originPrefix) || absoluteUrl === parsedUrl.origin)
            links.add(absoluteUrl)
        }
        catch {}
      }
    },
    'title': (el) => {
      if (!title)
        title = el.textContent
    },
    'meta[name="description"]': (el) => {
      if (!description)
        description = el.attributes.content || ''
    },
    'meta[property="og:description"]': (el) => {
      if (!description)
        description = el.attributes.content || ''
    },
    'meta[name="keywords"]': (el) => {
      if (!keywords)
        keywords = el.attributes.content || ''
    },
    'meta[name="author"]': (el) => {
      if (!author)
        author = el.attributes.content || ''
    },
    'meta[property="og:title"]': (el) => {
      if (!title)
        title = el.attributes.content || ''
    },
  }

  return {
    extraction,
    getMetadata: () => ({
      title: title.trim() || parsedUrl.pathname,
      description: description.trim() || undefined,
      keywords: keywords.trim() || undefined,
      author: author.trim() || undefined,
      links: [...links],
    }),
  }
}

function filterSitemapUrls(
  sitemapUrls: string[],
  hasGlobPatterns: boolean,
  exclude: string[],
  allPatterns: ReturnType<typeof parseUrlPattern>[],
): string[] {
  if (hasGlobPatterns) {
    return sitemapUrls.filter(url =>
      !isUrlExcluded(url, exclude) && allPatterns.some(pattern => matchesGlobPattern(url, pattern)),
    )
  }
  return sitemapUrls.filter(url => !isUrlExcluded(url, exclude))
}

// Simple concurrency pool for HTTP fetching
async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++
      await fn(items[i])
    }
  })
  await Promise.all(workers)
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
    crawlDelay: userCrawlDelay,
    exclude = [],
    siteNameOverride,
    descriptionOverride,
    verbose = false,
    skipSitemap = false,
    onPage,
  } = options

  const outputDir = resolve(normalize(rawOutputDir))
  let crawlDelay = userCrawlDelay

  let patterns
  try {
    patterns = globPatterns.length > 0 ? globPatterns : urls.map(parseUrlPattern)
  }
  catch (error) {
    throw new Error(`Invalid URL pattern: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  let startingUrls = patterns.map(getStartingUrl)
  const hasGlobPatterns = patterns.some(p => p.isGlob)

  const progress: CrawlProgress = {
    sitemap: { status: 'discovering', found: 0, processed: 0 },
    crawling: { status: 'starting', total: 0, processed: 0, failed: 0, latency: { total: 0, min: Infinity, max: 0, count: 0 } },
    generation: { status: 'idle' },
  }

  const sitemapAttempts: { url: string, success: boolean, error?: string }[] = []

  if (startingUrls.length > 0 && !skipSitemap) {
    const baseUrl = new URL(startingUrls[0]).origin
    const homePageUrl = baseUrl

    onProgress?.(progress)

    // Fetch robots.txt
    let robotsContent: string | null = null
    try {
      robotsContent = await ofetch(`${baseUrl}/robots.txt`, {
        headers: FETCH_HEADERS,
        timeout: 10000,
        responseType: 'text' as const,
        retry: 0,
      })
    }
    catch {}

    // Extract Crawl-delay from robots.txt if user hasn't set one
    if (robotsContent && !crawlDelay) {
      const crawlDelayMatch = robotsContent.match(ROBOTS_CRAWL_DELAY_RE)
      if (crawlDelayMatch) {
        crawlDelay = Number.parseFloat(crawlDelayMatch[1])
        if (verbose)
          console.log(`[ROBOTS] Crawl-delay: ${crawlDelay}s`)
      }
    }

    if (robotsContent) {
      const sitemapMatches = robotsContent.match(ROBOTS_SITEMAP_RE)
      if (sitemapMatches && sitemapMatches.length > 0) {
        progress.sitemap.found = sitemapMatches.length
        progress.sitemap.status = 'processing'
        onProgress?.(progress)

        const robotsSitemaps = sitemapMatches.map(match => match.replace(ROBOTS_SITEMAP_PREFIX_RE, '').trim())

        for (const sitemapUrl of robotsSitemaps) {
          try {
            const robotsUrls = await loadSitemap(sitemapUrl)
            sitemapAttempts.push({ url: sitemapUrl, success: true })

            const filteredUrls = filterSitemapUrls(robotsUrls, hasGlobPatterns, exclude, patterns)

            if (hasGlobPatterns) {
              startingUrls = filteredUrls
              progress.sitemap.processed = filteredUrls.length
              onProgress?.(progress)
              break
            }
            else if (filteredUrls.length > 0) {
              startingUrls = filteredUrls
              progress.sitemap.processed = filteredUrls.length
              onProgress?.(progress)
              break
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
      const sitemapUrls = await loadSitemap(mainSitemapUrl)
      sitemapAttempts.push({ url: mainSitemapUrl, success: true })

      const filteredUrls = filterSitemapUrls(sitemapUrls, hasGlobPatterns, exclude, patterns)

      if (hasGlobPatterns) {
        startingUrls = filteredUrls
        progress.sitemap.found = sitemapUrls.length
        progress.sitemap.processed = filteredUrls.length
        onProgress?.(progress)
        mainSitemapProcessed = true
      }
      else if (filteredUrls.length > 0) {
        startingUrls = filteredUrls
        progress.sitemap.found = sitemapUrls.length
        progress.sitemap.processed = filteredUrls.length
        onProgress?.(progress)
        mainSitemapProcessed = true
      }
    }
    catch (error) {
      sitemapAttempts.push({ url: mainSitemapUrl, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
      if (!mainSitemapProcessed) {
        const commonSitemaps = [
          `${baseUrl}/sitemap_index.xml`,
          `${baseUrl}/sitemaps.xml`,
          `${baseUrl}/sitemap-index.xml`,
        ]

        for (const sitemapUrl of commonSitemaps) {
          try {
            const altUrls = await loadSitemap(sitemapUrl)
            sitemapAttempts.push({ url: sitemapUrl, success: true })

            const filteredUrls = filterSitemapUrls(altUrls, hasGlobPatterns, exclude, patterns)

            if (hasGlobPatterns) {
              startingUrls = filteredUrls
              progress.sitemap.found = altUrls.length
              progress.sitemap.processed = filteredUrls.length
              onProgress?.(progress)
              break
            }
            else if (filteredUrls.length > 0) {
              startingUrls = filteredUrls
              progress.sitemap.found = altUrls.length
              progress.sitemap.processed = filteredUrls.length
              onProgress?.(progress)
              break
            }
          }
          catch (error) {
            sitemapAttempts.push({ url: sitemapUrl, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
          }
        }
      }
    }

    // Log sitemap discovery results
    const successfulSitemaps = sitemapAttempts.filter(a => a.success)
    const failedSitemaps = sitemapAttempts.filter(a => !a.success)

    if (successfulSitemaps.length > 0) {
      const sitemapUrl = successfulSitemaps[0].url
      if (progress.sitemap.processed > 0)
        p.note(`Found sitemap at ${sitemapUrl} with ${progress.sitemap.processed} URLs`, 'Sitemap Discovery')
      else
        p.note(`Found sitemap at ${sitemapUrl} but no URLs matched your search criteria`, 'Sitemap Discovery')
    }
    else if (failedSitemaps.length > 0) {
      const firstAttempt = failedSitemaps[0]
      if (firstAttempt.error?.includes('404'))
        p.note(`No sitemap found, using crawler to discover pages`, 'Sitemap Discovery')
      else
        p.note(`Could not access sitemap: ${firstAttempt.error}`, 'Sitemap Discovery')
    }

    // Always include home page for metadata extraction
    if (!startingUrls.includes(homePageUrl))
      startingUrls.unshift(homePageUrl)

    progress.sitemap.status = 'completed'
    progress.crawling.total = startingUrls.length
    onProgress?.(progress)
  }
  else if (skipSitemap && startingUrls.length > 0) {
    progress.sitemap.status = 'completed'
    progress.sitemap.found = 0
    progress.sitemap.processed = 0
    progress.crawling.total = startingUrls.length
    onProgress?.(progress)
  }

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true })

  const results: CrawlResult[] = []
  const processedUrls = new Set<string>()

  const shouldCrawlUrl = (url: string): boolean => {
    if (isUrlExcluded(url, exclude))
      return false
    if (!hasGlobPatterns)
      return true
    return patterns.some(pattern => matchesGlobPattern(url, pattern))
  }

  const recordLatency = (ms: number) => {
    const lat = progress.crawling.latency
    lat.total += ms
    lat.count++
    if (ms < lat.min)
      lat.min = ms
    if (ms > lat.max)
      lat.max = ms
  }

  // Pre-compute home page URL once
  const homePageUrl = startingUrls.length > 0 ? new URL(startingUrls[0]).origin : ''
  const normalizedHomePageUrl = homePageUrl.replace(URL_TRAILING_SLASH_RE, '')

  // Track created directories to avoid redundant mkdir calls
  const createdDirs = new Set<string>()

  // Pre-compute shared origin if provided (avoids per-page URL parsing)
  const sharedOrigin = origin || ''

  // Process a single page (shared between HTTP and Playwright paths)
  const processPage = async (url: string, content: string, initialTitle: string, depth: number, isMarkdown = false) => {
    const parsedUrl = new URL(url)
    const shouldProcessMarkdown = shouldCrawlUrl(url)
    const pageOrigin = sharedOrigin || parsedUrl.origin

    let md: string
    let metadata: PageMetadata
    if (isMarkdown) {
      // Content is already markdown, skip conversion
      md = content
      metadata = { title: initialTitle || parsedUrl.pathname, links: [] }
    }
    else {
      // Single htmlToMarkdown call with merged extraction
      const { extraction, getMetadata } = extractMetadataInline(parsedUrl)
      md = htmlToMarkdown(content, { origin: pageOrigin, extraction })
      metadata = getMetadata()
    }
    const title = initialTitle || metadata.title

    // Call onPage callback if provided
    if (onPage && shouldProcessMarkdown) {
      const pageData: PageData = {
        url,
        html: isMarkdown ? '' : content,
        title,
        metadata,
        origin: pageOrigin,
      }
      await onPage(pageData)
    }

    let filePath: string | undefined

    if (shouldProcessMarkdown && generateIndividualMd) {
      const urlPath = parsedUrl.pathname === '/' ? '/index' : parsedUrl.pathname
      const pathSegments = urlPath.replace(URL_TRAILING_SLASH_RE, '').split('/').filter(seg => seg.length > 0)
      const safeSegments = pathSegments.map(seg => seg.replace(URL_PATH_UNSAFE_CHARS_RE, '-'))
      const filename = safeSegments.length > 0 ? safeSegments.join('/') : 'index'
      const safeFilename = normalize(`${filename}.md`)

      filePath = join(outputDir, safeFilename)

      const fileDir = dirname(filePath)
      if (fileDir && !createdDirs.has(fileDir)) {
        await mkdir(fileDir, { recursive: true })
        createdDirs.add(fileDir)
      }
      await writeFile(filePath, md, 'utf-8')
    }

    const isHomePage = parsedUrl.pathname === '/' && parsedUrl.origin === normalizedHomePageUrl

    if (shouldProcessMarkdown || isHomePage) {
      const result: CrawlResult = {
        url,
        title,
        content: md,
        filePath: shouldProcessMarkdown ? filePath : undefined,
        timestamp: Date.now(),
        success: true,
        metadata,
        depth,
      }
      results.push(result)

      progress.crawling.processed = results.length
      onProgress?.(progress)
    }

    // Follow links if enabled and within depth limit
    if (followLinks && depth < maxDepth) {
      const filteredLinks = metadata.links.filter(link => shouldCrawlUrl(link))
      for (const link of filteredLinks) {
        processedUrls.add(link)
      }
    }
  }

  // Limit URLs to maxRequestsPerCrawl
  const urlsToProcess = startingUrls.slice(0, maxRequestsPerCrawl)

  progress.crawling.status = 'processing'
  progress.crawling.total = urlsToProcess.length
  onProgress?.(progress)

  if (driver === 'playwright') {
    // Playwright path: keep using Crawlee for browser pool management
    const { log, PlaywrightCrawler, purgeDefaultStorages } = await import('crawlee')

    if (verbose)
      log.setLevel(log.LEVELS.INFO)
    else
      log.setLevel(log.LEVELS.OFF)

    const crawlerOptions: PlaywrightCrawlerOptions = {
      requestHandler: async ({ request, page }) => {
        progress.crawling.currentUrl = request.loadedUrl
        onProgress?.(progress)

        const fetchStart = Date.now()
        await page.waitForLoadState('networkidle')
        const title = await page.title()
        const html = await page.innerHTML('html')
        recordLatency(Date.now() - fetchStart)

        await processPage(request.loadedUrl, html, title, request.userData?.depth || 0)
      },
      errorHandler: async ({ request, response, error }: any) => {
        if (verbose)
          console.error(`[ERROR] URL: ${request.url}, Status: ${response?.statusCode || 'N/A'}, Error: ${error?.message || 'Unknown'}`)

        request.noRetry = true
        progress.crawling.failed++
        results.push({
          url: request.url,
          title: '',
          content: '',
          timestamp: Date.now(),
          success: false,
          error: response?.statusCode ? `HTTP ${response.statusCode}` : (error?.message || 'Unknown error'),
          metadata: { title: '', description: '', links: [] },
          depth: request.userData?.depth || 0,
        })
      },
      maxRequestsPerCrawl,
      respectRobotsTxtFile: false,
    }

    if (crawlDelay)
      crawlerOptions.requestHandlerTimeoutSecs = crawlDelay

    if (useChrome) {
      crawlerOptions.launchContext = {
        ...crawlerOptions.launchContext,
        useChrome,
      }
    }

    const crawler = new PlaywrightCrawler(crawlerOptions)

    const initialRequests = urlsToProcess.map(url => ({
      url,
      userData: { depth: 0 },
    }))

    try {
      await crawler.run(initialRequests)
    }
    catch (error) {
      if (verbose) {
        console.error(`[CRAWLER ERROR] ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.error(`[CRAWLER ERROR] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace')
      }
      throw error
    }

    await purgeDefaultStorages()
  }
  else {
    // HTTP path: simple ofetch + concurrency pool (no Crawlee overhead)
    await runConcurrent(urlsToProcess, DEFAULT_CONCURRENCY, async (url) => {
      progress.crawling.currentUrl = url
      onProgress?.(progress)

      // Apply crawl delay if specified (from user or robots.txt Crawl-delay)
      if (crawlDelay) {
        const delay = crawlDelay
        await new Promise(resolve => setTimeout(resolve, delay * 1000))
      }

      try {
        const fetchStart = Date.now()
        const response = await ofetch.raw(url, {
          headers: FETCH_HEADERS,
          responseType: 'text' as const,
          retry: 2,
          retryDelay: 500,
          timeout: 10000,
          onResponseError({ response }) {
            // Handle 429 Too Many Requests: respect Retry-After header
            if (response.status === 429) {
              const retryAfter = response.headers.get('retry-after')
              const delaySec = retryAfter ? (Number.parseInt(retryAfter) || 1) : 2
              // Set crawlDelay for subsequent requests
              if (!crawlDelay || delaySec > crawlDelay)
                crawlDelay = delaySec
            }
          },
        })
        recordLatency(Date.now() - fetchStart)

        const body = response._data ?? ''
        const contentType = response.headers.get('content-type') || ''
        const isMarkdown = contentType.includes('text/markdown') || contentType.includes('text/x-markdown')
        await processPage(url, body, '', 0, isMarkdown)
      }
      catch (error) {
        if (verbose)
          console.error(`[ERROR] URL: ${url}, Error: ${error instanceof Error ? error.message : 'Unknown'}`)

        progress.crawling.failed++
        results.push({
          url,
          title: '',
          content: '',
          timestamp: Date.now(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: { title: '', description: '', links: [] },
          depth: 0,
        })

        progress.crawling.processed = results.length
        onProgress?.(progress)
      }
    })
  }

  // Mark crawling as completed
  progress.crawling.status = 'completed'
  onProgress?.(progress)

  // Generate output files if requested
  if (results.some(r => r.success)) {
    progress.generation.status = 'generating'
    onProgress?.(progress)

    const successfulResults = results.filter(r => r.success)

    const firstUrl = new URL(withHttps(urls[0]))
    const originUrl = firstUrl.origin
    const homePageResult = successfulResults.find((r) => {
      const resultUrl = new URL(withHttps(r.url))
      return resultUrl.href === originUrl || resultUrl.href === `${originUrl}/`
    })

    const siteName = siteNameOverride || homePageResult?.metadata?.title || homePageResult?.title || firstUrl.hostname
    const description = descriptionOverride || homePageResult?.metadata?.description || successfulResults[0]?.metadata?.description

    if (generateLlmsTxt || generateLlmsFullTxt) {
      progress.generation.current = 'Generating llms.txt files'
      onProgress?.(progress)

      const contentResults = successfulResults.filter((result) => {
        if (!result.content)
          return false
        const trimmedContent = result.content.trim()
        const contentWithoutFrontmatter = trimmedContent.replace(FRONTMATTER_BLOCK_RE, '').trim()
        return contentWithoutFrontmatter.length > 10
      })

      const seenUrls = new Set<string>()
      const deduplicatedResults = contentResults.filter((result) => {
        if (seenUrls.has(result.url))
          return false
        seenUrls.add(result.url)
        return true
      })

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
        origin: originUrl || firstUrl.origin,
        generateFull: generateLlmsFullTxt,
        outputDir,
      })

      if (generateLlmsTxt) {
        progress.generation.current = 'Writing llms.txt'
        onProgress?.(progress)
        await writeFile(join(outputDir, 'llms.txt'), llmsResult.llmsTxt, 'utf-8')
      }

      if (generateLlmsFullTxt && llmsResult.llmsFullTxt) {
        progress.generation.current = 'Writing llms-full.txt'
        onProgress?.(progress)
        await writeFile(join(outputDir, 'llms-full.txt'), llmsResult.llmsFullTxt, 'utf-8')
      }
    }

    progress.generation.status = 'completed'
    onProgress?.(progress)
  }

  return results
}
