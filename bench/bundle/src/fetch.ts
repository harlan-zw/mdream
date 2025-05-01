import { streamHtmlToMarkdown } from '../../../dist'

async function run() {
  const start = performance.now()
  const response = await fetch('https://en.wikipedia.org/wiki/Markdown')
  const markdownStream = streamHtmlToMarkdown(response.body)
  for await (const chunk of markdownStream) {
    process.stdout.write(chunk)
  }
  const end = performance.now()
  const duration = end - start
  console.log(`\n\nFetched and converted in ${duration.toFixed(2)} ms`)
}

run()
