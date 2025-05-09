import { streamHtmlToMarkdown } from '../../../src/stream'

export default defineEventHandler(async (event) => {
  // Get the URL from query params
  const query = getQuery(event)
  const url = query.url as string
  const $url = new URL(url)

  if (!url) {
    throw createError({
      statusCode: 400,
      message: 'URL parameter is required',
    })
  }

  // Set up headers for Server-Sent Events
  setResponseHeader(event, 'Content-Type', 'text/event-stream')

  // Fetch the HTML content
  const response = await fetch(url)

  if (!response.ok) {
    return createError({
      statusCode: response.status,
      message: `Failed to fetch ${url}: ${response.statusText}`,
    })
  }

  // Check if the response is HTML
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) {
    return createError({
      statusCode: 400,
      message: `Response from ${url} is an unsupported content-type: ${contentType}`,
    })
  }

  // Get readable stream from fetch response
  const htmlStream = response.body

  if (!htmlStream) {
    return
  }

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of streamHtmlToMarkdown(htmlStream, {
        filters: 'minimal-from-first-header',
        origin: $url.origin,
      })) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })

  return sendStream(event, readableStream)
})
