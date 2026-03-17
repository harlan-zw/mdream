/**
 * Post-processing markdown cleanup functions.
 * Character-scan approach — no regex. All operate on the final markdown string.
 */

export interface CleanOptions {
  /** Strip tracking query parameters (utm_*, fbclid, gclid, etc.) from URLs */
  urls?: boolean
  /** Strip fragment-only links that don't match any heading slug */
  fragments?: boolean
  /** Strip links with meaningless hrefs (#, javascript:, empty) → plain text */
  emptyLinks?: boolean
  /** Collapse 3+ consecutive blank lines to 2 */
  blankLines?: boolean
  /** Strip links where text equals URL: [https://x.com](https://x.com) → https://x.com */
  redundantLinks?: boolean
  /** Strip self-referencing heading anchors: ## [Title](#title) → ## Title */
  selfLinkHeadings?: boolean
  /** Strip images with no alt text (decorative/tracking pixels) */
  emptyImages?: boolean
  /** Drop links that produce no visible text: [](url) → nothing */
  emptyLinkText?: boolean
}

export function resolveClean(clean: boolean | CleanOptions): CleanOptions {
  if (clean === true)
    return { urls: true, fragments: true, emptyLinks: true, redundantLinks: true, selfLinkHeadings: true, emptyImages: true, emptyLinkText: true }
  if (clean === false)
    return {}
  return clean
}

// ── Shared: parse markdown link at position ──

/**
 * Try to parse a markdown link `[text](url)` starting at position `start` (the `[`).
 * Returns { text, url, end } or null if not a link.
 * Handles balanced parens in URLs (e.g. `javascript:void(0)`).
 */
function parseLink(md: string, start: number): { text: string, url: string, end: number } | null {
  const len = md.length
  // Find matching ]
  let j = start + 1
  let depth = 1
  while (j < len && depth > 0) {
    const c = md.charCodeAt(j)
    if (c === 91 /* [ */)
      depth++
    else if (c === 93 /* ] */)
      depth--
    j++
  }
  if (depth !== 0)
    return null
  const textEnd = j - 1 // position of ]

  // Check for (
  if (j >= len || md.charCodeAt(j) !== 40 /* ( */)
    return null
  j++ // skip (

  // Read URL with balanced parens
  const urlStart = j
  let parenDepth = 1
  while (j < len && parenDepth > 0) {
    const c = md.charCodeAt(j)
    if (c === 40 /* ( */)
      parenDepth++
    else if (c === 41 /* ) */)
      parenDepth--
    j++
  }
  if (parenDepth !== 0)
    return null
  const urlEnd = j - 1 // position of closing )

  return {
    text: md.slice(start + 1, textEnd),
    url: md.slice(urlStart, urlEnd),
    end: j,
  }
}

// ── Fragments ──

function slugify(text: string): string {
  let slug = ''
  let lastWasDash = false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c >= 97 && c <= 122) {
      slug += text[i]
      lastWasDash = false
    }
    else if (c >= 65 && c <= 90) {
      slug += String.fromCharCode(c + 32)
      lastWasDash = false
    }
    else if (c >= 48 && c <= 57) {
      slug += text[i]
      lastWasDash = false
    }
    else if (c === 95) {
      slug += '_'
      lastWasDash = false
    }
    else if (c === 32 || c === 9 || c === 45) {
      if (!lastWasDash && slug.length > 0) {
        slug += '-'
        lastWasDash = true
      }
    }
  }
  if (lastWasDash)
    slug = slug.slice(0, -1)
  return slug
}

/** Strip inline markdown formatting from heading text for slug generation */
function stripHeadingFormatting(text: string): string {
  let result = ''
  const len = text.length
  let i = 0
  while (i < len) {
    const c = text.charCodeAt(i)
    if (c === 91 /* [ */) {
      // Try to parse [text](url) → extract text only
      const link = parseLink(text, i)
      if (link) {
        result += link.text
        i = link.end
        continue
      }
    }
    if (c === 42 || c === 95 || c === 96 || c === 126) { // *_`~
      i++
      continue
    }
    result += text[i]
    i++
  }
  return result.trim()
}

function collectHeadingSlugs(md: string): Set<string> {
  const slugs = new Set<string>()
  const len = md.length
  let i = 0
  while (i < len) {
    if (i === 0 || md.charCodeAt(i - 1) === 10) {
      let hashes = 0
      let j = i
      while (j < len && md.charCodeAt(j) === 35) {
        hashes++
        j++
      }
      if (hashes >= 1 && hashes <= 6 && j < len && md.charCodeAt(j) === 32) {
        j++
        const lineEnd = md.indexOf('\n', j)
        const headingText = lineEnd === -1 ? md.slice(j) : md.slice(j, lineEnd)
        const cleaned = stripHeadingFormatting(headingText)
        if (cleaned)
          slugs.add(slugify(cleaned))
      }
    }
    const nl = md.indexOf('\n', i)
    if (nl === -1)
      break
    i = nl + 1
  }
  return slugs
}

export function cleanFragments(md: string): string {
  const slugs = collectHeadingSlugs(md)
  const len = md.length
  let result = ''
  let i = 0

  while (i < len) {
    if (md.charCodeAt(i) === 91 /* [ */) {
      const link = parseLink(md, i)
      if (link && link.url.charCodeAt(0) === 35 /* # */ && link.url.length > 1) {
        const fragment = link.url.slice(1).split(' ')[0]!
        if (slugs.size > 0 ? !slugs.has(fragment) : true) {
          result += link.text
          i = link.end
          continue
        }
      }
    }
    result += md[i]
    i++
  }
  return result
}

// ── Empty links ──

export function cleanEmptyLinks(md: string): string {
  const len = md.length
  let result = ''
  let i = 0

  while (i < len) {
    if (md.charCodeAt(i) === 91 /* [ */) {
      const link = parseLink(md, i)
      if (link) {
        const url = link.url
        if (url === '#' || url.startsWith('javascript:')) {
          result += link.text
          i = link.end
          continue
        }
      }
    }
    result += md[i]
    i++
  }
  return result
}

// ── Blank lines ──

export function cleanBlankLines(md: string): string {
  let result = ''
  let consecutive = 0
  for (let i = 0; i < md.length; i++) {
    if (md.charCodeAt(i) === 10) {
      consecutive++
      if (consecutive <= 2)
        result += '\n'
    }
    else {
      consecutive = 0
      result += md[i]
    }
  }
  return result
}

// ── Redundant links ──

export function cleanRedundantLinks(md: string): string {
  const len = md.length
  let result = ''
  let i = 0
  while (i < len) {
    if (md.charCodeAt(i) === 91 /* [ */) {
      const link = parseLink(md, i)
      if (link && link.text === link.url) {
        result += link.text
        i = link.end
        continue
      }
    }
    result += md[i]
    i++
  }
  return result
}

// ── Self-link headings ──

export function cleanSelfLinkHeadings(md: string): string {
  const len = md.length
  let result = ''
  let i = 0
  while (i < len) {
    // Check for heading at line start
    if (i === 0 || md.charCodeAt(i - 1) === 10) {
      let hashes = 0
      let j = i
      while (j < len && md.charCodeAt(j) === 35 /* # */) {
        hashes++
        j++
      }
      if (hashes >= 1 && hashes <= 6 && j < len && md.charCodeAt(j) === 32) {
        j++ // skip space
        // Check if next char is [ (a link)
        if (j < len && md.charCodeAt(j) === 91 /* [ */) {
          const link = parseLink(md, j)
          if (link && link.url.charCodeAt(0) === 35 /* # */) {
            // Self-linking heading → strip link, keep text
            result += md.slice(i, j) // ## prefix
            result += link.text
            i = link.end
            continue
          }
        }
      }
    }
    result += md[i]
    i++
  }
  return result
}

// ── Empty images ──

export function cleanEmptyImages(md: string): string {
  const len = md.length
  let result = ''
  let i = 0
  while (i < len) {
    // Check for ![
    if (md.charCodeAt(i) === 33 /* ! */ && i + 1 < len && md.charCodeAt(i + 1) === 91 /* [ */) {
      // Find ]
      let j = i + 2
      const altStart = j
      while (j < len && md.charCodeAt(j) !== 93 /* ] */) j++
      if (j < len) {
        const alt = md.slice(altStart, j).trim()
        if (alt.length === 0) {
          // Empty alt — find the (url) part and skip the whole thing
          j++ // skip ]
          if (j < len && md.charCodeAt(j) === 40 /* ( */) {
            let parenDepth = 1
            j++
            while (j < len && parenDepth > 0) {
              if (md.charCodeAt(j) === 40)
                parenDepth++
              else if (md.charCodeAt(j) === 41)
                parenDepth--
              j++
            }
            i = j
            continue
          }
        }
      }
    }
    result += md[i]
    i++
  }
  return result
}

// ── Empty link text ──

export function cleanEmptyLinkText(md: string): string {
  const len = md.length
  let result = ''
  let i = 0
  while (i < len) {
    if (md.charCodeAt(i) === 91 /* [ */) {
      const link = parseLink(md, i)
      if (link && link.text.trim().length === 0) {
        i = link.end
        continue
      }
    }
    result += md[i]
    i++
  }
  return result
}

// ── Apply all ──

export function applyClean(md: string, opts: CleanOptions): string {
  if (opts.emptyImages)
    md = cleanEmptyImages(md)
  if (opts.emptyLinks)
    md = cleanEmptyLinks(md)
  if (opts.emptyLinkText)
    md = cleanEmptyLinkText(md)
  if (opts.redundantLinks)
    md = cleanRedundantLinks(md)
  if (opts.selfLinkHeadings)
    md = cleanSelfLinkHeadings(md)
  if (opts.fragments)
    md = cleanFragments(md)
  return md
}
