import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Each entry must ship types that match what it returns at runtime. Under the
// `browser` condition, the root keeps the synchronous types: its stub throws
// when called. Type checks fixtures in test/types against the built dist/*.d.mts.
const typesDir = fileURLToPath(new URL('../types/', import.meta.url))
const tsc = fileURLToPath(new URL('./bin/tsc', import.meta.resolve('@typescript/native/package.json')))

function typecheck(condition: string): string {
  return execFileSync(process.execPath, [tsc, '-p', `tsconfig.${condition}.json`], { cwd: typesDir, encoding: 'utf8', stdio: 'pipe' })
}

describe('export condition types', () => {
  it.each(['node', 'edge', 'browser', 'browser-condition'])('%s types match the runtime return', (condition) => {
    expect(typecheck(condition)).toBe('')
  })
})
