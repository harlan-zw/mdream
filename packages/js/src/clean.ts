/**
 * Cleanup rules for the `clean` option.
 *
 * The rules act on the link and image nodes that produce Markdown, as in Rust,
 * so literal text such as `\[x](#y)` or code is never rewritten. The
 * converter handles `urls`, `emptyLinks`, `emptyImages` and `emptyLinkText`
 * itself. The rules that rewrite a link after it is written live here, in the
 * pass `apply` starts, so they stay out of bundles that do not import `clean()`.
 * `fragments` needs the whole document: whether `#slug` resolves depends on
 * headings that may come later.
 */

import type { Cleaner, CleanOptions, CleanPass, CleanTarget, ElementNode } from './types'
import { FRAGMENT_LINK_CLOSE, FRAGMENT_LINK_OPEN, TAG_A, TAG_CODE, TAG_H1, TAG_H6 } from './const'
import { resolveUrl } from './url'
import { isInsideHeading } from './utils'

const ALL_RULES: CleanOptions = {
  urls: true,
  fragments: true,
  emptyLinks: true,
  redundantLinks: true,
  selfLinkHeadings: true,
  emptyImages: true,
  emptyLinkText: true,
}

/**
 * Create cleanup rules for the `clean` option. Omit `rules` to enable all of them.
 * Import this only when you use it, so other bundles do not include the cleanup pass.
 */
export function clean(rules: CleanOptions = ALL_RULES): Cleaner {
  const resolved = { ...rules }
  const rewritesLinks = resolved.fragments || resolved.redundantLinks || resolved.selfLinkHeadings
  return { ...resolved, apply: target => rewritesLinks ? startPass(resolved, target) : undefined }
}

// ── Link rewrites ──

/**
 * The link rules that act after an anchor writes its `[`. Mirrors the Rust
 * anchor exit: `emptyLinkText` (in the converter) runs first, then
 * `selfLinkHeadings`, then `redundantLinks`; a fragment link is recorded
 * last, and `finish` drops it if no heading has its slug.
 */
function startPass(rules: CleanOptions, target: CleanTarget): CleanPass {
  const fragments = rules.fragments === true
  const selfLinkHeadings = rules.selfLinkHeadings === true
  const redundantLinks = rules.redundantLinks === true
  const buffer = target.buffer
  const depthMap = target.depthMap
  // Open anchors and the buffer index of the `[` each wrote, or -1.
  const links: ElementNode[] = []
  const brackets: number[] = []
  // The exact Markdown each marked link produced, so `finish` drops only
  // markers the pass itself wrote instead of guessing from the characters
  // a source marker happens to sit next to.
  const spans: string[] = []
  // The `[` of the anchor now closing, set by `exit` for `unwrap` and `closed`.
  let closing = -1
  // Raw Markdown of each heading, for `fragments` to resolve slugs against.
  const headings: string[] = []
  let headingStart = -1

  return {
    holdsOutput: fragments,

    enter(element, outputStart) {
      closing = -1
      const tagId = element.tagId!
      if (tagId === TAG_A) {
        links.push(element)
        brackets.push(outputStart < buffer.length && buffer[buffer.length - 1] === '[' ? buffer.length - 1 : -1)
      }
      // Rust takes a heading's slug from the Markdown after its `## ` prefix.
      else if (fragments && headingStart < 0 && tagId >= TAG_H1 && tagId <= TAG_H6 && !depthMap[TAG_A]) {
        headingStart = buffer.length
      }
    },

    exit(element) {
      closing = -1
      const tagId = element.tagId!
      if (tagId === TAG_A) {
        for (let index = links.length - 1; index >= 0; index--) {
          if (links[index] === element) {
            closing = brackets[index]!
            links.length = index
            brackets.length = index
            break
          }
        }
      }
      else if (headingStart >= 0 && tagId >= TAG_H1 && tagId <= TAG_H6 && !depthMap[TAG_A]) {
        headings.push(buffer.slice(headingStart).join(''))
        headingStart = -1
      }
    },

    unwrap(element) {
      const bracket = closing
      const opener = buffer[bracket]
      const href = element.attributes?.href
      if (bracket < 0 || element.tagId !== TAG_A || opener === undefined || opener.charCodeAt(opener.length - 1) !== 91 /* [ */
        || href === undefined || element.tagHandler?.literalExit) {
        return false
      }
      let textLength = 0
      for (let index = bracket + 1; index < buffer.length; index++)
        textLength += buffer[index]!.length
      if (textLength === 0)
        return false
      // Like Rust, the title takes no part: `[url](url "t")` is redundant too.
      const selfLink = selfLinkHeadings && href.charCodeAt(0) === 35 /* # */ && isInsideHeading(depthMap)
      if (!selfLink && !(redundantLinks && spells(buffer, bracket + 1, textLength, resolveUrl(href, target.options?.origin, rules))))
        return false
      // Everything past the `[` belongs to this link and is closed, so folding
      // it into one entry moves no index another open element holds.
      const unwrapped = opener.slice(0, -1) + buffer.slice(bracket + 1).join('')
      buffer.length = bracket
      buffer.push(unwrapped)
      target.lastContentCache = unwrapped
      closing = -1
      return true
    },

    closed(element, outputStart, close) {
      const bracket = closing
      closing = -1
      // Only a bare `](#fragment)` destination qualifies, as in Rust: an
      // angle-bracketed `<#a b>` is never removed. Links in code stay put.
      const code = close.charCodeAt(3)
      if (!fragments || bracket < 0 || element.tagHandler?.literalExit || depthMap[TAG_CODE]
        || close.charCodeAt(0) !== 93 /* ] */ || close.charCodeAt(1) !== 40 /* ( */ || close.charCodeAt(2) !== 35 /* # */
        || code === 41 /* ) */ || code === 32 || Number.isNaN(code)) {
        return
      }
      const opener = buffer[bracket]
      if (opener === undefined || opener.charCodeAt(opener.length - 1) !== 91 /* [ */)
        return
      let index = outputStart
      while (index < buffer.length && buffer[index] !== close)
        index++
      if (index === buffer.length)
        return
      buffer[bracket] = `${opener.slice(0, -1)}${FRAGMENT_LINK_OPEN}[`
      const marked = `${FRAGMENT_LINK_CLOSE}${close}`
      buffer[index] = marked
      if (target.lastContentCache === close)
        target.lastContentCache = marked
      spans.push(`${FRAGMENT_LINK_OPEN}[${buffer.slice(bracket + 1, index).join('')}${marked}`)
    },

    held() {
      for (let index = 0; index < brackets.length; index++) {
        if (brackets[index]! >= 0)
          return brackets[index]!
      }
      return Infinity
    },

    finish(markdown) {
      return fragments ? applyFragments(markdown, headings, spans) : markdown
    },
  }
}

/** Whether `buffer` from `start` on, `length` characters long, spells `value`. */
function spells(buffer: string[], start: number, length: number, value: string): boolean {
  if (length !== value.length)
    return false
  let offset = 0
  for (let index = start; index < buffer.length; index++) {
    const entry = buffer[index]!
    if (!value.startsWith(entry, offset))
      return false
    offset += entry.length
  }
  return true
}

function isEscaped(md: string, index: number): boolean {
  const end = index
  while (index > 0 && md.charCodeAt(index - 1) === 92 /* \\ */)
    index--
  return (end - index) % 2 !== 0
}

function htmlTagEnd(md: string, start: number, lastGt: number): number {
  if (start >= lastGt || isEscaped(md, start))
    return -1
  let i = start + 1
  if (md.charCodeAt(i) === 47 /* / */)
    i++
  let code = md.charCodeAt(i)
  if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122)))
    return -1
  do {
    i++
    code = md.charCodeAt(i)
  } while ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45)
  if (code !== 32 && code !== 9 && code !== 10 && code !== 13 && code !== 47 && code !== 62)
    return -1

  let quote = 0
  while (i < md.length) {
    code = md.charCodeAt(i)
    if (quote) {
      if (code === quote)
        quote = 0
    }
    else if (code === 34 || code === 39) {
      quote = code
    }
    else if (code === 62) {
      return i + 1
    }
    else if (code === 60) {
      return -1
    }
    i++
  }
  return -1
}

// ── Heading slugs ──

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

export { slugify }

/** Strip inline markdown formatting from heading text for slug generation */
export function stripHeadingFormatting(text: string): string {
  let result = ''
  const len = text.length
  const lastGt = text.lastIndexOf('>')
  let firstTickLength = 0
  let firstTickLast = 0
  let otherTickLasts: Map<number, number> | undefined
  if (text.includes('`')) {
    let scan = 0
    while (scan < len) {
      let code = text.charCodeAt(scan)
      if (code === 96 /* ` */) {
        const start = scan
        do {
          scan++
          code = text.charCodeAt(scan)
        } while (code === 96)
        const ticks = scan - start
        if (firstTickLength === 0) {
          firstTickLength = ticks
          firstTickLast = start
        }
        else if (ticks === firstTickLength) {
          firstTickLast = start
        }
        else {
          otherTickLasts ||= new Map()
          otherTickLasts.set(ticks, start)
        }
      }
      else if (code === 60 /* < */) {
        const tagEnd = htmlTagEnd(text, scan, lastGt)
        scan = tagEnd === -1 ? scan + 1 : tagEnd
      }
      else {
        scan++
      }
    }
  }
  let i = 0
  let codeTicks = 0
  while (i < len) {
    const c = text.charCodeAt(i)
    if (c === 96 /* ` */) {
      let end = i + 1
      while (text.charCodeAt(end) === 96)
        end++
      const ticks = end - i
      if (codeTicks === 0) {
        const last = ticks === firstTickLength ? firstTickLast : otherTickLasts?.get(ticks) ?? i
        if (last > i)
          codeTicks = ticks
      }
      else if (codeTicks === ticks) {
        codeTicks = 0
      }
      i = end
      continue
    }
    if (codeTicks !== 0) {
      result += text[i]
      i++
      continue
    }
    if (c === 92 /* \\ */ && i + 1 < len) {
      result += text[i + 1]
      i += 2
      continue
    }
    const tagEnd = c === 60 ? htmlTagEnd(text, i, lastGt) : -1
    if (tagEnd !== -1) {
      i = tagEnd
      continue
    }
    if (c === 91 /* [ */) {
      // `[text](url)` keeps its text. Like Rust, take the first `]` and the
      // first `)` after it without balancing; a lone `[` is dropped.
      const close = text.indexOf(']', i + 1)
      if (close !== -1 && text.charCodeAt(close + 1) === 40 /* ( */) {
        const parenClose = text.indexOf(')', close + 2)
        if (parenClose !== -1) {
          result += text.slice(i + 1, close)
          i = parenClose + 1
          continue
        }
      }
      i++
      continue
    }
    if (c === 42 || c === 95 || c === 126) { // *_~
      i++
      continue
    }
    result += text[i]
    i++
  }
  return result.trim()
}

/** Slug for a heading's Markdown text, as Rust computes it. */
function headingSlug(text: string): string {
  if (text.includes(FRAGMENT_LINK_OPEN) || text.includes(FRAGMENT_LINK_CLOSE))
    text = text.replaceAll(FRAGMENT_LINK_OPEN, '').replaceAll(FRAGMENT_LINK_CLOSE, '')
  return slugify(stripHeadingFormatting(text))
}

// ── Fragments ──

/**
 * Remove fragment links that resolve to no heading.
 *
 * The converter writes `OPEN[` and `CLOSE](#slug)` around each fragment link
 * it emits, so only real links are touched: escaped brackets and code keep
 * their text. A broken link loses only its wrappers, so a link nested in its
 * text is judged on its own. A marker is dropped only when its pair spells a
 * span the pass itself wrote, so a marker character the source carried is
 * kept, even next to link syntax.
 */
function applyFragments(markdown: string, headings: readonly string[], spans: readonly string[]): string {
  let next = markdown.indexOf(FRAGMENT_LINK_OPEN)
  if (next === -1)
    return markdown

  const slugs = new Set<string>()
  for (const heading of headings) {
    const slug = headingSlug(heading)
    if (slug)
      slugs.add(slug)
  }

  // The pass wrote every span above, so only these bytes qualify for the
  // drop; source text shaped like a marked link never matches.
  const written = new Set(spans)

  const open = FRAGMENT_LINK_OPEN.charCodeAt(0)
  const closeCode = FRAGMENT_LINK_CLOSE.charCodeAt(0)
  const len = markdown.length
  // Pass 1: pair markers. For each pair, the number of characters to drop
  // from the open marker and the end of the close.
  const opens: number[] = []
  const dropAt = new Map<number, number>()
  for (let i = next; i < len; i++) {
    const code = markdown.charCodeAt(i)
    if (code === open) {
      if (markdown.charCodeAt(i + 1) === 91 /* [ */)
        opens.push(i)
    }
    else if (code === closeCode && opens.length && markdown.startsWith('](#', i + 1)) {
      // The destination is written bare, so it ends at `)` or at the space
      // before a title.
      let end = i + 4
      while (end < len && markdown.charCodeAt(end) !== 41 && markdown.charCodeAt(end) !== 32)
        end++
      const fragment = markdown.slice(i + 4, end)
      if (markdown.charCodeAt(end) === 32 && markdown.charCodeAt(end + 1) === 34 /* " */) {
        end += 2
        while (end < len && markdown.charCodeAt(end) !== 34)
          end += markdown.charCodeAt(end) === 92 /* \ */ ? 2 : 1
        end++
      }
      if (markdown.charCodeAt(end) !== 41 /* ) */)
        continue
      // Pair the close with the nearest open whose span the pass wrote. A
      // source open has no partner, so dropping a failed candidate keeps it
      // from stealing a later close.
      let paired = -1
      let depth = opens.length
      while (depth > 0) {
        depth--
        if (written.has(markdown.slice(opens[depth]!, end + 1))) {
          paired = depth
          break
        }
      }
      if (paired === -1)
        continue
      const start = opens[paired]!
      opens.length = paired
      const broken = !slugs.has(fragment)
      dropAt.set(start, broken ? 2 : 1)
      dropAt.set(i, broken ? end + 1 - i : 1)
    }
  }

  // Pass 2: copy everything between the dropped runs. U+FDD0 and U+FDD1 are
  // noncharacters reserved for internal use, but the source may still carry
  // one: only markers paired with a span the pass wrote are in `dropAt`, so
  // any other occurrence is source text and is copied verbatim.
  let result = ''
  let copied = 0
  while (next !== -1 && next < len) {
    // A marker a dropped run already swallowed is source text pass 1 never
    // paired: skip it, else `copied` moves backwards and resurrects the tail
    // of a dropped destination or title.
    if (next >= copied) {
      result += markdown.slice(copied, next)
      copied = next + (dropAt.get(next) ?? 0)
    }
    const nextOpen = markdown.indexOf(FRAGMENT_LINK_OPEN, next + 1)
    const nextClose = markdown.indexOf(FRAGMENT_LINK_CLOSE, next + 1)
    next = nextOpen === -1 ? nextClose : nextClose === -1 ? nextOpen : Math.min(nextOpen, nextClose)
  }
  return result + markdown.slice(copied)
}
