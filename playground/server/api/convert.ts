import { createMarkdownStreamFromHTMLStream } from '../../../src/stream'

export default defineEventHandler(async (event) => {
  // Get the URL from query params
  const query = getQuery(event)
  const url = query.url as string

  if (!url) {
    throw createError({
      statusCode: 400,
      message: 'URL parameter is required',
    })
  }

  // Set up headers for Server-Sent Events
  setResponseHeader(event, 'Content-Type', 'text/html')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Transfer-Encoding', 'chunked')

  try {
    // Fetch the HTML content
    const response = await fetch(url)

    if (!response.ok) {
      return
    }

    // Check if the response is HTML
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      return
    }

    // Get readable stream from fetch response
    const htmlStream = response.body

    if (!htmlStream) {
      return
    }

    // Create HTML chunks
    const decoder = new TextDecoder()
    const reader = htmlStream.getReader()

    // Stream HTML to markdown in chunks
    const streamHTML = async function* () {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done)
            break
          yield decoder.decode(value, { stream: true })
        }
        // Final decode to flush decoder
        yield decoder.decode()
      }
      catch (err) {
        console.error('Error reading HTML stream:', err)
      }
    }

    // Convert HTML stream to markdown stream
    const markdownStream = createMarkdownStreamFromHTMLStream(streamHTML())

    // Send markdown chunks as SSE events
    for await (const chunk of markdownStream) {
      sendEvent('message', chunk)
    }

    // Signal completion
    sendEvent('complete', 'Conversion completed')
  }
  catch (error) {
    console.error('Error:', error)
    sendEvent('error', error.message || 'An error occurred during conversion')
  }
  finally {
    closeStream()
  }

  return streamResponse
})
