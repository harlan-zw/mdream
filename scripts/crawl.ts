import { PlaywrightCrawler, Log } from 'crawlee';
import {syncHtmlToMarkdown} from "../dist/index.mjs";
import {writeFile} from "node:fs/promises";
import {mkdirSync, existsSync} from "node:fs";


// CheerioCrawler crawls the web using HTTP requests
// and parses HTML using the Cheerio library.
const crawler = new PlaywrightCrawler({
  // Use the requestHandler to process each of the crawled pages.
  async requestHandler({ page, request, log }) {
    await page.waitForLoadState('networkidle')
    const html = await page.innerHTML('html')
    log.info('HTML length' , { url: request.loadedUrl, length: html.length })
    const now = new Date()
    const md = syncHtmlToMarkdown(html)
    log.info('Processed html -> md in', { url: request.loadedUrl, time: new Date() - now })
    // mkdir
    if (!existsSync('./output')) {
      mkdirSync('./output');
    }
    await writeFile(`./output/${request.loadedUrl.replace(/[^a-zA-Z0-9]/g, '-')}.md`, md, 'utf-8')
    log.info('Processed URL', { url: request.loadedUrl })
  },

  // Let's limit our crawls to make our tests shorter and safer.
  maxRequestsPerCrawl: 50,
});

// Add first URL to the queue and start the crawl.
await crawler.run([
  'https://www.bbc.com/news/world',
  'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
  'https://www.nasa.gov/missions/',
  'https://github.com/torvalds',
  'https://news.ycombinator.com',
  'https://harlanzw.com',
  'https://nuxt.com/docs/getting-started/installation',
  'https://vercel.com/docs/getting-started-with-vercel',
  'https://stackoverflow.com/questions/tagged/javascript',
  'https://arxiv.org/list/cs.AI/recent',
]);
