/** A boundary in writer-owned buffer fragments, before final cleanup. */
export interface OutputPosition {
  fragment: number
  offset: number
  kind: 'boundary' | 'content'
}

export interface OutputPositions {
  capture: (fragment?: number, offset?: number, kind?: OutputPosition['kind']) => OutputPosition
  replace: (start: number, end: number, replacement: string[], mapOffset?: (offset: number, kind: OutputPosition['kind']) => number) => void
  finish: () => (position: OutputPosition) => number
}

/** Only the fragment-enabled splitter needs positions across buffer rewrites. */
export function createOutputPositions(buffer: string[]): OutputPositions {
  const positions: OutputPosition[] = []
  return {
    capture(fragment = Math.max(0, buffer.length - 1), offset = buffer[fragment]?.length ?? 0, kind: OutputPosition['kind'] = 'boundary') {
      const position = { fragment, offset, kind }
      positions.push(position)
      return position
    },
    replace(start, end, replacement, mapOffset) {
      if (positions.length === 0)
        return
      const fragmentDelta = replacement.length - (end - start)
      let lower = 0
      let upper = positions.length
      while (lower < upper) {
        const middle = (lower + upper) >>> 1
        if (positions[middle]!.fragment < start)
          lower = middle + 1
        else
          upper = middle
      }
      // Prefix sums make a quote with many captured fences linear in its
      // fragments, rather than summing the quote again for every position.
      let oldPrefix: number[] | undefined
      let newPrefix: number[] | undefined
      for (let index = lower; index < positions.length; index++) {
        const position = positions[index]!
        if (position.fragment >= end) {
          if (fragmentDelta === 0)
            break
          position.fragment += fragmentDelta
          continue
        }
        if (!oldPrefix) {
          oldPrefix = [0]
          for (let index = start; index < end; index++)
            oldPrefix.push(oldPrefix.at(-1)! + buffer[index]!.length)
          newPrefix = [0]
          for (const fragment of replacement)
            newPrefix.push(newPrefix.at(-1)! + fragment.length)
        }
        const oldOffset = oldPrefix[position.fragment - start]! + position.offset
        const endOffset = newPrefix!.at(-1)!
        const offset = Math.max(0, Math.min(mapOffset ? mapOffset(oldOffset, position.kind) : oldOffset, endOffset))
        if (replacement.length === 0 || (position.kind === 'boundary' && offset === 0 && start > 0)) {
          position.fragment = Math.max(0, start - 1)
          position.offset = start > 0 ? buffer[start - 1]!.length : 0
          continue
        }
        let fragment = 0
        while (fragment + 1 < replacement.length
          && (newPrefix![fragment + 1]! < offset || (position.kind === 'content' && newPrefix![fragment + 1] === offset))) {
          fragment++
        }
        position.fragment = start + fragment
        position.offset = offset - newPrefix![fragment]!
      }
    },
    finish() {
      const prefix = [0]
      for (const fragment of buffer)
        prefix.push(prefix.at(-1)! + fragment.length)
      return position => prefix[Math.min(position.fragment, buffer.length)]!
        + Math.min(position.offset, buffer[position.fragment]?.length ?? 0)
    },
  }
}
