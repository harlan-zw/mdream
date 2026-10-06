import type { BlockquoteFrame, BufferScanState, MarkdownState, MarkdownStreamContext } from './markdown-processor'
import { TAG_PRE } from './const'
import { isAsciiWhitespace, lineOpensRawHtmlBlock, stripBlockquoteListIndent, trimAsciiWhitespaceEnd } from './markdown-processor'
import { isInsideHeading, trimOutputStart } from './utils'

interface QuoteScan {
  owner: BlockquoteFrame
  depth: number
  start: number
  fragment: number
  lastFragment: string | undefined
  length: number
  newline: number
  settledEnd: number
  attemptedEnd: number
}

function resetBufferScanCursors(scan: BufferScanState): void {
  scan[1] = 0
  scan[2] = 0
  scan[3] = 0
  scan[4] = 0
}

/** Quote completed lines while leaving the final line mutable. */
function flushBlockquoteLines(state: MarkdownState): boolean {
  const buffer = state.buffer
  const frames = state.blockquotes
  let start = buffer.length
  let previous = -1
  for (const frame of frames) {
    // Rewrites before an earlier frame need the existing exit finalizer.
    if (frame.fragment < previous)
      return false
    start = Math.min(start, frame.fragment)
    previous = frame.fragment
  }
  let length = 0
  for (let index = start; index < buffer.length; index++)
    length += buffer[index]!.length
  if (length < 8192)
    return false

  const content = buffer.slice(start).join('')
  const stableEnd = trimAsciiWhitespaceEnd(content).length
  let end = content.lastIndexOf('\n', stableEnd - 1) + 1
  while (end >= 2 && content.charCodeAt(end - 2) === 10)
    end--
  if (end === 0)
    return false

  const starts: number[] = []
  for (const frame of frames) {
    let offset = 0
    for (let index = start; index < frame.fragment; index++)
      offset += buffer[index]!.length
    if (offset >= end || (starts.length > 0 && offset < starts[starts.length - 1]!))
      return false
    starts.push(offset)
  }

  let quoted = content.slice(0, end)
  for (let index = frames.length - 1; index >= 0; index--) {
    const frame = frames[index]!
    const offset = starts[index]!
    const prefix = `${frame.listIndent}>`
    const body = quoted.slice(offset, -1)
    quoted = `${quoted.slice(0, offset) + body.split('\n').map((line) => {
      const unindented = stripBlockquoteListIndent(line, frame.listIndent)
      return unindented ? `${prefix} ${unindented}` : prefix
    }).join('\n')}\n`
  }

  // Keep untouched tail fragments, including lastContentCache identity.
  let cut = start
  let remaining = end
  while (remaining >= buffer[cut]!.length) {
    remaining -= buffer[cut]!.length
    cut++
  }
  const tail = buffer.slice(cut)
  if (remaining !== 0) {
    const original = tail[0]!
    tail[0] = original.slice(remaining)
    if (cut === buffer.length - 1 && state.lastContentCache === original)
      state.lastContentCache = tail[0]
  }
  buffer.length = start
  buffer.push(quoted)
  for (const fragment of tail)
    buffer.push(fragment)
  for (const frame of frames) {
    frame.fragment = start + 1
    frame.followsWhitespace = true
  }
  return true
}

function prepareQuoteOutput(state: MarkdownState, bufferScan: BufferScanState, quoteScan: QuoteScan | undefined): QuoteScan | undefined {
  const owner = state.blockquotes[0]!
  let start = owner.fragment
  for (let index = 1; index < state.blockquotes.length; index++)
    start = Math.min(start, state.blockquotes[index]!.fragment)
  if (!quoteScan || quoteScan.owner !== owner || quoteScan.depth !== state.blockquotes.length
    || quoteScan.start !== start || state.buffer[quoteScan.fragment - 1] !== quoteScan.lastFragment) {
    quoteScan = {
      owner,
      depth: state.blockquotes.length,
      start,
      fragment: start,
      lastFragment: undefined,
      length: 0,
      newline: -1,
      settledEnd: -1,
      attemptedEnd: -1,
    }
  }
  // Scan only new fragments. A long line has no settled boundary and
  // must not be joined and rescanned after every input chunk.
  for (; quoteScan.fragment < state.buffer.length; quoteScan.fragment++) {
    const fragment = state.buffer[quoteScan.fragment]!
    const lastNewline = fragment.lastIndexOf('\n')
    const contentEnd = trimAsciiWhitespaceEnd(fragment).length
    if (contentEnd > 0) {
      const settled = lastNewline < contentEnd
        ? lastNewline
        : fragment.lastIndexOf('\n', contentEnd - 1)
      quoteScan.settledEnd = settled === -1 ? quoteScan.newline : quoteScan.length + settled
    }
    if (lastNewline !== -1)
      quoteScan.newline = quoteScan.length + lastNewline
    quoteScan.length += fragment.length
    quoteScan.lastFragment = fragment
  }
  // Observe raw-HTML context before quote prefixes rewrite line leads.
  if (quoteScan.length >= 8192 && quoteScan.settledEnd > quoteScan.attemptedEnd) {
    quoteScan.attemptedEnd = quoteScan.settledEnd
    const lineLead = lineOpensRawHtmlBlock(state.buffer, bufferScan)
    if (flushBlockquoteLines(state)) {
      quoteScan = undefined
      bufferScan[5] = lineLead
      bufferScan[1] = 0
      bufferScan[2] = 0
      bufferScan[3] = 0
      bufferScan[4] = 0
    }
  }
  return quoteScan
}

/** Drain stable Markdown while retaining mutable fragments. */
export function createMarkdownDrain(context: MarkdownStreamContext, _hasPlugins: boolean) {
  const { state, options, bufferScan } = context
  let lastYieldedLength = 0
  let hasYieldedContent = false
  let quoteScan: QuoteScan | undefined

  // getMarkdownChunk returns before this when `holdsOutput` is set.
  function prepareDrain(final: boolean): number {
    context.settleItemMarker()
    if (!final && state.blockquotes.length > 0 && !state.outputPositions
      && context.getNonQuoteHeldOutputFragment() === Infinity) {
      quoteScan = prepareQuoteOutput(state, bufferScan, quoteScan)
    }
    else {
      quoteScan = undefined
    }
    return context.getHeldOutputFragment(final)
  }

  function observeStableOutput(content: string, end: number): void {
    // Keep the current line's first-byte decision when compaction drops it.
    // A new newline clears this decision; an empty line stays undecided.
    bufferScan[5] = lineOpensRawHtmlBlock(state.buffer, bufferScan)
    if (!context.inRawHtmlRegion() || bufferScan[0])
      return
    // The raw region starts at its scan cursor. Earlier blank lines belong
    // to the preceding block and must not activate Markdown in this region.
    let start = 0
    const scannedTo = bufferScan[1] > state.buffer.length ? 0 : bufferScan[1]
    for (let index = 0; index < scannedTo; index++)
      start += state.buffer[index]!.length
    const blankLine = content.indexOf('\n\n', Math.max(0, start - 1))
    if (blankLine !== -1 && blankLine + 2 <= end)
      bufferScan[0] = true
  }

  function compactQuotePrefix(fragment: number, content: string, start: number): number {
    if (state.blockquotes.length === 0 || start <= 0 || state.outputPositions
      || context.getNonQuoteHeldOutputFragment() !== Infinity) {
      return 0
    }
    const retained = content.slice(start)
    state.buffer.splice(0, fragment, retained)
    for (const frame of state.blockquotes)
      frame.fragment -= fragment - 1
    quoteScan = undefined
    bufferScan[1] = 0
    bufferScan[2] = 1
    bufferScan[3] = bufferScan[5] === undefined ? 1 : 0
    bufferScan[4] = 0
    return start
  }

  function getMarkdownChunk(final = false): string {
    // A fragment link resolves against headings that may come later, so
    // `fragments` holds the whole document back, as Rust does.
    if (context.holdsOutput)
      return final ? context.getMarkdown() : ''
    const heldFragment = prepareDrain(final)

    const fragmentHeld = heldFragment !== Infinity

    // A held suffix cannot be emitted yet. Joining it on every input chunk
    // repeatedly copies large fences and quotes before their owners close.
    const content = fragmentHeld ? state.buffer.slice(0, heldFragment).join('') : state.buffer.join('')
    const currentContent = hasYieldedContent ? content : trimOutputStart(content)
    const leadingTrimmed = content.length - currentContent.length
    // Keep the cursor in buffer coordinates across the initial leading trim.
    const yieldedLength = Math.max(0, lastYieldedLength - leadingTrimmed)
    const inPre = state.depthMap[TAG_PRE] !== 0 && state.preFenceOwnerDepth !== 0
    let stableLength = currentContent.length
    let retainMutableFragments = false
    if (inPre && !fragmentHeld) {
      const trailingCode = currentContent.charCodeAt(stableLength - 1)
      while (stableLength > 0 && currentContent.charCodeAt(stableLength - 1) === 32)
        stableLength--
      retainMutableFragments = stableLength < currentContent.length
      if (state.lastTextNode?.containsWhitespace && isAsciiWhitespace(trailingCode)) {
        stableLength = trimAsciiWhitespaceEnd(currentContent).length
        retainMutableFragments = stableLength < currentContent.length
      }
    }
    else {
      // The prefix ends before a mutable owner. Its trailing block spacing
      // stays buffered even when that owner sits inside a preformatted block.
      while (stableLength > 0) {
        const code = currentContent.charCodeAt(stableLength - 1)
        if (code !== 32 && code !== 10)
          break
        stableLength--
      }
      retainMutableFragments = stableLength < currentContent.length
    }

    // A heading's exit escapes the trailing `#` run GFM would read as an ATX
    // closing sequence, so hold the run (and the spacing that decides whether it
    // closes) until the heading is complete. Scan from the stable cut: held
    // bytes after it, such as an empty emphasis marker or a link
    // `emptyLinkText` may drop, can still vanish and leave the run trailing.
    const headingHeld = !final && isInsideHeading(state.depthMap)
    if (headingHeld) {
      let headingPos = stableLength
      while (headingPos > 0) {
        const code = currentContent.charCodeAt(headingPos - 1)
        if (code !== 35 && code !== 32 && code !== 9) // # space tab
          break
        headingPos--
      }
      if (headingPos < stableLength)
        stableLength = headingPos
    }

    // A later mutable tail can move the stable boundary behind bytes already
    // returned to the caller. Keep the cursor monotonic so those bytes are not
    // emitted a second time once following content makes the tail stable.
    if (stableLength < yieldedLength)
      stableLength = yieldedLength

    const newContent = currentContent.slice(yieldedLength, stableLength)
    if (newContent || hasYieldedContent)
      lastYieldedLength = stableLength + leadingTrimmed
    if (newContent && !hasYieldedContent) {
      hasYieldedContent = true
      context.markYielded()
    }

    // Retain spacing context and mutable spaces instead of the cumulative output.
    // Yielded slices otherwise retain one full parent string per chunk.
    // Wrapping also needs the current line until leading trim stops changing it.
    const wrapping = !!options.wrapWidth
    if (hasYieldedContent && fragmentHeld && state.blockquotes.length > 0 && !headingHeld && !inPre && (!wrapping || leadingTrimmed === 0)) {
      observeStableOutput(content, stableLength + leadingTrimmed)
      let retainedStart = stableLength + leadingTrimmed - 17
      if (wrapping)
        retainedStart = Math.min(retainedStart, content.lastIndexOf('\n', stableLength + leadingTrimmed - 1))
      const removed = compactQuotePrefix(heldFragment, content, Math.max(0, retainedStart))
      lastYieldedLength -= removed
    }
    if (hasYieldedContent && !fragmentHeld && !headingHeld && (!retainMutableFragments || !inPre) && (!wrapping || leadingTrimmed === 0)) {
      // A raw region resumes Markdown after a blank line. Remember that
      // transition before compaction drops the bytes that established it.
      observeStableOutput(content, stableLength + leadingTrimmed)
      // A list prefix can contain three spaces, nine digits, a delimiter,
      // and three trailing spaces. Keep its preceding byte to classify it.
      let contextStart = stableLength - 17
      if (wrapping) {
        const lineStart = currentContent.lastIndexOf('\n', stableLength - 1)
        if (lineStart < contextStart)
          contextStart = lineStart
      }
      if (retainMutableFragments && leadingTrimmed === 0) {
        // Preserve the final fragment as a separate value: close handlers
        // identify and trim it by reference equality with lastContentCache.
        const lastFragment = state.buffer.at(-1)!
        const fragmentStart = currentContent.length - lastFragment.length
        const tailStart = Math.max(0, Math.min(contextStart, fragmentStart))
        const emittedTail = currentContent.slice(tailStart, fragmentStart)
        state.buffer.length = 0
        resetBufferScanCursors(bufferScan)
        if (emittedTail)
          state.buffer.push(emittedTail)
        state.buffer.push(lastFragment)
        lastYieldedLength = stableLength - tailStart
      }
      else if (!retainMutableFragments) {
        const tailStart = Math.max(0, contextStart)
        const emittedTail = currentContent.slice(tailStart, stableLength)
        state.buffer.length = 0
        resetBufferScanCursors(bufferScan)
        if (emittedTail)
          state.buffer.push(emittedTail)
        lastYieldedLength = emittedTail.length
      }
      // Retained newlines were already scanned before compaction.
      bufferScan[2] = state.buffer.length
      if (bufferScan[5] === undefined)
        bufferScan[3] = state.buffer.length
    }
    return newContent
  }

  return { getMarkdownChunk }
}
