export interface BundleSpec {
  /** Stable key used in last.json. */
  id: string
  /** Display name used in the report. */
  name: string
  /** Path relative to bench/bundle/dist. */
  file: string
}

export const BUNDLES: BundleSpec[] = [
  { id: 'core', name: 'JavaScript Root', file: 'core/fixtures/core.mjs' },
  { id: 'filter', name: 'JavaScript + Filter', file: 'filter/fixtures/filter.mjs' },
  { id: 'text', name: 'JavaScript Text', file: 'text/fixtures/text.mjs' },
  { id: 'html', name: 'JavaScript Safe HTML', file: 'html/fixtures/html.mjs' },
  { id: 'minimal', name: 'JavaScript Minimal Preset', file: 'minimal/fixtures/minimal.mjs' },
  { id: 'stream', name: 'JavaScript Stream', file: 'stream/fixtures/stream.mjs' },
  { id: 'wasm-edge', name: 'Rust Edge (WASM)', file: 'rust/mdream_edge_bg.wasm' },
]
