interface AcceptEntry {
  type: string
  q: number
  position: number
}

/**
 * Parse an HTTP Accept header into an ordered list of media types with quality values.
 * Supports quality weights (q=0.9) and preserves original position for tie-breaking.
 */
export function parseAcceptHeader(accept: string): AcceptEntry[] {
  if (!accept)
    return []
  const entries: AcceptEntry[] = []
  const parts = accept.split(',')
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part)
      continue
    const semicolonIdx = part.indexOf(';')
    let type: string
    let q = 1
    if (semicolonIdx === -1) {
      type = part
    }
    else {
      type = part.slice(0, semicolonIdx).trim()
      // Extract q value without regex for performance
      const paramStr = part.slice(semicolonIdx + 1)
      const qIdx = paramStr.indexOf('q=')
      if (qIdx !== -1) {
        const qStart = qIdx + 2
        let qEnd = qStart
        while (qEnd < paramStr.length && paramStr.charCodeAt(qEnd) !== 59 /* ; */ && paramStr.charCodeAt(qEnd) !== 32 /* space */) {
          qEnd++
        }
        q = +paramStr.slice(qStart, qEnd) || 0
      }
    }
    entries.push({ type, q, position: i })
  }
  return entries
}

/**
 * Determine if a client prefers markdown over HTML using proper content negotiation.
 *
 * Uses Accept header quality weights and position ordering:
 * - If text/markdown or text/plain has higher quality than text/html → markdown
 * - If same quality, earlier position in Accept header wins
 * - Bare wildcard does NOT trigger markdown (prevents breaking OG crawlers)
 * - sec-fetch-dest: document always returns false (browser navigation)
 *
 * @param acceptHeader - The HTTP Accept header value
 * @param secFetchDest - The Sec-Fetch-Dest header value
 */
export function shouldServeMarkdown(acceptHeader?: string, secFetchDest?: string): boolean {
  if (secFetchDest === 'document') {
    return false
  }

  const accept = acceptHeader || ''
  if (!accept)
    return false

  const parts = accept.split(',')
  let bestMdQ = -1
  let bestMdPos = -1
  let htmlQ = -1
  let htmlPos = -1

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part)
      continue
    const semicolonIdx = part.indexOf(';')
    let type: string
    let q = 1
    if (semicolonIdx === -1) {
      type = part
    }
    else {
      type = part.slice(0, semicolonIdx).trim()
      const paramStr = part.slice(semicolonIdx + 1)
      const qIdx = paramStr.indexOf('q=')
      if (qIdx !== -1) {
        const qStart = qIdx + 2
        let qEnd = qStart
        while (qEnd < paramStr.length && paramStr.charCodeAt(qEnd) !== 59 && paramStr.charCodeAt(qEnd) !== 32) {
          qEnd++
        }
        q = +paramStr.slice(qStart, qEnd) || 0
      }
    }

    if (type === 'text/markdown' || type === 'text/plain') {
      if (q > bestMdQ || (q === bestMdQ && (bestMdPos === -1 || i < bestMdPos))) {
        bestMdQ = q
        bestMdPos = i
      }
    }
    else if (type === 'text/html') {
      htmlQ = q
      htmlPos = i
    }
  }

  if (bestMdPos === -1)
    return false
  if (htmlPos === -1)
    return true
  if (bestMdQ > htmlQ)
    return true
  if (bestMdQ === htmlQ && bestMdPos < htmlPos)
    return true

  return false
}
