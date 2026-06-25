/**
 * Cross-page boilerplate stripping for crawled markdown.
 *
 * Site chrome (top nav, footer link cards, newsletter/testimonial walls) is
 * serialized into every page's markdown. Because a crawl holds the whole corpus,
 * we can detect that chrome by how often it repeats and strip it before the
 * markdown is serialized.
 *
 * Block-level diffing (split on blank lines) is not enough: some sites convert to
 * a single line with no paragraph breaks at all, so there are no blocks to compare.
 * Instead we work at the *token* level with k-gram shingling, which is independent
 * of line structure and catches duplicated spans wherever they appear (a leading
 * nav, a trailing footer, or a repeated band in the middle of the page).
 *
 * Algorithm (linear in total tokens, no pairwise document comparison):
 *   1. Tokenize each doc into whitespace-separated tokens, keeping char offsets.
 *   2. Hash every k consecutive tokens into a shingle (rolling FNV/imul mix).
 *   3. Count how many docs each shingle appears in (once per doc).
 *   4. A shingle is "chrome" when it appears in >= threshold fraction of docs.
 *   5. Mark every token covered by a chrome shingle; remove maximal covered runs
 *      of at least `minRun` tokens; keep the surviving spans.
 *
 * The threshold (how widely a span must repeat) and minRun (how long a repeated
 * span must be) are the safety knobs that stop unique article content being
 * removed: a span has to recur across most of the site and be long to qualify.
 */

// Single source of truth for the detection defaults. Re-exported and referenced
// (e.g. in the crawl CLI help) so the documented values cannot drift from the
// behaviour.
/** Fraction of documents a shingle must appear in to count as chrome (0..1). */
export const DEFAULT_BOILERPLATE_THRESHOLD = 0.5
/** Minimum number of documents before detection runs at all. */
export const DEFAULT_BOILERPLATE_MIN_DOCS = 3
/** Number of consecutive tokens per shingle. */
export const DEFAULT_BOILERPLATE_SHINGLE_SIZE = 6
/** Minimum length (in tokens) of a covered run before it is removed. */
export const DEFAULT_BOILERPLATE_MIN_RUN = 12

export interface BoilerplateOptions {
  /**
   * Fraction of documents a shingle must appear in to count as chrome (0..1).
   * Higher = stricter. Defaults to `DEFAULT_BOILERPLATE_THRESHOLD` (0.5).
   */
  threshold?: number
  /**
   * Minimum number of documents before detection runs at all.
   * Defaults to `DEFAULT_BOILERPLATE_MIN_DOCS` (3).
   */
  minDocs?: number
  /**
   * Number of consecutive tokens per shingle. Smaller catches shorter repeated
   * spans but risks matching common phrases; larger is more conservative.
   * Defaults to `DEFAULT_BOILERPLATE_SHINGLE_SIZE` (6).
   */
  shingleSize?: number
  /**
   * Minimum length (in tokens) of a covered run before it is removed. Stops short
   * incidental matches inside unique prose from being nibbled away.
   * Defaults to `DEFAULT_BOILERPLATE_MIN_RUN` (12).
   */
  minRun?: number
}

const TOKEN_RE = /\S+/g

/** FNV-1a 32-bit hash of a substring of `s` in [start, end). */
function hashToken(s: string, start: number, end: number): number {
  let h = 0x811C9DC5
  for (let i = start; i < end; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

interface TokenizedDoc {
  /** Char offset of the start of each token. */
  starts: number[]
  /** Char offset of the end (exclusive) of each token. */
  ends: number[]
  /** Per-token hash. */
  tokenHashes: number[]
  /** Per-shingle hash; length = max(0, tokens - k + 1), or 1 for a short doc. */
  shingleHashes: number[]
}

function tokenize(md: string, k: number): TokenizedDoc {
  const starts: number[] = []
  const ends: number[] = []
  const tokenHashes: number[] = []
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = TOKEN_RE.exec(md)) !== null) {
    const start = m.index
    const end = TOKEN_RE.lastIndex
    starts.push(start)
    ends.push(end)
    tokenHashes.push(hashToken(md, start, end))
  }

  const n = tokenHashes.length
  const shingleHashes: number[] = []
  if (n === 0) {
    return { starts, ends, tokenHashes, shingleHashes }
  }
  if (n < k) {
    // Short doc: a single shingle over all its tokens.
    shingleHashes.push(mixHashes(tokenHashes, 0, n))
  }
  else {
    for (let i = 0; i + k <= n; i++)
      shingleHashes.push(mixHashes(tokenHashes, i, i + k))
  }
  return { starts, ends, tokenHashes, shingleHashes }
}

/** Combine token hashes [from, to) into a single shingle hash. */
function mixHashes(tokenHashes: number[], from: number, to: number): number {
  let h = 0x811C9DC5
  for (let i = from; i < to; i++) {
    h ^= tokenHashes[i]
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function detectChromeShingles(docs: TokenizedDoc[], threshold: number): Set<number> {
  const counts = new Map<number, number>()
  for (let d = 0; d < docs.length; d++) {
    const shingles = docs[d].shingleHashes
    const seen = new Set<number>()
    for (let i = 0; i < shingles.length; i++) {
      const h = shingles[i]
      if (seen.has(h))
        continue
      seen.add(h)
      counts.set(h, (counts.get(h) ?? 0) + 1)
    }
  }
  const minCount = Math.max(2, Math.ceil(threshold * docs.length))
  const chrome = new Set<number>()
  for (const [h, c] of counts) {
    if (c >= minCount)
      chrome.add(h)
  }
  return chrome
}

function stripDoc(md: string, doc: TokenizedDoc, chrome: Set<number>, k: number, minRun: number): string {
  const n = doc.tokenHashes.length
  if (n === 0)
    return md

  // Mark every token covered by a chrome shingle.
  const covered = new Uint8Array(n)
  const shingles = doc.shingleHashes
  if (n < k) {
    if (shingles.length === 1 && chrome.has(shingles[0]))
      covered.fill(1)
  }
  else {
    for (let i = 0; i < shingles.length; i++) {
      if (chrome.has(shingles[i])) {
        for (let j = i; j < i + k; j++)
          covered[j] = 1
      }
    }
  }

  // Build the set of surviving token spans by dropping covered runs >= minRun.
  const keptRanges: [number, number][] = [] // [startTokenIdx, endTokenIdx) inclusive-exclusive
  let runStart = 0
  let i = 0
  while (i < n) {
    if (!covered[i]) {
      i++
      continue
    }
    // Start of a covered run.
    let j = i
    while (j < n && covered[j])
      j++
    const runLen = j - i
    if (runLen >= minRun) {
      // Flush the surviving span before this run.
      if (i > runStart)
        keptRanges.push([runStart, i])
      runStart = j
    }
    // Short covered run: treat as content, leave it in place.
    i = j
  }
  if (runStart < n)
    keptRanges.push([runStart, n])

  // Nothing removed: preserve the original bytes exactly.
  if (keptRanges.length === 1 && keptRanges[0][0] === 0 && keptRanges[0][1] === n)
    return md

  // Everything removed: keep the original rather than emit an empty file.
  if (keptRanges.length === 0)
    return md

  // Reconstruct from surviving spans, preserving each span's internal formatting
  // (whitespace/newlines), joining separated spans with a blank line.
  const pieces: string[] = []
  for (const [s, e] of keptRanges)
    pieces.push(md.slice(doc.starts[s], doc.ends[e - 1]).trim())

  return pieces.filter(Boolean).join('\n\n')
}

/**
 * Strip repeated cross-page boilerplate from a corpus of markdown documents.
 *
 * Returns a new array aligned with `contents`. Documents that are unchanged (no
 * detected chrome, or detection skipped) are returned byte-for-byte as given.
 */
export function stripBoilerplateFromCorpus(contents: string[], options: BoilerplateOptions = {}): string[] {
  const threshold = options.threshold ?? DEFAULT_BOILERPLATE_THRESHOLD
  const minDocs = options.minDocs ?? DEFAULT_BOILERPLATE_MIN_DOCS
  const k = Math.max(2, options.shingleSize ?? DEFAULT_BOILERPLATE_SHINGLE_SIZE)
  const minRun = Math.max(k, options.minRun ?? DEFAULT_BOILERPLATE_MIN_RUN)

  if (contents.length < minDocs)
    return contents.slice()

  const docs = contents.map(md => tokenize(md, k))
  const chrome = detectChromeShingles(docs, threshold)
  if (chrome.size === 0)
    return contents.slice()

  return contents.map((md, idx) => stripDoc(md, docs[idx], chrome, k, minRun))
}
