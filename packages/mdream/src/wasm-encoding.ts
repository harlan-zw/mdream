const ALPHABET = '!#%&()*+,-./0123456789:;=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~'
// Quotes, escapes, and '<' are omitted so the payload can sit in a script literal.
// The last two symbols introduce a two-character code for a less frequent byte.
const SINGLE_CHAR_CODES = ALPHABET.length - 2

export interface EncodedWasm {
  data: string
  codebook: string
  byteLength: number
}

export function encodeWasm(bytes: Uint8Array): EncodedWasm {
  const frequencies = new Uint32Array(256)
  for (const byte of bytes)
    frequencies[byte]++

  const rankedBytes = Array.from(frequencies.keys()).sort((a, b) => frequencies[b] - frequencies[a])
  const codes: string[] = []
  for (const [rank, byte] of rankedBytes.entries()) {
    const offset = rank - SINGLE_CHAR_CODES
    codes[byte] = offset < 0
      ? ALPHABET[rank]
      : ALPHABET[SINGLE_CHAR_CODES + Math.floor(offset / ALPHABET.length)] + ALPHABET[offset % ALPHABET.length]
  }

  return {
    data: Array.from(bytes, byte => codes[byte]).join(''),
    codebook: btoa(String.fromCharCode(...rankedBytes)),
    byteLength: bytes.length,
  }
}

export function decodeWasm({ data, codebook, byteLength }: EncodedWasm): Uint8Array<ArrayBuffer> {
  const rankedBytes = atob(codebook)
  const ranks = new Uint8Array(128)
  for (let rank = 0; rank < ALPHABET.length; rank++)
    ranks[ALPHABET.charCodeAt(rank)] = rank

  const bytes = new Uint8Array(byteLength)
  let index = 0
  for (let offset = 0; offset < bytes.length; offset++) {
    let rank = ranks[data.charCodeAt(index++)]
    if (rank >= SINGLE_CHAR_CODES)
      rank = SINGLE_CHAR_CODES + (rank - SINGLE_CHAR_CODES) * ALPHABET.length + ranks[data.charCodeAt(index++)]
    bytes[offset] = rankedBytes.charCodeAt(rank)
  }

  return bytes
}
