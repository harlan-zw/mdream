import { describe, expect, it } from 'vitest'
import { assertPairedOutputEquivalence, drainByteChunks } from './perf-paired-ci.mjs'

const textChunks = ['<p>alpha</p>', '<p>beta</p>']
const byteChunks = textChunks.map(chunk => new TextEncoder().encode(chunk))

function streamGlue(outputs: string[], bytes: boolean) {
  let index = 0
  return {
    MarkdownStream: class {
      processChunkBytes = bytes ? () => outputs[index++] ?? '' : undefined
      processChunk = bytes ? undefined : () => outputs[index++] ?? ''
      finish = () => ''
      free = () => {}
    },
  }
}

function paired(base: string[], pr: string[], bytes: boolean) {
  return () => assertPairedOutputEquivalence(
    () => drainByteChunks(streamGlue(base, bytes), bytes ? textChunks : byteChunks),
    () => drainByteChunks(streamGlue(pr, bytes), bytes ? textChunks : byteChunks),
  )
}

describe.each([
  ['byte', true],
  ['text', false],
])('paired ci equivalence guard (%s stream)', (_name, bytes) => {
  it('throws when equal-length output content differs', () => {
    expect(paired(['gamma one', 'delta two'], ['amma oneZ', 'delta two'], bytes)).toThrow(TypeError)
  })

  it('throws when output lengths differ', () => {
    expect(paired(['gamma one', 'delta two'], ['gamma one', 'delta two!'], bytes)).toThrow(TypeError)
  })

  it('passes identical output', () => {
    expect(paired(['gamma one', 'delta two'], ['gamma one', 'delta two'], bytes)).not.toThrow()
  })
})
