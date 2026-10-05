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

function fragmentPosition(buffer: string[], fragment: number): number {
  let position = 0
  for (let index = 0; index < fragment; index++)
    position += buffer[index]!.length
  return position
}

function trimBufferedWhitespacePosition(content: string, position: number): number {
  let end = Math.max(0, position)
  while (end > 0) {
    const code = content.charCodeAt(end - 1)
    if (code !== 32 && code !== 10)
      break
    end--
  }
  return end
}

/** Drain stable Markdown while retaining mutable fragments. */
export function createMarkdownDrain(context: MarkdownStreamContext, hasPlugins: boolean) {
  const { state, options, bufferScan } = context
  let lastYieldedLength = 0
  let hasYieldedContent = false
  function getMarkdownChunk(final = false): string {
    // A fragment link resolves against headings that may come later, so
    // `fragments` holds the whole document back, as Rust does.
    if (context.holdsOutput)
      return final ? context.getMarkdown() : ''
    const heldFragment = context.prepareDrain(final)
    const content = state.buffer.join('')
    const currentContent = hasYieldedContent ? content : trimOutputStart(content)
    // Before a <pre> opens its fence, its tail is still the block spacing its
    // own enter wrote, which finalization trims. Only past the fence is
    // trailing whitespace code.
    const inPre = state.depthMap[TAG_PRE] !== 0 && state.preFenceOwnerDepth !== 0
    let stableLength = currentContent.length
    let retainMutableFragments = false
    if (inPre) {
      const trailingCode = currentContent.charCodeAt(stableLength - 1)
      while (stableLength > 0 && currentContent.charCodeAt(stableLength - 1) === 32)
        stableLength--
      retainMutableFragments = stableLength < currentContent.length
      if (state.lastTextNode?.containsWhitespace && isAsciiWhitespace(trailingCode)) {
        stableLength = trimAsciiWhitespaceEnd(currentContent).length
        retainMutableFragments = stableLength < currentContent.length
      }
      // A handler-written trailing space (a list marker opened before this
      // <pre>) is retracted by the next block boundary, so it stays buffered
      // mid-line exactly like the non-pre branch: yielding it as stable would
      // strand the boundary newline behind the monotonic yield cursor.
    }
    else {
      // Block spacing and trailing spaces can still be trimmed by a later
      // element close or by finalization. Keep them buffered until following
      // content makes them stable.
      while (stableLength > 0) {
        const code = currentContent.charCodeAt(stableLength - 1)
        if (code !== 32 && code !== 10)
          break
        stableLength--
      }
      retainMutableFragments = stableLength < currentContent.length
    }

    const leadingTrimmed = content.length - currentContent.length

    const fragmentHeld = heldFragment !== Infinity
    if (fragmentHeld) {
      stableLength = Math.min(stableLength, trimBufferedWhitespacePosition(
        currentContent,
        fragmentPosition(state.buffer, heldFragment) - leadingTrimmed,
      ))
    }

    // A heading's exit escapes the trailing `#` run GFM would read as an ATX
    // closing sequence, so hold the run (and the spacing that decides whether it
    // closes) until the heading is complete.
    const headingHeld = !final && isInsideHeading(state.depthMap)
    if (headingHeld) {
      // Scan back from what would be released: held content after it, such
      // as a link `emptyLinkText` may drop, can leave the run at the end.
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
    }

    // Keep only enough emitted context for spacing/newline decisions, plus any
    // trailing spaces that are still mutable. This prevents every stream chunk
    // from joining and slicing the entire cumulative output. Plugin, wrapping,
    // and open-link paths retain the full buffer because they can inspect or
    // rewrite earlier content.
    if (!fragmentHeld && !headingHeld && (!retainMutableFragments || !inPre)) {
      if (!hasPlugins && !options.wrapWidth) {
        if (retainMutableFragments && leadingTrimmed === 0) {
          // Preserve the final fragment as a separate value: close handlers
          // identify and trim it by reference equality with lastContentCache.
          const lastFragment = state.buffer.at(-1)!
          const fragmentStart = currentContent.length - lastFragment.length
          const tailStart = Math.max(0, Math.min(stableLength - 2, fragmentStart))
          const emittedTail = currentContent.slice(tailStart, fragmentStart)
          state.buffer.length = 0
          resetBufferScanCursors(bufferScan)
          if (emittedTail)
            state.buffer.push(emittedTail)
          state.buffer.push(lastFragment)
          lastYieldedLength = stableLength - tailStart
        }
        else if (!retainMutableFragments) {
          const tailStart = Math.max(0, stableLength - 2)
          const emittedTail = currentContent.slice(tailStart, stableLength)
          state.buffer.length = 0
          resetBufferScanCursors(bufferScan)
          if (emittedTail)
            state.buffer.push(emittedTail)
          lastYieldedLength = emittedTail.length
        }
      }
      else if (!retainMutableFragments && state.buffer.length > 1) {
        state.buffer.length = 0
        resetBufferScanCursors(bufferScan)
        state.buffer.push(currentContent)
      }
    }
    return newContent
  }

  return { getMarkdownChunk }
}
