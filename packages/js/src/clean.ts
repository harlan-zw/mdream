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

import type { Cleaner, CleanOptions, CleanPass, CleanTarget, CleanView, ElementNode } from './types'
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
  const resolved: Cleaner = {
    ...rules,
    apply: target => resolved.fragments || resolved.redundantLinks || resolved.selfLinkHeadings
      ? startPass(resolved, target)
      : undefined,
  }
  return resolved
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
  // The exact Markdown each marked link produced, in the order the links
  // closed, which is the order of their close markers in the output. When
  // the source carries marker characters too, `finish` drops only markers
  // whose pair spells one of these spans.
  const spans: string[] = []
  // The `#fragment` each span links to, parallel to `spans`.
  const spanFragments: string[] = []
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
      target.outputPositions?.replace(bracket, buffer.length, [unwrapped], offset => offset > opener.length - 1 ? offset - 1 : offset)
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
      const markedOpener = `${opener.slice(0, -1)}${FRAGMENT_LINK_OPEN}[`
      target.outputPositions?.replace(bracket, bracket + 1, [markedOpener], offset => offset > opener.length - 1 ? offset + FRAGMENT_LINK_OPEN.length : offset)
      buffer[bracket] = markedOpener
      const marked = `${FRAGMENT_LINK_CLOSE}${close}`
      target.outputPositions?.replace(index, index + 1, [marked], offset => offset > 0 ? offset + FRAGMENT_LINK_CLOSE.length : offset)
      buffer[index] = marked
      if (target.lastContentCache === close)
        target.lastContentCache = marked
      spans.push(`${FRAGMENT_LINK_OPEN}[${buffer.slice(bracket + 1, index).join('')}${marked}`)
      spanFragments.push(close.slice(3, destinationEnd(close, 3)))
    },

    held() {
      for (let index = 0; index < brackets.length; index++) {
        if (brackets[index]! >= 0)
          return brackets[index]!
      }
      return Infinity
    },

    finish(markdown) {
      return fragments ? applyFragments(markdown, headings, spans, spanFragments) : { markdown }
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

const OPEN_CODE = FRAGMENT_LINK_OPEN.charCodeAt(0)
const CLOSE_CODE = FRAGMENT_LINK_CLOSE.charCodeAt(0)

/** End of the bare destination starting at `from`: the `)`, or the space before a title. */
function destinationEnd(markdown: string, from: number): number {
  let end = from
  while (end < markdown.length && markdown.charCodeAt(end) !== 41 /* ) */ && markdown.charCodeAt(end) !== 32)
    end++
  return end
}

/** Position past the `](#fragment)` or `](#fragment "title")` at `start`, or -1. */
function linkCloseEnd(markdown: string, start: number): number {
  if (markdown.charCodeAt(start) !== 93 /* ] */ || markdown.charCodeAt(start + 1) !== 40 /* ( */ || markdown.charCodeAt(start + 2) !== 35 /* # */)
    return -1
  let end = destinationEnd(markdown, start + 3)
  if (markdown.charCodeAt(end) === 32 && markdown.charCodeAt(end + 1) === 34 /* " */) {
    end += 2
    while (end < markdown.length && markdown.charCodeAt(end) !== 34)
      end += markdown.charCodeAt(end) === 92 /* \ */ ? 2 : 1
    end++
  }
  return markdown.charCodeAt(end) === 41 ? end + 1 : -1
}

/**
 * Pair the markers when the pass wrote every marker in `markdown`. The pass
 * writes one open and one close marker per span, and spans nest, so the k-th
 * close marker belongs to the k-th span and pairs with the open marker on top
 * of the stack. No Markdown around the markers takes part, so code spans,
 * escapes and quote prefixes in link text cannot hide a marker. Returns false
 * when `markdown` holds other marker characters, which come from the source.
 */
function pairWrittenMarkers(markdown: string, count: number, opens: number[], closes: number[]): boolean {
  const stack: number[] = []
  let opened = 0
  let closed = 0
  let nextOpen = markdown.indexOf(FRAGMENT_LINK_OPEN)
  let nextClose = markdown.indexOf(FRAGMENT_LINK_CLOSE)
  while (nextOpen !== -1 || nextClose !== -1) {
    if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
      if (opened === count || markdown.charCodeAt(nextOpen + 1) !== 91 /* [ */)
        return false
      stack.push(nextOpen)
      opened++
      nextOpen = markdown.indexOf(FRAGMENT_LINK_OPEN, nextOpen + 1)
    }
    else {
      if (closed === count || stack.length === 0)
        return false
      opens[closed] = stack.pop()!
      closes[closed] = nextClose
      closed++
      nextClose = markdown.indexOf(FRAGMENT_LINK_CLOSE, nextClose + 1)
    }
  }
  return opened === count && closed === count
}

/** Whether `index` sits right after a newline or at the string start. */
function isLineStart(markdown: string, index: number): boolean {
  return index === 0 || markdown.charCodeAt(index - 1) === 10
}

/** Backtick run at a line start that opens a fence, or 0. */
function fenceOpeningRun(markdown: string, start: number, len: number): number {
  let i = start
  while (i < len && markdown.charCodeAt(i) === 32)
    i++
  if (markdown.charCodeAt(i) !== 96)
    return 0
  let end = i
  while (end < len && markdown.charCodeAt(end) === 96)
    end++
  return end - i >= 3 ? end - i : 0
}

/** Whether a fence opened by `run` closes on the line at `start`. */
function fenceCloses(markdown: string, start: number, run: number, len: number): boolean {
  let i = start
  while (i < len && markdown.charCodeAt(i) === 32)
    i++
  if (markdown.charCodeAt(i) !== 96)
    return false
  let end = i
  while (end < len && markdown.charCodeAt(end) === 96)
    end++
  if (end - i < run)
    return false
  while (end < len) {
    const code = markdown.charCodeAt(end)
    if (code === 10)
      return true
    if (code !== 32 && code !== 9)
      return false
    end++
  }
  return true
}

/** Position past the run of exactly `run` backticks closing a code span, or -1. */
function inlineCodeEnd(markdown: string, from: number, run: number, len: number): number {
  let search = from
  while (search < len) {
    if (markdown.charCodeAt(search) !== 96) {
      const next = markdown.indexOf('`', search)
      if (next === -1)
        return -1
      search = next
    }
    let end = search
    while (end < len && markdown.charCodeAt(end) === 96)
      end++
    if (end - search === run)
      return end
    search = end
  }
  return -1
}

/**
 * Pair the markers when the source carries marker characters too. Only a pair
 * that spells a span the pass wrote qualifies. Code can carry bytes identical
 * to a written span, since code escapes no brackets; the pass never marks
 * links in code and code output never wraps a marked link, so markers inside
 * a fence or code span are source bytes and pair nothing. Inside a `](...)`
 * destination, backticks are literal, not span delimiters, and an escaped
 * backtick opens no code span.
 */
function pairSpelledMarkers(markdown: string, spans: readonly string[], opens: number[], closes: number[]): void {
  // Spans with the same Markdown link to the same fragment, so any of them
  // takes a matching pair.
  const unpaired = new Map<string, number[]>()
  for (let index = spans.length - 1; index >= 0; index--) {
    const spelling = stripQuotePrefixes(spans[index]!)
    const list = unpaired.get(spelling)
    if (list)
      list.push(index)
    else
      unpaired.set(spelling, [index])
  }
  const len = markdown.length
  const candidates: number[] = []
  let fenceRun = 0
  let inDestination = false
  let i = 0
  while (i < len) {
    if (fenceRun > 0) {
      // Fence content is code: scan line by line for the closing fence.
      const newline = markdown.indexOf('\n', i)
      const lineEnd = newline === -1 ? len : newline + 1
      if (isLineStart(markdown, i) && fenceCloses(markdown, i, fenceRun, len))
        fenceRun = 0
      i = lineEnd
      continue
    }
    const code = markdown.charCodeAt(i)
    if (code === 10 /* \n */) {
      i++
      continue
    }
    if (candidates.length === 0 && isLineStart(markdown, i)) {
      const run = fenceOpeningRun(markdown, i, len)
      if (run > 0) {
        fenceRun = run
        const newline = markdown.indexOf('\n', i)
        i = newline === -1 ? len : newline + 1
        continue
      }
    }
    if (candidates.length === 0 && code === 96 /* ` */ && !isEscaped(markdown, i)) {
      let end = i
      while (end < len && markdown.charCodeAt(end) === 96)
        end++
      const closed = inDestination ? -1 : inlineCodeEnd(markdown, end, end - i, len)
      i = closed === -1 ? end : closed
      continue
    }
    if (code === 93 /* ] */ && markdown.charCodeAt(i + 1) === 40 /* ( */) {
      inDestination = true
      i += 2
      continue
    }
    if (inDestination && code === 41 /* ) */) {
      inDestination = false
      i++
      continue
    }
    if (code === OPEN_CODE) {
      if (markdown.charCodeAt(i + 1) === 91 /* [ */)
        candidates.push(i)
    }
    else if (code === CLOSE_CODE && candidates.length) {
      const end = linkCloseEnd(markdown, i + 1)
      if (end !== -1) {
        // Pair the close with the nearest open whose span the pass wrote. A
        // source open has no partner, so dropping a failed candidate keeps
        // it from stealing a later close.
        let depth = candidates.length
        while (depth > 0) {
          depth--
          const list = unpaired.get(stripQuotePrefixes(markdown.slice(candidates[depth]!, end)))
          if (list?.length) {
            const span = list.pop()!
            opens[span] = candidates[depth]!
            closes[span] = i
            candidates.length = depth
            break
          }
        }
      }
    }
    i++
  }
}

/** Quotes and lists indent child lines after an anchor records its spelling. */
function stripQuotePrefixes(value: string): string {
  let result = ''
  let copied = 0
  let newline = value.indexOf('\n')
  while (newline !== -1) {
    let end = newline + 1
    while (value.charCodeAt(end) === 32)
      end++
    while (value.charCodeAt(end) === 62) {
      end++
      if (value.charCodeAt(end) === 32)
        end++
    }
    if (end > newline + 1) {
      result += value.slice(copied, newline + 1)
      copied = end
    }
    newline = value.indexOf('\n', end)
  }
  return copied ? result + value.slice(copied) : value
}

/**
 * Remove fragment links that resolve to no heading.
 *
 * The converter writes `OPEN[` and `CLOSE](#slug)` around each fragment link
 * it emits, so only real links are touched: escaped brackets and code keep
 * their text. A broken link loses only its wrappers, so a link nested in its
 * text is judged on its own. U+FDD0 and U+FDD1 are noncharacters reserved for
 * internal use, but the source may still carry one; only markers paired with
 * a span the pass wrote are dropped, and any other one is copied verbatim.
 */
function applyFragments(markdown: string, headings: readonly string[], spans: readonly string[], spanFragments: readonly string[]): CleanView {
  const count = spans.length
  if (count === 0)
    return { markdown, mapPosition: position => position }

  const slugs = new Set<string>()
  for (const heading of headings) {
    const slug = headingSlug(heading)
    if (slug)
      slugs.add(slug)
  }

  // Positions of each span's open and close marker, or -1 when unpaired.
  const opens: number[] = []
  const closes: number[] = []
  for (let span = 0; span < count; span++) {
    opens.push(-1)
    closes.push(-1)
  }
  const written = pairWrittenMarkers(markdown, count, opens, closes)
  if (!written) {
    opens.fill(-1)
    closes.fill(-1)
    pairSpelledMarkers(markdown, spans, opens, closes)
  }

  // Each pair drops its markers, and a broken link also drops its `[` and
  // its `](#slug)`.
  const dropAt = new Map<number, number>()
  for (let span = 0; span < count; span++) {
    const open = opens[span]!
    if (open === -1)
      continue
    const close = closes[span]!
    const closeEnd = linkCloseEnd(markdown, close + 1)
    const broken = closeEnd !== -1 && !slugs.has(spanFragments[span]!)
    dropAt.set(open, broken ? 2 : 1)
    dropAt.set(close, broken ? closeEnd - close : 1)
  }

  // Copy everything between the dropped runs, walking the markers in order.
  let result = ''
  let copied = 0
  let nextOpen = markdown.indexOf(FRAGMENT_LINK_OPEN)
  let nextClose = markdown.indexOf(FRAGMENT_LINK_CLOSE)
  while (nextOpen !== -1 || nextClose !== -1) {
    let next
    if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
      next = nextOpen
      nextOpen = markdown.indexOf(FRAGMENT_LINK_OPEN, next + 1)
    }
    else {
      next = nextClose
      nextClose = markdown.indexOf(FRAGMENT_LINK_CLOSE, next + 1)
    }
    // A marker inside a dropped run was never paired: the run already
    // removed it, so it must not move `copied` backwards.
    const drop = dropAt.get(next)
    if (drop === undefined || next < copied)
      continue
    result += markdown.slice(copied, next)
    copied = next + drop
  }
  result += markdown.slice(copied)
  let positionMap: ((position: number) => number) | undefined
  return {
    markdown: result,
    mapPosition(position) {
      positionMap ??= createPositionMap(dropAt)
      return positionMap(position)
    },
  }
}

/** Build only when a reader needs offsets; ordinary conversion uses no map. */
function createPositionMap(drops: ReadonlyMap<number, number>): (position: number) => number {
  const starts: number[] = []
  const ends: number[] = []
  const totals: number[] = []
  let removed = 0
  let copied = 0
  for (const start of [...drops.keys()].sort((a, b) => a - b)) {
    if (start < copied)
      continue
    const length = drops.get(start)!
    copied = start + length
    removed += length
    starts.push(start)
    ends.push(copied)
    totals.push(removed)
  }
  return (position) => {
    let lower = 0
    let upper = ends.length
    while (lower < upper) {
      const middle = (lower + upper) >>> 1
      if (ends[middle]! <= position)
        lower = middle + 1
      else
        upper = middle
    }
    const completed = lower > 0 ? totals[lower - 1]! : 0
    const partial = lower < starts.length ? Math.max(0, position - starts[lower]!) : 0
    return position - completed - partial
  }
}
