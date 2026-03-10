import type { EngineOptions, MarkdownEngine, Plugin } from '@mdream/engine-js'

/**
 * Top-level options for the mdream facade.
 * Extends the shared `EngineOptions` with facade-level concerns:
 * - `transforms`: JS-engine-only imperative plugins
 * - `engine`: which engine instance to use for conversion
 */
export interface MdreamOptions extends EngineOptions {
  /**
   * Imperative transform plugins. JavaScript engine only.
   * When provided, the JS engine is used automatically regardless of `engine`.
   */
  transforms?: Plugin[]

  /**
   * Engine instance to use for conversion.
   * Defaults to the JavaScript engine (synchronous).
   * Use `createEngine()` to auto-select the best available engine.
   */
  engine?: MarkdownEngine
}
