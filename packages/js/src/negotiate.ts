export type ContentNegotiationResult = 'markdown' | 'html' | 'not-acceptable'

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
    const part = parts[i]!.trim()
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
 * Perform RFC 7231 content negotiation for HTML vs Markdown.
 *
 * Resolution rules:
 * - `Sec-Fetch-Dest: document` always returns `'html'` (browser navigation).
 * - Missing or empty Accept header returns `'html'` (server picks default).
 * - q=0 entries are treated as explicit rejections and ignored for matching
 *   (but still count towards "something was listed").
 * - `text/markdown` and `text/plain` are the markdown-capable types.
 * - `text/html` and `application/xhtml+xml` are the html-capable types.
 * - `*_/_*` and `text/*` are wildcards; they satisfy 406 but never on their
 *   own tip negotiation towards markdown (preserves OG crawler behavior).
 * - If nothing in the Accept header can be served (no explicit match, no
 *   wildcard), returns `'not-acceptable'` so the caller can send 406.
 * - Otherwise, compares best markdown entry vs best html-or-wildcard entry
 *   by q, then by position.
 */
export function negotiateContent(acceptHeader?: string, secFetchDest?: string): ContentNegotiationResult {
  if (secFetchDest === 'document')
    return 'html'

  const accept = acceptHeader || ''
  if (!accept)
    return 'html'

  let bestMdQ = -1
  let bestMdPos = -1
  let bestHtmlQ = -1
  let bestHtmlPos = -1
  let bestWildcardQ = -1
  let bestWildcardPos = -1
  let sawAnyEntry = false
  let sawAcceptable = false
  // Track explicit q=0 rejections so wildcard fallback can't resurrect them.
  let rejectedMd = false
  let rejectedHtml = false

  const parts = accept.split(',')
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!.trim()
    if (!part)
      continue
    sawAnyEntry = true

    const semicolonIdx = part.indexOf(';')
    let type: string
    let q = 1
    if (semicolonIdx === -1) {
      type = part
    }
    else {
      type = part.slice(0, semicolonIdx).trim()
      const paramStr = part.slice(semicolonIdx + 1)
      // Find q= case-insensitively without allocating.
      let qIdx = -1
      for (let j = 0; j < paramStr.length - 1; j++) {
        const c = paramStr.charCodeAt(j)
        if ((c === 113 || c === 81) && paramStr.charCodeAt(j + 1) === 61 /* = */) {
          qIdx = j
          break
        }
      }
      if (qIdx !== -1) {
        const qStart = qIdx + 2
        let qEnd = qStart
        while (qEnd < paramStr.length && paramStr.charCodeAt(qEnd) !== 59 && paramStr.charCodeAt(qEnd) !== 32) {
          qEnd++
        }
        q = +paramStr.slice(qStart, qEnd) || 0
      }
    }

    // Normalize type for case-insensitive comparison (media types per RFC 7231).
    const normalized = type.toLowerCase()

    if (normalized === 'text/markdown' || normalized === 'text/plain') {
      if (q === 0) {
        rejectedMd = true
        continue
      }
      sawAcceptable = true
      if (q > bestMdQ || (q === bestMdQ && bestMdPos === -1)) {
        bestMdQ = q
        bestMdPos = i
      }
    }
    else if (normalized === 'text/html' || normalized === 'application/xhtml+xml') {
      if (q === 0) {
        rejectedHtml = true
        continue
      }
      sawAcceptable = true
      if (q > bestHtmlQ || (q === bestHtmlQ && bestHtmlPos === -1)) {
        bestHtmlQ = q
        bestHtmlPos = i
      }
    }
    else if (normalized === '*/*' || normalized === 'text/*') {
      if (q === 0)
        continue
      sawAcceptable = true
      if (q > bestWildcardQ || (q === bestWildcardQ && bestWildcardPos === -1)) {
        bestWildcardQ = q
        bestWildcardPos = i
      }
    }
  }

  if (sawAnyEntry && !sawAcceptable)
    return 'not-acceptable'

  // Apply wildcard fallback only when the concrete type wasn't explicitly rejected.
  if (bestMdPos === -1 && !rejectedMd && bestWildcardPos !== -1) {
    bestMdQ = bestWildcardQ
    bestMdPos = bestWildcardPos
  }
  if (bestHtmlPos === -1 && !rejectedHtml && bestWildcardPos !== -1) {
    bestHtmlQ = bestWildcardQ
    bestHtmlPos = bestWildcardPos
  }

  if (bestMdPos === -1)
    return 'html'
  if (bestHtmlPos === -1)
    return 'markdown'
  if (bestMdQ > bestHtmlQ)
    return 'markdown'
  if (bestMdQ === bestHtmlQ && bestMdPos < bestHtmlPos)
    return 'markdown'
  return 'html'
}

/**
 * Determine if a client prefers markdown over HTML. Convenience wrapper over
 * {@link negotiateContent}; treats `'not-acceptable'` the same as `'html'`
 * (callers that want 406 semantics should use `negotiateContent` directly).
 */
export function shouldServeMarkdown(acceptHeader?: string, secFetchDest?: string): boolean {
  return negotiateContent(acceptHeader, secFetchDest) === 'markdown'
}
