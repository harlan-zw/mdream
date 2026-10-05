import type { BufferScanState, MarkdownStreamContext } from './markdown-processor'
import { TAG_PRE } from './const'
import { isAsciiWhitespace, trimAsciiWhitespaceEnd } from './markdown-processor'
import { isInsideHeading, trimOutputStart } from './utils'

function resetBufferScanCursors(scan: BufferScanState): void {
  scan[1] = 0
  scan[2] = 0
  scan[3] = 0
  scan[4] = 0
}

/** Drain stable Markdown while retaining mutable fragments. */
export function createMarkdownDrain(context: MarkdownStreamContext, _hasPlugins: boolean) {
  const { state, options, bufferScan } = context
  let lastYieldedLength = 0
  let hasYieldedContent = false
  function getMarkdownChunk(final = false): string {
    // A fragment link resolves against headings that may come later, so
    // `fragments` holds the whole document back, as Rust does.
    if (context.holdsOutput)
      return final ? context.getMarkdown() : ''
    const heldFragment = context.prepareDrain(final)

    const fragmentHeld = heldFragment !== Infinity

    // A held suffix cannot be emitted yet. Joining it on every input chunk
    // repeatedly copies large fences and quotes before their owners close.
    const content = fragmentHeld ? state.buffer.slice(0, heldFragment).join('') : state.buffer.join('')
    const currentContent = hasYieldedContent ? content : trimOutputStart(content)
    const leadingTrimmed = content.length - currentContent.length
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
    if (stableLength < lastYieldedLength)
      stableLength = lastYieldedLength

    const newContent = currentContent.slice(lastYieldedLength, stableLength)
    lastYieldedLength = stableLength
    if (newContent && !hasYieldedContent) {
      hasYieldedContent = true
      context.markYielded()
      // Later calls stop trimming the leading whitespace, so move the cursor
      // from trimmed offsets to buffer offsets. Otherwise it points into
      // already-yielded bytes and they are emitted again.
      lastYieldedLength += leadingTrimmed
    }

    // Keep only enough emitted context for spacing/newline decisions, plus any
    // trailing spaces that are still mutable. This prevents every stream chunk
    // from joining and slicing the entire cumulative output: a yielded slice
    // keeps its whole parent string alive, so a caller that holds the chunks
    // would otherwise hold one copy of the output per chunk. Wrapping reads the
    // current column, so it keeps the whole current line and waits until the
    // leading trim no longer moves that column.
    const wrapping = !!options.wrapWidth
    if (hasYieldedContent && !fragmentHeld && !headingHeld && (!retainMutableFragments || !inPre) && (!wrapping || leadingTrimmed === 0)) {
      // A raw region resumes Markdown after a blank line. Remember that
      // transition before compaction drops the bytes that established it.
      context.observeStableOutput(content, stableLength + leadingTrimmed)
      let contextStart = stableLength - 2
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
