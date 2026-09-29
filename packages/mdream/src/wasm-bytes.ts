import { readFileSync } from 'node:fs'

/**
 * The WASM binary, for entries that initialize synchronously at import (the
 * browser entry and the CDN script). The build replaces this module with the
 * binary inlined as base64 (build.config.ts). This source version serves tests
 * and stubs, which run in Node.
 */
export function wasmBytes(): Uint8Array {
  return readFileSync(new URL('../wasm/mdream_edge_bg.wasm', import.meta.url))
}
