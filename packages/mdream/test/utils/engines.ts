import { createJavaScriptEngine, type MarkdownEngine } from '@mdream/engine-js'
import { createRustEngine } from '../../src/engine'

export const engines: Array<{ name: string; engine: MarkdownEngine | (() => Promise<MarkdownEngine>) }> = [
  { name: 'JavaScript Engine', engine: createJavaScriptEngine() },
  { name: 'Rust Engine', engine: () => createRustEngine() },
]

export async function resolveEngine(engineThunk: MarkdownEngine | (() => Promise<MarkdownEngine>)): Promise<MarkdownEngine> {
  if (typeof engineThunk === 'function') {
    return await engineThunk()
  }
  return engineThunk
}
