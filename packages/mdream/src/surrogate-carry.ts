export interface SurrogateCarry {
  /** Returns the part of `chunk` that is safe to convert now. */
  take: (chunk: string) => string
  /** Returns the held high surrogate, if any, and clears it. */
  flush: () => string
}

/**
 * A string chunk can end between the two halves of a UTF-16 surrogate pair.
 * The native and WASM bindings encode each chunk to UTF-8 on its own and turn a
 * lone half into U+FFFD, so the high half waits for the chunk that completes it.
 */
export function createSurrogateCarry(): SurrogateCarry {
  let held = ''
  return {
    take(chunk) {
      if (held) {
        chunk = held + chunk
        held = ''
      }
      const last = chunk.charCodeAt(chunk.length - 1)
      if (last >= 0xD800 && last <= 0xDBFF) {
        held = chunk.slice(-1)
        return chunk.slice(0, -1)
      }
      return chunk
    },
    flush() {
      const value = held
      held = ''
      return value
    },
  }
}
