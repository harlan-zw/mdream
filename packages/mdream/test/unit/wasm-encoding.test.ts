import { describe, expect, it } from 'vitest'
import { decodeWasm, encodeWasm } from '../../src/wasm-encoding.js'

describe('inline WASM encoding', () => {
  it.each([
    new Uint8Array(0),
    Uint8Array.from({ length: 512 }, (_, index) => (index < 256 ? index : 255)),
  ])('round-trips binary data %#', (bytes) => {
    expect(decodeWasm(encodeWasm(bytes))).toEqual(bytes)
  })
})
