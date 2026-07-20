export interface BundleSpec {
  /** Stable key used in last.json. */
  id: string
  /** Display name used in the report. */
  name: string
  /** Path relative to bench/bundle/dist. */
  file: string
}

export const BUNDLES: BundleSpec[] = [
  { id: 'core', name: 'JavaScript Core', file: 'core/fixtures/core.mjs' },
  { id: 'minimal', name: 'JavaScript Minimal Preset', file: 'minimal/fixtures/minimal.mjs' },
  { id: 'stream', name: 'JavaScript Stream', file: 'stream/fixtures/stream.mjs' },
  { id: 'wasm-edge', name: 'Rust Edge (WASM)', file: 'rust/mdream_edge_bg.wasm' },
]
