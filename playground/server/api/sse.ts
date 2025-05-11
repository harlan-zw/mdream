import { streamHtmlToMarkdown } from '../../../src/stream'

export default defineEventHandler(async (event) => {
  // Get the URL from query params
  const query = getQuery(event)
  const url = query.url as string
  const filtersParam = query.filters as string

  if (!url) {
    throw createError({
      statusCode: 400,
      message: 'URL parameter is required',
    })
  }

  // Parse URL
  const $url = new URL(url)

  // Parse filters parameter
  let filterOptions: any = 'minimal-from-first-header' // Default filter

  if (filtersParam) {
    const filterParts = filtersParam.split(',')

    const parsedFilters: any = {}

    filterParts.forEach((filter) => {
      // Check if filter has parameters
      if (filter.includes(':')) {
        const [filterName, filterValue] = filter.split(':')

        if (filterName === 'from-first-tag') {
          parsedFilters['from-first-tag'] = { tag: filterValue }
        }
        else if (filterName === 'exclude-tags') {
          parsedFilters['exclude-tags'] = { tags: filterValue.split(',') }
        }
        else {
          parsedFilters[filterName] = true
        }
      }
      else {
        parsedFilters[filter] = true
      }
    })

    // Check if we have parsed filters
    if (Object.keys(parsedFilters).length > 0) {
      filterOptions = parsedFilters
    }
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

  const eventStream = createEventStream(event)
  async function processChunks() {
    for await (const chunk of streamHtmlToMarkdown(htmlStream, {
      filters: filterOptions,
      origin: $url.origin,
    })) {
      await eventStream.push(chunk)
    }
  }
  processChunks().then(() => {
    // Close the stream when done
    eventStream.close()
  })
  return eventStream.send()
})
